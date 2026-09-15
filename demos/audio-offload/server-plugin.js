/*
 * Copyright (C) 2026 Texas Instruments Incorporated - http://www.ti.com/
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * @file server-plugin.js
 * @memberof demos/audio-offload
 * @brief Express + WebSocket server plugin for the Audio DSP Offload demo.
 *
 * Bridges the four TCP ports exposed by `rpmsg_audio_offload_example` to a
 * single WebSocket path so the browser can visualize spectra and metrics
 * without a separate Python host utility.
 *
 * TCP port map (rpmsg_audio_offload_example acts as server):
 * | Port | Direction  | Content |
 * |------|------------|---------|
 * | 8888 | device→host | Log/metrics text lines |
 * | 8889 | host→device | Commands: SET FFT FILTER 0/1, START, STOP |
 * | 8890 | device→host | Input  audio: [4B tag "INPT"][N × S16LE samples] |
 * | 8891 | device→host | Output audio: [4B tag "OUTP"][N × S16LE samples] |
 *
 * WebSocket path: @c /audio-offload
 *
 * Messages sent to browser:
 * @code
 *   { type: 'status',  state: 'connected'|'disconnected'|'error', message }
 *   { type: 'audio',   channel: 'input'|'output', pcm: <base64 S16LE> }
 *   { type: 'metrics', frame, avgAmp, latency, mode, cpuLoad, dspLoad }
 * @endcode
 *
 * Messages received from browser:
 * @code
 *   { type: 'connect',      host: '<ip>' }
 *   { type: 'disconnect' }
 *   { type: 'set_filter',   value: 0|1 }
 *   { type: 'set_mode',     value: 'ARM'|'DSP' }
 * @endcode
 *
 * Set @c MOCK=1 to run on x86 without the embedded binary; sine+noise frames
 * and synthetic metrics are generated locally.
 */

'use strict';

const net            = require('net');
const { spawn }      = require('child_process');
const demoCoordinator = require('../demo-coordinator');

const WS_OPEN = 1;
const MOCK    = process.env.MOCK === '1';

/* TCP ports used by rpmsg_audio_offload_example — override via device.demoConfig['audio-offload'] */
let LOG_PORT     = 8888;
let CMD_PORT     = 8889;
let INDATA_PORT  = 8890;
let OUTDATA_PORT = 8891;

/* Audio frame geometry — must match DATA_SIZE / num_channels / sizeof(int16)
 * in dsp_offload.cfg (default: 4096 / 8 / 2 = 256 samples per channel).    */
const FRAME_SAMPLES = 256;
const FRAME_BYTES   = FRAME_SAMPLES * 2;   /* S16LE */
const FRAME_TAGGED  = 4 + FRAME_BYTES;     /* "INPT"/"OUTP" tag + PCM */

const RETRY_MS  = 3000;
const SAMPLE_RATE = 48000;

/* Log line pattern emitted by rpmsg_audio_offload_example */
const LOG_RE = /Frame\s+(\d+):\s+AvgAmp=([\d.]+),\s+Latency=([\d.]+)ms,\s+Mode=([A-Z]+)\s+CPULoad=([\d.]+)%\s+DSPLoad=([\d.]+)%/;

/* ------------------------------------------------------------------ */

