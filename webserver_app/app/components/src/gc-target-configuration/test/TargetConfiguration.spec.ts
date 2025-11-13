import '../../gc-core-assets/lib/NodeJSEnv';
import { expect } from 'chai';
import { JsonCodec } from '../../gc-codec-json/lib/JsonCodec';
import { DelimitedTextCodec } from '../../gc-codec-delimited-text/lib/DelimitedTextCodec';
import { Base64PacketCodec } from '../../gc-codec-base64/lib/Base64PacketCodec';
import { UsbTransport } from '../../gc-transport-usb/lib/UsbTransport';
import { StreamingDataModel } from '../../gc-model-streaming/lib/StreamingDataModel';
import { IBindFactory } from '../../gc-core-databind/lib/CoreDatabind';
import { codecRegistry, AbstractDataCodec, PrimitiveDataType } from '../lib/TargetConfiguration';

const numberDataType = new PrimitiveDataType<number>('number');

interface CodecStubParams {
    id: string;
    optional?: boolean;
    deviceId?: string;
}

class CodecStub extends AbstractDataCodec<number, number, number, number> {
    public configured = false;
    public connected = false;
    public disconnected = false;
    public pinged = false;

    constructor(readonly params: CodecStubParams) {
        super(params.id, numberDataType, numberDataType, numberDataType, numberDataType);
    }

    encode(data: number): void {
        this.targetEncoder.encode(data);

    }
    decode(data: number): boolean | Error {
        return this.targetDecoder.decode(data);
    }

    get optional() {
        return this.params.optional;
    }

    get deviceId() {
        return this.params.deviceId;
    }

    deconfigure() {
        super.deconfigure();
        this.configured = false;
        this.connected = false;
        this.disconnected = false;
        this.pinged = false;
    }
}

