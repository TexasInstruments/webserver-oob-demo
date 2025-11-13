import '../../gc-core-assets/lib/NodeJSEnv';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { DataConverter as converter, bindValueType } from '../lib/CoreDatabind';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

GcConsole.setLevel('gc-core-databind', processArgs.enableLog);

describe('DataConverter', () => {

    function evaluate(result: bindValueType, source: bindValueType, destinationType: string, param?: number) {
        const convertedResult = converter.convert(source, typeof source, destinationType, param);
        expect(result).to.deep.equal(convertedResult);
    };

    // numeric conversion
    const A = 13;
    const B = 263;
    const C = 19;
    const D = -2343;
    const X = 11883.54834;
    const Y = -1893.94943;
    const BOOL = true;
    const S = 'test with a space';
    const hex = '0xbabe';


    it('Array Conversions', () => {
        evaluate([1, 2, 3], '1,2,3', 'array');
        evaluate([1, 2, 3], '1,    2, 3   ', 'array');
        evaluate([], '', 'array');
        evaluate([-1], '-1', 'array');
        evaluate([1], '0x1', 'array');
    });

    it('Number Conversions', () => {
        evaluate(Number(A), A, 'number');
        evaluate(Number(B), B, 'number');
        evaluate(Number(C), C, 'number');
        evaluate(Number(D), D, 'number');
        evaluate(Number(X), X, 'number');
        evaluate(Number(Y), Y, 'number');
        evaluate(Number(BOOL), BOOL, 'number');
        evaluate(Number(S), S, 'number');
        evaluate(Number(hex), hex, 'number');
    });

    it('String Conversions', () => {
        evaluate(String(A), A, 'string');
        evaluate(String(B), B, 'string');
        evaluate(String(C), C, 'string');
        evaluate(String(D), D, 'string');
        evaluate(String(X), X, 'string');
        evaluate(String(Y), Y, 'string');
        evaluate(String(BOOL), BOOL, 'string');
        evaluate(String(S), S, 'string');
        evaluate(String(hex), hex, 'string');
    });

    it('Boolean Conversions', () => {
        evaluate(Boolean(A), A, 'boolean');
        evaluate(Boolean(B), B, 'boolean');
        evaluate(Boolean(C), C, 'boolean');
        evaluate(Boolean(D), D, 'boolean');
        evaluate(Boolean(X), X, 'boolean');
        evaluate(Boolean(Y), Y, 'boolean');
        evaluate(Boolean(BOOL), BOOL, 'boolean');
        evaluate(false, S, 'boolean');
        evaluate(true, hex, 'boolean');
        evaluate(false, 0, 'boolean');
        evaluate(true, 1, 'boolean');
        evaluate(false, '0x0', 'boolean');
        evaluate(true, '0x1', 'boolean');
    });

    it('Hex Conversions', () => {
        evaluate('0xD', A, 'hex');
        evaluate('0x0107', B, 'hex', 4);
        evaluate('0x13', C, 'hex');
        evaluate('0xFFFFF6D9', D, 'hex');
        evaluate('0xFFFFFF', -1, 'hex', 6);
        evaluate('0x1', BOOL, 'hex');
        evaluate('0xNaN', S, 'hex');
        evaluate('0xBABE', hex, 'hex');
    });

    it('Binary Conversions', () => {
        evaluate('01101', A, 'binary', 5);
        evaluate('00000111', B, 'binary', 8);
        evaluate('10011', C, 'binary');
        evaluate('11111111111111111111011011011001', D, 'binary');
        evaluate('1111111111111111', -1, 'binary', 16);
        evaluate('1', BOOL, 'binary');
        evaluate('NaN', S, 'binary');
        evaluate('1011101010111110', hex, 'binary');
    });

    it('Decimal Conversions', () => {
        evaluate('13.00000', A, 'dec', 5);
        evaluate('263.00000000', B, 'dec', 8);
        evaluate('19', C, 'dec');
        evaluate('-2343', D, 'dec');
        evaluate('11883.55', X, 'dec', 2);
        evaluate('11883.54834', X, 'dec');
        evaluate('-1893.949430', Y, 'dec', 6);
        evaluate('-1893.94943', Y, 'dec');
        evaluate('1', BOOL, 'dec');
        evaluate('NaN', S, 'dec');
        evaluate((+hex).toFixed(0), hex, 'dec', 0);
    });

    it('Exponential Conversions', () => {
        evaluate(A.toExponential(5), A, 'exp', 5);
        evaluate(B.toExponential(8), B, 'exp', 8);
        evaluate(C.toExponential(), C, 'exp');
        evaluate(D.toExponential(), D, 'exp');
        evaluate(X.toExponential(2), X, 'exp', 2);
        evaluate(Y.toExponential(6), Y, 'exp', 6);
        evaluate((+BOOL).toExponential(), BOOL, 'exp');
        evaluate('NaN', S, 'exp');
        evaluate((+hex).toExponential(0), hex, 'exp', 0);
    });
});