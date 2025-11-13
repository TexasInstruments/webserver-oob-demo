import { expect } from 'chai';

import { Usb2anyCodec } from '../../gc-codec-usb2any/lib/Usb2anyCodec';
import { codecRegistry } from '../../gc-target-configuration/lib/TargetConfiguration';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { IRegisterInfo } from '../../gc-model-register/lib/IRegisterInfo';
import { Usb2anyPowerCodec } from '../../gc-codec-usb2any-power/lib/Usb2anyPowerCodec';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { Usb2anySpiCodec } from '../lib/Usb2anySpiCodec';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

['TMP117'].forEach(deviceName => {
    describe(`Usb2any SPI for ${deviceName}`, () => {
        let usbTransport: UsbTransport;
        let usb2any: Usb2anyCodec;
        let power: Usb2anyPowerCodec;
        let spi: Usb2anySpiCodec;
        let testRegister: IRegisterInfo;

        before(function() {
            if (!processArgs.deviceNames.includes(deviceName)) {
                this.skip();
            }
        });

        before(() => {
            usbTransport = new UsbTransport({ hid: true });
            usb2any = new Usb2anyCodec({
                connectTimeout: 100
            });
            power = new Usb2anyPowerCodec({
                v33: true
            });
            spi = new Usb2anySpiCodec({
                clockPhase: 'first',
                clockPolarity: 'high',
                bitDirection: 'msb',
                characterLength: 8,
                latchType: 'packet',
                latchPolarity: 'low',
                clockDivider: 6
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
                connectionManager.setActiveConfiguration(`usb+${usb2any.id}(${power.id},${spi.id})`);
            }).to.not.throw();
        });

        it('connect', async () => {
            await usbTransport.connect();
            expect(usbTransport.isConnected).to.be.true;
            expect(codecRegistry.isActive(usb2any.id)).to.be.true;
            expect(codecRegistry.isActive(spi.id)).to.be.true;
        });

        it('read, write', async () => {
            const readValue = await spi.readValue(testRegister);
            await spi.writeValue(testRegister, readValue);
        });

        it('disconnect', async () => {
            await usbTransport.disconnect();
        });

    });
});
