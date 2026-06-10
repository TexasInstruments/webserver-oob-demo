#!/usr/bin/env node

/*
 * Copyright (C) 2024 Texas Instruments Incorporated - http://www.ti.com/
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
 * WebServer OOB - Multi-device plugin loader
 *
 * Reads device.json (path from DEVICE_CONFIG env var or APP_DIR env var),
 * loads one server-plugin.js per demo listed in device.demos[],
 * and exposes GET /device-info for frontend runtime injection.
 */

const express = require('express');
const http    = require('http');
const WebSocket = require('ws');
const fs      = require('fs');
const path    = require('path');

/* ------------------------------------------------------------------ */
/* Config resolution                                                    */
/* ------------------------------------------------------------------ */

/* Expose server dir so plugins can resolve shared lib files (e.g. fifo-reader.js)
 * regardless of where the plugin itself is installed. */
process.env.WEBSERVER_DIR = process.env.WEBSERVER_DIR || __dirname;

const appDir = process.env.APP_DIR || process.argv[2] || path.join(__dirname, '../../common/app');

const deviceConfigPath =
    process.env.DEVICE_CONFIG ||
    path.join(appDir, 'device.json');

if (!fs.existsSync(deviceConfigPath)) {
    console.error(`[Server] device.json not found at: ${deviceConfigPath}`);
    console.error('[Server] Set DEVICE_CONFIG env var or pass app directory as argument');
    process.exit(1);
}

const device = JSON.parse(fs.readFileSync(deviceConfigPath, 'utf8'));
console.log(`[Server] Loaded device config: ${device.id} (${device.displayName})`);
console.log(`[Server] Active demos: ${device.demos.join(', ')}`);

/* ------------------------------------------------------------------ */
/* Express + HTTP + WebSocket server                                   */
/* ------------------------------------------------------------------ */

const app    = express();
const server = http.createServer(app);
const port   = process.env.PORT || 3000;
const wss    = new WebSocket.Server({ server });

/* Serve device-specific static files first (images, overrides), then common app */
const deviceAppDir = path.join(path.dirname(deviceConfigPath), 'app');
if (fs.existsSync(deviceAppDir)) {
    app.use(express.static(deviceAppDir));
    console.log(`[Server] Device app overlay: ${deviceAppDir}`);
}
app.use(express.static(appDir));

/* Device info endpoint — frontend calls this on load */
app.get('/device-info', (req, res) => {
    res.json({
        id:          device.id,
        displayName: device.displayName,
        boards:      device.boards || [],
        soc:         device.soc    || '',
        activeDemos: device.demos  || [],
        docs:        device.docs   || null
    });
});

/* Active demo manifests — merged list of manifest.json for each active demo */
app.get('/demo-manifests', (req, res) => {
    const manifests = [];
    for (const demoId of (device.demos || [])) {
        const mpath = path.join(demosDir, demoId, 'manifest.json');
        if (fs.existsSync(mpath)) {
            try { manifests.push(JSON.parse(fs.readFileSync(mpath, 'utf8'))); }
            catch (e) { console.warn(`[Server] Bad manifest for ${demoId}:`, e.message); }
        }
    }
    res.json(manifests);
});

/* ------------------------------------------------------------------ */
/* Load demo plugins                                                   */
/* ------------------------------------------------------------------ */

const demosDir = process.env.DEMOS_DIR || path.join(__dirname, '../../demos');

for (const demoId of device.demos) {
    const pluginPath = path.join(demosDir, demoId, 'server-plugin.js');
    if (!fs.existsSync(pluginPath)) {
        console.warn(`[Server] Demo plugin not found, skipping: ${demoId} (${pluginPath})`);
        continue;
    }
    try {
        const plugin = require(pluginPath);
        plugin(app, wss, device);
        console.log(`[Server] Loaded demo plugin: ${demoId}`);
    } catch (err) {
        console.error(`[Server] Failed to load demo plugin ${demoId}:`, err);
    }
}

/* ------------------------------------------------------------------ */
/* Cleanup on exit                                                     */
/* ------------------------------------------------------------------ */

function cleanup() {
    console.log('[Server] Shutting down...');
    /* Each plugin registers its own cleanup via process.on if needed */
    process.exit(0);
}

process.on('SIGTERM', cleanup);
process.on('SIGINT',  cleanup);

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

server.listen(port, () => {
    console.log(`[Server] WebServer OOB listening on port ${port}`);
    console.log(`[Server] Serving frontend from: ${appDir}`);
    console.log(`[Server] Device config: ${deviceConfigPath}`);
});
