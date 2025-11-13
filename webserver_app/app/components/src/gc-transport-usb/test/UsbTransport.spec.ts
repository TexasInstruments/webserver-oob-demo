import '../../gc-core-assets/lib/NodeJSEnv';
import path from 'path';
import { expect } from 'chai';
import { UsbTransport, filterPortsEventType, IFilterUsbPorts, ISelectedUsbPort, selectedPortEventType, IUsbTransportParams, AutoDetectPortIdentityHandlerType, IAutoDetectPortIdentityHelper, AutoDetectPortIdentityRegistry } from '../lib/UsbTransport';
import { IListener, Events, IEvent, EventType } from '../../gc-core-assets/lib/Events';
import { processArgs, LAUNCHPADS } from '../../gc-core-assets/test/TestArgs';
import { codecRegistry, AbstractDataDecoder, IConnectionLog, binaryOrBufferDataType, bufferDataType } from '../../gc-target-configuration/lib/TargetConfiguration';
import { IDeferedPromise, GcPromise } from '../../gc-core-assets/lib/GcPromise';
import { ICodecBaseParams } from '../../gc-target-configuration/lib/ICodecBaseParams';
import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { GcConsole, IOutputListener } from '../../gc-core-assets/lib/GcConsole';
import {
    IUsbService, IFilterOptionsForUsbPorts, IUsbPort, IUsbHidPort, IDeviceOptions, UsbPortType, IDevice, IUsbDevice, IUsbDeviceInterface,
    usbSerialPortType, usbHidPortType, usbServiceType, deviceDetachedEventType, deviceAttachedEventType,
} from '../../gc-service-usb/lib/ServiceUsb';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { Usb2anyCodec } from '../../gc-codec-usb2any/lib/Usb2anyCodec';
import { Usb2anyI2cCodec } from '../../gc-codec-usb2any-i2c/lib/Usb2anyI2cCodec';
import { IRegisterInfo } from '../../gc-model-register/lib/IRegisterInfo';
import { Usb2anyPowerCodec } from '../../gc-codec-usb2any-power/lib/Usb2anyPowerCodec';
import { JsonCodec } from '../../gc-codec-json/lib/JsonCodec';
import { DelimitedTextCodec } from '../../gc-codec-delimited-text/lib/DelimitedTextCodec';
import { StreamingDataModel } from '../../gc-model-streaming/lib/StreamingDataModel';
import { TargetProgramLoader } from '../../gc-target-program-loader/lib/TargetProgramLoader';
import { GcFiles } from '../../gc-core-assets/lib/GcFiles';
import { TestResults } from '../../gc-service-ds/test/typdef_results';

GcConsole.setLevel('gc-transport-usb', processArgs.enableLog);

class TestCodec extends AbstractDataDecoder<Uint8Array | Buffer | number[], number[] | Buffer> {
    private lastPacketReceived?: IDeferedPromise<Uint8Array | Buffer | number[]>;
    readonly params: ICodecBaseParams = {};

    constructor(id: string) {
        super(id, binaryOrBufferDataType, bufferDataType);
    }

    decode(data: number[] | Buffer | Uint8Array): boolean | Error {
        if (this.lastPacketReceived) {
            this.lastPacketReceived.resolve(data);
        }
        return true;
    }

    encode(data: number[]) {
        this.targetEncoder.encode(data);
        this.lastPacketReceived = GcPromise.defer<Uint8Array | Buffer | number[]>();
    }

    getLastPacketReceived() {
        if (!this.lastPacketReceived) {
            throw 'There is no last packet received due to missing encode() call.';
        }
        return GcPromise.timeout(this.lastPacketReceived.promise!, 1000, 'Timeout on HID packet received');
    }
}

class NullDevice implements IUsbDevice {
    interfaces: IUsbDeviceInterface[] = [];
    key = 'any';
    reset(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    getDescriptors(): Promise<unknown> {
        throw new Error('Method not implemented.');
    }
    getStringDescriptor(index: number, maxLength?: number): Promise<string> {
        throw new Error('Method not implemented.');
    }
    controlTransfer(bmRequestType: number, bRequest: number, wValue: number, wIndex: number, dataOrLength: number | Buffer): Promise<unknown> {
        throw new Error('Method not implemented.');
    }
    isOpened = false;
    descriptor: unknown;
    name = 'null';
    open(options?: IDeviceOptions): Promise<void> {
        throw new Error('Method not implemented.');
    }
    close(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    isEqual(device: IDevice): boolean {
        throw new Error('Method not implemented.');
    }
    addEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>): void {
        throw new Error('Method not implemented.');
    }
    removeEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>): void {
        throw new Error('Method not implemented.');
    }
}

const nullDevice = new NullDevice();

class TestUsbService extends Events implements IUsbService {
    baseUsbService?: IUsbService;
    listPortsCount = 0;
    listPortsPromise?: Promise<IUsbPort[]>;
    listHidPortsPromise?: Promise<IUsbHidPort[]>;

