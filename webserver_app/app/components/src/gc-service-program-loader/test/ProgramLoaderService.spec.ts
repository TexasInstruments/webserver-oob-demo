import '../../gc-core-assets/lib/NodeJSEnv';
import path from 'path';
import { processArgs, LAUNCHPADS, isMSP430 } from '../../gc-core-assets/test/TestArgs';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { programLoaderServiceType } from '../lib/ProgramLoaderService';
import { dsServiceType, IDebugCore, debugCoreType, statusMessageEventType, Location, IStatusMessageEvent } from '../../gc-service-ds/lib/DSService';
import { GcFiles } from '../../gc-core-assets/lib/GcFiles';
import { TestResults } from '../../gc-service-ds/test/typdef_results';

/** Enabled Logging *********************************************************************************************************** */
GcConsole.setLevel('gc-service-program-loader', processArgs.enableLog);
/** *************************************************************************************************************************** */

LAUNCHPADS.forEach( deviceName => {

    describe(`ProgramLoaderService for ${deviceName}`, () => {
        const dsService = ServicesRegistry.getService(dsServiceType);
        const programLoaderService = ServicesRegistry.getService(programLoaderServiceType);
        const outFilePath = path.join(__dirname, `../../../test/assets/${deviceName}_xds_blink.out`);
        const binFilePath = path.join(__dirname, `../../../test/assets/${deviceName}_xds_blink.${isMSP430(deviceName) ? 'hex' : 'bin'}`);
        const ccxmlPath = path.join(__dirname, `../../../test/assets/${deviceName}.ccxml`);
        let core: IDebugCore;
        let expectedResults: TestResults;

        before(async function() {
            if (!processArgs.deviceNames.includes(deviceName)) this.skip();

            const ccxml = await GcFiles.readTextFile(ccxmlPath);
            expectedResults = (await GcFiles.readJsonFile(path.join(__dirname, `../../../test/assets/${deviceName}_results.json`))) as TestResults;
            await dsService.configure(ccxml);
            const [aCore] = await dsService.listCores<IDebugCore>(debugCoreType);
            core = aCore;
            await core.connect();
        });

        it('loadProgram', function(done) {
            (async () => {
                try {
                    await programLoaderService.loadProgram(core, outFilePath);
                    const blinkAddr = await core.evaluate('&blink');
                    if (!blinkAddr || blinkAddr.type !== 'int *') {
                        throw new Error('Failed to evaluate &blink');
                    }
                    done();
                } catch (e) {
                    done(e);
                }
            })();
        });

        it('loadSymbol', function(done) {
            (async () => {
                try {
                    await programLoaderService.loadSymbols(core, outFilePath);
                    const blinkAddr = await core.evaluate('&blink');
                    if (!blinkAddr || blinkAddr.type !== 'int *') {
                        throw new Error('Failed to evaluate &blink');
                    }
                    done();
                } catch (e) {
                    done(e);
                }
            })();
        });

        if (!isMSP430(deviceName)) {
            it('loadBin', function(done) {
                (async () => {
                    let verifyFailedCount = 0;
                    const listener = (detail: IStatusMessageEvent) => {
                        if (detail.message.indexOf('Verify program failed') !== -1) {
                            verifyFailedCount++;
                        }
                    };
                    programLoaderService.addEventListener(statusMessageEventType, listener);
                    const tmpOutFilePath = path.join(__dirname, `../../../test/assets/${deviceName}_xds_expressions.out`);

                    try {
                        /* prime the device with an out file */
                        await programLoaderService.loadProgram(core, tmpOutFilePath);

                        /*  verify failed case */
                        await programLoaderService.loadBin(core, binFilePath, new Location(0), outFilePath);
                        if (verifyFailedCount !== 1) {
                            return done('loadBin should failed to verify program and load the program.');
                        }

                        /* verify passed case */
                        await programLoaderService.loadBin(core, binFilePath, new Location(0), outFilePath);
                        if (verifyFailedCount !== 1) {
                            return done('loadBin should sucessfully verify the program and not load the program again.');
                        }
                        done();

                    } catch (e) {
                        done(e);

                    } finally {
                        programLoaderService.removeEventListener(statusMessageEventType, listener);
                    }
                })();
            });
        }

        it('flash', function(done) {
        /* this test should be run last so that ds is deconfig before running the test */

            (async () => {
                try {
                    await dsService.deConfigure();

                    const connectionName = expectedResults.connectionName;
                    const coreName = expectedResults.debugPath;

                    /* load .bin file */
                    await programLoaderService.flash({ ccxmlPath: ccxmlPath, coreName: coreName, programOrBinPath: binFilePath, loadAddress: 0 });

                    /* load program */
                    await programLoaderService.flash({ ccxmlPath: ccxmlPath, connectionName: connectionName, deviceName: deviceName, coreName: coreName, programOrBinPath: outFilePath });

                    /* load symbols with creating ccxml file */
                    await programLoaderService.flash({ connectionName: connectionName, deviceName: deviceName, coreName: coreName.replace('Probe_0', 'Probe'), programOrBinPath: outFilePath, symbolsOnly: true });

                    done();
                } catch (e) {
                    done(e);
                }
            })();
        });
    });
});