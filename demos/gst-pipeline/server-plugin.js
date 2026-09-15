'use strict';

/*
 * GStreamer pipeline demo — server plugin for AM62D.
 *
 * HTTP endpoints:
 *   GET  /gst/artifacts                        list TVM artifact directories
 *   POST /gst/upload-artifact?name=<dir>       upload zip or tar.gz archive
 *   GET  /gst/input-files                      list files in the input directory
 *   POST /gst/upload-input?filename=<name>     upload an input audio file
 *   GET  /gst/saved-pipelines                  list user-saved pipelines
 *   POST /gst/save-pipeline { id?,name,cmd }   create or overwrite a saved pipeline
 *   DELETE /gst/saved-pipeline?id=<id>         delete a saved pipeline
 *   POST /gst/run          { command: "..." }  start gst-launch-1.0 pipeline
 *   POST /gst/stop                             kill running pipeline
 *   GET  /gst/status                           { running, pid }
 *
 * WebSocket  /gst
 *   server → client:
 *     { type:'connected', running }
 *     { type:'started',   command, pid }
 *     { type:'log',       stream:'stdout'|'stderr', text }
 *     { type:'error',     message }
 *     { type:'exit',      code, reason? }
 */

const { spawn, execFileSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const demoCoordinator = require('../demo-coordinator');

const WS_OPEN        = 1;
const MAX_UPLOAD_MB  = 200;

const SAVED_FILE = '/var/lib/webserver-oob/gst-saved-pipelines.json';

/**
 * Allowed GStreamer launcher executables. Any other value in the first
 * token position is rejected before spawn is called.
 * @type {Set<string>}
 */
const ALLOWED_EXECUTABLES = new Set(['gst-launch-1.0', 'gst-launch-0.10']);

/**
 * Parse a GStreamer command string into [executable, ...args] without
 * invoking a shell. Handles single-quoted, double-quoted, and backslash-
 * escaped tokens so paths with spaces work correctly.
 *
 * Shell metacharacters (;, &&, |, $(), backticks) are treated as literal
 * characters because the result is passed directly to spawn(), never to sh.
 *
 * @param {string} cmd - Raw command string from the request body.
 * @returns {string[]} Token array where index 0 is the executable.
 * @throws {Error} On unterminated quotes or a trailing backslash.
 */
function tokenizeGstCommand(cmd) {
    const tokens = [];
    let current = '';
    let i = 0;
    while (i < cmd.length) {
        const ch = cmd[i];
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            if (current.length) { tokens.push(current); current = ''; }
            i++;
        } else if (ch === "'") {
            /* single-quoted: every character is literal */
            i++;
            while (i < cmd.length && cmd[i] !== "'") current += cmd[i++];
            if (i >= cmd.length) throw new Error('Unterminated single quote in command');
            i++;
        } else if (ch === '"') {
            /* double-quoted: backslash escapes ", \, $, ` only */
            i++;
            while (i < cmd.length && cmd[i] !== '"') {
                if (cmd[i] === '\\' && i + 1 < cmd.length) {
                    const next = cmd[i + 1];
                    if (next === '"' || next === '\\' || next === '$' || next === '`') {
                        current += next; i += 2;
                    } else {
                        current += cmd[i++]; /* keep the backslash */
                    }
                } else {
                    current += cmd[i++];
                }
            }
            if (i >= cmd.length) throw new Error('Unterminated double quote in command');
            i++;
        } else if (ch === '\\') {
            if (i + 1 >= cmd.length) throw new Error('Trailing backslash in command');
            current += cmd[++i]; i++;
        } else {
            current += ch; i++;
        }
    }
    if (current.length) tokens.push(current);
    return tokens;
}

/**
 * Tokenize a command and validate that the executable is on the allowlist.
 *
 * @param {string} command - Raw command string.
 * @returns {string[]} Token array ready for spawn(tokens[0], tokens.slice(1)).
 * @throws {Error} If the command is empty or the executable is not allowed.
 */
function validateGstCommand(command) {
    const tokens = tokenizeGstCommand(command);
    if (!tokens.length) throw new Error('Empty command');
    if (!ALLOWED_EXECUTABLES.has(tokens[0]))
        throw new Error('Only gst-launch-1.0 commands are permitted');
    return tokens;
}

/**
 * Simple per-IP sliding-window rate limiter (no external dependency).
 *
 * @param {number} maxRequests - Maximum requests allowed within windowMs.
 * @param {number} windowMs    - Rolling time window in milliseconds.
 * @returns {import('express').RequestHandler} Express middleware.
 */
