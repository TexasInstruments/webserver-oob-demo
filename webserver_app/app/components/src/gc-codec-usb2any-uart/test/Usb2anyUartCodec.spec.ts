import { expect } from 'chai';

import { Usb2anyCodec } from '../../gc-codec-usb2any/lib/Usb2anyCodec';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { Usb2anyPowerCodec } from '../../gc-codec-usb2any-power/lib/Usb2anyPowerCodec';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { codecRegistry, AbstractDataDecoder, bufferDataType } from '../../gc-target-configuration/lib/TargetConfiguration';
import { Usb2anyUartCodec } from '../lib/Usb2anyUartCodec';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

['TMP117'].forEach(deviceName => {
    describe(`Usb2any Uart for ${deviceName}`, () => {
        let usbTransport: UsbTransport;
        let usb2any: Usb2anyCodec;
        let power: Usb2anyPowerCodec;
        let uart: Usb2anyUartCodec;

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
            usbTransport = new UsbTransport({ hid: true });
            usb2any = new Usb2anyCodec({
                connectTimeout: 100
            });
            power = new Usb2anyPowerCodec({
                v33: true
            });
            uart = new Usb2anyUartCodec({
                baudRate: 9600,
                parity: 'none',
                bitDirection: 'lsb',
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
                connectionManager.setActiveConfiguration(`usb+${usb2any.id}(${power.id},${uart.id}+${testDataDecoder.id})`);
            }).to.not.throw();
        });

        it('connect', async () => {
            await usbTransport.connect();
            expect(usbTransport.isConnected).to.be.true;
            expect(codecRegistry.isActive(usb2any.id)).to.be.true;
            expect(codecRegistry.isActive(uart.id)).to.be.true;
        });

        it('receivePayload', async () => {
            const emulatedRxPacket = [84, 167, 3, 4, 0, 0, 0, 20, 97, 98, 99];
            usb2any.decode(emulatedRxPacket);
            expect(testDataDecoder.lastData).eql([97, 98, 99]);
        });

        it('disconnect', async () => {
            await usbTransport.disconnect();
        });

    });
});
