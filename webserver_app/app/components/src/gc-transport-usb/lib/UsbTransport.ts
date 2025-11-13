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
import { IUsbService, IUsbPort, BaudRate, usbSerialPortType, usbHidPortType, usbServiceType, deviceDetachedEventType, deviceAttachedEventType } from '../../gc-service-usb/lib/ServiceUsb';
import { ICodecBaseParams } from '../../gc-target-configuration/lib/ICodecBaseParams';
import { codecRegistry, IConnectionLog, connectedStateChangedEventType, AbstractTransport, capitalize, connectionLogEventType } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { IListener, IEvent, EventType } from '../../gc-core-assets/lib/Events';
import { GcLocalStorage } from '../../gc-core-assets/lib/GcLocalStorage';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { XdsTransport } from '../../gc-transport-xds/lib/XdsTransport';
import { GcPromise } from '../../gc-core-assets/lib/GcPromise';
import { AbstractUsbTransport } from './internal/AbstractUsbTransport';
import { AutoDetectPortIdentityRegistry } from './internal/AutoDetectPortIdentityRegistry';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';

export * from './internal/AutoDetectPortIdentityRegistry';
export { IUsbPort, usbSerialPortType, usbHidPortType } from '../../gc-service-usb/lib/ServiceUsb';

const MODULE_NAME = 'gc-transport-usb';

interface IPortSelection {
    port: IUsbPort;
    transport: UsbTransport;
    score: number;
    baudRate: BaudRate;
}

enum StorageKeys {
    baudRate = 'baudRate',
    comPort = 'comPort'
}

/**
 * The details for the @See {@link filterPortsEventType} event.  This object is passed as the details parameter for the filter serial ports event.
 * Applications should modify the details object directly to filter the list of ports available to a particular transport, and or
 * setting the recommended port and baud rate.
 */
export interface IFilterUsbPorts extends IEvent {
    /**
     * The list of usb ports to filter.  The filter needs to be performed in place, so that this property is replaced with the new filtered
     * list.
     */
    ports: IUsbPort[];

    /**
     * Optional recommended port.  If more than one port is return as a result of filtering, you can use this property
     * to set a preferred, or recommended port that will be used in lieu of a users specific selection.
     */
    recommendedPort?: IUsbPort;

    /**
     * Optional recommended baud rate that corresponds to the recommended port.  If there is no recommended port, then this
     * will be ignored.  To set the default for all ports, use the defaultBaudRate property of gc-transport-usb instead.
     */
    recommendedBaudRate?: BaudRate;
}

/**
 * An event called by UsbTransport during acquisition of serial ports during connect.  This event is intended
 * to provide the app an opportunity to filter the available ports for a particular transport.  This way only appropriate
 * usb ports are shown to the user for any particular transport.  Usually, this is used in conjunction with
 * @see {@link AutoDetectPortIdentityRegistry}
 * to identify each port, and then filter the ones that are known to know be supported.
 *
 * @example
 * ```typescript
 * import { AutoDetectPortIdentityRegistry, IUsbPort, filterPortsEventType, IFilterUsbPorts } from '<path-to>/gc-transport-usb/lib/UsbTransport';
 *
 * function async myPortFilter(details: IFilterUsbPorts) {
 *     details.ports = details.ports.filter( port => {
 *         id = AutoDetectPortIdentityRegistry.getAutoDetectPortIdentityInfo(port).toString();
 *         return id === 'TMP117' || id === 'TMP116';
 *     });
 *     details.recommendedPort = details.ports.reduce( (found: IUsbPort, port) => {
 *         return AutoDetectPortIdentityRegistry.getAutoDetectPortIdentityInfo(port) === 'TMP117' ? port : found);
 *     }, undefined);
 * };
 * usbTransport.addEventListener(filterPortsEventType, myPortFilter);
 * ```
 */
export const filterPortsEventType = new EventType<IFilterUsbPorts>('filterUsbPorts');