    async waitForListPorts() {
        await GcUtils.delay();
        if (this.listPortsPromise) {
            await this.listPortsPromise;
        }
        if (this.listHidPortsPromise) {
            await this.listHidPortsPromise;
        }
        await GcUtils.delay();
    }

    async listPorts<T extends IUsbPort>(type: UsbPortType<T>, vendorId?: number): Promise<T[]> {
        if (this.baseUsbService) {
            this.listPortsCount++;
            let ports: IUsbPort[];
            if (type as unknown === usbSerialPortType) {
                this.listPortsPromise = this.baseUsbService.listPorts(type, vendorId);
                ports = await this.listPortsPromise;
            } else {
                this.listHidPortsPromise = this.baseUsbService.listPorts(type, vendorId);
                ports = await this.listHidPortsPromise;
            }
            return ports.filter(port => this.hidePorts.reduce((keep: boolean, comName) => keep && port.comName !== comName, true)).
                map(port => type.asUsbPortType(port));
        }
        throw new Error('Method not implemented.');
    }
    listDevices(vendorIds?: string): Promise<IUsbDevice[]> {
        throw new Error('Method not implemented.');
    }
    getDefaultPort(ports: IUsbPort[], deviceName?: string) {
        if (this.baseUsbService) {
            return this.baseUsbService.getDefaultPort(ports, deviceName);
        }
        throw new Error('Method not implemented.');
    }

    private hidePorts: string[] = [];
    setPortsToHide(hidePorts: string[] = [], fireEvents = true) {
        const oldCount = this.hidePorts?.length || 0;

        this.hidePorts = hidePorts;
        if (fireEvents) {
            if (hidePorts.length <= oldCount) {
                this.fireEvent(deviceAttachedEventType, { device: nullDevice });
            } else {
                this.fireEvent(deviceDetachedEventType, { device: nullDevice });
            }
        }
    }

    hasListeners<T extends IEvent>(type: EventType<T>) {
        return this.hasAnyListeners(type);
    }

    filterPortsByDescriptorInfo<T extends IUsbPort>(ports: T[], filterOptions: IFilterOptionsForUsbPorts) {
        if (this.baseUsbService) {
            return this.baseUsbService.filterPortsByDescriptorInfo(ports, filterOptions);
        }
        return ports;
    }
}

