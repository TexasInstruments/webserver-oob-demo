/*
 * Copyright (C) 2026 Texas Instruments Incorporated - http://www.ti.com/
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * server-plugin.js — Sigchain Biquad EQ demo
 *
 * Spawns rpmsg_sigchain_biquad_example (network/GUI mode) and bridges its
 * multi-port TCP server to WebSocket clients on /sigchain-biquad.
 *
 * TCP port map (rpmsg_sigchain_biquad_example acts as server):
 *   8888  board→host   Log messages
 *   8889  host→board   Commands: START / STOP
 *   8890  board→host   Real-time JSON statistics (c7xLoad, cycles, throughput, status, frame)
 *
 * WebSocket messages sent to browser:
 *   { type: 'status', state: 'connected'|'connecting'|'disconnected'|'stopped', message }
 *   { type: 'log',    text }
 *   { type: 'stats',  c7xLoad, cycles, throughput, status, frame }
 *
 * MOCK=1: simulates codec init logs + streaming stats at 2 Hz.
 */

'use strict';

const fs        = require('fs');
const net       = require('net');
const { spawn, exec } = require('child_process');
const demoCoordinator = require('../demo-coordinator');

const UENV_PATH   = '/run/media/boot-mmcblk1p1/uEnv.txt';
const OVERLAY_DTB = 'ti/k3-am62d2-evm-dsp-controlled-audio.dtbo';

const WS_OPEN = 1;
const MOCK    = process.env.MOCK === '1';

const LOG_PORT  = 8888;
const CMD_PORT  = 8889;
const STAT_PORT = 8890;

