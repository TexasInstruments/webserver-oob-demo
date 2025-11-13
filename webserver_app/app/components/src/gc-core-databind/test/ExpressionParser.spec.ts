import '../../gc-core-assets/lib/NodeJSEnv';
import { expect } from 'chai';
import { IStreamingDataEvent, AbstractBindFactory, bindValueType, VariableLookupBindValue, VariableBindValue, bindingRegistry, valueChangedEventType, streamingDataEventType, DataFormatterRegistry, MathModel, PropertyModel } from '../lib/CoreDatabind';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

GcConsole.setLevel('gc-core-databind', processArgs.enableLog);

/* eslint-disable eqeqeq */
/* eslint-disable @typescript-eslint/ban-ts-ignore */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/brace-style */

describe('ExpressionParser', () => {

    let valueChanged = false;
    function valueChangedHandler() {
        valueChanged = true;
    };

    let nextValue = null;
    function onDataReceivedHandler(details: IStreamingDataEvent) {
        nextValue = details.data;
    };

    class TestModel extends AbstractBindFactory {
        constructor() {
            super('test');
        };

        private bindValues = new Map<string, bindValueType>();

        createNewBind(name: string) {
            if (this.bindValues.has(name)) {
                const data = this.bindValues.get(name);
                if (data instanceof Array || typeof data === 'object') {
                    return new VariableLookupBindValue(data);
                }
                return new VariableBindValue(data);
            }
            else {
                return null;
            }
        };


        addBinding(name: string, value: bindValueType) {
            this.bindValues.set(name, value);
        };
    };

    function getBinding(expression: string) {
        const binding = bindingRegistry.getBinding(expression);
        expect(binding).to.exist;
        return binding;
    };

    function testValueChanged(bindExpression: string, leafBinding: string, value: bindValueType, noStreaming = false) {
        valueChanged = false;
        nextValue = null;

        const resultBind = bindingRegistry.getBinding('prop.x');
        expect(resultBind).to.exist;

        resultBind!.onStreamingDataReceived = function(val: bindValueType) {
            this.updateValue(val);
        };

        // Using a binder to test change notification block when values is unaltered, as well as event propagaion.
        const binder = bindingRegistry.bind('prop.x', bindExpression);
        expect(binder).to.exist;

        const varBind = getBinding(leafBinding);
        expect(varBind).to.exist;

        const origValue = resultBind!.getValue();

        resultBind!.addEventListener(valueChangedEventType, valueChangedHandler);
        resultBind!.addEventListener(streamingDataEventType, onDataReceivedHandler);
        varBind!.updateValue(value);

        const newValue = resultBind!.getValue();
        expect(newValue !== origValue).to.equal(valueChanged);

        if (noStreaming) {
            expect(nextValue).to.be.null;
        }
        else {
            expect(newValue).to.equal(nextValue);
        }

        bindingRegistry.unbind(binder!);

        return valueChanged;
    };

    function evaluate(result: bindValueType, expression: string, nBindings: number) {
        const bindingCount = bindingRegistry.getBindingCount();

        const binding = getBinding(expression);
        expect(binding).to.exist;

        const value = binding!.getValue();
        expect(result).to.deep.equal(value);
        expect(binding!.status).to.be.null;

        expect(nBindings).to.equal(bindingRegistry.getBindingCount() - bindingCount);
    };

    function evaluateError(expression: string, message: string) {
        expect(() => {
            const binding = getBinding(expression);
            expect(binding).to.exist;
            binding!.getValue();
            if (binding!.status) {
                throw binding!.status.message;
            }
        }).to.throw(message);
    };

    let A = 1;
    let B = 263;
    const C = 19;
    const D = -2343;
    const X = 11883.54834;
    const Y = -1893.94943;
    const S = 'test with a space';
    let BOOL = true;
    const hex = '0xBABE';
    const ARRAY =
        [
            1.0, -3, 'test',
            [
                true, false
            ]
        ];
    const M =
    {
        name: 'value'
    };
    const L =
        [
            A, B, C
        ];
    const N = null;

    const Q = function (value: number, q: number) {
        return value / Math.pow(2, q);
    };

    // const Inverse_Q = function (value: number, q: number) {
    //     return Math.round(value * Math.pow(2, q));
    // };

    let model: TestModel;

    before(() => {
        bindingRegistry.dispose();
        bindingRegistry.registerModel(new MathModel());
        bindingRegistry.registerModel(new PropertyModel());

        model = new TestModel();
        bindingRegistry.registerModel(model, true, 'testAlias');
        model.addBinding('A', A);
        model.addBinding('B', B);
        model.addBinding('C', C);
        model.addBinding('D', D);

        model.addBinding('X', X);
        model.addBinding('Y', Y);

        model.addBinding('S', S);
        model.addBinding('hex', hex);

        model.addBinding('BOOL', BOOL);
        model.addBinding('ARRAY', ARRAY);

        model.addBinding('L', L);
        model.addBinding('M', M);
        model.addBinding('N', N);
    });

    it('numeric addition operator', () => {
        evaluate(Number(A + A), 'A+A', 2);
        evaluate(Number(A + B), 'A+B', 2);
        evaluate(Number(A + C), 'A+C', 2);
        evaluate(Number(A + D), 'A+D', 2);
        evaluate(Number(A + X), 'A+X', 2);
        evaluate(Number(A + Y), 'A+Y', 2);
        evaluate(String(A + S), 'A+S', 2);
        // @ts-ignore
        evaluate(A + BOOL, 'A+BOOL', 2);

        evaluate(Number(Y + A), 'Y+A', 1);
        evaluate(Number(Y + B), 'Y+B', 1);
        evaluate(Number(Y + C), 'Y+C', 1);
        evaluate(Number(Y + D), 'Y+D', 1);
        evaluate(Number(Y + X), 'Y+X', 1);
        evaluate(Number(Y + Y), 'Y+Y', 1);
        evaluate(String(X + S), 'X+S', 1);
        // @ts-ignore
        evaluate(X + BOOL, 'X+BOOL', 1);
    });

    it('subtraction operator', () => {
        evaluate(Number(B - A), 'B-A', 1);
        evaluate(Number(B - B), 'B-B', 1);
        evaluate(Number(B - C), 'B-C', 1);
        evaluate(Number(B - D), 'B-D', 1);
        evaluate(Number(B - X), 'B-X', 1);
        evaluate(Number(B - Y), 'B-Y', 1);
        evaluateError('B-S', 'Operator \'-\' does not support string types');
        // @ts-ignore
        evaluate(B - BOOL, 'B-BOOL', 1);
    });

    it('multiplication operator', () => {
        evaluate(Number(C * A), 'C*A', 1);
        evaluate(Number(C * B), 'C*B', 1);
        evaluate(Number(C * C), 'C*C', 1);
        evaluate(Number(C * D), 'C*D', 1);
        evaluate(Number(C * X), 'C*X', 1);
        evaluate(Number(C * Y), 'C*Y', 1);
        evaluateError('C*S', 'Operator \'*\' does not support string types');
        // @ts-ignore
        evaluate(C * BOOL, 'C*BOOL', 1);
    });

    it('division operator', () => {
        evaluate(Number(D / A), 'D/A', 1);
        evaluate(Number(D / B), 'D/B', 1);
        evaluate(Number(D / C), 'D/C', 1);
        evaluate(Number(D / D), 'D/D', 1);
        evaluate(Number(D / X), 'D/X', 1);
        evaluate(Number(D / Y), 'D/Y', 1);
        evaluateError('D/S', 'Operator \'/\' does not support string types');
        // @ts-ignore
        evaluate(D / BOOL, 'D/BOOL', 1);
    });

    it('modulus operator', () => {
        evaluate(Number(X % A), 'X%A', 1);
        evaluate(Number(X % B), 'X%B', 1);
        evaluate(Number(X % C), 'X%C', 1);
        evaluate(Number(X % D), 'X%D', 1);
        evaluate(Number(X % X), 'X%X', 1);
        evaluate(Number(X % Y), 'X%Y', 1);
        evaluateError('X%S', 'Operator \'%\' does not support string types');
        // @ts-ignore
        evaluate(X % BOOL, 'X%BOOL', 1);
    });

    it('equals operator', () => {
        evaluate(Boolean(true), 'A==A', 1);
        // @ts-ignore
        evaluate(Boolean(A == B), 'A==B', 1);
        // @ts-ignore
        evaluate(Boolean(A == C), 'A==C', 1);
        // @ts-ignore
        evaluate(Boolean(A == D), 'A==D', 1);
        // @ts-ignore
        evaluate(Boolean(A == X), 'A==X', 1);
        // @ts-ignore
        evaluate(Boolean(A == Y), 'A==Y', 1);
        evaluate(Boolean(A.toString() == S), 'A==S', 1);
        // @ts-ignore
        evaluate(A == BOOL, 'A==BOOL', 1);

        // @ts-ignore
        evaluate(S == A, 'S==A', 1);
        // @ts-ignore
        evaluate(S == B, 'S==B', 1);
        // @ts-ignore
        evaluate(S == C, 'S==C', 1);
        // @ts-ignore
        evaluate(S == D, 'S==D', 1);
        // @ts-ignore
        evaluate(S == X, 'S==X', 1);
        // @ts-ignore
        evaluate(S == Y, 'S==Y', 1);
        evaluate(Boolean(true), 'S==S', 1);
        evaluate(Boolean(S == BOOL.toString()), 'S==BOOL', 1);
    });
    it('not equals operator', () => {
        // @ts-ignore
        evaluate(Boolean(B != A), 'B!=A', 1);
        // @ts-ignore
        evaluate(Boolean(false), 'B!=B', 1);
        // @ts-ignore
        evaluate(Boolean(B != C), 'B!=C', 1);
        // @ts-ignore
        evaluate(Boolean(B != D), 'B!=D', 1);
        // @ts-ignore
        evaluate(Boolean(B != X), 'B!=X', 1);
        // @ts-ignore
        evaluate(Boolean(B != Y), 'B!=Y', 1);
        evaluate(Boolean(B.toString() != S), 'B!=S', 1);
        // @ts-ignore
        evaluate(B != BOOL, 'B!=BOOL', 1);

        // @ts-ignore
        evaluate(BOOL != A, 'BOOL!=A', 1);
        // @ts-ignore
        evaluate(BOOL != B, 'BOOL!=B', 1);
        // @ts-ignore
        evaluate(BOOL != C, 'BOOL!=C', 1);
        // @ts-ignore
        evaluate(BOOL != D, 'BOOL!=D', 1);
        // @ts-ignore
        evaluate(BOOL != X, 'BOOL!=X', 1);
        // @ts-ignore
        evaluate(BOOL != Y, 'BOOL!=Y', 1);
        evaluate(Boolean(BOOL.toString() != S), 'BOOL!=S', 1);
        evaluate(Boolean(false), 'BOOL!=BOOL', 1);
    });
    it('less than operator', () => {
        evaluate(Boolean(C < A), 'C<A', 1);
        evaluate(Boolean(C < B), 'C<B', 1);
        evaluate(Boolean(false), 'C<C', 1);
        evaluate(Boolean(C < D), 'C<D', 1);
        evaluate(Boolean(C < X), 'C<X', 1);
        evaluate(Boolean(C < Y), 'C<Y', 1);
        evaluate(Boolean(C.toString() < S), 'C<S', 1);
        // @ts-ignore
        evaluate(C < BOOL, 'C<BOOL', 1);

    });
    it('greater than operator', () => {
        evaluate(Boolean(D > A), 'D>A', 1);
        evaluate(Boolean(D > B), 'D>B', 1);
        evaluate(Boolean(D > C), 'D>C', 1);
        evaluate(Boolean(false), 'D>D', 1);
        evaluate(Boolean(D > X), 'D>X', 1);
        evaluate(Boolean(D > Y), 'D>Y', 1);
        evaluate(Boolean(D.toString() > S), 'D>S', 1);
        // @ts-ignore
        evaluate(D > BOOL, 'D>BOOL', 1);

    });
    it('less than or equals operator', () => {
        evaluate(Boolean(X <= A), 'X<=A', 1);
        evaluate(Boolean(X <= B), 'X<=B', 1);
        evaluate(Boolean(X <= C), 'X<=C', 1);
        evaluate(Boolean(X <= D), 'X<=D', 1);
        evaluate(Boolean(true), 'X<=X', 1);
        evaluate(Boolean(X <= Y), 'X<=Y', 1);
        evaluate(Boolean(X.toString() <= S), 'X<=S', 1);
        // @ts-ignore
        evaluate(X <= BOOL, 'X<=BOOL', 1);

    });
    it('greater than or equals operator', () => {
        evaluate(Boolean(Y >= A), 'Y>=A', 1);
        evaluate(Boolean(Y >= B), 'Y>=B', 1);
        evaluate(Boolean(Y >= C), 'Y>=C', 1);
        evaluate(Boolean(Y >= D), 'Y>=D', 1);
        evaluate(Boolean(Y >= X), 'Y>=X', 1);
        evaluate(Boolean(true), 'Y>=Y', 1);
        evaluate(Boolean(Y.toString() >= S), 'Y>=S', 1);
        // @ts-ignore
        evaluate(Y >= BOOL, 'Y>=BOOL', 1);

    });

    it('logial AND operator', () => {
        // @ts-ignore
        evaluate(BOOL && A != 0, 'BOOL&&A', 1);
        // @ts-ignore
        evaluate(BOOL && C != 0, 'BOOL&&C', 1);
        // @ts-ignore
        evaluate(BOOL && X != 0, 'BOOL&&X', 1);
        evaluateError('BOOL&&S', 'Operator \'&&\' does not support string types');
        evaluate(Boolean(BOOL), 'BOOL&&BOOL', 1);
    });

    it('logial OR operator', () => {
        // @ts-ignore
        evaluate(BOOL || B != 0, 'BOOL||B', 1);
        // @ts-ignore
        evaluate(BOOL || D != 0, 'BOOL||D', 1);
        // @ts-ignore
        evaluate(BOOL || Y != 0, 'BOOL||Y', 1);
        evaluate(Boolean(BOOL), 'BOOL||BOOL', 1);
    });

    it('unary minus operator', () => {
        evaluate(Number(-A), '-A', 1);
        evaluate(Number(-B), '-B', 1);
        evaluate(Number(-C), '-C', 1);
        evaluate(Number(-D), '-D', 1);
        evaluate(Number(-X), '-X', 1);
        evaluate(Number(-Y), '-Y', 1);
        evaluateError('-S', 'Operator \'-\' does not support string types');
        evaluateError('-BOOL', 'Operator \'-\' does not support boolean types');
    });

    it('bitwise not operator', () => {
        evaluate(Number(~A), '~A', 1);
        evaluate(Number(~B), '~B', 1);
        evaluate(Number(~C), '~C', 1);
        evaluate(Number(~D), '~D', 1);
        evaluate(Number(~X), '~X', 1);
        evaluate(Number(~Y), '~Y', 1);
        evaluateError('~S', 'Operator \'~\' does not support string types');
        evaluateError('~BOOL', 'Operator \'~\' does not support boolean types');
    });

    it('logical not operator', () => {
        evaluate(!A, '!A', 1);
        evaluate(!B, '!B', 1);
        evaluate(!C, '!C', 1);
        evaluate(!D, '!D', 1);
        evaluate(!X, '!X', 1);
        evaluate(!Y, '!Y', 1);
        evaluateError('!S', 'Operator \'!\' does not support string types');
        evaluate(Boolean(!BOOL), '!BOOL', 1);
    });

    it('literals', () => {
        evaluate(34, '34', 1);
        evaluate(3.1415, '3.1415', 1);
        evaluate('test', '\'test\'', 1);
        evaluate(true, 'true', 1);
        evaluate(false, 'false', 1);
        evaluate(
            [
                'a', 'b', 'c'
            ], '[a,b,c]', 1);

        evaluate(
            [
                1, 2, 3, 4, 5
            ], '[1, 2, 3] + [ 4, 5] ', 3);
        evaluate(
            [
                1.0, 2.0, 3.3, 4.4, 5.0
            ], '[1, 2, 3.3] + [ 4.4, 5] ', 3);
        evaluate(
            [
                'a', 'b', '3', '4', '\'5\''
            ], '[a, b, 3] + [ 4, \'5\'] ', 3);
        evaluate(
            [
                true, false, true
            ], '[true,false ]+ true ', 2);

    });
    it('parentheses', () => {
        evaluate(Number((A + B) - (((C * D) / X) % Y)), ' (A + B) - (((C * D) / X) % Y)  ', 7);
        evaluate(Number(A + B - C * D / X % Y), ' A + B - C * D / X % Y ', 3);
        evaluate(Number(A + (B - C) * ((D / X)) % Y), 'A + (B - C) * ((D / X)) % Y ', 6);

    });
    it('conditional operator', () => {
        evaluate(String(A < B ? B <= C ? 'test1' : 'test2' : 'test3'), 'A<B?B<C?\'test1\':\'test2\':\'test3\'', 7);

    });
    it('array operator', () => {
        evaluate(ARRAY[0], 'ARRAY[0]', 2);
        evaluateError('ARRAY[A-12]', 'The index -11 is out of bounds.  It must be between 0 and 3');
        evaluate(ARRAY[2], 'ARRAY[\'2\']', 2);
        evaluate(ARRAY[0x3], ' ARRAY [ 0x3 ] ', 2);
        // @ts-ignore
        evaluate((ARRAY[2 + 1])[1], '(ARRAY [ 2+1])[1]', 4);
        evaluateError('(ARRAY [ 2+1]).1', 'Invalid identifier found in dot operator field name: "1".  To be honest, I was not expecting it to begin with a number.');
        evaluateError(' ARRAY [ 2+1] . 1', 'Invalid identifier found in dot operator field name: "1".  To be honest, I was not expecting it to begin with a number.');
        // @ts-ignore
        evaluate(ARRAY[0] + ARRAY[1], 'ARRAY[0] +ARRAY [1]', 2);
        // @ts-ignore
        evaluate(ARRAY[0] + ARRAY[2], 'ARRAY [0]+ ARRAY[2]', 2);
    });

    const g = 'g';
    const f =
    {
        g: g
    };
    const e =
        [
            null, null, f
        ];
    const d =
    {
        e: e
    };
    const c =
    {
        d: d
    };
    const b =
    {
        c: c
    };
    const aa =
        [
            null, b
        ];
    it('dot operator', () => {
        model.addBinding('a.a', aa);

        evaluate(String('g'), 'a.a[1][\'c\'].d.e[2].g', 2);
        evaluateError('a.a[N]', 'The index value is null.');
        evaluateError('a.a[N][N].d.e[N].g', 'The index value is null.');
        evaluateError('a.a[N][N].d.e[2].g', 'The index value is null.');
        evaluateError('a.a[N][\'c\'].d.e[2].g', 'The index value is null.');
        evaluateError('a.a[1][\'c\'].d.e[N].g', 'The index value is null.');
        evaluateError('a.a[1][N].d.e[2].g', 'The index value is null.');
        evaluateError('a.a[1][N].d.e[N].g', 'The index value is null.');
    });

    it('test null pointers, and array lookup error messages', () => {
        evaluate(null, 'N', 0);
        evaluateError('ARRAY[-1]', 'The index -1 is out of bounds.  It must be between 0 and 3');
        evaluateError('ARRAY[\'jasper\']', 'The index is not valid. Cannot convert \'jasper\' to an integer.');
        evaluateError('ARRAY[N]', 'The index value is null.');
        evaluateError('M[\'test\']', 'The index \'test\' was not found.');
        evaluate(String('value'), 'M[\'name\']', 2);
        evaluateError('L[0x4]', 'The index 4 is out of bounds.  It must be between 0 and 2');
        evaluateError('L[\'test\']', 'The index is not valid. Cannot convert \'test\' to an integer.');
        evaluate(Number(C), 'L[2]', 1);
        evaluate(Number(B), 'L[1]', 1);
        evaluate(Number(A), 'L[0x0]', 2);
    });

    it('status messages are cleared when values change', () => {
        evaluateError('ARRAY[N]', 'The index value is null.');
        const NullBind = bindingRegistry.getBinding('N');
        NullBind!.setValue(Number(2));
        evaluate(ARRAY[2], 'testAlias.ARRAY[N]', 1);
        evaluate(ARRAY[2], 'test.ARRAY[N]', 1);
        evaluate(ARRAY[2], 'ARRAY[N]', 0);
        evaluateError('a.a[N]', 'The index 2 is out of bounds.  It must be between 0 and 1');
        NullBind!.setValue(Number(1));
        evaluate(b, 'a.a[N]', 0);
    });

    it('test escape caracters in literal strings', () => {
        evaluate(String('"that\'s all folk\'s\\'), '\'"that\\\'s all folk\\\'s\\\\\'', 1);
        evaluate(String('file:' + S + '/InterruptVectors_init.c'), '\'file:\' + S + \'/InterruptVectors_init.c\'', 4);
    });

    it('Math bindings', () => {
        evaluate(Math.PI, 'Math.PI', 1);
        evaluate(Math.PI, 'widget.Math.PI', 1);
        evaluate(Math.abs(D), 'Math.abs(D)', 1);
        evaluate(Math.round(X), 'Math.round(X)', 1);
        evaluate(Math.round(Y), 'Math.round(Y)', 1);
        // @ts-ignore
        evaluate(Math.sin(ARRAY[2]), 'Math.sin(ARRAY[2])', 1);
        evaluate(Math.log(X), 'Math.log(X)', 1);
        evaluate(Math.log(Y), 'Math.log(Y)', 1);
        evaluate(Math.atan2(X, Y), 'Math.atan2(X,Y)', 1);
        evaluate(Math.max(A, B, C, D), 'Math.max(A,B,C,D)', 1);
        evaluate(Math.min(A, B, C, D), 'Math.min(A,B,C,D)', 1);
        // @ts-ignore
        Math.custom = function (value) { return value + 1000; };
        // @ts-ignore
        evaluate(Math.custom(C), 'Math.custom(C)', 1);
    });

    it('test Q value conversion', () => {
        evaluate(Q(B, 24), 'Q(B, 24)', 2);
        evaluate(Q(B, 24), 'B.$q24', 1);
        evaluate(Q(B, 0), 'Q(B, 0)', 1);
    });

    it('Hex conversions qualifiers', () => {
        evaluate('0x1', 'A.$hex', 1);
        evaluate('0x0107', 'B.$hex4', 1);
        evaluate('0x13', 'C.$hex', 1);
        evaluate('0xFFFFF6D9', 'D.$hex', 1);
        evaluate('0xF6D9', 'D.$hex4', 1);
        evaluate('0x1', 'BOOL.$hex', 1);
        evaluate('0xNaN', 'S.$hex', 1);
        evaluate('0xBABE', 'hex.$hex', 1);
    });

    it('Binary conversions', () => {
        evaluate('00001', 'A.$binary5', 1);
        evaluate('00000111', 'B.$BINARY8', 1);
        evaluate('10011', 'C.$binary', 1);
        evaluate('11111111111111111111011011011001', 'D.$binary', 1);
        evaluate('1', 'BOOL.$binary', 1);
        evaluate('NaN', 'S.$BinAry', 1);
        evaluate('1011101010111110', 'hex.$binary', 1);
    });

    it('Decimal conversions', () => {
        evaluate('1.00000', 'A.$DEC5', 1);
        evaluate('263.00000000', 'B.$dec8', 1);
        evaluate('19', 'C.$dec', 1);
        evaluate('-2343', 'D.$dec', 1);
        evaluate('11883.55', 'X.$dec2', 1);
        evaluate('-1893.949430', 'Y.$dec6', 1);
        evaluate('1', 'BOOL.$dec', 1);
        evaluate('NaN', 'S.$dec', 1);
        evaluate((+hex).toFixed(0), 'hex.$dec', 1);

    });
    it('Exponential conversions', () => {
        evaluate(A.toExponential(5), 'A.$exp5', 1);
        evaluate(B.toExponential(8), 'B.$exp8', 1);
        evaluate(C.toExponential(), 'C.$exp', 1);
        evaluate(D.toExponential(), 'D.$exp', 1);
        evaluate(X.toExponential(2), 'X.$exp2', 1);
        evaluate(Y.toExponential(6), 'Y.$exp6', 1);
        evaluate((+BOOL).toExponential(), 'BOOL.$exp', 1);
        evaluate('NaN', 'S.$exp', 1);
        evaluate((+hex).toExponential(0), 'hex.$exp0', 1);

    });
    it('custom conversions', () => {
        DataFormatterRegistry.add({
            operator: 'by',
            formattedType: 'string',
            formatValue: function (input: number, precision: number) {
                return '' + input + 'x' + precision;
            }
        });
        evaluate('1x3', 'A.$by3', 1);
    });

    it('value change and streaming data handlers for ?: operator', () => {
        B = -400;
        testValueChanged('BOOL? A:B', 'B', B, true);
        A = 376;
        testValueChanged('BOOL? A:B', 'A', A);
        BOOL = false;
        testValueChanged('BOOL? A:B', 'BOOL', BOOL, true);
        testValueChanged('BOOL? A:B', 'A', A, true);
        testValueChanged('BOOL? A:B', 'B', B);
        testValueChanged('BOOL? A:B', 'BOOL', BOOL, true);
    });

/*     it('missing model or binding', () => {
        evaluateError('model.bind', 'Unknown model or binding');
        evaluateError('bind', 'Unknown binding');
    });
 */});