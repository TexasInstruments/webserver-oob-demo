import '../../gc-core-assets/lib/NodeJSEnv';
import { expect } from 'chai';
import { JsonCodec } from '../../gc-codec-json/lib/JsonCodec';
import { connectionManager, activeConfigurationChangedEvent } from '../lib/ConnectionManager';
import { codecRegistry, TRANSPORT_STATE, ITransport, connectionLogEventType, IConnectionLogEvent } from '../../gc-target-configuration/lib/TargetConfiguration';
import { IUsbService, IUsbDevice, usbServiceType, usbSerialPortType, IFilterOptionsForUsbPorts, IUsbPort, IDeviceOptions, IDevice, dataEventType, BaudRate, UsbPortType } from '../../gc-service-usb/lib/ServiceUsb';
import { Events } from '../../gc-core-assets/lib/Events';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { UsbTransport, IUsbTransportParams } from '../../gc-transport-usb/lib/UsbTransport';
import { StreamingDataModel, IStreamingModelParams } from '../../gc-model-streaming/lib/StreamingDataModel';
import { LogType } from '../../gc-core-assets/lib/GcConsole';
import { IProgramLoaderService, IProgramLoaderParams, IProgramLoaderConnectionParams, IProgressMonitor, programLoaderServiceType } from '../../gc-service-program-loader/lib/ProgramLoaderService';
import { TargetProgramLoader } from '../../gc-target-program-loader/lib/TargetProgramLoader';
import { bindingRegistry } from '../../gc-core-databind/lib/CoreDatabind';
import { ICodecBaseParams } from '../../gc-target-configuration/lib/ICodecBaseParams';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';

