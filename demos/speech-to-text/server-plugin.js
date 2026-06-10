/*
 * Copyright (C) 2024 Texas Instruments Incorporated - http://www.ti.com/
 *
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * speech-to-text demo server plugin
 * Registers:
 *   GET /speech-devices
 *   GET /start-speech-to-text?device=<alsa-device-or-wav-file>
 *   GET /stop-speech-to-text
 *   WebSocket path: /speech
 *
 * speech_utils writes newline-delimited transcript lines to
 * /tmp/speech_classification_fifo.  A child process (speech-fifo-reader.js)
 * reads the FIFO and sends JSON on stdout.
 * Supports MOCK=1 env var for development on x86 without GStreamer.
 */

'use strict';

const { exec, spawn } = require('child_process');
const fs              = require('fs');
const path            = require('path');

const WS_OPEN = 1; /* WebSocket.OPEN — spec constant, no ws import needed */

const MOCK     = process.env.MOCK === '1';
const fifoPath = '/tmp/speech_classification_fifo';

const FIFO_READER = path.join(
    process.env.WEBSERVER_DIR || path.join(__dirname, '../../common/webserver'),
    'lib/speech-fifo-reader.js'
);

const MOCK_PHRASES = [
    'hello world', 'testing one two three', 'the quick brown fox',
    'texas instruments', 'speech recognition demo', 'good morning',
    'how are you today', 'this is a test'
];

module.exports = function registerSpeechToText(app, wss, device) {

    let fifoReaderProcess = null;
    let speechProcess     = null;
    let mockInterval      = null;
    const connectedClients = new Set();

    /* ------------------------------------------------------------ */
    /* REST routes                                                   */
    /* ------------------------------------------------------------ */

    app.get('/speech-devices', (req, res) => {
        if (MOCK) {
            return res.send('plughw:0,0|Mock USB Microphone\nplughw:1,0|Mock Built-in Mic');
        }
        exec('/usr/bin/speech_utils devices', (error, stdout) => {
            if (error) {
                console.error('[speech] speech_utils devices error:', error);
                return res.status(500).send('Error listing audio devices');
            }
            res.send(stdout);
        });
    });

    app.get('/start-speech-to-text', (req, res) => {
        const device_param = req.query.device || 'default';

        if (speechProcess || mockInterval) {
            return res.status(400).send('Speech-to-text already running');
        }

        console.log('[speech] Starting STT with device:', device_param);

        if (MOCK) {
            mockInterval = setInterval(() => {
                const phrase = MOCK_PHRASES[Math.floor(Math.random() * MOCK_PHRASES.length)];
                const msg = JSON.stringify({ text: phrase, timestamp: Date.now() });
                connectedClients.forEach(ws => {
                    if (ws.readyState === WS_OPEN) ws.send(msg);
                });
                console.log(`[speech] MOCK transcript: ${phrase}`);
            }, 3000);
            return res.send('Speech-to-text started (MOCK)');
        }

        speechProcess = spawn('/usr/bin/speech_utils', ['start_gst', device_param]);

        speechProcess.stdout.on('data', (data) => {
            /* speech_utils prints "SUCCESS: ..." or "ERROR: ..." on stdout */
            const line = data.toString().trim();
            if (line.startsWith('ERROR:')) {
                console.error('[speech] speech_utils:', line);
            }
        });

        speechProcess.stderr.on('data', (data) => {
            /* speech_utils logs pipeline info and STT results to stderr */
            data.toString().split('\n').forEach(line => {
                if (line.trim()) console.log('[speech-utils]', line);
            });
        });

        speechProcess.on('error', (err) => {
            console.error('[speech] Failed to start speech_utils:', err);
            speechProcess = null;
        });

        speechProcess.on('exit', (code) => {
            console.log(`[speech] speech_utils exited with code ${code}`);
            speechProcess = null;
            stopFifoReader();
        });

        startFifoReader();
        res.send('Speech-to-text started');
    });

    app.get('/stop-speech-to-text', (req, res) => {
        stopAll();
        res.send('Speech-to-text stopped');
    });

    /* ------------------------------------------------------------ */
    /* FIFO reader child process                                     */
    /* ------------------------------------------------------------ */

    function startFifoReader() {
        if (fifoReaderProcess) return;

        console.log('[speech] Starting FIFO reader child process');
        fifoReaderProcess = spawn('node', [FIFO_READER], {
            env: Object.assign({}, process.env, { FIFO_PATH: fifoPath })
        });

        fifoReaderProcess.stdout.on('data', (data) => {
            data.toString().split('\n').forEach(line => {
                if (!line.trim()) return;
                try {
                    const msg = JSON.parse(line);
                    if (msg.type === 'transcript') {
                        const out = JSON.stringify({ text: msg.text, timestamp: msg.timestamp });
                        connectedClients.forEach(ws => {
                            if (ws.readyState === WS_OPEN) ws.send(out);
                        });
                        console.log(`[speech] Transcript: ${msg.text}`);
                    } else if (msg.type === 'status') {
                        console.log(`[speech] FIFO status: ${msg.message}`);
                    } else if (msg.type === 'error') {
                        console.error(`[speech] FIFO error: ${msg.message}`);
                    }
                } catch (e) {
                    console.error('[speech] Failed to parse FIFO message:', e);
                }
            });
        });

        fifoReaderProcess.stderr.on('data', (data) => {
            console.error(`[speech] FIFO reader stderr: ${data}`);
        });

        fifoReaderProcess.on('exit', (code) => {
            console.log(`[speech] FIFO reader exited with code ${code}`);
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
        if (speechProcess) {
            exec('/usr/bin/speech_utils stop_gst', (err) => {
                if (err) console.error('[speech] Error stopping speech_utils:', err);
            });
            speechProcess.kill();
            speechProcess = null;
        }
        stopFifoReader();
        exec('pkill -f "speech_utils start_gst"', (err) => {
            if (err) console.log('[speech] No speech_utils processes to kill');
        });
    }

    /* ------------------------------------------------------------ */
    /* WebSocket /speech                                            */
    /* ------------------------------------------------------------ */

    wss.on('connection', (ws, req) => {
        if (req.url !== '/speech') return;

        console.log('[speech] WebSocket client connected');
        connectedClients.add(ws);

        ws.send(JSON.stringify({
            status:  'connected',
            message: 'WebSocket connected for speech-to-text'
        }));

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'diagnostic_ping') {
                    ws.send(JSON.stringify({
                        type:           'diagnostic_response',
                        fifo_exists:    fs.existsSync(fifoPath),
                        reader_running: fifoReaderProcess !== null,
                        mock_mode:      MOCK,
                        timestamp:      Date.now()
                    }));
                }
            } catch (e) {
                console.error('[speech] WebSocket message parse error:', e);
            }
        });

        ws.on('close', () => {
            console.log('[speech] WebSocket client disconnected');
            connectedClients.delete(ws);
        });

        ws.on('error', (err) => {
            console.error('[speech] WebSocket error:', err);
            connectedClients.delete(ws);
        });
    });

    /* Clean up on server exit */
    process.on('SIGTERM', stopAll);
    process.on('SIGINT',  stopAll);

    console.log('[speech-to-text] Plugin registered' + (MOCK ? ' (MOCK mode)' : ''));
};
