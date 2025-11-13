import { expect } from 'chai';

import { AevmCodec } from '../lib/AevmCodec';
import { codecRegistry } from '../../gc-target-configuration/lib/TargetConfiguration';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { IUsbPort } from '../../gc-service-usb/lib/ServiceUsb';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

['MSP432E'].forEach(deviceName => {
    describe(`Aevm for ${deviceName}`, () => {
        let usbTransport: UsbTransport;
        let aevm: AevmCodec;

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
                id: 'myaevm',
                resetControllerOnConnect: true,
                maxOutstandingCommands: 0,
                connectTimeout: 1000
            });
        });

        after(async () => {
            await usbTransport.disconnect();
            usbTransport.dispose();

            codecRegistry.dispose();   // clear the registery to avoid other tests clashing with this one.
            connectionManager.dispose();   // clear the registery to avoid other tests clashing with this one.
        });

        it('getInstance', () => {
            expect(codecRegistry.getInstance(aevm.id)).to.equal(aevm);
        });

        it('API SendCommand and ReadResponse - validate encoded packet and decoded packet', async () => {
            const aevm = new AevmCodec({ connectTimeout: 100 });
            const packet = aevm.sendCommandPacket(0, 0, 9, [], []);
            expect(packet, 'packet sent').eql([2, 212, 1, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
                1, 0, 0, 0, 0, 0, 9, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
            ]);

            const emulatedRxPacket = packet.slice();
            emulatedRxPacket[2] = 2;
            emulatedRxPacket[14] = 2;
            emulatedRxPacket.push(99, 100);
            (async () => {
                const rxPacket = await aevm.readResponse(packet);
                expect(rxPacket, 'read response packet').eql(emulatedRxPacket);
            })();

            // emulate receiving packet
            aevm.decode(emulatedRxPacket);
        });

    });
});
