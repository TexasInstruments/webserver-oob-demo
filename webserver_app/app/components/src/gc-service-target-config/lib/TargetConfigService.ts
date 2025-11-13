/**
 *  Copyright (c) 2020, 2021 Texas Instruments Incorporated
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *  *   Redistributions of source code must retain the above copyright
 *  notice, this list of conditions and the following disclaimer.
 *  notice, this list of conditions and the following disclaimer in the
 *  documentation and/or other materials provided with the distribution.
 *  *   Neither the name of Texas Instruments Incorporated nor the names of
 *  its contributors may be used to endorse or promote products derived
 *  from this software without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 *  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 *  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 *  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 *  OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 *  OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 *  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-var-requires */

import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { ServicesRegistry, ServiceType } from '../../gc-core-services/lib/ServicesRegistry';
import { IEvents, Events } from '../../gc-core-assets/lib/Events';

import { ITargetConfig } from './internal/TargetConfig';

type Connection = {
    id: string;
    connectionType: string;
    xmlFile: string;
};

type Device = {
    id: string;
    xmlFile: string;
    connectionIndices: Array<number>;
    defaultConnectionIndex: number;
};

type ConfigInfo = {
    connections: Array<Connection>;
    devices: Array<Device>;
};

export interface ITargetConfigService extends IEvents {
    /**
     * Returns the configuration info JSON object, which contains connections and devices.
     */
    getConfigInfo(): Promise<ConfigInfo>;

    /**
     * Returns the target configuration ccxml file for the given connection name and device name.
     *
     * @param connectionName the connection name
     * @param deviceName the device name
     */
    getConfig(connectionName: string, deviceName: string): Promise<string>;

    /**
     * Returns the list of device objects.
     */
    getDevices(): Promise<Array<Device>>;

    /**
     * Returns the list of connection objects for the given device name.
     *
     * @param deviceName the device name
     */
    getConnections(deviceName: string): Promise<Array<Connection>>;

    /**
     * Returns the default connection object for the given device name.
     *
     * @param deviceName the device name
     */
    getDefaultConnection(deviceName: string): Promise<Connection>;

    /**
     * Helper method to modify a ccxml file to override cpu properties.  This method only works if there are no
     * overrides already in the ccxml file, or in other words, if there is no expanded cpu tag in the device.  This
     * means that you can only add cpu properties once, so all property tags must be added in a single call to
     * this helper method.
     *
     * @param ccxmlFileText the original ccxmlFile without overridden cpu properties.
     * @param deviceName the device name
     * @param cpuPropertiesText the property tags to insert into the cpu tag to override the default cpu properties.
     * @returns the modified ccxmlFileText with the cpuPropertiesText inserted.
     */
    addCpuPropertiesToCCxmlFile(ccxmlFileText: string, deviceName: string, cpuPropertiesText: string): string;
}

const MODULE_NAME = 'gc-service-target-configuration';
const console = new GcConsole(MODULE_NAME);

export const targetConfigServiceType = new ServiceType<ITargetConfigService>(MODULE_NAME);

export class TargetConfigService extends Events implements ITargetConfigService {
    private readonly targetConfig?: ITargetConfig;
    private configInfoCache?: ConfigInfo;

    constructor() {
        super();

        if (GcUtils.isNodeJS) {
            const path = require('path');
            const TargetConfig = require('./internal/TargetConfig').TargetConfig;
            this.targetConfig = new TargetConfig(path.resolve(__dirname, GcUtils.runtimeRoot));
        }
    }

    private async getConnectionXml(connectionName: string) {
        const configInfo = await this.getConfigInfo();
        const result = configInfo?.connections.find((connection) => {
            if (connection.id === connectionName) {
                return connection;
            }
        });
        return result?.xmlFile;
    }

    private async getDeviceXml(deviceName: string) {
        const configInfo = await this.getConfigInfo();
        const result = configInfo?.devices.find((device) => {
            if (device.id === deviceName) {
                return device;
            }
        });
        return result?.xmlFile;
    }

    async getConfigInfo(): Promise<ConfigInfo> {
        console.logAPI(this.getConfigInfo.name, ...arguments);
        if (this.configInfoCache) {
            return this.configInfoCache;
        }

        let result = undefined;
        if (GcUtils.isNodeJS && this.targetConfig) {
            result = await this.targetConfig.getConfigInfo(GcUtils.OS);

        } else {
            const response = await fetch(`/ticloudagent/getConfigInfo?os=${GcUtils.OS}`);
            result =  await response.text();
        }

        result = this.configInfoCache = JSON.parse(result);
        return result;
    }

