import '../../gc-core-assets/lib/NodeJSEnv';
import path from 'path';
import { expect } from 'chai';
import { codecRegistry, AbstractConnectionLogger, IConnectionLogEvent, connectionLogEventType } from '../../gc-target-configuration/lib/TargetConfiguration';
import { processArgs, LAUNCHPADS, isMSP430 } from '../../gc-core-assets/test/TestArgs';
import { XdsTransport } from '../lib/XdsTransport';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { GcConsole, LogType } from '../../gc-core-assets/lib/GcConsole';
import { ProgramModel } from '../../gc-model-program/lib/ProgramModel';
import { bindingRegistry, IRefreshableBindValue, valueChangedEventType, IValueChangedEvent } from '../../gc-core-databind/lib/CoreDatabind';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { TargetProgramLoader } from '../../gc-target-program-loader/lib/TargetProgramLoader';
import { GcPromise } from '../../gc-core-assets/lib/GcPromise';
import { GcFiles } from '../../gc-core-assets/lib/GcFiles';
import { TestResults } from '../../gc-service-ds/test/typdef_results';

GcConsole.setLevel('gc-transport-xds', processArgs.enableLog);

class ProgressLogger extends AbstractConnectionLogger {
    id = 'progress';
    private index= -1;
    private messages = new Array<[string,  Omit<LogType, 'log'>]>();
    protected console = new GcConsole('progress');
    assert(message: string, type: LogType = 'info') {
        expect(this.messages[this.index + 1], `Missing the message="${message}".`).to.exist;
        this.index++;
        const [logMessage, logType] = this.messages[this.index];
        expect(logMessage).to.contain(message);
        expect(logType).to.equal(type);
    }
    skipOptionalMessage(message: string) {
        if (this.messages[this.index+1] && this.messages[this.index+1][0].indexOf(message) >= 0) {
            this.index++;
        }
    }
    assertNone() {
        expect(this.messages[this.index+1], 'Log is not empty.').to.be.undefined;
    }
    logEventHandler = (details: IConnectionLogEvent) => {
        if (details.type !== 'debug') {
            this.messages.push([details.message, details.type]);
        }
    };
    assertStillConnecting() {
        return true;
    }
}

