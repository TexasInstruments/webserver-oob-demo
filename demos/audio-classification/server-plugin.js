/*
 * Copyright (C) 2026 Texas Instruments Incorporated - http://www.ti.com/
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * @file server-plugin.js
 * @memberof demos/audio-classification
 * @brief Express + WebSocket server plugin for the audio classification demo.
 *
 * Non-AM62D devices retain the established GStreamer/NNStreamer backend.
 * AM62D records PCM with ALSA and executes rpmsg_inference_example with the
 * installed pipeline_speech_classification.json configuration.
 *
 * Registered REST endpoints:
 * | Method | Path | Description |
 * |--------|------|-------------|
 * | GET  | /audio-devices | List ALSA capture devices |
 * | GET  | /audio-output-devices | List ALSA playback devices |
 * | POST | /upload-audio-classification-file | Store raw audio binary in /tmp |
 * | GET  | /audio-classification/info | Describe the AM62D input configuration |
 * | GET  | /start-audio-classification | Start live-device or file-source pipeline |
 * | GET  | /stop-audio-classification  | Stop the active pipeline |
 * | GET  | /audio-classification/status | Report current backend/run state |
 *
 * WebSocket path: @c /audio  — broadcasts @c {class, timestamp} JSON messages.
 *
 * Legacy data flow (device source):
 * @code
 *   audio_utils start_gst → GStreamer/NNStreamer → FIFO
 *   → fifo-reader.js child → stdout JSON → WebSocket /audio → browser
 * @endcode
 *
 * Set @c MOCK=1 to run on x86 without target binaries; random YAMNet labels
 * are emitted every 2 s instead.
 */

'use strict';

const { exec, execSync, spawn } = require('child_process');
const fs                        = require('fs');
const path                      = require('path');
const demoCoordinator           = require('../demo-coordinator');

/**
 * @brief Create an Express middleware that buffers the raw request body.
 *
 * Avoids a hard dependency on the `express` npm package (which is not
 * resolvable from the plugin path on the EVM).  Uses only Node.js
 * built-in stream events.
 *
 * @param {number} limitBytes - Maximum allowed body size; responds 413 if exceeded.
 * @returns {Function} Express-compatible middleware @c (req, res, next).
 */
function rawBody(limitBytes) {
    return (req, res, next) => {
        const chunks = [];
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > limitBytes) { res.status(413).send('Payload too large'); req.destroy(); return; }
            chunks.push(chunk);
        });
        req.on('end', () => { req.body = Buffer.concat(chunks); next(); });
        req.on('error', () => res.status(400).send('Bad request'));
    };
}

/**
 * @brief Parse @c arecord @c -l or @c aplay @c -l stdout into pipe-delimited device entries.
 *
 * Each card+device combination in the output becomes an independent
 * entry — no deduplication by card number.  Entries matching webcam,
 * camera, or cape are filtered out.
 *
 * Input line format:
 * @verbatim
 * card N: SHORT [CARD_NAME], device D: LONG_NAME SHORT_NAME [...]
 * @endverbatim
 *
 * Output format per entry: @c "plughw:N,D|CARD_NAME: DEV_SHORT"
 *
 * @param {string} stdout - Raw stdout from arecord/aplay.
 * @returns {string} Newline-separated device entries, or empty string if none.
 */
function parseAlsaOutput(stdout) {
    const results = [];
    for (const line of stdout.split('\n')) {
        if (!line.startsWith('card')) continue;
        const m = line.match(/card (\d+):.*?\[([^\]]+)\],\s*device (\d+):\s*\S+\s+(\S+)/);
        if (!m) continue;
        const [, cardNum, cardName, devNum, devShort] = m;
        if (/webcam|camera|cape/i.test(cardName)) continue;
        results.push(`plughw:${cardNum},${devNum}|${cardName}: ${devShort}`);
    }
    return results.join('\n');
}

const WS_OPEN = 1; /* WebSocket.OPEN — spec constant, no ws import needed */

const MOCK       = process.env.MOCK === '1';
const fifoPath   = '/tmp/audio_classification_fifo';
const JOB_ROOT   = '/tmp/webserver-oob-audio-classification';
const MAX_LOG_BYTES = 64 * 1024;

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

