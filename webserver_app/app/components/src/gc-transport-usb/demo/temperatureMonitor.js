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

const nlibPrefix = "../../../@ti-Nlibs/"; // adjust the prefix if this file is relocated

const { JsonCodec } = require(nlibPrefix + 'gc-codec-json/lib/JsonCodec');
const { DelimitedTextCodec } = require(nlibPrefix + 'gc-codec-delimited-text/lib/DelimitedTextCodec');
const { UsbTransport } = require(nlibPrefix + 'gc-transport-usb/lib/UsbTransport');
const { StreamingDataModel } = require(nlibPrefix + 'gc-model-streaming/lib/StreamingDataModel');
const { connectionManager, connectionLogEventType } = require(nlibPrefix + 'gc-target-connection-manager/lib/ConnectionManager');
const { streamingDataEventType, bindingRegistry } = require(nlibPrefix + 'gc-core-databind/lib/CoreDatabind');
const { TargetProgramLoader } = require(nlibPrefix + 'gc-target-program-loader/lib/TargetProgramLoader');

/* eslint-disable no-console */

(async function run() {
    try {
        const deviceName = process.argv[2] || 'MSP430F5529';
        const connectionId = process.argv[3] || (deviceName.toUpperCase().indexOf('MSP430') === 0 ? 'TI MSP430 USB1' : 'Texas Instruments XDS110 USB Debug Probe');
        const outFileName = process.argv[3] || (deviceName === 'MSP430F5529' ? 'ReadLEDsAndTempJSON_5529.hex' : '');

        connectionManager.addEventListener(connectionLogEventType, (details) => {
            switch (details.type) {
                case 'info':
                    console.info(details.message);
                    break;
                case 'warning':
                    console.warn(details.message);
                    break;
                case 'error':
                    console.error(details.message);
                    break;
            }
        });

        new JsonCodec({});
        new DelimitedTextCodec({ id: 'cr', delimiter: '\n' });
        const usbTransport = new UsbTransport({ deviceName: deviceName, usb: true });
        new StreamingDataModel({ id: 'model' });
        if (outFileName) {
            new TargetProgramLoader({ autoProgram: true, deviceName: deviceName, optional: true, connectionName: connectionId, programOrBinPath: outFileName });
        }

        connectionManager.setActiveConfiguration('usb+cr+json+model');

        const bind = bindingRegistry.getBinding('model.temp.$dec1');
        if (!bind) {
            throw 'Error: missing binding="model.temp"';
        }
        bind.addEventListener(streamingDataEventType, async (details) => {
            console.log(`Temperature = ${bind.getValue()}` + String.fromCharCode(0xB0) + 'F');
        });

        await connectionManager.connect();

        const exitHandler = async () => {
            await usbTransport.disconnect();
            process.exit();
        };
        process.on('SIGINT', exitHandler);

    } catch (e) {
        console.error(e);
        process.exit();
    }
})();



