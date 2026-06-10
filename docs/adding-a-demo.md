# Adding a New Demo

## Step 1: Create demo directory

```bash
mkdir -p demos/<id>
```

Where `<id>` is a short lowercase slug, e.g. `cpu-monitor`, `audio-classification`.

## Step 2: Create `demos/<id>/manifest.json`

```json
{
  "id": "<id>",
  "name": "My Demo",
  "description": "What this demo does.",
  "devices": ["*"],
  "routes": ["/my-endpoint"],
  "websocket": "/my-ws"
}
```

Use `"devices": ["*"]` for all devices, or list specific IDs like `["am335x", "am62xx"]`.

## Step 3: Create `demos/<id>/server-plugin.js`

```js
'use strict';

const { exec } = require('child_process');
const MOCK = process.env.MOCK === '1';

module.exports = function registerMyDemo(app, wss, device) {
    const demoConfig = (device.demoConfig || {})['<id>'] || {};

    app.get('/my-endpoint', (req, res) => {
        if (MOCK) {
            return res.json({ value: 42 });
        }
        exec('/usr/bin/my_util', (err, stdout) => {
            if (err) return res.status(500).send(err.message);
            res.send(stdout);
        });
    });

    // WebSocket handler (optional)
    wss.on('connection', (ws, req) => {
        if (req.url !== '/my-ws') return;
        // handle ws
    });

    console.log('[<id>] Plugin registered' + (MOCK ? ' (MOCK)' : ''));
};
```

Key rules:
- Always export a single `function(app, wss, device)`
- Support `MOCK=1` env var for dev testing
- Read `device.demoConfig['<id>']` for device-specific tuning (model paths, etc.)
- Register any process cleanup via `process.on('SIGTERM', ...)` inside the plugin

## Step 4: Add demo to target devices

In `devices/<target>/device.json`, add the demo id to `demos[]`:

```json
{
  "demos": ["cpu-monitor", "<id>"],
  "demoConfig": {
    "<id>": { "someParam": "value" }
  }
}
```

That's it — `server.js` auto-loads the plugin at startup.

## Step 5: Add frontend tab (in `common/app/index.html`)

Add a vtab element with a matching id so the device-info visibility logic works:

```html
<ti-widget-vtab id="ti_widget_vtab_<id>" name="My Demo" icon="...">
    <!-- demo content -->
</ti-widget-vtab>
```

And add the id to the `demoVtabMap` in the `WebComponentsReady` inline script:

```js
var demoVtabMap = {
    'audio-classification': 'ti_widget_vtab_audio_classification',
    '<id>': 'ti_widget_vtab_<id>'
};
```

## Step 6: Test

```bash
make dev DEVICE=am335x MOCK=1   # test without target
make dev DEVICE=am335x          # test with target binaries (local)
make deploy DEVICE=am335x BOARD_HOST=root@<ip>  # deploy
```
