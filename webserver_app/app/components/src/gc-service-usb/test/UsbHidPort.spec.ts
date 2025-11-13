import '../../gc-core-assets/lib/NodeJSEnv';
import { processArgs } from '../../gc-core-assets/test/TestArgs';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { IUsbService, IUsbHidPort, usbServiceType, usbHidPortType, openedEventType, closedEventType, dataEventType, IOpenedEvent, IClosedEvent, IDataEvent } from '../lib/ServiceUsb';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';

/** Enabled Logging *********************************************************************************************************** */
GcConsole.setLevel('usbService', processArgs.enableLog as number);
GcConsole.setLevel('usb', processArgs.enableLog as number);
/** *************************************************************************************************************************** */

[{ name: 'TMP117', port: 'USB2ANY/OneDemo device' }].forEach( device => {

    describe(`UsbHidPort for ${device.name}`, () => {
        const usbService = ServicesRegistry.getService<IUsbService>(usbServiceType);
        let port: IUsbHidPort;

        const getPort = async (name: string) => {
            return usbService.listPorts(usbHidPortType).then(ports => {
                return ports.filter(port => port.comName === name)[0];
            });
        };

        before(async function() {
            if (!processArgs.deviceNames.includes(device.name)) this.skip();
            port = await getPort(device.port);
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

                /* wait for response */
                const listener = () => {
                    port.removeEventListener(dataEventType, listener);
                    done();
                };
                port.addEventListener(dataEventType, listener);

                await port.open();
                await port.write([63, 12, 84, 186, 4, 1, 0, 2, 0, 10, 0, 0, 0, 0]);
            })();
        });

        it('eventListeners', function(done) {
            (async () => {
                let onOpened = 0;
                let onClosed = 0;
                let onData = 0;

                const verifyDone = () => {
                    if (onOpened === 2 && onClosed === 2 && onData === 2) {
                        done();
                    }
                };
                const onOpenHdlr = () => {
                    onOpened++;
                    verifyDone();
                };
                const onCloseHdlr = () => {
                    onClosed++;
                    verifyDone();
                };
                const onDataHdlr = () => {
                    onData++;
                    verifyDone();
                };
                port.addEventListener<IOpenedEvent>(openedEventType, onOpenHdlr);
                port.addEventListener<IClosedEvent>(closedEventType, onCloseHdlr);
                port.addEventListener<IDataEvent>(dataEventType, onDataHdlr);


                try {
                    await port.open();
                    await port.write([63, 12, 84, 186, 4, 1, 0, 2, 0, 10, 0, 0, 0, 0]);
                    await GcUtils.delay(500);
                    await port.close();

                    await port.open();
                    await port.write([63, 12, 84, 186, 4, 1, 0, 2, 0, 10, 0, 0, 0, 0]);
                    await GcUtils.delay(500);
                    await port.close();
                // TODO: [JIRA???] write causes the hidusb::write to reject
                } catch (e) {
                /* ignore */
                } finally {
                    port.removeEventListener(openedEventType, onOpenHdlr);
                    port.removeEventListener(closedEventType, onCloseHdlr);
                    port.removeEventListener(dataEventType, onDataHdlr);
                }
            })();
        });

    });
});
