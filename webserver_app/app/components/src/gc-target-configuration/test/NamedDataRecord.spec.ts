import '../../gc-core-assets/lib/NodeJSEnv';
import { expect } from 'chai';
import { NamedDataRecord, NamedRecordFieldDescriptor, Uint8, Uint16, Uint32, Int8, Int16, Int32, Utf8cString, Union } from '../lib/NamedDataRecord';

describe('NamedDataRecord', () => {

    interface ISignedNumbers {
        byte: number;
        int: number;
        long: number;
    };

    class SignedDataRecord extends NamedDataRecord<ISignedNumbers> {
        static fieldDescriptors: NamedRecordFieldDescriptor<ISignedNumbers>[] = [
            ['byte', Int8],
            ['int', Int16],
            ['long', Int32]
        ];
    };

    interface IUnsignedNumbers {
        uByte: number;
        uInt: number;
        uLong: number;
    };

    class UnsignedDataRecord extends NamedDataRecord<IUnsignedNumbers> {
        static fieldDescriptors: NamedRecordFieldDescriptor<IUnsignedNumbers>[] = [
            ['uByte', Uint8],
            ['uInt', Uint16],
            ['uLong', Uint32]
        ];
    };

    it('Unsigned numbers', () => {
        const record = UnsignedDataRecord.create();
        record.uByte = 0xeb;
        record.uInt = 0xab03;
        record.uLong = 0xdeadc0de;

        expect(record.uByte).to.equal(0xeb);
        expect(record.uInt).to.equal(0xab03);
        expect(record.uLong).to.equal( 0xdeadc0de);

        record.uByte = -1;
        record.uInt = -1;
        record.uLong = -1;
        expect(record.uByte).to.equal(0xff);
        expect(record.uInt).to.equal(0xffff);
        expect(record.uLong).to.equal(0xffffffff);
    });

    it('signed nubmers', () => {

        const record = SignedDataRecord.create();
        record.byte = 0xeb;
        record.int = 0xab03;
        record.long = 0xdeadc0de;

        expect(record.byte).to.equal(-21);
        expect(record.int).to.equal(-21757);
        expect(record.long).to.equal(-559038242);

        record.byte = 0xff;
        record.int = 0xffff;
        record.long = 0xffffffff;
        expect(record.byte).to.equal(-1);
        expect(record.int).to.equal(-1);
        expect(record.long).to.equal(-1);
    });

    it ('big endian', () => {
        const data = [0x80, 0x73, 0xb8, 0x32, 0xf8, 0x91, 0x89];
        const record = SignedDataRecord.create(data);
        expect(record.length).to.equal(data.length);
        expect(record.length).to.equal(SignedDataRecord.getSize());
        expect(record.byte).to.equal(-0x80);
        expect(record.int).to.equal(0x73b8);
        expect(record.long).to.equal(0x32f89189);
    });

    it ('little endian', () => {
        const data = [0x80, 0x73, 0xb8, 0x32, 0xf8, 0x91, 0x89];
        const record = (class extends UnsignedDataRecord {
            littleEndian = true;
        }).create(data);

        expect(record.length).to.equal(data.length);
        expect(record.length).to.equal(SignedDataRecord.getSize());
        expect(record.uByte).to.equal(0x80);
        expect(record.uInt).to.equal(0xb873);
        expect(record.uLong).to.equal(0x8991f832);
    });

    it ('strings', () => {
        interface IStrings {
            str: string;
            char: string;
        };

        class StringRecord extends NamedDataRecord<IStrings> {
            static fieldDescriptors: NamedRecordFieldDescriptor<IStrings>[] = [
                ['char', new Utf8cString(2)],
                ['str', new Utf8cString(20)]
            ];
        };

        const record = StringRecord.create();
        record.char = 't';
        record.str = 'this is a test';

        expect(record.length).to.equal(2+20);
        expect(record.char).to.equal('t');
        expect(record.str).to.equal('this is a test');

        expect( () => record.char = 'th').to.throw('Programmer Error: Cannot set string field char because of buffer overrun');
    });

    it ('arrays', () => {
        interface IArrays {
            longs: number[];
            strings: string[];
            bytes: number[];
            uInts: number[];
        };

        class ArrayRecord extends NamedDataRecord<IArrays> {
            static fieldDescriptors: NamedRecordFieldDescriptor<IArrays>[] = [
                ['longs', Int32, 4],
                ['strings', new Utf8cString(10), 2],
                ['bytes', Int8, 3],
                ['uInts', Uint16, 5]
            ];
        };

        const record = ArrayRecord.create();
        record.bytes = [0xa, 0xb, 0xc];
        record.uInts = [-1, 0xface, 0x7fff, 0x8000, 0];
        record.strings = [ 'this is a', ''];
        record.longs = [-1, 0xbabeface, 0x7fffffff, 0];

        expect(record.length).to.equal(4*4 + 10*2 + 1*3 + 2*5);
        expect(record.length).to.equal(ArrayRecord.getSize());
        expect(record.bytes[0]).to.equal(0xa);
        expect(record.bytes[1]).to.equal(0xb);
        expect(record.bytes[2]).to.equal(0xc);
        expect(record.strings[0]).to.equal('this is a');
        expect(record.strings[1]).to.be.empty;
        expect(record.longs[0]).to.equal(-1);
        expect(record.longs[1]).to.equal(-1161889074);
        expect(record.longs[2]).to.equal(0x7fffffff);
        expect(record.longs[3]).to.equal(0);
        expect(record.uInts[0]).to.equal(0xffff);
        expect(record.uInts[1]).to.equal(0xface);
        expect(record.uInts[2]).to.equal(0x7fff);
        expect(record.uInts[3]).to.equal(0x8000);
        expect(record.uInts[4]).to.equal(0);

        expect( () => record.bytes = [0]).to.throw('Programmer Error, cannot set array field bytes of size 3 because the array size does not match');
        expect( () => record.longs = [0]).to.throw('Programmer Error, cannot set array field longs of size 4 because the array size does not match');
        expect( () => record.uInts = [0]).to.throw('Programmer Error, cannot set array field uInts of size 5 because the array size does not match');
    });

    it ('union', () => {
        interface IUnion {
            uLongs: number[];
            str: string;
            uBytes: number[];
            ints: number[];
        };

        class UnionRecord extends NamedDataRecord<IUnion> {
            littleEndian = true;
            static fieldDescriptors: NamedRecordFieldDescriptor<IUnion>[] = [
                ['str', new Utf8cString(13)],
                new Union<IUnion>([['uBytes', Int8, 3], ['ints', Uint16, 5]], [['uLongs', Uint32, 4]])
            ];
        };

        expect(UnionRecord.getSize()).to.equal(13 + Math.max(1*3 + 2*5, 4*4));

        const record = UnionRecord.create([84, 104, 105, 115, 0, 1, 2, 3, 4, 5, 6, 7, 8, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0]);

        expect(record.length).to.equal(UnionRecord.getSize());
        expect(record.str).to.equal('This');
        expect(record.uBytes[0]).to.equal(0x11);
        expect(record.uBytes[1]).to.equal(0x22);
        expect(record.uBytes[2]).to.equal(0x33);
        expect(record.ints[0]).to.equal(0x5544);
        expect(record.ints[1]).to.equal(0x7766);
        expect(record.ints[2]).to.equal(-(-0x9988));
        expect(record.ints[3]).to.equal(-(-0xbbaa));
        expect(record.ints[4]).to.equal(-(-0xddcc));
        expect(record.uLongs[0]).to.equal(0x44332211);
        expect(record.uLongs[1]).to.equal(0x88776655);
        expect(record.uLongs[2]).to.equal(0xccbbaa99);
        expect(record.uLongs[3]).to.equal(0x00ffeedd);
    });

    it ('extends', () => {
        interface IHeader {
            startByte: number;
            command: number;
            len: number;
        };

        class Header extends NamedDataRecord<IHeader> {
            littleEndian = true;
            static fieldDescriptors: NamedRecordFieldDescriptor<IHeader>[] = [
                ['startByte', Uint8],
                ['command', Int16],
                ['len', Uint16]
            ];
        };

        interface IFooter {
            checksum: number;
            stopByte: number;
        };

        class Footer extends NamedDataRecord<IFooter> {
            littleEndian = true;
            static fieldDescriptors: NamedRecordFieldDescriptor<IFooter>[] = [
                ['checksum', Uint16],
                ['stopByte', Uint8]
            ];
        };

        interface IPayload {
            data: number[];
        };

        class Payload extends NamedDataRecord<IPayload> {
            static fieldDescriptors: NamedRecordFieldDescriptor<IPayload>[] = [
                ['data', Int8, 8]
            ];
        };

        const totalPacket = Footer.extends(Payload).extends(Header).create();

        totalPacket.startByte = 45;
        totalPacket.stopByte = 54;
        totalPacket.command = 0xF843;
        totalPacket.len = Payload.getSize() + Header.getSize() + Footer.getSize();
        expect(totalPacket.length).to.equal(totalPacket.len);

        totalPacket.data = [ -1, 2, -3, 4, -5, 6, -7, 8 ];
        totalPacket.checksum = 0x58AE;

        const rawData = [ 45, 0x43, 0xF8, 5 + 8 + 3, 0, 256-1, 2, 256-3, 4, 256-5, 6, 256-7, 8, 0xAE, 0x58, 54];
        expect([...totalPacket.asUint8Array]).to.deep.equal(rawData);

        let size = 0;
        const header = Header.create(rawData.slice(size, size + Header.getSize()));
        size += header.length;
        const payload = Payload.create(rawData.slice(size, size + Payload.getSize()));
        size += payload.length;
        const footer = Footer.create(rawData.slice(size, size + Footer.getSize()));
        size += footer.length;

        expect(header.startByte).to.equal(45);
        expect(footer.stopByte).to.equal(54);
        expect(header.command).to.equal(0xF843-0x10000);
        expect(header.len).to.equal(size);
        expect([...payload.data]).to.deep.equal([-1, 2, -3, 4, -5, 6, -7, 8]);
        expect(header.len).to.equal(size);
        expect(footer.checksum).to.equal(0x58AE);
    });
});