[...LAUNCHPADS, 'TMP117'].forEach(deviceName => {

    describe(`UsbTransport for ${deviceName}`, () => {

        /* eslint-disable @typescript-eslint/no-unused-vars */
        let testCodec: TestCodec;
        let usbTransport: UsbTransport;
        let usbTransportParams: IUsbTransportParams;
        let testUsbService: TestUsbService;
        let selectedComName = '';
        let cr: DelimitedTextCodec;
        let json: JsonCodec;
        let streamModel: StreamingDataModel;
        let programLoader: TargetProgramLoader;

        before(function () {
            const baseUsbService = ServicesRegistry.getService(usbServiceType);  // cache real usb service for test stub to wrap.
            ServicesRegistry.register(usbServiceType, TestUsbService);     // register the test stub.
            testUsbService = ServicesRegistry.getService(usbServiceType) as TestUsbService;
            testUsbService.baseUsbService = baseUsbService;

            if (!processArgs.deviceNames.includes(deviceName)) {
                this.skip();
            }

            testCodec = new TestCodec('test');

            if (deviceName === 'TMP117') {
                usbTransportParams = { hid: true };
            } else {
                usbTransportParams = { usb: true, deviceName: deviceName };
            }
            usbTransport = new UsbTransport(usbTransportParams);

            cr = new DelimitedTextCodec({ id: 'cr' });
            json = new JsonCodec({ id: 'json' });
            streamModel = new StreamingDataModel({ id: 'stream', deviceId: 'launchpad', timeout: 5000 });
            programLoader = new TargetProgramLoader( {  autoProgram: true, deviceId: 'launchpad' });

        });

        it('configure', () => {
            expect(() => {
                connectionManager.setActiveConfiguration('usb+test');
            }).to.not.throw();
            expect(codecRegistry.isActive('test')).to.be.true;
        });

        it('connect', async () => {
            let onFilterEventHit = false;
            let onSelectEventHit = false;
            let thrownException: Error | undefined;

            const onFilterPorts: IListener<IFilterUsbPorts> = (details) => {
                try {
                    onFilterEventHit = true;
                    expect(details.ports).to.be.not.empty;
                    expect(usbTransport.isConnecting).to.be.true;
                } catch (e) {
                    thrownException = e;
                    throw e;
                }
            };

            const onSelectedPort: IListener<ISelectedUsbPort> = (details) => {
                try {
                    onSelectEventHit = true;
                    expect(details.port).to.exist;
                    expect(usbTransport.isConnecting).to.be.true;
                } catch (e) {
                    thrownException = e;
                    throw e;
                }
            };

            usbTransport.addEventListener(filterPortsEventType, onFilterPorts);
            usbTransport.addEventListener(selectedPortEventType, onSelectedPort);

            try {
                expect(testUsbService.hasListeners(deviceDetachedEventType)).to.be.false;
                expect(testUsbService.hasListeners(deviceAttachedEventType)).to.be.false;

                await usbTransport.connect();
                expect(usbTransport.params.hid ? testUsbService.listHidPortsPromise : testUsbService.listPortsPromise).to.exist;
                expect(usbTransport.params.usb ? testUsbService.listHidPortsPromise : testUsbService.listPortsPromise).to.not.exist;

                expect(testUsbService.hasListeners(deviceDetachedEventType)).to.be.true;
                expect(testUsbService.hasListeners(deviceAttachedEventType)).to.be.true;

                expect(onFilterEventHit).to.be.true;
                expect(onSelectEventHit).to.be.true;
                expect(usbTransport.isConnected).to.be.true;
                selectedComName = usbTransport.selectedPort!.comName;

                expect(thrownException, 'Expect errors in event listeners').to.not.exist;
            } finally {
                usbTransport.removeEventListener(filterPortsEventType, onFilterPorts);
                usbTransport.removeEventListener(selectedPortEventType, onSelectedPort);
            }
        });

        it('disconnect on port dropped', async () => {
            testUsbService.listPortsCount = 0;
            testUsbService.setPortsToHide([selectedComName]);
            await testUsbService.waitForListPorts();
            if (usbTransport.isDisconnecting) {
                await usbTransport.disconnect();
            }
            expect(usbTransport.isDisconnected).to.be.true;
            expect(connectionManager.isDisconnected).to.be.true;
            expect(testUsbService.listPortsCount).to.equal(1);
        });

        it('connect on port detected', async () => {
            connectionManager.allowAutoConnectOnDeviceDetection = false;
            testUsbService.listPortsCount = 0;
            testUsbService.setPortsToHide();
            await testUsbService.waitForListPorts();
            expect(usbTransport.isDisconnected).to.be.true;
            expect(testUsbService.listPortsCount).to.equal(0);
            connectionManager.allowAutoConnectOnDeviceDetection = true;
            testUsbService.setPortsToHide();
            await testUsbService.waitForListPorts();
            expect(usbTransport.isConnecting).to.be.true;
            await usbTransport.connect();
            expect(usbTransport.isConnected).to.be.true;
            if (connectionManager.isConnecting) {
                await connectionManager.connect();
            }
            expect(connectionManager.isConnected).to.be.true;
            expect(testUsbService.listPortsCount).to.equal(1);
            expect(usbTransport.selectedPort!.comName).to.equal(selectedComName);
        });

        if (deviceName === 'TMP117') {
            it('sendCommand', async () => {
                testCodec.encode([0x54, 0x70, 4, 1, 0, 1, 0, 0x6a, 0, 0, 0, 0]);
                const data = await testCodec.getLastPacketReceived();
                expect(data).to.deep.equal([0x54, 0xeb, 1, 2, 0, 1, 0, 0x6a, 1]);
            });
        }

        it('disconnect', async () => {
            await usbTransport.disconnect();
            expect(usbTransport.isDisconnected).to.be.true;
        });

        it('port identity', async () => {
            const testRegister: IRegisterInfo = {
                name: 'deviceId',
                nBytes: 2,
                addr: 0x0f
            };

            const power = new Usb2anyPowerCodec({ id: 'power', v33: true });
            const i2c = new Usb2anyI2cCodec({
                id: 'i2c',
                pullup: true,
                addressBits: 7,
                speed: 400,
                deviceAddress: 0x24
            });

            let thrownException;
            let callbackCount = 0;

            const faultInsertionHandler: AutoDetectPortIdentityHandlerType = async (port: IUsbPort, helper: IAutoDetectPortIdentityHelper) => {
                callbackCount++;
                try {
                    await helper.serialPortConnect();
                } catch (e) {
                    thrownException = e;
                }
                throw Error('oops');
            };

            const handler: AutoDetectPortIdentityHandlerType = async (port: IUsbPort, helper: IAutoDetectPortIdentityHelper) => {
                try {
                    callbackCount++;
                    await helper.serialPortConnect();
                    if (helper.isHid) {
                        const u2a = await helper.appendCodec(Usb2anyCodec, {});
                        await helper.appendCodec(Usb2anyPowerCodec, { id: 'power' }, u2a);
                        const i2c = await helper.appendCodec(Usb2anyI2cCodec, { id: 'i2c', deviceAddress: 0x48 }, u2a);

                        const value = await i2c.readValue(testRegister);
                        if ((value & 0xffe) === 0x116) {  // treat TMP 116 the same as 117
                            return 'TMP117';
                        }
                    }
                } catch (e) {
                    thrownException = e;
                } finally {
                    power.dispose();
                    i2c.dispose();
                }
            };

            AutoDetectPortIdentityRegistry.registerPortIdentityHandler(faultInsertionHandler);
            AutoDetectPortIdentityRegistry.registerPortIdentityHandler(handler);
            const result = await UsbTransport.acquireAllPorts();
            AutoDetectPortIdentityRegistry.unRegisterPortIdentityHandler(handler);
            AutoDetectPortIdentityRegistry.unRegisterPortIdentityHandler(faultInsertionHandler);

            expect(thrownException).to.not.exist;
            expect(result.length).to.equal(1);
            expect(callbackCount, 'Incorrect number of port identity calls.').to.equal(result[0].availablePorts.length * 2);
            const found = result[0].availablePorts.reduce((found: boolean, port) => found || AutoDetectPortIdentityRegistry.getDisplayName(port) === 'USB2ANY/OneDemo device (TMP117)', false);
            expect(found, 'No port with identity TMP117').to.equal(deviceName === 'TMP117' ? true : false);
        });

        it('filter ports', async () => {
            usbTransportParams.hid = false;
            const usbTransport2 = new UsbTransport({ id: 'tmp2', usb: true, interfaceNumber: 0 });
            const usbTransport3 = new UsbTransport({ id: 'tmp3', usb: true, vendorId: 0x451 });
            const usbTransport4 = new UsbTransport({ id: 'tmp4', usb: true, productId: 0xbef3 });
            const usbTransport5 = new UsbTransport({ id: 'tmp5', hid: true });
            const usbTransportAll = new UsbTransport({ id: 'all' });
            connectionManager.setActiveConfiguration('usb + test , tmp2 , tmp3 , tmp4, tmp5 , all');

            const callback = (details: IFilterUsbPorts) => {
                details.ports = details.ports.filter(port => {
                    return port.type === usbSerialPortType && port.descriptor.vendorId !== '0451' && port.descriptor.productId !== 'BEF3' &&
                        (!port.descriptor.pnpId || !(port.descriptor.pnpId as string).endsWith('00'));
                });
            };
            try {
                usbTransport.addEventListener(filterPortsEventType, callback);
                const results: ISelectedUsbPort[] = await UsbTransport.acquireAllPorts();
                expect(results).to.exist;
                const availablePortsMap = new Map<string, Array<IUsbPort>>();
                results.forEach(result => availablePortsMap.set(result.transport.id, result.availablePorts));
                const tmpPortList = [...availablePortsMap.get('tmp2')!, ...availablePortsMap.get('tmp3')!, ...availablePortsMap.get('tmp4')!, ...availablePortsMap.get('tmp5')!];
                availablePortsMap.get('all')!.forEach(port => {
                    const found = availablePortsMap.get('usb')!.includes(port);
                    expect(tmpPortList.includes(port)).to.equal(!found);
                });
            } finally {
                connectionManager.setActiveConfiguration('usb+test');
                usbTransport2.dispose();
                usbTransport3.dispose();
                usbTransport4.dispose();
                usbTransport5.dispose();
                usbTransportAll.dispose();
                usbTransport.removeEventListener(filterPortsEventType, callback);
            }
        });

        if (LAUNCHPADS.includes(deviceName)) {
            it('switch baud rate while waiting for data', async () => {
                const expectedResults = (await GcFiles.readJsonFile(path.join(__dirname, `../../../test/assets/${deviceName}_results.json`))) as TestResults;
                programLoader.params.deviceName = deviceName;
                programLoader.params.connectionName = expectedResults.connectionName,
                programLoader.params.programOrBinPath = path.resolve(__dirname, `../../../test/assets/${deviceName}_serial_blink.out`);

                connectionManager.setActiveConfiguration('usb+cr+json+stream');
                await connectionManager.connect();
                expect(usbTransport.isConnected).to.be.true;

                try {
                    UsbTransport.applyUserPortSelections([{ baudRate: 2400, transport: usbTransport }], true);

                    await GcUtils.delay(500);
                    expect(usbTransport.isConnecting, 'connecting with bad baud rate, expected to be stuck in connecting state').to.be.true;
                    expect(usbTransport.progressMessage === 'Waiting for data ...');

                    UsbTransport.applyUserPortSelections([{ baudRate: 9600, transport: usbTransport }], true);

                    await GcUtils.delay(1);
                    if (usbTransport.isDisconnecting) {
                        await usbTransport.disconnect();
                    }

                    await GcUtils.delay(1);
                    if (usbTransport.isConnecting) {
                        await usbTransport.connect();
                    }

                    expect(usbTransport.isConnected, 'connected after changing to correct baud rate').to.be.true;
                } finally {
                    usbTransport.disconnect();
                    if (usbTransport.isDisconnecting) {
                        await usbTransport.disconnect();
                    }
                    expect(usbTransport.isDisconnected, 'transport disconnected').to.be.true;
                }
            });
        }

        it('dispose', () => {
            try {
                const usbTransport2 = new UsbTransport({ id: 'usb2', disableDeviceDetection: true });
                usbTransport.dispose();  // make sure we remove usb service listeners before unregistering TestUsbService

                expect(testUsbService.hasListeners(deviceDetachedEventType)).to.be.false;
                expect(testUsbService.hasListeners(deviceAttachedEventType)).to.be.false;

                usbTransport2.dispose();
            } catch (e) {
                expect(e).to.not.exist;
            }
        });

        after(() => {
            ServicesRegistry.unregister(usbServiceType, TestUsbService);

            if (testCodec) {
                testCodec.dispose();
                cr.dispose();
                json.dispose();
                streamModel.dispose();
                programLoader.dispose();
            }
        });
    });
});

