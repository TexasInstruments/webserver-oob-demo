import { expect } from 'chai';

import { Usb2anyCodec, getResultLSB, getResult } from '../lib/Usb2anyCodec';
import { codecRegistry } from '../../gc-target-configuration/lib/TargetConfiguration';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { processArgs } from '../../gc-core-assets/test/TestArgs';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';

['TMP117'].forEach(deviceName => {
    describe(`Usb2any for ${deviceName}`, () => {
        let usbTransport: UsbTransport;
        let u2a: Usb2anyCodec;

        before(function() {
            if (!processArgs.deviceNames.includes(deviceName)) {
                this.skip();
            }
        });

        before(function() {
            usbTransport = new UsbTransport({ hid: true });
            u2a = new Usb2anyCodec({
                id: 'u2a',
                connectTimeout: 100,
                maxOutstandingCommands: 1
            });
            connectionManager.setActiveConfiguration('usb+u2a');
        });

        it('connect', async () => {
            await connectionManager.connect();

            expect(connectionManager.isConnected).to.be.true;
            expect(usbTransport.isConnected).to.be.true;
            expect(codecRegistry.isConnected('u2a')).to.be.true;
        });

        it('reconnect', async () => {
            await connectionManager.disconnect();

            expect(connectionManager.isConnected).to.be.false;
            expect(usbTransport.isConnected).to.be.false;
            expect(codecRegistry.isConnected('u2a')).to.be.false;

            await connectionManager.connect();

            expect(connectionManager.isConnected).to.be.true;
            expect(usbTransport.isConnected).to.be.true;
            expect(codecRegistry.isConnected('u2a')).to.be.true;
        });

        after(async () => {
            await usbTransport.disconnect();
            usbTransport.dispose();

            codecRegistry.dispose();   // clear the registry to avoid other tests clashing with this one.
            connectionManager.dispose();   // clear the registry to avoid other tests clashing with this one.
        });
    });
});