describe('TargetConfiguration', () => {

    let jsonCodec: JsonCodec;
    let cr: DelimitedTextCodec;
    let usbTransport: UsbTransport;
    let model: IBindFactory;
    let base64: Base64PacketCodec;
    let A: CodecStub;
    let B: CodecStub;
    let C: CodecStub;
    let D: CodecStub;
    let E: CodecStub;
    let F: CodecStub;
    let G: CodecStub;

    before(() => {
        codecRegistry.dispose();   // clear the registery to avoid other tests clashing with this one.

        jsonCodec = new JsonCodec({});
        cr = new DelimitedTextCodec({ id: 'cr', delimiter: '\n' });
        usbTransport = new (class extends UsbTransport {
            assertStillConnecting() {
                // make sure we don't abort codec's because our fake transport is not still connecting.
            }
        })({});
        model = new StreamingDataModel({});
        base64 = new Base64PacketCodec({});

        A = new (class extends CodecStub {
            public configured = false;
            constructor() {
                super({ id: 'A', optional: true });
            }
            configure() {
                this.configured = true;
            }
        })();

        B = new (class extends CodecStub {
            public configured = false;
            constructor() {
                super({ id: 'B', deviceId: 'B' });
            }
            onConnect(): Promise<void> {
                this.connected = true;
                return Promise.resolve();
            }
            onDisconnect(): Promise<void> {
                this.disconnected = true;
                return Promise.resolve();
            }
        })();

        C = new (class extends CodecStub {
            public configured = false;
            constructor() {
                super({ id: 'C' });
            }
            onConnect(): Promise<void> {
                this.connected = true;
                return Promise.reject('Codec "C" failed to connect');
            }
            onDisconnect(): Promise<void> {
                this.disconnected = true;
                return Promise.resolve();
            }
        })();
        D = new (class extends CodecStub {
            public configured = false;
            constructor() {
                super({ id: 'D', optional: true, deviceId: 'DE' });
            }
            ping() {
                this.pinged = true;
                return Promise.resolve(this.pinged);
            }
        })();
        E = new (class extends CodecStub {
            public configured = false;
            constructor() {
                super({ id: 'E', deviceId: 'DE' });
            }
            onConnect(): Promise<void> {
                this.connected = true;
                return Promise.reject('Codec "E" failed to connect');
            }
            onDisconnect(): Promise<void> {
                this.disconnected = true;
                return Promise.resolve();
            }
        })();

        F = new (class extends CodecStub {
            public configured = false;
            constructor() {
                super({ id: 'F', optional: true, deviceId: 'F' });
            }
            onConnect(): Promise<void> {
                this.connected = true;
                return Promise.reject('Code "F" failed to connect');
            }
            ping() {
                this.pinged = true;
                return Promise.resolve(this.pinged);
            }
        })();
        G = new (class extends CodecStub {
            public configured = false;
            constructor() {
                super({ id: 'G', optional: false, deviceId: '' });
            }
            configure() {
                this.configured = true;
            }
            onConnect(): Promise<void> {
                this.connected = true;
                return Promise.resolve();
            }
            onDisconnect(): Promise<void> {
                this.disconnected = true;
                return Promise.resolve();
            }
        })();

    });

    it('getInstance', () => {
        expect(codecRegistry.getInstance('json')).to.equal(jsonCodec);
        expect(codecRegistry.getInstance('cr')).to.equal(cr);
        expect(codecRegistry.getInstance('usb')).to.equal(usbTransport);
        expect(codecRegistry.getInstance('uart')).to.equal(model);
        expect(codecRegistry.getInstance('base64')).to.equal(base64);
    });

    it('configure', () => {
        expect(() => {
            codecRegistry.configure('usb+cr+json+uart');
        }).to.not.throw();
        expect(codecRegistry.isActive('json')).to.be.true;
        expect(codecRegistry.isActive('cr')).to.be.true;
        expect(codecRegistry.isActive('usb')).to.be.true;
        expect(codecRegistry.isActive('uart')).to.be.true;
        expect(codecRegistry.isActive('base64')).to.be.false;
    });

    it('Codec used twice error', () => {
        expect(() => {
            codecRegistry.configure('usb+cr(json+uart,uart)');
        }).to.throw('Invalid configuration specified: Model id="uart" is used twice in "usb+cr(json+uart,uart)".');
    });

    it('Bad Codec Name', () => {
        expect(() => {
            new DelimitedTextCodec({ id: 'cr+', delimiter: '\n' });
        }).to.throw('Bad identifier "cr+".  Identifiers for Codecs, models, and transports must only contain numbers, letters, underscore, period, or $ characters');
    });

    it('reconfigure', () => {
        expect(() => {
            codecRegistry.configure('cr+json');
        }).to.not.throw();
        expect(codecRegistry.isActive('json')).to.be.true;
        expect(codecRegistry.isActive('cr')).to.be.true;
        expect(codecRegistry.isActive('usb')).to.be.false;
        expect(codecRegistry.isActive('uart')).to.be.false;
        expect(codecRegistry.isActive('base64')).to.be.false;
    });

    it('whenConfigurationReady', async () => {
        let isReady = false;
        codecRegistry.whenConfigurationReady(' cr  ( blob , usb ,test ) ').then(() => {
            isReady = true;
        });
        expect(isReady).to.be.false;
        new JsonCodec({ id: 'bloB' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(isReady).to.be.false;
        new JsonCodec({ id: 'TEST' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(isReady).to.be.true;

        isReady = false;
        codecRegistry.whenConfigurationReady(' cr  ( blob , usb ,test ) ').then(() => {
            isReady = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(isReady).to.be.true;
    });

    it('isOptional', () => {
        codecRegistry.configure('A,B(D,F),G');

        expect(codecRegistry.isOptional('A')).to.be.true;
        expect(codecRegistry.isOptional('B')).to.be.true;
        expect(codecRegistry.isOptional('C')).to.be.false;
        expect(codecRegistry.isOptional('D')).to.be.true;
        expect(codecRegistry.isOptional('E')).to.be.false;
        expect(codecRegistry.isOptional('F')).to.be.true;
        expect(codecRegistry.isOptional('G')).to.be.false;

        codecRegistry.configure('A,B(D,F,E),G');
        expect(codecRegistry.isOptional('B')).to.be.false;
    });

    it('isDeviceRequired', () => {
        expect(codecRegistry.isDeviceRequired('A', 'B', true)).to.equal('no');
        expect(codecRegistry.isDeviceRequired('B', 'B', true)).to.equal('yes');
        expect(codecRegistry.isDeviceRequired('C', 'B', true)).to.equal('no');
        expect(codecRegistry.isDeviceRequired('D', 'B', true)).to.equal('no');
        expect(codecRegistry.isDeviceRequired('E', 'B', true)).to.equal('no');
        expect(codecRegistry.isDeviceRequired('F', 'B', true)).to.equal('no');
        expect(codecRegistry.isDeviceRequired('G', 'B', true)).to.equal('no');

        expect(codecRegistry.isDeviceRequired('A', 'F', true)).to.equal('no');
        expect(codecRegistry.isDeviceRequired('B', 'F', true)).to.equal('maybe');
        expect(codecRegistry.isDeviceRequired('C', 'F', true)).to.equal('no');
        expect(codecRegistry.isDeviceRequired('D', 'F', true)).to.equal('no');
        expect(codecRegistry.isDeviceRequired('E', 'F', true)).to.equal('no');
        expect(codecRegistry.isDeviceRequired('F', 'F', true)).to.equal('maybe');
        expect(codecRegistry.isDeviceRequired('G', 'F', true)).to.equal('no');

        expect(codecRegistry.isDeviceRequired('A', 'DE', true)).to.equal('no');
        expect(codecRegistry.isDeviceRequired('B', 'DE', true)).to.equal('yes');
        expect(codecRegistry.isDeviceRequired('C', 'DE', true)).to.equal('no');
        expect(codecRegistry.isDeviceRequired('D', 'DE', true)).to.equal('maybe');
        expect(codecRegistry.isDeviceRequired('E', 'DE', true)).to.equal('yes');
        expect(codecRegistry.isDeviceRequired('F', 'DE', true)).to.equal('no');
        expect(codecRegistry.isDeviceRequired('G', 'DE', true)).to.equal('no');
    });

    it('connectTransport', async () => {
        codecRegistry.configure('A,B(D,F),G');

        await codecRegistry.connect('A', usbTransport);
        expect(B.connected).to.be.false;
        expect(C.connected).to.be.false;
        expect(E.connected).to.be.false;
        expect(F.connected).to.be.false;
        expect(G.connected).to.be.false;

        await codecRegistry.connect('B', usbTransport);
        expect(B.connected).to.be.true;
        expect(C.connected).to.be.false;
        expect(E.connected).to.be.false;
        expect(F.connected).to.be.true;
        expect(G.connected).to.be.false;

        await codecRegistry.connect('G', usbTransport);
        expect(B.connected).to.be.true;
        expect(C.connected).to.be.false;
        expect(E.connected).to.be.false;
        expect(F.connected).to.be.true;
        expect(G.connected).to.be.true;
    });

    it('isConnected', () => {
        expect(codecRegistry.isConnected('A')).to.be.true;
        expect(codecRegistry.isConnected('B')).to.be.true;
        expect(codecRegistry.isConnected('C')).to.be.false;
        expect(codecRegistry.isConnected('D')).to.be.true;
        expect(codecRegistry.isConnected('E')).to.be.false;
        expect(codecRegistry.isConnected('F')).to.be.false;
        expect(codecRegistry.isConnected('G')).to.be.true;
    });

    it('ping', async () => {
        await codecRegistry.ping('A');
        expect(D.pinged).to.be.false;
        expect(F.pinged).to.be.false;

        await codecRegistry.ping('B');
        expect(D.pinged).to.be.true;
        expect(F.pinged).to.be.false;

        await codecRegistry.ping('G');
        expect(D.pinged).to.be.true;
        expect(F.pinged).to.be.false;
    });

    it('disconnectTransport', async () => {
        await codecRegistry.disconnect('A', usbTransport);
        expect(B.disconnected).to.be.false;
        expect(C.disconnected).to.be.false;
        expect(E.disconnected).to.be.false;
        expect(G.disconnected).to.be.false;

        await codecRegistry.disconnect('B', usbTransport);
        expect(B.disconnected).to.be.true;
        expect(C.disconnected).to.be.false;
        expect(E.disconnected).to.be.false;
        expect(G.disconnected).to.be.false;

        await codecRegistry.disconnect('G', usbTransport);
        expect(B.disconnected).to.be.true;
        expect(C.disconnected).to.be.false;
        expect(E.disconnected).to.be.false;
        expect(G.disconnected).to.be.true;
    });

    it('failed direct connect', async () => {
        codecRegistry.configure('C');

        try {
            await codecRegistry.connect('C', usbTransport);
            throw 'Connection should have failed.';
        } catch (e) {
            expect(e.toString()).to.equal('Codec "C" failed to connect');
        }

        expect(B.connected).to.be.false;
        expect(C.connected).to.be.true;
        expect(E.connected).to.be.false;
        expect(F.connected).to.be.false;
        expect(G.connected).to.be.false;

        expect(codecRegistry.isConnected('C')).to.be.false;

        await codecRegistry.disconnect('C', usbTransport);
        expect(B.disconnected).to.be.false;
        expect(C.disconnected).to.be.false;
        expect(E.disconnected).to.be.false;
        expect(G.disconnected).to.be.false;
    });

    it('failed indirect connect', async () => {
        codecRegistry.configure('A,B(D,F,E),G');

        try {
            await codecRegistry.connect('B', usbTransport);
            throw 'Connection should have failed.';
        } catch (e) {
            expect(e.toString()).to.equal('Codec "E" failed to connect');
        }

        expect(B.connected).to.be.true;
        expect(E.connected).to.be.true;
        expect(F.connected).to.be.true;
        expect(G.connected).to.be.false;

        expect(codecRegistry.isConnected('B')).to.be.true;
        expect(codecRegistry.isConnected('D')).to.be.true;
        expect(codecRegistry.isConnected('E')).to.be.false;
        expect(codecRegistry.isConnected('F')).to.be.false;

        await codecRegistry.disconnect('B', usbTransport);
        expect(B.disconnected).to.be.true;
        expect(C.disconnected).to.be.false;
        expect(E.disconnected).to.be.false;
        expect(G.disconnected).to.be.false;

        expect(codecRegistry.isConnected('B')).to.be.false;
        expect(codecRegistry.isConnected('D')).to.be.false;
        expect(codecRegistry.isConnected('E')).to.be.false;
        expect(codecRegistry.isConnected('F')).to.be.false;

    });

    after(() => {
        usbTransport.dispose();
        codecRegistry.dispose();   // clear the registery to avoid other tests clashing with this one.
    });

});