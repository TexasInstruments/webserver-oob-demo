import '../../gc-core-assets/lib/NodeJSEnv';
import path from 'path';
import { processArgs, LAUNCHPADS } from '../../gc-core-assets/test/TestArgs';
import { TargetProgramLoader } from '../lib/TargetProgramLoader';
import { LogType, GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { expect } from 'chai';
import { AbstractConnectionLogger } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ITargetProgramLoader } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { TestResults } from '../../gc-service-ds/test/typdef_results';
import { GcFiles } from '../../gc-core-assets/lib/GcFiles';

GcConsole.setLevel('gc-service-ds', processArgs.enableLog);
GcConsole.setLevel('gc-service-program-loader', processArgs.enableLog);
GcConsole.setLevel('gc-target-program-loader', processArgs.enableLog);

class ProgressLogger extends AbstractConnectionLogger {
    id = 'progress';
    private index= -1;
    private messages = new Array<[string,  Omit<LogType, 'log'>]>();
    protected console = new GcConsole('progress');
    assert(message: string, type: LogType = 'info') {
        expect(this.messages[this.index+1], `Missing the message="${message}".`).to.exist;
        this.index++;
        const [logMessage, logType] = this.messages[this.index];
        expect(logMessage).to.equal(message);
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
    protected fireLoggingMessage(type: Omit<LogType, 'log'>, message: string) {
        if (type !== 'debug') {
            this.messages.push([message, type]);
        }
    }
    assertStillConnecting() {
        return true;
    }
}

LAUNCHPADS.forEach(deviceName => {

    describe(`TargetProgramLoader for ${deviceName}`, () => {

        let progress: ProgressLogger;

        const blinkProgramPath = path.resolve(__dirname, `../../../test/assets/${deviceName}_xds_blink.out`);

        async function assertLoadProgramRejectsWith(loader: ITargetProgramLoader, deviceId: string, errMsg: string, coreName = '') {
            const deviceDescription = `Loading program for ${deviceId} device${coreName ? ` core="${coreName}"` : ''}`;
            try {
                await loader.loadProgram(progress);
                Error('');
            } catch (err) {
                const expected = `${deviceDescription} failed: `;
                let actual = err.message.substring(0, expected.length);
                expect(actual).to.equal(expected);
                actual = err.message.substring(expected.length);
                expect(err.message.indexOf(errMsg), `Expected "${actual} to contain the text "${errMsg}".`).to.be.greaterThan(0);
            }

            progress.assert(`${deviceDescription} ...`);
            progress.assertNone();
        }

        before(async function() {
            if (!processArgs.deviceNames.includes(deviceName)) {
                this.skip();
            }
        });

        beforeEach( ()=> {
            progress = new ProgressLogger();
        });

        it('missing deviceName', async () => {
            const loader = new TargetProgramLoader({
                id: 'ldr',
                autoProgram: true,
                connectionName: 'Texas Instruments XDS110 USB Debug Probe',
                programOrBinPath: blinkProgramPath
            });

            await assertLoadProgramRejectsWith(loader, 'undefined', 'Missing a "deviceName" property.');
            loader.dispose();
        });

        it('missing connectionId', async () => {
            const loader = new TargetProgramLoader({
                id: 'ldr',
                autoProgram: true,
                deviceName: 'TMP117',
                programOrBinPath: blinkProgramPath
            });

            await assertLoadProgramRejectsWith(loader, 'TMP117', 'Missing a "connectionId" property.');
            loader.dispose();
        });

        it('missing ccxmlPath', async () => {
            const loader = new TargetProgramLoader({
                deviceId: 'TMP117',
                autoProgram: true,
                programOrBinPath: blinkProgramPath
            });

            await assertLoadProgramRejectsWith(loader, 'TMP117', 'Missing a "ccxmlPath" property.');
            loader.dispose();
        });

        it('invalid deviceName', async () => {
            const loader = new TargetProgramLoader({
                id: 'ldr',
                autoProgram: true,
                deviceName: 'TMP117',
                connectionName: 'Texas Instruments XDS110 USB Debug Probe',
                programOrBinPath: blinkProgramPath
            });

            await assertLoadProgramRejectsWith(loader, 'TMP117', 'deviceName');
            loader.dispose();
        });

        it('invalid connectionName', async () => {
            const loader = new TargetProgramLoader({
                id: 'ldr',
                autoProgram: true,
                deviceName: deviceName,
                connectionName: 'TIXDS110_connection', // invalid connection
                programOrBinPath: blinkProgramPath
            });

            await assertLoadProgramRejectsWith(loader, deviceName, 'connectionName');
            loader.dispose();
        });

        it('invalid ccxmlPath', async () => {
            const loader = new TargetProgramLoader({
                deviceId: 'TMP117',
                autoProgram: true,
                ccxmlPath: '../tmp117.ccxml',
                programOrBinPath: blinkProgramPath
            });

            await assertLoadProgramRejectsWith(loader, 'TMP117', 'no such file or directory');
            loader.dispose();
        });

        it('core not found', async () => {
            const loader = new TargetProgramLoader({
                autoProgram: true,
                ccxmlPath: path.resolve(__dirname, `../../../test/assets/${deviceName}.ccxml`),
                coreName: 'CORTEXT_M0',
                programOrBinPath: blinkProgramPath
            });

            await assertLoadProgramRejectsWith(loader, 'undefined', 'No debuggable core="CORTEXT_M0" found for undefined device.', 'CORTEXT_M0');
            loader.dispose();
        });

        it('missing programOrBinPath arugment', async () => {
            const loader = new TargetProgramLoader({
                autoProgram: true,
                deviceName: deviceName,
                connectionName: 'Texas Instruments XDS110 USB Debug Probe'
            });

            await assertLoadProgramRejectsWith(loader, deviceName, 'Invalid parameters: Missing a programOrBinPath property.');
            loader.dispose();
        });

        it('loadProgram', async () => {
            const expectedResults = (await GcFiles.readJsonFile(path.join(__dirname, `../../../test/assets/${deviceName}_results.json`))) as TestResults;
            const loader = new TargetProgramLoader({
                autoProgram: true,
                deviceName: deviceName,
                connectionName: expectedResults.connectionName,
                programOrBinPath: blinkProgramPath
            });
            await loader.loadProgram(progress);

            progress.assert(`Loading program for ${deviceName} device ...`);
            progress.skipOptionalMessage('Flash/FRAM usage is');
            progress.assert(`Loading program for ${deviceName} device succeeded.`);
            progress.assertNone();
            loader.dispose();
        });
    });

});
