# WebServer Out-of-Box Demo — Developer Guide

Web-based demo portal for TI Sitara processors. A Node.js/Express server automatically loads demo plugins based on which device it is running on, and serves a shared frontend that adapts to the active demo set.

---

## Table of Contents

1. [Repository Structure](#1-repository-structure)
2. [How It Works — Architecture Overview](#2-how-it-works--architecture-overview)
3. [Supported Devices](#3-supported-devices)
4. [Getting Started (Local Dev)](#4-getting-started-local-dev)
5. [Build and Deploy to Board](#5-build-and-deploy-to-board)
6. [device.json Reference](#6-devicejson-reference)
7. [manifest.json Reference](#7-manifestjson-reference)
8. [server-plugin.js Reference](#8-server-pluginjs-reference)
9. [Frontend Pages Reference](#9-frontend-pages-reference)
10. [CSS Theming System](#10-css-theming-system)
11. [Side Panel System](#11-side-panel-system)
12. [Built-in REST Endpoints](#12-built-in-rest-endpoints)
13. [Demo-Specific REST and WebSocket Reference](#13-demo-specific-rest-and-websocket-reference)
14. [Native C Utilities Reference](#14-native-c-utilities-reference)
15. [Audio Classification Data Flow](#15-audio-classification-data-flow)
16. [Adding a New Demo](#16-adding-a-new-demo)
17. [Modifying an Existing Demo](#17-modifying-an-existing-demo)
18. [Adding a New Device](#18-adding-a-new-device)
19. [Environment Variables](#19-environment-variables)
20. [Common Pitfalls and Debugging](#20-common-pitfalls-and-debugging)

---

## 1. Repository Structure

```
webserver-oob-demo-vs/
│
├── Makefile                        Root build orchestration
├── README.md                       This file
├── LICENSE                         TI Text File License
│
├── common/
│   ├── app/                        Shared frontend — served to every device
│   │   ├── index.html              Landing page / device selector
│   │   ├── audio-dsp.html          DSP with Audio Analytics page
│   │   ├── dsp-compute.html        DSP Compute demos page (AM62D specific)
│   │   ├── model-inspector.html    AI Model Inspector page
│   │   ├── audio-offload.html      Audio offload standalone page
│   │   ├── main.js                 GUI Composer bootstrap
│   │   ├── oneui.css               TI OneUI component styles
│   │   ├── ti-logo.png             TI branding
│   │   ├── am62d-chip.png          AM62D chip diagram
│   │   ├── images/                 Signal flow diagrams, loading gif
│   │   ├── splash/                 Splash screen config
│   │   ├── components/             GUI Composer web components (git submodule)
│   │   └── Model-Inspector/        Uploaded / sample model HTML files
│   │
│   ├── linux_app/                  Shared C utilities compiled for target
│   │   ├── Makefile                Builds cpu_stats binary
│   │   ├── Makefile.common         Shared cross-compile template (included by device Makefiles)
│   │   ├── cpu_stats.c             CPU load monitoring with history + EMA smoothing
│   │   ├── audio_utils.c           ALSA device enumeration
│   │   ├── spectrum_utils.c        FFT spectrum analysis helpers
│   │   └── speech_utils.c          Speech-to-text via GStreamer + ONNX Runtime
│   │
│   └── webserver/                  Node.js server
│       ├── server.js               Main server — plugin loader, core endpoints
│       ├── package.json            Dependencies: express ^4, ws ^8
│       ├── webserver-oob.conf      Env-var config template (written to /etc/ at deploy)
│       ├── webserver-oob.service   systemd service unit
│       └── lib/
│           ├── fifo-reader.js      Child process: reads audio classification FIFO → stdout JSON
│           └── speech-fifo-reader.js  Child process: reads speech-to-text FIFO → stdout JSON
│
├── demos/                          One subdirectory per demo plugin
│   ├── cpu-monitor/
│   │   ├── manifest.json
│   │   └── server-plugin.js
│   ├── audio-classification/
│   │   ├── manifest.json
│   │   └── server-plugin.js
│   ├── speech-to-text/             AM62P only
│   │   ├── manifest.json
│   │   └── server-plugin.js
│   ├── speech-enhancement/         AM62D only
│   │   ├── manifest.json
│   │   └── server-plugin.js
│   ├── audio-offload/              AM62D only
│   │   ├── manifest.json
│   │   └── server-plugin.js
│   ├── sigchain-biquad/            AM62D only
│   │   ├── manifest.json
│   │   └── server-plugin.js
│   ├── 2dfft/                      AM62D only
│   │   ├── manifest.json
│   │   └── server-plugin.js
│   └── tvm-inference/              AM62D only
│       ├── manifest.json
│       └── server-plugin.js
│
├── devices/                        Per-device configuration
│   ├── am335x/
│   │   ├── device.json
│   │   ├── app/images/             Board photos (overlaid onto common/app/)
│   │   └── linux_app/Makefile      Builds audio_utils for this device
│   ├── am62xx/
│   │   ├── device.json
│   │   └── linux_app/Makefile
│   ├── am62pxx/
│   │   ├── device.json
│   │   └── linux_app/Makefile
│   ├── am62lxx/
│   │   ├── device.json
│   │   └── linux_app/Makefile
│   └── am62dxx/
│       ├── device.json
│       └── linux_app/Makefile
│
├── docs/
│   ├── adding-a-demo.md
│   └── adding-a-device.md
│
├── tools/
│   ├── find-board.sh               ARP scan to auto-discover board IP
│   ├── generate-inc.js             Regenerates Yocto npm .inc from package-lock.json
│   └── make_static_onnx.py         Bake static tensor shapes into dynamic ONNX models
│
└── yocto/
    ├── webserver-oob_git.bb        Single BitBake recipe — all devices via COMPATIBLE_MACHINE
    └── webserver-oob-npm.inc       Auto-generated npm deps for offline Yocto fetch
```

---

## 2. How It Works — Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                  │
│  index.html / audio-dsp.html / dsp-compute.html          │
│  model-inspector.html                                     │
│     │  fetch()  GET /device-info, /cpu-load, /logs …     │
│     │  WebSocket  ws://board:3000/audio-offload, /2dfft … │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTP + WebSocket  port 3000
┌──────────────────────▼──────────────────────────────────┐
│  common/webserver/server.js  (Node.js Express)           │
│                                                           │
│  1. Reads devices/<id>/device.json                       │
│  2. Serves common/app/ (+ devices/<id>/app/ overlay)     │
│  3. Exposes core endpoints: /device-info, /ping, /logs … │
│  4. For each id in device.demos[]:                       │
│       require('demos/<id>/server-plugin.js')(app,wss,dev)│
└──────────────────────┬──────────────────────────────────┘
                       │  spawn / exec / TCP
        ┌──────────────┼───────────────────┬──────────────────────┐
        ▼              ▼                   ▼                      ▼
  /usr/bin/        TCP bridge          GStreamer             AM62D Edge-AI
  cpu_stats        rpmsg_audio_        NNStreamer            arecord → WAV
  rpmsg_2dfft      offload_example     pipeline → FIFO       → RPMsg/TVM JSON
  tvm_inference    (ports 8888-8891)   (non-AM62D)           (C7x DSP)
  _client
```

**Key design rules:**
- `server.js` itself knows nothing about any specific demo. All demo logic lives in `demos/<id>/server-plugin.js`.
- The `device.demos[]` array in `device.json` controls which plugins are loaded at startup. If a demo is not in the array, its plugin never runs.
- A single codebase serves all five device families — differentiation is entirely through `device.json`.
- `MOCK=1` short-circuits every native binary call so the server runs on a developer's x86 machine.

---

## 3. Supported Devices

| `DEVICE=` | `device.json id` | Boards | Active Demos |
|---|---|---|---|
| `am335x` | `am335x` | BeagleBone Green Eco, TMDXEVM3358 | cpu-monitor, audio-classification |
| `am62xx` | `am62xx` | SK-AM62B, SK-AM62-SIP, AM62x LP EVM | cpu-monitor, audio-classification |
| `am62pxx` | `am62pxx` | SK-AM62P | cpu-monitor, audio-classification, speech-to-text |
| `am62lxx` | `am62lxx` | SK-AM62L | cpu-monitor, audio-classification |
| `am62dxx` | `am62dxx` | SK-AM62D | cpu-monitor, tvm-inference, audio-classification, speech-enhancement, audio-offload, 2dfft, sigchain-biquad |

---

## 4. Getting Started (Local Dev)

```bash
# Clone (requires git.ti.com access for the GUI Composer submodule)
git clone <repo-url>
cd webserver-oob-demo-vs
git submodule update --init --recursive

# Install Node.js dependencies (only needed once)
cd common/webserver && npm install && cd ../..

# Run locally with all data mocked — no board, no binaries needed
make dev DEVICE=am62dxx MOCK=1

# Open http://localhost:3000
```

To run a specific device variant:

```bash
make dev DEVICE=am335x  MOCK=1
make dev DEVICE=am62xx  MOCK=1
make dev DEVICE=am62pxx MOCK=1
```

If port 3000 is already in use on Linux:

```bash
fuser -k 3000/tcp
```

**TI corporate proxy note:** McAfee intercepts `localhost` curl requests. Use `--noproxy localhost` if testing with curl.

---

## 5. Build and Deploy to Board

### Cross-compile native utilities

```bash
# AM62D (aarch64)
make build DEVICE=am62dxx CC=aarch64-linux-gnu-gcc

# AM335x (armv7)
make build DEVICE=am335x CC=arm-linux-gnueabihf-gcc
```

This builds:
- `common/linux_app/cpu_stats` → deployed to `/usr/bin/cpu_stats`
- `devices/<id>/linux_app/audio_utils` (if the Makefile defines it) → `/usr/bin/audio_utils`

For AM62D, the root build also installs and builds the Vue frontend. The
Audio Classification page is compiled into
`devices/am62dxx/app/vue-dist/`. Its classification backend does **not** use
`audio_utils` or GStreamer: live audio is captured by `arecord`, while live
and file sources are processed by `rpmsg_inference_example` using the
classification pipeline JSON. Other devices continue to build and use their
existing `audio_utils` implementation unchanged.

To build and test only the AM62D frontend while developing the GUI:

```bash
cd frontend
npm install
npm test
VITE_DEVICE=am62dxx npm run build
cd ..
```

Use an active Node.js LTS release (Node.js 20 or newer). No Node.js
packages are needed on the EVM for the Vue bundle itself; the generated files
are static HTML, JavaScript, CSS, images, and fonts.

The AM62D image must separately contain the Edge-AI artifacts built from the
RPMsg-DMA repository:

```text
/usr/bin/rpmsg_inference_example
/usr/share/tvm_inference/json/pipeline_speech_classification.json
/usr/share/tvm_inference/input/input_audio.wav
/usr/bin/arecord
```

The webserver build does not compile or install the RPMsg application. Build
and install the RPMsg-DMA project first (including its Edge-AI target and JSON
install rule), then verify the four paths above on the EVM.

### Deploy to board

```bash
# Board IP auto-discovered from ARP cache; override if needed
make deploy DEVICE=am62dxx BOARD_HOST=root@192.168.1.100

# Or let the tool find it automatically
make deploy DEVICE=am62dxx
```

`make deploy` runs four steps in order:
1. `make build` — cross-compile
2. `deploy-bins` — scp binaries to `/usr/bin/`
3. `deploy-server` — sync `common/webserver/` and `demos/` to `/usr/share/webserver-oob/`; write `/etc/webserver-oob.conf`
4. `deploy-app` — sync `common/app/` + `devices/<id>/app/` overlay + `device.json` to `/usr/share/webserver-oob/app/`

### Restart the service

```bash
make deploy-restart BOARD_HOST=root@<ip>
# or manually:
ssh root@<ip> "systemctl restart webserver-oob"
```

### Quick push (no rebuild, just sync changed web files)

```bash
make push DEVICE=am62dxx BOARD_HOST=root@<ip>
```

This syncs `server.js` and the HTML pages and restarts the service — useful during UI iteration.

### On-board file locations

| What | Board path |
|---|---|
| Frontend HTML/JS/CSS | `/usr/share/webserver-oob/app/` |
| device.json | `/usr/share/webserver-oob/app/device.json` |
| Demo plugins | `/usr/share/webserver-oob/demos/<id>/server-plugin.js` |
| Server | `/usr/lib/node_modules/webserver-oob/server.js` (systemd runs this) |
| Env config | `/etc/webserver-oob.conf` |
| Native binaries | `/usr/bin/cpu_stats`, `/usr/bin/audio_utils` |
| systemd service | `common/webserver/webserver-oob.service` |

---

## 6. device.json Reference

Located at `devices/<id>/device.json`. This is the single source of truth that controls everything about a device variant.

```jsonc
{
  // Unique identifier — must match the directory name under devices/
  "id": "am62dxx",

  // Human-readable name shown in the UI navbar subtitle
  "displayName": "AM62D",

  // Array of board objects shown in the Device Info side panel
  "boards": [
    {
      "name": "SK-AM62D",           // Board name
      "description": "...",          // Shown as a description card in Device Info panel
      "image": "images/sk-am62d-angled.png"  // Relative to devices/<id>/app/
    }
  ],

  // SoC description string shown in Device Info panel
  "soc": "AM62Dx quad Cortex-A53 @ 1.4GHz + C7x DSP",

  // Which demo plugins to load — server.js loads demos/<id>/server-plugin.js for each
  // Order matters: plugins register routes in this order
  "demos": [
    "cpu-monitor",
    "tvm-inference",
    "audio-classification",
    "speech-enhancement",
    "audio-offload",
    "2dfft",
    "sigchain-biquad"
  ],

  // Per-demo configuration passed into each plugin as device.demoConfig['<id>']
  // Add device-specific paths, hosts, model names here instead of hardcoding in plugins
  "demoConfig": {
    "tvm-inference": {
      "artifactsPath": "/root/artifacts_mobilenet_v2_tv-onnx/",
      "modelName": "MobileNet v2",
      "description": "Hardware-accelerated inference using TVM+TIDL on C7x DSP"
    },
    "audio-offload": {
      "binPath": "/usr/bin/rpmsg_audio_offload_example",  // override binary path
      "host": "127.0.0.1"                                  // TCP host to connect to
    },
    "2dfft": {
      "binPath": "/usr/bin/rpmsg_2dfft_example"
    }
  },

  // Documentation links shown on the Resources / Docs page
  "docs": {
    "subtitle": "...",
    "cards": [
      {
        "title": "Product Page",
        "description": "...",
        "url": "https://www.ti.com/product/AM62D4",
        "linkText": "View Product",
        "badge": "Official",
        "icon": "hardware:developer_board"   // Material icon id
      }
    ],
    "quickLinks": [
      { "text": "Code Composer Studio", "url": "...", "icon": "action:build" }
    ]
  }
}
```

**How `demoConfig` is consumed in a plugin:**

```js
module.exports = function register(app, wss, device) {
    const cfg = (device.demoConfig || {})['my-demo'] || {};
    const BIN = cfg.binPath || '/usr/bin/my_binary';
    const HOST = cfg.host   || '127.0.0.1';
    // ...
};
```

**Updating device.json at runtime:**

`POST /device-config` with a JSON body deep-merges into the in-memory device object and writes it back to disk. This is used by the Settings panel in `dsp-compute.html` to persist binary paths and TCP host configuration without rebooting.

---

## 7. manifest.json Reference

Located at `demos/<id>/manifest.json`. Describes the demo for the UI and for `GET /demo-manifests`.

```jsonc
{
  // Must match the directory name under demos/
  "id": "audio-offload",

  // Display name in the UI
  "name": "Audio DSP Offload",

  // Material icon id for the demo icon in the sidebar / cards
  "icon": "av:equalizer",

  // Description shown in demo cards and tooltips
  "description": "Real-time 8-channel audio processing offloaded to C7x DSP...",

  // Which devices expose this demo. Use ["*"] for all devices.
  "devices": ["am62dxx"],

  // REST routes this plugin registers — informational only (server.js does not enforce)
  "routes": [
    "/audio-offload/connect",
    "/audio-offload/disconnect",
    "/audio-offload/filter",
    "/audio-offload/run",
    "/audio-offload/stop"
  ],

  // WebSocket path this plugin handles — informational only
  "websocket": "/audio-offload"
}
```

The frontend fetches `GET /demo-manifests` on load to know which demos are active and what icons/names to display in the sidebar.

---

## 8. server-plugin.js Reference

Every plugin exports exactly one function:

```js
module.exports = function registerMyDemo(app, wss, device) { ... };
```

| Parameter | Type | Description |
|---|---|---|
| `app` | `express.Application` | Register REST routes with `app.get()`, `app.post()`, etc. |
| `wss` | `ws.Server` | Register WebSocket handlers with `wss.on('connection', ...)` |
| `device` | `Object` | Parsed `device.json`; access per-demo config via `device.demoConfig['<id>']` |

### Mandatory rules

1. **Always support `MOCK=1`** — check `process.env.MOCK === '1'` and return synthetic data instead of calling binaries. Developers must be able to run `make dev MOCK=1` on any x86 machine.

2. **Never `require('ws')` directly** — the constant `WebSocket.OPEN === 1` is spec-defined. Use `const WS_OPEN = 1` and compare `ws.readyState === WS_OPEN`.

3. **Resolve shared libs via `process.env.WEBSERVER_DIR`** — the server sets this to `common/webserver/`. Use it when requiring `lib/fifo-reader.js`:
   ```js
   const fifoReaderPath = require('path').join(process.env.WEBSERVER_DIR, 'lib/fifo-reader.js');
   ```

4. **Register cleanup on `SIGTERM` and `SIGINT`** — kill spawned child processes so they don't become orphans:
   ```js
   function _cleanup() { if (proc) proc.kill('SIGTERM'); }
   process.on('SIGTERM', _cleanup);
   process.on('SIGINT',  _cleanup);
   ```

5. **Use `detached: true` + process group kill for interactive binaries** — binaries that need CTRL+C for graceful shutdown (e.g., `rpmsg_audio_offload_example`) must be spawned detached and killed via `process.kill(-pid, 'SIGINT')`:
   ```js
   proc = spawn(BIN, [], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
   // To stop:
   try { process.kill(-proc.pid, 'SIGINT'); }
   catch (_) { try { proc.kill('SIGINT'); } catch (_) {} }
   ```

6. **Log with a `[<id>]` prefix** — keeps server output readable:
   ```js
   console.log('[my-demo] Plugin registered' + (MOCK ? ' (MOCK mode)' : ''));
   ```

### Minimal plugin template

```js
'use strict';
const { exec } = require('child_process');
const WS_OPEN = 1;
const MOCK = process.env.MOCK === '1';

module.exports = function registerMyDemo(app, wss, device) {
    const cfg = (device.demoConfig || {})['my-demo'] || {};
    const BIN = cfg.binPath || '/usr/bin/my_binary';

    const clients = new Set();
    function broadcast(msg) {
        const s = JSON.stringify(msg);
        clients.forEach(ws => { if (ws.readyState === WS_OPEN) ws.send(s); });
    }

    // REST endpoint
    app.get('/my-demo/run', (req, res) => {
        if (MOCK) return res.json({ result: 'mock' });
        exec(BIN, (err, stdout) => {
            if (err) return res.status(500).send(err.message);
            broadcast({ type: 'result', data: stdout.trim() });
            res.send('ok');
        });
    });

    // WebSocket handler
    wss.on('connection', (ws, req) => {
        if (req.url !== '/my-demo') return;
        clients.add(ws);
        ws.send(JSON.stringify({ type: 'status', state: 'idle', mock: MOCK }));
        ws.on('close', () => clients.delete(ws));
        ws.on('error', () => clients.delete(ws));
    });

    console.log('[my-demo] Plugin registered' + (MOCK ? ' (MOCK mode)' : ''));
};
```

---

## 9. Frontend Pages Reference

All pages live in `common/app/` and are served to every device. Device-specific overrides (e.g., board images) live in `devices/<id>/app/` and are overlaid at runtime.

### index.html — Landing page

- Shows a hero section with device family branding.
- Fetches `GET /device-info` to populate the device name, board info, and active demo list.
- Shows demo cards for each active demo (driven by `activeDemos` array from `/device-info`).
- Links to the per-demo pages (`audio-dsp.html`, `dsp-compute.html`, `model-inspector.html`).
- Theme toggle stored in `localStorage` under key `theme` (`'light'` or absent for dark).

### audio-dsp.html — DSP with Audio Analytics

Hosts three demos in a shared sidebar + tabbed layout:

| Tab | Demo plugin | What it does |
|---|---|---|
| TVM Inference | `tvm-inference` | MobileNet v2 image classification on C7x DSP via TVM+TIDL |
| Audio Classification | `audio-classification` | YAMNet sound classification: AM62D uses ALSA WAV capture + RPMsg/TVM; other SoCs retain GStreamer + NNStreamer |
| Speech Enhancement | `speech-enhancement` | Noise reduction + TIDL spectral filtering on C7x DSP |

Key JavaScript functions:

| Function | Purpose |
|---|---|
| `openPanel(type)` | Opens the right-side panel. `type` = `'device'` or `'logs'` |
| `closePanel()` | Hides the side panel |
| `loadDevicePanel()` | Fetches `/device-info` and renders Device Info into the panel |
| `loadLogsPanel()` | Fetches `/logs` and renders log lines into the panel; auto-refreshes every 10s |
| `_panelRow(label, value)` | Helper that returns a themed HTML row for Device Info entries |
| `saveLogsToFile()` | Downloads current log lines as a `.txt` file |
| `toggleTheme()` | Flips `data-theme` attribute on `<html>` and saves to `localStorage` |

### dsp-compute.html — DSP Compute

Hosts three compute demos in a selector + detail layout:

| Demo | Plugin | What it does |
|---|---|---|
| Audio Offload | `audio-offload` | 8-channel audio DSP offload with spectrum visualization |
| 2D FFT | `2dfft` | Matrix 2D FFT offloaded to C7x DSP via RPMsg-DMA |
| Signal Chain Biquad | `sigchain-biquad` | 3-stage parametric EQ offloaded to C7x DSP |

Additional functions beyond the panel helpers above:

| Function | Purpose |
|---|---|
| `loadSettingsPanel()` | Renders Settings panel with binary paths, TCP host, theme toggle |
| `saveDspSettings()` | POSTs updated `demoConfig` to `/device-config` |
| `selectDemo(id)` | Activates a demo tab (audio-offload / 2dfft / sigchain-biquad) |

The `pagehide` event stops any running demos when the user navigates away:
```js
window.addEventListener('pagehide', () => {
    if (_aoRunning)     fetch('/audio-offload/stop',   { keepalive: true }).catch(() => {});
    if (_biquadRunning) fetch('/sigchain-biquad/stop', { keepalive: true }).catch(() => {});
    if (_fft2dRunning)  fetch('/2dfft/stop',           { keepalive: true }).catch(() => {});
});
```

### model-inspector.html — AI Model Inspector

- Lists model HTML files from `/model-inspector-list` (served from `common/app/Model-Inspector/`).
- Lets users upload new model HTML files via `POST /upload-model-file`.
- Displays the selected model in an `<iframe>`.
- Has the same Device Info / Logs side panel as the other pages.

### audio-offload.html — Audio Offload standalone

- Standalone page focused on the audio offload demo.
- Shows input/output spectrum canvases updated via WebSocket frames.
- Contains its own WebSocket client for `/audio-offload`.

---

## 10. CSS Theming System

All three main pages (`audio-dsp.html`, `dsp-compute.html`, `model-inspector.html`) define the same set of CSS custom properties in `:root` (dark mode default) and override them under `html[data-theme="light"]`.

### CSS variable reference

| Variable | Dark value | Light value | Use |
|---|---|---|---|
| `--bg-page` | `#0a0e1a` | `#f0f4f8` | Page/body background |
| `--bg-panel` | `#0d1117` | `#ffffff` | Cards, navbar, sidebar |
| `--bg-inner` | `#05080f` | `#f8fafc` | Nested content areas, log boxes |
| `--bg-deep` | `#03060e` | `#f1f5f9` | Deepest nesting |
| `--bd` | `#1e2a3a` | `#e2e8f0` | All borders and dividers |
| `--bd-hover` | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.04)` | Hover state overlay |
| `--txt` | `#e2e8f0` | `#0f172a` | Primary text |
| `--txt2` | `#94a3b8` | `#475569` | Secondary text |
| `--txt3` | `#64748b` | `#64748b` | Labels, muted text |
| `--txt4` | `#475569` | `#94a3b8` | Very muted / nav section labels |
| `--bar-track` | `#1a2438` | `#e2e8f0` | Progress bar backgrounds |

### Rules for writing themed HTML

Always use CSS variables in dynamically injected HTML (e.g., inside JavaScript template literals):

```js
// CORRECT — adapts to both themes
`<div style="background:var(--bg-inner);border:1px solid var(--bd);">
    <span style="color:var(--txt3);">${label}</span>
    <span style="color:var(--txt);">${value}</span>
</div>`

// WRONG — hardcoded hex breaks in light mode
`<div style="background:#05080f;border:1px solid #1e2a3a;">
    <span style="color:#64748b;">${label}</span>
</div>`
```

**Why this matters:** When JavaScript sets `element.style.display = 'flex'`, browsers normalize all inline style values from hex (`#0d1117`) to `rgb(13, 17, 23)`. This breaks `[style*="#0d1117"]` CSS attribute selectors. CSS variables are not normalized and always work.

### Theme toggle

The theme is toggled by flipping `document.documentElement.dataset.theme`:

```js
function toggleTheme() {
    const isLight = document.documentElement.dataset.theme === 'light';
    document.documentElement.dataset.theme = isLight ? '' : 'light';
    localStorage.setItem('theme', isLight ? '' : 'light');
}
```

The initial theme is applied before first paint via an inline script in `<head>`:

```html
<script>
  if(localStorage.getItem('theme')==='light')
    document.documentElement.dataset.theme='light';
</script>
```

### Accent colors (not CSS vars — intentional)

These are semantic / brand colors that don't invert between themes:

| Color | Hex | Used for |
|---|---|---|
| Blue accent | `#4da6ff` | Brand subtitle, links |
| Orange accent | `#d97706` / `#fbbf24` | DSP Compute active nav, buttons |
| Green | `#22c55e` | Connection/status dot |
| Red | `#ef4444` | Error states, log error lines |
| Amber | `#f59e0b` | Warning log lines |

---

## 11. Side Panel System

The right-side panel (Device Info, Logs) is implemented identically across `audio-dsp.html`, `model-inspector.html`, and `dsp-compute.html`.

### HTML structure

```html
<div id="side-panel" style="display:none;position:fixed;top:0;right:0;height:100%;
     width:360px;background:var(--bg-panel);border-left:1px solid var(--bd);
     z-index:201;flex-direction:column;overflow:hidden;box-shadow:-4px 0 24px rgba(0,0,0,0.5);">
    <div style="padding:16px 20px;border-bottom:1px solid var(--bd);display:flex;
         align-items:center;justify-content:space-between;flex-shrink:0;">
        <div id="panel-title" style="font-size:15px;font-weight:700;color:var(--txt);"></div>
        <button onclick="closePanel()" style="background:none;border:none;color:var(--txt3);
                cursor:pointer;font-size:20px;padding:2px 6px;border-radius:4px;">&#10005;</button>
    </div>
    <div id="panel-body" style="padding:20px;overflow-y:auto;flex:1;"></div>
</div>
```

### Opening and closing

```js
function openPanel(type) {
    const p = document.getElementById('side-panel');
    p.style.display = 'flex';
    if      (type === 'device') loadDevicePanel();
    else if (type === 'logs')   loadLogsPanel();
}
function closePanel() {
    document.getElementById('side-panel').style.display = 'none';
    clearInterval(_logInterval);
}
```

The panel is triggered from nav items:
```html
<a class="nav-item" onclick="openPanel('device')">Device Info</a>
<a class="nav-item" onclick="openPanel('logs')">Logs</a>
```

### `_panelRow(label, value)` — Device Info row helper

Returns one themed key-value row for use inside `loadDevicePanel()`:

```js
function _panelRow(label, value) {
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;
                padding:10px 0;border-bottom:1px solid var(--bd);">
        <span style="color:var(--txt3);font-size:13px;min-width:100px;">${label}</span>
        <span style="color:var(--txt);font-size:13px;font-weight:500;text-align:right;
              word-break:break-all;">${value}</span>
    </div>`;
}
```

### `loadDevicePanel()` — Device Info content

Fetches `GET /device-info` and `GET /sys-uptime`, then renders:
- A header card with board name, SoC, and board image
- `_panelRow()` rows for IP, Port, Uptime, Active Demos
- Optionally a board description card

### `loadLogsPanel()` — Logs content

Fetches `GET /logs` (returns last 80 journal lines) and renders them in a monospace box. Auto-refreshes every 10 seconds via `setInterval`. Log lines are color-coded:
- Red (`#ef4444`) for lines matching `/error/i`
- Amber (`#f59e0b`) for lines matching `/warn/i`
- `var(--txt2)` for all other lines

---

## 12. Built-in REST Endpoints

These are registered by `server.js` itself, independent of any demo plugin.

| Method | Path | Description |
|---|---|---|
| `GET` | `/ping` | Health check — returns `{ ok: true }` |
| `GET` | `/device-info` | Returns `id`, `displayName`, `boards`, `soc`, `activeDemos`, `docs` from device.json |
| `POST` | `/device-config` | Deep-merges body into device.json in memory and on disk |
| `GET` | `/demo-manifests` | Returns array of manifest.json objects for all active demos |
| `GET` | `/model-inspector-list` | Lists `.html` files in `common/app/Model-Inspector/` |
| `POST` | `/upload-model-file?filename=<name>` | Saves raw body as a model HTML file in `Model-Inspector/` |
| `WS` | `/health` | WebSocket health channel — frontend connects here to detect board disconnect |

**Also registered by `cpu-monitor` plugin (always active):**

| Method | Path | Description |
|---|---|---|
| `GET` | `/run-uname` | Returns `uname -a` output |
| `GET` | `/cpu-load` | Returns CPU stats JSON from `cpu_stats enhanced` or `/proc/stat` fallback |
| `GET` | `/cpu-info` | Returns CPU info JSON from `cpu_stats info` |
| `GET` | `/logs` | Returns last N systemd journal lines as `{ lines: [], count: N }` |
| `GET` | `/sys-uptime` | Returns `{ uptime_seconds: N }` from `/proc/uptime` |
| `GET` | `/mem-info` | Returns `{ total_kb: N, available_kb: N }` from `/proc/meminfo` |

---

## 13. Demo-Specific REST and WebSocket Reference

### cpu-monitor (always loaded)

See section 12 above — its endpoints are listed there.

### audio-classification

The visible AM62D GUI remains the existing Audio Classification layout. It
reuses the established device-list, start, stop, and WebSocket contracts, so
the page does not need a second set of controls. On AM62D only, the source
list contains ALSA microphones plus the installed sample WAV:

- Selecting `plughw:C,D` runs `arecord` for the configured duration and then
  passes the captured WAV to the Edge-AI client.
- Selecting `File: input_audio.wav` passes the installed WAV directly to the
  same Edge-AI client.
- The plugin copies `pipeline_speech_classification.json` into a per-run job
  directory, changes only its `input_file`, and runs
  `rpmsg_inference_example <job-json>`.
- Classification records written by the RPMsg client are forwarded on
  WebSocket `/audio` using the same `{ class, timestamp }` shape the GUI
  already consumes.

This path is selected only when `device.id` is `am62dxx`. On every other
device, `/audio-devices`, `audio_utils start_gst`, the FIFO reader, and
GStreamer/NNStreamer behavior remain unchanged.

| Method | Path | Description |
|---|---|---|
| `GET` | `/audio-devices` | AM62D: lists `arecord -l` devices plus the default file; other SoCs: existing `audio_utils devices` output |
| `GET` | `/audio-classification/info` | AM62D configuration: backend, default file, capture duration, and sample rate |
| `POST` | `/upload-audio-classification-file` | AM62D: validates and stores an uploaded WAV; returns `{ path }` |
| `GET` | `/start-audio-classification?device=plughw:X,Y` | AM62D: captures with `arecord` then starts RPMsg; other SoCs: starts `audio_utils` + FIFO |
| `GET` | `/start-audio-classification?device=file:/path/input.wav` | AM62D file-input form used by the unchanged source selector |
| `GET` | `/stop-audio-classification` | Stops the backend selected for the current device |
| `GET` | `/audio-classification/status` | Returns `{ running, backend, result }` |
| `WS` | `/audio` | Sends `{ class, timestamp }` per detection; supports `diagnostic_ping` → `diagnostic_response` |

### audio-offload

| Method | Path | Description |
|---|---|---|
| `GET` | `/audio-offload/run` | Spawns `rpmsg_audio_offload_example`, waits 2s, connects TCP |
| `GET` | `/audio-offload/stop` | Disconnects TCP + sends SIGINT to process group |
| `GET` | `/audio-offload/connect?host=<ip>` | Connects TCP to already-running binary |
| `GET` | `/audio-offload/disconnect` | Closes all four TCP sockets |
| `GET` | `/audio-offload/filter?enable=0\|1` | Sends `SET FFT FILTER 0/1` over command socket |

**WebSocket `/audio-offload`:**

Messages from server → browser:
```jsonc
{ "type": "status",  "state": "connected|disconnected|connecting|error", "message": "..." }
{ "type": "audio",   "channel": "input|output", "pcm": "<base64 S16LE 256 samples>" }
{ "type": "metrics", "frame": 1234, "avgAmp": 900.5, "latency": 1.4, "mode": "DSP",
                     "cpuLoad": 8.2, "dspLoad": 36.1 }
```

Messages from browser → server:
```jsonc
{ "type": "connect",    "host": "127.0.0.1" }
{ "type": "disconnect" }
{ "type": "set_filter", "value": 0 }
{ "type": "set_mode",   "value": "ARM|DSP" }
```

**Audio frame format:** `[4-byte tag "INPT"/"OUTP"][512 bytes S16LE = 256 samples @ 48kHz]`

### 2dfft

| Method | Path | Description |
|---|---|---|
| `GET` | `/2dfft/run` | Spawns `rpmsg_2dfft_example`, streams stdout to WebSocket |
| `GET` | `/2dfft/stop` | SIGTERM to process |

**WebSocket `/2dfft`:**
```jsonc
{ "type": "status", "state": "running|stopped|idle", "message": "..." }
{ "type": "log",    "text": "C7x 2DFFT Test PASSED\n" }
{ "type": "result", "status": "PASSED|FAILED" }
{ "type": "done",   "exitCode": 0, "elapsed": 2304, "status": "PASSED" }
```

### sigchain-biquad

TCP bridge to three ports on `rpmsg_sigchain_biquad_example`:
- 8888: log/status lines
- 8889: command socket
- 8890: performance stats (JSON)

| Method | Path | Description |
|---|---|---|
| `GET` | `/sigchain-biquad/run` | Spawns binary + connects TCP |
| `GET` | `/sigchain-biquad/stop` | Disconnects + sends SIGINT |
| `GET` | `/sigchain-biquad/start-audio` | Sends `START AUDIO` command |
| `GET` | `/sigchain-biquad/stop-audio` | Sends `STOP AUDIO` command |

**WebSocket `/sigchain-biquad`:** Similar pattern to `/audio-offload` — `status`, `log`, `metrics` message types.

### tvm-inference

| Method | Path | Description |
|---|---|---|
| `GET` | `/tvm-inference/run` | Spawns `tvm_inference_client` with artifact path |
| `GET` | `/tvm-inference/status` | Returns `{ running: bool, lastResult: {...} }` |

### speech-to-text (AM62P)

| Method | Path | Description |
|---|---|---|
| `GET` | `/speech-devices` | Lists ALSA capture devices |
| `GET` | `/start-speech-to-text?device=plughw:X,Y` | Spawns `speech_utils start_gst` + FIFO reader |
| `GET` | `/stop-speech-to-text` | Kills pipeline |
| `WS` | `/speech` | Sends `{ type: 'transcript', text, timestamp }` |

### speech-enhancement (AM62D)

| Method | Path | Description |
|---|---|---|
| `GET` | `/speech-devices` | Lists ALSA capture + output devices |
| `POST` | `/upload-speech-enhancement-file` | Saves WAV file for offline processing |
| `GET` | `/start-speech-enhancement?file=...` | Starts the AM62D Edge-AI RPMsg enhancement pipeline |
| `GET` | `/stop-speech-enhancement` | Stops pipeline |
| `WS` | `/speech` | Streams enhanced audio frames |

---

## 14. Native C Utilities Reference

### cpu_stats (`common/linux_app/cpu_stats.c`)

Deployed to `/usr/bin/cpu_stats`.

```bash
# Used by cpu-monitor plugin
cpu_stats enhanced   # JSON with current/avg/max/history, persists state to /tmp/cpu_stats_history.dat
cpu_stats info       # JSON with model name, core count, clock speed
```

Output format for `enhanced`:
```json
{
  "cpu_percent": 34.2,
  "current_cpu_usage": 34.2,
  "average_cpu_usage": 28.1,
  "max_cpu_usage": 67.5,
  "history": [12.3, 45.1, ...]
}
```

Key implementation constants:
- `HISTORY_SIZE = 300` — 5 minutes of samples at 1s interval
- `SPIKE_THRESHOLD = 40%` — for spike detection
- `EMA_ALPHA = 0.5` — exponential moving average smoothing factor

### audio_utils (`common/linux_app/audio_utils.c`, built per-device)

Deployed to `/usr/bin/audio_utils` for the existing non-AM62D Audio
Classification backend (and retained for any other device functions that use
it). AM62D Audio Classification does not invoke these commands.

```bash
audio_utils devices              # Lists ALSA capture and playback devices
audio_utils start_gst plughw:1,0 # Starts GStreamer+NNStreamer YAMNet pipeline, writes to FIFO
audio_utils stop_gst             # Stops pipeline (reads PID from /tmp/audio_classification.pid)
```

On non-AM62D devices the pipeline writes `$`-delimited classification labels
to `/tmp/audio_classification_fifo`. `common/webserver/lib/fifo-reader.js`
reads this FIFO as a child process and forwards JSON to the parent server
process.

### speech_utils (`common/linux_app/speech_utils.c`)

Deployed to `/usr/bin/speech_utils` (AM62P, AM62D).

```bash
speech_utils devices             # Lists ALSA devices
speech_utils start_gst [device]  # Starts GStreamer+ONNX Silero speech-to-text pipeline
speech_utils stop_gst            # Stops pipeline (reads /tmp/speech_classification.pid)
speech_utils status              # Returns running/stopped
```

Pipeline output goes to `/tmp/speech_classification_fifo`, read by `common/webserver/lib/speech-fifo-reader.js`.

---

## 15. Audio Classification Data Flow

The frontend API and WebSocket message format are shared, but the server
selects one of two isolated backend paths.

**AM62D live input:**

```text
Input Device selector (`plughw:C,D`)
        │
        ▼
audio-classification/server-plugin.js
  spawn: rpmsg_inference_example <pipeline.json> --device plughw:C,D
        │ binary opens ALSA device directly (S16LE 16 kHz mono)
        │ reads PCM frames → STFT batches on C7x via RPMsg
        │ TVM/TIDL inference per window
        │ stdout: "[App]   1. <score>  <ClassName>"
        ▼
audio-classification/server-plugin.js (parent process)
        │ WebSocket {class, timestamp}
        ▼
AudioClassification.vue results list
```

**AM62D file input:** Selecting a WAV file spawns
`rpmsg_inference_example <pipeline.json> --input-file <path>` — the binary
reads the file directly, no temp JSON or arecord needed.

**Existing non-AM62D path (unchanged):**

```
audio_utils start_gst plughw:1,0
        │
        ▼
GStreamer pipeline on target:
  alsasrc → audioconvert → tensor_converter
  → tensor_aggregator → tensor_filter (tflite YAMNet)
  → tensor_sink
        │
        │  writes "$"-delimited labels
        ▼
/tmp/audio_classification_fifo  (Linux named pipe)
        │
        │  blocking read
        ▼
common/webserver/lib/fifo-reader.js  (child_process.fork)
        │
        │  newline-delimited JSON on stdout:
        │  {"type":"classification","class":"Speech","timestamp":1234}
        ▼
audio-classification/server-plugin.js (parent process)
        │
        │  WebSocket broadcast
        ▼
Browser  ws://board:3000/audio
        │  receives {"class":"Speech","timestamp":1234}
```

**Debugging tips:**
- Confirm the plugin is enabled: `curl http://<evm-ip>:3000/demo-manifests`
- Confirm source enumeration: `curl http://<evm-ip>:3000/audio-devices`
- Confirm backend selection: `curl http://<evm-ip>:3000/audio-classification/status`
- AM62D: run `arecord -l`; verify `rpmsg_inference_example` and
  `pipeline_speech_classification.json` exist at the configured paths.
- AM62D file smoke test:
  `/usr/bin/rpmsg_inference_example /usr/share/tvm_inference/json/pipeline_speech_classification.json`
- Non-AM62D: run `/usr/bin/audio_utils devices`, check `pgrep audio_utils`,
  and check `/tmp/audio_classification_fifo` after starting.
- For either backend, inspect the webserver journal or `GET /logs` for the
  exact child-process error.

After changing `AudioClassification.vue` or its API helper, rebuild the
frontend before copying files to an EVM. Source `.vue`/`.js` files are not
served by the production webserver:

```bash
cd frontend
VITE_DEVICE=am62dxx npm run build
cd ..
make deploy-app DEVICE=am62dxx BOARD_HOST=root@<evm-ip>
make deploy-server DEVICE=am62dxx BOARD_HOST=root@<evm-ip>
make deploy-bins DEVICE=am62dxx BOARD_HOST=root@<evm-ip>
make deploy-restart BOARD_HOST=root@<evm-ip>
```

For AM62D, `deploy-app` supplies the compiled GUI and `deploy-server` supplies
the Audio Classification plugin, manifest, and device configuration.
`rpmsg_inference_example`, its classification JSON/model artifacts, and
`arecord` come from the EVM image/RPMsg-DMA installation; `deploy-bins` does
not install those RPMsg assets. For non-AM62D devices, the existing
`deploy-bins` flow still supplies `audio_utils`.

---

## 16. Adding a New Demo

### Step 1 — Create the demo directory

```bash
mkdir -p demos/my-demo
```

### Step 2 — Create `demos/my-demo/manifest.json`

```json
{
  "id": "my-demo",
  "name": "My Demo",
  "icon": "av:play-circle",
  "description": "What this demo does in one sentence.",
  "devices": ["am62dxx"],
  "routes": ["/my-demo/run", "/my-demo/stop"],
  "websocket": "/my-demo"
}
```

Use `"devices": ["*"]` to make the demo available on all devices.

### Step 3 — Create `demos/my-demo/server-plugin.js`

Start from the minimal template in [section 8](#8-server-pluginjs-reference) and extend it.

The most important rules:
- Read config from `device.demoConfig['my-demo']` — never hardcode paths
- Implement MOCK mode so `make dev MOCK=1` works
- Register SIGTERM/SIGINT cleanup
- Use `WS_OPEN = 1` instead of `require('ws')`

### Step 4 — Add to `devices/<target>/device.json`

```json
{
  "demos": ["cpu-monitor", "my-demo"],
  "demoConfig": {
    "my-demo": {
      "binPath": "/usr/bin/my_binary",
      "someParam": "value"
    }
  }
}
```

Server auto-loads the plugin at next startup — no changes to `server.js` needed.

### Step 5 — Add frontend UI

**Option A — Add a card to `index.html`** (demo appears on landing page)

Find the demo cards grid and add:
```html
<div class="demo-card" id="card-my-demo">
    <div class="dc-icon">...</div>
    <div class="dc-body">
        <div class="dc-name">My Demo</div>
        <div class="dc-desc">Description text.</div>
    </div>
    <a href="my-demo.html" class="dc-btn">Launch</a>
</div>
```

**Option B — Add a tab to `dsp-compute.html`** (demo appears in the DSP Compute page)

Add a selector item in the left column and a detail panel in the right column. Follow the pattern of the existing audio-offload, 2dfft, sigchain-biquad tabs.

**Option C — Create a new standalone page** (e.g., `my-demo.html`)

Copy `dsp-compute.html` as a starting point and strip the demo-specific content.

### Step 6 — Add sidebar navigation entry

In each page that should show the demo in the sidebar, add a `nav-item` link:

```html
<a class="nav-item" href="my-demo.html">
    <svg>...</svg>
    My Demo
</a>
```

### Step 7 — Test

```bash
# Without board
make dev DEVICE=am62dxx MOCK=1

# With board
make dev DEVICE=am62dxx
# then in another terminal:
make deploy DEVICE=am62dxx BOARD_HOST=root@<ip>
```

---

## 17. Modifying an Existing Demo

### Change a binary path or connection parameter

Edit the relevant `demoConfig` key in `devices/<id>/device.json`. The plugin reads this at startup. If the server is already running, restart it (`systemctl restart webserver-oob`).

Alternatively, use the Settings panel in `dsp-compute.html` — it POSTs to `/device-config` which updates and writes `device.json` live.

### Change what the UI shows for a demo

Edit the relevant section inside the corresponding HTML page:
- Audio offload display → `common/app/dsp-compute.html` (audio-offload panel)
- 2D FFT display → `common/app/dsp-compute.html` (2dfft panel)
- TVM Inference display → `common/app/audio-dsp.html` (tvm-inference tab)
- Audio Classification display → `common/app/audio-dsp.html` (audio-classification tab)
- Speech Enhancement display → `common/app/audio-dsp.html` (speech-enhancement tab)
- Model Inspector → `common/app/model-inspector.html`

Use `make push` to sync the HTML change to the board without rebuilding:
```bash
make push DEVICE=am62dxx BOARD_HOST=root@<ip>
```

### Change a REST endpoint

Edit `demos/<id>/server-plugin.js`. Update `manifest.json` if the route path changes. Deploy with:
```bash
make deploy-server BOARD_HOST=root@<ip>
make deploy-restart BOARD_HOST=root@<ip>
```

### Change a WebSocket message format

Update both sides: `server-plugin.js` (what it broadcasts) and the corresponding HTML page (what the JS client does with the messages). Test with `MOCK=1` first since the mock generates the same message format.

### Add a new metric to an existing demo

Example: add `temperature` to the audio-offload metrics:

1. In `demos/audio-offload/server-plugin.js`, add `temperature` to the `broadcast({ type: 'metrics', ... })` call and to the `LOG_RE` regex that parses binary output.
2. In `common/app/dsp-compute.html`, find where `type === 'metrics'` is handled in the WebSocket `onmessage` handler and read `data.temperature`.
3. Add a display element in the HTML panel and update it in the metrics handler.

### Modify the Device Info or Logs side panel

Both panels are generated by `loadDevicePanel()` and `loadLogsPanel()` JavaScript functions. These are defined near the bottom of the `<script>` block in each HTML file.

Important: always use CSS variables (`var(--txt)`, `var(--bg-inner)`, etc.) in dynamically injected HTML — see [section 10](#10-css-theming-system) for the full list.

---

## 18. Adding a New Device

### Step 1 — Create device directory

```bash
mkdir -p devices/am64xx/app/images
mkdir -p devices/am64xx/linux_app
```

### Step 2 — Create `devices/am64xx/device.json`

Start from the template in [section 6](#6-devicejson-reference). At minimum:
- Set `id` to match the directory name
- List boards with names and image filenames
- List only demos that are actually functional on this device in `demos[]`
- Leave `demoConfig` empty or add only the params the demo plugins need

### Step 3 — Create `devices/am64xx/linux_app/Makefile`

```makefile
include ../../../common/linux_app/Makefile.common

TARGETS = audio_utils

audio_utils: ../../../common/linux_app/audio_utils.c
	$(CC) $(CFLAGS) $< -o $@ $(LDFLAGS) -lasound

all: $(TARGETS)
clean:
	rm -f $(TARGETS)
```

If the device needs a device-specific utility source, place it alongside the Makefile and reference it instead.

### Step 4 — Add board images

Place board photos in `devices/am64xx/app/images/`. Reference them in `device.json` `boards[].image`. These are served as static files overlaid on top of `common/app/`.

### Step 5 — Test locally

```bash
make dev DEVICE=am64xx MOCK=1
```

### Step 6 — Add to Yocto recipe (for production builds)

In `yocto/webserver-oob_git.bb`:

```bitbake
COMPATIBLE_MACHINE = "...|am64xx-evm"

DEVICE_ID:am64xx-evm = "am64xx"

RDEPENDS:${PN}:am64xx-evm = "nodejs"
```

---

## 19. Environment Variables

These are read by `server.js` and the plugins at startup.

| Variable | Default | Description |
|---|---|---|
| `DEVICE_CONFIG` | `<APP_DIR>/device.json` | Absolute path to the device.json to use |
| `APP_DIR` | `common/app` | Directory from which to serve static frontend files |
| `DEMOS_DIR` | `../../demos` (relative to server.js) | Directory containing demo plugin subdirectories |
| `WEBSERVER_DIR` | Directory of server.js | Set automatically; used by plugins to resolve `lib/fifo-reader.js` |
| `PORT` | `3000` | HTTP/WebSocket listen port |
| `MOCK` | (unset) | Set to `1` to activate mock mode in all plugins |

On the board, these are written to `/etc/webserver-oob.conf` by `make deploy-server` and sourced by the systemd service.

To inspect the current config on a running board:

```bash
ssh root@<ip> "cat /etc/webserver-oob.conf"
```

---

## 20. Common Pitfalls and Debugging

### Demo plugin not loading

Check server console output — it logs `[Server] Loaded demo plugin: <id>` or `[Server] Demo plugin not found, skipping: <id>`.

Causes:
- Demo `id` is not in `device.demos[]` in `device.json`
- `demos/<id>/server-plugin.js` does not exist at the path `server.js` is looking in (`DEMOS_DIR`)
- Plugin threw an exception during `require()` — check the error log

### Port 3000 already in use

```bash
fuser -k 3000/tcp   # Linux
```

### Board not auto-discovered by `make deploy`

```bash
make find-board              # runs tools/find-board.sh, shows found IP
make deploy BOARD_HOST=root@192.168.1.100   # override manually
```

### WebSocket `type: 'metrics'` dspLoad shows `--` when value is 0

This is a falsy-value bug. Use a null/undefined check, not a truthy check:

```js
// WRONG — shows '--' when dspLoad is 0
dspLoad ? dspLoad.toFixed(1) + '%' : '--'

// CORRECT
dspLoad != null ? dspLoad.toFixed(1) + '%' : '--'
```

### Side panel background stays dark in light mode

If a panel's background stays black after switching to light mode, inline styles contain hardcoded hex values. JavaScript modifying `element.style` normalizes hex to `rgb()`, breaking `[style*="#hex"]` CSS selectors.

Fix: replace all hardcoded hex colors with CSS variables in the affected JavaScript template literals. See [section 10](#10-css-theming-system).

### Native binary not found on board

The plugin falls back gracefully when `MOCK` is not set and the binary is missing — it logs an error and the REST endpoint returns 500. Check:

```bash
ssh root@<ip> "ls -la /usr/bin/cpu_stats /usr/bin/audio_utils"
```

Redeploy binaries only:

```bash
make deploy-bins DEVICE=am62dxx BOARD_HOST=root@<ip>
```

### Audio classification produces no results

First identify the active backend:

```bash
curl http://127.0.0.1:3000/audio-classification/status
```

For AM62D (`backend: edge-ai-rpmsg`):

1. Verify `arecord -l` lists the selected microphone, or select the default
   file entry to remove capture hardware from the test.
2. Verify `/usr/bin/rpmsg_inference_example` and
   `/usr/share/tvm_inference/json/pipeline_speech_classification.json` exist.
3. Run the classification JSON directly and confirm it prints classification
   records in either JSON form (`{"class":"..."}`) or a supported text form
   such as `Predicted label: ...`.
4. Check `/logs` for `arecord`, DSP-busy, JSON, RPMsg, or TVM errors.

For other devices (`backend: gstreamer`), use the existing checks:

1. Check `/tmp/audio_classification_fifo` exists after starting.
2. Check `pgrep audio_utils` and `pgrep gst-launch`.
3. Verify the selected `plughw:X,Y` value using `/usr/bin/audio_utils devices`.

### rpmsg binary not responding / audio offload stuck

The `rpmsg_audio_offload_example` needs CTRL+C (SIGINT to process group) for graceful teardown. The plugin handles this via `process.kill(-pid, 'SIGINT')`. If the binary appears stuck:

```bash
ssh root@<ip> "pkill -SIGINT rpmsg_audio_offload_example"
```

### Changes to server.js or plugin not reflected on board

Remember the server runs from two locations — `make deploy-server` syncs both:
- `/usr/share/webserver-oob/server/server.js`
- `/usr/lib/node_modules/webserver-oob/server.js` (this is what systemd runs)

If only using `scp` manually, copy to both locations.

### Yocto npm .inc out of date after adding a dependency

After any change to `package.json` or after running `npm install`:

```bash
node tools/generate-inc.js
git add yocto/webserver-oob-npm.inc
```

---

## License

TI Text File License (TI-TFL). See [LICENSE](LICENSE).
