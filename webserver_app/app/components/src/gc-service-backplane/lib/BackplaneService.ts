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
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-async-promise-executor */

/**
 * Entry point to the `TI Cloud Agent (TICA)`. The `TICA` bridges the communication between the browser and
 * local node modules running on the user's computer, such as the `DSLite` module and the `File` module.
 *
 * **Important:** Import the `<path-to>/gc-core-assets/lib/NodeJSEnv` polyfill module before using
 * this module in the NodeJS environment.
 *
 * @example
 * ```typescript
 * import { ServiceRegistry } from '<path-to>/gc-core-service/lib/ServiceRegistry';
 * import { IBackplaneService, backplaneServiceType } from '<path-to>/lib/gc-service-backplane/lib/BackplaneService';
 *
 * const service = ServiceRegistry.getService(backplaneServiceType);
 * const module = service.getSubModule('File);
 * ```
 *
 * @packageDocumentation
 */
import { ServicesRegistry, ServiceType } from '../../gc-core-services/lib/ServicesRegistry';
import { Events, IEvents, IEvent, EventType } from '../../gc-core-assets/lib/Events';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import './internal/q.js';

declare global {
    interface Window {
        TICloudAgent: any;
    }
}

const MODULE_NAME = 'gc-service-backplane';
const console = new GcConsole(MODULE_NAME);

/**
 * Backplane service type.
 */
export const backplaneServiceType = new ServiceType<IBackplaneService>(MODULE_NAME);

/**
 * `IBackplaneService` provides communication between the client and the TI Cloud Agent.
 */
export interface IBackplaneService extends IEvents {

    /**
     * Returns the Cloud Agent sub-module.
     *
     * @param name the name of the sub-module.
     */
    getSubModule(name: string): Promise<any>;

    /**
     * Returns the Cloud Agent util.
     */
    getUtil(): Promise<any>;
};

/**
 * Backplane service error.
 */
export interface IErrorEvent extends IEvent {
    /**
     * List of error.
     */
    errors: Error[];
}
export const errorEventType = new EventType<IErrorEvent>('errorEvent');

class BackplaneService extends Events implements IBackplaneService {
    private initPromise?: Promise<{ agent: any; TICloudAgent: any }>;

    private async init(): Promise<{ agent: any; TICloudAgent: any }> {
        if (!this.initPromise) {
            console.logAPI(this.init.name, ...arguments);
            this.initPromise = new Promise(async(resolve, reject) => {
                let agent: any, TICloudAgent: any;

                try {
                    /* NodeJs environment */
                    if (GcUtils.isNodeJS) {
                        /*
                        * Gets runtimeRoot in the following cases
                        *    Running from a standalone package
                        *    Running from source
                        */
                        const runtimeRoot = GcUtils.runtimeRoot;

                        require('../../gc-core-assets/lib/NodeJSEnv');
                        require(`${runtimeRoot}/ticloudagent/server/public/agent`);
                        const agentHost = require(`${runtimeRoot}/TICloudAgentHostApp/src/host_agent`);
                        const info = await agentHost.start();
                        agent = await global.TICloudAgent.createClientModule(info.port);
                        TICloudAgent = global.TICloudAgent;

                    /* Browser environment */
                    } else  {
                        /* externalize the path to workaround rollup */
                        const agentPath = '/ticloudagent/agent.js';

                        //@ts-ignore
                        await import(agentPath);
                        TICloudAgent = window.parent.TICloudAgent || window.TICloudAgent;
                        agent = await TICloudAgent.Init();
                    }

                    resolve({ agent: agent, TICloudAgent: TICloudAgent });
                } catch (e) {
                    const errors = [];

                    if (Array.isArray(e)) {
                        e.forEach(error => errors.push(error));
                    } else {
                        errors.push(e);
                    }

                    this.fireEvent(errorEventType, { errors: errors });
                    reject(e);
                }
            });
        }

        return this.initPromise;
    }

    public async getSubModule(name: string): Promise<any> {
        console.logAPI(this.getSubModule.name, ...arguments);

        const { agent } = await this.init();
        return agent.getSubModule(name);
    }

    public async getUtil(): Promise<any> {
        console.logAPI(this.getUtil.name, ...arguments);

        const { TICloudAgent } = await this.init();
        return Promise.resolve(TICloudAgent.Util);
    }
}
ServicesRegistry.register(backplaneServiceType, BackplaneService);