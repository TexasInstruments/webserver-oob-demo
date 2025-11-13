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
/* eslint-disable no-async-promise-executor */
/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-interface */

/**
 * `UsbDevice` provides a higher level abstraction for communicating with usb devices.
 *
 * @example
 * ```typescript
 * import { ServiceRegistry } from '<path-to>/gc-core-service/lib/ServiceRegistry';
 * import { usbServiceType } from '<path-to>/gc-service-usb/lib/UsbService';
 *
 * const service = ServiceRegistry.getService(usbServiceType);
 * const devices = await usbService.listDevices();
 * ```
 *
 * @packageDocumentation
 */
import { AbstractDevice, IDevice } from './AbstractDevice';
import { IEvent, EventType, IListener, Events, IEvents } from '../../../gc-core-assets/lib/Events';
import { GcConsole } from '../../../gc-core-assets/lib/GcConsole';

export interface IRxDataEvent extends IEvent {
    /**
     * The data payload.
     */
    data: Buffer;
}
export interface IRxErrorEvent extends IEvent {
    error: Error;
}
export const rxDataEventType = new EventType<IRxDataEvent>('rxData');
export const rxErrorEventType = new EventType<IRxErrorEvent>('rxError');
type Decoder = (rxData: { data: Buffer }) => { error?: string; result?: { data: Buffer } };

export interface IUsbDeviceInterface extends IEvents {
    /**
     * The device interface index.
     */
    index: number;

    /**
     * Claim an interface before using any endpoints.
     *
     * @param startPolling if true, the inEndpoint of the interface will generate rxData events
     * @param numberBufsToConcat the number of rx packet payloads to buffer before generating the rxData event
     */
    claim(startPolling?: boolean, numberBufsToConcat?: number): Promise<void>;

    /**
     * Release the interface.
     */
    release(): Promise<void>;

    /**
     * Writes data to the interface `out` endpoint.
     *
     * @param data data to send to the `out` endpoint
     */
    write(data: Buffer): Promise<void>;

    /**
     * Reads data from the interface `in` endpoint.
     *
     * @param numBytesToRead number of bytes to read from the `in` endpoint
     */
    read(numBytesToRead: number): Promise<Buffer>;

    /**
     * SEnds a command string to the interface `out` endpoint.
     *
     * @param cmd command to send to the `out` endpoint. For hex data: 0x prefix, csv
     * @param timeout reject the promise if the response from teh device is not received in the specified time in milliseconds
     * @param decoder optional packet response handler. If undefined or null, the promise will return with the first received
     *                packet. The handler should returns immediately.
     *
     *                If the return value of the handler,
     *                  error: is defined or not null, the promise is rejected
     *                  result: is valid, the command promise is resolved
     *                  otherwise: continue to wait for mor packets
     */
    sendCmd(cmd: string, timeout?: number, decoder?: Decoder): Promise<{ data: Buffer }>;
}

export interface IUsbDevice extends IDevice {
    /**
     * The list of interfaces for this device. The list will be populated when the device is first opened.
     */
    interfaces: Array<IUsbDeviceInterface>;

    /**
     * The device key.
     */
    key: string;

    /**
     * Resets the deivce.
     */
    reset(): Promise<void>;

    /**
     * Returns the descriptor object.
     */
    getDescriptors(): Promise<any>;

    /**
     * Returns one of the string descriptor for the device.
     *
     * @param index the string index (deviceDescriptor.[iManufacturer|iProduct|iSerialNumber])
     * @param maxLength max number of characters for the string
     *
     * @see getDescriptors
     */
    getStringDescriptor(index: number, maxLength?: number): Promise<string>;

    /**
     * Perform a synchronous control transfer (libusb_control_transfer).
     *
     * @param bmRequestType Bits 0:4 determine recipient, 5:6 determine type, Bit 7 determines data transfer direction
     * @param bRequest if bmRequestType[5:6] = b00, is a "Standard Request" enum value (e.g. LIBUSB_REQUEST_GET_STATUS)
     * @param wValue value (varies according to request)
     * @param wIndex index (Varies according to request, typically used to pass an index or offset)
     * @param dataOrLength Buffer (for an outEndpoint) or numBytesToReceive (for an inEndpoint) as per bmRequestType:b7
     */
    controlTransfer(bmRequestType: number, bRequest: number, wValue: number, wIndex: number, dataOrLength: number|Buffer): Promise<any>;
}


