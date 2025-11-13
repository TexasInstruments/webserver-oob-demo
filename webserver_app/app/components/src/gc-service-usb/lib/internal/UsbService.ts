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
/* eslint-disable prefer-rest-params */

/**
 * `UsbService` handles communications with the low level USB-Serial/USB-HID/USB-Device modules.
 * For USB-Serial and USB-HID devices, use the `listPorts` API to get a list of ports and
 * use the `listDevices` API to get a list of devices. Device handles communication with
 * TI USB devices and USB hub using low-level USB APIs such as controlTransfer. Device also
 * supports USB-BULK data transfer.
 *
 * @example
 * ```typescript
 * import { ServicesRegistry } from '<path-to>/gc-core-service/lib/ServicesRegistry';
 * import { usbServiceType, usbSerialPortType, usbHidPortType  } from '<path-to>/gc-service-usb/lib/UsbService';
 *
 * const service = ServicesRegistry.getService(usbServiceType);
 * const serialPorts = await service.listPorts(usbSerialPortType);
 * const hidPorts = await service.listPorts(usbHidPortType);
 * const devices = await service.listDevices();
 * ```
 *
 * @packageDocumentation
 */

import { GcConsole } from '../../../gc-core-assets/lib/GcConsole';
import { Events, IEvents, IEvent, EventType, IListener } from '../../../gc-core-assets/lib/Events';
import { IBackplaneService, backplaneServiceType } from '../../../gc-service-backplane/lib/BackplaneService';
import { ServicesRegistry, ServiceType } from '../../../gc-core-services/lib/ServicesRegistry';
import { UsbPortType, IUsbPort, BaudRate, IDevice, AbstractUsbPort } from './AbstractUsbPort';
import { UsbSerialPort, IUsbSerialPort, usbSerialPortType } from './UsbSerialPort';
import { UsbHidPort, IUsbHidPort, usbHidPortType } from './UsbHidPort';
import { UsbDevice, IUsbDevice } from './UsbDevice';

/**
 * Device attached event.
 */
export interface IDeviceAttachedEvent extends IEvent {
    device: IUsbDevice;
}

/**
 * Device detached event.
 */
export interface IDeviceDetachedEvent extends IEvent {
    device: IUsbDevice;
}

/**
 * Device attahced event type.
 */
export const deviceAttachedEventType = new EventType<IDeviceAttachedEvent>('deviceAttachedEvent');

/**
 * Device detached event type.
 */
export const deviceDetachedEventType = new EventType<IDeviceDetachedEvent>('deviceDetachedEvent');

/**
 * Filter options for the method @see {@link IUsbService.filterPortsByDescriptorInfo}.
 */
export interface IFilterOptionsForUsbPorts {
    vendorId?: number;
    productId?: number;
    interfaceNumber?: number;
    hid?: boolean;
}

/**
 * A service that can be use to query for a list of USB-Serial/USB-HID/USB-Device.
 */
export interface IUsbService extends IEvents {
    /**
     * Returns a list of usb-serial and usb-hid ports.
     *
     * @param type Can be either **{@link usbSerialPortType}** or **{@link usbHidPortType}**.  To list both USB-Serial and
     *             USB-HID you will have to call this method twice and combine the results yourself.
     * @param vendorId vendor id to filter ports with.  For USB-HID, it not specified, a default vendor id
     *             of 8263 will be used.  Listing hid ports for multiple vendor id's is not support at this time.
     */
    listPorts<T extends IUsbPort>(type: UsbPortType<T>, vendorId?: number): Promise<Array<T>>;

    /**
     * Returns a list of usb devices.
     *
     * @param vendorIds comma separated vendor IDs, default to use TI vendor IDs
     */
    listDevices(vendorIds?: string): Promise<Array<IUsbDevice>>;

    /**
     * Returns the default port from a list of usb ports with the given device name.
     *
     * @param ports the list of ports to be use to calculate the default port
     * @param deviceName the name of the device
     */
    getDefaultPort(ports: Array<IUsbPort>, deviceName?: string): Promise<{port: IUsbPort; baudRate?: BaudRate} | undefined>;

    /**
     * Helper method to filter a list of usb ports by vendor, product, interface number, or any combination of. Interface
     * numbers are not available on MacOS, or hid ports. If for any reason the interface number is not available,
     * it will be ignored when filtering the ports.
     *
     * @param ports the list of ports to be filtered
     * @param filterOptions the filter options, like vendor id, or produce id to filter with.
     *
     */
    filterPortsByDescriptorInfo<T extends IUsbPort>(ports: Array<T>, filterOptions: IFilterOptionsForUsbPorts): Array<T>;
}

/*
 * Global variables.
 */
const MODULE_NAME = 'gc-service-usb';
const console = new GcConsole(MODULE_NAME);
export const usbServiceType = new ServiceType<IUsbService>(MODULE_NAME);