export interface ISelectedUsbPort extends IEvent {
    port?: IUsbPort;
    baudRate?: BaudRate;
    availablePorts: IUsbPort[];
    transport: UsbTransport;
}

export const selectedPortEventType = new EventType<ISelectedUsbPort>('selectedUsbPort');

export interface IUsbTransportParams extends ICodecBaseParams {
    usb?: boolean;
    hid?: boolean;
    vendorId?: number;
    productId?: number;
    interfaceNumber?: number;
    defaultBaudRate?: BaudRate;
    /**
     * @deprecated Use @see {@link filterPortsEventType} instead.
     */
    filter?: (ports: IUsbPort[]) => IUsbPort[];
    deviceName?: string;
    pm?: boolean;
    disableDeviceDetection?: boolean;
}

export class UsbTransport extends AbstractUsbTransport {
    private static instances: UsbTransport[] = [];
    private static acquirePortPromise?: Promise<IPortSelection[]>;
    private static previouslyAcquiredPorts?: Promise<IPortSelection[]>;
    private static listPortsPromise?: Promise<IUsbPort[]>;
    private static acquirePortsForList: UsbTransport[] = [];
    private static autoDetectDeviceEnabled = false;
    public static pauseConnectingOnNewPortsFound: boolean;

    private recentlyAcquiredPort?: IUsbPort;
    private preferredPortName?: string;
    private _userSelectedPortName?: string;
    private _userSelectedBaudRate?: BaudRate;
    private pmTransport?: XdsTransport;
    private availablePorts: IUsbPort[] = [];
    protected console: GcConsole;

    constructor(readonly params: IUsbTransportParams) {
        super();

        this.console = new GcConsole(MODULE_NAME, this.id);

        if (params.pm) {
            this.pmTransport = new XdsTransport(params, async () => {
                if (params.hid) {
                    throw Error(`${capitalize(this.toString())} cannot have both pm and hid properties set.`);
                }
                const acquiredPortSelection = await UsbTransport.acquirePort(this);

                if (!acquiredPortSelection) {
                    throw Error('No port found.');
                }
                return [acquiredPortSelection.port.comName, acquiredPortSelection.baudRate];
            });
        }
        connectionManager.registerTransport(this.pmTransport || this);
        codecRegistry.register(this.pmTransport || this);

        if (!UsbTransport.instances.includes(this)) {
            UsbTransport.instances.push(this);
        }
    }

    get selectedPort() {
        return this.usbPort || this.recentlyAcquiredPort;
    }

    get selectedBaudRate() {
        return this.baudRate;
    }

    get state() {
        if (this.pmTransport) {
            return this.pmTransport.state;
        }
        return super.state;
    }

    connect(failedDevicesList?: Array<string>) {
        if (this.pmTransport) {
            return this.pmTransport.connect(failedDevicesList);
        } else {
            return super.connect(failedDevicesList);
        }
    }

    async onConnect(logger: IConnectionLog) {
        if (!this.params.disableDeviceDetection) {
            UsbTransport.startDeviceDetection();
        }

        const acquiredPortSelection = await UsbTransport.acquirePort(this);
        this.recentlyAcquiredPort = acquiredPortSelection?.port;

        this.assertStillConnecting();

        if (!acquiredPortSelection) {
            throw Error('No port found.  Please plug your target device into your computer\'s USB port, and click the connect icon on the left.');
        }
        const selectedPort = acquiredPortSelection.port;
        const selectedBaudRate = acquiredPortSelection.baudRate;

        let description = selectedPort?.comName || '';
        if (selectedPort.type !== usbHidPortType && selectedBaudRate) {
            description += ':' + selectedBaudRate;
        }

        this.setConnectionDescription(description);

        this.fireEvent(selectedPortEventType, {
            port: selectedPort,
            baudRate: selectedBaudRate,
            availablePorts: this.availablePorts,
            transport: this
        });

        await this.doOpenUsbPort(selectedPort, selectedBaudRate);
    }

