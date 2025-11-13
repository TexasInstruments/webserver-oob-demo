/**
 *  Copyright (c) 2019, 2020 Texas Instruments Incorporated
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
// eslint-disable-next-line @typescript-eslint/no-empty-interface

/**
 * @packageDocumentation
 */

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IService {
};

export interface IServiceFactory<T extends IService> {
    new(): T;
};

export class ServiceType<T extends IService> {
    constructor(public readonly serviceName: string) {
    }
    get instance(): T {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const instance = ServicesRegistry.getService<T>(this);
        if (!instance) {
            throw new Error(`Missing IServiceFactory for ServiceType.serviceName = ${this.serviceName}`);
        }
        return instance;
    }
};

interface ServiceRegistryEntry {
    factory: IServiceFactory<IService>;
    instance?: IService;
    prev?: ServiceRegistryEntry;
};

export class ServicesRegistry {
    private static services = new Map<ServiceType<IService>, ServiceRegistryEntry>();

    static register<T extends IService>(serviceType: ServiceType<T>, serviceFactory: IServiceFactory<T>) {
        const prior = this.services.get(serviceType);
        this.services.set(serviceType, { factory: serviceFactory, prev: prior });
    };

    static unregister<T extends IService>(serviceType: ServiceType<T>, serviceFactory: IServiceFactory<T>) {
        const current = this.services.get(serviceType);
        const prior = current?.prev;
        if (!prior) {
            throw Error('Programmer Error: You cannot unregister the original service.  You can only unregister testing stubs that you haved added.');
        } else if (current!.factory !== serviceFactory) {
            throw Error('Programmer Error: Out of sequence unregister call.  You have to unregister in order.  In this case, the factory didn\'t match the current serviceType.');
        }
        this.services.set(serviceType, prior);
    };

    static getService<T extends IService>(serviceType: ServiceType<T>): T {
        const serviceEntry = this.services.get(serviceType);
        if (!serviceEntry) {
            throw new Error(`Service ${serviceType.serviceName} was not found.`);
        }
        if (!serviceEntry.instance && serviceEntry.factory) {
            serviceEntry.instance = new serviceEntry.factory();
        }
        return serviceEntry.instance as T;
    };
};