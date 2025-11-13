import { expect } from 'chai';

import { AevmCodec } from '../../gc-codec-aevm/lib/AevmCodec';
import { codecRegistry } from '../../gc-target-configuration/lib/TargetConfiguration';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { IRegisterInfo } from '../../gc-model-register/lib/IRegisterInfo';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { IUsbPort } from '../../gc-service-usb/lib/ServiceUsb';
import { AevmSpiCodec } from '../lib/AevmSpiCodec';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

['MSP432E'].forEach(deviceName => {
    describe(`Aevm SPI for ${deviceName}`, () => {
        let usbTransport: UsbTransport;
        let aevm: AevmCodec;
        let spi: AevmSpiCodec;
        let testRegister: IRegisterInfo;

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
            spi = new AevmSpiCodec({
                unit: 2,
                bitRate: 400,
                mode: 'moto_mode_0',
                dataWidth: 16,
                chipSelectActive: 'low',
                chipSelectChange: true,
                readCmd: 0x8000,
                writeCmd: 0,
                addressBits: 6,
                addressBitsOffset: 9,
                dataBits: 9,
                dataBitsOffset: 0,
                parity: 'odd',
                parityBitsOffset: 8
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
                connectionManager.setActiveConfiguration(`usb+${aevm.id}(${spi.id})`);
            }).to.not.throw();
            expect(codecRegistry.isActive(aevm.id)).to.be.true;
            expect(codecRegistry.isActive(spi.id)).to.be.true;
        });

        it('connect', async () => {
            await usbTransport.connect();
            expect(usbTransport.isConnected).to.be.true;
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