LAUNCHPADS.forEach( deviceName => {

    describe(`XdsTransport for ${deviceName}`, () => {

        let xdsTransport: XdsTransport;
        let progress: ProgressLogger;
        let usbTransport: UsbTransport;
        let usbProgress: ProgressLogger;
        let expectedResults: TestResults;
        let programLoader: TargetProgramLoader;

        before(async function() {
            bindingRegistry.dispose();

            codecRegistry.dispose();   // clear the registry to avoid other tests clashing with this one.
            connectionManager.dispose();   // clear the registry to avoid other tests clashing with this one.

            if (!processArgs.deviceNames.includes(deviceName)) {
                this.skip();
            }
            expectedResults = (await GcFiles.readJsonFile(path.join(__dirname, `../../../test/assets/${deviceName}_results.json`))) as TestResults;

            xdsTransport = new XdsTransport({ id: 'jtag', deviceName: deviceName, connectionName: expectedResults.connectionName });
            new ProgramModel({ programOrBinPath: path.resolve(__dirname, `assets/${deviceName}_test_nested_struct.out`), symbolsOnly: true });
        });

        after(() => {

            if (xdsTransport) {
                xdsTransport.dispose();
            }
            if (usbTransport) {
                usbTransport.dispose();
            }
            if (programLoader) {
                programLoader.dispose();
            }

            bindingRegistry.dispose();
        });

        beforeEach( ()=> {
            progress = new ProgressLogger();
            xdsTransport.addEventListener(connectionLogEventType, progress.logEventHandler);
        });

        afterEach( () => {
            xdsTransport.removeEventListener(connectionLogEventType, progress.logEventHandler);
        });

        it('configure', () => {
            expect(() => {
                connectionManager.setActiveConfiguration('jtag');
            }).to.not.throw();
        });

        it('connect jtag', async () => {
            await xdsTransport.connect();
            expect(xdsTransport.isConnected).to.be.true;
            expect(codecRegistry.isActive('jtag')).to.be.true;

            progress.assert('Connecting to target ...');
            progress.assert('Hardware connected.');
            progress.assertNone();
        });

        it('connect to invalid core', async () => {
            let errMsg = '';
            try {
                await xdsTransport.initCore({ coreName: '1' });
            } catch (e) {
                errMsg = e.message || e.toString();
            }
            expect(errMsg).to.equal('Target configuration has no debugable core named 1');
            progress.assertNone();
        });

        it('connect with missing program path', async () => {
            let errMsg= '';
            try {
                await xdsTransport.initCore({ coreName: '0' });
            } catch (e) {
                errMsg = e.message || e.toString();
            }
            expect(errMsg).to.equal('Missing a programOrBinPath property for core=0.');
            progress.assertNone();
        });

        it('connect to default core', async () => {
            await xdsTransport.initCore({ programOrBinPath: path.resolve(__dirname, `assets/${deviceName}_test_nested_struct.out`) });
            expect(xdsTransport.isConnected).to.be.true;
            progress.assert(`Loading program for device="${deviceName}" ...`);
            progress.skipOptionalMessage('Flash/FRAM usage is');
            progress.assertNone();
        });

        if (!isMSP430(deviceName)) {
            it('read integer values', async () => {
                expect(await xdsTransport.readValue('x')).to.equal(0xBEAD);
                expect(await xdsTransport.readValue('obj.en')).to.equal(24);
                expect(await xdsTransport.readValue('obj.si')).to.equal(-1);
                expect(await xdsTransport.readValue('obj.ui')).to.equal(0xFFFFFFFF);
                expect(await xdsTransport.readValue('obj.ss')).to.equal(-2);
                expect(await xdsTransport.readValue('obj.us')).to.equal(0xFFFE);
                expect(await xdsTransport.readValue('obj.sl')).to.equal(-3);
                expect(await xdsTransport.readValue('obj.ul')).to.equal(0xFFFFFFFD);
                expect(await xdsTransport.readValue('obj.sc')).to.equal(-4);
                expect(await xdsTransport.readValue('obj.uc')).to.equal(0xfc);
            });

            it('read floating point values', async () => {
                expect(await xdsTransport.readValue('obj.ff')).to.equal(3.1415);
                expect(await xdsTransport.readValue('obj.fd')).to.equal(6.283);
            });

            it('read string values', async () => {
                expect(await xdsTransport.readValue('str')).to.equal('this is a test');
                expect(await xdsTransport.readValue('obj.str')).to.equal('this is a test');
            });

            it('read pointer values', async () => {
                const ptrVal = await xdsTransport.readValue('&obj');
                expect(await xdsTransport.readValue('obj.ptr')).to.equal(ptrVal);
            });

            it('read arrays', async () => {
                const arrayVal = await xdsTransport.readValue('obj.array');
                expect(arrayVal).to.deep.equal([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
            });

            it('read structs', async () => {
                const obj = await xdsTransport.readValue('obj');
                expect(obj.en).to.equal(24);
                expect(obj.si).to.equal(-1);
                expect(obj.ss).to.equal(-2);
                expect(obj.sl).to.equal(-3);
                expect(obj.sc).to.equal(-4);
                expect(obj.ui).to.equal(0xFFFFFFFF);
                expect(obj.us).to.equal(0xFFFE);
                expect(obj.ul).to.equal(0xFFFFFFFD);
                expect(obj.uc).to.equal(0xfc);
                expect(obj.me.aa).to.equal(46);
                expect(obj.me.bb).to.equal(47);
                expect(obj.fd).to.equal(6.283);
                expect(obj.ff).to.equal(3.1415);
                expect(obj.str).to.equal('this is a test');

                const objme = await xdsTransport.readValue('obj.me');
                expect(objme.aa).to.equal(46);
                expect(objme.bb).to.equal(47);
            });

            it('write integer values', async () => {
                xdsTransport.writeValue('x', 0xdead);
                expect(await xdsTransport.readValue('x')).to.equal(0xdead);

                xdsTransport.writeValue('obj.en', 1);
                expect(await xdsTransport.readValue('obj.en')).to.equal(1);

                xdsTransport.writeValue('obj.si', -10);
                expect(await xdsTransport.readValue('obj.si')).to.equal(-10);

                xdsTransport.writeValue('obj.ui', -10);
                expect(await xdsTransport.readValue('obj.ui')).to.equal(0xFFFFFFF6);

                xdsTransport.writeValue('obj.ss', -20);
                expect(await xdsTransport.readValue('obj.ss')).to.equal(-20);

                xdsTransport.writeValue('obj.us', -20);
                expect(await xdsTransport.readValue('obj.us')).to.equal(0xFFEC);

                xdsTransport.writeValue('obj.sl', -30);
                expect(await xdsTransport.readValue('obj.sl')).to.equal(-30);

                xdsTransport.writeValue('obj.ul', -30);
                expect(await xdsTransport.readValue('obj.ul')).to.equal(0xFFFFFFE2);

                xdsTransport.writeValue('obj.sc', -40);
                expect(await xdsTransport.readValue('obj.sc')).to.equal(-40);

                xdsTransport.writeValue('obj.uc', -40);
                expect(await xdsTransport.readValue('obj.uc')).to.equal(0xD8);
            });

            it('write floating point values', async () => {
                xdsTransport.writeValue('obj.ff', 1024.5);
                xdsTransport.writeValue('obj.fd', -1024.5);
                expect(await xdsTransport.readValue('obj.ff')).to.equal(1024.5);
                expect(await xdsTransport.readValue('obj.fd')).to.equal(-1024.5);
            });

            it('write string values', async () => {
                xdsTransport.writeValue('str', 'test');
                expect(await xdsTransport.readValue('str')).to.equal('test');
                expect(await xdsTransport.readValue('obj.str')).to.equal('test');
            });

            it('write pointer values', async () => {
                xdsTransport.writeValue('obj.ptr', 0);
                expect(await xdsTransport.readValue('obj.ptr')).to.equal('0x00000000');
            });

            it('write arrays', async () => {
                const arrayVal = [ 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
                xdsTransport.writeValue('obj.array', arrayVal);
                expect(await xdsTransport.readValue('obj.array')).to.deep.equal(arrayVal);
            });

            it('write structs', async () => {
                const obj = { me: { aa: -101, bb: -1293 } };
                xdsTransport.writeValue('obj', obj);
                expect(await xdsTransport.readValue('obj.me')).to.deep.equal(obj.me);
            });

            it('connect to specific cores', async () => {
                await xdsTransport.initCore({ coreName: expectedResults.coreName });
                await xdsTransport.initCore({ coreName: '0' });

                const val = 0x1234;
                xdsTransport.writeValue('x', val, expectedResults.coreName);
                expect(await xdsTransport.readValue('x', '0')).to.equal(val);
                expect(await xdsTransport.readValue('x', 'active')).to.equal(val);
            });
        }

        it('disconnect', async () => {
            await xdsTransport.disconnect();
            expect(xdsTransport.isDisconnected).to.be.true;
            progress.assert('Hardware not connected.');
            progress.assertNone();
        });

        it('reconfigure', () => {
            expect(() => {
                connectionManager.setActiveConfiguration('jtag+pm');
            }).to.not.throw();
        });

        it('reconnect jtag', async () => {
            try {
                await xdsTransport.connect();
            } catch (e) {
                expect(e.message || e.toString()).to.be.undefined;
            }
            expect(codecRegistry.isActive('jtag')).to.be.true;
            expect(codecRegistry.isActive('pm')).to.be.true;

            expect(xdsTransport.isConnected).to.be.true;
            expect(codecRegistry.isConnected('pm')).to.be.true;

            progress.assert('Connecting to target ...');
            progress.assert(`Loading symbols for device="${deviceName}" ...`);
            progress.assert('Hardware connected.');
            progress.assertNone();
        });

        it('read and write values through bindings', async () => {
            const x = bindingRegistry.getBinding('pm.x');
            const str = bindingRegistry.getBinding('pm.str');
            const me = bindingRegistry.getBinding('pm.obj.me');

            expect(x).to.exist;
            expect(str).to.exist;
            expect(me).to.exist;

            x!.setValue(0xface);
            str!.setValue('new string');
            me!.setValue({ aa: -1, bb: -2 });

            expect(codecRegistry.isConnected('pm')).to.be.true; // otherwise refresh will wait indefinitely for model to connect.
            await (x as IRefreshableBindValue).refresh();
            await (str as IRefreshableBindValue).refresh();
            await (me as IRefreshableBindValue).refresh();

            expect(x!.getValue()).to.equal(0xface);
            expect(str!.getValue()).to.equal('new string');
            expect(me!.getValue()).to.deep.equal({ aa: -1, bb: -2 });

            progress.assertNone();
        });

        it('disconnect jtag+pm', async () => {
            await xdsTransport.disconnect();
            expect(xdsTransport.isDisconnected).to.be.true;

            progress.assert('Hardware not connected.');
            progress.assertNone();
        });

        it('configure monitor based jtag', () => {
            usbTransport = new UsbTransport({
                id: 'usb',
                deviceId: 'msp432',
                pm: true,
                defaultBaudRate: 9600,
                deviceName: deviceName
            });
            programLoader = new TargetProgramLoader({
                id: 'msp432',
                programOrBinPath: path.resolve(__dirname, `../../../test/assets/${deviceName}_monitor_blink.out`),
                deviceName: deviceName,
                connectionName: expectedResults.connectionName,
                autoProgram: true
            });
            const pm = new ProgramModel({
                id: 'pm2',
                programOrBinPath: path.resolve(__dirname, `../../../test/assets/${deviceName}_monitor_blink.out`),
                symbolsOnly: true
            });

            expect(() => {
                connectionManager.setActiveConfiguration('usb+pm2');
            }).to.not.throw();
        });

        it('connect monitor based jtag', async () => {
            usbProgress = new ProgressLogger();
            usbTransport.addEventListener(connectionLogEventType, usbProgress.logEventHandler);
            try {
                await connectionManager.connect();
            } finally {
                usbTransport.removeEventListener(connectionLogEventType, usbProgress.logEventHandler);
            }
            expect(codecRegistry.isActive('jtag')).to.be.false;
            expect(codecRegistry.isActive('pm')).to.be.false;
            expect(codecRegistry.isActive('usb')).to.be.true;
            expect(codecRegistry.isActive('pm2')).to.be.true;

            expect(xdsTransport.isConnected).to.be.false;
            expect(usbTransport.isConnected).to.be.true;
            expect(codecRegistry.isConnected('pm')).to.be.false;
            expect(codecRegistry.isConnected('pm2')).to.be.true;

            usbProgress.assert('Connecting to target ...');
            usbProgress.assert(':9600 ...');
            usbProgress.assert('Loading symbols for device="msp432" ...');
            usbProgress.assert('Hardware connected.');
            usbProgress.assertNone();

            progress.assertNone();
        });

        it ('Blink led', async () => {
            let bind = bindingRegistry.getBinding('pm2.blink');
            bind!.setValue(1);

            try {
                bind = bindingRegistry.getBinding('pm2.on');
                const ledOn = new Promise<void>((resolve) => {
                    const listener = (details: IValueChangedEvent) => {
                        if (details.newValue === 1) {
                            resolve();
                            bind!.removeEventListener(valueChangedEventType, listener);
                        }
                    };
                    bind!.addEventListener(valueChangedEventType, listener);
                });
                await GcPromise.timeout(ledOn, 5000, 'Timeout waiting for LED to turn on');

                const ledOff = new Promise<void>((resolve) => {
                    const listener = (details: IValueChangedEvent) => {
                        if (details.newValue === 0) {
                            resolve();
                            bind!.removeEventListener(valueChangedEventType, listener);
                        }
                    };
                    bind!.addEventListener(valueChangedEventType, listener);
                });
                await GcPromise.timeout(ledOff, 2500, 'Timeout waiting for LED to turn off');
            } catch (e) {
                expect(e.message || e.toString()).to.be.undefined;
            }

            expect(usbTransport.isConnected).to.be.true;
        });

        it('disconnect usb+pm2', async () => {
            usbProgress = new ProgressLogger();
            usbTransport.addEventListener(connectionLogEventType, usbProgress.logEventHandler);
            try {
                await connectionManager.disconnect();
            } finally {
                usbTransport.removeEventListener(connectionLogEventType, usbProgress.logEventHandler);
            }
            expect(usbTransport.isDisconnected).to.be.true;

            usbProgress.assert('Hardware not connected.');
            usbProgress.assertNone();
            progress.assertNone();
        });

    });

});
