/*
 * Copyright (C) 2026 Texas Instruments Incorporated - http://www.ti.com/
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * server-plugin.js — 2D FFT Offload demo
 *
 * Spawns rpmsg_2dfft_example, captures stdout/stderr, parses PASS/FAIL and
 * elapsed time, then forwards everything to WebSocket clients on /2dfft.
 *
 * WebSocket messages sent to browser:
 *   { type: 'status', state: 'running'|'stopped'|'idle', message }
 *   { type: 'log',    text }
 *   { type: 'result', status: 'PASSED'|'FAILED' }
 *   { type: 'done',   exitCode, elapsed, status: 'PASSED'|'FAILED' }
 *
 * MOCK=1: simulates a ~2 s run with synthetic log lines and PASSED result.
 */

'use strict';

const { spawn } = require('child_process');
const demoCoordinator = require('../demo-coordinator');

const WS_OPEN = 1;
const MOCK    = process.env.MOCK === '1';

module.exports = function register2dFft(app, wss, device) {

    const clients = new Set();
    let proc = null;

    const BIN_PATH = (device && device.demoConfig &&
                      device.demoConfig['2dfft'] &&
                      device.demoConfig['2dfft'].binPath)
                     || '/usr/bin/rpmsg_2dfft_example';

    function broadcast(msg) {
        const s = JSON.stringify(msg);
        clients.forEach(ws => { if (ws.readyState === WS_OPEN) ws.send(s); });
    }

    /* ── REST endpoints ── */

    app.get('/2dfft/run', (req, res) => {
        if (MOCK) { _startMock(); return res.send('2dfft started (MOCK)'); }
        if (proc)  return res.send('rpmsg_2dfft_example already running');

        const dspError = demoCoordinator.acquireDsp('2dfft', req.ip);
        if (dspError) return res.status(409).send(dspError);

        broadcast({ type: 'status', state: 'running', message: 'Starting rpmsg_2dfft_example…' });

        const startTime = Date.now();
        proc = spawn(BIN_PATH, [], { stdio: ['ignore', 'pipe', 'pipe'] });

        function handleLine(text) {
            process.stdout.write('[2dfft] ' + text);
            broadcast({ type: 'log', text });
            if (/PASSED/i.test(text)) broadcast({ type: 'result', status: 'PASSED' });
            else if (/FAILED/i.test(text)) broadcast({ type: 'result', status: 'FAILED' });
        }

        proc.stdout.on('data', d => handleLine(d.toString()));
        proc.stderr.on('data', d => handleLine(d.toString()));

        proc.on('exit', code => {
            const elapsed = Date.now() - startTime;
            proc = null;
            demoCoordinator.invalidateTvmCache();
            demoCoordinator.releaseDsp('2dfft');
            const status = code === 0 ? 'PASSED' : 'FAILED';
            broadcast({ type: 'done', exitCode: code, elapsed, status });
            console.log(`[2dfft] exited code=${code} in ${elapsed}ms`);
        });

        res.send('rpmsg_2dfft_example started');
    });

    app.get('/2dfft/stop', (req, res) => {
        if (MOCK) { _stopMock(); return res.send('2dfft stopped (MOCK)'); }
        const denied = demoCoordinator.checkStopAuthorised('2dfft', req.ip);
        if (denied) return res.status(403).send(denied);
        if (proc) {
            try { process.kill(-proc.pid, 'SIGINT'); } catch (_) {
                try { proc.kill('SIGINT'); } catch (_) {}
            }
            proc = null;
        }
        broadcast({ type: 'status', state: 'stopped', message: 'Stopped' });
        res.send('2dfft stopped');
    });

    /* ── MOCK ── */

    let _mockTimer = null;

    function _startMock() {
        if (_mockTimer) return;
        broadcast({ type: 'status', state: 'running', message: 'Starting 2D FFT (MOCK)…' });

        const logs = [
            'RPMsg based 2D FFT Offload Example\n',
            '******************************************\n',
            '******************************************\n',
            'C7x 2DFFT Test PASSED\n',
            'C7x Load: 1%\n',
            'C7x Cycle Count: 327000\n',
            'C7x DDR Throughput: 0.801656 MB/s\n',
            '******************************************\n',
            '******************************************\n'
        ];

        let i = 0;
        _mockTimer = setInterval(() => {
            if (i < logs.length) {
                const text = logs[i++];
                broadcast({ type: 'log', text });
                if (/PASSED/i.test(text)) broadcast({ type: 'result', status: 'PASSED' });
            }
            if (i >= logs.length) {
                clearInterval(_mockTimer); _mockTimer = null;
                broadcast({ type: 'done', exitCode: 0, elapsed: 2304, status: 'PASSED' });
                broadcast({ type: 'status', state: 'stopped', message: 'Completed: PASSED' });
            }
        }, 320);
    }

    function _stopMock() {
        if (_mockTimer) { clearInterval(_mockTimer); _mockTimer = null; }
        broadcast({ type: 'status', state: 'stopped', message: 'Stopped (MOCK)' });
    }

    /* ── WebSocket /2dfft ── */

    wss.on('connection', (ws, req) => {
        if (req.url !== '/2dfft') return;
        clients.add(ws);
        ws.send(JSON.stringify({
            type: 'status', state: proc ? 'running' : 'idle',
            message: proc ? 'Running' : 'Idle', mock: MOCK
        }));
        ws.on('close', () => {
            clients.delete(ws);
            if (clients.size === 0 && proc) {
                console.log('[2dfft] Last client left — sending SIGINT to process');
                try { process.kill(-proc.pid, 'SIGINT'); } catch (_) {
                    try { proc.kill('SIGINT'); } catch (_) {}
                }
                proc = null;
                broadcast({ type: 'status', state: 'stopped', message: 'Stopped (client disconnected)' });
            }
        });
        ws.on('error', () => clients.delete(ws));
    });

    function _cleanup() {
        if (MOCK) _stopMock();
        if (proc) {
            try { process.kill(-proc.pid, 'SIGINT'); } catch (_) {
                try { proc.kill('SIGINT'); } catch (_) {}
            }
            proc = null;
        }
    }
    process.on('SIGTERM', _cleanup);
    process.on('SIGINT',  _cleanup);

    console.log('[2dfft] Plugin registered' + (MOCK ? ' (MOCK mode)' : ''));
};