function rateLimit(maxRequests, windowMs) {
    /** @type {Map<string, number[]>} */
    const hits = new Map();
    /* Evict IPs whose entire hit history has expired to prevent unbounded growth. */
    setInterval(() => {
        const cutoff = Date.now() - windowMs;
        hits.forEach((timestamps, ip) => {
            if (timestamps.every(t => t <= cutoff)) hits.delete(ip);
        });
    }, windowMs).unref();
    return (req, res, next) => {
        const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
        const now = Date.now();
        const cutoff = now - windowMs;
        const timestamps = (hits.get(ip) || []).filter(t => t > cutoff);
        if (timestamps.length >= maxRequests)
            return res.status(429).json({ error: 'Too many requests — please wait before retrying' });
        timestamps.push(now);
        hits.set(ip, timestamps);
        next();
    };
}

function readSaved() {
    try {
        if (!fs.existsSync(SAVED_FILE)) return [];
        return JSON.parse(fs.readFileSync(SAVED_FILE, 'utf8'));
    } catch (_) { return []; }
}

function writeSaved(arr) {
    fs.mkdirSync(path.dirname(SAVED_FILE), { recursive: true });
    fs.writeFileSync(SAVED_FILE, JSON.stringify(arr, null, 2));
}

const MAX_EXTRACTED_MB = 500;

/**
 * Return the total uncompressed byte count reported by the archive tool.
 * Throws if the listing command fails or the size cannot be determined.
 *
 * @param {string} tmpFile - Path to the archive on disk.
 * @param {boolean} isTar  - true for .tar.gz, false for .zip.
 * @returns {number} Total uncompressed size in bytes.
 */
function archiveUncompressedSize(tmpFile, isTar) {
    try {
        if (isTar) {
            /* tar --list --verbose: each line is "perms links owner group SIZE date name" */
            const out = execFileSync('tar', ['-tzvf', tmpFile], { timeout: 30000 }).toString();
            return out.split('\n').reduce((sum, line) => {
                const m = line.match(/^\S+\s+\S+\s+\S+\s+\S+\s+(\d+)/);
                return sum + (m ? parseInt(m[1], 10) : 0);
            }, 0);
        } else {
            /* unzip -l: last line is "N files, TOTAL bytes uncompressed, ..." */
            const out = execFileSync('unzip', ['-l', tmpFile], { timeout: 30000 }).toString();
            const m = out.match(/(\d+)\s+\d+\s+files?/i) || out.match(/(\d+)\s+bytes/i);
            return m ? parseInt(m[1], 10) : 0;
        }
    } catch (_) { return 0; /* listing failed; extraction will catch real errors */ }
}

/**
 * @param {import('express').Application} app
 * @param {import('ws').WebSocketServer} wss
 * @param {object} device - Parsed device.json
 * @param {{ express: import('express') }} ctx - Server context (express injected by server.js)
 */