const mergeDeviceLists = <T extends IDevice>(existingDevices: Array<T>, newDevices: Array<T>) => {
    /* remove non existing device from the new device list */
    const result = existingDevices.filter(existingDevice => newDevices.find(newDevice => existingDevice.isEqual(newDevice)));

    /* add new device into existing device list */
    const length = result.length;
    for (let i = 0; i < newDevices.length; ++i) {
        let exist = false;
        for (let j = length-1; j >= 0; --j) {
            if (newDevices[i].isEqual(result[j])) {
                exist = true;
                break;
            }
        }
        if (!exist) {
            result.push(newDevices[i]);
        }
    }

    return result;
};

const deviceIdentificationMap = new Map<string, IFilterOptionsForUsbPorts>([
    [ 'MSP432P401R', { vendorId: 0x0451, productId: 0xbef3, interfaceNumber: 0, hid: false } ],
    [ 'MSP430F5529', { vendorId: 0x2047, productId: 0x0013, interfaceNumber: 2, hid: false } ],
    [ 'CC3220SF', { vendorId: 0x0451, productId: 0xbef3, interfaceNumber: 0, hid: false } ]
]);

function compareDescriptorStringToNumber(a: string | number, b: number) {
    if (typeof a === 'string') {
        const lparam = a.toLowerCase();
        const rparam = ('0000' + b.toString(16).toLowerCase()).slice(-4);
        return lparam.localeCompare(rparam);
    }
    return a - b;
}

/**
 * @hidden
 */
export class UsbService extends Events implements IUsbService {
    private initialized = false;
    private backplane = ServicesRegistry.getService<IBackplaneService>(backplaneServiceType);
    private serialModule: any;
    private usbHidModule: any;
    private usbModule: any;
    private usbPorts = new Array<IUsbSerialPort>();
    private hidPorts = new Array<IUsbHidPort>();
    private devices = new Array<IUsbDevice>();

    constructor() {
        super();
    }

    private deviceAttachedHdlr = (key: string) => {
        (async () => {
            const devices = await this.listDevices(); // get an update list of device

            // find device in the devices list and fire event
            const device = devices.find(device => device.key === key);
            if (device) {

                // Hack, store the time stamp when the device attached.
                // Any open() call will need to be defer to let the
                // port to be ready.
                AbstractUsbPort.deviceAttachedTimestamp = Date.now();

                this.fireEvent(deviceAttachedEventType, { device: device });
            }
        })();
    };

    private deviceDetachedHdlr = (key: string) => {
        // find device in existing list and fire event
        const device = this.devices.find(device => device.key === key);
        if (device) {
            this.fireEvent(deviceDetachedEventType, { device: device });
        }
    };

    private async init() {
        if (!this.initialized) {
            this.initialized = true;
            this.usbModule = await this.backplane.getSubModule('USB');

            this.usbModule.addListener('attach', this.deviceAttachedHdlr);
            this.usbModule.addListener('detach', this.deviceDetachedHdlr);
            this.listDevices();
        }
    }

    addEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        console.logAPI(`${UsbService.name}::${this.addEventListener.name}`, ...arguments);