const makeRxDataHdlr = (resolve: (result: { data: Buffer }) => void, reject: (error: string) => void, decoder?: Decoder) => {
    return (rxData: { data: Buffer }) => {
        let result;
        if (decoder) {
            const retObj = decoder(rxData);
            retObj.error ? reject(retObj.error) : result = retObj.result;
        } else {
            result = rxData;
        }

        if (result) {
            resolve(result);
        }
    };
};

/**
 * @hidden
 */
export class UsbDeviceInterface extends Events implements IUsbDeviceInterface {
    private readonly key: number;
    private readonly rxErrorEventName: string;
    private readonly rxDataEventName: string;
    protected readonly console: GcConsole;

    constructor(private readonly usbModule: any, usbDevice: IUsbDevice, public readonly index: number, public readonly descriptor: any) {
        super();
        this.key = usbDevice.descriptor.key;
        this.console = new GcConsole('gc-service-usb', this.key.toString());

        this.rxErrorEventName = `rx_error.${this.key}.${this.index}`;
        this.rxDataEventName  = `rx_data.${this.key}.${this.index}`;
    }

    addEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        this.console.logAPI(`${UsbDeviceInterface.name}::${this.addEventListener.name}`, ...arguments);

        switch (type as unknown) {
            case rxDataEventType:
                this.usbModule.addListener(this.rxDataEventName, listener);
                break;
            case rxErrorEventType:
                this.usbModule.addListener(this.rxErrorEventName, listener);
                break;
            default:
                super.addEventListener(type, listener);
        }
    }

    removeEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        this.console.logAPI(`${UsbDeviceInterface.name}::${this.removeEventListener.name}`, ...arguments);

        switch (type as unknown) {
            case rxDataEventType:
                this.usbModule.removeListener(this.rxDataEventName, listener);
                break;
            case rxErrorEventType:
                this.usbModule.removeListener(this.rxErrorEventName, listener);
                break;
            default:
                super.removeEventListener(type, listener);
        }
    }

    async claim(startPolling: boolean = true, numberBufsToConcat: number = 1) {
        this.console.logAPI(`${UsbDeviceInterface.name}::${this.claim.name}`, ...arguments);

        await this.usbModule.claimInterface(this.key, this.index, startPolling, numberBufsToConcat);
    }

    async release() {
        this.console.logAPI(`${UsbDeviceInterface.name}::${this.release.name}`, ...arguments);

        await this.usbModule.releaseInterface(this.key, this.index);
    }

    async write(data: Buffer) {
        this.console.logAPI(`${UsbDeviceInterface.name}::${this.write.name}`, ...arguments);

        await this.usbModule.writeData(this.key, this.index, data);
    }

    async read(numBytesToRead: number): Promise<Buffer> {
        this.console.logAPI(`${UsbDeviceInterface.name}::${this.read.name}`, ...arguments);

        return await this.usbModule.readData(this.key, this.index, numBytesToRead);
    }

    async sendCmd(cmd: string, timeout: number = 0, decoder?: Decoder): Promise<{ data: Buffer }> {
        this.console.logAPI(`${UsbDeviceInterface.name}::${this.sendCmd.name}`, ...arguments);

        let rxErrorHdlr: any, rxDataHdlr: any, hTimeout: any;
        const _clearTimeout = () => {
            if (hTimeout) {
                clearTimeout(hTimeout);
                hTimeout = undefined;
            }
        };

        return await new Promise<{ data: Buffer }>(async (resolve, reject) => {
            rxErrorHdlr = (e: Error) => reject(e);
            rxDataHdlr = makeRxDataHdlr((result: { data: Buffer }) => {
                _clearTimeout();
                resolve(result);
            }, reject, decoder);

            this.usbModule.addListener(this.rxDataEventName, rxDataHdlr);
            this.usbModule.addListener(this.rxErrorEventName, rxErrorHdlr);
            await this.usbModule.sendCmd(this.key, this.index, cmd);

            if (timeout > 0) {
                hTimeout = setTimeout(() => {
                    hTimeout = undefined;
                    reject(`Timeout waiting for cmd=${cmd}, after ${timeout}ms.`);
                }, timeout);
            }

        }).finally(() => {
            this.usbModule.removeListener(this.rxDataEventName, rxDataHdlr);
            this.usbModule.removeListener(this.rxErrorEventName, rxErrorHdlr);
            _clearTimeout();
        });
    }
}

