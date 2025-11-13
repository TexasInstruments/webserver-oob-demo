import { expect } from 'chai';

import { Usb2anyCodec, calculateCRC } from '../../gc-codec-usb2any/lib/Usb2anyCodec';
import { codecRegistry } from '../../gc-target-configuration/lib/TargetConfiguration';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { IRegisterInfo } from '../../gc-model-register/lib/IRegisterInfo';
import { Usb2anyPowerCodec } from '../../gc-codec-usb2any-power/lib/Usb2anyPowerCodec';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { Usb2anyI2cCodec } from '../lib/Usb2anyI2cCodec';
import { processArgs } from '../../gc-core-assets/test/TestArgs';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';

GcConsole.setLevel('gc-codec-usb2any', processArgs.enableLog);

class TestController extends Usb2anyCodec {
    // Test controller to inject error responses for test purposes
    errorResponseCode: number[] = [];
    protected decodePacket(packet: number[]): boolean | Error {
        if (this.errorResponseCode.length > 0) {
            packet = [ 0x54, 0, 0, 3, 0, packet[5], this.errorResponseCode.pop()!, packet[7] ];
            packet[1] = calculateCRC(packet, 2, 8);
        }
        return super.decodePacket(packet);
    }
}

['TMP117'].forEach(deviceName => {
    describe(`Usb2any I2C for ${deviceName}`, () => {
        let usbTransport: UsbTransport;
        let usb2any: TestController;
        let power: Usb2anyPowerCodec;
        let i2c: Usb2anyI2cCodec;
        let testRegister: IRegisterInfo;

        before(function() {
            if (!processArgs.deviceNames.includes(deviceName)) {
                this.skip();
            }
        });

        before(() => {
            usbTransport = new UsbTransport({ hid: true });
            usb2any = new TestController({
                connectTimeout: 100
            });
            power = new Usb2anyPowerCodec({
                v33: true
            });
            i2c = new Usb2anyI2cCodec({
                pullup: true,
                addressBits: 7,
                speed: 400,
                deviceAddress: 0x48
            });
            testRegister = {
                name: 'TestRegister',
                size: 16,
                nBytes: 2,
                addr: 0x07,
                default: 0x8000,
                fields: [
                    {
                        start: 0,
                        stop: 15,
                        name: 'TestField',
                        type: 'q7',
                        desc: 'A field'
                    }
                ]
            };
        });

        after(async () => {
            await usbTransport.disconnect();
            usbTransport.dispose();

            codecRegistry.dispose();   // clear the registry to avoid other tests clashing with this one.
            connectionManager.dispose();   // clear the registry to avoid other tests clashing with this one.
        });

        it('configure', () => {
            expect(() => {
                connectionManager.setActiveConfiguration(`usb+${usb2any.id}(${power.id},${i2c.id})`);
            }).to.not.throw();
        });

        it('connect', async function() {
            this.timeout(4000);
            await usbTransport.connect();
            expect(usbTransport.isConnected).to.be.true;
            expect(codecRegistry.isActive(usb2any.id)).to.be.true;
            expect(codecRegistry.isActive(i2c.id)).to.be.true;
        });

        it('writeValue, readValue', async () => {
            const originalValue = await i2c.readValue(testRegister);
            expect(originalValue, 'first read value').gte(0).lte(0xffff);

            const writeValue = originalValue ^ 0xef;
            await i2c.writeValue(testRegister, writeValue);

            const readValue = await i2c.readValue(testRegister);
            expect(readValue).eq(writeValue);

            await i2c.writeValue(testRegister, originalValue);
        });

        it('multiRegisterRead, 16 registers, internal loop of readValue', async () => {
            // tmp117 registers address 0x0 to 0xf. It is an internal loop of readValue when sequentialRead false.
            // If hw supports sequential read, we need to add another test case.
            const startRegInfo = {
                addr: 0x0,
                nBytes: 2,
                name: 'start of registers',
                fields: []
            };
            const regCount = 16;
            const readValues = await i2c.multiRegisterRead(startRegInfo, regCount);
            expect(readValues.length).eq(regCount);
        });

        it('retry once on error response', async () => {
            let value = 0;
            usb2any.errorResponseCode.push(0xd2); // Read timeout
            try {
                value = await i2c.readValue(testRegister);
                expect(value, 'retry once read value').gte(0).lte(0xffff);
            } catch (e) {
                expect(e.message || e.toString()).to.not.exist;
            }

            usb2any.errorResponseCode.push(0xd3);  // Data NAK
            usb2any.errorResponseCode.push(0xd4);  // Address NAK

            try {
                expect(await i2c.readValue(testRegister)).to.not.exist;
            } catch (e) {
                expect(e.message || e.toString()).to.equal('Data not acknowledged (NAK)');
            }

            // make sure we disconnect after retrying twice with two errors in a row.
            await GcUtils.delay(1);
            expect(usbTransport.isConnected).to.be.false;
        });

        it('disconnect', async () => {
            await usbTransport.disconnect();
            expect(usbTransport.isDisconnected).to.be.true;
        });

    });
});