class UsbPort extends Events implements IUsbPort {
    type = usbSerialPortType;
    comName: string;
    isOpened = false;
    constructor(public name: string, public descriptor = '') {
        super();
        this.comName = name;
    }
    dataWritten?: string | Buffer | number[];
    async write(data: string | Buffer | number[]) {
        if (!this.isOpened) {
            throw Error(`Serial port ${this.comName} is not open`);
        }
        this.dataWritten = data;
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
    onDataReceived(data: string) {
        if (!this.isOpened) {
            throw Error(`Serial port ${this.comName} is not open`);
        }
        this.fireEvent(dataEventType, { data: Buffer.from(data) });
    }
}

const ports: UsbPort[] = [];

class UsbServiceStub extends Events implements IUsbService {
    async listPorts<T extends IUsbPort>(type: UsbPortType<T>, vendorId?: number): Promise<T[]> {
        return ports as unknown as T[];
    }
    async listDevices(vendorIds?: string): Promise<IUsbDevice[]> {
        throw Error('Method not implemented.');
    }
    async getDefaultPort(ports: IUsbPort[], deviceName?: string): Promise<{ port: IUsbPort; baudRate?: BaudRate }> {
        return { port: ports[0], baudRate: 9600 };
    }
    filterPortsByDescriptorInfo<T extends IUsbPort>(ports: T[], filterOptions: IFilterOptionsForUsbPorts) {
        return ports;
    }
}

interface IProgressLoggerInfo {
    index: number;
    messages: Array<[string, Omit<LogType, 'log'>]>;
}

class ProgramLoaderServiceStub extends Events implements IProgramLoaderService {
    loadProgram(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    loadSymbols(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    loadBin(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    async flash(params: IProgramLoaderParams & IProgramLoaderConnectionParams, monitor?: IProgressMonitor) {
        await GcUtils.delay(10);
        if (ProgramLoaderServiceStub.failLoadingForDeviceName === params.deviceName) {
            throw Error('Flash failed.');
        }
    }

    static failLoadingForDeviceName?: string;
}

class ProgressLogger {
    private logs = new Map<string, IProgressLoggerInfo>();
    assert(transport: string, message: string, type: LogType = 'info') {
        const info = this.logs.get(transport);
        expect(info, `There are no more logs for Transport id ="${transport}".`).to.exist;
        expect(info!.messages[info!.index + 1], `Transport id="${transport}" is missing the message="${message}".`).to.exist;
        info!.index++;
        const [logMessage, logType] = info!.messages[info!.index];
        expect(logMessage).to.equal(message);
        expect(logType).to.equal(type);
    }
    assertNone() {
        this.logs.forEach((element, key) => {
            expect(element.messages[element.index + 1], `Transport id="${key}" log is not empty.`).to.be.undefined;
        });
    }
    logEventHandler = (details: IConnectionLogEvent) => {
        if (details.type !== 'debug') {
            let info = this.logs.get(details.transportId);
            if (!info) {
                info = { index: -1, messages: [] };
                this.logs.set(details.transportId, info);
            }
            info.messages.push([details.message, details.type]);
        }
    };
}

class VerificationFailureCodec extends JsonCodec {
    async onConnect(transport: ITransport) {
        transport.addProgressMessage('Verifying target ...');
        throw Error('Verification failed.');
    }
}

describe('Connection Manager', () => {

    let progress: ProgressLogger;
    let usbTransport: UsbTransport;
    let usb2Transport: UsbTransport;
    let usb3Transport: UsbTransport;
    const verifyCodecParams: ICodecBaseParams = { id: 'verifier' };
    const streamingParams: IStreamingModelParams = { id: 'streaming' };
    const jsonCodecParams: ICodecBaseParams = { id: 'json' };
    const usbTransportParams: IUsbTransportParams = { id: 'usb', disableDeviceDetection: true };

    async function assertConnectRejectsWith(errMsg: string) {
        let throwMsg = '';
        await connectionManager.connect().catch((e) => throwMsg = e.message);
        expect(throwMsg).to.equal(errMsg);

        progress.assert('', errMsg, 'error');
        if (connectionManager.state === TRANSPORT_STATE.DISCONNECTING) {
            await connectionManager.disconnect();
        }
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assert('', 'Hardware not connected.');
    }

    before(() => {
        ServicesRegistry.register(usbServiceType, UsbServiceStub);
        ServicesRegistry.register(programLoaderServiceType, ProgramLoaderServiceStub);

        codecRegistry.dispose();   // clear the registry to avoid other tests clashing with this one.
        connectionManager.dispose();   // clear the registry to avoid other tests clashing with this one.
    });

    after(() => {
        ServicesRegistry.unregister(usbServiceType, UsbServiceStub);
        ServicesRegistry.unregister(programLoaderServiceType, ProgramLoaderServiceStub);
    });

    beforeEach(() => {
        progress = new ProgressLogger();
        connectionManager.addEventListener(connectionLogEventType, progress.logEventHandler);
    });

    afterEach(() => {
        connectionManager.removeEventListener(connectionLogEventType, progress.logEventHandler);
    });

    it('whenConfigurationReady', async () => {
        let isReady = false;
        connectionManager.whenConfigurationReady('config').then(() => {
            isReady = true;
        });

        expect(isReady).to.be.false;
        new JsonCodec({ id: 'a' });
        new JsonCodec({ id: 'b' });
        connectionManager.registerConfiguration('config', 'a+b+c');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(isReady).to.be.false;
        new JsonCodec({ id: 'c' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(isReady).to.be.true;
    });

    it('connect with empty configuration', async () => {
        connectionManager.unregisterConfiguration('config');
        await assertConnectRejectsWith('Failed to connect: There is no active configuration to connect with.');
        progress.assertNone();
    });

    it('connect with no transports', async () => {
        new JsonCodec(jsonCodecParams);
        new StreamingDataModel(streamingParams);
        connectionManager.setActiveConfiguration(' json\t+\nstreaming ');
        await assertConnectRejectsWith('Failed to connect: There are no active transports to connect with.');
        progress.assertNone();
    });

    it('connect with no usb ports', async () => {
        usbTransport = new UsbTransport(usbTransportParams);
        connectionManager.registerConfiguration('usb_streaming', 'usb+json+streaming');
        connectionManager.setActiveConfiguration('usb_streaming');
        await assertConnectRejectsWith('One or more transports failed to connect without error.');

        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Failed to connect: No port found.  Please plug your target device into your computer\'s USB port, and click the connect icon on the left.', 'error');
        progress.assert('usb', 'Hardware not connected.');
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assertNone();
    });

    it('cancel connect', async () => {

        ports.push(new UsbPort('COM4'));

        let throwMsg = '';
        connectionManager.connect().catch((e) => throwMsg = e.message);
        expect(connectionManager.canConnect).to.be.true;
        await GcUtils.delay(1);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.CONNECTING);
        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Connecting to COM4:9600 ...');
        progress.assert('usb', 'Waiting for data ...');

        await connectionManager.disconnect();
        expect(throwMsg).to.equal('Connecting to target was aborted by the user.');
        progress.assert('usb', 'Hardware not connected.');
        progress.assert('', 'Connecting to target was aborted by the user.');
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();
    });

    it('connect single optional model', async () => {

        // single optional transport needs to be treated like a single required transport.
        streamingParams.optional = true;
        expect(codecRegistry.isOptional('usb')).to.be.true;

        let throwMsg = '';
        const promise = connectionManager.connect().catch((e) => throwMsg = e.message);
        expect(connectionManager.canConnect).to.be.true;
        await GcUtils.delay(1);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.CONNECTING);
        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Connecting to COM4:9600 ...');
        progress.assert('usb', 'Waiting for data ...');

        expect(connectionManager.state).to.equal(TRANSPORT_STATE.CONNECTING);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.CONNECTING);

        ports[0].onDataReceived(' { "bad": syntax } \n'); // first bad packet is ignored?
        ports[0].onDataReceived(' { "bad": syntax } \n');

        await promise;
        expect(throwMsg).to.equal('One or more transports failed to connect without error.');
        if (connectionManager.state === TRANSPORT_STATE.DISCONNECTING) {
            await connectionManager.disconnect();
        }
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(connectionManager.isPartiallyConnected).to.be.false;

        progress.assert('usb', 'Received bad JSON data string: { "bad": syntax }.', 'error');
        progress.assert('usb', 'Hardware not connected.');
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();
    });

    it('connect with incorrect configuration', async () => {
        usb2Transport = new UsbTransport({ id: 'usb2', disableDeviceDetection: true });
        new JsonCodec({ id: 'json2' });

        expect(() => connectionManager.setActiveConfiguration('usb+json+streaming,usb2+json2+streaming')).to.throw('Invalid configuration specified: Model id="streaming" is used twice in "usb+json+streaming,usb2+json2+streaming".');
        progress.assertNone();
    });

    it('connect with insufficient com ports', async () => {
        streamingParams.optional = false;
        new StreamingDataModel({ id: 'streaming2' });

        connectionManager.setActiveConfiguration('usb+json+streaming,usb2+json2+streaming2');
        await assertConnectRejectsWith('One or more transports failed to connect without error.');

        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Connecting to COM4:9600 ...');
        progress.assert('usb', 'Waiting for data ...');
        progress.assert('usb2', 'Connecting to target ...');
        progress.assert('usb2', 'Failed to connect: No port found.  Please plug your target device into your computer\'s USB port, and click the connect icon on the left.', 'error');
        progress.assert('usb2', 'Hardware not connected.');
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usb2Transport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assert('usb', 'Hardware not connected.');
        progress.assertNone();
    });

    it('connect with optional transport without a port', async () => {
        streamingParams.optional = true;

        const promise = connectionManager.connect();
        expect(connectionManager.canConnect).to.be.true;
        await GcUtils.delay(1);
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.CONNECTING);

        progress.assert('usb2', 'Connecting to target ...');
        progress.assert('usb2', 'Connecting to COM4:9600 ...');
        progress.assert('usb2', 'Waiting for data ...');
        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Failed to connect: No port found.  Please plug your target device into your computer\'s USB port, and click the connect icon on the left.', 'error');
        progress.assert('usb', 'Hardware not connected.');
        progress.assertNone();

        ports[0].onDataReceived(' { "good": 45 } \n');

        await promise;
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.CONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usb2Transport.state).to.equal(TRANSPORT_STATE.CONNECTED);
        expect(connectionManager.isPartiallyConnected).to.be.true;

        progress.assert('usb2', 'Hardware connected.');
        progress.assert('', 'Hardware partially connected.');

        await connectionManager.disconnect();

        expect(connectionManager.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usb2Transport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assert('usb2', 'Hardware not connected.');
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();
    });

