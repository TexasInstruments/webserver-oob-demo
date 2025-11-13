/**
 *  Copyright (c) 2020, Texas Instruments Incorporated
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

import { Events, IEvent, EventType, IListener } from '../../gc-core-assets/lib/Events';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { IBackplaneService, backplaneServiceType } from '../../gc-service-backplane/lib/BackplaneService';

/**
 * @hidden
 */
export const MODULE_NAME = 'gc-service-ds';
const console = new GcConsole(MODULE_NAME);

export class DSEventType<T> extends EventType<T> {
    dsEventType = true;
    constructor(eventName: string, public readonly subObjectName?: string) {
        super(eventName);
    }
}

/**
 * @hidden
 */
export abstract class AbstractDSModule extends Events {
    protected dsModule: any;
    protected initPromise?: Promise<any>;
    constructor(protected readonly moduleName: string, dsModule?: any) {
        super();
        this.dsModule = dsModule;
    }

    protected async ensureDsModule() {
        if (!this.dsModule) {
            const backplaneService = ServicesRegistry.getService<IBackplaneService>(backplaneServiceType);
            this.dsModule = await backplaneService.getSubModule('DS');
        }
    }

    protected prolog(apiName: string, ...params: Array<any>) {
        console.logAPI(apiName, ...params);
    }

    public toString() {
        return this.moduleName;
    }

    protected isDSEvent<T>(object: EventType<T>): object is DSEventType<T> {
        return 'dsEventType' in object;
    }

    addEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        this.prolog(this.addEventListener.name, ...arguments);

        if (this.isDSEvent(type)) {
            this.ensureDsModule().then(() => {
                if (type.subObjectName) {
                    this.dsModule[type.subObjectName].addListener(type.eventName, listener);
                } else {
                    this.dsModule.addListener(type.eventName, listener);
                }
            });
        } else {
            super.addEventListener(type, listener);
        }
    }

    removeEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T> | undefined) {
        this.prolog(this.removeEventListener.name, ...arguments);

        if (this.isDSEvent(type)) {
            this.ensureDsModule().then(() => {
                if (type.subObjectName) {
                    this.dsModule[type.subObjectName].removeListener(type.eventName, listener);
                } else {
                    this.dsModule.removeListener(type.eventName, listener);
                }
            });
        } else {
            super.removeEventListener(type, listener);
        }
    }
}