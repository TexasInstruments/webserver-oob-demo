import '../../gc-core-assets/lib/NodeJSEnv';
import { expect } from 'chai';
import { DelimitedTextCodec } from '../lib/DelimitedTextCodec';
import { AbstractDataDecoder, IDataEncoder, IDataDecoder, stringDataType, codecRegistry } from '../../gc-target-configuration/lib/TargetConfiguration';
import { Events } from '../../gc-core-assets/lib/Events';

describe('DelimitedTextCodec', () => {

    class TestDecoder extends AbstractDataDecoder<string, string> {
        readonly params = {};
        packets: string[] = [];
        decode(data: string): boolean | Error {
            this.packets.push(data);
            return true;
        }
        constructor() {
            super('testDecoder', stringDataType, stringDataType);
        }
        deconfigure() {
            super.deconfigure();
            this.packets = [];
        }
    }

    // TODO: replace this with TestEncoder extends AbstractDataEncoder() ...
    class TestEncoder extends Events implements IDataEncoder<string> {
        id = 'testEncoder';
        packets: string[] = [];
        constructor() {
            super();
            codecRegistry.register(this);
        }
        encode(data: string): void {
            this.packets.push(data);
        }
        encoderInputType = stringDataType;
        encoderOutputType = stringDataType;
        addChildDecoder(child: IDataDecoder<string>): void {
        }
        deconfigure(): void {
            this.packets = [];
        }
        dispose() {
            codecRegistry.unregister(this);
        }
    }

    let decoderStub: TestDecoder;
    let encoderStub: TestEncoder;

    before(function() {
        codecRegistry.dispose();   // clear the registery to avoid other tests clashing with this one.

        decoderStub = new TestDecoder();
        encoderStub = new TestEncoder();
    });

    it('encode', () => {
        let codec = new DelimitedTextCodec({});
        codecRegistry.configure('testEncoder+DelimitedTextCodec');
        codec.encode('');
        codec.encode('this is a ');
        codec.encode('test');
        codec.encode('\n');
        expect(encoderStub.packets.length).to.equal(4);
        expect(encoderStub.packets[0]).to.equal('\n');
        expect(encoderStub.packets[1]).to.equal('this is a \n');
        expect(encoderStub.packets[2]).to.equal('test\n');
        expect(encoderStub.packets[3]).to.equal('\n\n');

        codec = new DelimitedTextCodec({ id: 'codec', delimiter: '\n', escapeChar: '\\' });
        codecRegistry.configure('testEncoder+codec');
        codec.encode('\nthis is a \\test \n');
        expect(encoderStub.packets.length).to.equal(1);
        expect(encoderStub.packets[0]).to.equal('\\\nthis is a \\\\test \\\n\n');

        codec = new DelimitedTextCodec({ id: 'codec', delimiter: 'sequence', escapeChar: 'escape' });
        codecRegistry.configure('testEncoder+codec');
        codec.encode('this is a sequence that has an escape character');
        expect(encoderStub.packets.length).to.equal(1);
        expect(encoderStub.packets[0]).to.equal('this is a escapesequence that has an escapeescape charactersequence');
    });

    it('decode', () => {
        let codec = new DelimitedTextCodec({ id: 'cr' });
        codecRegistry.configure('cr+testDecoder');
        expect(codec.decode('')).to.be.false;
        expect(codec.decode('this is a ')).to.be.false;
        expect(codec.decode('test')).to.be.false;
        expect(codec.decode('\n')).to.be.true;
        expect(decoderStub.packets.length).to.equal(1);
        expect(decoderStub.packets[0]).to.equal('this is a test');

        codec = new DelimitedTextCodec({ id: 'codec', delimiter: '\n', escapeChar: '\\' });
        codecRegistry.configure('codec+testDecoder');
        codec.decode('\\\nthis is a \\\\test \\\n\nand another test\n');
        expect(decoderStub.packets.length).to.equal(2);
        expect(decoderStub.packets[0]).to.equal('\nthis is a \\test \n');
        expect(decoderStub.packets[1]).to.equal('and another test');

        codec = new DelimitedTextCodec({ id: 'codec', delimiter: 'sequence', escapeChar: 'escape' });
        codecRegistry.configure('testEncoder+codec+testDecoder');
        codec.decode('this is a escapesequence that has an escapeescape charactersequence');
        expect(decoderStub.packets.length).to.equal(1);
        expect(decoderStub.packets[0]).to.equal('this is a sequence that has an escape character');
    });
});