    it('connect when codec fails verification', async () => {
        ports.push(new UsbPort('COM5'));
        new VerificationFailureCodec(verifyCodecParams);

        connectionManager.setActiveConfiguration('usb+json+streaming,usb2+verifier+streaming2');
        await assertConnectRejectsWith('One or more transports failed to connect without error.');

        progress.assert('usb2', 'Connecting to target ...');
        progress.assert('usb2', 'Connecting to COM4:9600 ...');
        progress.assert('usb2', 'Verifying target ...');
        progress.assert('usb2', 'Failed to connect: Verification failed.', 'error');
        progress.assert('usb2', 'Hardware not connected.');

        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Connecting to COM5:9600 ...');
        progress.assert('usb', 'Waiting for data ...');
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usb2Transport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assert('usb', 'Hardware not connected.');
        progress.assertNone();
    });

    it('connect when program loading fails', async () => {
        streamingParams.optional = false;
        streamingParams.deviceId = 'MSP432';

        new TargetProgramLoader({ deviceId: 'MSP432', deviceName: 'MSP432P401R', autoProgram: true });
        ProgramLoaderServiceStub.failLoadingForDeviceName = 'MSP432P401R';

        let throwMsg = '';
        await connectionManager.connect().catch((e) => throwMsg = e.message);
        expect(throwMsg).to.equal('One or more required programs failed to load without error.');

        progress.assert('', 'Loading program for MSP432 device ...');
        progress.assert('usb', 'Loading program for MSP432 device failed: Flash failed.', 'error');
        progress.assert('', 'One or more required programs failed to load without error.', 'error');

        if (connectionManager.state === TRANSPORT_STATE.DISCONNECTING) {
            await connectionManager.disconnect();
        }
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usb2Transport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();
    });

