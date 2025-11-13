import { expect } from 'chai';

import { AevmCodec } from '../../gc-codec-aevm/lib/AevmCodec';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { codecRegistry, AbstractDataDecoder, bufferDataType } from '../../gc-target-configuration/lib/TargetConfiguration';
import { IUsbPort } from '../../gc-service-usb/lib/ServiceUsb';
import { AevmUartCodec } from '../lib/AevmUartCodec';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

['MSP432E'].forEach(deviceName => {
    describe(`Aevm Uart for ${deviceName}`, () => {
        let usbTransport: UsbTransport;
        let aevm: AevmCodec;
        let uart: AevmUartCodec;

        class TestDataDecoder extends AbstractDataDecoder<number[], number[]> {
            readonly params = {};
            lastData?: number[];
            constructor() {
                super('testDataDecoder', bufferDataType, bufferDataType);
            }
            decode(data: number[]): boolean | Error {
                this.lastData = data;
                return false;
            }
        }
        const testDataDecoder = new TestDataDecoder();

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
                maxOutstandingCommands: 0,
                connectTimeout: 1000
            });
            uart = new AevmUartCodec({
                unit: 3,
                baudRate: 9600,
                parity: 'none',
                characterLength: 8,
                stopBits: 1
            });
            codecRegistry.register(testDataDecoder);
        });

        after(async () => {
            await usbTransport.disconnect();
            usbTransport.dispose();

            codecRegistry.dispose();   // clear the registery to avoid other tests clashing with this one.
            connectionManager.dispose();   // clear the registery to avoid other tests clashing with this one.
        });

        it('configure', () => {
            expect(() => {
                connectionManager.setActiveConfiguration(`usb+${aevm.id}(${uart.id}+${testDataDecoder.id})`);
            }).to.not.throw();
            expect(codecRegistry.isActive(aevm.id)).to.be.true;
            expect(codecRegistry.isActive(uart.id)).to.be.true;
        });

        it('connect', async () => {
            await usbTransport.connect();
            expect(usbTransport.isConnected).to.be.true;
        });

        it('receivePayload', async () => {
            const emulatedRxPacket = [2, 212, 2, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
                1, 0, 3, 0, 1, 6, 3, 0,
                1, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
                97, 98, 99
            ];
            aevm.decode(emulatedRxPacket);
        });

        it('disconnect', async () => {
            await usbTransport.disconnect();
        });

    });
});