    disconnect() {
        if (this.pmTransport) {
            return this.pmTransport.disconnect();
        } else {
            return super.disconnect();
        }
    }

    dispose() {
        const i = UsbTransport.instances.indexOf(this);
        if (i >= 0) {
            UsbTransport.instances.splice(i, 1);
            UsbTransport.stopDeviceDetection();
        }

        connectionManager.unregisterTransport(this.pmTransport || this);
        codecRegistry.unregister(this.pmTransport || this);
    }

    private filterPorts(ports: IUsbPort[]): IFilterUsbPorts {
        // filter ports based on hid and usb flags.  If usb and hid both are true, then filter by usb.
        if (this.params.usb || this.params.pm) {
            ports = ports.filter(port => port.type === usbSerialPortType);
        } else if (this.params.hid) {
            ports = ports.filter(port => port.type === usbHidPortType);
        } // else both usb, and hid are true, so no filtering required.

        const usbService: IUsbService = ServicesRegistry.getService(usbServiceType);
        ports = usbService.filterPortsByDescriptorInfo(ports, { vendorId: this.params.vendorId, productId: this.params.productId, interfaceNumber: this.params.interfaceNumber });

        if (this.params.filter !== undefined) {
            ports = this.params.filter!(ports);
        }

        const details = { ports: ports, recommendedPort: undefined, recommendedBaudRate: undefined };
        this.fireEvent(filterPortsEventType, details);
        return details;
    }

    private onDeviceDetachedEvent(ports: IUsbPort[]) {
        if (!this.params.disableDeviceDetection && codecRegistry.isActive(this.id) && this.canDisconnect) {
            const inUsePort = this.usbPort;
            if (inUsePort && ports.reduce((notFound, port) => notFound && UsbTransport.comparePortsByComName(inUsePort, port) !== 0, true)) {
                this.disconnect();
            }
        }
    }

    private get storageKeyPrefix() {
        return `${GcUtils.appName}_${this.params.id}_`;
    }

    get userSelectedPortName() {
        if (!this._userSelectedPortName) {
            this._userSelectedPortName = GcLocalStorage.getItem(this.storageKeyPrefix + StorageKeys.comPort) || undefined;
        }
        return this._userSelectedPortName;
    }

    set userSelectedPortName(comPort: string | undefined) {
        if (comPort) {
            GcLocalStorage.setItem(this.storageKeyPrefix + StorageKeys.comPort, comPort);
        } else {
            GcLocalStorage.removeItem(this.storageKeyPrefix + StorageKeys.comPort);
        }
        this._userSelectedPortName = comPort || undefined;
    }

    get userSelectedBaudRate() {
        if (!this._userSelectedBaudRate) {
            const baudRateName = GcLocalStorage.getItem(this.storageKeyPrefix + StorageKeys.baudRate);
            if (baudRateName) {
                this._userSelectedBaudRate = Number.parseInt(baudRateName) as BaudRate;
            }
        }
        return this._userSelectedBaudRate;
    }

    set userSelectedBaudRate(baudRate: BaudRate | undefined) {
        if (baudRate) {
            GcLocalStorage.setItem(this.storageKeyPrefix + StorageKeys.baudRate, baudRate.toString());
        } else {
            GcLocalStorage.removeItem(this.storageKeyPrefix + StorageKeys.baudRate);
        }
        this._userSelectedBaudRate = baudRate || undefined;
    }

    private computeScoreForPortAllocation(comName: string, recommendedPortName?: string): number {
        let result = codecRegistry.isOptional(this.id) ? 0 : 1;
        if (comName === this.userSelectedPortName) {
            result += 8;
        }
        if (comName === this.preferredPortName) {
            result += 4;
        }
        if (comName === recommendedPortName) {
            result += 2;
        }
        return result;
    }

