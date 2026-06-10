/*
 * Copyright (C) 2024 Texas Instruments Incorporated - http://www.ti.com/
 *
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * cpu-monitor demo server plugin
 * Registers: GET /run-uname, GET /cpu-load, GET /cpu-info
 * Supports MOCK=1 env var for development on x86 without target binaries.
 */

'use strict';

const { exec } = require('child_process');

const MOCK = process.env.MOCK === '1';

module.exports = function registerCpuMonitor(app, wss, device) {

    /* System info */
    app.get('/run-uname', (req, res) => {
        if (MOCK) {
            return res.send('Linux mock-device 6.1.0-mock #1 SMP PREEMPT Thu Jan 1 00:00:00 UTC 2024 armv7l armv7l GNU/Linux');
        }
        exec('uname -a', (error, stdout) => {
            if (error) {
                console.error('[cpu-monitor] uname error:', error);
                return res.status(500).send(error.message);
            }
            res.send(stdout);
        });
    });

    /* CPU load — returns JSON produced by cpu_stats enhanced */
    app.get('/cpu-load', (req, res) => {
        if (MOCK) {
            const load = (20 + Math.random() * 60).toFixed(1);
            return res.send(JSON.stringify({
                cpu_percent: parseFloat(load),
                history: Array.from({length: 10}, () => parseFloat((Math.random() * 80).toFixed(1)))
            }));
        }
        exec('/usr/bin/cpu_stats enhanced', (error, stdout) => {
            if (error) {
                console.error('[cpu-monitor] cpu_stats error:', error);
                return res.status(500).send(error.message);
            }
            res.send(stdout);
        });
    });

    /* CPU info — returns JSON produced by cpu_stats info */
    app.get('/cpu-info', (req, res) => {
        if (MOCK) {
            return res.send(JSON.stringify({
                model:   device.soc || 'Mock SoC',
                cores:   1,
                threads: 1,
                mhz:     1000
            }));
        }
        exec('/usr/bin/cpu_stats info', (error, stdout) => {
            if (error) {
                console.error('[cpu-monitor] cpu_stats info error:', error);
                return res.status(500).send(error.message);
            }
            res.send(stdout);
        });
    });

    console.log('[cpu-monitor] Plugin registered' + (MOCK ? ' (MOCK mode)' : ''));
};
