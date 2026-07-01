/*
 * Copyright (C) 2024 Texas Instruments Incorporated - http://www.ti.com/
 *
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * benchmark demo server plugin
 * Registers: GET /benchmark-data, POST /benchmark-update
 * Supports MOCK=1 env var for development without AM64x hardware.
 *
 * Ported from sitara-apps/benchmark_demo/webserver_app/webserver/benchmark_server.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const MOCK = process.env.MOCK === '1';

const MOCK_DATA = {
    "core0": {
        "input":  { "application": 1, "frequency": 800, "changed": 0 },
        "output": {
            "cpu_load":       { "current": 42, "average": 38, "max": 65 },
            "int_latency":    { "average": 12, "max": 25 },
            "cycles_per_loop":{ "average": 480, "max": 512 },
            "sram_label": "OC-SRAM: 15%",
            "sram": 85
        }
    },
    "core1": {
        "input":  { "application": 2, "frequency": 800, "changed": 0 },
        "output": {
            "cpu_load":       { "current": 55, "average": 50, "max": 72 },
            "int_latency":    { "average": 10, "max": 20 },
            "cycles_per_loop":{ "average": 510, "max": 530 },
            "sram_label": "OC-SRAM: 20%",
            "sram": 80
        }
    },
    "core2": {
        "input":  { "application": 3, "frequency": 800, "changed": 0 },
        "output": {
            "cpu_load":       { "current": 30, "average": 28, "max": 48 },
            "int_latency":    { "average": 14, "max": 28 },
            "cycles_per_loop":{ "average": 460, "max": 490 },
            "sram_label": "OC-SRAM: 10%",
            "sram": 90
        }
    },
    "core3": {
        "input":  { "application": 4, "frequency": 800, "changed": 0 },
        "output": {
            "cpu_load":       { "current": 68, "average": 60, "max": 85 },
            "int_latency":    { "average": 8, "max": 18 },
            "cycles_per_loop":{ "average": 520, "max": 545 },
            "sram_label": "OC-SRAM: 25%",
            "sram": 75
        }
    },
    "a53": {
        "output": {
            "cpu_load":       { "current": 22, "average": 18, "max": 35 },
            "int_latency":    { "average": 5, "max": 10 },
            "cycles_per_loop":{ "average": 200, "max": 220 },
            "sram_label": "OC-SRAM: 5%",
            "sram": 95
        }
    }
};

module.exports = function registerBenchmark(app, wss, device) {

    const demoConfig  = (device.demoConfig || {})['benchmark'] || {};
    const oobDataPath = demoConfig.oobDataPath || resolveOobDataPath();

    /* GET /benchmark-data — returns current oob_data.json contents as JSON */
    app.get('/benchmark-data', (req, res) => {
        if (MOCK) {
            /* Vary mock data slightly each poll to simulate live updates */
            const live = JSON.parse(JSON.stringify(MOCK_DATA));
            ['core0', 'core1', 'core2', 'core3'].forEach(c => {
                if (live[c] && live[c].output && live[c].output.cpu_load) {
                    live[c].output.cpu_load.current = Math.floor(Math.random() * 80) + 10;
                }
            });
            return res.json(live);
        }
        try {
            const data = JSON.parse(fs.readFileSync(oobDataPath, 'utf8'));
            res.json(data);
        } catch (err) {
            console.error('[benchmark] Failed to read oob_data.json:', err.message);
            res.status(500).json({ error: 'Failed to read benchmark data', detail: err.message });
        }
    });

    /* POST /benchmark-update — parses GUI Composer POST body and writes oob_data.json.
     * The GUI Composer POSTs a raw body in the form used by the original benchmark_server.js.
     * The regex split is preserved as-is from the original. */
    app.post('/benchmark-update', (req, res) => {
        if (MOCK) {
            return res.status(200).end('ok (MOCK)');
        }
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                /* Parse the json data into an array using a regex, filter empty entries */
                const fixed_data = body.split(/{?"?([A-Za-z0-9_]+)"?:?}*/).filter(n => n);

                /* Read current state */
                let json_obj = JSON.parse(fs.readFileSync(oobDataPath, 'utf8'));

                /* Update the json object with the newly received data */
                /* Helper to set a nested key using dot-path */
                function setPath(obj, keys, value) {
                    let cur = obj;
                    for (let i = 0; i < keys.length - 1; i++) {
                        if (!cur[keys[i]]) cur[keys[i]] = {};
                        cur = cur[keys[i]];
                    }
                    cur[keys[keys.length - 1]] = value;
                }

                /* First core */
                setPath(json_obj, [fixed_data[0], fixed_data[1], fixed_data[2]], Number(fixed_data[3]));
                setPath(json_obj, [fixed_data[4], fixed_data[5], fixed_data[6]], Number(fixed_data[7]));
                setPath(json_obj, [fixed_data[0], fixed_data[1], 'changed'], 1);

                /* Second core */
                setPath(json_obj, [fixed_data[8],  fixed_data[9],  fixed_data[10]], Number(fixed_data[11]));
                setPath(json_obj, [fixed_data[12], fixed_data[13], fixed_data[14]], Number(fixed_data[15]));
                setPath(json_obj, [fixed_data[8],  fixed_data[9],  'changed'], 1);

                fs.writeFileSync(oobDataPath, JSON.stringify(json_obj, null, 2), 'utf8');

                res.end(body);
            } catch (error) {
                console.error('[benchmark] POST /benchmark-update error:', error.message);
                res.statusCode = 400;
                res.end(error.toString());
            }
        });
    });

    console.log('[benchmark] Plugin registered' + (MOCK ? ' (MOCK mode)' : '') + ' oob_data: ' + oobDataPath);
};
