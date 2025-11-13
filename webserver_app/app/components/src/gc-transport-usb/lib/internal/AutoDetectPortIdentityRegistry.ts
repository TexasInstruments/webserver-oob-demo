/**
 *  Copyright (c) 2021, Texas Instruments Incorporated
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

import { TargetConfigurationBuilder, IDecoderConstructor } from './TargetConfigurationBuilder';
import { IUsbPort, BaudRate, usbSerialPortType, usbHidPortType } from '../../../gc-service-usb/lib/ServiceUsb';
import { ICodecBaseParams } from '../../../gc-target-configuration/lib/ICodecBaseParams';
import { IDecoder, IEncoder, IDataEncoder } from '../../../gc-target-configuration/lib/TargetConfiguration';
import { AbstractUsbTransport } from './AbstractUsbTransport';
import { GcPromise } from '../../../gc-core-assets/lib/GcPromise';
import { GcConsole } from '../../../gc-core-assets/lib/GcConsole';

const console = new GcConsole('gc-transport-usb');

export interface IPortIdentity {
    toString(): string;
}

/**
 * The helper API that is passed to auto detect port identity handlers registered with
 * @see {@link AutoDetectPortIdentityRegistry}, as a callback to provide access to information
 * for the purposes of aiding the filtering of ports function, as well as providing better
 * descriptions of usb ports to users.
 */
export interface IAutoDetectPortIdentityHelper {
    /**
     * The usb port for auto detect to identify.  This may be a either a usb-hid, or regular serial, port.
     */
    usbPort: IUsbPort;

    /**
     * The elapsed time, in milliseconds, since the last time since an attempt to identify this port was attempted.
     * This may be used by applications to skip identification if not enough time has elapse.  If this is the first
     * attempt, this number may be large.
     */
    elapsedTimeSinceLastPortIdentityAttempt: number;

    /**
     * This method opens the serial port for communication.  Use this method, along with serialPortDisconnect
     * to open a serial port for the purposes of establishing it's identity.  Since port identification is
     * performed independent of the transport, you must provide a baud rate to open a USB port, and not rely
     * anything setup for a particular transport. For USB-HID ports, you do not need to specify a baud rate.
     *
     * @param baudRate - Baud rate to open the serial port with.
     * @returns A promise that resolves on successfully opening the port, or fails if the port could not be opened.
     *
     * @example
     * ```typescript
     * import { AutoDetectPortIdentityRegistry, IUsbPort, IAutoDetectPortIdentityHelper } from '<path-to>/gc-transport-usb/lib/UsbTransport';
     * import { Usb2anyCodec } from '<path-to>/gc-codec-usb2any/lib/Usb2anyCodec';
     *
     * function async myPortIdentityHandler(port: IUsbPort, helperAPI: IAutoDetectPortIdentityHelper) {
     *     if (!helperAPI.isHid || port.descriptor.productId !== 769)
     *         return;  // return undefined for unknown port for identification.
     *
     *     await helperAPI.serialPortConnect();
     *     const u2a = await helperAPI.appendCodec(Usb2anyCodec, { id: 'usb2any' });
     *
     *     // ... do identification through codec apis ...
     *
     *     return deviceName;  // use device name as identifier for a particular part
     * };
     * AutoDetectPortIdentityRegistry.registerPortIdentityHandler(myPortIdentityHandler);
     * ```
     */
    serialPortConnect(baudRate?: BaudRate): Promise<IDataEncoder<string | number[] | Buffer>>;

    /**
     * This method closes the previously opened serial port.
     * You do not have to call this method.  Opened serial ports will automatically be closed for you.  Use this
     * method if you want to close and re-open the serial port for any reason for the purposes of identifying the port.
     * However,if you do close the serial port, all of your appended codecs will be closed and garbage collected, so whenever
     * you open a serial port, you will must append the necessary codecs again.
     *
     * @return {promise} a promise that resolves when the port is successfully closed.
     */

    serialPortDisconnect(): Promise<void>;

    /**
     * Property indicating if the usb port is an HID port or not.
     */
    readonly isHid: boolean;

    /**
     * Property indicating if the usb port is a regular serial port, and not an HID port.
     */
    readonly isUsb: boolean;

