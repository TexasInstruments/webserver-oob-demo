#!/usr/bin/env node

/*
 * Copyright (C) 2024 Texas Instruments Incorporated - http://www.ti.com/
 *
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * speech-fifo-reader.js — FIFO reader for speech_utils transcript output.
 *
 * speech_utils writes one transcript line per flush to FIFO_PATH.
 * This child process reads lines and emits newline-delimited JSON on stdout:
 *   {type: 'transcript', text: string, timestamp: number}
 *   {type: 'status',     message: string}
 *   {type: 'error',      message: string}
 */

const fs       = require('fs');
const readline = require('readline');

const fifoPath = process.env.FIFO_PATH || '/tmp/speech_classification_fifo';

process.stdout.write(JSON.stringify({
    type: 'status',
    message: 'Speech FIFO reader process started'
}) + '\n');

function startReading() {
    try {
        if (!fs.existsSync(fifoPath)) {
            process.stdout.write(JSON.stringify({
                type: 'error',
                message: 'FIFO does not exist, waiting...'
            }) + '\n');
            setTimeout(startReading, 1000);
            return;
        }

        /* Open FIFO — blocks until writer connects */
        const stream = fs.createReadStream(fifoPath, {
            encoding: 'utf8',
            highWaterMark: 256
        });

        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

        rl.on('line', (line) => {
            const text = line.trim();
            if (text) {
                process.stdout.write(JSON.stringify({
                    type:      'transcript',
                    text:      text,
                    timestamp: Date.now()
                }) + '\n');
            }
        });

        stream.on('end', () => {
            process.stdout.write(JSON.stringify({
                type: 'status',
                message: 'FIFO closed, restarting...'
            }) + '\n');
            rl.close();
            setTimeout(startReading, 500);
        });

        stream.on('error', (err) => {
            process.stdout.write(JSON.stringify({
                type: 'error',
                message: err.message
            }) + '\n');
            rl.close();
            setTimeout(startReading, 1000);
        });

    } catch (err) {
        process.stdout.write(JSON.stringify({
            type: 'error',
            message: 'Fatal error: ' + err.message
        }) + '\n');
        setTimeout(startReading, 1000);
    }
}

process.on('SIGTERM', () => {
    process.stdout.write(JSON.stringify({
        type: 'status',
        message: 'Speech FIFO reader shutting down'
    }) + '\n');
    process.exit(0);
});

process.on('SIGINT', () => { process.exit(0); });

startReading();