/**
 * Extract a classification label from common RPMsg application output forms.
 * Newer applications may emit one JSON object per line, while older debug
 * builds print a human-readable "Classification: ..." record.
 */
function parseClassificationLine(line) {
    const text = String(line || '').trim();
    if (!text) return null;

    if (text.startsWith('{')) {
        try {
            const message = JSON.parse(text);
            let value = message.class || message.label || message.event ||
                message.prediction || message.topClass || message.top_class;
            if (!value && Array.isArray(message.predictions) && message.predictions.length) {
                const top = message.predictions[0];
                value = typeof top === 'string'
                    ? top
                    : (top.class || top.label || top.event || top.name);
            }
            if (value !== undefined && value !== null && String(value).trim()) {
                return String(value).trim();
            }
        } catch (_) {}
    }

    // "[App]   1. ±score  ClassName" — top-1 line from audio_classification_pipeline
    const topOneMatch = text.match(/\[App\]\s+1\.\s+-?[\d.]+(?:[eE][+\-]?\d+)?\s+(.+)$/);
    if (topOneMatch) return topOneMatch[1].trim();

    const match = text.match(
        /(?:classification|predicted\s+(?:class|label)|top(?:\s*[- ]?1)?\s+(?:class|label))\s*[:=]\s*(.+)$/i
    );
    return match && match[1].trim() ? match[1].trim() : null;
}

/**
 * Parse a ranked prediction line: "[App]   N. 0.8234  ClassName"
 * Returns { rank, score, class } or null if the line doesn't match.
 */
function parseRankedLine(text) {
    const m = String(text || '').trim().match(/\[App\]\s+(\d+)\.\s+(-?[\d.]+(?:[eE][+\-]?\d+)?)\s+(.+)$/);
    if (!m) return null;
    return { rank: parseInt(m[1], 10), score: parseFloat(m[2]), class: m[3].trim() };
}

function appendLogTail(current, addition) {
    return (current + addition).slice(-MAX_LOG_BYTES);
}

/**
 * @brief Plugin entry point called by server.js at startup.
 *
 * Registers all REST routes and the WebSocket @c /audio handler.
 * State is scoped to this closure so multiple require() calls would
 * produce independent plugin instances (not currently used).
 *
 * @param {object} app    - Express application instance.
 * @param {object} wss    - ws.WebSocketServer instance shared across plugins.
 * @param {object} device - Parsed device.json; use @c device.demoConfig['audio-classification']
 *                          for per-device tuning parameters.
 */
