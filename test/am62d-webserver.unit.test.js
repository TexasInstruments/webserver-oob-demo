/*
 * AM62D webserver unit tests.
 * Run from the webserver-oob-demo-vs repository root:
 *   node --test /path/to/am62d-webserver.unit.test.js
 * Or set AM62D_REPO_ROOT when running from another directory.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(process.env.AM62D_REPO_ROOT || process.cwd());
const DEVICE_PLUGIN         = path.join(REPO_ROOT, 'devices/am62dxx/server-plugin.js');
const CLASSIFICATION_PLUGIN = path.join(REPO_ROOT, 'demos/audio-classification/server-plugin.js');
const SPEECH_PLUGIN         = path.join(REPO_ROOT, 'demos/speech-enhancement/server-plugin.js');
const DEMO_COORDINATOR      = path.join(REPO_ROOT, 'demos/demo-coordinator.js');

for (const required of [DEVICE_PLUGIN, CLASSIFICATION_PLUGIN, SPEECH_PLUGIN, DEMO_COORDINATOR]) {
    if (!fs.existsSync(required)) {
        throw new Error(`Repository file not found: ${required}. Run at repository root or set AM62D_REPO_ROOT.`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared test infrastructure
// ─────────────────────────────────────────────────────────────────────────────

class FakeApp {
    constructor() {
        this.routes = new Map();
        this.middleware = [];
    }
    use(fn) { this.middleware.push(fn); }
    get(route, ...handlers) { this.routes.set(`GET ${route}`, handlers); }
    post(route, ...handlers) { this.routes.set(`POST ${route}`, handlers); }
    handler(method, route) {
        const handlers = this.routes.get(`${method} ${route}`);
        assert.ok(handlers, `${method} ${route} was not registered`);
        return handlers.at(-1);
    }
}

function fakeExpress() {
    const middleware = () => (_req, _res, next) => next?.();
    return { json: middleware, raw: middleware };
}

function response() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
        send(value) { this.body = value; return this; },
    };
}

/* Build a minimal in-memory WAV buffer (all-zero PCM payload). */
function makeWav({ audioFmt = 1, channels = 1, sampleRate = 48000, bitsPerSample = 16, samples = 100 } = {}) {
    const bytesPerSample = Math.ceil(bitsPerSample / 8);
    const pcmBytes = samples * channels * bytesPerSample;
    const buf = Buffer.alloc(44 + pcmBytes);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + pcmBytes, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(audioFmt, 20);
    buf.writeUInt16LE(channels, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
    buf.writeUInt16LE(channels * bytesPerSample, 32);
    buf.writeUInt16LE(bitsPerSample, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(pcmBytes, 40);
    return buf;
}

/* Device-plugin fixture. */
function createFixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'am62d-unit-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const deviceDir = path.join(root, 'devices', 'am62dxx');
    const appDir = path.join(deviceDir, 'app');
    fs.mkdirSync(path.join(appDir, 'Model-Inspector'), { recursive: true });
    const configPath = path.join(deviceDir, 'device.json');
    const device = {
        id: 'am62dxx', ui: 'vue', displayName: 'AM62D', soc: 'AM62D C7x',
        boards: [{ name: 'SK-AM62D' }], demos: ['cpu-monitor'],
        demoConfig: { existing: { enabled: true } },
    };
    fs.writeFileSync(configPath, JSON.stringify(device));
    const app = new FakeApp();
    const wss = { on() {} };
    delete require.cache[require.resolve(DEVICE_PLUGIN)];
    require(DEVICE_PLUGIN)(app, wss, device, {
        appDir, deviceConfigPath: configPath, express: fakeExpress(),
    });
    return { root, appDir, configPath, device, app };
}

/* Audio-classification plugin fixture — uses a temp inputDir so file-upload tests can write. */
function createAcFixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'am62d-ac-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const inputDir = path.join(root, 'input');
    fs.mkdirSync(inputDir, { recursive: true });
    const defaultInputPath = path.join(inputDir, 'input_audio.wav');
    const device = {
        id: 'am62dxx',
        demoConfig: {
            'audio-classification': {
                inputPath: defaultInputPath,
                captureSeconds: 5,
                sampleRate: 16000,
            },
        },
    };
    const app = new FakeApp();
    const wss = { on() {} };
    delete require.cache[require.resolve(CLASSIFICATION_PLUGIN)];
    require(CLASSIFICATION_PLUGIN)(app, wss, device);
    return { root, inputDir, defaultInputPath, device, app };
}

