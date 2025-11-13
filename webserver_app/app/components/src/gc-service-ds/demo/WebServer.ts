/**
 *  Copyright (c) 2021 Texas Instruments Incorporated
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *  *   Redistributions of source code must retain the above copyright
 *  notice, this list of conditions and the following disclaimer.
 *  notice, this list of conditions and the following disclaimer in the
 *  documentation and/or other materials provided with the distribution.
 *  *   Neither the name of Texas Instruments Incorporated nor the names of
 *  its contributors may be used to endorse or promote products derived
 *  from this software without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 *  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 *  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 *  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 *  OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 *  OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 *  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';

import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { dsServiceType, IDebugCore, debugCoreType } from '../../gc-service-ds/lib/DSService';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';

const console = new GcConsole('webserver-demo');
console.setLevel(5);    // set log level 5
const port = 9999;      // webserver port

(async () => {
    /* get the DS Service for target communication */
    const dsService = ServicesRegistry.getService(dsServiceType);

    /* read the ccxml file and the program file */
    const ccxml = fs.readFileSync(path.join(__dirname, '../../../test/assets/MSP432P401R.ccxml'), 'utf-8');
    const program = fs.readFileSync(path.join(__dirname, '../../../test/assets/MSP432P401R_xds_blink.out'));

    /* configure DS service with the ccxml file */
    await dsService.configure(ccxml);

    /* get the first core, connect, load the program, and run */
    const [core] = await dsService.listCores<IDebugCore>(debugCoreType);
    await core.connect();
    await core.loadProgram(program, false);
    await core.run();

    /* create an express instance */
    const app = express();

    /* GET route */
    app.get('/msp432', async (req, res) => {
        const blink = await core.readValue('blink');
        const on = await core.readValue('on');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ blink: blink, on: on }));
    });

    /* POST route */
    app.post('/msp432', bodyParser.json(), async (req, res) => {
        const data = req.body as any;
        const blink = data['blink'];
        if (typeof blink !== 'undefined') {
            await core.writeValue('blink', blink);
        }
        res.end('OK');
    });

    /* start the server */
    app.listen(port, () => {
        console.log(`Server is listening on port: ${port}`);
    });
})();

