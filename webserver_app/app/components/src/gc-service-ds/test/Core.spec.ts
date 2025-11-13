import '../../gc-core-assets/lib/NodeJSEnv';
import { expect } from 'chai';
import * as path from 'path';
import { processArgs, isMSP430, LAUNCHPADS } from '../../gc-core-assets/test/TestArgs';
import { ServicesRegistry } from '../../gc-core-services/lib/ServicesRegistry';
import { dsServiceType, IDSService, debugCoreType, IDebugCore, targetStateChangedEventType, ITargetStateChangedEvent, IRefreshEvent, refreshEventType, ExpressionResult, Location } from '../lib/DSService';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { GcFiles } from '../../gc-core-assets/lib/GcFiles';
import { IListener } from '../../gc-core-assets/lib/Events';
import { TestResults } from './typdef_results';

/** Enabled Logging *********************************************************************************************************** */
GcConsole.setLevel('gc-service-ds', processArgs.enableLog);
/** *************************************************************************************************************************** */
LAUNCHPADS.forEach( deviceName => {

    describe(`CoreTest for ${deviceName}`, () => {
        const dsService = ServicesRegistry.getService<IDSService>(dsServiceType);
        let ccxml: string;
        let core: IDebugCore;
        let blinkOut: string;
        let blinkBin: string;
        let expressionsOut: string;
        let expectedResults: TestResults;
        const isMsp430 = isMSP430(deviceName);

        before(async function() {
            if (!processArgs.deviceNames.includes(deviceName)) this.skip();
            ccxml = await GcFiles.readTextFile(path.join(__dirname, `../../../test/assets/${deviceName}.ccxml`));
            blinkOut = `../../../test/assets/${deviceName}_xds_blink.out`;
            blinkBin = `../../../test/assets/${deviceName}_xds_blink.bin`;
            expressionsOut = `../../../test/assets/${deviceName}_xds_expressions.out`;
            expectedResults = await GcFiles.readJsonFile(path.join(__dirname, `../../../test/assets/${deviceName}_results.json`)) as TestResults;
        });

        beforeEach(async function() {
            await dsService.configure(ccxml);
            [core] = await dsService.listCores<IDebugCore>(debugCoreType);
        });

        afterEach(async function() {
            await dsService.deConfigure();
        });

        it('getResets', async function() {
            const resets = await core.getResets();
            if (isMsp430) {
                expect(resets.length).gte(2);
                expect(resets).to.include.deep.members([{ type: 'Hard Reset', allowed: false }]);
                expect(resets).to.include.deep.members([{ type: 'Soft Reset', allowed: false }]);
            } else {
                expect(resets).length.gte(3);
                expect(resets).to.include.deep.members([{ type: 'Reset Emulator', allowed: true }]);
            }
        });

        if (!isMsp430) {
            it('reset', async function() {
                await core.reset('Reset Emulator');
            });
        }

        it('connect', async function() {
            await core.connect();
        });

        it('disconnect', async function() {
            await core.connect();
            await core.disconnect();
        });

        it('run', async function() {
            await core.connect();
            await core.run();

            await core.halt();
            await core.run(true);
        });

        it('halt', async function() {
            await core.connect();
            await core.run();
            await core.halt();
        });

        it('loadProgram', async function() {
            const out = await GcFiles.readBinaryFile(path.join(__dirname, blinkOut));
            await core.connect();

            /* load symbols only */
            await core.loadProgram(out, true);

            /* load program */
            await core.loadProgram(out, false);

            /* load program with verify */
            await core.loadProgram(out, false, true);
        });

        if (!isMsp430) {
            it('loadBin', async function() {
                const bin = await GcFiles.readBinaryFile(path.join(__dirname, blinkBin));
                await core.connect();

                /* load bin */
                await core.loadBin(bin, new Location(0));

                /* load bin with verify */
                await core.loadBin(bin, new Location(0), true);
            });
        }

        it('verifyProgram', async function() {
            const out = await GcFiles.readBinaryFile(path.join(__dirname, blinkOut));
            await core.connect();

            /* load program */
            await core.loadProgram(out, false);

            /* verify program */
            await core.verifyProgram(out);
        });

        it('evaluate', async function() {
            const out = await GcFiles.readBinaryFile(path.join(__dirname, expressionsOut));
            await core.connect();
            await core.loadProgram(out, false);
            await core.run();

            if (isMsp430) {
                await core.halt();
            }

            let result: ExpressionResult = await core.evaluate('myStruct');
            expect(result).deep.include({
                arrayInfo: null,
                location: expectedResults.myStruct,
                mayHaveCausedRefresh: false,
                members: [
                    { expression: '(myStruct)._int', name: '_int' },
                    { expression: '(myStruct)._bool', name: '_bool' },
                ],
                type: 'struct MYSTRUCT',
                value: '{...}'
            });

            result = await core.evaluate('_charArray');
            expect(result).deep.include({
                arrayInfo: {
                    elementType: 'unsigned char',
                    expression: '_charArray',
                    size: 16
                },
                location: expectedResults._charArray,
                mayHaveCausedRefresh: false,
                members: [],
                type: 'unsigned char[16]',
                value: expectedResults._charArray
            });

            result = await core.evaluate('_charPtr');
            expect(result).deep.include({
                arrayInfo: null,
                location: expectedResults._charPtr,
                mayHaveCausedRefresh: false,
                members: [],
                type: 'unsigned char *',
                value: expectedResults._charPtr_value
            });

            result = await core.evaluate('_int');
            expect(result).deep.include({
                arrayInfo: null,
                location: expectedResults._int,
                mayHaveCausedRefresh: false,
                members: [],
                type: 'int',
                value: isMsp430 ? '1' : '-2147483647'
            });

            result = await core.evaluate('_bool');
            expect(result).deep.include({
                arrayInfo: null,
                location: expectedResults._bool,
                mayHaveCausedRefresh: false,
                members: [],
                type: 'unsigned char',
                value: '1'
            });
        });

        it('readValue', async function() {
            const out = await GcFiles.readBinaryFile(path.join(__dirname, expressionsOut));
            await core.connect();
            await core.loadProgram(out, false);
            await core.run();

            if (isMsp430) {
                await core.halt();
            }

            const myStruct = await core.readValue('myStruct');
            expect(myStruct).include({
                _int: 42,
                _bool: 1
            });

            const myEnum = await core.readValue('myEnum');
            expect(myEnum).is.eq(2);

            const _bool = await core.readValue('_bool');
            expect(_bool).is.eq(1);

            const _float = await core.readValue('_float');
            expect(_float).is.eq(3.14159274);

            const _double = await core.readValue('_double');
            expect(_double).is.eq(isMsp430 ? 3.14159274 : 3.1415926540000001);

            const _charArray = await core.readValue('_charArray');
            expect(_charArray).to.have.ordered.members([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 0, 0, 0, 0]);

            const _charPtr = await core.readValue('_charPtr');
            expect(_charPtr).is.eq('Hello World!');

            const _2DIntArray = await core.readValue('_2DIntArray');
            expect(_2DIntArray).is.eql([[10, 11, 12, 13], [14, 15, 16, 17]]);

            const _2DStructArray = await core.readValue('_2DStructArray');
            expect(_2DStructArray).is.eql([{ _int: 1, _bool: 1 }, { _int: 2, _bool: 0 }]);

            const _short = await core.readValue('_short');
            expect(_short).is.eq(-32767);
            const _unsignedShort = await core.readValue('_unsigned_short');
            expect(_unsignedShort).is.eq(65535);

            const _int = await core.readValue('_int');
            expect(_int).is.eq(isMsp430 ? 1 : -2147483647);
            const _unsignedInt = await core.readValue('_unsigned_int');
            expect(_unsignedInt).is.eq(isMsp430 ? 65535 : 4294967295);

            const _long = await core.readValue('_long');
            expect(_long).is.eq(-2147483647);
            const _unsignedLong = await core.readValue('_unsigned_long');
            expect(_unsignedLong).is.eq(4294967295);
        });


        it('writeValue', async function() {
            const out = await GcFiles.readBinaryFile(path.join(__dirname, expressionsOut));
            await core.connect();
            await core.loadProgram(out, false);
            await core.run();

            if (isMsp430) {
                await core.halt();
            }

            await core.writeValue('_charArray', [42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 0]);
            const _charArray = await core.readValue('_charArray');
            expect(_charArray).is.to.have.members([42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 0]);

            await core.writeValue('_charArray', 'Hello World2!');
            const _charPtr = await core.readValue('_charPtr');
            expect(_charPtr).is.eq('Hello World2!');

            await core.writeValue('_int', 42);
            const _int = await core.readValue('_int');
            expect(_int).is.eq(42);

            await core.writeValue('myStruct', { _int: 1, _bool: 0 });
            const myStruct = await core.readValue('myStruct');
            expect(myStruct).include({
                _int: 1,
                _bool: 0
            });
        });

        it('readMemory', async function() {
            const out = await GcFiles.readBinaryFile(path.join(__dirname, expressionsOut));
            await core.connect();
            await core.loadProgram(out, false);
            await core.run();

            if (isMsp430) {
                await core.halt();
            }

            const addr = (await core.evaluate('&_charArray')).value;
            const array = await core.readMemory(new Location(addr), 'char', 16);
            expect(array.toString()).is.eq('72,101,108,108,111,32,87,111,114,108,100,33,0,0,0,0');
        });


        it('writeMemory', async function() {
            const out = await GcFiles.readBinaryFile(path.join(__dirname, expressionsOut));
            await core.connect();
            await core.loadProgram(out, false);
            await core.run();

            if (isMsp430) {
                await core.halt();
            }

            const addr = (await core.evaluate('&_charArray')).value;
            await core.writeMemory(new Location(addr), 8, Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]));
            const array = await core.readMemory(new Location(addr), 'char', 16);
            expect(array.toString()).is.eq('1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16');
        });

        it('refreshEvent', async function() {
            let received = 0;
            const [core] = await dsService.listCores<IDebugCore>(debugCoreType);
            const listener: IListener<IRefreshEvent> = ( detail: IRefreshEvent ) => {
                core.removeEventListener(refreshEventType, listener);
                received++;
            };
            core.addEventListener(refreshEventType, listener);

            await core.connect();
            expect(received).equal(1);
        });

        it('targetStateChangedEvent', async function() {
            let received = 0;
            const listener: IListener<ITargetStateChangedEvent> = ( detail: ITargetStateChangedEvent ) => {
                core.removeEventListener(targetStateChangedEventType, listener);
                received++;
            };
            core.addEventListener(targetStateChangedEventType, listener);

            await core.connect();
            expect(received).equal(1);
        });
    });
});