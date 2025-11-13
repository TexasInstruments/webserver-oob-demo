/**
 *  Copyright (c) 2019, 2021 Texas Instruments Incorporated
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
 * `ProgramLoaderService` handles downloading a binary file, erasing the target flash and burning the program into flash.
 *
 * @example
 * ```typescript
 * import { ServiceRegistry } from '<path-to>/gc-core-service/lib/ServiceRegistry';
 * import { dsServiceType, debugCoreType } from '<path-to>/gc-service-ds/DSService';
 * import { programLoaderServiceType } from '<path-to>/gc-service-program-loader/lib/ProgramLoadService';
 *
 * const programService = ServicesRegistry.getService(programLoaderServiceType);
 * const dsService = ServicesRegistry.getService(dsServiceType);
 * const [core] = await dsService.listCores(debugCoreType);
 * await core.connect();
 * await programService.loadProgram(core, './target/myprogram.out');
 * await programService.loadSymbols(core, './target/mysymbols.out');
 * await programService.loadBin(core, './target/mybinary.bin');
 * await programService.flash({
 *      connectionName: 'Texas Instruments XDS110 USB Debug Probe',
 *      deviceName: 'MSP432P401R',
 *      coreName: 'Texas Instruments XDS110 USB Debug Probe_0/CORTEX_M4_0',
 *      programOrBinPath: './target/myprogram.out'
 * });
 * ```
 *
 * @packageDocumentation
 */