    async getConfig(connectionName: string, deviceName: string): Promise<string> {
        console.logAPI(this.getConfig.name, ...arguments);

        const connectionXml = await this.getConnectionXml(connectionName);
        const deviceXml = await this.getDeviceXml(deviceName);

        if (connectionXml && deviceXml) {
            if (GcUtils.isNodeJS && this.targetConfig) {
                return await this.targetConfig?.getConfig(GcUtils.OS, connectionXml, deviceXml);

            } else {
                const response = await fetch(`/ticloudagent/getConfig/${GcUtils.OS}/${connectionXml}/${deviceXml}`);
                return await response.text();
            }

        } else {
            throw Error('Invalid connectionName and/or deviceName');
        }
    }

    async getDevices(): Promise<Array<Device>> {
        console.logAPI(this.getDevices.name, ...arguments);
        const info = await this.getConfigInfo();
        return info.devices;
    }

    async getConnections(deviceName?: string): Promise<Array<Connection>> {
        console.logAPI(this.getConnections.name, ...arguments);
        const connections = new Array<Connection>();

        const info = await this.getConfigInfo();
        for (let i = 0; i < info.devices.length; ++i) {
            const device = info.devices[i];
            if (device.id === deviceName) {
                device.connectionIndices.forEach(index => {
                    connections.push(info.connections[index]);
                });
            }
        }

        if (connections.length > 0) {
            return connections;
        }

        throw Error('Invalid deviceName');
    }

    async getDefaultConnection(deviceName: string): Promise<Connection> {
        console.logAPI(this.getDefaultConnection.name, ...arguments);

        const info = await this.getConfigInfo();
        for (let i = 0; i < info.devices.length; ++i) {
            const device = info.devices[i];
            if (device.id === deviceName) {
                return info.connections[device.defaultConnectionIndex];
            }
        }

        throw Error('Invalid deviceName');
    }

