import '../../gc-core-assets/lib/NodeJSEnv';
import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import { processArgs, LAUNCHPADS, isMSP430 } from '../../gc-core-assets/test/TestArgs';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { dsServiceType, IDebugCore, debugCoreType, IGelOutputEvent, gelOutputEventType, IStatusMessageEvent, statusMessageEventType, IConfigChangedEvent, configChangedEventType } from '../lib/DSService';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { IListener } from '../../gc-core-assets/lib/Events';

/** Enabled Logging *********************************************************************************************************** */
GcConsole.setLevel('gc-service-ds', processArgs.enableLog);
/** *************************************************************************************************************************** */

LAUNCHPADS.forEach( deviceName => {

    describe(`DSServiceTest for ${deviceName}`, () => {
        const dsService = ServicesRegistry.getService(dsServiceType);
        let ccxml: string;

        before(async function() {
            if (!processArgs.deviceNames.includes(deviceName)) this.skip();
            ccxml = fs.readFileSync(path.join(__dirname, `../../../test/assets/${deviceName}.ccxml`), 'utf-8');
        });

        beforeEach(async function() {
            await dsService.configure(ccxml);
        });

        afterEach(async function() {
            await dsService.deConfigure();
        });

        it('config/deconfig', async function() {
            await dsService.deConfigure();
            await dsService.configure(ccxml);
        });

        it('listCores', async function() {
            const cores = await dsService.listCores();
            expect(cores).length.greaterThan(0);
        });

        if (!isMSP430(deviceName)) {
            it('gelOutputEvent', async function() {
                let received = 0;
                const [core] = await dsService.listCores<IDebugCore>(debugCoreType);
                const listener: IListener<IGelOutputEvent> = ( detail: IGelOutputEvent ) => {
                    dsService.removeEventListener(gelOutputEventType, listener);
                    received++;
                };
                dsService.addEventListener(gelOutputEventType, listener);

                await core.connect();
                expect(received).to.be.greaterThan(0);
            });
        }

        it('configChangedEvent', async function() {
            let received = 0;
            const listener: IListener<IConfigChangedEvent> = ( detail: IConfigChangedEvent ) => {
                dsService.removeEventListener(configChangedEventType, listener);
                received++;
            };
            dsService.addEventListener(configChangedEventType, listener);

            await dsService.deConfigure();
            await dsService.configure(ccxml);
            expect(received).equal(1);
        });

        it('statusMessageEvent', async function() {
            this.skip(); // required DEBUG_ForceGTIError(0) or DEBUG_ForceGTIStatus(2)

            let received = 0;
            const [core] = await dsService.listCores<IDebugCore>(debugCoreType);
            const listener: IListener<IStatusMessageEvent> = ( detail: IStatusMessageEvent ) => {
                core.removeEventListener(statusMessageEventType, listener);
                received++;
            };
            core.addEventListener(statusMessageEventType, listener);

            await core.connect();
            await core.loadProgram(fs.readFileSync(path.join(__dirname, '../../../test/assets/${deviceName}_xds_blink.out')), false);
            expect(received).equal(1);
        });
    });
});
