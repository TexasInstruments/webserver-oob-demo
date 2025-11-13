import '../../gc-core-assets/lib/NodeJSEnv';
import { expect } from 'chai';
import { processArgs } from '../../gc-core-assets/test/TestArgs';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { GcFiles } from '../../gc-core-assets/lib/GcFiles';
import * as Path  from 'path';
import { Version, V1_5_0, V3_0_0, MigrationManager } from '../../gc-core-migration/migration/MigrationManager';

/** Enabled Logging *********************************************************************************************************** */
const console = new GcConsole('ti-widget-button');
console.setLevel(processArgs.enableLog);
/** *************************************************************************************************************************** */

describe('ti-widget-button-migrator', () => {
    it('v1.5.0 -> v3.0.0', async () => {
        const testInput = await GcFiles.readTextFile(Path.join(__dirname, './assets/v1.x.x-v3.0.0-migration-input.html'));
        const testExpect = await GcFiles.readTextFile(Path.join(__dirname, './assets/v1.x.x-v3.0.0-migration-expect.html'));
        const migrationManager = new MigrationManager(
            console,
            Path.join(__dirname, './assets/migration-collection-manifest.json'),
            Path.join(__dirname, '../../../@ti-migrator'));
        await migrationManager.migrateHTML(testInput, V1_5_0, V3_0_0);
        expect(migrationManager.getHtml()).to.equal(testExpect);
    });
});