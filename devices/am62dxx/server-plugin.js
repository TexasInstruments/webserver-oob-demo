/*
 * Copyright (C) 2026 Texas Instruments Incorporated - http://www.ti.com/
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the
 * distribution.
 *
 * Neither the name of Texas Instruments Incorporated nor the names of
 * its contributors may be used to endorse or promote products derived
 * from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/*
 * AM62D device server plugin.
 * Registers AM62D-specific management API routes.
 * Loaded by common/webserver/server.js when this file exists alongside device.json.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = function(app, wss, device, ctx) {
    const { appDir, deviceConfigPath, express } = ctx;

    /* Prefer device-specific app dir (exists in local dev); fall back to appDir on EVM
     * where both resolve to the same deployed /usr/share/webserver-oob/app path. */
    const deviceAppDir = path.join(path.dirname(deviceConfigPath), 'app');
    const miBaseDir = fs.existsSync(deviceAppDir) ? deviceAppDir : appDir;

    app.use(express.json({ limit: '512kb' }));

    /* Update device config — merges body into in-memory device and writes to disk */
    app.post('/device-config', (req, res) => {
        try {
            const updates = req.body || {};
            if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Invalid body' });
            Object.keys(updates).forEach(k => {
                if (k === 'boards' && Array.isArray(updates.boards)) {
                    device.boards = updates.boards;
                } else if (k === 'demoConfig' && typeof updates.demoConfig === 'object') {
                    device.demoConfig = Object.assign({}, device.demoConfig || {}, updates.demoConfig);
                } else {
                    device[k] = updates[k];
                }
            });
            fs.writeFileSync(deviceConfigPath, JSON.stringify(device, null, 2), 'utf8');
            console.log('[Server] device.json updated via /device-config');
            res.json({ success: true });
        } catch (e) {
            console.error('[Server] /device-config error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    /* List HTML files in Model-Inspector folder for the AI Model Inspector page */
    app.get('/model-inspector-list', (req, res) => {
        const miDir = path.join(miBaseDir, 'Model-Inspector');
        try {
            if (!fs.existsSync(miDir)) return res.json({ files: [] });
            const files = fs.readdirSync(miDir)
                .filter(f => /\.html?$/i.test(f))
                .sort();
            res.json({ files });
        } catch (e) {
            console.error('[Server] /model-inspector-list error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    /* System power control */
    app.post('/system/reboot', (req, res) => {
        console.log('[Server] Reboot requested');
        res.json({ status: 'rebooting' });
        setTimeout(() => exec('reboot'), 500);
    });

    app.post('/system/poweroff', (req, res) => {
        console.log('[Server] Power-off requested');
        res.json({ status: 'powering-off' });
        setTimeout(() => exec('poweroff'), 500);
    });

    /* Upload a model HTML file into the Model-Inspector folder */
    app.post('/upload-model-file',
        express.raw({ type: '*/*', limit: '100mb' }),
        (req, res) => {
            const raw = ((req.query.filename || '') + '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.+/g, '.').slice(0, 120);
            const filename = raw || 'uploaded_model.html';
            const miDir = path.join(miBaseDir, 'Model-Inspector');
            try {
                if (!fs.existsSync(miDir)) fs.mkdirSync(miDir, { recursive: true });
                const dest = path.join(miDir, filename);
                fs.writeFileSync(dest, req.body);
                console.log(`[Server] Model uploaded: ${dest} (${req.body.length} bytes)`);
                res.json({ success: true, filename });
            } catch (e) {
                console.error('[Server] /upload-model-file error:', e);
                res.status(500).json({ error: e.message });
            }
        }
    );
};