    const CC3235ProgramLoaderParams = { deviceId: 'CC3235', deviceName: 'CC3235', autoProgram: true, optional: true, coreName: 'mcu' };

    it('connect when optional program loading fails', async () => {
        streamingParams.optional = false;
        streamingParams.deviceId = 'CC3235';

        new TargetProgramLoader(CC3235ProgramLoaderParams);
        ProgramLoaderServiceStub.failLoadingForDeviceName = 'CC3235';

        connectionManager.setActiveConfiguration('usb+json+streaming');
        const promise = connectionManager.connect();
        await GcUtils.delay(20);

        progress.assert('', 'Loading program for CC3235 device core="mcu" ...');
        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Connecting to COM4:9600 ...');
        progress.assert('usb', 'Waiting for data ...');

        ports[0].onDataReceived(' { "good": 95 } \n');
        expect(bindingRegistry.getBinding('streaming.good')!.getValue()).to.equal(95);

        await promise;
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.CONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.CONNECTED);
        expect(usb2Transport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(connectionManager.isPartiallyConnected).to.be.false;
        progress.assert('', 'Loading program for CC3235 device core="mcu" failed: Flash failed.', 'warning');
        progress.assert('usb', 'Hardware connected.');
        progress.assert('', 'Hardware connected.');

        await connectionManager.disconnect();
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usb2Transport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assert('usb', 'Hardware not connected.');
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();
    });