/* Returns a fresh demo-coordinator instance with zeroed module-level state. */
function freshCoordinator() {
    delete require.cache[require.resolve(DEMO_COORDINATOR)];
    return require(DEMO_COORDINATOR);
}

// ─────────────────────────────────────────────────────────────────────────────
// Device plugin — endpoint registration
// ─────────────────────────────────────────────────────────────────────────────

test('AM62D plugin registers every management endpoint', (t) => {
    const { app } = createFixture(t);
    for (const endpoint of [
        'POST /device-config',
        'GET /model-inspector-list',
        'POST /system/reboot',
        'POST /system/poweroff',
        'POST /upload-model-file',
    ]) assert.ok(app.routes.has(endpoint), `${endpoint} missing`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Device plugin — device-config
// ─────────────────────────────────────────────────────────────────────────────

test('device-config persists ordinary fields and board data', (t) => {
    const { app, configPath, device } = createFixture(t);
    const res = response();
    app.handler('POST', '/device-config')(
        { body: { displayName: 'AM62D Lab Board', boards: [{ name: 'EVM-2' }] } }, res,
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true });
    assert.equal(device.displayName, 'AM62D Lab Board');
    assert.deepEqual(JSON.parse(fs.readFileSync(configPath, 'utf8')).boards, [{ name: 'EVM-2' }]);
});

test('device-config merges demoConfig instead of deleting existing configuration', (t) => {
    const { app, configPath } = createFixture(t);
    const res = response();
    app.handler('POST', '/device-config')(
        { body: { demoConfig: { added: { sampleRate: 16000 } } } }, res,
    );
    const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.deepEqual(saved.demoConfig.existing, { enabled: true });
    assert.deepEqual(saved.demoConfig.added, { sampleRate: 16000 });
});

test('device-config rejects a non-object body with 400', (t) => {
    const { app } = createFixture(t);
    const res = response();
    app.handler('POST', '/device-config')({ body: 'not an object' }, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error);
});

test('device-config treats an array body as a no-op update (no crash)', (t) => {
    const { app, device } = createFixture(t);
    const originalName = device.displayName;
    const res = response();
    app.handler('POST', '/device-config')({ body: [] }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(device.displayName, originalName);
});

// ─────────────────────────────────────────────────────────────────────────────
// Device plugin — model-inspector-list
// ─────────────────────────────────────────────────────────────────────────────

test('model-inspector-list returns only HTML reports in sorted order', (t) => {
    const { app, appDir } = createFixture(t);
    const dir = path.join(appDir, 'Model-Inspector');
    fs.writeFileSync(path.join(dir, 'z-report.HTML'), '<html></html>');
    fs.writeFileSync(path.join(dir, 'a-report.htm'), '<html></html>');
    fs.writeFileSync(path.join(dir, 'ignore.json'), '{}');
    const res = response();
    app.handler('GET', '/model-inspector-list')({}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { files: ['a-report.htm', 'z-report.HTML'] });
});

test('model-inspector-list returns an empty list when its directory is absent', (t) => {
    const { app, appDir } = createFixture(t);
    fs.rmSync(path.join(appDir, 'Model-Inspector'), { recursive: true });
    const res = response();
    app.handler('GET', '/model-inspector-list')({}, res);
    assert.deepEqual(res.body, { files: [] });
});

// ─────────────────────────────────────────────────────────────────────────────
// Device plugin — model file upload
// ─────────────────────────────────────────────────────────────────────────────

test('model upload stores bytes and returns the final filename', (t) => {
    const { app, appDir } = createFixture(t);
    const res = response();
    const body = Buffer.from('<html><body>model</body></html>');
    app.handler('POST', '/upload-model-file')(
        { query: { filename: 'gcrn-report.html' }, body }, res,
    );
    assert.deepEqual(res.body, { success: true, filename: 'gcrn-report.html' });
    assert.deepEqual(fs.readFileSync(path.join(appDir, 'Model-Inspector/gcrn-report.html')), body);
});

test('model upload sanitizes traversal and shell characters', (t) => {
    const { app, appDir, root } = createFixture(t);
    const res = response();
    app.handler('POST', '/upload-model-file')(
        { query: { filename: '../../bad name;$(touch owned).html' }, body: Buffer.from('safe') }, res,
    );
    assert.match(res.body.filename, /^[a-zA-Z0-9._-]+$/);
    assert.ok(fs.existsSync(path.join(appDir, 'Model-Inspector', res.body.filename)));
    assert.equal(fs.existsSync(path.join(root, 'owned')), false);
});

test('model upload uses a safe default for an empty filename', (t) => {
    const { app, appDir } = createFixture(t);
    const res = response();
    app.handler('POST', '/upload-model-file')({ query: {}, body: Buffer.from('x') }, res);
    assert.equal(res.body.filename, 'uploaded_model.html');
    assert.equal(fs.readFileSync(path.join(appDir, 'Model-Inspector/uploaded_model.html'), 'utf8'), 'x');
});

test('model upload creates Model-Inspector directory when absent', (t) => {
    const { app, appDir } = createFixture(t);
    const miDir = path.join(appDir, 'Model-Inspector');
    fs.rmSync(miDir, { recursive: true, force: true });
    const res = response();
    app.handler('POST', '/upload-model-file')(
        { query: { filename: 'new.html' }, body: Buffer.from('<html/>') }, res,
    );
    assert.equal(res.statusCode, 200);
    assert.ok(fs.existsSync(path.join(miDir, 'new.html')));
});

// ─────────────────────────────────────────────────────────────────────────────
// Audio classification — parseClassificationLine
// ─────────────────────────────────────────────────────────────────────────────

test('audio classification parser supports JSON output variants', () => {
    const { parseClassificationLine } = require(CLASSIFICATION_PLUGIN);
    assert.equal(parseClassificationLine('{"class":"Speech"}'), 'Speech');
    assert.equal(parseClassificationLine('{"top_class":"Dog bark"}'), 'Dog bark');
    assert.equal(parseClassificationLine('{"predictions":[{"label":"Music"}]}'), 'Music');
});

test('audio classification parser supports human-readable output', () => {
    const { parseClassificationLine } = require(CLASSIFICATION_PLUGIN);
    assert.equal(parseClassificationLine('Classification: Keyboard typing'), 'Keyboard typing');
    assert.equal(parseClassificationLine('[App]   1. 0.9234  Speech'), 'Speech');
    assert.equal(parseClassificationLine('unrelated diagnostic text'), null);
    assert.equal(parseClassificationLine(''), null);
});

test('audio classification parser handles all single-key JSON field names', () => {
    const { parseClassificationLine } = require(CLASSIFICATION_PLUGIN);
    assert.equal(parseClassificationLine('{"label":"Cat"}'), 'Cat');
    assert.equal(parseClassificationLine('{"event":"Alarm"}'), 'Alarm');
    assert.equal(parseClassificationLine('{"prediction":"Dog"}'), 'Dog');
    assert.equal(parseClassificationLine('{"topClass":"Silence"}'), 'Silence');
});

test('audio classification parser handles predictions array with class, name, and string items', () => {
    const { parseClassificationLine } = require(CLASSIFICATION_PLUGIN);
    assert.equal(parseClassificationLine('{"predictions":[{"class":"Cat"}]}'), 'Cat');
    assert.equal(parseClassificationLine('{"predictions":[{"name":"Gunshot"}]}'), 'Gunshot');
    assert.equal(parseClassificationLine('{"predictions":["Crowd"]}'), 'Crowd');
});

test('audio classification parser handles Predicted/Top keyword prefixes', () => {
    const { parseClassificationLine } = require(CLASSIFICATION_PLUGIN);
    assert.equal(parseClassificationLine('Predicted class: Dog'), 'Dog');
    assert.equal(parseClassificationLine('Predicted label: Music'), 'Music');
    assert.equal(parseClassificationLine('Top class: Speech'), 'Speech');
    assert.equal(parseClassificationLine('Top-1 class: Vehicle'), 'Vehicle');
    assert.equal(parseClassificationLine('Top 1 label: Wind'), 'Wind');
});

test('audio classification parser: malformed JSON falls through to text pattern', () => {
    const { parseClassificationLine } = require(CLASSIFICATION_PLUGIN);
    assert.equal(parseClassificationLine('{bad json} Classification: Alarm'), 'Alarm');
    assert.equal(parseClassificationLine('{bad json} unrelated text'), null);
});

test('audio classification parser: top-1 line with scientific notation and negative score', () => {
    const { parseClassificationLine } = require(CLASSIFICATION_PLUGIN);
    assert.equal(parseClassificationLine('[App]   1. 1.23e-04  Speech'), 'Speech');
    assert.equal(parseClassificationLine('[App]   1. -0.0023  Music'), 'Music');
});

test('audio classification parser: whitespace-only and null-like inputs return null', () => {
    const { parseClassificationLine } = require(CLASSIFICATION_PLUGIN);
    assert.equal(parseClassificationLine('   '), null);
    assert.equal(parseClassificationLine(null), null);
    assert.equal(parseClassificationLine(undefined), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Audio classification — parseRankedLine
// ─────────────────────────────────────────────────────────────────────────────

test('parseRankedLine extracts rank, score, and class from well-formed lines', () => {
    const { parseRankedLine } = require(CLASSIFICATION_PLUGIN);
    assert.deepEqual(parseRankedLine('[App]   1. 0.9234  Speech'), { rank: 1, score: 0.9234, class: 'Speech' });
    assert.deepEqual(parseRankedLine('[App]   5. 0.0031  Dog bark'), { rank: 5, score: 0.0031, class: 'Dog bark' });
    assert.deepEqual(parseRankedLine('[App]   10. 0.0001  Crowd noise'), { rank: 10, score: 0.0001, class: 'Crowd noise' });
});

test('parseRankedLine handles negative scores and scientific notation', () => {
    const { parseRankedLine } = require(CLASSIFICATION_PLUGIN);
    const neg = parseRankedLine('[App]   2. -0.001  Silence');
    assert.equal(neg.rank, 2);
    assert.equal(neg.score, -0.001);
    const sci = parseRankedLine('[App]   1. 1.5e-3  Music');
    assert.ok(Math.abs(sci.score - 0.0015) < 1e-9);
});

test('parseRankedLine returns null for non-matching lines', () => {
    const { parseRankedLine } = require(CLASSIFICATION_PLUGIN);
    assert.equal(parseRankedLine(''), null);
    assert.equal(parseRankedLine('Classification: Dog'), null);
    assert.equal(parseRankedLine('[App] Chunk 1/5 | STFT=2ms'), null);
    assert.equal(parseRankedLine('[App]   1.  no-score  ClassName'), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Audio classification — parseAlsaOutput
// ─────────────────────────────────────────────────────────────────────────────

test('audio-classification ALSA parser formats entries and filters webcam/camera/cape', () => {
    const { parseAlsaOutput } = require(CLASSIFICATION_PLUGIN);
    const stdout = [
        'card 0: AM62DBoard [AM62D Board], device 0: AME0I2S0 mic []',
        'card 1: C920 [HD Pro Webcam C920], device 0: USB Audio usb []',
        'card 2: CapeSnd [AM335x Cape Sound], device 0: PCM snd []',
        'card 3: Cam [USB Camera], device 0: USB Audio usb []',
        'some unrelated line',
    ].join('\n');
    const out = parseAlsaOutput(stdout);
    assert.ok(out.includes('plughw:0,0|AM62D Board: mic'), `expected AM62D entry, got: ${out}`);
    assert.equal(out.toLowerCase().includes('webcam'), false);
    assert.equal(out.toLowerCase().includes('cape'), false);
    assert.equal(out.toLowerCase().includes('camera'), false);
});

test('audio-classification ALSA parser handles multiple valid cards', () => {
    const { parseAlsaOutput } = require(CLASSIFICATION_PLUGIN);
    const stdout = [
        'card 0: Board0 [Board Zero], device 0: PCM pcm0 []',
        'card 1: Board1 [Board One], device 2: PCM pcm2 []',
    ].join('\n');
    const lines = parseAlsaOutput(stdout).split('\n');
    assert.equal(lines.length, 2);
    assert.ok(lines[0].startsWith('plughw:0,0'));
    assert.ok(lines[1].startsWith('plughw:1,2'));
});

test('audio-classification ALSA parser returns empty string when no valid cards exist', () => {
    const { parseAlsaOutput } = require(CLASSIFICATION_PLUGIN);
    assert.equal(parseAlsaOutput(''), '');
    assert.equal(parseAlsaOutput('card 0: Cam [HD Camera], device 0: USB usb []'), '');
    assert.equal(parseAlsaOutput('**** List of CAPTURE Hardware Devices ****'), '');
});

// ─────────────────────────────────────────────────────────────────────────────
// Speech enhancement — parseAlsaOutput
// ─────────────────────────────────────────────────────────────────────────────

test('speech-enhancement ALSA parser formats entries and filters webcam/camera/cape', () => {
    const { parseAlsaOutput } = require(SPEECH_PLUGIN);
    const stdout = [
        'card 0: AM62DBoard [AM62D Board], device 0: AME0I2S0 mic []',
        'card 1: Cam [HD Webcam C920], device 0: USB Audio usb []',
    ].join('\n');
    const out = parseAlsaOutput(stdout);
    assert.ok(out.includes('plughw:0,0|AM62D Board: mic'));
    assert.equal(out.toLowerCase().includes('webcam'), false);
});

test('speech-enhancement ALSA parser returns empty string when no valid cards exist', () => {
    const { parseAlsaOutput } = require(SPEECH_PLUGIN);
    assert.equal(parseAlsaOutput(''), '');
    assert.equal(parseAlsaOutput('card 0: WebCam [USB Camera], device 0: USB usb []'), '');
});

// ─────────────────────────────────────────────────────────────────────────────
// Speech enhancement — nextInputVisualizationBlock
// ─────────────────────────────────────────────────────────────────────────────

test('speech visualization returns sequential fixed-size zero-padded blocks', () => {
    const { nextInputVisualizationBlock } = require(SPEECH_PLUGIN);
    const state = { inputPcm: Buffer.from([1, 2, 3, 4, 5]), inputPcmOffset: 0 };
    assert.deepEqual([...nextInputVisualizationBlock(state, 3)], [1, 2, 3]);
    assert.deepEqual([...nextInputVisualizationBlock(state, 3)], [4, 5, 0]);
    assert.deepEqual([...nextInputVisualizationBlock(state, 3)], [0, 0, 0]);
    assert.equal(state.inputPcmOffset, 5);
});

test('speech visualization returns all-zero block when PCM buffer is empty', () => {
    const { nextInputVisualizationBlock } = require(SPEECH_PLUGIN);
    const state = { inputPcm: Buffer.alloc(0), inputPcmOffset: 0 };
    assert.deepEqual([...nextInputVisualizationBlock(state, 4)], [0, 0, 0, 0]);
    assert.equal(state.inputPcmOffset, 0);
});

test('speech visualization returns zeros when offset is already past end of PCM', () => {
    const { nextInputVisualizationBlock } = require(SPEECH_PLUGIN);
    const state = { inputPcm: Buffer.from([1, 2, 3]), inputPcmOffset: 3 };
    assert.deepEqual([...nextInputVisualizationBlock(state, 3)], [0, 0, 0]);
    assert.equal(state.inputPcmOffset, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// Speech enhancement — WAV parsing
// ─────────────────────────────────────────────────────────────────────────────

test('readPcmWav accepts a valid 16-bit mono WAV and returns pcm buffer with correct sampleRate', (t) => {
    const { readPcmWav } = require(SPEECH_PLUGIN);
    const tmp = path.join(os.tmpdir(), `am62d-test-${process.pid}-readpcmwav.wav`);
    t.after(() => { try { fs.unlinkSync(tmp); } catch (_) {} });
    fs.writeFileSync(tmp, makeWav({ sampleRate: 48000, channels: 1, bitsPerSample: 16, samples: 480 }));
    const { pcm, sampleRate } = readPcmWav(tmp);
    assert.equal(sampleRate, 48000);
    assert.equal(pcm.length, 480 * 2);  // 16-bit = 2 bytes/sample
});

test('readPcmWav accepts non-48kHz mono 16-bit WAV (no sample-rate restriction)', (t) => {
    const { readPcmWav } = require(SPEECH_PLUGIN);
    const tmp = path.join(os.tmpdir(), `am62d-test-${process.pid}-readpcmwav-16k.wav`);
    t.after(() => { try { fs.unlinkSync(tmp); } catch (_) {} });
    fs.writeFileSync(tmp, makeWav({ sampleRate: 16000, channels: 1, bitsPerSample: 16, samples: 160 }));
    const { sampleRate } = readPcmWav(tmp);
    assert.equal(sampleRate, 16000);
});

test('readPcmWav rejects stereo WAV', (t) => {
    const { readPcmWav } = require(SPEECH_PLUGIN);
    const tmp = path.join(os.tmpdir(), `am62d-test-${process.pid}-stereo.wav`);
    t.after(() => { try { fs.unlinkSync(tmp); } catch (_) {} });
    fs.writeFileSync(tmp, makeWav({ channels: 2 }));
    assert.throws(() => readPcmWav(tmp), /mono/i);
});

test('readPcmWav rejects 8-bit WAV', (t) => {
    const { readPcmWav } = require(SPEECH_PLUGIN);
    const tmp = path.join(os.tmpdir(), `am62d-test-${process.pid}-8bit.wav`);
    t.after(() => { try { fs.unlinkSync(tmp); } catch (_) {} });
    fs.writeFileSync(tmp, makeWav({ bitsPerSample: 8 }));
    assert.throws(() => readPcmWav(tmp), /16-bit/i);
});

test('readPcmWav rejects compressed (non-PCM) WAV', (t) => {
    const { readPcmWav } = require(SPEECH_PLUGIN);
    const tmp = path.join(os.tmpdir(), `am62d-test-${process.pid}-compressed.wav`);
    t.after(() => { try { fs.unlinkSync(tmp); } catch (_) {} });
    fs.writeFileSync(tmp, makeWav({ audioFmt: 3 }));  // IEEE float
    assert.throws(() => readPcmWav(tmp), /PCM/i);
});

test('readPcmWav rejects non-WAV data', (t) => {
    const { readPcmWav } = require(SPEECH_PLUGIN);
    const tmp = path.join(os.tmpdir(), `am62d-test-${process.pid}-notriff.wav`);
    t.after(() => { try { fs.unlinkSync(tmp); } catch (_) {} });
    fs.writeFileSync(tmp, Buffer.from('This is not a WAV file at all'));
    assert.throws(() => readPcmWav(tmp), /WAV/i);
});

test('readPcmWavInfo calculates duration and total samples correctly', (t) => {
    const { readPcmWavInfo } = require(SPEECH_PLUGIN);
    const tmp = path.join(os.tmpdir(), `am62d-test-${process.pid}-wavinfo.wav`);
    t.after(() => { try { fs.unlinkSync(tmp); } catch (_) {} });
    // 48000 samples at 48 kHz mono 16-bit = exactly 1.0 second
    fs.writeFileSync(tmp, makeWav({ sampleRate: 48000, channels: 1, bitsPerSample: 16, samples: 48000 }));
    const info = readPcmWavInfo(tmp);
    assert.equal(info.channels, 1);
    assert.equal(info.sampleRate, 48000);
    assert.equal(info.bitsPerSample, 16);
    assert.equal(info.durationSec, 1.0);
    assert.equal(info.totalSamples, 48000);
});

test('readPcmWavInfo returns null for a file that cannot be parsed', () => {
    const { readPcmWavInfo } = require(SPEECH_PLUGIN);
    assert.equal(readPcmWavInfo('/non/existent/path/file.wav'), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Demo coordinator — DSP ownership state machine
// ─────────────────────────────────────────────────────────────────────────────

test('demo coordinator: acquireDsp succeeds when idle; second acquire from any demo returns busy error', () => {
    const c = freshCoordinator();
    assert.equal(c.acquireDsp('demo-a', '10.0.0.1'), null);
    assert.match(c.acquireDsp('demo-b', '10.0.0.2'), /busy/i);
    assert.equal(c.activeDemo(), 'demo-a');
    assert.equal(c.activeOwnerIp(), '10.0.0.1');
});

test('demo coordinator: releaseDsp with wrong name is a no-op; correct name frees the lock', () => {
    const c = freshCoordinator();
    c.acquireDsp('my-demo', '1.2.3.4');
    c.releaseDsp('other-demo');
    assert.equal(c.activeDemo(), 'my-demo');
    c.releaseDsp('my-demo');
    assert.equal(c.activeDemo(), null);
    assert.equal(c.activeOwnerIp(), null);
});

test('demo coordinator: re-acquire succeeds immediately after release', () => {
    const c = freshCoordinator();
    c.acquireDsp('demo-a', '1.2.3.4');
    c.releaseDsp('demo-a');
    assert.equal(c.acquireDsp('demo-b', '5.6.7.8'), null);
    assert.equal(c.activeDemo(), 'demo-b');
});

test('demo coordinator: checkStopAuthorised — not running allows any caller', () => {
    const c = freshCoordinator();
    assert.equal(c.checkStopAuthorised('demo-a', '1.1.1.1'), null);
});

test('demo coordinator: checkStopAuthorised — different demo name is always allowed', () => {
    const c = freshCoordinator();
    c.acquireDsp('demo-a', '10.0.0.1');
    assert.equal(c.checkStopAuthorised('demo-b', '9.9.9.9'), null);
});

test('demo coordinator: checkStopAuthorised — correct owner is allowed, wrong owner is denied', () => {
    const c = freshCoordinator();
    c.acquireDsp('demo-a', '10.0.0.1');
    assert.equal(c.checkStopAuthorised('demo-a', '10.0.0.1'), null);
    const err = c.checkStopAuthorised('demo-a', '9.9.9.9');
    assert.ok(err && err.includes('10.0.0.1'), `expected owner IP in error, got: ${err}`);
});

test('demo coordinator: checkStopAuthorised allows any IP when no owner was recorded', () => {
    const c = freshCoordinator();
    c.acquireDsp('demo-a');   // no ownerIp
    assert.equal(c.checkStopAuthorised('demo-a', '9.9.9.9'), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Audio classification plugin — AM62D-specific REST routes
// ─────────────────────────────────────────────────────────────────────────────

test('audio-classification/info returns backend, timing, and sample-rate fields', (t) => {
    const { app, defaultInputPath } = createAcFixture(t);
    const res = response();
    app.handler('GET', '/audio-classification/info')({}, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.backend, 'edge-ai-rpmsg');
    assert.equal(res.body.captureSeconds, 5);
    assert.equal(res.body.sampleRate, 16000);
    assert.equal(res.body.defaultFile, defaultInputPath);
    assert.equal(res.body.defaultFileName, 'input_audio.wav');
});

test('audio-classification/models returns model registry and default key', (t) => {
    const { app } = createAcFixture(t);
    const res = response();
    app.handler('GET', '/audio-classification/models')({}, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.models && typeof res.body.models === 'object');
    assert.ok(typeof res.body.default === 'string');
    assert.ok(Object.keys(res.body.models).length > 0);
    // default key must exist in the registry
    assert.ok(res.body.models[res.body.default]);
});

test('audio-classification/status reports not running on startup', (t) => {
    const { app } = createAcFixture(t);
    const res = response();
    app.handler('GET', '/audio-classification/status')({}, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.running, false);
    assert.equal(res.body.backend, 'edge-ai-rpmsg');
});

test('upload-audio-classification-file rejects non-WAV data with 400', (t) => {
    const { app } = createAcFixture(t);
    const res = response();
    app.handler('POST', '/upload-audio-classification-file')(
        { query: {}, body: Buffer.from('not a wav file') }, res,
    );
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /WAV/i);
});

test('upload-audio-classification-file rejects payloads shorter than 12 bytes with 400', (t) => {
    const { app } = createAcFixture(t);
    const res = response();
    app.handler('POST', '/upload-audio-classification-file')(
        { query: {}, body: Buffer.from('short') }, res,
    );
    assert.equal(res.statusCode, 400);
});

test('upload-audio-classification-file auto-appends .wav when extension is missing', (t) => {
    const { app, inputDir } = createAcFixture(t);
    const res = response();
    app.handler('POST', '/upload-audio-classification-file')(
        { query: { filename: 'myfile' }, body: makeWav({ samples: 10 }) }, res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.name, 'myfile.wav');
    assert.ok(fs.existsSync(path.join(inputDir, 'myfile.wav')));
});

test('upload-audio-classification-file preserves .wav extension when already present', (t) => {
    const { app } = createAcFixture(t);
    const res = response();
    app.handler('POST', '/upload-audio-classification-file')(
        { query: { filename: 'clip.wav' }, body: makeWav({ samples: 10 }) }, res,
    );
    assert.equal(res.body.name, 'clip.wav');
});

test('upload-audio-classification-file uses default name when filename is empty', (t) => {
    const { app } = createAcFixture(t);
    const res = response();
    app.handler('POST', '/upload-audio-classification-file')(
        { query: {}, body: makeWav({ samples: 10 }) }, res,
    );
    assert.equal(res.body.name, 'uploaded_audio.wav');
});

// ─────────────────────────────────────────────────────────────────────────────
// Device configuration — device.json contract
// ─────────────────────────────────────────────────────────────────────────────

test('AM62D device configuration declares the required Vue demos', () => {
    const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'devices/am62dxx/device.json'), 'utf8'));
    assert.equal(config.id, 'am62dxx');
    assert.equal(config.ui, 'vue');
    for (const demo of [
        'cpu-monitor', 'tvm-inference', 'audio-classification', 'speech-enhancement',
        'audio-offload', '2dfft', 'sigchain-biquad', 'gst-pipeline',
    ]) assert.ok(config.demos.includes(demo), `Required AM62D demo missing: ${demo}`);
});
