import { expect } from 'chai';

import { GcConsole, IOutputListener, ALL_LEVEL, OFF_LEVEL, WARNING_LEVEL } from '../lib/GcConsole';
import { processArgs } from './TestArgs';

const MODULE_NAME = 'GcConsoleTest';
const console = new GcConsole(MODULE_NAME);

class NullOutputListener implements IOutputListener {
    groupCollapsed(groupText: string, style: string): void { /* do nothing */ }
    groupEnd(): void { /* do nothing */ }
    trace(text: string, style: string): void { /* do nothing */ }
    log(text: string): void { /* do nothing */ }
}
class InstanceOutputListener extends NullOutputListener {};

describe('GcConsoleTest', () => {
    before(() => {
        GcConsole.setOutputListener(new NullOutputListener);
    });

    after(() => {
        GcConsole.setOutputListener(null);
    });

    beforeEach(() => {
        console.setLevel(processArgs.enableLog);
    });

    it('console.log with callback function', () => {
        console.log('testing console.log');
        console.log((int: number, str: string) => {
            expect(int).is.equals(42);
            expect(str).is.equals('abc');
            return 'testing console.log';
        }, 42, 'abc');
    });

    it('console.log instance', () => {
        console.setLevel(OFF_LEVEL); // disable generic console log level so that no all messages will be traced

        let instance1 = 0;
        let instance2 = 0;
        let others = 0;
        const myConsole1 = new GcConsole(MODULE_NAME, 'instance_1');
        const myConsole2 = new GcConsole(MODULE_NAME, 'instance_2');
        myConsole1.setLevel(ALL_LEVEL);
        myConsole2.setLevel(ALL_LEVEL);
        GcConsole.setOutputListener(new class extends InstanceOutputListener {
            log(text: string) {
                if (text.indexOf('instance_1') !== -1) instance1++;
                else if (text.indexOf('instance_2') !== -1) instance2++;
                else others++;
            }
        });
        myConsole1.log('foobar 1');
        myConsole2.log('foobar 2');
        console.log('should not be logged');

        GcConsole.setOutputListener(new NullOutputListener);
        myConsole1.setLevel(OFF_LEVEL);
        myConsole2.setLevel(OFF_LEVEL);

        expect(instance1 + instance2 + others).equals(2);
    });

    it('console.info with callback function', () => {
        console.info('testing console.info');
        console.info((int: number, str: string) => {
            expect(int).is.equals(42);
            expect(str).is.equals('abc');
            return 'testing console.info';
        }, 42, 'abc');
    });

    it('console.error with callback function', () => {
        console.error('testing console.error');
        console.error((int: number, str: string) => {
            expect(int).is.equals(42);
            expect(str).is.equals('abc');
            return 'testing console.error';
        }, 42, 'abc');
    });

    it('console.warning with callback function', () => {
        console.warning('testing console.warning');
        console.warning((int: number, str: string) => {
            expect(int).is.equals(42);
            expect(str).is.equals('abc');
            return 'testing console.warning';
        }, 42, 'abc');
    });

    it('console.debug with callback function', () => {
        console.debug('testing console.debug');
        console.debug((int: number, str: string) => {
            expect(int).is.equals(42);
            expect(str).is.equals('abc');
            return 'testing console.debug';
        }, 42, 'abc');
    });

    it('getLevels/setLevel', () => {
        console.setLevel(WARNING_LEVEL);
        const [level] = GcConsole.getLevels().filter((l: string) => l.startsWith(`^${MODULE_NAME}$`));
        expect(level).is.equals(`^${MODULE_NAME}$=${WARNING_LEVEL} (warnings)`);
    });

    it('console.logAPI', () => {
        console.setLevel(ALL_LEVEL);

        GcConsole.setOutputListener(new class extends InstanceOutputListener {
            log(text: string) {
                expect(text).is.contain('debug: testLogAPI(1,true,string,[1,true,string],{"yes":true},() => {},foo)');
            }
        });
        // eslint-disable-next-line @typescript-eslint/brace-style
        console.logAPI('testLogAPI', 1, true, 'string', [1, true, 'string'], { yes: true }, ()=>{ return true; }, function foo() {});

        GcConsole.setOutputListener(new NullOutputListener);
    });
});