/**
 * @hidden
 */
export class UsbDevice extends AbstractDevice implements IUsbDevice {
    protected readonly console: GcConsole;
    private _interfaces = new Array<IUsbDeviceInterface>();
    public readonly key: string;
    constructor(protected readonly usbModule: any, public readonly descriptor: any) {
        super(usbModule, descriptor);
        this.key = descriptor.key;
        this.console = new GcConsole('gc-service-usb', this.getName());
    }

    protected getHandle(descriptor: any) {
        return descriptor.key;
    }

    protected getName() {
        return this.displayName;
    }

    get interfaces() {
        return this._interfaces;
    }

    async open() {
        this.console.logAPI(`${UsbDevice.name}::${this.open.name}`, ...arguments);
        await this.usbModule.open(this.key);

        // query for interfaces
        const infDescriptions = await this.getDescriptors();
        this._interfaces = infDescriptions.interfaceDescriptors.map((desc: any, index: number) => {
            return new UsbDeviceInterface(this.usbModule, this, index, desc);
        });

        // usb.js doesn't fire any opened event
        this.onOpenedHandler({ descriptor: this.descriptor });
    }

    isEqual(device: UsbDevice) {
        return this.key === device.key;
    }

    async close() {
        this.console.logAPI(`${UsbDevice.name}::${this.close.name}`, ...arguments);
        await this.usbModule.close(this.key);

        // usb.js doesn't fire closed event
        this.onClosedHandler({ port: this.descriptor });
    }

    async reset() {
        this.console.logAPI(`${UsbDevice.name}::${this.reset.name}`, ...arguments);
        await this.usbModule.reset(this.key);
    }

    async getDescriptors() {
        this.console.logAPI(`${UsbDevice.name}::${this.getDescriptors.name}`, ...arguments);
        return await this.usbModule.getDescriptors(this.key);
    }

    async getStringDescriptor(index: number, maxLength: number = 64) {
        this.console.logAPI(`${UsbDevice.name}::${this.getStringDescriptor.name}`, ...arguments);

        if (index === 0) {
            throw Error('stringIndex == 0 is not supported');
        }

        const result = await this.controlTransfer(
            0x80,                       /* IN_STANDARD_DEVICE     = 0x80 */
            6,                          /* GET_DESCRIPTOR         = 6    */
            3 << 8 | index & 0x0FF,     /* STRING_DESCRIPTOR_TYPE = 3    */
            0x0409,
            maxLength);

        /**
         * Ignore the first 2 bytes, byte swap, and convert to UTF-16
         */
        const transformation = [];
        for (let i = 2; i < result.length; i=i+2) {
            transformation.push(result[i+1] << 8 | result[i]);
        }
        return String.fromCharCode(...transformation);
    }

    async controlTransfer(bmRequestType: number, bRequest: number, wValue: number, wIndex: number, dataOrLength: number|Buffer) {
        this.console.logAPI(`${UsbDevice.name}::${this.controlTransfer.name}`, ...arguments);
        let resultObj = await this.usbModule.controlTransfer(this.key, bmRequestType, bRequest, wValue, wIndex, dataOrLength);
        if (resultObj && resultObj.data) {
            resultObj = resultObj.data;
        }
        return resultObj;
    }

    async uploadTestPackets(numPackets: number, packetSize: number, decoder: Decoder) {
        this.console.logAPI(`${UsbDevice.name}::${this.uploadTestPackets.name}`, ...arguments);

        let rxDataHdlr: any;
        return await new Promise(async (resolve, reject) => {
            rxDataHdlr = makeRxDataHdlr(resolve, reject, decoder);
            this.usbModule.addListener('rx_test_data', rxDataHdlr);
            await this.usbModule.uploadTestPackets(numPackets, packetSize).fail(reject);

        }).finally(() => {
            this.usbModule.removeListener('rx_test_data', rxDataHdlr);
        });
    }
}