        this.init();
        super.addEventListener(type, listener);
    }

    removeEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T> | undefined) {
        console.logAPI(`${UsbService.name}::${this.removeEventListener.name}`, ...arguments);

        super.removeEventListener(type, listener);
    }

    async listPorts<T extends IUsbPort>(type: UsbPortType<T>, vendorIdFilter?: number): Promise<Array<T>> {
        console.logAPI(`${UsbService.name}::${this.listPorts.name}`, ...arguments);
        await this.init();

        /* list serial ports */
        if (type as unknown === usbSerialPortType) {
            const ports = Array<IUsbSerialPort>();

            if (!this.serialModule) {
                this.serialModule = await this.backplane.getSubModule('Serial');
            }

            const mySerialPorts = (await this.serialModule.list()).ports;
            mySerialPorts && mySerialPorts.forEach((port: any) => {
                ports.push(new UsbSerialPort(this.serialModule, port));
            });

            /*
            * Merge new ports to the existing list of ports, by adding new ports to the existing list
            * and removing ports that are no longer exist in the new list. This is to ensure that
            * the same port object is returned to multiple clients and event will be fire to all
            * listeners with the same port object.
            */
            this.usbPorts = mergeDeviceLists(this.usbPorts, ports);
            if (vendorIdFilter !== undefined) {
                return this.usbPorts.filter(port => compareDescriptorStringToNumber(port.descriptor.vendorId, vendorIdFilter) === 0) as unknown as T[];
            }
            return this.usbPorts as unknown as T[];
        }

        /* list USB-HID ports */
        if (type as unknown === usbHidPortType) {
            const ports = Array<IUsbHidPort>();

            if (!this.usbHidModule) {
                this.usbHidModule = await this.backplane.getSubModule('USB-HID');
            }

            const vendorId = vendorIdFilter ?? 8263;

            const myHidPorts = (await this.usbHidModule.list(vendorId)).ports;
            myHidPorts && myHidPorts.forEach((port: any) => {
                ports.push(new UsbHidPort(this.usbHidModule, port));
            });

            /*
            * Merge new ports to the existing list of ports, by adding new ports to the existing list
            * and removing ports that are no longer exist in the new list. This is to ensure that
            * the same port object is returned to multiple clients and event will be fire to all
            * listeners with the same port object.
            */
            let hidPortsByVendorId = this.hidPorts.filter(port => compareDescriptorStringToNumber(port.descriptor.vendorId, vendorId) === 0);
            const hidPortsByOtherVendorIds = this.hidPorts.filter(port => compareDescriptorStringToNumber(port.descriptor.vendorId, vendorId) !== 0);
            hidPortsByVendorId = mergeDeviceLists(hidPortsByVendorId, ports);
            this.hidPorts = [ ...hidPortsByVendorId, ...hidPortsByOtherVendorIds ];

            return hidPortsByVendorId as T[];
        }
        throw Error('Invalid type parameter.  The type parameter must be either usbSerialPortType, or usbHidPortType');
    }

    async listDevices(vendorId?: string): Promise<Array<IUsbDevice>> {
        console.logAPI(`${UsbService.name}::${this.listDevices.name}`, ...arguments);
        await this.init();

        if (!this.usbModule) {
            this.usbModule = await this.backplane.getSubModule('USB');
        }

        const devices = Array<IUsbDevice>();
        const myDevices = (await this.usbModule.list(vendorId || '')).deviceInfoList;
        myDevices && myDevices.forEach((device: any) => {
            devices.push(new UsbDevice(this.usbModule, device));
        });

        this.devices = mergeDeviceLists(this.devices, devices);
        return this.devices;
    }

    async getDefaultPort(ports: Array<IUsbPort>, deviceName?: string): Promise<{ port: IUsbPort; baudRate?: BaudRate } | undefined> {
        console.logAPI(`${UsbService.name}::${this.getDefaultPort.name}`, ...arguments);
        await this.init();

        if (deviceName) {
            const filterOptions = deviceIdentificationMap.get(deviceName);
            if (filterOptions) {
                const filteredPorts = this.filterPortsByDescriptorInfo(ports, filterOptions);
                if (filteredPorts.length > 0) {
                    // only update ports if we found a useful default, otherwise let backplane pick from full list.
                    ports = filteredPorts;
                }
            }
        }

        const serialPorts = ports.filter(port => port.type === usbSerialPortType).map(port => (port as UsbSerialPort).descriptor);
        const util = await this.backplane.getUtil();
        if (serialPorts.length > 0) {
            await util.selectDefaultPort({ ports: serialPorts, targetName: deviceName });
        }
        const baudRates = await util.getBaudRates();

        for (let i = 0; i < ports.length; ++i) {
            if (ports[i].type === usbSerialPortType && (ports[i] as UsbSerialPort).descriptor.selected) {
                (ports[i] as UsbSerialPort).descriptor.selected = false;  // clear selected flag for next time.
                for (let j = 0; j < baudRates.length; ++j) {
                    if (baudRates[j].selected) {
                        return { port: ports[i], baudRate: (+baudRates[j].rate) as BaudRate };
                    }
                }
                return { port: ports[i] };
            }
        }

        const hidPorts = ports.filter(port => port.type === usbHidPortType);
        if (hidPorts.length > 0 && serialPorts.length > 0) {
            return { port: hidPorts[0] };  // for mixed serial and hid default to hid over usb, since hid ports are filtered by Texas Instruments manufacture id.
        }
    }

    filterPortsByDescriptorInfo<T extends IUsbPort>(ports: Array<T>, filterBy: IFilterOptionsForUsbPorts): Array<T> {
        console.logAPI(`${UsbService.name}::${this.filterPortsByDescriptorInfo.name}`, ...arguments);

        if (filterBy.hid !== undefined) {
            ports = ports.filter(port => port.type === (filterBy.hid ? usbHidPortType : usbSerialPortType));
        }
        if (filterBy.vendorId !== undefined) {
            ports = ports.filter(port => compareDescriptorStringToNumber(port.descriptor.vendorId, filterBy.vendorId!) === 0);
        }
        if (filterBy.productId !== undefined) {
            ports = ports.filter(port => compareDescriptorStringToNumber(port.descriptor.productId, filterBy.productId!) === 0);
        }
        if (filterBy.interfaceNumber !== undefined) {
            ports = ports.filter(port => {
                if (port.descriptor.pnpId) {
                    // convert machineInterface to a 2 digit hext number and look for it as suffix to pnpId
                    // this is the same as what agent.js does for windows and linux.  Mac is different.
                    const mi = ('00' + filterBy.interfaceNumber!.toString(16).toLowerCase()).slice(-2);
                    return port.descriptor.pnpId.toLowerCase().endsWith(mi);
                }
                return true;
            });
        }
        return ports;
    }
}

ServicesRegistry.register(usbServiceType, UsbService);