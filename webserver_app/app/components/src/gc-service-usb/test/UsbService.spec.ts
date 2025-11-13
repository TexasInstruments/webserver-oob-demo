import '../../gc-core-assets/lib/NodeJSEnv';
import { expect } from 'chai';
import { processArgs } from '../../gc-core-assets/test/TestArgs';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { usbSerialPortType, usbHidPortType, usbServiceType, deviceAttachedEventType, deviceDetachedEventType } from '../lib/ServiceUsb';

/** Enabled Logging *********************************************************************************************************** */
GcConsole.setLevel('usbService', processArgs.enableLog);
/** *************************************************************************************************************************** */

[{ deviceName: 'MSP432P401R', vendorId: 0x0451, productId: 0xbef3 }].forEach( ({ deviceName, vendorId, productId }) => {

    describe(`UsbService for ${deviceName}`, () => {
        const usbService = ServicesRegistry.getService(usbServiceType);

        before(async function() {
            if (!processArgs.deviceNames.includes(deviceName)) this.skip();
        });

        it('listPorts', async function () {
            const ports = await usbService.listPorts(usbSerialPortType);
            const serialUsbPorts = usbService.filterPortsByDescriptorInfo(ports, { vendorId, productId });

            expect(serialUsbPorts).to.exist;
            expect(serialUsbPorts.length).gte(2);
        });

        it('listDevices', async function () {
            const devices = await usbService.listDevices();
            expect(devices).length.greaterThan(0);
        });

        it('getDefaultPort', function(done) {
            (async () => {
                const serialUsbPorts = (await usbService.listPorts(usbSerialPortType));
                const defaultSerialUsbPort = await usbService.getDefaultPort(serialUsbPorts, 'MSP432P401R');
                defaultSerialUsbPort ? done() : done('No default port found');
            })();
        });

        it('deviceDetection', function(done) {
            this.skip(); // TODO: need to find a way to enable or disable usb device

            (async () => {
                let attached = false, detached = false;
                const veirfyDone = () => {
                    if (attached && detached)
                        done();
                };

                usbService.addEventListener(deviceAttachedEventType, (detail) => {
                    attached = true;
                    veirfyDone();
                });

                usbService.addEventListener(deviceDetachedEventType, (detail) => {
                    detached = true;
                    veirfyDone();
                });
            })();
        });

        it('filtering hid ports by vendor id', async function() {
            if (!processArgs.deviceNames.includes('TMP117')) {  // this test requires two devices: a TMP117 and another DUT.
                this.skip();
            }

            const USB2ANY_VENDOR_ID = 0x2047;
            const USB2ANY_PRODUCT_ID = 0x0301;

            // test we have found at least one TMP117 device.
            let u2aPorts = await usbService.listPorts(usbHidPortType);
            let count = u2aPorts.length;
            u2aPorts.filter( port => port.type === usbHidPortType );
            expect(u2aPorts.length, 'filter by hid type failed').to.equal(count);
            u2aPorts = usbService.filterPortsByDescriptorInfo(u2aPorts, { vendorId: USB2ANY_VENDOR_ID });
            expect(u2aPorts.length, 'filter by vendor id failed').to.equal(count);
            u2aPorts = usbService.filterPortsByDescriptorInfo(u2aPorts, { productId: USB2ANY_PRODUCT_ID });
            expect(u2aPorts.length, 'failed to find USB2ANY hid port').gte(1);

            // test we have one other device that also has found an hid port.
            let evmPorts = await usbService.listPorts(usbHidPortType, vendorId);
            count = evmPorts.length;
            evmPorts.filter( port => port.type === usbHidPortType );
            expect(evmPorts.length, 'filter by hid type failed').to.equal(count);
            evmPorts = usbService.filterPortsByDescriptorInfo(evmPorts, { vendorId });
            expect(evmPorts.length, 'filter by vendor id failed').to.equal(count);
            evmPorts = usbService.filterPortsByDescriptorInfo(evmPorts, { productId });
            expect(evmPorts.length, `failed to find ${deviceName}'s hid port`).gte(1);

            // redo finding the TMP117 hid port
            let hidPorts = await usbService.listPorts(usbHidPortType, USB2ANY_VENDOR_ID);
            hidPorts = usbService.filterPortsByDescriptorInfo(hidPorts, { productId: USB2ANY_PRODUCT_ID });
            expect(hidPorts.length, 'failed to find USB2ANY hid port').gte(1);

            // ensure the before and after TMP117 ports are identical in all ways
            expect(hidPorts.length).to.equal(u2aPorts.length);
            expect(hidPorts[0].isEqual(u2aPorts[0])).to.be.true;
            expect(hidPorts[0] === u2aPorts[0]).to.be.true;

            await u2aPorts[0].open();
            expect(hidPorts[0].isOpened).to.be.true;
            await u2aPorts[0].close();
        });
    });
});