import '../../gc-core-assets/lib/NodeJSEnv';
import path from 'path';
import { expect } from 'chai';
import { codecRegistry, AbstractConnectionLogger, IConnectionLogEvent, connectionLogEventType } from '../../gc-target-configuration/lib/TargetConfiguration';
import { processArgs } from '../../gc-core-assets/test/TestArgs';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { GcConsole, LogType } from '../../gc-core-assets/lib/GcConsole';
import { bindingRegistry, valueChangedEventType, IValueChangedEvent, bindValueType } from '../../gc-core-databind/lib/CoreDatabind';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { TargetProgramLoader } from '../../gc-target-program-loader/lib/TargetProgramLoader';
import { GcPromise } from '../../gc-core-assets/lib/GcPromise';
import { StreamingDataModel } from '../lib/StreamingDataModel';
import { CustomDataCodec } from '../demo/CustomDataCodec';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { TestResults } from '../../gc-service-ds/test/typdef_results';
import { GcFiles } from '../../gc-core-assets/lib/GcFiles';

GcConsole.setLevel('gc-transport-usb', processArgs.enableLog);
GcConsole.setLevel('gc-target-program-loader', processArgs.enableLog);
GcConsole.setLevel('gc-model-streaming', processArgs.enableLog);

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
['MSP432P401R', 'MSP430F5529'].forEach( deviceName => {

    describe(`Custom Data Codec for ${deviceName}`, () => {

        let usbTransport: UsbTransport;
        let progress: ProgressLogger;
        let programLoader: TargetProgramLoader;
        let model: StreamingDataModel;
        let codec: CustomDataCodec;

        before(async function() {
            if (!processArgs.deviceNames.includes(deviceName)) {
                this.skip();
            }

            const expectedResults = await GcFiles.readJsonFile(path.join(__dirname, `../../../test/assets/${deviceName}_results.json`)) as TestResults;
            const connectionName = expectedResults.connectionName;
            const binaryExt = connectionName.indexOf('MSP430') >= 0 ? 'hex' : 'bin';

            usbTransport = new UsbTransport({ usb: true, deviceName: deviceName });
            codec = new CustomDataCodec({ id: 'bin' });
            model = new StreamingDataModel({ id: 'model' });
            programLoader = new TargetProgramLoader({
                id: 'msp',
                programOrBinPath: path.resolve(__dirname, `assets/${deviceName}_serial_blink_binary_data.${binaryExt}`),
                deviceName: deviceName,
                connectionName: connectionName,
                autoProgram: true
            });
        });

        after(() => {
            if (usbTransport) {
                usbTransport.dispose();
            }
            if (programLoader) {
                programLoader.dispose();
            }
            if (codec) {
                codec.dispose();
            }

            bindingRegistry.dispose();
        });

        beforeEach( ()=> {
            progress = new ProgressLogger();
            usbTransport.addEventListener(connectionLogEventType, progress.logEventHandler);
        });

        afterEach( () => {
            usbTransport.removeEventListener(connectionLogEventType, progress.logEventHandler);
        });

        it('configure', async () => {
            // configure
            expect(() => {
                connectionManager.setActiveConfiguration('usb+bin+model');
            }).to.not.throw();
            expect(codecRegistry.isActive('usb')).to.be.true;
            expect(codecRegistry.isActive('bin')).to.be.true;
            expect(codecRegistry.isActive('model')).to.be.true;
            progress.assertNone();
        });

        it('connect', async () => {
            await connectionManager.connect();
            expect(usbTransport.isConnected).to.be.true;

            progress.assert('Connecting to target ...');
            progress.assert('Connecting to ');
            progress.assert('Waiting for data ...');
            progress.assert('Hardware connected.');
            progress.assertNone();
        });

        it('receive binary data', async () => {
            const bind = bindingRegistry.getBinding('model.on');
            expect(bind).to.exist;

            const wait4Message = GcPromise.defer<bindValueType>();
            const changeHandler = (details: IValueChangedEvent) => {
                wait4Message.resolve(details.newValue);
            };
            bind!.addEventListener(valueChangedEventType, changeHandler);
            try {
                const ledState = await GcPromise.timeout(wait4Message.promise, 1500, 'No response from target');
                expect(ledState === 1  || ledState === 0, 'Invalid led state received').to.be.true;
            } catch (e) {
                expect(e).to.not.exist;
            }
            bind!.removeEventListener(valueChangedEventType, changeHandler);
            progress.assertNone();
        });

        it('send binary data', async () => {
            const led = bindingRegistry.getBinding('model.on');
            const blink = bindingRegistry.getBinding('model.blink');
            expect(led).to.exist;
            expect(blink).to.exist;

            blink!.setValue(false);
            await GcUtils.delay(10);

            const state = led!.getValue();
            expect(state === 0 || state === 1, 'Invalid led state read from binding');

            const wait4Message = GcPromise.defer<bindValueType>();
            const changeHandler = (details: IValueChangedEvent) => {
                wait4Message.resolve(details.newValue);
            };
            led!.addEventListener(valueChangedEventType, changeHandler);
            try {
                const newState = await GcPromise.timeout(wait4Message.promise, 1500, 'No response from target');
                expect(newState === 1  || newState === 0, 'Invalid led state received').to.be.true;
                expect(newState).to.not.equal(state);
            } catch (e) {
                expect(e).to.not.exist;
            }
            led!.removeEventListener(valueChangedEventType, changeHandler);
            progress.assertNone();
        });

        it('disconnect', async () => {
            await usbTransport.disconnect();
            expect(usbTransport.isDisconnected).to.be.true;
            progress.assert('Hardware not connected.');
            progress.assertNone();
        });
    });
});
