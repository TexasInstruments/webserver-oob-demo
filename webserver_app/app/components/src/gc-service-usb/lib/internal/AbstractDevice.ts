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

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { IEvent, EventType, IEvents, Events } from '../../../gc-core-assets/lib/Events';
import { GcConsole } from '../../../gc-core-assets/lib/GcConsole';

export interface IErrorEvent extends IEvent {
    /**
     * The error.
     */
    error: Error;
}
export interface IOpenedEvent extends IEvent {}
export interface IClosedEvent extends IEvent {}
export interface IDataEvent extends IEvent {
    /**
     * The data buffer.
     */
    data: Buffer;
}

export const openedEventType = new EventType<IOpenedEvent>('opened');
export const closedEventType = new EventType<IClosedEvent>('closed');
export const dataEventType   = new EventType<IDataEvent>('data');
export const errorEventType  = new EventType<IErrorEvent>('error');


export interface IDeviceOptions {}
export interface IDevice extends IEvents {
    /**
     * `true` if the device is opened, otherwise `false`.
     */
    readonly isOpened: boolean;

    /**
     * Handles to the device.
     *
     * @hidden
     */
    readonly descriptor: any;

    /**
     * The name of the device.
     */
    readonly name: string;

    /**
     * Opens the port.
     *
     * @param options additional options to override the default
     */
    open(options?: IDeviceOptions): Promise<void>;

    /**
     * Close the port.
     */
    close(): Promise<void>;

    /**
     * Returns true if the two objects are equal.
     *
     * @param device the device to compare with
     */
    isEqual(device: IDevice): boolean;
}

/*
 * Global variables.
 */
const gDeviceOpened = new Map<string, boolean>();

/**
 * @hidden
 */
export abstract class AbstractDevice extends Events implements IDevice {
    protected abstract readonly console: GcConsole;
    readonly creationTimestamp = Date.now();

    constructor(protected readonly usbModule: any, public readonly descriptor: any) {
        super();
    }

    protected onOpenedHandler = (detail: { descriptor?: any }) => {
        if (this.getHandle(detail.descriptor) === this.handle) {
            this.console.debug(`USB ${this.displayName} opened.`);
            gDeviceOpened.set(this.handle, true);
            this.fireEvent(openedEventType, {});
        }
    };

    protected onClosedHandler = (detail: { port?: any }) => {
        let descriptor = null;

        // TODO: [JIRA???] serial.js: map port to descriptor
        if (detail.port) {
            descriptor = detail.port;
        }

        if (this.getHandle(descriptor) === this.handle) {
            this.console.debug(`USB ${this.displayName} closed.`);
            gDeviceOpened.set(this.handle, false);
            this.fireEvent(closedEventType, {});
        }
    };

    protected onDataHandler = (detail: { buffer: Buffer; comName: string; /* serial.js */ portInfo: any /* usbhid.js */ }) => {
        let descriptor = null;

        // TODO: [JIRA???] serial.js: map comName to descriptor.comName
        if (detail.comName) {
            descriptor = { comName: detail.comName };
        }

        // TODO: [JIRA???] usbhid.js: returns portInfo rather than descriptor
        if (detail.portInfo) {
            descriptor = detail.portInfo;
        }

        if (this.getHandle(descriptor) === this.handle) {
            this.console.debug(`USB ${this.displayName} received data=[${detail.buffer}].`);
            this.fireEvent(dataEventType, { data: detail.buffer });
        }
    };

    protected onErrorHandler = (detail: { error: Error; port: any }) => {
        let descriptor = null;

        // TODO: does serial.js has a different way of returning error?

        // TODO: [JIRA???] usbhid.js returns port rather than descriptor
        if (detail.port) {
            descriptor = detail.port;
        }

        if (this.getHandle(descriptor) === this.handle) {
            this.console.debug(`USB ${this.displayName} received error=[${detail.error}].`);
            this.fireEvent(errorEventType, { error: detail.error });
        }
    };

    protected get displayName() {
        return this.descriptor.displayName;
    }

    protected get handle(): string {
        return this.getHandle(this.descriptor);
    }

    public get isOpened() {
        return gDeviceOpened.get(this.handle) || false;
    }

    public get name() {
        return this.getName();
    }

    public isEqual(device: IDevice) {
        return this.name === device.name;
    }

    protected abstract getHandle(descriptor: any): string;
    protected abstract getName(): string;
    public abstract open(options?: IDeviceOptions): Promise<void>;
    public abstract close(): Promise<void>;
}