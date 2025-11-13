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

const { USB2ANY } = require(nlibPrefix + "gc-codec-usb2any/lib/Usb2anyCodec");
const { I2CInterface } = require(nlibPrefix + "gc-codec-usb2any/lib/I2CInterface");
const { PowerInterface } = require(nlibPrefix + "gc-codec-usb2any/lib/PowerInterface");

const { CodecRegistry } = require(nlibPrefix + "gc-target-configuration/lib/TargetConfiguration");

const { UsbTransport } = require(nlibPrefix + "gc-transport-usb/lib/UsbTransport");

(async function run() {

    try {
        let usbTransport;
        let u2aId;
        let u2a;
        let u2aParams;
        let power;
        let powerParams;
        let i2c;
        let i2cParams;
        let regOffsetTemp;

        // Press Ctrl-C or equivalent to kill this run
        let exitHandler = async () => {
            console.log('running exitHandler')
            try {
                if (usbTransport && usbTransport.isConnected()) {
                    await usbTransport.disconnect();
                }
            } catch (e) {
                console.error(e);
            }
            process.exit();
        };
        process.on('SIGINT', exitHandler);

        // convert elapsed time to milliseconds
        let t0, t1; // time start and end
        let timeMsg = (x) => ' [' + (x[0] * 1e3 + x[1] / 1e6) + ' ms]'

        // create system
        t0 = process.hrtime();
        // create usb
        usbTransport = new UsbTransport({ hid: true });
        // create u2a
        u2aId = 'myu2a';
        u2aParams = {
            // id: optional, default to 'u2a'
            id: u2aId,
            connectReqTimeout: 100
        };
        u2a = new USB2ANY(u2aParams);
        // create power
        powerParams = {
            // id: optional, default to 'power'
            'V3.3': true,
            'V5.0': false,
            'Vadj': false
        };
        power = new PowerInterface(powerParams);
        // creae i2c
        i2cParams = {
            // id: optional, default to 'i2c'
            pullup: true,
            addressBits: 7,
            speed: 400,
            deviceAddress: 0x48
        };
        i2c = new I2CInterface(i2cParams);

        // a register from tmp117 register.json
        regOffsetTemp = {
            name: 'OFFSET_TEMP',
            size: 16,
            nBytes: 2,
            addr: 0x07,
            mode: 'RW',
            value: 0x0000,
            default: 0x8000,
            // "title": "Temperature Offset",
            fields: [
                {
                    start: 0,
                    stop: 15,
                    name: 'OFFSETTEMP',
                    default: 0,
                    type: 'q7',
                    desc: 'This 16 bit register is to be used as a user-defined temperature offset register during system calibration. The offset will be added to the temperature result after linearization. It has a same resolution of 7.8125m°C and same range of +/-256°C as the temperature result register. If added result is out of boundary, then the temperature result will show as the maximum or minimum value.',
                }
            ]
        };
        t1 = process.hrtime(t0);
        console.log('create system', timeMsg(t1));

        // configure system
        // usb + u2a (power,i2c)
        t0 = process.hrtime();
        CodecRegistry.configure('usb+' + u2aId + '(power,i2c)');
        t1 = process.hrtime(t0);
        console.log('configure system', timeMsg(t1));

        // system connect
        console.log('connecting target ...');
        t0 = process.hrtime();
        await usbTransport.connect();
        t1 = process.hrtime(t0);
        console.log('target connected', timeMsg(t1), '\n');

        // i2c readValue, writeValue
        t0 = process.hrtime();
        const originalValue = await i2c.readValue(regOffsetTemp);
        t1 = process.hrtime(t0);
        console.log('i2c read register', regOffsetTemp.name, originalValue, timeMsg(t1));

        const writeValue = originalValue ^ 0xef;
        t0 = process.hrtime();
        await i2c.writeValue(regOffsetTemp, writeValue);
        t1 = process.hrtime(t0);
        console.log('i2c write register', regOffsetTemp.name, writeValue, timeMsg(t1));


        // i2c multiple register read
        // tmp117 registers address 0x0 to 0xf. It is an internal loop of readValue when sequentialRead false.
        // If hw supports sequential read, set i2cParams.sequentialRead to true
        const startRegInfo = {
            addr: 0x0,
            nBytes: 2,
            name: 'start of registers',
            fields: []
        };
        const regCount = 16;
        t0 = process.hrtime();
        const readValues = await i2c.multiRegisterRead(startRegInfo, regCount);
        t1 = process.hrtime(t0);
        console.log('i2c multiRegisterRead registers count ', readValues.length, timeMsg(t1));
        if (readValues.length < 20) console.log('    ', readValues);
        else console.log('    [', readValues[0], ',...,', readValues[readValues.length - 1], ']')

        // system disconnect
        t0 = process.hrtime();
        usbTransport.isConnected() && await usbTransport.disconnect();
        t1 = process.hrtime(t0);
        console.log('\ntarget disconnected', timeMsg(t1));


    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
})();



