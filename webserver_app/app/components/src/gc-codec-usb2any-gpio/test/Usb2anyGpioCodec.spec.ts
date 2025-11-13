import { expect } from 'chai';

import { Usb2anyCodec } from '../../gc-codec-usb2any/lib/Usb2anyCodec';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { Usb2anyPowerCodec } from '../../gc-codec-usb2any-power/lib/Usb2anyPowerCodec';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { Usb2anyGpioCodec } from '../lib/Usb2anyGpioCodec';
import { codecRegistry, AbstractDataDecoder } from '../../gc-target-configuration/lib/TargetConfiguration';
import { streamingCodecDataType } from '../../gc-model-streaming/lib/StreamingDataModel';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

['TMP117'].forEach(deviceName => {
    describe(`Usb2any GPIO for ${deviceName}`, () => {
        let usbTransport: UsbTransport;
        let usb2any: Usb2anyCodec;
        let power: Usb2anyPowerCodec;
        let gpio: Usb2anyGpioCodec;

        class TestObjectDecoder extends AbstractDataDecoder<object, object> {
            readonly params = {};
            lastData?: object;
            constructor() {
                super('testObjectDecoder', streamingCodecDataType, streamingCodecDataType);
            }
            decode(data: object): boolean | Error {
                this.lastData = data;
                return true;
            }
        }
        const testObjectDecoder = new TestObjectDecoder();

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
            gpio = new Usb2anyGpioCodec({
                pins: [{
                    pin: 3,
                    id: 'OutputPin',
                    mode: 'output',
                    state: 'high'
                },
                {
                    pin: 7,
                    id: 'InputPin',
                    mode: 'input'
                }]
            });
            codecRegistry.register(testObjectDecoder);
        });

        after(async () => {
            await usbTransport.disconnect();
            usbTransport.dispose();

            codecRegistry.dispose();   // clear the registery to avoid other tests clashing with this one.
            connectionManager.dispose();   // clear the registery to avoid other tests clashing with this one.
        });

        it('configure', () => {
            expect(() => {
                connectionManager.setActiveConfiguration(`usb+${usb2any.id}(${power.id},${gpio.id}+${testObjectDecoder.id})`);
            }).to.not.throw();
        });

        it('connect', async () => {
            await usbTransport.connect();
            expect(usbTransport.isConnected).to.be.true;
            expect(codecRegistry.isActive(usb2any.id)).to.be.true;
            expect(codecRegistry.isActive(gpio.id)).to.be.true;
        });

        it('write, read', async () => {
            gpio.encode({ 'OutputPin': false });
            await GcUtils.delay(200);
            const data = testObjectDecoder.lastData;
            expect(data !== undefined && 'InputPin' in data);
        });

        it('disconnect', async () => {
            usbTransport.isConnected && await usbTransport.disconnect();
        });

    });
});
