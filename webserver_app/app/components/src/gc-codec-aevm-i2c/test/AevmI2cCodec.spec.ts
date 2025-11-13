import { expect } from 'chai';

import { AevmCodec } from '../../gc-codec-aevm/lib/AevmCodec';
import { codecRegistry } from '../../gc-target-configuration/lib/TargetConfiguration';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { IRegisterInfo } from '../../gc-model-register/lib/IRegisterInfo';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { IUsbPort } from '../../gc-service-usb/lib/ServiceUsb';
import { AevmI2cCodec } from '../lib/AevmI2cCodec';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

['MSP432E'].forEach(deviceName => {
    describe(`Aevm I2C for ${deviceName}`, () => {
        let usbTransport: UsbTransport;
        let aevm: AevmCodec;
        let i2c: AevmI2cCodec;
        let testRegister: IRegisterInfo;

        before(function () {
            if (!processArgs.deviceNames.includes(deviceName)) {
                this.skip();
            }
        });

        before(() => {
            usbTransport = new UsbTransport({
                usb: true,
                filter: (ports: IUsbPort[]): IUsbPort[] => {
                    return ports.filter((port) => port.descriptor?.pnpId?.toLowerCase().includes('vid_0400&pid_2014&mi_00'));
                }
            });
            aevm = new AevmCodec({
                resetControllerOnConnect: true,
                maxOutstandingCommands: 0,
                connectTimeout: 1000
            });
            i2c = new AevmI2cCodec({
                unit: 2,
                pullup: true,
                speed: 100,
                deviceAddress: 0x18,
                readOpcode: 0x10,
                writeOpcode: 0x8
            });
            testRegister = {
                name: 'TestRegister',
                size: 8,
                nBytes: 1,
                addr: 0x20,
                default: 0x00,
                deviceAddrs: '0x18',
                fields: [
                    {
                        start: 0,
                        stop: 1,
                        name: 'TestField',
                        desc: 'TestField description',
                    }
                ]
            };
        });

        after(async () => {
            await usbTransport.disconnect();
            usbTransport.dispose();

            codecRegistry.dispose();   // clear the registery to avoid other tests clashing with this one.
            connectionManager.dispose();   // clear the registery to avoid other tests clashing with this one.
        });

        it('configure', () => {
            expect(() => {
                connectionManager.setActiveConfiguration(`usb+${aevm.id}(${i2c.id})`);
            }).to.not.throw();
            expect(codecRegistry.isActive(aevm.id)).to.be.true;
            expect(codecRegistry.isActive(i2c.id)).to.be.true;
        });

        it('connect', async () => {
            await usbTransport.connect();
            expect(usbTransport.isConnected).to.be.true;
        });

        it('writeValue, readValue', async () => {
            const originalValue = await i2c.readValue(testRegister);
            expect(originalValue, 'first read value').gte(0).lte(0xff);

            const writeValue = originalValue ^ 0x3;
            await i2c.writeValue(testRegister, writeValue);

            const readValue = await i2c.readValue(testRegister);
            expect(readValue).eq(writeValue);

            await i2c.writeValue(testRegister, originalValue);
        });

        it('disconnect', async () => {
            await usbTransport.disconnect();
        });

    });
});
