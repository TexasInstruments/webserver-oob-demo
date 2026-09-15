'use strict';

/*
 * demo-coordinator.js
 *
 * Shared in-process module for the three C7x DSP coordination concerns:
 *
 *  1. Mutual exclusion — only one DSP demo runs at a time.  All plugins share
 *     the same Node.js process, so a single module-level variable is enough.
 *
 *  2. TVM preload — before an edge-ai demo spawns rpmsg_inference_example it
 *     must ensure the TVM model is already loaded on the C7x.  If the cache
 *     file is absent this module runs the binary with --preload synchronously.
 *
 *  3. TVM cache invalidation — DSP compute demos (2dfft, audio-offload,
 *     sigchain-biquad) load their own firmware onto the C7x, overwriting the
 *     TVM model.  When they exit the cache file is deleted so the next
 *     edge-ai run knows it must preload again.
 */

const fs                         = require('fs');
const net                        = require('net');
const { execFileSync, execFile } = require('child_process');

const TVM_DAEMON_SERVICE = 'tvm-model-daemon';

const TVM_CACHE   = '/var/lib/tvm_inference/loaded_model';
const PRELOAD_BIN = '/usr/bin/rpmsg_inference_example';
const TVM_SOCKET  = '/var/run/tvm-inference.sock';
const C7X_STATE   = '/sys/class/remoteproc/remoteproc0/state';
const TVM_MAGIC   = 0x544D5644;
const TVM_PING    = 0;
const TVM_PONG    = 1;
// How long to wait for the C7x remoteproc + daemon socket after a service restart.
const DAEMON_READY_TIMEOUT_MS = 10_000;
// How long to allow the preload binary to run before treating it as hung.
const PRELOAD_TIMEOUT_MS = 60_000;

// Name of the demo that currently owns the C7x DSP, or null.
let _activeDemoName  = null;
// IP address of the HTTP client that started the current demo, or null.
let _activeOwnerIp   = null;

// Never assume readiness at process startup.  It is established from the C7x
// remoteproc state, daemon PING/PONG, and model-cache marker.
let _tvmDaemonState = 'checking';
let _tvmLastError   = null;
let _preloadInProgress = false;

function c7xState() {
    try { return fs.readFileSync(C7X_STATE, 'utf8').trim(); }
    catch (_) { return 'unavailable'; }
}

function pingTvmDaemon(timeoutMs = 200) {
    return new Promise(resolve => {
        let settled = false;
        let received = Buffer.alloc(0);
        const socket = net.createConnection(TVM_SOCKET);
        const finish = ready => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(ready);
        };
        socket.setTimeout(timeoutMs);
        socket.on('connect', () => {
            const ping = Buffer.alloc(12);
            ping.writeUInt32LE(TVM_MAGIC, 0);
            ping.writeUInt32LE(TVM_PING, 4);
            ping.writeUInt32LE(0, 8);
            socket.write(ping);
        });
        socket.on('data', data => {
            received = Buffer.concat([received, data]);
            if (received.length >= 12) {
                finish(received.readUInt32LE(0) === TVM_MAGIC &&
                       received.readUInt32LE(4) === TVM_PONG);
            }
        });
        socket.on('timeout', () => finish(false));
        socket.on('error', () => finish(false));
        socket.on('close', () => finish(false));
    });
}

function preloadTvmModel(binaryPath = PRELOAD_BIN) {
    if (_preloadInProgress) return;
    _preloadInProgress = true;
    _tvmDaemonState = 'preloading';
    execFile(binaryPath, ['--preload'], { timeout: PRELOAD_TIMEOUT_MS }, err => {
        _preloadInProgress = false;
        if (err) {
            _tvmDaemonState = 'error';
            _tvmLastError = err.message;
            console.warn('[demo-coordinator] TVM preload failed:', err.message);
            return;
        }
        _tvmDaemonState = fs.existsSync(TVM_CACHE) ? 'ready' : 'error';
        _tvmLastError = _tvmDaemonState === 'ready' ? null :
            'TVM preload completed without creating the model cache marker';
        if (_tvmDaemonState === 'ready')
            console.log('[demo-coordinator] C7x and TVM model are ready');
    });
}

async function probeTvmReadiness(updateState = true) {
    const remoteproc = c7xState();
    const daemonReady = remoteproc === 'running' && await pingTvmDaemon();
    const modelReady = fs.existsSync(TVM_CACHE);
    const ready = remoteproc === 'running' && daemonReady && modelReady;

    /* This also covers systems where tvm-model-preload.service was not enabled.
     * The daemon socket is created only after its artifacts are initialized. */
    if (!ready && daemonReady && !modelReady && !_activeDemoName)
        preloadTvmModel();

    if (updateState && _tvmDaemonState !== 'restarting' && !_preloadInProgress) {
        _tvmDaemonState = ready ? 'ready' :
            remoteproc !== 'running' ? 'waiting-c7x' :
            !daemonReady ? 'loading' : 'preloading';
    }
    return {
        state: _tvmDaemonState,
        ready,
        c7xState: remoteproc,
        daemonReady,
        modelReady,
        error: _tvmLastError
    };
}

function waitForDaemonReady(timeoutMs = DAEMON_READY_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const poll = async () => {
            if (c7xState() === 'running' && await pingTvmDaemon()) return resolve();
            if (Date.now() >= deadline)
                return reject(new Error('timed out waiting for C7x and TVM daemon'));
            setTimeout(poll, 1000);
        };
        poll();
    });
}