    /**
     * <p>This method creates a codec instance that will be appended to a given parent codec.  This method can
     * only be called between serialPortConnect() and serialPortDisconnect() operations.  The serialPortDisconnect()
     * method will disconnect and deconfigure the codecs created using this method.</p>
     * <p>You may create multiple
     * codecs appended to the same parent, or chain the codes together using the returned codec instance.
     * If the parent codec parameter is absent, the newly constructed codec will be appended to the usb transport automatically created
     * during the serialPortConnect() method call.</p>
     * <p>You can also copy, and override parameters from a registered codec, of the same class.  If the params includes an optional id
     * property, then the registered codec's params, with the same id, will be used as the default values, and the params structure will
     * be treated as overrides.</p>
     *
     * @param decoderFactory - the constructor for the codec you wish to create and append to the parent codec.
     * @param params - the params to pass to the constructor for creating the codec.  If an id is provided, these
     *                 params will represent the overrides for the params in the registered codec by id.
     * @param parent - the parent codec to append the newly created codec to.
     * @return the codec instance created with this method, after it has been configured and connected.
     */

    appendCodec<T extends IDecoder<unknown, unknown>, P extends ICodecBaseParams>(decoderFactory: IDecoderConstructor<T, P>, params: P, parent?: IEncoder<unknown, unknown>): Promise<T>;
}

export type AutoDetectPortIdentityHandlerType = (port: IUsbPort, helperApi: IAutoDetectPortIdentityHelper) => Promise<IPortIdentity | string | void> | IPortIdentity | string | void;

class UsbPortIdentityTransport extends AbstractUsbTransport {
    protected params = {};
    protected console = new GcConsole('gc-transport-usb');

    constructor(private selectedUsbPort: IUsbPort, private selectedBaudRate?: BaudRate) {
        super();
    }

    protected doConnect(failedDevicesList: string[] = []) {
        return this.doOpenUsbPort(this.selectedUsbPort, this.selectedBaudRate);
    }

    dispose() {
    }

    toString() {
        return `transport port="${this.selectedUsbPort.comName}"`;
    }
}

class AutoDetectPortIdentityHelper implements IAutoDetectPortIdentityHelper {
    private configBuilder?: TargetConfigurationBuilder;
    private usbTransport?: UsbPortIdentityTransport;
    public isUsb: boolean;
    public isHid: boolean;

    constructor(public usbPort: IUsbPort, public elapsedTimeSinceLastPortIdentityAttempt: number) {
        this.isUsb = usbPort.type === usbSerialPortType;
        this.isHid = usbPort.type === usbHidPortType;
    }

    async serialPortConnect(baudRate?: BaudRate): Promise<IDataEncoder<string | number[] | Buffer>> {
        if (!this.usbTransport) {
            this.usbTransport = new UsbPortIdentityTransport(this.usbPort, baudRate || 9600);
        }
        await this.usbTransport.connect();

        this.configBuilder = new TargetConfigurationBuilder(this.usbTransport);
        return this.usbTransport;
    }

    async serialPortDisconnect() {
        if (this.configBuilder) {
            await this.configBuilder.dispose();
            this.configBuilder = undefined;
        }
    }

    appendCodec<T extends IDecoder<unknown, unknown>, P extends ICodecBaseParams>(decoderFactory: IDecoderConstructor<T, P>, params: P, parent?: IEncoder<unknown, unknown>): Promise<T> {
        if (this.configBuilder) {
            return this.configBuilder.appendCodec(decoderFactory, params, parent);
        }
        throw 'Invocation Error: Cannot call appendCodec() before calling open()';
    }
}

interface IPortIdentityMapInfo {
    promise?: Promise<void>;
    timeStamp?: number;
    portIdentity: IPortIdentity | string;
}

/**
 * Helper class for registering auto detect port identity handlers, and accessing port identity information.
 *
 * Applications can use this to perform device detection or port identification on usb transports by registering a callback.
 * This callback is called once for each unique USB serial port found on the users machine, and the result is cached.
 * Note that this may occur any time
 * the users serial ports are listed, and there are new serial ports found.  For multiple serial ports, this method will be
 * called multiple times, and in parallel which means that more that one com port may be open at one time.
 * When this callback is called, the serial port is not opened, no codec has been created, and the app has not tried to connect
 * to the target yet.
 *
 * The callback should return one of the following:
 * <ul>
 * <li>string - used to identify the serial port, perhaps by device name.</li>
 * <li>object - as object that has a toString() method that returns a string to identify the serial port to the user.</li>
 * <li>undefined - null or undefined to indicate that the serial port could not be recognized.</li>
 * <li>promise - a promise that resolves to one of the above.  In this case, an exception is just a failed promise.</li>
 * </ul>
 *
 * @example
 * ```typescript
 * import { AutoDetectPortIdentityRegistry, IUsbPort, IAutoDetectPortIdentityHelper } from '<path-to>/gc-transport-usb/lib/UsbTransport';
 * import { Usb2anyCodec } from '<path-to>/gc-codec-usb2any/lib/Usb2anyCodec';
 *
 * function async myPortIdentityHandler(port: IUsbPort, helperAPI: IAutoDetectPortIdentityHelper) {
 *     if (!helperAPI.isUsb || port.descriptor.vendorId === 769) {
 *         return 'myDeviceName';
 *     }
 * };
 * AutoDetectPortIdentityRegistry.registerPortIdentityHandler(myPortIdentityHandler);
 */
