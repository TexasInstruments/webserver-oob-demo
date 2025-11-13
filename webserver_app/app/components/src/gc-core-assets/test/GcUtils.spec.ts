import { expect } from 'chai';
import { GcUtils } from '../lib/GcUtils';

describe('GcUtils', () => {
    it('string2value', () => {
        let result = GcUtils.string2value(undefined);
        expect(result).to.not.exist;
        result = GcUtils.string2value('0xdeadc0de');
        expect(result).to.be.equal(0xdeadc0de);
        result = GcUtils.string2value(0xdeadc0de);
        expect(result).to.be.equal(0xdeadc0de);
        result = GcUtils.string2value('12345678');
        expect(result).to.be.equal(12345678);
        result = GcUtils.string2value('test');
        expect(result).to.be.NaN;
        result = GcUtils.string2value('-0xbabeface');
        expect(result).to.be.equal(-0xbabeface);
        result = GcUtils.string2value('1234.56789');
        expect(result).to.be.equal(1234.56789);
        result = GcUtils.string2value('-1234.56789');
        expect(result).to.be.equal(-1234.56789);
        result = GcUtils.string2value('true');
        expect(result).to.be.equal(1);
        result = GcUtils.string2value('false');
        expect(result).to.be.equal(0);
    });

    it('string2boolean', () => {
        let result = GcUtils.string2boolean(undefined);
        expect(result).to.be.false;
        result = GcUtils.string2boolean(true);
        expect(result).to.be.true;
        result = GcUtils.string2boolean(false);
        expect(result).to.be.false;
        result = GcUtils.string2boolean(1);
        expect(result).to.be.true;
        result = GcUtils.string2boolean(0);
        expect(result).to.be.false;
        result = GcUtils.string2boolean('true');
        expect(result).to.be.true;
        result = GcUtils.string2boolean('false');
        expect(result).to.be.false;
        result = GcUtils.string2boolean('1');
        expect(result).to.be.true;
        result = GcUtils.string2boolean('0');
        expect(result).to.be.false;
    });

    it('bitField.getMask', () => {
        // TODO: support BigInt when cloud agent moves to 10.4+ nodejs version.
        // let result = GcUtils.bitField.getMask(39, 39);
        // expect(result).to.equal(0x8000000000);
        // result = GcUtils.bitField.getMask(39, 8);
        // expect(result).to.equal(0xFFFFFFFF00);

        let result = GcUtils.bitField.getMask(31, 31);
        expect(result).to.equal(0x80000000);
        result = GcUtils.bitField.getMask(0, 31);
        expect(result).to.equal(0xFFFFFFFF);
        result = GcUtils.bitField.getMask(15, 15);
        expect(result).to.equal(0x8000);
        result = GcUtils.bitField.getMask(1, 15);
        expect(result).to.equal(0xFFFE);
        result = GcUtils.bitField.getMask(7, 7);
        expect(result).to.equal(0x80);
        result = GcUtils.bitField.getMask(0, 7);
        expect(result).to.equal(0xFF);
        result = GcUtils.bitField.getMask(1, 1);
        expect(result).to.equal(0x2);
        result = GcUtils.bitField.getMask(0, 0);
        expect(result).to.equal(0x1);
    });

    it('bitField.readField', () => {
        let result = GcUtils.bitField.readField(0xFFFFFFFF, 0x80000000, 0);
        expect(result).to.equal(0x80000000);
        result = GcUtils.bitField.readField(0xFFFFFFFF, 0x80000000, 31);
        expect(result).to.equal(1);
        result = GcUtils.bitField.readField(0xFFFFFFFF, 0x80000000, 0, 0x80000000);
        expect(result).to.equal(-0x80000000);
        result = GcUtils.bitField.readField(0xFFFFFFFF, 0x80000000, 31, 0x80000000);
        expect(result).to.equal(-1);
        result = GcUtils.bitField.readField(0xAAAAAAAA, 0xFFFF0000, 0);
        expect(result).to.equal(0xAAAA0000);
        result = GcUtils.bitField.readField(0xAAAAAAAA, 0xFFFF0000, 16);
        expect(result).to.equal(0xAAAA);
        result = GcUtils.bitField.readField(0xAAAAAAAA, 0xFFFF0000, 0, 0x80000000);
        expect(result).to.equal(-0x55560000);
        result = GcUtils.bitField.readField(0xAAAAAAAA, 0xFFFF0000, 16, 0x80000000);
        expect(result).to.equal(-0x5556);
        result = GcUtils.bitField.readField(0x55555555, 0x00FFFF00, 0);
        expect(result).to.equal(0x00555500);
        result = GcUtils.bitField.readField(0x55555555, 0x00FFFF00, 8);
        expect(result).to.equal(0x5555);
        result = GcUtils.bitField.readField(0x55555555, 0x00FFFF00, 0, 0x800000);
        expect(result).to.equal(0x00555500);
        result = GcUtils.bitField.readField(0x55555555, 0x00FFFF00, 8, 0x800000);
        expect(result).to.equal(0x5555);
        result = GcUtils.bitField.readField(-1, 0xFFFF, 0);
        expect(result).to.equal(0xFFFF);
        result = GcUtils.bitField.readField(-1, 0x2, 1);
        expect(result).to.equal(1);
        result = GcUtils.bitField.readField(-1, 0xFFFE, 0, 0x8000);
        expect(result).to.equal(-2);
        result = GcUtils.bitField.readField(-1, 0x1, 0, 0x1);
        expect(result).to.equal(-1);
    });

    it('bitField.writeField', () => {
        let result = GcUtils.bitField.writeField(0x7FFFFFFF, 0x80000000, 0, 0x80000000);
        expect(result).to.equal(0xFFFFFFFF);
        result = GcUtils.bitField.writeField(0xFFFFFFFF, 0x80000000, 31, 0);
        expect(result).to.equal(0x7FFFFFFF);
        result = GcUtils.bitField.writeField(0x80000000, 0x80000000, 0, -1);
        expect(result).to.equal(0x80000000);
        result = GcUtils.bitField.writeField(0x80000000, 0x80000000, 31, -2);
        expect(result).to.equal(0);
        result = GcUtils.bitField.writeField(0xAAAAAAAA, 0xFFFF0000, 0, -1);
        expect(result).to.equal(0xFFFFAAAA);
        result = GcUtils.bitField.writeField(0xAAAAAAAA, 0xFFFF0000, 16, 0x5555);
        expect(result).to.equal(0x5555AAAA);
        result = GcUtils.bitField.writeField(0xAAAAAAAA, 0xFFFF0000, 0, 0x80000000);
        expect(result).to.equal(0x8000AAAA);
        result = GcUtils.bitField.writeField(0x5AAAAAAA, 0xFFFF0000, 16, 0x8000);
        expect(result).to.equal(0x8000AAAA);
        result = GcUtils.bitField.writeField(0x55555555, 0x00FFFF00, 0, 0x1234FF);
        expect(result).to.equal(0x55123455);
        result = GcUtils.bitField.writeField(0x55555555, 0x00FFFF00, 8, -0x1234);
        expect(result).to.equal(0x55EDCC55);
        result = GcUtils.bitField.writeField(0x55555555, 0x00FFFF00, 0, 0x0);
        expect(result).to.equal(0x55000055);
        result = GcUtils.bitField.writeField(0x55555555, 0x00FFFF00, 8, 0x8000);
        expect(result).to.equal(0x55800055);
        result = GcUtils.bitField.writeField(-1, 0xFFFF, 0, 0xBABE);
        expect(result).to.equal(0xFFFFBABE);
        result = GcUtils.bitField.writeField(-1, 0x2, 1, 0);
        expect(result).to.equal(0xFFFFFFFD);
        result = GcUtils.bitField.writeField(-1, 0xFFFE, 0, 0x321E);
        expect(result).to.equal(0xFFFF321F);
        result = GcUtils.bitField.writeField(-1, 0x1, 0, -0x321E);
        expect(result).to.equal(0xFFFFFFFE);
        result = GcUtils.bitField.writeField(-1, 0xFC, 2, 48.00000002);
        expect(result).to.equal(0xFFFFFFC3);
        result = GcUtils.bitField.writeField(-1, 0xFC, 2, 47.99999998);
        expect(result).to.equal(0xFFFFFFC3);
    });

    it('parseArrayProperty', async () => {
        let result = GcUtils.parseArrayProperty(undefined);
        expect(result).to.not.exist;
        result = GcUtils.parseArrayProperty('1,000,000|2,000,000|3,000,000');
        expect(result).to.deep.equal(['1', '000', '000|2', '000', '000|3', '000', '000']);
        result = GcUtils.parseArrayProperty('1,000,000|2,000,000|3,000,000|');
        expect(result).to.deep.equal(['1,000,000', '2,000,000', '3,000,000']);
        result = GcUtils.parseArrayProperty('');
        expect(result).to.not.exist;
        result = GcUtils.parseArrayProperty('0x400');
        expect(result).to.deep.equal(['0x400']);
        result = GcUtils.parseArrayProperty('0x400', ['|', ';', 'x']);
        expect(result).to.deep.equal(['0', '400']);
        result = GcUtils.parseArrayProperty('1|;2|;3|;');
        expect(result).to.deep.equal(['1|', '2|', '3|']);
        result = GcUtils.parseArrayProperty(['test']);
        expect(result).to.deep.equal(['test']);
    });

});