module.exports = {

    /**
     * Try to acquire the C7x DSP for the named demo.
     *
     * @param {string}      demoName  - Identifier of the requesting demo.
     * @param {string|null} [ownerIp] - IP address of the HTTP client starting the demo.
     * @returns {string|null} null on success, or a human-readable error message if busy.
     */
    acquireDsp(demoName, ownerIp = null) {
        if (_activeDemoName)
            return `C7x DSP is busy: '${_activeDemoName}' is already running` +
                   (_activeOwnerIp ? ` (started from ${_activeOwnerIp})` : '');
        _activeDemoName = demoName;
        _activeOwnerIp  = ownerIp || null;
        return null;
    },

    /**
     * Release the DSP.  No-op if this demo does not currently own it.
     *
     * @param {string} demoName
     */
    releaseDsp(demoName) {
        if (_activeDemoName === demoName) { _activeDemoName = null; _activeOwnerIp = null; }
    },

    /**
     * Check whether a stop request from requesterIp is authorised.
     * Allows the request if:
     *   - no demo is running (nothing to stop)
     *   - the demo name matches AND the IP matches the owner
     *   - ownerIp was never recorded (legacy path — allow for backwards compat)
     *
     * @param {string}      demoName     - Demo the caller wants to stop.
     * @param {string|null} requesterIp  - IP address of the HTTP client.
     * @returns {string|null} null if allowed, or an error message if denied.
     */
    checkStopAuthorised(demoName, requesterIp) {
        if (!_activeDemoName || _activeDemoName !== demoName) return null; // not running
        if (!_activeOwnerIp) return null; // no owner recorded — allow
        if (_activeOwnerIp === requesterIp) return null; // correct owner
        return `Demo '${demoName}' was started from ${_activeOwnerIp} — only that client may stop it`;
    },

    /** Returns the name of the demo that currently owns the DSP, or null. */
    activeDemo() { return _activeDemoName; },

    /** Returns the IP that started the current demo, or null. */
    activeOwnerIp() { return _activeOwnerIp; },

    /**
     * Ensure the TVM model is preloaded onto the C7x DSP.
     * If the cache file is absent, runs `<binary> --preload` synchronously.
     * Throws on preload failure so the caller can surface a clean error.
     *
     * @param {string} [binaryPath]  Override path to rpmsg_inference_example.
     */
    ensurePreloaded(binaryPath) {
        if (c7xState() !== 'running')
            throw new Error('C7x remoteproc is not running');
        if (!fs.existsSync(TVM_SOCKET))
            throw new Error('TVM model daemon is not ready');
        if (fs.existsSync(TVM_CACHE)) return;
        const bin = binaryPath || PRELOAD_BIN;
        console.log(`[demo-coordinator] TVM cache absent — running preload via ${bin}`);
        execFileSync(bin, ['--preload'], { timeout: 90000, stdio: 'inherit' });
        // preload_default_model() in C++ already writes the artifacts path to TVM_CACHE.
        console.log('[demo-coordinator] TVM preload completed');
    },

    /**
     * Delete the TVM model cache file and restart tvm-model-daemon so it
     * reloads the model after a DSP compute demo has overwritten C7x firmware.
     * Must be called from the exit handler of every DSP compute demo.
     */
    invalidateTvmCache() {
        try {
            if (fs.existsSync(TVM_CACHE)) {
                fs.unlinkSync(TVM_CACHE);
                console.log('[demo-coordinator] TVM model cache invalidated');
            }
        } catch (err) {
            console.warn('[demo-coordinator] Could not remove TVM cache:', err.message);
        }
        _tvmDaemonState = 'restarting';
        _tvmLastError = null;
        execFile('systemctl', ['restart', TVM_DAEMON_SERVICE], (err) => {
            if (err) {
                console.warn(`[demo-coordinator] Could not restart ${TVM_DAEMON_SERVICE}:`, err.message);
                _tvmDaemonState = 'error';
                _tvmLastError = err.message;
                return;
            }
            console.log(`[demo-coordinator] ${TVM_DAEMON_SERVICE} restart requested; waiting for readiness`);
            waitForDaemonReady()
                .then(() => {
                    preloadTvmModel();
                })
                .catch(readyErr => {
                    _tvmDaemonState = 'error';
                    _tvmLastError = readyErr.message;
                    console.warn('[demo-coordinator] TVM readiness failed:', readyErr.message);
                });
        });
    },

    /** Returns true if the TVM model cache file exists on disk. */
    tvmCacheExists() { return fs.existsSync(TVM_CACHE); },

    /**
     * Returns true if the cache file contains exactly the given artifacts path,
     * meaning that specific model is already loaded in the daemon.
     * @param {string} artifactsPath  Full path to the model artifacts directory.
     */
    tvmCacheMatchesPath(artifactsPath) {
        try {
            if (!artifactsPath || !fs.existsSync(TVM_CACHE)) return false;
            return fs.readFileSync(TVM_CACHE, 'utf8').trim() === artifactsPath;
        } catch {
            return false;
        }
    },

    /**
     * Delete the TVM model cache marker without restarting the daemon.
     * Call this when a demo loads a different TVM model (e.g. YAMNet) so
     * that the next GCRN run knows it must re-preload the speech model.
     */
    clearModelCache() {
        try {
            if (fs.existsSync(TVM_CACHE)) {
                fs.unlinkSync(TVM_CACHE);
                console.log('[demo-coordinator] TVM model cache cleared (model switch)');
            }
        } catch (err) {
            console.warn('[demo-coordinator] Could not clear model cache:', err.message);
        }
    },

    /** Return measured C7x, daemon, and model readiness plus active demo occupancy. */
    async tvmStatus() {
        const base = await probeTvmReadiness();
        return { ...base, activeDemo: _activeDemoName, activeOwnerIp: _activeOwnerIp };
    },
};