module.exports = function registerAudioOffload(app, wss, device) {
    const portCfg = (device.demoConfig || {})['audio-offload'] || {};
    if (portCfg.logPort)     LOG_PORT     = portCfg.logPort;
    if (portCfg.cmdPort)     CMD_PORT     = portCfg.cmdPort;
    if (portCfg.inDataPort)  INDATA_PORT  = portCfg.inDataPort;
    if (portCfg.outDataPort) OUTDATA_PORT = portCfg.outDataPort;

    const connectedClients = new Set();

    /* TCP socket handles */
    let logSock = null;
    let cmdSock = null;
    let inSock  = null;
    let outSock = null;

    /* Receive buffers for binary audio streams */
    let inBuf  = Buffer.alloc(0);
    let outBuf = Buffer.alloc(0);

    let tcpConnected  = false;
    let mockInterval  = null;
    let mockMetricInt = null;
    let offloadProc   = null;
    let retryTimer    = null;
    let retryCount    = 0;
    const MAX_RETRIES = 10;

    const BIN_PATH  = (device && device.demoConfig &&
                       device.demoConfig['audio-offload'] &&
                       device.demoConfig['audio-offload'].binPath)
                      || '/usr/bin/rpmsg_audio_offload_example';

    const DEF_HOST  = (device && device.demoConfig &&
                       device.demoConfig['audio-offload'] &&
                       device.demoConfig['audio-offload'].host)
                      || '127.0.0.1';

    /* ------------------------------------------------------------ */
    /* Helpers                                                       */
    /* ------------------------------------------------------------ */

    function broadcast(msg) {
        const str = JSON.stringify(msg);
        connectedClients.forEach(ws => {
            if (ws.readyState === WS_OPEN) ws.send(str);
        });
    }

    /**
     * @brief Parse framed audio data from a raw TCP receive buffer.
     *
     * Scans for 4-byte tag (@p tag = "INPT" or "OUTP"), then extracts the
     * following FRAME_BYTES bytes as one PCM block.  Unrecognised bytes
     * before the first tag are discarded.
     *
     * @param {Buffer} buf  Accumulated receive buffer.
     * @param {string} tag  Expected 4-character tag ("INPT" or "OUTP").
     * @returns {{ frames: Buffer[], remaining: Buffer }}
     */
    function parseAudioFrames(buf, tag) {
        const frames = [];
        let i = 0;
        while (i + FRAME_TAGGED <= buf.length) {
            if (buf.slice(i, i + 4).toString('ascii') === tag) {
                frames.push(buf.slice(i + 4, i + FRAME_TAGGED));
                i += FRAME_TAGGED;
            } else {
                /* Resync: find next occurrence of tag */
                const next = buf.indexOf(Buffer.from(tag, 'ascii'), i + 1);
                if (next === -1) {
                    i = buf.length - 3;
                    break;
                }
                i = next;
            }
        }
        return { frames, remaining: buf.slice(i) };
    }

    function handleInData(data) {
        inBuf = Buffer.concat([inBuf, data]);
        const { frames, remaining } = parseAudioFrames(inBuf, 'INPT');
        inBuf = remaining;
        frames.forEach(pcm => {
            broadcast({ type: 'audio', channel: 'input', pcm: pcm.toString('base64') });
        });
    }

    function handleOutData(data) {
        outBuf = Buffer.concat([outBuf, data]);
        const { frames, remaining } = parseAudioFrames(outBuf, 'OUTP');
        outBuf = remaining;
        frames.forEach(pcm => {
            broadcast({ type: 'audio', channel: 'output', pcm: pcm.toString('base64') });
        });
    }

    function handleLogData(data) {
        data.toString().split('\n').forEach(line => {
            const m = line.match(LOG_RE);
            if (m) {
                broadcast({
                    type:     'metrics',
                    frame:    parseInt(m[1], 10),
                    avgAmp:   parseFloat(m[2]),
                    latency:  parseFloat(m[3]),
                    mode:     m[4],
                    cpuLoad:  parseFloat(m[5]),
                    dspLoad:  parseFloat(m[6])
                });
            }
        });
    }

    /* ------------------------------------------------------------ */
    /* TCP connection management                                     */
    /* ------------------------------------------------------------ */

    /**
     * @brief Open one TCP client socket with automatic retry on failure.
     *
     * @param {string}   host    Target IP address.
     * @param {number}   port    Target TCP port.
     * @param {Function} onData  Called with each Buffer received.
     * @param {Function} onReady Called once the connection is established.
     * @returns {net.Socket}
     */
    function openSocket(host, port, onData, onReady) {
        const sock = new net.Socket();
        sock.connect(port, host, () => {
            console.log(`[audio-offload] Connected to ${host}:${port}`);
            if (onReady) onReady();
        });
        sock.on('data', onData);
        sock.on('error', err => {
            console.warn(`[audio-offload] Socket ${port} error: ${err.message}`);
        });
        sock.on('close', () => {
            console.log(`[audio-offload] Socket ${port} closed`);
        });
        return sock;
    }

    function connectTcp(host, isRetry = false) {
        if (tcpConnected) {
            broadcast({ type: 'status', state: 'connected', message: 'Already connected' });
            return;
        }

        if (!isRetry) {
            retryCount = 0;
            if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        }

        console.log(`[audio-offload] Connecting to rpmsg_audio_offload_example at ${host}${isRetry ? ` (attempt ${retryCount + 1}/${MAX_RETRIES})` : ''}`);
        broadcast({ type: 'status', state: 'connecting', message: `Connecting to ${host}…` });

        let ready = 0;
        let connectFailed = false;

        function onReady() {
            ready++;
            if (ready === 4) {   /* all four sockets up */
                tcpConnected = true;
                retryCount = 0;
                if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
                broadcast({ type: 'status', state: 'connected', message: `Connected to ${host}` });
            }
        }

        function scheduleRetry() {
            if (connectFailed || tcpConnected) return;
            connectFailed = true;

            /* Clean up failed sockets */
            [logSock, cmdSock, inSock, outSock].forEach(s => { if (s) { try { s.destroy(); } catch (_) {} } });
            logSock = cmdSock = inSock = outSock = null;

            if (retryCount < MAX_RETRIES && offloadProc) {
                retryCount++;
                retryTimer = setTimeout(() => connectTcp(host, true), RETRY_MS);
            } else {
                broadcast({ type: 'status', state: 'error', message: 'Failed to connect after multiple attempts' });
            }
        }

        logSock = openSocket(host, LOG_PORT,     handleLogData, onReady);
        cmdSock = openSocket(host, CMD_PORT,     () => {},       onReady);
        inSock  = openSocket(host, INDATA_PORT,  handleInData,  onReady);
        outSock = openSocket(host, OUTDATA_PORT, handleOutData, onReady);

        /* Trigger retry if any socket fails to connect */
        [logSock, cmdSock, inSock, outSock].forEach(s => {
            s.once('error', () => {
                setTimeout(scheduleRetry, 100);  /* small delay so all 4 error events can fire */
            });
            s.on('close', () => {
                if (tcpConnected) {
                    tcpConnected = false;
                    broadcast({ type: 'status', state: 'disconnected', message: 'Connection lost' });
                }
            });
        });
    }

    function disconnectTcp() {
        tcpConnected = false;
        retryCount = 0;
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        [logSock, cmdSock, inSock, outSock].forEach(s => { if (s) { try { s.destroy(); } catch (_) {} } });
        logSock = cmdSock = inSock = outSock = null;
        inBuf = outBuf = Buffer.alloc(0);
        broadcast({ type: 'status', state: 'disconnected', message: 'Disconnected' });
        console.log('[audio-offload] Disconnected');
    }

    function sendCmd(text) {
        if (cmdSock && !cmdSock.destroyed) {
            cmdSock.write(text + '\n');
        }
    }

    /* ------------------------------------------------------------ */
    /* MOCK mode — sine+noise audio + synthetic metrics              */
    /* ------------------------------------------------------------ */

    function startMock() {
        if (mockInterval) return;

        const SR = SAMPLE_RATE;
        let phase = 0;
        let mockFrame = 0;
        let filterOn = true;

        /* Generate one framed PCM block */
        function makeFrame(addNoise) {
            const buf = Buffer.allocUnsafe(FRAME_BYTES);
            for (let i = 0; i < FRAME_SAMPLES; i++) {
                const sine = Math.sin(2 * Math.PI * 1000 * (phase + i) / SR);
                const v    = addNoise
                    ? sine * 0.5 + (Math.random() * 2 - 1) * 0.35
                    : sine * 0.6;
                const s16  = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
                buf.writeInt16LE(s16, i * 2);
            }
            phase = (phase + FRAME_SAMPLES) % SR;
            return buf;
        }

        /* ~21ms per frame ≈ 256/48000 × 1000 ms */
        const intervalMs = Math.round(FRAME_SAMPLES * 1000 / SR);
        mockInterval = setInterval(() => {
            const inPcm  = makeFrame(true);
            const outPcm = makeFrame(false);
            broadcast({ type: 'audio', channel: 'input',  pcm: inPcm.toString('base64')  });
            broadcast({ type: 'audio', channel: 'output', pcm: outPcm.toString('base64') });
        }, intervalMs);

        /* Metrics every ~500ms */
        mockMetricInt = setInterval(() => {
            mockFrame += Math.round(500 / intervalMs);
            broadcast({
                type:    'metrics',
                frame:   mockFrame,
                avgAmp:  800 + Math.random() * 400,
                latency: 1.2  + Math.random() * 0.4,
                mode:    'DSP',
                cpuLoad: 8    + Math.random() * 4,
                dspLoad: 35   + Math.random() * 10
            });
        }, 500);

        tcpConnected = true;
        broadcast({ type: 'status', state: 'connected', message: 'Connected (MOCK mode)' });
        console.log('[audio-offload] MOCK started');
    }

    function stopMock() {
        if (mockInterval)  { clearInterval(mockInterval);  mockInterval  = null; }
        if (mockMetricInt) { clearInterval(mockMetricInt); mockMetricInt = null; }
        tcpConnected = false;
        broadcast({ type: 'status', state: 'disconnected', message: 'Disconnected (MOCK mode)' });
    }

    /* ------------------------------------------------------------ */
    /* REST endpoints                                                */
    /* ------------------------------------------------------------ */

    app.get('/audio-offload/connect', (req, res) => {
        const host = req.query.host || '127.0.0.1';
        if (MOCK) { startMock(); return res.send('Audio offload started (MOCK)'); }
        connectTcp(host);
        res.send(`Connecting to audio offload backend at ${host}`);
    });

    app.get('/audio-offload/disconnect', (req, res) => {
        if (MOCK) { stopMock(); return res.send('Audio offload stopped (MOCK)'); }
        disconnectTcp();
        res.send('Disconnected from audio offload backend');
    });

    app.get('/audio-offload/filter', (req, res) => {
        const val = req.query.enable === '1' ? 1 : 0;
        if (MOCK) return res.send(`Filter ${val ? 'enabled' : 'disabled'} (MOCK)`);
        sendCmd(`SET FFT FILTER ${val}`);
        res.send(`Filter ${val ? 'enabled' : 'disabled'}`);
    });

    app.get('/audio-offload/run', (req, res) => {
        if (MOCK) { startMock(); return res.send('Audio offload started (MOCK)'); }
        if (offloadProc) {
            if (!tcpConnected) connectTcp(DEF_HOST);
            return res.send('rpmsg_audio_offload_example already running');
        }

        const dspError = demoCoordinator.acquireDsp('audio-offload', req.ip);
        if (dspError) return res.status(409).send(dspError);

        console.log(`[audio-offload] Spawning ${BIN_PATH}`);
        broadcast({ type: 'status', state: 'connecting', message: 'Starting rpmsg_audio_offload_example…' });
        /* detached: true gives the binary its own process group so that
         * killOffloadProc() can send SIGINT to the entire group (equivalent
         * to Ctrl+C in a terminal), which triggers the binary's own cleanup. */
        offloadProc = spawn(BIN_PATH, [], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
        offloadProc.stdout.on('data', d => process.stdout.write(`[rpmsg] ${d}`));
        offloadProc.stderr.on('data', d => process.stderr.write(`[rpmsg] ${d}`));
        offloadProc.on('exit', code => {
            console.log(`[audio-offload] rpmsg_audio_offload_example exited (code=${code})`);
            offloadProc = null;
            retryCount = 0;
            if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
            if (tcpConnected) disconnectTcp();
            demoCoordinator.invalidateTvmCache();
            demoCoordinator.releaseDsp('audio-offload');
        });
        /* Wait for binary to open TCP ports before connecting */
        setTimeout(() => connectTcp(DEF_HOST), 2000);
        res.send('rpmsg_audio_offload_example started');
    });

    app.get('/audio-offload/stop', (req, res) => {
        if (MOCK) { stopMock(); return res.send('Audio offload stopped (MOCK)'); }
        const denied = demoCoordinator.checkStopAuthorised('audio-offload', req.ip);
        if (denied) return res.status(403).send(denied);
        disconnectTcp();
        killOffloadProc();
        res.send('Audio offload stopped');
    });

    /* ------------------------------------------------------------ */
    /* WebSocket /audio-offload                                      */
    /* ------------------------------------------------------------ */

    wss.on('connection', (ws, req) => {
        if (req.url !== '/audio-offload') return;

        console.log('[audio-offload] WebSocket client connected');
        connectedClients.add(ws);

        /* Send current connection state immediately */
        ws.send(JSON.stringify({
            type:    'status',
            state:   tcpConnected ? 'connected' : 'disconnected',
            message: tcpConnected ? 'Backend connected' : 'Not connected',
            mock:    MOCK
        }));

        ws.on('message', msg => {
            try {
                const data = JSON.parse(msg);
                switch (data.type) {
                    case 'connect':
                        if (MOCK) startMock();
                        else connectTcp(data.host || '127.0.0.1');
                        break;
                    case 'disconnect':
                        if (MOCK) stopMock();
                        else disconnectTcp();
                        break;
                    case 'set_filter':
                        if (MOCK) break;
                        sendCmd(`SET FFT FILTER ${data.value ? 1 : 0}`);
                        break;
                    case 'set_mode':
                        if (MOCK) break;
                        sendCmd(`SET MODE ${data.value === 'ARM' ? 0 : 1}`);
                        break;
                }
            } catch (e) {
                console.error('[audio-offload] WS message parse error:', e);
            }
        });

        ws.on('close', () => {
            console.log('[audio-offload] WebSocket client disconnected');
            connectedClients.delete(ws);
            if (connectedClients.size === 0 && offloadProc) {
                console.log('[audio-offload] Last client left — sending SIGINT to process');
                disconnectTcp();
                killOffloadProc();
            }
        });

        ws.on('error', err => {
            console.error('[audio-offload] WebSocket error:', err);
            connectedClients.delete(ws);
        });
    });

    /* Send SIGINT to the binary's entire process group (Ctrl+C equivalent).
     * Falls back to direct signal if process group kill fails. */
    function killOffloadProc() {
        if (!offloadProc) return;
        try {
            process.kill(-offloadProc.pid, 'SIGINT');
            offloadProc = null;
        } catch (_) {
            try { offloadProc.kill('SIGINT'); } catch (_) {}
            offloadProc = null;
        }
        /* offloadProc is nulled by the 'exit' handler once the process terminates */
    }

    function _cleanup() {
        if (MOCK) stopMock(); else disconnectTcp();
        killOffloadProc();
    }
    process.on('SIGTERM', _cleanup);
    process.on('SIGINT',  _cleanup);

    console.log('[audio-offload] Plugin registered' + (MOCK ? ' (MOCK mode)' : ''));
};