module.exports = function registerAudioClassification(app, wss, device) {
    /* This is the only backend-selection gate.  Keeping it local to this
     * plugin guarantees every non-AM62D device follows the original path. */
    const isAm62d = device.id === 'am62dxx';
    const config = (device.demoConfig || {})['audio-classification'] || {};
    const edgeAiBinary    = config.edgeAiBinary || '/usr/bin/rpmsg_inference_example';
    const defaultInputPath = config.inputPath ||
        '/usr/share/tvm_inference/input/input_audio.wav';
    const inputDir        = path.dirname(defaultInputPath);
    const captureSeconds  = Math.max(1, Number(config.captureSeconds) || 3);
    const sampleRate      = Math.max(8000, Number(config.sampleRate) || 16000);

    /* Model registry — keyed by model id, value has label/description/jsonFile */
    const modelsConfig = config.models || {
        yamnet: {
            label: 'YAMNet',
            jsonFile: '/usr/share/tvm_inference/json/pipeline_audio_classification_yamnet.json',
            description: '521 AudioSet classes · MobileNet v1',
        },
    };
    /* Keep a plain jsonFile fallback for configs that don't use the models map */
    const fallbackJson     = config.jsonFile ||
        '/usr/share/tvm_inference/json/pipeline_audio_classification_yamnet.json';
    const defaultModelKey  = config.defaultModel ||
        Object.keys(modelsConfig)[0] || 'yamnet';
    const defaultClassificationJson = (modelsConfig[defaultModelKey] || {}).jsonFile || fallbackJson;

    let fifoReaderProcess    = null;
    let legacyAudioProcess   = null;
    let edgeAiProcess        = null;
    let mockInterval         = null;
    let audioSourceMode      = 'device'; /* 'device' | 'file' */
    let activeJob            = null;
    let lastResult           = null;
    let runGeneration        = 0;
    let onInferenceComplete  = null; /* callback set by continuous capture; called after each inference */
    const connectedClients   = new Set();

    /* Write a minimal 44-byte WAV header followed by raw PCM into filePath */
    function writeWavFile(filePath, pcmBuffer) {
        const dataSize = pcmBuffer.length;
        const hdr = Buffer.alloc(44);
        hdr.write('RIFF', 0);
        hdr.writeUInt32LE(36 + dataSize, 4);
        hdr.write('WAVE', 8);
        hdr.write('fmt ', 12);
        hdr.writeUInt32LE(16, 16);
        hdr.writeUInt16LE(1,  20);              // PCM
        hdr.writeUInt16LE(1,  22);              // mono
        hdr.writeUInt32LE(sampleRate,     24);
        hdr.writeUInt32LE(sampleRate * 2, 28);  // byteRate
        hdr.writeUInt16LE(2,  32);              // blockAlign
        hdr.writeUInt16LE(16, 34);              // bitsPerSample
        hdr.write('data', 36);
        hdr.writeUInt32LE(dataSize, 40);
        fs.writeFileSync(filePath, Buffer.concat([hdr, pcmBuffer]));
    }

    function send(message) {
        const encoded = JSON.stringify(message);
        connectedClients.forEach(ws => {
            if (ws.readyState === WS_OPEN) ws.send(encoded);
        });
    }

    function releaseAcDsp() {
        demoCoordinator.releaseDsp('audio-classification');
    }

    /* ------------------------------------------------------------ */
    /* REST routes                                                   */
    /* ------------------------------------------------------------ */

    /* Returns newline-joined "file:<path>|File: <name>" entries for every WAV
     * in inputDir, falling back to just the default input file if the dir is
     * unavailable. */
    function listInputFiles() {
        try {
            if (!fs.existsSync(inputDir)) return `file:${defaultInputPath}|File: ${path.basename(defaultInputPath)}`;
            const wavs = fs.readdirSync(inputDir)
                .filter(f => /\.wav$/i.test(f))
                .sort()
                .map(f => `file:${path.join(inputDir, f)}|File: ${f}`)
                .join('\n');
            return wavs || `file:${defaultInputPath}|File: ${path.basename(defaultInputPath)}`;
        } catch (_) {
            return `file:${defaultInputPath}|File: ${path.basename(defaultInputPath)}`;
        }
    }

    app.get('/audio-devices', (req, res) => {
        const fileEntries = listInputFiles();
        if (MOCK) {
            const devices = 'plughw:0,0|Mock USB Microphone\nplughw:1,0|Mock Built-in Mic';
            return res.send(isAm62d ? `${devices}\n${fileEntries}` : devices);
        }

        /* AM62D only needs ALSA capture enumeration; classification itself is
         * performed by the Edge-AI RPMsg binary.  Legacy SoCs keep using the
         * existing audio_utils implementation unchanged. */
        const command = isAm62d ? 'arecord -l 2>/dev/null' : '/usr/bin/audio_utils devices';
        exec(command, (error, stdout) => {
            if (error) {
                console.error(`[audio] ${command} error:`, error);
                if (isAm62d) return res.send(fileEntries);
                return res.status(500).send('Error listing audio devices');
            }
            if (!isAm62d) return res.send(stdout);
            const out = parseAlsaOutput(stdout);
            res.send(out ? `${out}\n${fileEntries}` : fileEntries);
        });
    });

    if (isAm62d) {
    app.get('/audio-output-devices', (req, res) => {
        if (MOCK) {
            return res.send('plughw:0,0|Mock Card: mock-output-0\nplughw:0,1|Mock Card: mock-output-1');
        }
        exec('aplay -l 2>/dev/null', (error, stdout) => {
            if (error) {
                console.error('[audio] aplay -l error:', error);
                return res.status(500).send('Error listing audio output devices');
            }
            const out = parseAlsaOutput(stdout);
            res.send(out || 'No audio output devices found');
        });
    });

    /* File upload — saves WAV to inputDir so it persists and appears in the source list */
    app.post('/upload-audio-classification-file',
        rawBody(50 * 1024 * 1024),
        (req, res) => {
            if (MOCK) {
                return res.json({ path: `${inputDir}/mock_audio.wav`, name: 'mock_audio.wav' });
            }
            if (!req.body || req.body.length < 12 ||
                req.body.toString('ascii', 0, 4) !== 'RIFF' ||
                req.body.toString('ascii', 8, 12) !== 'WAVE') {
                return res.status(400).json({ error: 'Audio Classification input must be a WAV file' });
            }
            const rawName = ((req.query.filename || '') + '')
                .replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.+/g, '.').slice(0, 120);
            const safeFilename = rawName
                ? (/\.wav$/i.test(rawName) ? rawName : rawName + '.wav')
                : 'uploaded_audio.wav';
            try {
                fs.mkdirSync(inputDir, { recursive: true });
                const dest = path.join(inputDir, safeFilename);
                fs.writeFileSync(dest, req.body);
                console.log(`[audio] Saved uploaded file: ${dest} (${req.body.length} bytes)`);
                res.json({ path: dest, name: safeFilename });
            } catch (e) {
                console.error('[audio] File save error:', e);
                res.status(500).json({ error: e.message });
            }
        }
    );

    app.get('/audio-classification/info', (req, res) => {
        res.json({
            backend: 'edge-ai-rpmsg',
            defaultFile: defaultInputPath,
            defaultFileName: path.basename(defaultInputPath),
            captureSeconds,
            sampleRate,
        });
    });

    app.get('/audio-classification/models', (req, res) => {
        const result = {};
        Object.entries(modelsConfig).forEach(([key, m]) => {
            result[key] = { label: m.label, description: m.description || '' };
        });
        res.json({ models: result, default: defaultModelKey });
    });
    }

    app.get('/start-audio-classification', (req, res) => {
        const device_param = req.query.device   || 'default';
        const fileSelection = isAm62d && device_param.startsWith('file:');
        const source = isAm62d
            ? (req.query.source || (fileSelection ? 'file' : 'device'))
            : 'device';
        const filepath = req.query.filepath || req.query.file ||
            (fileSelection ? device_param.slice('file:'.length) : '');

        if (legacyAudioProcess || edgeAiProcess || mockInterval) {
            return res.status(400).send('Audio classification already running');
        }

        audioSourceMode = (isAm62d && source === 'file') ? 'file' : 'device';

        if (MOCK) {
            mockInterval = setInterval(() => {
                const cls = MOCK_CLASSES[Math.floor(Math.random() * MOCK_CLASSES.length)];
                const msg = JSON.stringify({ class: cls, timestamp: Date.now() });
                connectedClients.forEach(ws => {
                    if (ws.readyState === WS_OPEN) ws.send(msg);
                });
                console.log(`[audio] MOCK classification: ${cls}`);
            }, 2000);
            return res.send(`Audio classification started (MOCK ${isAm62d ? 'edge-ai-rpmsg' : 'gstreamer'})`);
        }

        if (isAm62d) {
            const modelKey = (req.query.model || defaultModelKey).toLowerCase();
            const jsonPath = (modelsConfig[modelKey] || {}).jsonFile || defaultClassificationJson;
            const modelLabel = (modelsConfig[modelKey] || {}).label || modelKey;
            try {
                startAm62dPipeline({
                    source,
                    device: device_param,
                    filepath: filepath || defaultInputPath,
                    jsonPath,
                    modelLabel,
                    ownerIp: req.ip,
                });
                res.send(`Audio classification started (edge-ai-rpmsg, model=${modelKey})`);
            } catch (error) {
                stopAll();
                res.status(400).send(error.message);
            }
        } else {
            console.log('[audio] Starting classification with device:', device_param);
            legacyAudioProcess = spawn('/usr/bin/audio_utils', ['start_gst', device_param]);
            legacyAudioProcess.on('error', (err) => {
                console.error('[audio] Failed to start audio_utils:', err);
                legacyAudioProcess = null;
            });
            legacyAudioProcess.on('exit', (code) => {
                console.log(`[audio] audio_utils exited with code ${code}`);
                legacyAudioProcess = null;
                stopFifoReader();
            });
            startFifoReader();
            res.send('Audio classification started');
        }
    });

    app.get('/stop-audio-classification', (req, res) => {
        const denied = demoCoordinator.checkStopAuthorised('audio-classification', req.ip);
        if (denied) return res.status(403).json({ error: denied });
        stopAll();
        res.send('Audio classification stopped');
    });

    app.get('/audio-classification/status', (req, res) => {
        res.json({
            running: Boolean(legacyAudioProcess || edgeAiProcess || mockInterval),
            backend: isAm62d ? 'edge-ai-rpmsg' : 'gstreamer',
            result: lastResult,
        });
    });

    /* ------------------------------------------------------------ */
    /* Pipeline helpers                                             */
    /* ------------------------------------------------------------ */

    /**
     * Parse one stdout line from rpmsg_inference_example, update patchBuf in-place,
     * and dispatch send() for confirmed classifications.
     * Callers must flush with patchBuf.splice(0) (not reassignment) so the reference
     * passed here stays valid across flush calls.
     */
    function dispatchClassificationLine(line, patchBuf, flushPatch, onClass) {
        const ranked = parseRankedLine(line);
        if (ranked) {
            if (ranked.rank === 1 && patchBuf.length > 0) flushPatch();
            patchBuf.push({ class: ranked.class, score: ranked.score });
            if (ranked.rank === 1) {
                onClass(ranked.class);
                send({ class: ranked.class, timestamp: Date.now(), backend: 'edge-ai-rpmsg' });
            }
            return;
        }
        const className = parseClassificationLine(line);
        if (!className) return;
        onClass(className);
        send({ class: className, timestamp: Date.now(), backend: 'edge-ai-rpmsg' });
    }

    /** Start the AM62D JSON pipeline for WAV file input. */
    function runAm62dInference(inputPath, generation, jsonPath, modelLabel, ownerIp) {
        if (generation !== runGeneration) return;
        if (!fs.existsSync(inputPath)) throw new Error(`Audio input file not found: ${inputPath}`);

        const resolvedJson = jsonPath || defaultClassificationJson;
        const dspError = demoCoordinator.acquireDsp('audio-classification', ownerIp || null);
        if (dspError) throw new Error(dspError);

        try {
            if (config.preloadTvm !== false) demoCoordinator.ensurePreloaded(edgeAiBinary);

            activeJob = {
                generation,
                inputPath,
                stdout: '',
                stderr: '',
                classes: [],
                startedAt: Date.now(),
            };
            lastResult = null;
            send({ type: 'model_loading', modelName: modelLabel || 'model' });
            send({ type: 'status', status: 'running', backend: 'edge-ai-rpmsg', message: 'Running Audio Classification' });

            /* Pass the file path directly via --input-file — no temp JSON needed. */
            console.log('[audio] Starting AM62D Edge-AI pipeline:', edgeAiBinary, resolvedJson,
                        '--input-file', inputPath);
            const child = spawn(edgeAiBinary, [resolvedJson, '--input-file', inputPath]);
            edgeAiProcess = child;
            let stdoutRemainder = '';
            let patchBuf = [];
            let patchIdx = 0;

            const flushPatch = () => {
                if (!patchBuf.length) return;
                send({ type: 'patch_predictions', patch: patchIdx++,
                       predictions: patchBuf.slice(), timestamp: Date.now(),
                       backend: 'edge-ai-rpmsg' });
                patchBuf.splice(0);
            };

            const consumeLine = line => {
                if (!activeJob || activeJob.generation !== generation) return;
                activeJob.stdout = appendLogTail(activeJob.stdout, line + '\n');
                dispatchClassificationLine(line, patchBuf, flushPatch,
                    cls => activeJob.classes.push(cls));
            };

            child.stdout.on('data', data => {
                stdoutRemainder += data.toString();
                const lines = stdoutRemainder.split(/\r?\n/);
                stdoutRemainder = lines.pop() || '';
                lines.forEach(consumeLine);
            });
            child.stderr.on('data', data => {
                const text = data.toString();
                if (activeJob && activeJob.generation === generation) {
                    activeJob.stderr = appendLogTail(activeJob.stderr, text);
                }
                console.error('[audio] Edge-AI stderr:', text.trim());
            });
            child.on('error', error => finishAm62dJob(generation, error));
            child.on('close', code => {
                if (stdoutRemainder) consumeLine(stdoutRemainder);
                flushPatch();
                finishAm62dJob(
                    generation,
                    code === 0 ? null : new Error(`Edge-AI classification exited with ${code}`)
                );
            });
        } catch (error) {
            releaseAcDsp();
            throw error;
        }
    }

    function finishAm62dJob(generation, error) {
        if (!activeJob || activeJob.generation !== generation) return;
        const finished = activeJob;
        edgeAiProcess = null;
        activeJob = null;
        releaseAcDsp();
        lastResult = {
            success: !error,
            classes: finished.classes,
            durationMs: Date.now() - finished.startedAt,
            inputPath: finished.inputPath,
            stdout: finished.stdout,
            stderr: finished.stderr,
            error: error ? error.message : null,
        };
        if (error) {
            onInferenceComplete = null;
            send({ type: 'error', message: error.message, backend: 'edge-ai-rpmsg' });
            return;
        }
        /* Continuous device mode: invoke the buffer callback to schedule next inference */
        const cb = onInferenceComplete;
        onInferenceComplete = null;
        if (cb && generation === runGeneration) {
            cb();
            return;
        }
        /* File mode or stopped: signal completion */
        send({ type: 'complete', status: 'complete', result: lastResult, backend: 'edge-ai-rpmsg' });
    }

    /**
     * Start the AM62D live-capture pipeline.
     *
     * Spawns rpmsg_inference_example with --device so the binary opens the ALSA
     * device directly, captures raw PCM, runs STFT+TVM on each window, and prints
     * top-N results to stdout.  No arecord process — the binary owns the device.
     */
    function startStreamingPipeline(device, generation, jsonPath, modelLabel, ownerIp) {
        if (generation !== runGeneration) return;

        const dspError = demoCoordinator.acquireDsp('audio-classification', ownerIp);
        if (dspError) throw new Error(dspError);

        activeJob = { generation, classes: [] };

        try {
            const edgeAi = spawn(edgeAiBinary, [jsonPath, '--device', device]);
            edgeAiProcess = edgeAi;

            send({ type: 'model_loading', modelName: modelLabel || 'model' });
            send({ type: 'status', status: 'running', backend: 'edge-ai-rpmsg',
                   message: 'Running Audio Classification' });
            console.log('[audio] Live pipeline started:', edgeAiBinary, jsonPath,
                        '--device', device);

            let stdoutRemainder = '';
            let patchBuf = [];
            let patchIdx = 0;

            const flushStreamPatch = () => {
                if (!patchBuf.length) return;
                send({ type: 'patch_predictions', patch: patchIdx++,
                       predictions: patchBuf.slice(), timestamp: Date.now(),
                       backend: 'edge-ai-rpmsg' });
                patchBuf.splice(0);
            };

            edgeAi.stdout.on('data', data => {
                if (generation !== runGeneration) return;
                stdoutRemainder += data.toString();
                const lines = stdoutRemainder.split(/\r?\n/);
                stdoutRemainder = lines.pop() || '';
                lines.forEach(line => dispatchClassificationLine(
                    line, patchBuf, flushStreamPatch,
                    cls => { lastResult = { classes: [cls], timestamp: Date.now() }; }
                ));
            });

            edgeAi.stderr.on('data', data =>
                console.error('[audio] Edge-AI stderr:', data.toString().trim()));

            edgeAi.on('error', err => {
                if (!activeJob || activeJob.generation !== generation) return;
                edgeAiProcess = null;
                activeJob = null;
                releaseAcDsp();
                send({ type: 'error', message: `Edge-AI failed: ${err.message}`,
                       backend: 'edge-ai-rpmsg' });
            });
            edgeAi.on('close', code => {
                if (!activeJob || activeJob.generation !== generation) return;
                edgeAiProcess = null;
                activeJob = null;
                releaseAcDsp();
                if (code !== 0 && code !== null)
                    send({ type: 'error', message: `Edge-AI exited with ${code}`,
                           backend: 'edge-ai-rpmsg' });
            });
        } catch (err) {
            activeJob = null;
            releaseAcDsp();
            throw err;
        }
    }

    /**
     * AM62D: live microphone uses continuous PCM buffering (no restart between
     * inferences); WAV file input remains single-shot.
     */
    function startAm62dPipeline({ source, device, filepath, jsonPath, modelLabel, ownerIp }) {
        if (!fs.existsSync(edgeAiBinary)) throw new Error(`Edge-AI client not installed: ${edgeAiBinary}`);
        const resolvedJson = jsonPath || defaultClassificationJson;
        if (!fs.existsSync(resolvedJson))
            throw new Error(`Audio Classification pipeline JSON not installed: ${resolvedJson}`);

        const generation   = ++runGeneration;
        onInferenceComplete = null;

        if (source === 'file') {
            runAm62dInference(filepath, generation, resolvedJson, modelLabel, ownerIp);
            return;
        }

        if (!/^(?:default|(?:plughw|hw):\d+,\d+)$/.test(device))
            throw new Error(`Invalid ALSA capture device: ${device}`);

        startStreamingPipeline(device, generation, resolvedJson, modelLabel, ownerIp);
    }

    /** @brief Create the legacy classification FIFO if it does not already exist. */
    function ensureFifo() {
        if (!fs.existsSync(fifoPath)) {
            try { execSync(`mkfifo "${fifoPath}"`); } catch (_) {}
        }
    }

    /* ------------------------------------------------------------ */
    /* FIFO reader child process                                     */
    /* ------------------------------------------------------------ */

    /**
     * @brief Spawn the fifo-reader.js child process to consume classification labels.
     *
     * The child reads lines from the FIFO (blocking) and emits JSON objects on
     * stdout.  Each @c {type:"classification"} message is broadcast to all
     * connected WebSocket clients on @c /audio.  No-op if already running.
     */
    function startFifoReader() {
        if (fifoReaderProcess) return;

        ensureFifo();
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

    /** @brief Terminate the fifo-reader child process if running. */
    function stopFifoReader() {
        if (fifoReaderProcess) {
            fifoReaderProcess.kill('SIGTERM');
            fifoReaderProcess = null;
        }
    }

    /**
     * @brief Stop all active pipelines and timers, clean up processes.
     *
     * Handles the MOCK interval, legacy GStreamer process, or AM62D
     * arecord/Edge-AI RPMsg processes.
     * Called on REST @c /stop-audio-classification and on SIGTERM/SIGINT.
     */
    function stopAll() {
        runGeneration++;
        onInferenceComplete = null;
        if (mockInterval) {
            clearInterval(mockInterval);
            mockInterval = null;
        }
        if (edgeAiProcess) {
            edgeAiProcess.kill('SIGTERM');
            edgeAiProcess = null;
        }
        if (activeJob) {
            activeJob = null;
            releaseAcDsp();
        }
        if (legacyAudioProcess) {
            if (audioSourceMode === 'device') {
                exec('/usr/bin/audio_utils stop_gst', (err) => {
                    if (err) console.error('[audio] Error stopping audio_utils:', err);
                });
            }
            legacyAudioProcess.kill();
            legacyAudioProcess = null;
        }
        stopFifoReader();
        if (!isAm62d) exec('pkill -f gst-launch', () => {});
        send({ type: 'status', status: 'stopped', backend: isAm62d ? 'edge-ai-rpmsg' : 'gstreamer' });
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

    console.log('[audio-classification] Plugin registered' +
        ` (${isAm62d ? 'AM62D Edge-AI RPMsg' : 'legacy GStreamer'}${MOCK ? ', MOCK mode' : ''})`);
};

module.exports.parseClassificationLine = parseClassificationLine;
module.exports.parseRankedLine         = parseRankedLine;
module.exports.parseAlsaOutput         = parseAlsaOutput;