describe('Usb2any', () => {
    let usbTransport: UsbTransport;
    let u2aId: string;
    let u2a: Usb2anyCodec;

    before(() => {
        usbTransport = new UsbTransport({ hid: true });
        u2aId = 'myu2a';
        u2a = new Usb2anyCodec({
            id: u2aId,
            connectTimeout: 100
        });
    });

    after(async () => {
        await usbTransport.disconnect();
        usbTransport.dispose();

        codecRegistry.dispose();   // clear the registry to avoid other tests clashing with this one.
        connectionManager.dispose();   // clear the registry to avoid other tests clashing with this one.
    });

    it('getInstance', () => {
        expect(codecRegistry.getInstance(u2aId)).to.equal(u2a);
    });

    it('API SendCommand and ReadResponse - validate encoded packet and decoded packet', async () => {
        const u2a = new Usb2anyCodec({ connectTimeout: 100 });
        const packet = u2a.sendCommandPacket(106, [0, 0, 0, 0]);
        // [84, <crc8>, 4, 1, 0, 1, 0, 106, 0, 0, 0, 0]
        expect(packet.length, 'send packet length').eq(12);
        expect(packet[0], 'send packet identifier').eq(84);
        expect(packet[1], 'send packet pec byte').gt(0).lt(255);
        expect(packet.slice(2), 'send packet content').eql([4, 1, 0, 1, 0, 106, 0, 0, 0, 0]);

        const emulatedRxPacket = [84, 235, 1, 2, 0, 1, 0, 106, 1];
        const promise = u2a.readResponse(packet);
        // emulate u2a receiving packet
        u2a.decode(emulatedRxPacket);
        const rxPacket = await promise;
        expect(rxPacket, 'read response packet').eql(emulatedRxPacket);
    });

    it('out of sequence packets', async () => {
        const u2a = new Usb2anyCodec({
            id: 'bad'
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u2a as any).isConnected = true;

        const packet1 = u2a.sendCommandPacket(1, [0x43]);
        const packet2 = u2a.sendCommandPacket(2, [0x85]);
        const packet3 = u2a.sendCommandPacket(3, [0xFF]);
        const packet4 = u2a.sendCommandPacket(4, [0x00]);

        const promise1 = u2a.readResponse(packet1);
        const promise2 = u2a.readResponse(packet2);
        const promise3 = u2a.readResponse(packet3);
        const promise4 = u2a.readResponse(packet4);

        packet4[3] = 2;  // change to reply packet
        packet4[1] = 129; // adjust CRC
        expect(u2a.decode(packet4)).to.be.true;
        expect(getResultLSB(await promise4)).to.equal(0);

        packet3[3] = 2;  // change to reply packet
        packet3[1] = 123; // adjust CRC
        expect(u2a.decode(packet3)).to.be.true;
        expect(getResultLSB(await promise3)).to.equal(255);

        packet2[3] = 2;  // change to reply packet
        packet2[1] = 25; // adjust CRC
        expect(u2a.decode(packet2)).to.be.true;
        expect(getResultLSB(await promise2)).to.equal(0x85);

        packet1[3] = 2;  // change to reply packet
        packet1[5] = 5;  // adjust sequence # for missing packet retry command.
        packet1[1] = 24; // adjust CRC
        expect(u2a.decode(packet1)).to.be.true;
        expect(getResultLSB(await promise1)).to.equal(0x43);
    });

    it('missing packets', async ()=> {
        class PromiseWrapper {
            private pending = true;
            private rejected = false;
            private value?: number;

            constructor(request: Promise<number []>) {
                this.waitForResult(request);
            }

            async waitForResult(request: Promise<number []>) {
                try {
                    this.value = getResult(await request);
                } catch (e) {
                    this.rejected = true;
                }
                this.pending = false;
            }

            assertPending(address: number) {
                expect(this.pending, `register addrs=${address} - pending`).to.be.true;
            }

            assertValue(value: number, address: number) {
                expect(this.pending, `register addrs=${address} - pending`).to.be.false;
                expect(this.rejected, `register addrs=${address} - rejected`).to.be.false;
                expect(this.value, `register addrs=${address} - value`).to.equal(value);
            }
        }

        const u2a = new Usb2anyCodec({
            id: 'test'
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u2a as any).isConnected = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u2a as any).txPacketSeqNum = 183;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u2a as any).rxReceivedPacketSeqNo = 182;

        const readRegisterPackets = [ 0, 1, 2, 3, 4, 5, 8, 7, 15].map( address => u2a.sendCommandPacket(101, [0, 72, 1, 0, 2, address]));
        const promises: PromiseWrapper[] = readRegisterPackets.map( packet => new PromiseWrapper(u2a.readResponse(packet)));

        u2a.decode([84, 211, 2, 2, 0, 183, 0, 101, 11, 10]);
        u2a.decode([84, 136, 2, 2, 0, 184, 0, 101, 2, 32]);
        u2a.decode([84, 213, 2, 2, 0, 185, 0, 101, 96, 0]);
        u2a.decode([84, 48, 2, 2, 0, 186, 0, 101, 128, 0]);
        u2a.decode([84, 228, 2, 2, 0, 187, 0, 101, 0, 0]);
        u2a.decode([84, 77, 2, 2, 0, 189, 0, 101, 0, 149]);
        u2a.decode([84, 27, 2, 2, 0, 191, 0, 101, 1, 23]);

        await GcUtils.delay(1);

        promises[0].assertValue(0xb0a, 0);
        promises[1].assertValue(0x220, 1);
        promises[2].assertValue(0x6000, 2);
        promises[3].assertValue(0x8000, 3);
        promises[4].assertValue(0, 4);
        promises[5].assertPending(5);
        promises[6].assertValue(0x95, 8);
        promises[7].assertPending(7);
        promises[8].assertValue(0x117, 15);

        // retry missing packet's
        u2a.decode([84, 110, 2, 2, 0, 192, 0, 101, 3, 93]);
        await GcUtils.delay(1);
        promises[5].assertValue(0x35d, 5);
        promises[7].assertPending(7);

        u2a.decode([84, 69, 2, 2, 0, 193, 0, 101, 54, 23]);
        await GcUtils.delay(1);
        promises[7].assertValue(0x3617, 7);
    });

});