export class AutoDetectPortIdentityRegistry {
    private static portIdentityHandlers: AutoDetectPortIdentityHandlerType[] = [];
    private static portIdentityMap = new Map<string, IPortIdentityMapInfo>();

    /**
     * Method to register a callback to perform application specific usb port identification.
     *
     * @param handler - the callback that will be called for each usb port, for the purposes of device or port identification.
     */
    public static registerPortIdentityHandler(handler: AutoDetectPortIdentityHandlerType) {
        if (!this.portIdentityHandlers.includes(handler)) {
            this.portIdentityHandlers.push(handler);
        }
    }

    /**
     * Method to unregister a callback to perform application specific usb port identification.
     *
     * @param handler - the callback, previously registered, for unregistering.
     */
    public static unRegisterPortIdentityHandler(handler: AutoDetectPortIdentityHandlerType) {
        const i = this.portIdentityHandlers.indexOf(handler);
        if (i >= 0) {
            this.portIdentityHandlers.splice(i, 1);
        }
    }

    private static async doPortIdentity(port: IUsbPort, portInfo: IPortIdentityMapInfo) {
        let newPortIdentity: IPortIdentity | string | void;
        const elapsedTm = Date.now() - (portInfo.timeStamp || 0);
        console.log(`Starting port identification on ${port.comName}, ${portInfo.timeStamp ? `${portInfo.timeStamp / 1000} seconds since last try.` : 'for the first time.'}`);

        for (let i = 0; i < this.portIdentityHandlers.length; i++) {
            const handler = this.portIdentityHandlers[i];
            const helper = new AutoDetectPortIdentityHelper(port, elapsedTm);
            try {
                newPortIdentity = await Promise.resolve(handler(port, helper));
                if (newPortIdentity) {
                    portInfo.portIdentity = newPortIdentity;
                    break;
                }
            } catch (e) {  // log error and continue, since we support multiple port identity handlers.
                console.error(`Exception caught in auto detect port identity handler: ${e.message || e.toString()}`);
            } finally {
                await helper.serialPortDisconnect();
            }
        }
        portInfo.timeStamp = Date.now();  // update timestamp to reflect the last attempt to detect identity of port.
        console.log(`Finished port identification on ${port.comName}, ${newPortIdentity ? `identified as ${newPortIdentity}` : 'no identity found'}.`);
    }

    /**
     * Helper method used by the UsbTransport to update port identities as part of its allocating serial ports.  It is not
     * necessary to call this method manually.  Normally, the UsbTransport will take care of this.
     *
     * @param ports - a list of serial ports to update the port identities for.
     */
    public static updateAllPortIdentities(ports: IUsbPort[]): Promise<void | void[]> {
        if (this.portIdentityHandlers.length > 0) {
            const promises = ports.map( (port) => {
                const portInfo = this.getAutoDetectPortIdentityInfo(port);
                if (portInfo.promise === undefined && !port.isOpened) {
                    portInfo.promise = this.doPortIdentity(port, portInfo).finally(() => portInfo!.promise = undefined);
                }
                return portInfo.promise;
            });
            return GcPromise.all(promises);
        }
        return Promise.resolve();
    }

    private static getAutoDetectPortIdentityInfo(port: IUsbPort): IPortIdentityMapInfo {
        let portInfo = this.portIdentityMap.get(port.comName);
        if (!portInfo) {
            portInfo = { portIdentity: '' };
            this.portIdentityMap.set(port.comName, portInfo);
        }
        return portInfo;
    }

    /**
     * Helper method to retrieve the port identity information returned by an auto detect port identity handler.
     *
     * @param port - The serial port from which to retrieve the port identity.
     */
    public static getAutoDetectPortIdentity(port: IUsbPort): IPortIdentity | string {
        return this.getAutoDetectPortIdentityInfo(port).portIdentity;
    }

    /**
     * Helper method to retrieve the display name for a usb port.  The display name is comprised of the comName followed by
     * the port identity, if available, in brackets.
     *
     * @param port - The serial port from which to retrieve the display name.
     */
    public static getDisplayName(port: IUsbPort): string {
        const portIdentity = this.getAutoDetectPortIdentity(port);
        const deviceName = portIdentity.toString();
        if (deviceName) { // test for empty or missing string.
            return `${port.comName} (${deviceName})`;
        }
        return port.comName;
    }
}