describe('UsbTransport', () => {

    class UsbPortStub extends Events implements IUsbPort {
        isOpened = false;
        constructor(private port: IUsbPort) {
            super();
        }
        get name() {
            return this.port.name;
        }
        get descriptor() {
            return this.port.descriptor;
        }
        get type() {
            return this.port.type;
        }
        get comName() {
            return this.port.comName;
        }
        async write(data: string | Buffer | number[]) {
            if (!this.isOpened) {
                throw Error(`Serial port ${this.comName} is not open`);
            }
        }
        async open(options?: IDeviceOptions) {
            if (this.isOpened) {
                throw Error(`Serial port ${this.comName} is already open`);
            }
            this.isOpened = true;
        }
        async close(): Promise<void> {
            if (!this.isOpened) {
                throw Error(`Serial port ${this.comName} is already closed`);
            }
            this.isOpened = false;
        }
        isEqual(device: IDevice): boolean {
            return this === device;
        }
    }

    class TestUsbService2 extends TestUsbService {
        async listPorts<T extends IUsbPort>(type: UsbPortType<T>, vendorId?: number): Promise<T[]> {
            const result = await super.listPorts(type, vendorId);
            return result.map(port => new UsbPortStub(port)) as unknown as T[];
        }
    }

    /* eslint-disable @typescript-eslint/no-unused-vars */
    let usbA: UsbTransport;
    let usbB: UsbTransport;
    let testUsbService: TestUsbService2;
    let allUsbComPortNames: string[];
    let counterForAutoDetectCalls = 0;
    const autoDetectPortIdentityHandler: AutoDetectPortIdentityHandlerType = () => {
        counterForAutoDetectCalls++;
    };
    let selectedComName: string;
    let defaultPortA: IUsbPort | undefined;
    let defaultPortB: IUsbPort | undefined;
    let failureMsg = '';

    before(async function () {
        const baseUsbService = ServicesRegistry.getService(usbServiceType);  // cache real usb service for test stub to wrap.
        ServicesRegistry.register(usbServiceType, TestUsbService);     // register the test stub.
        testUsbService = ServicesRegistry.getService(usbServiceType) as TestUsbService2;
        testUsbService.baseUsbService = baseUsbService;

        usbA = new (class extends UsbTransport {
            async onConnect(logger: IConnectionLog) {
                await super.onConnect(logger);
                if (failureMsg) {
                    super.onDisconnect(logger);
                    throw Error(failureMsg);
                }
            }
        })({ id: 'usbA' });
        usbB = new UsbTransport({ id: 'usbB' });
        connectionManager.setActiveConfiguration('usbA,usbB');
        connectionManager.allowAutoConnectOnDeviceDetection = true;

        AutoDetectPortIdentityRegistry.registerPortIdentityHandler(autoDetectPortIdentityHandler);

        const hidPorts = baseUsbService.listPorts(usbHidPortType);
        allUsbComPortNames = ([...(await baseUsbService.listPorts(usbSerialPortType)), ... await hidPorts]).map(port => port.comName);

        // need two ports to perform these tests
        if (allUsbComPortNames.length < 2) {
            this.skip();
        }
        selectedComName = allUsbComPortNames[1];
    });

    it('no port detection before first connect', async () => {
        testUsbService.setPortsToHide();
        await GcUtils.delay(1);
        expect(testUsbService.listPortsCount).to.equal(0);
        expect(counterForAutoDetectCalls).to.equal(0);
    });

    it('do not auto connect if not enough ports available', async () => {
        testUsbService.setPortsToHide(allUsbComPortNames, false);
        let errorMessage = '';
        // attempt to connect to get transports A, and B, to register for port detection
        try {
            await connectionManager.connect();
        } catch (e) {
            errorMessage = e.message || e.toString();
        }
        expect(errorMessage).to.equal('One or more transports failed to connect without error.');
        if (connectionManager.isDisconnecting) {
            await connectionManager.disconnect();
        }
        expect(connectionManager.isDisconnected).to.be.true;
        expect(usbA.isDisconnected).to.be.true;
        expect(usbB.isDisconnected).to.be.true;

        expect(testUsbService.listPortsCount).to.equal(2);
        expect(counterForAutoDetectCalls).to.equal(0);

        testUsbService.setPortsToHide(allUsbComPortNames.filter(comName => comName !== selectedComName));
        await testUsbService.waitForListPorts();
        expect(connectionManager.isDisconnected).to.be.true;
        expect(usbA.isDisconnected).to.be.true;
        expect(usbB.isDisconnected).to.be.true;
        expect(testUsbService.listPortsCount).to.equal(4);
        expect(counterForAutoDetectCalls).to.equal(1);
    });

    it('do not call port identity for usb ports already in use', async () => {
        testUsbService.listPortsCount = 0;
        counterForAutoDetectCalls = 0;
        usbB.params.optional = true;
        await connectionManager.connect();

        expect(connectionManager.isConnected).to.be.true;
        expect(usbA.isConnected).to.be.true;
        expect(usbB.isDisconnected).to.be.true;
        expect(testUsbService.listPortsCount).to.equal(2);
        expect(counterForAutoDetectCalls).to.equal(1);

        counterForAutoDetectCalls = 0;
        testUsbService.setPortsToHide();
        await testUsbService.waitForListPorts();
        if (usbB.isConnecting) {
            await usbB.connect();
        }
        expect(connectionManager.isConnected).to.be.true;
        expect(usbA.isConnected).to.be.true;
        expect(usbB.isConnected).to.be.true;
        expect(testUsbService.listPortsCount).to.equal(4);
        expect(counterForAutoDetectCalls).to.equal(allUsbComPortNames.length - 1);
    });

    it('do not disconnect when optional port is dropped.', async () => {
        testUsbService.listPortsCount = 0;
        counterForAutoDetectCalls = 0;
        usbB.params.optional = true;

        expect(usbB.selectedPort).to.exist;
        selectedComName = usbB.selectedPort!.comName;
        testUsbService.setPortsToHide(allUsbComPortNames.filter(comName => comName === selectedComName));
        await testUsbService.waitForListPorts();
        if (usbB.isDisconnecting) {
            await usbB.disconnect();
        }

        expect(connectionManager.isConnected).to.be.true;
        expect(usbA.isConnected).to.be.true;
        expect(usbB.isDisconnected).to.be.true;
        expect(testUsbService.listPortsCount).to.equal(2);
        expect(counterForAutoDetectCalls).to.equal(0);

        await usbA.disconnect();
    });

    it('connect with missing ports for optional transports', async () => {
        testUsbService.listPortsCount = 0;
        counterForAutoDetectCalls = 0;
        usbB.params.optional = true;
        testUsbService.setPortsToHide(allUsbComPortNames);
        await testUsbService.waitForListPorts();
        testUsbService.setPortsToHide([allUsbComPortNames[0], ...allUsbComPortNames.slice(2)]);
        await testUsbService.waitForListPorts();
        if (connectionManager.isConnecting) {
            await connectionManager.connect();
        }

        expect(connectionManager.isConnected).to.be.true;
        expect(usbA.isConnected).to.be.true;
        expect(usbB.isDisconnected).to.be.true;
        expect(testUsbService.listPortsCount).to.equal(4);
        expect(counterForAutoDetectCalls).to.equal(1);

        await connectionManager.disconnect();
    });

    it('do not auto connect on the same failed port', async () => {
        let errorMsg = '';
        testUsbService.listPortsCount = 0;
        counterForAutoDetectCalls = 0;
        connectionManager.setActiveConfiguration('usbA');
        testUsbService.setPortsToHide([selectedComName], false);
        try {
            failureMsg = 'cannot use this port';
            await connectionManager.connect();
        } catch (e) {
            errorMsg = e.message || e.toString();
        } finally {
            failureMsg = '';
        }
        expect(errorMsg).to.not.equal('');
        expect(testUsbService.listPortsCount).to.equal(2);
        expect(counterForAutoDetectCalls).to.equal(allUsbComPortNames.length - 1);
        testUsbService.listPortsCount = 0;
        counterForAutoDetectCalls = 0;
        if (connectionManager.isDisconnecting) {
            await connectionManager.disconnect();
        }
        expect(usbA.isDisconnected).to.be.true;
        expect(connectionManager.isDisconnected).to.be.true;

        errorMsg = '';
        try {
            failureMsg = 'cannot use this port';
            testUsbService.setPortsToHide();
            await testUsbService.waitForListPorts();
        } catch (e) {
            errorMsg = e.message || e.toString();
        } finally {
            failureMsg = '';
            testUsbService.setPortsToHide(allUsbComPortNames.slice(1), false);
        }
        expect(errorMsg).to.equal('');
        expect(usbA.isDisconnected).to.be.true;
        expect(connectionManager.isDisconnected).to.be.true;
        expect(testUsbService.listPortsCount).to.equal(2);
        expect(counterForAutoDetectCalls).to.equal(allUsbComPortNames.length);
    });

    it('different vendor id\'s are not supported when filtering hid ports', async () => {
        connectionManager.setActiveConfiguration('usbA,usbB');
        usbA.params.hid = usbB.params.hid = true;
        usbA.params.vendorId = 0x2047;
        usbB.params.vendorId = 0x0451;

        let errorMessageCount = 0;
        const outputListener = new (class implements IOutputListener {
            groupCollapsed(groupText: string, style: string): void { /* do nothing */ }
            groupEnd(): void { /* do nothing */ }
            trace(text: string, style: string): void { /* do nothing */ }
            log(text: string): void {
                if (text.indexOf('Multiple HID transports') >= 0 && text.indexOf('different vendor id') >= 0 && text.indexOf('not currently supported') >= 0) {
                    errorMessageCount++;
                }
            }
        })();
        GcConsole.setOutputListener(outputListener);
        GcConsole.setLevel('gc-transport-usb', 'warning');
        try {
            await connectionManager.connect();
        } catch (e) {
            // ignore errors
        } finally {
            GcConsole.setOutputListener(null);
            GcConsole.setLevel('gc-transport-usb', processArgs.enableLog);
        }

        expect(errorMessageCount).to.equal(1);
        await connectionManager.disconnect();
    });

    it('auto connect after user chooses serial ports', async () => {
        usbA.dispose();
        usbB.dispose();

        usbA = new UsbTransport({ id: 'usbA' });
        usbB = new UsbTransport({ id: 'usbB' });
        connectionManager.setActiveConfiguration('usbA, usbB');

        testUsbService.listPortsCount = 0;
        counterForAutoDetectCalls = 0;
        expect(connectionManager.isDisconnected).to.be.true;
        UsbTransport.pauseConnectingOnNewPortsFound = true;
        testUsbService.setPortsToHide();
        await testUsbService.waitForListPorts();
        expect(connectionManager.isDisconnected, 'attempted to connect despite pauseConnectionOnNewPortsFound=false').to.be.true;
        expect(testUsbService.listPortsCount).to.equal(0);
        expect(counterForAutoDetectCalls).to.equal(0);

        const defaultPortAllocation = await UsbTransport.acquireAllPorts();
        expect(defaultPortAllocation.length).to.equal(2);
        expect(testUsbService.listPortsCount).to.equal(2);
        expect(counterForAutoDetectCalls).to.equal(allUsbComPortNames.length);
        testUsbService.listPortsCount = 0;
        counterForAutoDetectCalls = 0;

        expect(defaultPortAllocation[0].transport.id).to.equal('usbA');
        expect(defaultPortAllocation[1].transport.id).to.equal('usbB');
        defaultPortA = defaultPortAllocation[0].port;
        defaultPortB = defaultPortAllocation[1].port;
        defaultPortAllocation[0].port = defaultPortB;
        defaultPortAllocation[1].port = defaultPortA;
        defaultPortAllocation[0].baudRate = 14400;
        defaultPortAllocation[1].baudRate = 115200;
        UsbTransport.applyUserPortSelections(defaultPortAllocation, false);
        expect(connectionManager.isConnected).to.be.false;
        await GcUtils.delay(1);
        expect(connectionManager.isConnected).to.be.false;

        await UsbTransport.applyUserPortSelections(defaultPortAllocation, true);
        expect(connectionManager.isConnected).to.be.true;

        expect(usbA.selectedPort?.comName).to.be.equal(defaultPortB?.comName);
        expect(usbA.selectedBaudRate).to.be.equal(14400);
        expect(usbB.selectedPort?.comName).to.be.equal(defaultPortA?.comName);
        expect(usbB.selectedBaudRate).to.be.equal(115200);

        expect(testUsbService.listPortsCount).to.equal(2);
        expect(counterForAutoDetectCalls).to.equal(allUsbComPortNames.length);
    });

    it('partial re-reconnect after user chooses an optional serial port only', async function () {
        if (allUsbComPortNames.length < 3) {
            this.skip();
        }

        usbB.params.optional = true;
        testUsbService.listPortsCount = 0;
        counterForAutoDetectCalls = 0;

        const defaultPortAllocation = await UsbTransport.acquireAllPorts();
        expect(defaultPortAllocation.length).to.equal(2);
        expect(testUsbService.listPortsCount).to.equal(2);
        expect(counterForAutoDetectCalls).to.equal(allUsbComPortNames.length - 2);
        testUsbService.listPortsCount = 0;
        counterForAutoDetectCalls = 0;
        expect(defaultPortAllocation[0].availablePorts.length).to.equal(allUsbComPortNames.length);
        expect(defaultPortAllocation[1].availablePorts.length).to.equal(allUsbComPortNames.length);
        expect(defaultPortAllocation[0].transport.id).to.equal('usbA');
        expect(defaultPortAllocation[1].transport.id).to.equal('usbB');
        expect(defaultPortAllocation[0].port!.comName).to.equal(defaultPortB?.comName);
        expect(defaultPortAllocation[1].port!.comName).to.equal(defaultPortA?.comName);
        UsbTransport.applyUserPortSelections([{ port: defaultPortAllocation[1].availablePorts[allUsbComPortNames.length - 1], transport: usbB, baudRate: 4800 }], false);
        expect(connectionManager.isConnected).to.be.true;
        await GcUtils.delay(1);
        expect(connectionManager.isConnected).to.be.true;
        expect(usbB.canConnect).to.be.true;
        if (usbB.isDisconnecting) {
            await usbB.disconnect();
        }
        await GcUtils.delay(1);
        expect(usbB.isConnecting).to.be.true;
        expect(connectionManager.isPartiallyConnected).to.be.true;
        await usbB.connect();
        expect(connectionManager.isConnected).to.be.true;
        expect(connectionManager.isPartiallyConnected).to.be.false;
        expect(usbB.isConnected).to.be.true;

        expect(usbA.selectedPort?.comName).to.be.equal(defaultPortB?.comName);
        expect(usbA.selectedBaudRate).to.be.equal(14400);
        expect(usbB.selectedPort?.comName).to.not.equal(defaultPortA?.comName);
        expect(usbB.selectedPort?.comName).to.not.equal(defaultPortB?.comName);
        expect(usbB.selectedBaudRate).to.be.equal(4800);

        expect(testUsbService.listPortsCount).to.equal(2);
        expect(counterForAutoDetectCalls).to.equal(allUsbComPortNames.length - 1);
    });

    it('User selected port is preserved across instances', async () => {
        const port0 = usbA.userSelectedPortName;
        const port1 = usbB.userSelectedPortName;
        const baudRate0 = usbA.userSelectedBaudRate;
        const baudRate1 = usbB.userSelectedBaudRate;
        expect(port0).to.exist;
        expect(port1).to.exist;
        expect(baudRate0).to.exist;
        expect(baudRate1).to.exist;

        await usbA.disconnect();
        await usbB.disconnect();
        usbA.dispose();
        usbB.dispose();

        usbA = new UsbTransport({ id: 'usbA' });
        usbB = new UsbTransport({ id: 'usbB' });
        connectionManager.setActiveConfiguration('usbA, usbB');

        expect(usbA.userSelectedPortName).to.exist;
        expect(usbB.userSelectedPortName).to.exist;
        expect(usbA.userSelectedBaudRate).to.exist;
        expect(usbB.userSelectedBaudRate).to.exist;
        expect(usbA.userSelectedPortName).to.equal(port0);
        expect(usbB.userSelectedPortName).to.equal(port1);
        expect(usbA.userSelectedBaudRate).to.equal(baudRate0);
        expect(usbB.userSelectedBaudRate).to.equal(baudRate1);
    });

    it('clear user port selection', async () => {
        testUsbService.listPortsCount = 0;
        counterForAutoDetectCalls = 0;

        const defaultPortAllocation = await UsbTransport.acquireAllPorts();
        expect(defaultPortAllocation.length).to.equal(2);
        expect(testUsbService.listPortsCount).to.equal(2);
        expect(counterForAutoDetectCalls).to.equal(allUsbComPortNames.length);
        testUsbService.listPortsCount = 0;
        counterForAutoDetectCalls = 0;
        defaultPortAllocation[0].port = undefined;
        defaultPortAllocation[1].port = undefined;
        defaultPortAllocation[0].baudRate = undefined;
        defaultPortAllocation[1].baudRate = undefined;
        await UsbTransport.applyUserPortSelections(defaultPortAllocation, true);

        expect(connectionManager.isConnected).to.be.true;
        expect(usbA.isConnected).to.be.true;
        expect(usbB.isConnected).to.be.true;

        expect(usbA.selectedPort?.comName).to.not.equal(defaultPortB?.comName);
        expect(usbA.selectedBaudRate).to.be.equal(9600);
        expect(usbB.selectedPort?.comName).to.not.equal(defaultPortA?.comName);
        expect(usbB.selectedBaudRate).to.be.equal(9600);

        expect(testUsbService.listPortsCount).to.equal(2);
        expect(counterForAutoDetectCalls).to.equal(allUsbComPortNames.length);

        await usbA.disconnect();
        await usbB.disconnect();
    });

    after(() => {
        usbB.dispose();
        usbA.dispose();
        UsbTransport.pauseConnectingOnNewPortsFound = false;

        ServicesRegistry.unregister(usbServiceType, TestUsbService);
        AutoDetectPortIdentityRegistry.unRegisterPortIdentityHandler(autoDetectPortIdentityHandler);
    });
});