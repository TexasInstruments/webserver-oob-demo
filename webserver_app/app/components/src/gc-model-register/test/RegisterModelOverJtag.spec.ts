import '../../gc-core-assets/lib/NodeJSEnv';
import path from 'path';
import { expect } from 'chai';
import { XdsTransport } from '../../gc-transport-xds/lib/XdsTransport';
import { processArgs } from '../../gc-core-assets/test/TestArgs';
import { RegisterModel } from '../lib/RegisterModel';
import { CustomCodec } from '../demo/CustomCodec';
import { codecRegistry, connectionLogEventType, AbstractConnectionLogger, IConnectionLogEvent } from '../../gc-target-configuration/lib/TargetConfiguration';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { bindingRegistry, IValueChangedEvent, valueChangedEventType } from '../../gc-core-databind/lib/CoreDatabind';
import { GcPromise } from '../../gc-core-assets/lib/GcPromise';
import { GcConsole, LogType } from '../../gc-core-assets/lib/GcConsole';

GcConsole.setLevel('gc-service-ds', processArgs.enableLog);
GcConsole.setLevel('gc-service-program-loader', processArgs.enableLog);
GcConsole.setLevel('gc-target-program-loader', processArgs.enableLog);
GcConsole.setLevel('gc-model-register', processArgs.enableLog);

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

['MSP432P401R'].forEach( deviceName => {

    describe(`Register Model over JTAG for ${deviceName}`, () => {

        let transport: XdsTransport;
        let model: RegisterModel;
        let codec: CustomCodec;

        before(function() {
            if (!processArgs.deviceNames.includes(deviceName)) {
                this.skip();
            }
            model = new RegisterModel({ id: 'model', registerInfo: path.join(__dirname, 'assets/blinkRegisters.json') });
            codec = new CustomCodec({ id: 'me', programOrBinPath: path.resolve(__dirname, `../../../test/assets/${deviceName}_xds_blink.out`) });
            transport = new XdsTransport({ id: 'transport', deviceName: deviceName, connectionName: 'Texas Instruments XDS110 USB Debug Probe' });
        });

        it('configure', () => {

            expect(() => {
                connectionManager.setActiveConfiguration(' transport + me + model ');
            }).to.not.throw();
            expect(codecRegistry.isActive('transport')).to.be.true;
            expect(codecRegistry.isActive('me')).to.be.true;
            expect(codecRegistry.isActive('model')).to.be.true;
        });

        it('connect', async () => {
            const progress = new ProgressLogger();
            transport.addEventListener(connectionLogEventType, progress.logEventHandler);
            try {
                await transport.connect();
            } finally {
                transport.removeEventListener(connectionLogEventType, progress.logEventHandler);
            }

            expect(transport.isConnected).to.be.true;

            progress.assert('Connecting to target ...');
            progress.assert(`Loading program for device="${deviceName}" ...`);
            progress.assert('Hardware connected.');
            progress.assertNone();
        });

        it('blink led', async () => {
            const blink = bindingRegistry.getBinding('model.blink');
            expect(blink).to.exist;

            blink!.setValue(1, undefined, true); // force write to target.
            expect(blink!.getValue()).to.equal(1);

            try {
                const bind = bindingRegistry.getBinding('model.on.yes');
                const ledOn = new Promise<void>((resolve) => {
                    const listener = (details: IValueChangedEvent) => {
                        if (details.newValue === 1) {
                            resolve();
                            bind!.removeEventListener(valueChangedEventType, listener);
                        }
                    };
                    bind!.addEventListener(valueChangedEventType, listener);
                });
                await GcPromise.timeout(ledOn, 1500, 'Timeout waiting for LED to turn on');

                const ledOff = new Promise<void>((resolve) => {
                    const listener = (details: IValueChangedEvent) => {
                        if (details.newValue === 0) {
                            resolve();
                            bind!.removeEventListener(valueChangedEventType, listener);
                        }
                    };
                    bind!.addEventListener(valueChangedEventType, listener);
                });
                await GcPromise.timeout(ledOff, 1500, 'Timeout waiting for LED to turn off');
            } catch (e) {
                expect(e.message || e.toString()).to.be.undefined;
            }
        });

        it('disconnect', async () => {
            const progress = new ProgressLogger();
            transport.addEventListener(connectionLogEventType, progress.logEventHandler);
            try {
                await transport.disconnect();
            } finally {
                transport.removeEventListener(connectionLogEventType, progress.logEventHandler);
            }
            expect(transport.isDisconnected).to.be.true;

            progress.assert('Hardware not connected.');
            progress.assertNone();
        });

        after(function() {
            if (codec) {
                codec.dispose();
            }
            if (transport) {
                transport.dispose();
            }

            bindingRegistry.dispose();
        });

    });

});
