import '../../gc-core-assets/lib/NodeJSEnv';
import { processArgs } from '../../gc-core-assets/test/TestArgs';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { targetConfigServiceType } from '../lib/TargetConfigService';
import { expect } from 'chai';

/** Enabled Logging *********************************************************************************************************** */
GcConsole.setLevel('targetConfigService', processArgs.enableLog);
/** *************************************************************************************************************************** */

describe('targetConfigService', () => {
    const targetConfigService = ServicesRegistry.getService(targetConfigServiceType);

    it('getConfigInfo', async function() {
        const info = await targetConfigService.getConfigInfo();
        expect(info).to.have.property('devices');
        expect(info).to.have.property('connections');
    });

    it('getConfig', async function() {
        expect(await targetConfigService.getConfig('Texas Instruments XDS110 USB Debug Probe', 'MSP432P401R')).is.not.empty;
        try {
            expect(await targetConfigService.getConfig('bad', 'f00d'));
            expect.fail('getConfig should failed with deviceName=bad connectionName=f00d');
        } catch (e) {
            expect(e.message).eq('Invalid connectionName and/or deviceName');
        }
    });

    it('getDevices', async function() {
        expect(await targetConfigService.getDevices()).to.have.length.greaterThan(0);
    });

    it('getConnections', async function() {
        const device = (await targetConfigService.getDevices())[0];
        const connections = await targetConfigService.getConnections(device.id);
        expect(connections).length.greaterThan(0);
        expect(connections[0]).to.have.property('id');
        expect(connections[0]).to.have.property('xmlFile');
        expect(connections[0]).to.have.property('connectionType');

        try {
            await targetConfigService.getConnections('badf00d');
            expect.fail('getConnections should failed with deviceName=badf00d');
        } catch (e) {
            expect(e.message).eq('Invalid deviceName');
        }
    });

    it('getDefaultConnection', async function() {
        const device = (await targetConfigService.getDevices())[0];
        const connection = await targetConfigService.getDefaultConnection(device.id);
        expect(connection).to.have.property('id');
        expect(connection).to.have.property('xmlFile');
        expect(connection).to.have.property('connectionType');

        try {
            await targetConfigService.getDefaultConnection('badf00d');
            expect.fail('getDefaultConnection should failed with deviceName=badf00d');
        } catch (e) {
            expect(e.message).eq('Invalid deviceName');
        }
    });

    it('should return a valid ccxml file for F5529 device', async () => {
        const deviceName = 'MSP430F5529';
        const connectionId = 'TI MSP430 USB1';
        const ccxmlFile = await targetConfigService.getConfig(connectionId, deviceName);
        expect(ccxmlFile).to.exist;
        const expectedFile = [
            '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
            '<configurations XML_version="1.2" id="configurations_0">',
            '<configuration XML_version="1.2" id="configuration_0">',
            '<instance XML_version="1.2" desc="TI MSP430 USB1" href="connections/TIMSP430-USB.xml" id="TI MSP430 USB1" xml="TIMSP430-USB.xml" xmlpath="connections"/>',
            '<connection XML_version="1.2" id="TI MSP430 USB1">',
            '<instance XML_version="1.2" href="drivers/msp430_emu.xml" id="drivers" xml="msp430_emu.xml" xmlpath="drivers"/>',
            '<platform XML_version="1.2" id="platform_0">',
            '<instance XML_version="1.2" desc="MSP430F5529" href="devices/MSP430F5529.xml" id="MSP430F5529" xml="MSP430F5529.xml" xmlpath="devices"/>',
            '</platform>',
            '</connection>',
            '</configuration>',
            '</configurations>'
        ];
        const ccxmlFileLines = ccxmlFile.split('\n').filter(line => line.trim().length > 0);
        expect(ccxmlFileLines.length).to.equal(expectedFile.length);
        for (let i = 0; i < expectedFile.length; i++ ) {
            expect(ccxmlFileLines[i].trim()).to.equal(expectedFile[i]);
        }
    });

});