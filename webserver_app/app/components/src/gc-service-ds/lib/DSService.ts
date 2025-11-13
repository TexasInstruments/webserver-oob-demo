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

/**
 * `DSService` provides communication with the DS Lite using the TI Cloud Agent.
 *
 * @example
 * ```typescript
 * import { ServiceRegistry } from '<path-to>/gc-core-service/lib/ServiceRegistry';
 * import { dsServiceType, debugCoreType } from '<path-to>/gc-service-ds/lib/DSService';
 *
 * const service = ServiceRegistry.getService(dsServiceType);
 * await service.configure(ccxmlString);
 * const cores = await service.listCores(debugCoreType);
 * await service.deConfigure();
 * ```
 *
 * @packageDocumentation
 */
import { IEvent, IEvents, EventType } from '../../gc-core-assets/lib/Events';
import { IBackplaneService, backplaneServiceType } from '../../gc-service-backplane/lib/BackplaneService';
import { ServicesRegistry, ServiceType, IService } from '../../gc-core-services/lib/ServicesRegistry';
import { ICore, CoreType, DebugCore, NonDebugCore } from './Core';
import { MODULE_NAME, AbstractDSModule, DSEventType } from './AbstractDSModule';
import { LogType } from '../../gc-core-assets/lib/GcConsole';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';

export * from './AbstractDSModule';
export * from './Core';


export interface IGelOutputEvent extends IEvent {
    /**
     * The GEL message.
     */
    message: string;
}
export const gelOutputEventType = new DSEventType<IGelOutputEvent>('gelOutput');

export interface IConfigChangedEvent extends IEvent {
    /**
     * The affected cores.
     */
    cores: Array<string>;

    /**
     * The affected non-debuggable cores.
     */
    nonDebugCores: Array<string>;
}
export const configChangedEventType = new DSEventType<IConfigChangedEvent>('configChanged');


export interface IStatusMessageEvent extends IEvent {
    /**
     * The message type.
     */
    type: LogType;

    /**
     * Type message.
     */
    message: string;
}
export const statusMessageEventType = new DSEventType<IStatusMessageEvent>('statusMessage');


export interface ITargetSupportProgressEvent extends IEvent {
    /**
     * The progress name.
     */
    name: string;

    /**
     * The current activity.
     */
    subActivity: string;

    /**
     * The progress completion percentage.
     */
    percent: number;
}
export const targetSupportProgressEventType = new EventType<ITargetSupportProgressEvent>('targetSupportProgress');

export interface IDSService extends IService, IEvents {
    /**
     * Configures the DS service.
     *
     * @param ccxml the ccxml file
     */
    configure(ccxml: string): Promise<void>;

    /**
     * Deconfigures the DS service.
     */
    deConfigure(): Promise<void>;

    /**
     * Returns a list of cores.
     *
     * @param coreType the type of cores to filter, undefined to return both debuggable and non-debuggable cores
     */
    listCores<T extends ICore>(coreType?: CoreType<T>): Promise<Array<T>>;
}
export const dsServiceType = new ServiceType<IDSService>(MODULE_NAME);

/**
 * DS service implementation
 */
const backplaneService = ServicesRegistry.getService<IBackplaneService>(backplaneServiceType);
class DSService extends AbstractDSModule implements IDSService {
    private _timeOfLastDeConfigure = 0;
    constructor(private readonly cores: Array<ICore> = []) {
        super('DS');
    }

    public async configure(ccxml: string): Promise<void> {
        this.prolog(this.configure.name, ...arguments);

        // get the file module and write the ccxml file
        const fileModule = await backplaneService.getSubModule('File');
        const { path: ccxmlPath } = await fileModule.write('ds-service.ccxml', await (await backplaneService.getUtil()).encodeAsBase64(ccxml));

        // initialize target support
        if (!GcUtils.isInDesigner && GcUtils.isCloud) {
            const targetSupport = await backplaneService.getSubModule('TargetSupport');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const progressListener = (params: any) => {
                this.fireEvent(targetSupportProgressEventType, params);
            };
            targetSupport.addListener('progress', progressListener);
            await targetSupport.add(ccxmlPath);
            targetSupport.removeListener('progress', progressListener);
        }

        // cache the DS module
        await this.ensureDsModule();

        // Work around for DSLite issue where it crashes if configure is called too soon after deconfigure.
        // TODO: remove this workaround after Jira CCBT-2711, filed against CCBT-2711 is resolved.
        const delay = 250 - Date.now() + this._timeOfLastDeConfigure;
        if (delay > 0) {
            await GcUtils.delay(delay);  // make sure at least 250ms has elapsed since calling deConfigure().
        }

        // configure the ds module with the ccxml path
        const { cores, nonDebugCores } = await this.dsModule.configure(ccxmlPath);

        // get the core module for each core
        this.cores.push(...await Promise.all(cores.map(async (name: string) => new DebugCore(fileModule, name, await this.dsModule.getSubModule(name)))) as Array<ICore>);
        this.cores.push(...await Promise.all(nonDebugCores.map(async (name: string) => new NonDebugCore(fileModule, name, await this.dsModule.getSubModule(name)))) as Array<ICore>);
    }

    public async deConfigure(): Promise<void> {
        this.prolog(this.deConfigure.name, ...arguments);

        if (this.dsModule) {
            this.cores.splice(0, this.cores.length);
            await this.dsModule.deConfigure();
            this._timeOfLastDeConfigure = Date.now();
        }
    }

    public async listCores<T extends ICore>(coreType?: CoreType<T>): Promise<Array<T>> {
        this.prolog(this.listCores.name, ...arguments);

        return this.cores.filter(e => !coreType || coreType.asCore(e)) as Array<T>;
    }
}
ServicesRegistry.register(dsServiceType, DSService);