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
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { codecRegistry, AbstractTransport } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { IProgramModelEncoder, ProgramModelEncoderType, ProgramModelDecoderType, IProgramModelDecoder, IProgramModelParams } from '../../gc-model-program/lib/ProgramModel';
import { dsServiceType, debugCoreType, IDebugCore, IStatusMessageEvent, statusMessageEventType, targetSupportProgressEventType, ITargetSupportProgressEvent } from '../../gc-service-ds/lib/DSService';
import { Location } from '../../gc-service-ds/lib/Core';
import { GcFiles } from '../../gc-core-assets/lib/GcFiles';
import { bindValueType } from '../../gc-core-databind/lib/CoreDatabind';
import { IProgramLoaderConnectionParams, programLoaderServiceType } from '../../gc-service-program-loader/lib/ProgramLoaderService';
import { ICodecBaseParams } from '../../gc-target-configuration/lib/ICodecBaseParams';
import { targetConfigServiceType } from '../../gc-service-target-config/lib/TargetConfigService';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IXdsTransportParams extends IProgramLoaderConnectionParams, ICodecBaseParams {
}

export class XdsTransport extends AbstractTransport implements IProgramModelEncoder {
    public encoderInputType = ProgramModelEncoderType;
    public encoderOutputType = ProgramModelDecoderType;
    private ccxmlFileContents?: Promise<string>;
    private priorCcxmlFileParams?: string;
    private activeCoreMap = new Map<string, IDebugCore>(); // map of core names and aliases to active debuggable cores.
    private activeCoreList: IDebugCore[] = [];   // list of active debuggable cores currently connected.
    protected console: GcConsole;

    constructor(readonly params: IXdsTransportParams, private readonly serialPort?: () => Promise<[string, number]>) {
        super();

        this.console = new GcConsole('gc-transport-xds', this.id);

        connectionManager.registerTransport(this);
        codecRegistry.register(this);
    }

    get isXdsTransport() {
        return true;
    }

    get id() {
        return this.params.id || 'xds';
    }

    private getCcxmlFileContents(): Promise<string> {
        // use cached ccxml file if available, and params have not changed.
        const ccxmlParams = `${this.params.ccxmlPath || '*'}-${this.params.deviceName || '*'}-${this.params.connectionName || '*'}`;
        if (this.priorCcxmlFileParams !== ccxmlParams || !this.ccxmlFileContents) {
            if (this.params.ccxmlPath) {
                this.ccxmlFileContents = GcFiles.readTextFile(this.params.ccxmlPath);
            } else {
                const connectionType = this.serialPort ? 'UARTConnection' : this.params.connectionName;

                if (!connectionType || !this.params.deviceName) {
                    throw Error(`Missing ${connectionType ? 'device' : 'connection'}-name for <gc-transport-xds${this.params.id ? ' id="' + this.params.id + '"' : ''}>`);
                }
                const targetConfigService = ServicesRegistry.getService(targetConfigServiceType);
                this.ccxmlFileContents = targetConfigService.getConfig(connectionType, this.params.deviceName);
            }
        }
        return this.ccxmlFileContents;
    }

    clearCcxmlFileContentsCache() {
        this.ccxmlFileContents = undefined;
        this.priorCcxmlFileParams = undefined;
    }

    async onConnect() {
        if (this.activeCoreMap.size !== 0) {
            throw Error('Programmer Error: this.activeCoreMap is not empty.');
        }

        let ccxml = await this.getCcxmlFileContents();

        if (this.serialPort) {
            this.assertStillConnecting();
            const [comName, baudRate] = await this.serialPort();

            const configService = ServicesRegistry.getService(targetConfigServiceType);
            if (this.params.deviceName) {
                ccxml = configService.addCpuPropertiesToCCxmlFile(ccxml, this.params.deviceName,
                    '<property Type="stringfield" Value="%SERIALPORT%" id="COM Port"/>\n' +
                    '<property Type="stringfield" Value="%BAUDRATE%" id="Baud Rate"/>\n'
                );
            }
            ccxml = ccxml.replace(/%SERIALPORT%/g, comName);
            ccxml = ccxml.replace(/%BAUDRATE%/g, '' + baudRate);

            this.setConnectionDescription(`${comName}:${baudRate}`);
        }

        this.assertStillConnecting();

        const targetSupportProgressListener = (eventData: ITargetSupportProgressEvent) => {
            this.addProgressMessage(`${eventData.name} ${eventData.subActivity}`);
        };

        const ds = ServicesRegistry.getService(dsServiceType);
        ds.addEventListener(targetSupportProgressEventType, targetSupportProgressListener);
        try {
            await ds.configure(ccxml);
            this.console.debug('configured debug server');
        } finally {
            ds.removeEventListener(targetSupportProgressEventType, targetSupportProgressListener);
        }
    }

