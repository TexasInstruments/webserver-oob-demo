import '../../gc-core-assets/lib/NodeJSEnv';
import { describe, it } from 'mocha';
import * as path from 'path';
import * as fs from 'fs';
import { processArgs } from '../../gc-core-assets/test/TestArgs';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { dsServiceType, IDSService, IDebugCore, debugCoreType } from '../../gc-service-ds/lib/DSService';
import { IUsbService, usbServiceType, usbSerialPortType, IUsbSerialPort, IOpenedEvent, IClosedEvent, IDataEvent, openedEventType, closedEventType, dataEventType } from '../lib/ServiceUsb';

/** Enabled Logging *********************************************************************************************************** */
GcConsole.setLevel('usbService', processArgs.enableLog);
GcConsole.setLevel('usb', processArgs.enableLog);
/** *************************************************************************************************************************** */

['MSP432P401R'].forEach( deviceName => {

    describe(`UsbSerialPort for ${deviceName}`, () => {
        const usbService = ServicesRegistry.getService<IUsbService>(usbServiceType);
        const dsService = ServicesRegistry.getService<IDSService>(dsServiceType);
        let port: IUsbSerialPort;

        const getPort = async () => {
            const ports = await usbService.listPorts(usbSerialPortType);
            const defaultPort = (await usbService.getDefaultPort(ports, deviceName));
            if (defaultPort) {
                return usbSerialPortType.asUsbPortType(defaultPort.port);
            }
            throw Error(`No serial port found for ${deviceName}`);
        };

        before(async function() {
            if (!processArgs.deviceNames.includes(deviceName)) this.skip();

            const ccxml = fs.readFileSync(path.join(__dirname, `../../../test/assets/${deviceName}.ccxml`), 'utf-8');
            await dsService.configure(ccxml);
            const [core] = await dsService.listCores<IDebugCore>(debugCoreType);
            const out = fs.readFileSync(path.join(__dirname, `../../../test/assets/${deviceName}_serial_blink.out`));
            await core.connect();
            await core.loadProgram(out, false);
            await core.disconnect();

            port = await getPort();
        });

        after(async function() {
            try {
                await dsService.deConfigure();
            } catch (e) { /* ignore */ }
        });

        afterEach(async function() {
            try {
                await port.close();
            } catch (e) { /* ignore */ }
        });

        it('open', function(done) {
            (async () => {
                if (port.isOpened) return done('Port should not be opened');

                await port.open();
                let exception = null;
                try {
                    await port.open();
                } catch (error) {
                    exception = error;
                }
                done(exception ? null : 'Expecting serial port failed to open');
            })();
        });

        it('write', function(done) {
            (async () => {
                let exception = null;

                try {
                    let off = false;
                    let message = '';
                    const port = await getPort();
                    port.addEventListener<IDataEvent>(dataEventType, (detail) => {
                        message += String.fromCharCode(...detail.data);
                        if (message.indexOf('"blink":0')) {
                            off = true;
                        }
                    });

                    await port.open({ baudRate: 9600 });
                    await port.write(JSON.stringify({ blink: 0 }) + '\r\n');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    if (!off) return done('Failed to write to turn LED off');

                    await port.write(JSON.stringify({ blink: 1 }) + '\r\n');
                } catch (error) {
                    exception = error;

                } finally {
                    done(exception);
                }
            })();
        });

        it('setBaudRate', function(done) {
            this.skip(); // TODO: not sure how to test
        });

        it('signals', function(done) {
            this.skip(); // need imageCreator device to test

            (async () => {
                try {
                    await port.open();
                    await port.setSignals({ cts: true, dsr: true });
                    const signals = await port.getSignals();

                    // TODO: test get signals matches the set signals values
                    done();
                } catch (error) {
                    done(error);
                }
            })();

        });

        it('eventListeners', function(done) {
            (async () => {
                let onOpened = false;
                let onClosed = false;
                let onData = false;

                const verifyDone = () => {
                    if (onOpened && onClosed && onData) {
                        done();
                    }
                };
                const onOpenHdlr = () => {
                    onOpened = true;
                    port.removeEventListener(openedEventType, onOpenHdlr);
                    verifyDone();
                };
                const onCloseHdlr = () => {
                    onClosed = true;
                    port.removeEventListener(closedEventType, onCloseHdlr);
                    verifyDone();
                };
                const onDataHdlr = () => {
                    onData = true;
                    port.removeEventListener(dataEventType, onDataHdlr);
                    port.close();
                    verifyDone();
                };
                port.addEventListener<IOpenedEvent>(openedEventType, onOpenHdlr);
                port.addEventListener<IClosedEvent>(closedEventType, onCloseHdlr);
                port.addEventListener<IDataEvent>(dataEventType, onDataHdlr);

                await port.open({ baudRate: 9600 });
            })();
        });

    });
});
