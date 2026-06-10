/*
 * Copyright (C) 2024 Texas Instruments Incorporated - http://www.ti.com/
 *
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * audio-classification demo server plugin
 * Registers:
 *   GET /audio-devices
 *   GET /start-audio-classification?device=<alsa-device>
 *   GET /stop-audio-classification
 *   WebSocket path: /audio
 *
 * Uses fifo-reader.js child process for blocking FIFO reads.
 * Supports MOCK=1 env var for development on x86 without GStreamer.
 */

'use strict';

const { exec, spawn } = require('child_process');
const fs              = require('fs');
const path            = require('path');

const WS_OPEN = 1; /* WebSocket.OPEN — spec constant, no ws import needed */

const MOCK     = process.env.MOCK === '1';
const fifoPath = '/tmp/audio_classification_fifo';

/* Resolve via WEBSERVER_DIR (set by server.js) so the path is correct on target
 * (/usr/lib/node_modules/webserver-oob/lib/) and in dev (repo common/webserver/lib/). */
const FIFO_READER = path.join(
    process.env.WEBSERVER_DIR || path.join(__dirname, '../../common/webserver'),
    'lib/fifo-reader.js'
);

/* Fake audio classes for MOCK mode */
const MOCK_CLASSES = [
    'Speech', 'Music', 'Silence', 'Vehicle', 'Keyboard typing',
    'Clapping', 'Cough', 'Dog bark', 'Water', 'Wind'
];

module.exports = function registerAudioClassification(app, wss, device) {

    let fifoReaderProcess = null;
    let audioProcess      = null;
    let mockInterval      = null;
    const connectedClients = new Set();

    /* ------------------------------------------------------------ */
    /* REST routes                                                   */
    /* ------------------------------------------------------------ */

    app.get('/audio-devices', (req, res) => {
        if (MOCK) {
            return res.send('plughw:0,0|Mock USB Microphone\nplughw:1,0|Mock Built-in Mic');
        }
        exec('/usr/bin/audio_utils devices', (error, stdout) => {
            if (error) {
                console.error('[audio] audio_utils devices error:', error);
                return res.status(500).send('Error listing audio devices');
            }
            res.send(stdout);
        });
    });

    app.get('/start-audio-classification', (req, res) => {
        const device_param = req.query.device || 'default';

        if (audioProcess || mockInterval) {
            return res.status(400).send('Audio classification already running');
        }

        console.log('[audio] Starting classification with device:', device_param);

        if (MOCK) {
            /* Mock mode: emit a random classification every 2 seconds */
            mockInterval = setInterval(() => {
                const cls = MOCK_CLASSES[Math.floor(Math.random() * MOCK_CLASSES.length)];
                const msg = JSON.stringify({ class: cls, timestamp: Date.now() });
                connectedClients.forEach(ws => {
                    if (ws.readyState === WS_OPEN) ws.send(msg);
                });
                console.log(`[audio] MOCK classification: ${cls}`);
            }, 2000);
            return res.send('Audio classification started (MOCK)');
        }

        /* Real mode: spawn audio_utils + fifo reader */
        audioProcess = spawn('/usr/bin/audio_utils', ['start_gst', device_param]);

        audioProcess.on('error', (err) => {
            console.error('[audio] Failed to start audio_utils:', err);
            audioProcess = null;
        });

        audioProcess.on('exit', (code) => {
            console.log(`[audio] audio_utils exited with code ${code}`);
            audioProcess = null;
            stopFifoReader();
        });

        startFifoReader();
        res.send('Audio classification started');
    });

    app.get('/stop-audio-classification', (req, res) => {
        stopAll();
        res.send('Audio classification stopped');
    });

    /* ------------------------------------------------------------ */
    /* FIFO reader child process                                     */
    /* ------------------------------------------------------------ */

    function startFifoReader() {
        if (fifoReaderProcess) return;

        console.log('[audio] Starting FIFO reader child process');
        fifoReaderProcess = spawn('node', [FIFO_READER]);

        fifoReaderProcess.stdout.on('data', (data) => {
            data.toString().split('\n').forEach(line => {
                if (!line.trim()) return;
                try {
                    const msg = JSON.parse(line);
                    if (msg.type === 'classification') {
                        const out = JSON.stringify({ class: msg.class, timestamp: msg.timestamp });
                        connectedClients.forEach(ws => {
                            if (ws.readyState === WS_OPEN) ws.send(out);
                        });
                        console.log(`[audio] Classification: ${msg.class}`);
                    } else if (msg.type === 'status') {
                        console.log(`[audio] FIFO status: ${msg.message}`);
                    } else if (msg.type === 'error') {
                        console.error(`[audio] FIFO error: ${msg.message}`);
                    }
                } catch (e) {
                    console.error('[audio] Failed to parse FIFO message:', e);
                }
            });
        });

        fifoReaderProcess.stderr.on('data', (data) => {
            console.error(`[audio] FIFO reader stderr: ${data}`);
        });

        fifoReaderProcess.on('exit', (code) => {
            console.log(`[audio] FIFO reader exited with code ${code}`);
            fifoReaderProcess = null;
        });
    }

    function stopFifoReader() {
        if (fifoReaderProcess) {
            fifoReaderProcess.kill('SIGTERM');
            fifoReaderProcess = null;
        }
    }

    function stopAll() {
        if (mockInterval) {
            clearInterval(mockInterval);
            mockInterval = null;
        }
        if (audioProcess) {
            exec('/usr/bin/audio_utils stop_gst', (err) => {
                if (err) console.error('[audio] Error stopping audio_utils:', err);
            });
            audioProcess.kill();
            audioProcess = null;
        }
        stopFifoReader();
        exec('pkill -f gst-launch', (err) => {
            if (err) console.log('[audio] No GStreamer processes to kill');
        });
    }

    /* ------------------------------------------------------------ */
    /* WebSocket /audio                                             */
    /* ------------------------------------------------------------ */

    wss.on('connection', (ws, req) => {
        if (req.url !== '/audio') return;

        console.log('[audio] WebSocket client connected');
        connectedClients.add(ws);

        ws.send(JSON.stringify({
            status:  'connected',
            message: 'WebSocket connected for audio classification'
        }));

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'diagnostic_ping') {
                    ws.send(JSON.stringify({
                        type:          'diagnostic_response',
                        fifo_exists:   fs.existsSync(fifoPath),
                        reader_running: fifoReaderProcess !== null,
                        mock_mode:     MOCK,
                        timestamp:     Date.now()
                    }));
                }
            } catch (e) {
                console.error('[audio] WebSocket message parse error:', e);
            }
        });

        ws.on('close', () => {
            console.log('[audio] WebSocket client disconnected');
            connectedClients.delete(ws);
        });

        ws.on('error', (err) => {
            console.error('[audio] WebSocket error:', err);
            connectedClients.delete(ws);
        });
    });

    /* Clean up on server exit */
    process.on('SIGTERM', stopAll);
    process.on('SIGINT',  stopAll);

    console.log('[audio-classification] Plugin registered' + (MOCK ? ' (MOCK mode)' : ''));
};
