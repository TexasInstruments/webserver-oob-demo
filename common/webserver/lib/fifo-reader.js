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
 * FIFO Reader Process - Blocking I/O for Real-time Audio Classification
 * This runs as a child process to handle blocking FIFO reads without
 * affecting the main webserver's responsiveness.
 *
 * Protocol: reads $-delimited classification strings from the FIFO.
 * Sends newline-delimited JSON to parent via stdout:
 *   {type: 'classification', class: string, timestamp: number}
 *   {type: 'status',         message: string}
 *   {type: 'error',          message: string}
 */

const fs       = require('fs');
const readline = require('readline');

const fifoPath = process.env.FIFO_PATH || '/tmp/audio_classification_fifo';

process.stdout.write(JSON.stringify({
    type: 'status',
    message: 'FIFO reader process started'
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

        /* Open FIFO — blocks until a writer connects */
        const stream = fs.createReadStream(fifoPath, {
            encoding: 'utf8',
            highWaterMark: 128
        });

        /* readline interface kept for graceful EOF handling */
        const rl = readline.createInterface({
            input: stream,
            crlfDelay: Infinity
        });

        let buffer = '';

        stream.on('data', (chunk) => {
            buffer += chunk;

            /* Process all complete classifications (dollar-delimited) */
            let dollarIndex;
            while ((dollarIndex = buffer.indexOf('$')) !== -1) {
                const classification = buffer.substring(0, dollarIndex).trim();
                buffer = buffer.substring(dollarIndex + 1);

                if (classification) {
                    process.stdout.write(JSON.stringify({
                        type:      'classification',
                        class:     classification,
                        timestamp: Date.now()
                    }) + '\n');
                }
            }
        });

        stream.on('end', () => {
            process.stdout.write(JSON.stringify({
                type: 'status',
                message: 'FIFO closed, restarting...'
            }) + '\n');
            setTimeout(startReading, 500);
        });

        stream.on('error', (err) => {
            process.stdout.write(JSON.stringify({
                type: 'error',
                message: err.message
            }) + '\n');
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
        message: 'FIFO reader shutting down'
    }) + '\n');
    process.exit(0);
});

process.on('SIGINT', () => { process.exit(0); });

startReading();