    addCpuPropertiesToCCxmlFile(ccxmlFileContents: string, deviceName: string, cpuProperties: string) {
        console.logAPI(this.addCpuPropertiesToCCxmlFile.name, ...arguments);

        // only fix up the ccxml file if it doesn't include a <cpu tag
        if (ccxmlFileContents.indexOf('<cpu') < 0) {
            // Split the ccxml file after the <instance ... tag for the device, i.e. before the </platform> tag
            const splitIndex = ccxmlFileContents.indexOf('</platform>');
            if (splitIndex > 0) {
                const ccxmlStrPart1 = ccxmlFileContents.substring(0, splitIndex);
                const ccxmlStrPart2 = ccxmlFileContents.substring(splitIndex);
                let ccxmlStrInsert = '';
                // the id used for the <instance tag must be used for the device tag or the ccxml file will not parse properly
                let instanceId = deviceName;
                const instanceIdIndex = ccxmlStrPart1.lastIndexOf('id="');
                if (instanceIdIndex >= 0) {
                    instanceId = ccxmlStrPart1.substring(instanceIdIndex + 'id="'.length);
                    instanceId = instanceId.substring(0, instanceId.indexOf('"'));
                }
                const deviceNameUC = deviceName.toUpperCase();
                if ((deviceNameUC.indexOf('MSP430') >= 0) || (deviceNameUC.indexOf('RF430') >= 0) || (deviceNameUC.indexOf('CC43') >= 0)) {
                    ccxmlStrInsert = '<device HW_revision="1.0" XML_version="1.2" description="%DEVICE%" id="'+instanceId+'" partnum="%DEVICE%">\n' +
                                                '<cpu HW_revision="1.0" XML_version="1.2" description="MSP430 CPU" id="MSP430" isa="MSP430">\n' +
                                                '%CPU_PROPERTIES%' +
                                                '</cpu>\n' +
                                                '</device>\n';
                } else if ((deviceNameUC.indexOf('MSP432') >= 0) || (deviceNameUC.indexOf('TM4C') >= 0)) {
                    ccxmlStrInsert = '<device HW_revision="1" XML_version="1.2" description="ARM Cortex-M4F MCU" id="'+instanceId+'" partnum="%DEVICE%">\n' +
                                                '<router HW_revision="1.0" XML_version="1.2" description="CS_DAP Router" id="CS_DAP_0" isa="CS_DAP">\n' +
                                                '<subpath id="subpath_0">\n' +
                                                '<cpu HW_revision="1.0" XML_version="1.2" description="Cortex M4 CPU" id="CORTEX_M4_0" isa="CORTEX_M4">\n' +
                                                '%CPU_PROPERTIES%' +
                                                '</cpu>\n' +
                                                '</subpath>\n' +
                                                '</router>\n'+
                                                '</device>\n';
                } else if (deviceNameUC.indexOf('TMS320F28') >= 0) {
                    ccxmlStrInsert = '<device HW_revision="1" XML_version="1.2" description="" id="'+instanceId+'" partnum="%DEVICE%">\n' +
                                                '<router HW_revision="1.0" XML_version="1.2" description="ICEPick_C router" id="IcePick_C_0" isa="ICEPICK_C">\n' +
                                                '<subpath id="Subpath_0">\n' +
                                                '<cpu HW_revision="1.0" XML_version="1.2" description="C28xx CPU" id="C28xx_CPU1" isa="TMS320C28XX">\n' +
                                                '%CPU_PROPERTIES%' +
                                                '</cpu>\n' +
                                                '</subpath>\n' +
                                                '</router>\n' +
                                                '</device>\n';
                } else if (deviceNameUC.indexOf('TMS320C28') >= 0){
                    ccxmlStrInsert = '<device HW_revision="1" XML_version="1.2" description="" id="'+instanceId+'" partnum="%DEVICE%">\n' +
                                                '<cpu HW_revision="1.0" XML_version="1.2" description="CPU" id="C2800" isa="TMS320C28XX">\n' +
                                                '%CPU_PROPERTIES%' +
                                                '</cpu>\n' +
                                                '</device>\n';
                } else if ((deviceNameUC.indexOf('CC13') >= 0) || (deviceNameUC.indexOf('CC26') >= 0)) {
                    ccxmlStrInsert = '<device HW_revision="1" XML_version="1.2" description="SimpleLink(TM) %DEVICE% wireless MCU" id="'+instanceId+'" partnum="%DEVICE%">\n' +
                                                '<router HW_revision="1.0" XML_version="1.2" description="ICEPick_C Router" id="IcePick_C_0" isa="ICEPICK_C">\n' +
                                                '<subpath id="subpath_0">\n' +
                                                '<router HW_revision="1.0" XML_version="1.2" description="CS_DAP Router" id="CS_DAP_0" isa="CS_DAP">\n' +
                                                '<subpath id="subpath_1">\n' +
                                                '<cpu HW_revision="1.0" XML_version="1.2" description="Cortex_M3 CPU" id="Cortex_M3_0" isa="Cortex_M3">\n' +
                                                '%CPU_PROPERTIES%' +
                                                '</cpu>\n' +
                                                '</subpath>\n' +
                                                '</router>\n' +
                                                '</subpath>\n' +
                                                '</router>\n' +
                                                '</device>\n';
                } else if (deviceNameUC.indexOf('F28M') >= 0){
                    ccxmlStrInsert = '<device HW_revision="1" XML_version="1.2" description="" id="'+instanceId+'" partnum="%DEVICE%">\n' +
                                                '<router HW_revision="1.0" XML_version="1.2" description="ICEPick_C router" id="IcePick_C_0" isa="ICEPICK_C">\n' +
                                                '<subpath id="C28x">\n' +
                                                '<property Type="numericfield" Value="0x11" desc="Port Number_0" id="Port Number"/>\n' +
                                                '<cpu HW_revision="1.0" XML_version="1.2" description="C28xx CPU" id="C28xx_0" isa="TMS320C28XX">\n' +
                                                '%CPU_PROPERTIES%' +
                                                '</cpu>\n' +
                                                '</subpath>\n' +
                                                '</router>\n' +
                                                '</device>\n';
                }
                if (ccxmlStrInsert.length > 0 && deviceName) {
                    ccxmlStrInsert = ccxmlStrInsert.replace(/%DEVICE%/g, deviceName);
                    ccxmlStrInsert = ccxmlStrInsert.replace(/%CPU_PROPERTIES%/g, cpuProperties);
                    ccxmlFileContents = ccxmlStrPart1 + ccxmlStrInsert + ccxmlStrPart2;
                }
            }

        }
        return ccxmlFileContents;
    }
}

ServicesRegistry.register(targetConfigServiceType, TargetConfigService);