    it('connect with one of two program loaders failing', async () => {
        usbTransportParams.deviceId = 'MSP432';

        const loader = new TargetProgramLoader({ deviceName: 'TMP117', connectionName: 'USB2ANY' });
        ProgramLoaderServiceStub.failLoadingForDeviceName = 'CC3235';

        connectionManager.setActiveConfiguration('usb+json+streaming');
        const promise = connectionManager.connect();
        await GcUtils.delay(20);

        progress.assert('', 'Loading program for MSP432 device ...');
        progress.assert('', 'Loading program for MSP432 device succeeded.');
        await GcUtils.delay(20);
        progress.assert('', 'Loading program for CC3235 device core="mcu" ...');
        progress.assert('', 'Loading program for CC3235 device core="mcu" failed: Flash failed.', 'warning');

        await GcUtils.delay(20);
        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Connecting to COM4:9600 ...');
        progress.assert('usb', 'Waiting for data ...');

        ports[0].onDataReceived(' { "good": 32 } \n');
        expect(bindingRegistry.getBinding('streaming.good')!.getValue()).to.equal(32);

        await promise;
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.CONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.CONNECTED);
        expect(usb2Transport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(connectionManager.isPartiallyConnected).to.be.false;
        progress.assert('usb', 'Hardware connected.');
        progress.assert('', 'Hardware connected.');

        await connectionManager.disconnect();
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assert('usb', 'Hardware not connected.');
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();

        loader.dispose();
    });

    it('connect when required program loader fails', async () => {
        new TargetProgramLoader({ deviceId: 'MSP432P401R', deviceName: 'MSP432P401R', autoProgram: true });

        usbTransportParams.deviceId = 'MSP432P401R';
        streamingParams.deviceId = 'MSP432';
        ProgramLoaderServiceStub.failLoadingForDeviceName = 'MSP432P401R';

        let throwMsg = '';
        await connectionManager.connect().catch((e) => throwMsg = e.message);
        expect(throwMsg).to.equal('One or more required programs failed to load without error.');
        progress.assert('', 'Loading program for MSP432P401R device ...');
        progress.assert('usb', 'Loading program for MSP432P401R device failed: Flash failed.', 'error');
        progress.assert('', 'One or more required programs failed to load without error.', 'error');

        expect(connectionManager.isConnected).to.be.false;
        if (connectionManager.state === TRANSPORT_STATE.DISCONNECTING) {
            await connectionManager.disconnect();
        }
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();
    });

    it('connect when required anonymous optional program loader fails', async () => {

        const loader = new TargetProgramLoader({ deviceName: 'TMP117', connectionName: 'USB2ANY', autoProgram: true, optional: true });
        usbTransportParams.deviceId = undefined;
        streamingParams.deviceId = undefined;
        ProgramLoaderServiceStub.failLoadingForDeviceName = 'TMP117';

        const promise = connectionManager.connect();
        await GcUtils.delay(20);
        progress.assert('', 'Loading program for TMP117 device ...');
        progress.assert('', 'Loading program for TMP117 device failed: Flash failed.', 'warning');
        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Connecting to COM4:9600 ...');
        progress.assert('usb', 'Waiting for data ...');

        ports[0].onDataReceived(' { "good":-102 } \n');
        expect(bindingRegistry.getBinding('streaming.good')!.getValue()).to.equal(-102);

        await promise;
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.CONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.CONNECTED);
        expect(connectionManager.isPartiallyConnected).to.be.false;
        progress.assert('usb', 'Hardware connected.');
        progress.assert('', 'Hardware connected.');

        await connectionManager.disconnect();
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assert('usb', 'Hardware not connected.');
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();

        loader.dispose();
    });

