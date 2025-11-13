import { expect } from 'chai';

import { AevmCodec } from '../../gc-codec-aevm/lib/AevmCodec';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { codecRegistry, AbstractDataDecoder } from '../../gc-target-configuration/lib/TargetConfiguration';
import { streamingCodecDataType } from '../../gc-model-streaming/lib/StreamingDataModel';
import { IUsbPort } from '../../gc-service-usb/lib/ServiceUsb';
import { AevmGpioCodec } from '../lib/AevmGpioCodec';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

['MSP432E'].forEach(deviceName => {
    describe(`Aevm GPIO for ${deviceName}`, () => {
        let usbTransport: UsbTransport;
        let aevm: AevmCodec;
        let gpio: AevmGpioCodec;

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
            usbTransport = new UsbTransport({ usb: true,
                filter: (ports: IUsbPort[]): IUsbPort[] => {
                    return ports.filter((port) => port.descriptor?.pnpId?.toLowerCase().includes('vid_0400&pid_2014&mi_00'));
                }
            });
            aevm = new AevmCodec({
                resetControllerOnConnect: true,
                maxOutstandingCommands: 0,
                connectTimeout: 1000
            });
            gpio = new AevmGpioCodec({
                pins: [{
                    pin: 15,
                    id: 'OutputPin',
                    mode: 'output',
                    state: 'high'
                },
                {
                    pin: 14,
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
                connectionManager.setActiveConfiguration(`usb+${aevm.id}(${gpio.id}+${testObjectDecoder.id})`);
            }).to.not.throw();
            expect(codecRegistry.isActive(aevm.id)).to.be.true;
            expect(codecRegistry.isActive(gpio.id)).to.be.true;
        });

        it('connect', async () => {
            await usbTransport.connect();
            expect(usbTransport.isConnected).to.be.true;
        });

        it('write, read', async () => {
            gpio.encode({ 'OutputPin': false });
            await GcUtils.delay(1000);
            const data = testObjectDecoder.lastData;
            expect(data !== undefined && 'InputPin' in data).to.be.true;
        });

        it('disconnect', async () => {
            await usbTransport.disconnect();
        });

    });
});