    private static async computeScoresForPortAllocation(ports: IUsbPort[], transports: UsbTransport[]): Promise<IPortSelection[]> {
        const scores: IPortSelection[] = [];
        const usbService: IUsbService = ServicesRegistry.getService(usbServiceType);

        for (let i = 0; i < transports.length; i++) {
            const transport = transports[i];
            // eslint-disable-next-line prefer-const
            let { ports: filteredPorts, recommendedPort: recommendedPort, recommendedBaudRate: recommendedBaudRate } = transport.filterPorts(ports);

            if (!recommendedPort) {
                const defaultPort = await usbService.getDefaultPort(filteredPorts, transport.params.deviceName);
                if (defaultPort) {
                    recommendedPort = defaultPort.port;
                    recommendedBaudRate = transport.params.defaultBaudRate || defaultPort.baudRate;
                }
            }
            const recommendedComName = recommendedPort ? recommendedPort.comName : undefined;
            if (transport.usbPort) {  // transport is already using this port.
                scores.push({ port: transport.usbPort, transport, score: 100, baudRate: transport.baudRate || transport.params.defaultBaudRate || 9600 });
            } else {
                filteredPorts.forEach((port) => {
                    if (!port.isOpened) {  // don't allocate open ports used by other transports, but leave in list of available ports.
                        scores.push({
                            port: port,
                            transport: transport,
                            score: transport.computeScoreForPortAllocation(port.comName, recommendedComName),
                            baudRate: transport.userSelectedBaudRate || recommendedBaudRate || transport.params.defaultBaudRate || 9600
                        });
                    }
                });
            }
            transport.availablePorts = [...filteredPorts];
        }
        return scores;
    }

    private static async allocatePorts(ports: IUsbPort[], transports: UsbTransport[]): Promise<IPortSelection[]> {
        let scores = await this.computeScoresForPortAllocation(ports, transports);
        scores = scores.sort((a, b) => b.score - a.score);
        const picks: IPortSelection[] = [];
        while (scores.length > 0) {
            const pick = scores[0];
            scores = scores.filter((score) => score.port !== pick.port && score.transport !== pick.transport);
            picks.push(pick);
        }
        return picks;
    }

    /**
     * Helper method to compare usb ports two usb ports by their name, for the purposes of finding or sorting usb ports.
     *
     * @param portA usb port to compare with port B
     * @param portB usb port to compare with port A
     * @returns -1 if port A is less than port B for the purposes of sorting, +1 if port A is greater than port B, and zero if they are equal.
     *
     */
    static comparePortsByComName(portA?: IUsbPort, portB?: IUsbPort): number {
        if (!portA) {
            return portB ? -1 : 0;  // handle the case where both ports are undefined, since this is public method.
        } else if (!portB) {
            return 1;
        } else if (portA.type !== portB.type) {
            return portA.type === usbHidPortType ? -1 : 1;
        } else {
            return portA.comName.localeCompare(portB.comName);
        }
    }

    private static listPorts() {
        if (!this.listPortsPromise) {
            const usbService: IUsbService = ServicesRegistry.getService(usbServiceType);
            const activeTransports = this.activeTransports;
            const usbOnly = activeTransports.reduce((usb: boolean, transport) => usb && (transport.params.usb || false), true);
            const hidOnly = activeTransports.reduce((hid: boolean, transport) => hid && (transport.params.hid || false), true);
            const filter = usbOnly ? usbSerialPortType : hidOnly ? usbHidPortType : undefined;

            // Usb-hid module only supports filtering on one vendor id.  If not provided then default 8263 is used, so
            // we need to make sure all transports are ok with this; otherwise, report an error.
            const hidTransports = activeTransports.filter(transport => transport.params.hid);
            let vendorId: number | undefined;
            if (hidTransports.length > 0) {
                const vendorIds = hidTransports.map(transport => transport.params.vendorId || 8263);
                const vendorId = vendorIds[0];
                const same = vendorIds.reduce((same, vid) => same && vid === vendorId, true);
                if (!same) {
                    GcConsole.error(MODULE_NAME, 'Multiple HID transports are requesting different vendor id\'s which is not currently supported.');
                    // don't stop, keep going.  Worst case is that user will not see all the hid ports they need.
                }
            }

            this.listPortsPromise = (async () => {
                try {
                    let ports: IUsbPort[];
                    if (filter) {
                        ports = await usbService.listPorts(filter);
                    } else {
                        const usb = usbService.listPorts(usbSerialPortType);
                        const hid = usbService.listPorts(usbHidPortType, vendorId);
                        ports = [...await usb, ... await hid];
                    }

                    UsbTransport.instances.forEach(transport => {
                        if (transport.recentlyAcquiredPort && !ports.includes(transport.recentlyAcquiredPort)) {
                            transport.recentlyAcquiredPort = undefined;
                        }
                    });
                    return ports;
                } finally {
                    this.listPortsPromise = undefined;
                }
            })();
        }
        return this.listPortsPromise;
    }