module.exports = function registerGstPipeline(app, wss, device, { express } = {}) {
    const config       = (device.demoConfig || {})['gst-pipeline'] || {};
    const artifactsDir = config.artifactsDir || '/usr/share/tvm_inference/artifacts';
    const inputDir     = config.inputDir     || '/usr/share/tvm_inference/input';

    /* Rate limiters: 10 pipeline starts per minute; 5 uploads per minute */
    const runLimiter    = rateLimit(10,  60_000);
    const uploadLimiter = rateLimit(5,  60_000);

    const clients     = new Set();
    let activeProc    = null;
    let activeOwnerIp = null;

    /* ── helpers ────────────────────────────────────────────────── */

    /**
     * @param {object} msg - JSON-serialisable message to broadcast.
     */
    function broadcast(msg) {
        const data = JSON.stringify(msg);
        clients.forEach(ws => { if (ws.readyState === WS_OPEN) ws.send(data); });
    }

    function killActive() {
        if (!activeProc) return;
        try { activeProc.kill('SIGINT');  } catch (_) {}
        try { activeProc.kill('SIGTERM'); } catch (_) {}
        activeProc    = null;
        activeOwnerIp = null;
        demoCoordinator.releaseDsp('gst-pipeline');
    }

    /* ── GET /gst/artifacts ─────────────────────────────────────── */

    app.get('/gst/artifacts', (req, res) => {
        try {
            if (!fs.existsSync(artifactsDir))
                return res.json({ artifacts: [], dir: artifactsDir });

            const entries = fs.readdirSync(artifactsDir, { withFileTypes: true })
                .filter(e => e.isDirectory())
                .map(e => {
                    let files = [];
                    try { files = fs.readdirSync(path.join(artifactsDir, e.name)); } catch (_) {}
                    return { name: e.name, path: path.join(artifactsDir, e.name), fileCount: files.length, files };
                })
                .sort((a, b) => a.name.localeCompare(b.name));

            res.json({ artifacts: entries, dir: artifactsDir });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /* ── POST /gst/upload-artifact?name=<dir> ───────────────────── */

    app.post('/gst/upload-artifact', uploadLimiter,
        express.raw({ type: '*/*', limit: `${MAX_UPLOAD_MB}mb` }),
        (req, res) => {
            const body = req.body;
            /* sanitise artifact directory name */
            const rawName = ((req.query.name || req.query.filename || '') + '')
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9._-]/g, '')
                .replace(/\.(zip|tar\.gz|tgz)$/i, '')
                .slice(0, 64) || 'artifact';

            const destDir = path.join(artifactsDir, rawName);
            const isTar   = /\.tar\.gz$/i.test(req.query.filename || '') ||
                            /\.tgz$/i.test(req.query.filename || '');
            const ext     = isTar ? '.tar.gz' : '.zip';
            const tmpFile = path.join('/tmp', `gst-artifact-${Date.now()}${ext}`);

            try {
                fs.mkdirSync(destDir, { recursive: true });
                fs.writeFileSync(tmpFile, body);

                /* Reject archives that would expand past the extraction limit (ZIP bomb guard) */
                const uncompressed = archiveUncompressedSize(tmpFile, isTar);
                if (uncompressed > MAX_EXTRACTED_MB * 1024 * 1024)
                    throw new Error(`Archive uncompressed size (${Math.round(uncompressed / 1024 / 1024)} MB) exceeds ${MAX_EXTRACTED_MB} MB limit`);

                /* Use execFileSync with an arg array — no shell, no injection surface */
                if (isTar) {
                    execFileSync('tar', ['-xzf', tmpFile, '-C', destDir], { timeout: 60000 });
                } else {
                    execFileSync('unzip', ['-o', tmpFile, '-d', destDir], { timeout: 60000 });
                }

                const files = fs.readdirSync(destDir);
                res.json({ success: true, name: rawName, path: destDir, fileCount: files.length, files });
            } catch (e) {
                res.status(400).json({ error: e.message });
            } finally {
                try { fs.unlinkSync(tmpFile); } catch (_) {}
            }
        }
    );

    /* ── GET /gst/input-files ──────────────────────────────────── */

    app.get('/gst/input-files', (req, res) => {
        try {
            if (!fs.existsSync(inputDir))
                return res.json({ files: [], dir: inputDir });

            const entries = fs.readdirSync(inputDir, { withFileTypes: true })
                .filter(e => e.isFile())
                .map(e => {
                    let size = 0;
                    try { size = fs.statSync(path.join(inputDir, e.name)).size; } catch (_) {}
                    return { name: e.name, path: path.join(inputDir, e.name), size };
                })
                .sort((a, b) => a.name.localeCompare(b.name));

            res.json({ files: entries, dir: inputDir });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /* ── POST /gst/upload-input?filename=<name> ─────────────────── */

    app.post('/gst/upload-input', uploadLimiter,
        express.raw({ type: '*/*', limit: '50mb' }),
        (req, res) => {
            const body = req.body;
            const rawName = ((req.query.filename || '') + '')
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9._-]/g, '')
                .slice(0, 128) || 'input.wav';
            const dest = path.join(inputDir, rawName);
            try {
                fs.mkdirSync(inputDir, { recursive: true });
                fs.writeFileSync(dest, body);
                const size = fs.statSync(dest).size;
                res.json({ success: true, name: rawName, path: dest, size });
            } catch (e) {
                res.status(400).json({ error: e.message });
            }
        }
    );

    /* ── GET /gst/saved-pipelines ──────────────────────────────── */

    app.get('/gst/saved-pipelines', (req, res) => {
        res.json({ pipelines: readSaved() });
    });

    /* ── POST /gst/save-pipeline  { id?, name, command } ───────── */

    app.post('/gst/save-pipeline', (req, res) => {
        const { id, name, command } = req.body || {};
        if (!name || !command) return res.status(400).json({ error: 'name and command required' });
        try { validateGstCommand(command.trim()); }
        catch (e) { return res.status(400).json({ error: e.message }); }

        const safeName = (name + '').trim().slice(0, 80);
        const pipelines = readSaved();

        if (id) {
            const idx = pipelines.findIndex(p => p.id === id);
            if (idx === -1) return res.status(404).json({ error: 'Pipeline not found' });
            pipelines[idx] = { ...pipelines[idx], name: safeName, command: command.trim(), updatedAt: new Date().toISOString() };
            try { writeSaved(pipelines); res.json({ success: true, pipeline: pipelines[idx] }); }
            catch (e) { res.status(500).json({ error: e.message }); }
        } else {
            const newId    = `saved-${Date.now()}`;
            const pipeline = { id: newId, name: safeName, command: command.trim(), createdAt: new Date().toISOString() };
            pipelines.push(pipeline);
            try { writeSaved(pipelines); res.json({ success: true, pipeline }); }
            catch (e) { res.status(500).json({ error: e.message }); }
        }
    });

    /* ── DELETE /gst/saved-pipeline?id=<id> ────────────────────── */

    app.delete('/gst/saved-pipeline', (req, res) => {
        const id = (req.query.id || '').trim();
        if (!id) return res.status(400).json({ error: 'id required' });
        const pipelines = readSaved();
        const idx = pipelines.findIndex(p => p.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Pipeline not found' });
        pipelines.splice(idx, 1);
        try { writeSaved(pipelines); res.json({ success: true }); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    /* ── POST /gst/run  { command } ─────────────────────────────── */

    app.post('/gst/run', runLimiter, (req, res) => {
        if (activeProc) return res.status(409).json({ error: 'A pipeline is already running' });

        const command = ((req.body || {}).command || '').trim();
        if (!command) return res.status(400).json({ error: 'No command provided' });

        let tokens;
        try { tokens = validateGstCommand(command); }
        catch (e) { return res.status(400).json({ error: e.message }); }

        const dspError = demoCoordinator.acquireDsp('gst-pipeline', req.ip);
        if (dspError) return res.status(409).json({ error: dspError });

        try {
            /* spawn the GStreamer binary directly — no shell, no metacharacter expansion */
            const proc = spawn(tokens[0], tokens.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });
            activeProc    = proc;
            activeOwnerIp = req.ip;
            broadcast({ type: 'started', command, pid: proc.pid });

            const relay = stream => chunk => broadcast({ type: 'log', stream, text: chunk.toString() });
            proc.stdout.on('data', relay('stdout'));
            proc.stderr.on('data', relay('stderr'));

            proc.on('error', err => {
                if (activeProc === proc) {
                    activeProc = null; activeOwnerIp = null;
                    demoCoordinator.releaseDsp('gst-pipeline');
                }
                broadcast({ type: 'error', message: err.message });
            });
            proc.on('close', code => {
                if (activeProc === proc) {
                    activeProc = null; activeOwnerIp = null;
                    demoCoordinator.releaseDsp('gst-pipeline');
                }
                broadcast({ type: 'exit', code });
            });

            res.json({ status: 'started', pid: proc.pid });
        } catch (e) {
            activeProc    = null;
            activeOwnerIp = null;
            demoCoordinator.releaseDsp('gst-pipeline');
            res.status(500).json({ error: e.message });
        }
    });

    /* ── POST /gst/stop ─────────────────────────────────────────── */

    app.post('/gst/stop', (req, res) => {
        if (!activeProc) return res.json({ status: 'not running' });
        if (activeOwnerIp && activeOwnerIp !== req.ip)
            return res.status(403).json({ error: `Pipeline was started from ${activeOwnerIp} — only that client may stop it` });
        killActive();
        broadcast({ type: 'exit', code: null, reason: 'user stopped' });
        res.json({ status: 'stopped' });
    });

    /* ── GET /gst/status ────────────────────────────────────────── */

    app.get('/gst/status', (req, res) =>
        res.json({ running: Boolean(activeProc), pid: activeProc?.pid || null }));

    /* ── WebSocket /gst ─────────────────────────────────────────── */

    wss.on('connection', (ws, req) => {
        if (req.url !== '/gst') return;
        clients.add(ws);
        ws.send(JSON.stringify({ type: 'connected', running: Boolean(activeProc) }));
        ws.on('close', () => clients.delete(ws));
        ws.on('error', () => clients.delete(ws));
    });

    process.on('SIGTERM', killActive);
    process.on('SIGINT',  killActive);

    console.log('[gst-pipeline] GStreamer pipeline plugin registered');
};