module.exports = function registerSigchainBiquad(app, wss, device) {

    const clients = new Set();
    let logSock = null, cmdSock = null, statSock = null;
    let tcpConnected = false;
    let proc = null;
    let mockLogTimer  = null;
    let mockStatTimer = null;
    let autoStopTimer = null;

    /* Leftover bytes from partial JSON lines on port 8890 */
    let statBuf = '';

    const BIN_PATH = (device && device.demoConfig &&
                      device.demoConfig['sigchain-biquad'] &&
                      device.demoConfig['sigchain-biquad'].binPath)
                     || '/usr/bin/rpmsg_sigchain_biquad_example';

    function broadcast(msg) {
        const s = JSON.stringify(msg);
        clients.forEach(ws => { if (ws.readyState === WS_OPEN) ws.send(s); });
    }

    /* ── TCP helpers ── */

    /*
     * Open all 3 sockets together. If any one errors or times out before all 3
     * are ready, destroy the whole set and retry after 1 s (up to 30 attempts).
     * Only when all 3 connect do we assign module-level vars and send the command.
     */
    function _connectWithRetry(host, attempt) {
        attempt = attempt || 0;
        if (!proc) return;
        if (attempt > 30) {
            broadcast({ type: 'status', state: 'disconnected', message: 'Timed out waiting for TCP server' });
            return;
        }

        let readyCount = 0;
        let aborted    = false;
        const pending  = [null, null, null]; /* [log, cmd, stat] */

        function abort() {
            if (aborted) return;
            aborted = true;
            pending.forEach(s => { if (s) try { s.destroy(); } catch (_) {} });
            setTimeout(() => _connectWithRetry(host, attempt + 1), 1000);
        }

        function makeSocket(idx, port, onData) {
            const sock = new net.Socket();
            pending[idx] = sock;
            sock.setTimeout(2000);
            sock.connect(port, host, () => {
                if (aborted) { sock.destroy(); return; }
                sock.setTimeout(0);
                console.log(`[sigchain-biquad] Connected ${host}:${port}`);
                if (++readyCount === 3) {
                    // Check if we've been aborted before using the sockets
                    if (aborted) {
                        // Clean up any partially assigned sockets
                        pending.forEach(s => { if (s) try { s.destroy(); } catch (_) {} });
                        return;
                    }
                    logSock  = pending[0];
                    cmdSock  = pending[1];
                    statSock = pending[2];
                    tcpConnected = true;
                    broadcast({ type: 'status', state: 'connected', message: `Connected to ${host}` });
                    console.log(`[sigchain-biquad] Socket states - log: ${logSock ? 'connected' : 'null'}, cmd: ${cmdSock ? 'connected' : 'null'}, stat: ${statSock ? 'connected' : 'null'}`);
                    console.log(`[sigchain-biquad] Socket destroyed flags - log: ${logSock ? logSock.destroyed : 'N/A'}, cmd: ${cmdSock ? cmdSock.destroyed : 'N/A'}, stat: ${statSock ? statSock.destroyed : 'N/A'}`);
                    sendCmd('CODEC_INIT');
                    sendCmd('START');
                    console.log('[sigchain-biquad] Sent: CODEC_INIT');
                }
            });
            sock.on('data', onData);
            sock.on('error', err => {
                console.warn(`[sigchain-biquad] Socket ${port}: ${err.message}`);
                abort();
            });
            sock.on('timeout', () => {
                console.warn(`[sigchain-biquad] Socket ${port} connect timeout`);
                abort();
            });
            sock.on('close', () => {
                if (tcpConnected) {
                    tcpConnected = false;
                    broadcast({ type: 'status', state: 'disconnected', message: 'Connection lost' });
                }
            });
        }

        broadcast({ type: 'status', state: 'connecting', message: `Connecting to ${host} (attempt ${attempt + 1})…` });
        makeSocket(0, LOG_PORT,  d => broadcast({ type: 'log', text: d.toString() }));
        makeSocket(1, CMD_PORT,  d => {
        console.log(`[sigchain-biquad] Command socket received: ${d.toString().trim()}`);
        // Also broadcast as log message for UI
        broadcast({ type: 'log', text: `[CMD RX] ${d.toString()}` });
    });
        let _statLogCount = 0;
        makeSocket(2, STAT_PORT, d => {
            statBuf += d.toString();
            const lines = statBuf.split('\n');
            statBuf = lines.pop();
            lines.forEach(line => {
                line = line.trim();
                if (!line) return;
                try {
                    const obj = JSON.parse(line);
                    /* Log first 3 stat frames so we can verify field names on the board */
                    if (_statLogCount < 3) {
                        console.log(`[sigchain-biquad] Stats raw (frame ${_statLogCount + 1}):`, JSON.stringify(obj));
                        _statLogCount++;
                    }
                    /* Normalize cycle field name variants from the binary */
                    if (obj.cycles     == null && obj.cycleCount      != null) obj.cycles = obj.cycleCount;
                    if (obj.cycles     == null && obj.c7xCycles        != null) obj.cycles = obj.c7xCycles;
                    if (obj.cycles     == null && obj.cycle_count      != null) obj.cycles = obj.cycle_count;
                    if (obj.cycles     == null && obj.cyclesPerFrame   != null) obj.cycles = obj.cyclesPerFrame;
                    /* Normalize c7xLoad variants */
                    if (obj.c7xLoad    == null && obj.c7x_load         != null) obj.c7xLoad = obj.c7x_load;
                    if (obj.c7xLoad    == null && obj.dspLoad           != null) obj.c7xLoad = obj.dspLoad;
                    /* Normalize throughput variants */
                    if (obj.throughput == null && obj.ddrThroughput     != null) obj.throughput = obj.ddrThroughput;
                    if (obj.throughput == null && obj.c7xThroughput     != null) obj.throughput = obj.c7xThroughput;
                    /* Normalize status variants */
                    if (obj.status     == null && obj.state              != null) obj.status = obj.state;
                    if (obj.status     == null && obj.audioStatus        != null) obj.status = obj.audioStatus;
                    broadcast({ type: 'stats', ...obj });
                } catch (_) {}
            });
        });
    }

    function disconnectTcp() {
        if (autoStopTimer) clearTimeout(autoStopTimer);
        tcpConnected = false;
        statBuf = '';
        [logSock, cmdSock, statSock].forEach(s => {
            if (s) { try { s.destroy(); } catch (_) {} }
        });
        logSock = cmdSock = statSock = null;
        broadcast({ type: 'status', state: 'disconnected', message: 'Disconnected' });
    }

    function sendCmd(text) {
        if (!cmdSock) {
            console.warn('[sigchain-biquad] sendCmd: cmdSock is null');
            return;
        }
        if (cmdSock.destroyed) {
            console.warn('[sigchain-biquad] sendCmd: cmdSock is destroyed');
            return;
        }
        try {
            const written = cmdSock.write(text + '\n');
            if (!written) {
                console.warn('[sigchain-biquad] sendCmd: write returned false (buffer full)');
            }
            console.log(`[sigchain-biquad] Sent command: "${text.trim()}"`);
        } catch (err) {
            console.error('[sigchain-biquad] sendCmd: exception during write:', err.message);
        }
    }

    /* ── REST endpoints ── */

    app.get('/sigchain-biquad/run', (req, res) => {
        if (MOCK) { _startMock(); return res.send('sigchain-biquad started (MOCK)'); }
        if (proc) {
            if (!tcpConnected) {
                // Give it a moment to reconnect if needed
                setTimeout(() => _connectWithRetry('127.0.0.1'), 1000);
            }
            return res.send('rpmsg_sigchain_biquad_example already running');
        }

        const dspError = demoCoordinator.acquireDsp('sigchain-biquad', req.ip);
        if (dspError) return res.status(409).send(dspError);

        if (autoStopTimer) clearTimeout(autoStopTimer);
        broadcast({ type: 'status', state: 'connecting', message: 'Starting rpmsg_sigchain_biquad_example…' });
        proc = spawn(BIN_PATH, [], { stdio: ['ignore', 'pipe', 'pipe'] });
        // Give binary time to initialize before connecting
        setTimeout(() => {
            _connectWithRetry('127.0.0.1');
        }, 1000);
        proc.stdout.on('data', d => { process.stdout.write(`[sigchain] ${d}`); broadcast({ type: 'log', text: d.toString() }); });
        proc.stderr.on('data', d => { process.stderr.write(`[sigchain] ${d}`); broadcast({ type: 'log', text: d.toString() }); });
        proc.on('exit', code => {
            proc = null;
            if (autoStopTimer) clearTimeout(autoStopTimer);
            if (tcpConnected) disconnectTcp();
            demoCoordinator.invalidateTvmCache();
            demoCoordinator.releaseDsp('sigchain-biquad');
            broadcast({ type: 'status', state: 'stopped', message: `Process exited (code=${code})` });
        });
        _connectWithRetry('127.0.0.1');
        res.send('rpmsg_sigchain_biquad_example started');
    });

    function _stopProc() {
        if (autoStopTimer) clearTimeout(autoStopTimer);
        sendCmd('STOP');
        setTimeout(() => {
            sendCmd('CODEC_SHUTDOWN');
            setTimeout(() => {
                disconnectTcp();
                if (proc) { try { proc.kill('SIGINT'); } catch (_) {} proc = null; }
            }, 500);
        }, 100);
    }

    app.get('/sigchain-biquad/stop', (req, res) => {
        if (MOCK) { _stopMock(); return res.send('sigchain-biquad stopped (MOCK)'); }
        const denied = demoCoordinator.checkStopAuthorised('sigchain-biquad', req.ip);
        if (denied) return res.status(403).send(denied);
        _stopProc();
        res.send('sigchain-biquad stopped');
    });

    app.get('/sigchain-biquad/start-audio', (req, res) => {
        if (MOCK) return res.send('start (MOCK)');
        sendCmd('CODEC_INIT');
        setTimeout(() => sendCmd('START'), 100);
        res.send('start sent');
    });

    app.get('/sigchain-biquad/stop-audio', (req, res) => {
        if (MOCK) return res.send('stop (MOCK)');
        const denied = demoCoordinator.checkStopAuthorised('sigchain-biquad', req.ip);
        if (denied) return res.status(403).send(denied);
        if (autoStopTimer) clearTimeout(autoStopTimer);
        sendCmd('STOP');
        setTimeout(() => sendCmd('CODEC_SHUTDOWN'), 100);
        res.send('stop sent');
    });

    /* Check whether the DSP audio overlay is present in uEnv.txt */
    app.get('/sigchain-biquad/check-overlay', (req, res) => {
        if (MOCK) return res.json({ active: true, mock: true });
        try {
            const content = fs.readFileSync(UENV_PATH, 'utf8');
            const active  = content.includes(OVERLAY_DTB);
            res.json({ active, path: UENV_PATH });
        } catch (err) {
            res.json({ active: false, error: err.message, path: UENV_PATH });
        }
    });

    /* Write the overlay into uEnv.txt and reboot */
    app.post('/sigchain-biquad/enable-overlay', (req, res) => {
        if (MOCK) return res.json({ success: true, mock: true });
        try {
            let content = '';
            try { content = fs.readFileSync(UENV_PATH, 'utf8'); } catch (_) {}

            if (!content.includes(OVERLAY_DTB)) {
                const lines = content.split('\n');
                const idx   = lines.findIndex(l => /^name_overlays=/.test(l));
                if (idx >= 0) {
                    lines[idx] = lines[idx].trimEnd() + ' ' + OVERLAY_DTB;
                } else {
                    lines.push('name_overlays=' + OVERLAY_DTB);
                }
                fs.writeFileSync(UENV_PATH, lines.join('\n'), 'utf8');
            }

            res.json({ success: true });
            setTimeout(() => exec('reboot', err => {
                if (err) console.error('[sigchain-biquad] reboot failed:', err.message);
            }), 1000);
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /* Remove the DSP audio overlay from uEnv.txt and reboot */
    app.post('/sigchain-biquad/disable-overlay', (req, res) => {
        if (MOCK) return res.json({ success: true, mock: true });
        try {
            let content = '';
            try { content = fs.readFileSync(UENV_PATH, 'utf8'); } catch (_) {}

            if (content.includes(OVERLAY_DTB)) {
                const lines = content.split('\n');
                const idx   = lines.findIndex(l => /^name_overlays=/.test(l));
                if (idx >= 0) {
                    const parts = lines[idx].replace(/^name_overlays=/, '').trim()
                                            .split(/\s+/).filter(p => p !== OVERLAY_DTB);
                    if (parts.length > 0) {
                        lines[idx] = 'name_overlays=' + parts.join(' ');
                    } else {
                        lines.splice(idx, 1);
                    }
                    fs.writeFileSync(UENV_PATH, lines.join('\n'), 'utf8');
                }
            }

            res.json({ success: true });
            setTimeout(() => exec('reboot', err => {
                if (err) console.error('[sigchain-biquad] reboot failed:', err.message);
            }), 1000);
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    /* ── MOCK ── */

    function _startMock() {
        if (mockLogTimer) return;
        tcpConnected = true;
        broadcast({ type: 'status', state: 'connected', message: 'Connected (MOCK mode)' });

        const logs = [
            'RPMsg based Sigchain Biquad EQ Example\n',
            'Initializing TAD5212 DAC and PCM6240 ADC...\n',
            'I2C codec: DAC volume = 0 dB, ADC gain = 0 dB\n',
            'Loading C7x firmware: sigchain_biquad_cascade.c75ss0-0.release.strip.out\n',
            'C7x firmware loaded successfully\n',
            'Biquad stage 1: LPF  fc=800Hz  Q=0.707  gain=0.0dB\n',
            'Biquad stage 2: Peak fc=4kHz   Q=1.4    gain=+3.0dB\n',
            'Biquad stage 3: HPF  fc=80Hz   Q=0.707  gain=0.0dB\n',
            'Audio stream running — monitoring C7x DSP performance...\n'
        ];

        let li = 0;
        mockLogTimer = setInterval(() => {
            if (li < logs.length) broadcast({ type: 'log', text: logs[li++] });
        }, 400);

        let frame = 0;
        mockStatTimer = setInterval(() => {
            frame++;
            broadcast({
                type:       'stats',
                c7xLoad:    0.5 + Math.abs(Math.sin(frame * 0.15)) * 2 + Math.random() * 0.5,
                cycles:     Math.round(9800 + Math.sin(frame * 0.1) * 1200 + Math.random() * 500),
                throughput: 145 + Math.sin(frame * 0.08) * 15 + Math.random() * 5,
                status:     'RUNNING',
                frame
            });
        }, 500);
    }

    function _stopMock() {
        if (mockLogTimer)  { clearInterval(mockLogTimer);  mockLogTimer  = null; }
        if (mockStatTimer) { clearInterval(mockStatTimer); mockStatTimer = null; }
        tcpConnected = false;
        broadcast({ type: 'status', state: 'stopped', message: 'Stopped (MOCK)' });
    }

    /* ── WebSocket /sigchain-biquad ── */

    wss.on('connection', (ws, req) => {
        if (req.url !== '/sigchain-biquad') return;
        clients.add(ws);
        ws.send(JSON.stringify({
            type: 'status',
            state: tcpConnected ? 'connected' : 'idle',
            message: tcpConnected ? 'Connected' : 'Idle',
            mock: MOCK
        }));
        ws.on('close', () => {
            clients.delete(ws);
            if (clients.size === 0 && proc) {
                console.log('[sigchain-biquad] Last client left — stopping process');
                _stopProc();
            }
        });
        ws.on('error', () => clients.delete(ws));
    });

    function _cleanup() {
        if (MOCK) { _stopMock(); return; }
        if (autoStopTimer) clearTimeout(autoStopTimer);
        disconnectTcp();
        if (proc) { try { proc.kill('SIGINT'); } catch (_) {} proc = null; }
    }
    process.on('SIGTERM', _cleanup);
    process.on('SIGINT',  _cleanup);

    console.log('[sigchain-biquad] Plugin registered' + (MOCK ? ' (MOCK mode)' : ''));
};