    private static async acquirePort(forTransport: UsbTransport): Promise<IPortSelection | undefined> {

        if (!this.acquirePortsForList.includes(forTransport)) {
            this.acquirePortsForList.push(forTransport);
        }

        if (!this.acquirePortPromise) {
            this.acquirePortPromise = (async () => {
                try {
                    const ports = await this.listPorts();
                    // do port identification
                    await AutoDetectPortIdentityRegistry.updateAllPortIdentities(ports);
                    return await this.allocatePorts(ports, this.acquirePortsForList);

                } finally {
                    this.previouslyAcquiredPorts = this.acquirePortPromise;
                    this.acquirePortPromise = undefined;
                    this.acquirePortsForList = [];
                }
            })();
        }
        const allocatedPorts = await this.acquirePortPromise;
        return allocatedPorts.reduce((port: IPortSelection | undefined, item) => item.transport === forTransport ? item : port, undefined);
    }

    protected async doConnect(failedDevicesList: Array<string> = []) {
        await super.doConnect(failedDevicesList);

        // if we successfully connect (including codes and models), then remember this port as the preferred port for next time.
        if (this.usbPort) {
            this.preferredPortName = this.usbPort.comName;
        }
    }

    addEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        super.addEventListener(type, listener);
        if (this.pmTransport && (type as unknown === connectedStateChangedEventType || type as unknown === connectionLogEventType)) {
            this.pmTransport.addEventListener(type, listener);
        }
    }

    removeEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T> | undefined) {
        super.removeEventListener(type, listener);
        if (this.pmTransport && (type as unknown === connectedStateChangedEventType || type as unknown === connectionLogEventType)) {
            this.pmTransport.removeEventListener(type, listener);
        }
    }

    private static async onDeviceAttachedEvent(this: void) {
        if (UsbTransport.pauseConnectingOnNewPortsFound) {
            // skip
        } else if (connectionManager.isConnected) {
            // connect any optional transports that are not already connected, but only if they acquired a different port.
            if (connectionManager.isPartiallyConnected) {
                const acquiredPorts = await UsbTransport.acquireAllPorts();
                const transportsToConnect = acquiredPorts.reduce((transports: UsbTransport[], portSelection) => {
                    const transport = portSelection.transport;
                    if (!transport.params.disableDeviceDetection && codecRegistry.isActive(transport.id) && (transport.isDisconnected || transport.isDisconnecting)) {
                        if (portSelection.port && portSelection.port !== transport.recentlyAcquiredPort) {
                            transports.push(transport);
                        }
                    }
                    return transports;
                }, []);
                if (transportsToConnect.length > 0) {
                    try {
                        UsbTransport.acquirePortPromise = UsbTransport.previouslyAcquiredPorts; // don't list ports, with port identity twice in a row.
                        await GcPromise.all(transportsToConnect.map(transport => transport.connect()));
                    } finally {
                        UsbTransport.acquirePortPromise = undefined;
                    }
                }
            }
        } else if (connectionManager.allowAutoConnectOnDeviceDetection && connectionManager.isDisconnected) {  // do full connect only if enough ports were allocated.
            const acquiredPorts = await UsbTransport.acquireAllPorts();
            const requiredPorts = acquiredPorts.filter(portSelection => !codecRegistry.isOptional(portSelection.transport.id));
            const missingRequiredPorts = requiredPorts.filter(portSelection => portSelection.port === undefined || portSelection.transport.params.disableDeviceDetection);
            const changedPorts = requiredPorts.filter(portSelection => portSelection.port !== portSelection.transport.recentlyAcquiredPort);
            if (changedPorts.length > 0 && missingRequiredPorts.length === 0) {
                try {
                    UsbTransport.acquirePortPromise = UsbTransport.previouslyAcquiredPorts; // don't list ports, with port identity twice in a row.
                    await connectionManager.connect();
                } finally {
                    UsbTransport.acquirePortPromise = undefined;
                }
            }
        }
    }

    private static async onDeviceDetachedEvent(this: void) {
        const ports = await UsbTransport.listPorts();
        UsbTransport.instances.forEach(transport => transport.onDeviceDetachedEvent(ports));
    }

    private static startDeviceDetection() {
        if (!this.autoDetectDeviceEnabled) {
            const usbService = ServicesRegistry.getService(usbServiceType);
            usbService.addEventListener(deviceDetachedEventType, this.onDeviceDetachedEvent);
            usbService.addEventListener(deviceAttachedEventType, this.onDeviceAttachedEvent);
            this.autoDetectDeviceEnabled = true;
        }
    }

    private static stopDeviceDetection() {
        if (this.autoDetectDeviceEnabled && this.instances.reduce((off, transport) => off && transport.params.disableDeviceDetection || true, false)) {
            const usbService = ServicesRegistry.getService(usbServiceType);
            usbService.removeEventListener(deviceDetachedEventType, this.onDeviceDetachedEvent);
            usbService.removeEventListener(deviceAttachedEventType, this.onDeviceAttachedEvent);
            this.autoDetectDeviceEnabled = false;
        }
    }

    private static get activeTransports() {
        return this.instances.filter(transport => {
            try {
                return codecRegistry.isActive(transport.id);
            } catch (e) {
                return false;
            }
        });
    }

    public static acquireAllPorts(): Promise<ISelectedUsbPort[]> {
        this.previouslyAcquiredPorts = undefined;
        const allTransports = this.activeTransports;
        const promises: Promise<ISelectedUsbPort>[] = [];
        for (let i = 0; i < allTransports.length; i++) {
            const transport = allTransports[i];
            promises.push((async () => {
                const result = await this.acquirePort(allTransports[i]);
                return {
                    availablePorts: transport.availablePorts,
                    port: result && result.port,
                    baudRate: result && result.baudRate,
                    transport: transport
                } as ISelectedUsbPort;
            })());
        }
        return GcPromise.all(promises);
    }

    private static async doReconnect(transport: AbstractTransport, autoConnect: boolean) {
        if (transport.canDisconnect) {
            await transport.disconnect();
            await transport.connect();
        } else if (autoConnect && transport.canConnect) {
            await transport.connect();
        }
    }

    public static async applyUserPortSelections(userPortSelections: Omit<ISelectedUsbPort, 'availablePorts'>[], autoConnect: boolean) {
        userPortSelections.forEach(userSelection => {
            userSelection.transport.userSelectedPortName = userSelection.port?.comName;
            userSelection.transport.userSelectedBaudRate = userSelection.baudRate;
        });
        const allOptional = userPortSelections.reduce((optional: boolean, selection) => optional && (selection.transport.params.optional || false), true);

        try {
            if (connectionManager.canConnect && autoConnect) {
                await connectionManager.connect();
            } else if (!allOptional) {
                await this.doReconnect(connectionManager, autoConnect);
            } else {
                await Promise.all(userPortSelections.map(userSelection => this.doReconnect(userSelection.transport, autoConnect)));
            }
        } catch (e) {
            // prevent unhandled exceptions messages in console log.
        }
    }
}