    it('connect when optional model program loader fails', async () => {

        usbTransportParams.deviceId = undefined;
        streamingParams.deviceId = 'CC3235';
        streamingParams.optional = true;
        CC3235ProgramLoaderParams.optional = false;
        CC3235ProgramLoaderParams.coreName = '';
        ProgramLoaderServiceStub.failLoadingForDeviceName = 'CC3235';

        await connectionManager.connect();
        progress.assert('', 'Loading program for CC3235 device ...');
        progress.assert('', 'Loading program for CC3235 device failed: Flash failed.', 'warning');
        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Connecting to COM4:9600 ...');

        expect(connectionManager.state).to.equal(TRANSPORT_STATE.CONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.CONNECTED);
        expect(connectionManager.isPartiallyConnected).to.be.true;
        expect(usbTransport.isPartiallyConnected).to.be.true;
        progress.assert('usb', 'Hardware partially connected.');
        progress.assert('', 'Hardware partially connected.');

        await connectionManager.disconnect();
        expect(connectionManager.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assert('usb', 'Hardware not connected.');
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();
    });

    it('connect when all optional codecs fails', async () => {

        verifyCodecParams.optional = true;
        streamingParams.optional = false;
        jsonCodecParams.optional = true;
        connectionManager.setActiveConfiguration(' usb  (json+streaming,verifier ) ');

        let throwMsg = '';
        await connectionManager.connect().catch((e) => throwMsg = e.message);
        expect(throwMsg).to.equal('One or more transports failed to connect without error.');
        progress.assert('', 'Loading program for CC3235 device ...');
        progress.assert('', 'Loading program for CC3235 device failed: Flash failed.', 'warning');
        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Connecting to COM4:9600 ...');
        progress.assert('usb', 'Verifying target ...');

        progress.assert('usb', 'One or more codecs failed to connect without error.', 'error');

        expect(connectionManager.isConnecting).to.be.false;
        expect(codecRegistry.isActive(usbTransport.id)).to.be.true;
        if (connectionManager.isDisconnecting) {
            await connectionManager.disconnect();
        }

        expect(connectionManager.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        expect(usbTransport.state).to.equal(TRANSPORT_STATE.DISCONNECTED);
        progress.assert('usb', 'Hardware not connected.');
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();
    });

    it('connect individual transports', async () => {

        usb3Transport = new UsbTransport({ id: 'usb3', deviceId: 'MP430', optional: true, defaultBaudRate: 4800, disableDeviceDetection: true });
        connectionManager.setActiveConfiguration('usb,usb2,usb3');

        expect(connectionManager.isDisconnected).to.be.true;
        await usbTransport.connect();
        expect(connectionManager.isDisconnected).to.be.true;
        expect(usbTransport.isConnected).to.be.true;
        expect(usb2Transport.isDisconnected).to.be.true;
        expect(usb3Transport.isDisconnected).to.be.true;
        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Connecting to COM4:9600 ...');
        progress.assert('usb', 'Hardware connected.');
        progress.assertNone();

        await usb2Transport.connect();
        expect(connectionManager.isConnected).to.be.true;
        expect(usbTransport.isConnected).to.be.true;
        expect(usb2Transport.isConnected).to.be.true;
        expect(usb3Transport.isDisconnected).to.be.true;
        progress.assert('usb2', 'Connecting to target ...');
        progress.assert('usb2', 'Connecting to COM5:9600 ...');
        progress.assert('usb2', 'Hardware connected.');
        progress.assert('', 'Hardware partially connected.');
        progress.assertNone();

        ports.push(new UsbPort('COM7'));
        await usb3Transport.connect();
        expect(connectionManager.isConnected).to.be.true;
        expect(usbTransport.isConnected).to.be.true;
        expect(usb2Transport.isConnected).to.be.true;
        expect(usb3Transport.isConnected).to.be.true;
        progress.assert('usb3', 'Connecting to target ...');
        progress.assert('usb3', 'Connecting to COM7:4800 ...');
        progress.assert('usb3', 'Hardware connected.');
        progress.assert('', 'Hardware connected.');
        progress.assertNone();
    });

    it('disconnect individual transports', async () => {

        expect(connectionManager.isConnected).to.be.true;
        await usb3Transport.disconnect();
        expect(connectionManager.isConnected).to.be.true;
        expect(usbTransport.isConnected).to.be.true;
        expect(usb2Transport.isConnected).to.be.true;
        expect(usb3Transport.isDisconnected).to.be.true;
        progress.assert('usb3', 'Hardware not connected.');
        progress.assert('', 'Hardware partially connected.');
        progress.assertNone();

        await usb2Transport.disconnect();
        expect(connectionManager.isDisconnected).to.be.true;
        expect(usbTransport.isConnected).to.be.true;
        expect(usb2Transport.isDisconnected).to.be.true;
        expect(usb3Transport.isDisconnected).to.be.true;
        progress.assert('usb2', 'Hardware not connected.');
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();

        await usbTransport.disconnect();
        expect(connectionManager.isDisconnected).to.be.true;
        expect(usbTransport.isDisconnected).to.be.true;
        expect(usb2Transport.isDisconnected).to.be.true;
        expect(usb3Transport.isDisconnected).to.be.true;
        progress.assert('usb', 'Hardware not connected.');
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();
    });

    it('unregister transport', async () => {

        usbTransportParams.optional = true;
        connectionManager.unregisterTransport(usb2Transport);
        await connectionManager.connect();
        expect(connectionManager.isConnected).to.be.true;
        expect(usbTransport.isConnected).to.be.true;
        expect(usb2Transport.isDisconnected).to.be.true;
        expect(usb3Transport.isConnected).to.be.true;
        progress.assert('usb', 'Connecting to target ...');
        progress.assert('usb', 'Connecting to COM4:9600 ...');
        progress.assert('usb', 'Hardware connected.');
        progress.assert('usb3', 'Connecting to target ...');
        progress.assert('usb3', 'Connecting to COM7:4800 ...');
        progress.assert('usb3', 'Hardware connected.');
        progress.assert('', 'Hardware connected.');
        progress.assertNone();

        let newConfigurationReady = false;
        const listener = () => {
            newConfigurationReady = true;
        };
        connectionManager.addEventListener(activeConfigurationChangedEvent, listener);
        connectionManager.setActiveConfiguration('usb+json');
        expect(newConfigurationReady).to.be.false;
        expect(codecRegistry.isActive('json')).to.be.false;

        await usb3Transport.disconnect();
        await usbTransport.disconnect();
        progress.assert('usb', 'Hardware not connected.');
        progress.assert('', 'Hardware partially connected.');
        progress.assert('usb3', 'Hardware not connected.');
        progress.assert('', 'Hardware not connected.');
        progress.assertNone();
        expect(newConfigurationReady).to.be.true;
        expect(codecRegistry.isActive('json')).to.be.true;

        connectionManager.removeEventListener(activeConfigurationChangedEvent, listener);
    });

    it('setActiveConfiguration', async () => {
        let callbackCount = 0;
        const listener = () => {
            callbackCount++;
        };
        connectionManager.addEventListener(activeConfigurationChangedEvent, listener);

        let msg = 'Invalid configuration specified: Missing <gc-target-configuration id="custom">.  This must exist somewhere in your index.gui.';
        expect(() => connectionManager.setActiveConfiguration('custom')).to.throw(msg);
        await assertConnectRejectsWith(msg);

        msg = 'Invalid configuration specified: Missing a model, transport, or codec with id="custom" in "usb+custom".';
        expect(() => connectionManager.setActiveConfiguration('usb+custom')).to.throw(msg);
        await assertConnectRejectsWith(msg);

        expect(codecRegistry.isActive('usb')).to.be.false;
        expect(callbackCount).to.equal(1);

        connectionManager.addEventListener(activeConfigurationChangedEvent, listener);
    });

    after(function() {
        if (usbTransport) {
            usbTransport.dispose();
        }
        if (usb2Transport) {
            usb2Transport.dispose();
        }
        if (usb3Transport) {
            usb3Transport.dispose();
        }

        bindingRegistry.dispose();

        codecRegistry.dispose();   // clear the registry to avoid other tests clashing with this one.
        connectionManager.dispose();   // clear the registry to avoid other tests clashing with this one.
    });
});