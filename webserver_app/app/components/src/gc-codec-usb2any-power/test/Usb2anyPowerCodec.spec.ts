import { expect } from 'chai';

import { Usb2anyCodec } from '../../gc-codec-usb2any/lib/Usb2anyCodec';
import { codecRegistry } from '../../gc-target-configuration/lib/TargetConfiguration';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { Usb2anyPowerCodec } from '../lib/Usb2anyPowerCodec';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

['TMP117'].forEach(deviceName => {
    describe(`Usb2any Power for ${deviceName}`, () => {
        let usbTransport: UsbTransport;
        let usb2any: Usb2anyCodec;
        let power: Usb2anyPowerCodec;

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
        });

        after(async () => {
            await usbTransport.disconnect();
            usbTransport.dispose();

            codecRegistry.dispose();   // clear the registery to avoid other tests clashing with this one.
            connectionManager.dispose();   // clear the registery to avoid other tests clashing with this one.
        });

        it('configure', () => {
            expect(() => {
                connectionManager.setActiveConfiguration(`usb+${usb2any.id}+${power.id}`);
            }).to.not.throw();
        });

        it('connect', async () => {
            await usbTransport.connect();
            expect(usbTransport.isConnected).to.be.true;
            expect(codecRegistry.isActive(usb2any.id)).to.be.true;
            expect(codecRegistry.isActive(power.id)).to.be.true;
        });

    });
});