    async onDisconnect() {
        const ds = ServicesRegistry.getService(dsServiceType);
        if (!this.serialPort) {
            for (let i = 0; i < this.activeCoreList.length; i++) {
                const core = this.activeCoreList[i];
                try {
                    await core.disconnect();
                } catch (e) {
                    this.console.warning(`Disconnecting from core=${core.name} failed: ${e.message || e.toString()}`);
                }
            }
        }
        this.activeCoreMap.clear();
        this.activeCoreList = [];

        await ds.deConfigure();
    }

    addChildDecoder(decoder: IProgramModelDecoder) {
    }

    deconfigure() {
    }

    dispose() {
        connectionManager.unregisterTransport(this);
        codecRegistry.unregister(this);
    }

    readValue(expression: string, coreName?: string): Promise<bindValueType> {
        const core = this.activeCoreMap.get(coreName || 'active');
        if (!core) {
            throw Error('Cannot read value when target is disonnected');
        }
        return core.readValue(expression);
    }

    writeValue(expression: string, value: bindValueType, coreName?: string): Promise<void> {
        const core = this.activeCoreMap.get(coreName || 'active');
        if (!core) {
            throw Error('Cannot write value when target is disonnected');
        }
        return core.writeValue(expression, value);
    }

    async initCore(params: IProgramModelParams, programAlreadyLoaded = false) {
        const coreName = params.coreName || 'active';

        this.assertStillConnecting();

        const ds = ServicesRegistry.getService(dsServiceType);
        const cores = await ds.listCores(debugCoreType);
        if (cores.length <= 0) {
            throw Error('Target configuration has no debugable cores.');
        }
        let activeCore: IDebugCore | undefined = cores[0];
        if (params.coreName) {
            activeCore = cores.reduce((pick: IDebugCore | undefined, core) => core.name.endsWith(params.coreName!) ? core : pick, undefined);
            if (!activeCore) {
                throw Error(`Target configuration has no debugable core named ${params.coreName}`);
            }
        }

        this.console.debug(`active core: ${activeCore.toString()}`);

        if (!this.activeCoreList.includes(activeCore)) {

            this.assertStillConnecting();
            if (!this.serialPort) {
                await activeCore.connect();
            }
            try {
                const loaderService = ServicesRegistry.getService(programLoaderServiceType);

                if (!params.programOrBinPath) {
                    throw Error(`Missing a programOrBinPath property for core=${coreName}.`);
                }

                this.assertStillConnecting();

                const coreDescription = params.coreName ? ` core="${params.coreName}"` : '';
                const description = `device="${this.deviceId || this.params.deviceName}"${coreDescription}`;

                const callback = (details: IStatusMessageEvent) => {
                    switch (details.type) {
                        case 'info':
                            this.addProgressMessage(details.message);
                            break;
                        case 'error':
                            this.addErrorMessage(details.message);
                            break;
                        case 'warning':
                            this.addWarningMessage(details.message);
                            break;
                    }
                };
                try {
                    loaderService.addEventListener(statusMessageEventType, callback);
                    if (params.programOrBinPath.endsWith('.bin')) {
                        this.addProgressMessage(`Loading binary image for ${description} ...`);
                        await loaderService.loadBin(activeCore, params.programOrBinPath, new Location(params.loadAddress ?? 0), params.verifyProgramPath, params.timeout);
                    } else if (params.symbolsOnly || programAlreadyLoaded || this.serialPort) {
                        this.addProgressMessage(`Loading symbols for ${description} ...`);
                        await loaderService.loadSymbols(activeCore, params.programOrBinPath, params.timeout);
                    } else {
                        this.addProgressMessage(`Loading program for ${description} ...`);
                        await loaderService.loadProgram(activeCore, params.programOrBinPath, true, params.timeout);
                    }
                } catch (e) {
                    throw Error(`Loading program for ${description} failed: ${e.message || e.toString()}`);
                } finally {
                    loaderService.removeEventListener(statusMessageEventType, callback);
                }

                if ((!this.serialPort)) {
                    this.assertStillConnecting();
                    await activeCore.run();
                }

            } catch (err) {
                if (!this.serialPort) {
                    await activeCore.disconnect();
                }
                throw err;
            }
            this.activeCoreList.push(activeCore);
            this.activeCoreMap.set(activeCore.name, activeCore);
        }
        this.activeCoreMap.set(coreName, activeCore);
    }
}
