import { expect } from 'chai';

import { connectionManager } from '../../gc-target-connection-manager/lib/ConnectionManager';
import { MessagePackCodec } from '../lib/MessagePackCodec';
import { bindValueType } from '../../gc-core-databind/lib/CoreDatabind';
import { AbstractDataCodec, codecRegistry, bufferDataType } from '../../gc-target-configuration/lib/TargetConfiguration';
import { streamingCodecDataType } from '../../gc-model-streaming/lib/StreamingDataModel';
import { ICodecBaseParams } from '../../gc-target-configuration/lib/ICodecBaseParams';

describe('MessagePackCodec', () => {
    let codec: MessagePackCodec;

    class TestCodec extends AbstractDataCodec<object, object, Buffer | number[], Buffer | number[]> {
        txData!: Buffer | number[];
        rxData!: object;
        constructor(readonly params: ICodecBaseParams) {
            super(params.id || 'testCodec', streamingCodecDataType, streamingCodecDataType, bufferDataType, bufferDataType);
        }
        encode(data: Buffer | number[]): void {
            this.txData = data;
        }
        decode(data: Buffer | number[]): boolean | Error {
            this.rxData = data;
            return true;
        }
    }

    before(() => {
        codec = new MessagePackCodec({});
    });

    after(async () => {
        codecRegistry.dispose();
        connectionManager.dispose();
    });

    it('getInstance', () => {
        expect(codecRegistry.getInstance('messagePackCodec')).to.equal(codec);
    });

    it('encode, decode', async () => {
        const enc = new TestCodec({ id: 'enc' });
        const dec = new TestCodec({ id: 'dec' });
        connectionManager.setActiveConfiguration(`${enc.id}+${codec.id}+${dec.id}`);

        codec.encode(undefined);
        expect(enc.txData).eql([0xc0]);

        const cases = [
            null, [0xc0],
            true, [0xc3],
            false, [0xc2],
            0, [0],
            127, [0x7f],
            128, [0xcc, 0x80],
            255, [0xcc, 0xff],
            256, [0xcd, 1, 0],
            65535, [0xcd, 0xff, 0xff],
            65536, [0xce, 0, 1, 0, 0],
            4294967295, [0xce, 0xff, 0xff, 0xff, 0xff],
            -1, [0xff],
            -32, [0xe0],
            -33, [0xd0, 0xdf],
            -128, [0xd0, 0x80],
            -129, [0xd1, 0xff, 0x7f],
            -32768, [0xd1, 0x80, 0],
            -32769, [0xd2, 0xff, 0xff, 0x7f, 0xff],
            -2147483648, [0xd2, 0x80, 0, 0, 0],
        ];
        for (let idx = 0; idx + 1 < cases.length; idx += 2) {
            const msg = `case ${idx} ${cases[idx]}`;
            codec.encode(cases[idx]);
            expect(enc.txData, msg).eql(cases[idx + 1]);
            codec.decode(enc.txData);
            expect(dec.rxData, msg).eql(cases[idx]);
        }

        const a1 = [true, 1.23, -2.45, 'ab', [10, 11, 100, 4294967296, -2147483649], { 'k': 1 }];
        codec.encode(a1);
        codec.decode(enc.txData);
        expect(dec.rxData).eql(a1);

        const m1: { [index: string]: bindValueType } = {};
        m1['a1'] = a1;
        m1['b'] = true;
        m1['b1'] = -1;
        m1['b2'] = 2.45;
        m1['b3'] = 'abc';
        m1['b4'] = { 'k': 1 };
        codec.encode(m1);
        codec.decode(enc.txData);
        expect(dec.rxData).eql(m1);

    });

});