import { IService, ServiceType, ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { Events, IEvent, EventType, IListener, IEvents } from '../../gc-core-assets/lib/Events';
import { dsServiceType, IDebugCore, statusMessageEventType, IStatusMessageEvent, Location, debugCoreType, targetSupportProgressEventType, ITargetSupportProgressEvent } from '../../gc-service-ds/lib/DSService';
import { GcFiles } from '../../gc-core-assets/lib/GcFiles';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { GcPromise } from '../../gc-core-assets/lib/GcPromise';
import { targetConfigServiceType } from '../../gc-service-target-config/lib/TargetConfigService';

export { statusMessageEventType, IStatusMessageEvent } from '../../gc-service-ds/lib/DSService';

const TIMEOUT_MESSAGE = (param1: string) => `Timeout while loading ${param1}.`;

const DEFAULT_TIMEOUT = 75000;

const MODULE_NAME = 'gc-service-program-loader';
const console = new GcConsole(MODULE_NAME);

const updateFlashProgress = (monitor: IProgressMonitor, message: string, progress: number) => {
    if (monitor.cancelled) {
        console.info('Flash aborted!');
        throw Error('Flash aborted!');

    } else {
        console.info(message);
        monitor.onProgress(message, progress);
    }
};

export interface IProgramLoaderConnectionParams {
    /**
     * The device name, use to create the ccxml file.
     */
    deviceName?: string;

    /**
     * The ccxml file path, if provided it will be used to initialize the target.
     */
    ccxmlPath?: string;

    /**
     * The connection name, use to create the ccxml file.
     */
    connectionName?: string;
}

export interface IProgramLoaderParams {
    /**
     * The core name to load the program. Default is to use the first programmable core found.
     */
    coreName?: string;

    /**
     * The program file path or the binary file path.
     */
    programOrBinPath?: string;

    /**
     * Can be set to true to load symbols only when loading a program.
     */
    symbolsOnly?: boolean;

    /**
     * The path of the program, can be use to verify if the device has the same program before loading a binary file.
     */
    verifyProgramPath?: string;

    /**
     * The load address for loading a binary file.
     */
    loadAddress?: number;

    /**
     * Flag indicating that the target stores programs in static ram instead of flash, so the program
     * needs to be loaded every time the target connects, and not just the first time.
     */
    sram?: boolean;

    /**
     * Timeout in millisecond for flashing/loading image onto the device.
     */
    timeout?: number;
}

export interface IProgressMonitor {
    /**
     * True if the progress is cancelled.
     */
    readonly cancelled: boolean;

    /**
     * Calls when there is an update.
     *
     * @param message the progress message
     * @param progress the progress percentage
     */
    onProgress(message: string, progress: number): void;
}

const DefaultProgressMonitor = new class implements IProgressMonitor {
    get cancelled() {
        return false;
    }

    onProgress(status: string, progress: number) {
        return true;
    }
};

export interface IProgramLoaderService extends IService, IEvents {
    /**
     * Load program into the debug core.
     *
     * @param core the debug core
     * @param programPath the program file path
     * @param verifyProgram true to enable verifying the program
     * @param timeout time out value to override the default
     */
    loadProgram(core: IDebugCore, programPath: string, verifyProgram?: boolean, timeout?: number): Promise<void>;

    /**
     * Load symbols for the debug core.
     *
     * @param core the debug core
     * @param symbolsPath the symbols file path
     * @param timeout time out value to override the default
     */
    loadSymbols(core: IDebugCore, symbolsPath: string, timeout?: number): Promise<void>;

    /**
     * Load a binary image into the debug core. If the program specified by verifyProgramPath successfully verified,
     * then load binary will be skipped.
     *
     * @param core the debug core
     * @param binPath the binary file path
     * @param location the load address
     * @param verifyProgramPath the program file path used to verify before loading the binary
     * @param timeout time out value to override the default
     */
    loadBin(core: IDebugCore, binPath: string, location: Location, verifyProgramPath?: string, timeout?: number): Promise<void>;

    /**
     * Flash the device, the method of flashing will be based the input parameters. If the params.programOrBinPath ends with `.bin`,
     * loadBin will be use to load the program. If params.symbolsOnly is true, loadSymbols will be used to load symbols for the debug
     * core. Otherwise, loadProgram will be used to load the program onto the device.
     *
     * @param params the program loader parameters
     * @param monitor the program monitor for status update and optionally cancel the flash execution
     */
    flash(params: IProgramLoaderParams & IProgramLoaderConnectionParams, monitor?: IProgressMonitor): Promise<void>;
}

export const programLoaderServiceType = new ServiceType<IProgramLoaderService>(MODULE_NAME);
class ProgramLoaderService extends Events implements IProgramLoaderService {
    private dsService = ServicesRegistry.getService(dsServiceType);
    private targetConfigService = ServicesRegistry.getService(targetConfigServiceType);

    addEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        console.logAPI(`${ProgramLoaderService.name}::${this.addEventListener.name}`, ...arguments);

        switch (type as unknown) {
            case statusMessageEventType:
                this.dsService.addEventListener(statusMessageEventType, listener as unknown as IListener<IStatusMessageEvent>);
                break;
        }
        super.addEventListener(type, listener);
    }

    removeEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        console.logAPI(`${ProgramLoaderService.name}::${this.removeEventListener.name}`, ...arguments);

        switch (type as unknown) {
            case statusMessageEventType:
                this.dsService.removeEventListener(statusMessageEventType, listener as unknown as IListener<IStatusMessageEvent>);
                break;
        }
        super.removeEventListener(type, listener);
    }

    async loadProgram(core: IDebugCore, programPath: string, verifyProgram: boolean = false, timeout: number = DEFAULT_TIMEOUT) {
        console.logAPI(this.loadProgram.name, ...arguments);

        this.fireEvent(statusMessageEventType, { type: 'log', message: 'Loading program ...' });

        const binFile = await GcFiles.readBinaryFile(programPath);
        return await GcPromise.timeout(core.loadProgram(binFile, false, verifyProgram), timeout, TIMEOUT_MESSAGE('program'));
    }

    async loadSymbols(core: IDebugCore, symbolsPath: string, timeout: number = DEFAULT_TIMEOUT) {
        console.logAPI(this.loadSymbols.name, ...arguments);

        this.fireEvent(statusMessageEventType, { type: 'log', message: 'Loading symbols ...' });

        const symbolsFile = await GcFiles.readBinaryFile(symbolsPath);
        await GcPromise.timeout(core.loadProgram(symbolsFile, true, false), timeout, TIMEOUT_MESSAGE('symbols'));
    }

    async loadBin(core: IDebugCore, binPath: string, location: Location, verifyProgramPath?: string, timeout: number = DEFAULT_TIMEOUT) {
        console.logAPI(this.loadBin.name, ...arguments);
        this.fireEvent(statusMessageEventType, { type: 'log', message: 'Loading binary ...' });

        if (verifyProgramPath) {
            try {
                const verifyProgramFile = await GcFiles.readBinaryFile(verifyProgramPath);
                await core.verifyProgram(verifyProgramFile);
                this.fireEvent(statusMessageEventType, { type: 'log', message: 'Verify program passed, skip loading program.' });
                return;

            } catch (e) {
                const message = 'Verify program failed, continue loading program.';
                console.info(message);
                this.fireEvent(statusMessageEventType, { type: 'log', message: message });
            }
        }

        const binFile = await GcFiles.readBinaryFile(binPath);
        await GcPromise.timeout(core.loadBin(binFile, location, true), timeout, TIMEOUT_MESSAGE('bin'));
    }

    async flash(params: IProgramLoaderParams & IProgramLoaderConnectionParams, monitor: IProgressMonitor = DefaultProgressMonitor, timeout: number = DEFAULT_TIMEOUT) {
        console.logAPI(this.flash.name, ...arguments);

        if (!params.programOrBinPath) {
            throw Error('Invalid parameters: Missing a programOrBinPath property.');
        }

        let doDeconfig = false;
        try {
            updateFlashProgress(monitor, 'Preparing device configuration file ...', 0);

            let ccxml = undefined;
            if (params.ccxmlPath) {
                ccxml = await GcFiles.readTextFile(params.ccxmlPath);
            } else if (params.deviceName && params.connectionName) {
                ccxml = await this.targetConfigService.getConfig(params.connectionName, params.deviceName);
            } else {
                throw Error(`Missing a "${params.deviceName ? 'connectionId' : params.connectionName ? 'deviceName' : 'ccxmlPath'}" property.`);
            }

            const targetSupportProgressListener = (eventData: ITargetSupportProgressEvent) => {
                this.fireEvent(statusMessageEventType, { type: 'info', message: `${eventData.name} ${eventData.subActivity}` });
            };

            this.dsService.addEventListener(targetSupportProgressEventType, targetSupportProgressListener);
            try {
                updateFlashProgress(monitor, 'Configuring device ...', 15);
                await this.dsService.configure(ccxml);
                doDeconfig = true;
            } finally {
                this.dsService.removeEventListener(targetSupportProgressEventType, targetSupportProgressListener);
            }

            updateFlashProgress(monitor, 'Listing device cores...', 35);
            let cores = await this.dsService.listCores<IDebugCore>(debugCoreType);
            if (cores.length === 0) {
                throw Error(`No debuggable cores found for ${params.deviceName} device".`);
            }
            if (params.coreName) {
                cores = cores.filter(core => core.name === params.coreName);
            }
            const core = cores[0];
            if (!core) {
                throw Error(`No debuggable core="${params.coreName}" found for ${params.deviceName} device.`);
            }

            updateFlashProgress(monitor, `Connecting to core="${core.name}" ...`, 50);
            await core.connect();

            try {
                updateFlashProgress(monitor, 'Flashing device ...', 75);
                if (params.programOrBinPath.endsWith('.bin')) {
                    await this.loadBin(core, params.programOrBinPath, new Location(params.loadAddress ?? 0), params.verifyProgramPath, params.timeout);

                } else if (params.symbolsOnly) {
                    await this.loadSymbols(core, params.programOrBinPath, params.timeout);

                } else {
                    await this.loadProgram(core, params.programOrBinPath, true, params.timeout);
                }

                updateFlashProgress(monitor, 'Flash completed!', 100);
                // to be safe make sure we free run before deConfigure.
                // ...[ PG 3/17/2021
                // The MSP430F5529 launchpad doesn't always run properly if runfree = true.  V2 code base didn't use
                // runfree, except for MSP430F2617, for all devices.  CCs Cloud always uses runFree and has the same issue
                // as I had before this change.
                // ...] params.connectionName && params.connectionName.indexOf('MSP430') >= 0 ? false : true
                await core.run(params.connectionName && params.connectionName.indexOf('MSP430 USB') >= 0 ? false : true);
            } finally {
                await core.disconnect();
            }

        } finally {
            if (doDeconfig) {
                await this.dsService.deConfigure();
            }
        }
    }
}

ServicesRegistry.register(programLoaderServiceType, ProgramLoaderService);