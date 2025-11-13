import '../../gc-core-assets/lib/NodeJSEnv';
import { expect } from 'chai';
import { IListener, Events } from '../../gc-core-assets/lib/Events';
import { IBindFactory, IBindValue, bindValueType, AbstractAsyncBindValue, IValueChangedEvent, valueChangedEventType, Status, ProgressCounter, QUALIFIER, RefreshIntervalBindValue } from '../lib/CoreDatabind';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

GcConsole.setLevel('gc-core-databind', processArgs.enableLog);

describe('AbstractAsyncBindValue', () => {

    const model = new (class TestModel extends Events implements IBindFactory {
        getBinding(): IBindValue {
            throw new Error('Method not implemented.');
        }
        createNewBind(): IBindValue | null {
            throw new Error('Method not implemented.');
        }
        parseQualifier(): { bindName: string; qualifier?: import('../lib/internal/QualifierFactoryMap').IQualifierFactory | undefined; param?: number | undefined } {
            throw new Error('Method not implemented.');
        }
        readonly id = 'dummy';
        isConnected() {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            return globalConnectedState;
        }
        whenConnected() {
            return Promise.resolve();
        }

        parseModelSpecificBindExpression(expression: string): IBindValue | null {
            return null;
        }

        _ignoreWriteOperationsWhenDisconnected = false;
        fireScriptLogEvent() {
        }
    })();

    let globalConnectedState = true;
    interface IWriteResults {
        newValue: bindValueType;
    }
    interface IReadResults extends IWriteResults {
        oldValue: bindValueType;
    }

    class AsyncBindValue extends AbstractAsyncBindValue {
        private counter = 0;
        private readResults: IReadResults[] = [];
        private writeResults: IWriteResults[] = [];
        private changedListenerHandler: IListener<IValueChangedEvent>;

        constructor() {
            super();

            this.addReadResult({ newValue: undefined, oldValue: undefined });
            this.changedListenerHandler = (details: IValueChangedEvent) => {
                this.counter++;
                expect(details.newValue).to.equal(this.getValue());
            };

            this.addEventListener(valueChangedEventType, this.changedListenerHandler);

        }

        protected parentModel = model;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private timer: any;

        readValue(): Promise<bindValueType> {
            return new Promise<bindValueType>((resolve) => {
                expect(this.timer).to.not.exist;
                this.timer = setTimeout(() => {
                    this.timer = undefined;
                    expect(this.readResults.length).to.be.greaterThan(0, 'Unexpected readValue() call.');
                    expect(this.getValue()).to.equal(this.readResults[0].oldValue);
                    const newValue = this.readResults[0].newValue;
                    this.readResults = this.readResults.slice(1);
                    resolve(newValue);
                }, 1);
            });
        }

        writeValue(value: bindValueType): Promise<void> {
            return new Promise<bindValueType>((resolve) => {
                expect(this.timer).to.not.exist;
                this.timer = setTimeout(() => {
                    this.timer = undefined;
                    expect(this.writeResults.length).to.be.greaterThan(0, 'Unexpected writeValue() call');
                    expect(value).to.equal(this.writeResults[0].newValue);
                    this.writeResults = this.writeResults.slice(1);
                    resolve(undefined);
                }, 1);
            });
        }

        addReadResult(expected: IReadResults) {
            this.readResults.push(expected);
        }

        addWriteResult(expected: IWriteResults) {
            this.writeResults.push(expected);
        }

        verifyIdleState(value: bindValueType, notifyCount: number) {
            expect(this.currentState).to.equal('IDLE');
            expect(this.timer).to.not.exist;
            expect(this.readResults.length).to.equal(0);
            expect(this.writeResults.length).to.equal(0);
            expect(this.getValue()).to.equal(value);
            expect(this.counter).to.equal(notifyCount);
            this.counter = 0;
        }

        setCriticalError(message: string) {
            this.reportCriticalError(Status.createErrorStatus(message));
        }

        clearCriticalError() {
            this.reportCriticalError(null);
        }

        isConnected() {
            return this.parentModel.isConnected();
        }

        get currentState() {
            return (this as unknown as InternalState).getState();
        }
    }

    interface InternalState {
        getState(): string;
    }

    const values = ['0x34', -1, undefined];
    const A = 'A';
    const B = 'B';
    const C = 'C';
    const D = 'D';
    const X = 'X';
    let bind: AsyncBindValue;

    beforeEach(async () => {
        bind = new AsyncBindValue();
        await bind.refresh();  // make sure we get past kickstart read operation and end up in idle state.
        bind.verifyIdleState(undefined, 0);
    });

    it('onRefresh', async () => {
        // multiple onRefreshes should never result in more than one read operation.
        for (let i = 0; i < values.length; i++) {
            bind.addReadResult({ oldValue: values[i - 1], newValue: values[i] });
            const progress = new ProgressCounter();
            let refreshPromise: Promise<void>;
            for (let j = i + 1; j-- > 0;) {
                refreshPromise = bind.refresh(progress);
            }
            expect(progress.getProgress()).to.equal(0);
            progress.done();
            expect(progress.getProgress()).to.equal(50);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await refreshPromise!;
            expect(progress.getProgress()).to.equal(100);
            bind.verifyIdleState(values[i], 1);
        }
    });

    it('onIndexChanged', async () => {
        // multiple index changes should result in one or two read operations at most.
        for (let i = 0; i < values.length; i++) {
            for (let j = i + 1; j-- > 0;) {
                bind.onIndexChanged();
            }
            if (i > 0) {
                bind.addReadResult({ newValue: X, oldValue: values[i - 1] });
            }
            bind.addReadResult({ newValue: values[i], oldValue: values[i - 1] });
            await bind.refresh();
            bind.verifyIdleState(values[i], 1);
        }
    });

    it('setValue', async () => {
        // multiple setValue operations should write to the target one or two times (no more) followed by one read operation
        for (let i = 0; i < values.length; i++) {
            let eventCount = 1;
            const progress = new ProgressCounter();
            for (let j = 0; j <= i; j++) {
                bind.setValue(values[j], progress);
                eventCount++;
            }
            progress.done();
            expect(progress.getProgress()).to.equal(100 * (1 + Math.max(i - 1, 0)) / (i + 2));
            bind.addWriteResult({ newValue: values[0] });
            if (i > 0) {
                bind.addWriteResult({ newValue: values[i] });
            }
            bind.addReadResult({ newValue: X, oldValue: values[i] });
            await bind.refresh();
            expect(progress.getProgress()).to.equal(100);
            bind.verifyIdleState(X, eventCount);
        }
    });

    it('updateValue', () => {
        // multiple updateValue operations should not write to the target at all
        for (let i = 0; i < values.length; i++) {
            bind.updateValue(values[i]);
            bind.verifyIdleState(values[i], 1);
            expect(bind.getValueCommitted()).to.equal(values[i]);
        }
    });

    it('setValue during READ', async () => {
        bind.refresh();
        expect(bind.currentState).to.equal('READ');
        bind.addReadResult({ newValue: X, oldValue: A });

        const progress = new ProgressCounter();
        bind.setValue(A, progress);           // 1st notification
        progress.done();
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.addWriteResult({ newValue: A });
        bind.addReadResult({ newValue: X, oldValue: B });

        bind.onIndexChanged();
        expect(bind.currentState).to.equal('DELAYED_WRITE');

        await progress.promise;
        expect(bind.currentState).to.equal('READ');

        bind.setValue(B);                 // 2nd notification
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.addWriteResult({ newValue: B });
        bind.addReadResult({ newValue: B, oldValue: B });

        await bind.refresh();
        bind.verifyIdleState(B, 2);
    });

    it('SetValue during DELAYED_READ', async () => {
        bind.refresh();
        expect(bind.currentState).to.equal('READ');
        bind.addReadResult({ newValue: X, oldValue: A });

        bind.onIndexChanged();
        expect(bind.currentState).to.equal('DELAYED_READ');

        const progress = new ProgressCounter();
        bind.setValue(A, progress);           // 1st notification
        progress.done();
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.addWriteResult({ newValue: A });
        bind.addReadResult({ newValue: X, oldValue: B });

        bind.onIndexChanged();
        expect(bind.currentState).to.equal('DELAYED_WRITE');

        await progress.promise;
        expect(bind.currentState).to.equal('READ');

        bind.onIndexChanged();
        expect(bind.currentState).to.equal('DELAYED_READ');

        bind.setValue(B);                 // 2nd notification
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.addWriteResult({ newValue: B });
        bind.addReadResult({ newValue: B, oldValue: B });

        await bind.refresh();
        bind.verifyIdleState(B, 2);
    });

    it('Deferred Write Mode No Change', async () => {
        bind.setDeferredMode(true);
        bind.refresh();
        expect(bind.currentState).to.equal('READ');
        bind.addReadResult({ newValue: A, oldValue: undefined });
        await bind.refresh();            // fCommittedValue = A, fCachedValue = A
        bind.verifyIdleState(A, 1);

        bind.setDeferredMode(false);
        bind.refresh();
        expect(bind.currentState).to.equal('READ');
        bind.addReadResult({ newValue: B, oldValue: A });
        await bind.refresh();           // fCommittedValue = B, fCachedValue = B
        bind.verifyIdleState(B, 1);

        bind.refresh();
        expect(bind.currentState).to.equal('READ');
        bind.addReadResult({ newValue: X, oldValue: C });

        bind.onIndexChanged();
        expect(bind.currentState).to.equal('DELAYED_READ');

        bind.setDeferredMode(true);
        expect(bind.isDeferredWritePending()).to.be.false;
        bind.setValue(C);               // fCommittedValue = B, fCachedValue = C
        expect(bind.currentState).to.equal('DELAYED_READ');
        expect(bind.isDeferredWritePending()).to.be.true;
        await bind.refresh();
        bind.verifyIdleState(C, 1);

        bind.setValue(B);               // fCommittedValue = B, fCachedValue = B
        bind.verifyIdleState(B, 1);
        bind.setDeferredMode(false);
        bind.verifyIdleState(B, 0);
    });

    it('Deferred Write Mode Delayed Write', async () => {
        bind.setDeferredMode(true);
        bind.refresh();
        expect(bind.currentState).to.equal('READ');
        bind.addReadResult({ newValue: A, oldValue: undefined });
        await bind.refresh();            // fCommittedValue = A, fCachedValue = A
        bind.verifyIdleState(A, 1);

        expect(bind.isDeferredWritePending()).to.be.false;
        bind.setValue(B);               // fCommittedValue = A, fCachedValue = B
        expect(bind.isDeferredWritePending()).to.be.true;
        expect(bind.getValueCommitted()).to.equal(A);
        bind.verifyIdleState(B, 1);

        bind.refresh();
        expect(bind.currentState).to.equal('IDLE');
        bind.onIndexChanged();
        expect(bind.currentState).to.equal('IDLE');

        bind.setValue(C);               // fCommittedValue = A, fCachedValue = C
        expect(bind.getValueCommitted()).to.equal(A);
        bind.verifyIdleState(C, 1);

        bind.setDeferredMode(false);    // fCommittedValue = C, fCachedValue = C
        expect(bind.currentState).to.equal('WRITE');
        bind.addWriteResult({ newValue: C });
        bind.addReadResult({ newValue: C, oldValue: C });
        await bind.refresh();
        bind.verifyIdleState(C, 0);
    });

    it('Deferred Write Mode write through', async () => {
        bind.refresh();
        bind.addReadResult({ newValue: A, oldValue: undefined });
        bind.setDeferredMode(true);
        expect(bind.currentState).to.equal('READ');
        await bind.refresh();            // fCommittedValue = A, fCachedValue = A
        bind.verifyIdleState(A, 1);

        bind.setValue(B);               // fCommittedValue = A, fCachedValue = B
        bind.verifyIdleState(B, 1);
        expect(bind.getValueCommitted()).to.equal(A);

        bind.refresh();
        expect(bind.currentState).to.equal('IDLE');
        bind.setDeferredMode(false);
        bind.setDeferredMode(true);     // fCommittedValue = B, fCachedValue = B
        expect(bind.currentState).to.equal('WRITE');
        bind.addWriteResult({ newValue: B });
        bind.addReadResult({ newValue: A, oldValue: B });
        await bind.refresh();           // fCommittedValue = A, fCachedValue = A
        expect(bind.getValueCommitted()).to.equal(A);
        bind.verifyIdleState(A, 1);

        bind.setDeferredMode(true);     // fCommittedValue = A, fCachedValue = A
        bind.refresh();
        expect(bind.currentState).to.equal('READ');
        bind.setValue(B);               // fCommittedValue = A, fCachedValue = B
        expect(bind.currentState).to.equal('READ');
        bind.setDeferredMode(false);
        bind.setDeferredMode(true);     // fCommittedValue = B, fCachedValue = B
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.addReadResult({ newValue: X, oldValue: B });
        bind.addWriteResult({ newValue: B });
        bind.addReadResult({ newValue: C, oldValue: B });
        bind.setDeferredMode(false);    // fCommittedValue = C, fCachedValue = C
        await bind.refresh();
        expect(bind.getValueCommitted()).to.equal(C);
        bind.verifyIdleState(C, 2);
    });

    it('Deferred Write during DELAYED_WRITE', async () => {
        bind.setValue(A);
        expect(bind.currentState).to.equal('WRITE');
        bind.refresh();
        expect(bind.currentState).to.equal('WRITE');
        bind.setValue(B);
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.onIndexChanged();
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.setValue(C);
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.setDeferredMode(true);
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.setValue(D);
        bind.addWriteResult({ newValue: A });
        bind.addWriteResult({ newValue: C });
        await bind.refresh();
        expect(bind.getValueCommitted()).to.equal(C);
        bind.verifyIdleState(D, 4);
        bind.setDeferredMode(false);
        expect(bind.currentState).to.equal('WRITE');
        bind.addWriteResult({ newValue: D });
        bind.addReadResult({ newValue: A, oldValue: D });
        await bind.refresh();
        expect(bind.getValueCommitted()).to.equal(A);
        bind.verifyIdleState(A, 1);
    });

    it('Read-only Qualifier', async () => {
        bind.setQualifier(QUALIFIER.READONLY);
        bind.refresh();
        expect(bind.currentState).to.equal('READ');
        bind.setValue(A);
        expect(bind.currentState).to.equal('READ');
        bind.onIndexChanged();
        expect(bind.currentState).to.equal('DELAYED_READ');
        bind.addReadResult({ newValue: X, oldValue: undefined });
        bind.addReadResult({ newValue: B, oldValue: undefined });
        await bind.refresh();
        bind.verifyIdleState(B, 1);
    });

    it('Write-only Qualifier', async () => {
        bind.setQualifier(QUALIFIER.WRITEONLY);
        bind.refresh();
        expect(bind.currentState).to.equal('IDLE');
        bind.setValue(A);
        expect(bind.currentState).to.equal('WRITE');
        bind.onIndexChanged();
        expect(bind.currentState).to.equal('WRITE');
        bind.setValue(B);
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.addWriteResult({ newValue: A });
        bind.addWriteResult({ newValue: B });
        await bind.refresh();
        bind.verifyIdleState(B, 2);
    });

    it('Const Qualifier', async () => {
        bind.setQualifier(QUALIFIER.CONST);
        expect(bind.currentState).to.equal('READ');
        bind.addReadResult({ newValue: A, oldValue: undefined });
        await bind.refresh();

        bind.refresh();
        expect(bind.currentState).to.equal('IDLE');
        bind.setValue(B);
        expect(bind.currentState).to.equal('IDLE');
        bind.onIndexChanged();
        expect(bind.currentState).to.equal('IDLE');
        bind.refresh();
        bind.verifyIdleState(A, 1);
    });

    it('Non-volatile Qualifier', async () => {
        bind.setQualifier(QUALIFIER.NONVOLATILE);
        expect(bind.currentState).to.equal('READ');
        bind.addReadResult({ newValue: A, oldValue: undefined });
        await bind.refresh();
        bind.verifyIdleState(A, 1);

        bind.refresh();
        expect(bind.currentState).to.equal('IDLE');

        const progress = new ProgressCounter();
        bind.setValue(B, progress);
        progress.done();
        expect(bind.currentState).to.equal('WRITE');
        bind.addWriteResult({ newValue: B });

        bind.onIndexChanged();
        expect(bind.currentState).to.equal('WRITE');

        bind.setValue(C);
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.addWriteResult({ newValue: C });
        bind.addReadResult({ newValue: D, oldValue: C });

        await progress.promise;
        expect(bind.currentState).to.equal('WRITE');

        bind.refresh();
        expect(bind.currentState).to.equal('WRITE');
        bind.onIndexChanged();
        expect(bind.currentState).to.equal('WRITE');

        await bind.refresh();
        bind.verifyIdleState(D, 3);

        bind.refresh();
        bind.onIndexChanged();
        bind.verifyIdleState(D, 0);
    });

    it('Interrupt Qualifier', async () => {
        bind.setQualifier(QUALIFIER.INTERRUPT);
        expect(bind.currentState).to.equal('READ');
        bind.addReadResult({ newValue: A, oldValue: undefined });
        await bind.refresh();
        bind.verifyIdleState(A, 1);

        bind.refresh();
        bind.setValue(B);
        bind.onIndexChanged();
        bind.verifyIdleState(A, 0);
    });

    it('No-verify Qualifier', async () => {
        bind.setQualifier(QUALIFIER.NOVERIFY);
        expect(bind.currentState).to.equal('IDLE');

        let progress = new ProgressCounter();
        bind.setValue(B, progress);
        expect(bind.currentState).to.equal('WRITE');

        progress.done();
        bind.addWriteResult({ newValue: B });
        await progress.promise;
        expect(progress.getProgress()).to.equal(100);
        bind.verifyIdleState(B, 1);

        progress = new ProgressCounter();
        bind.setValue(C, progress);
        bind.setValue(D, progress);
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.addWriteResult({ newValue: C });
        bind.addWriteResult({ newValue: D });
        progress.done();
        await progress.promise;
        expect(progress.getProgress()).to.equal(100);
        bind.verifyIdleState(D, 2);
    });

    it('Critical Error', async () => {
        bind.refresh();
        expect(bind.currentState).to.equal('READ');
        bind.addReadResult({ newValue: X, oldValue: A });

        bind.setValue(A);
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        expect(bind.status).to.be.null;
        const errMsg = 'failed to read target value';
        bind.setCriticalError(errMsg);
        expect(bind.currentState).to.equal('ERROR_STATE');
        await bind.refresh();
        expect(bind.currentState).to.equal('ERROR_STATE');
        expect(bind.status).to.exist;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(bind.status!.message).to.equal(errMsg);

        bind.refresh();
        expect(bind.currentState).to.equal('ERROR_STATE');
        bind.setValue(B);
        expect(bind.currentState).to.equal('WRITE');
        bind.addWriteResult({ newValue: B });
        bind.addReadResult({ newValue: B, oldValue: B });
        bind.onIndexChanged();
        expect(bind.currentState).to.equal('WRITE');
        bind.clearCriticalError();

        await bind.refresh();
        expect(bind.status).to.be.null;
        bind.verifyIdleState(B, 2);
    });

    it('setRefreshIntervalProvider', async () => {
        const refreshInterval1 = new RefreshIntervalBindValue();
        const refershInterval2 = new RefreshIntervalBindValue();
        bind.setRefreshIntervalProvider(refreshInterval1);
        refreshInterval1.onRefresh();
        expect(bind.currentState).to.equal('READ');
        bind.addReadResult({ newValue: X, oldValue: undefined });
        await bind.refresh();
        bind.verifyIdleState(X, 1);

        bind.setRefreshIntervalProvider(refershInterval2);
        refershInterval2.onRefresh();
        expect(bind.currentState).to.equal('READ');
        bind.addReadResult({ newValue: A, oldValue: X });
        await bind.refresh();
        bind.verifyIdleState(A, 1);

        bind.dispose();
        refreshInterval1.onRefresh();
        refershInterval2.onRefresh();
        bind.verifyIdleState(A, 0);
    });

    it('Ignore Write Operations when disconnected', async () => {
        model._ignoreWriteOperationsWhenDisconnected = true;
        bind.setValue(A);
        expect(bind.currentState).to.equal('WRITE');
        bind.addWriteResult({ newValue: A });
        bind.addReadResult({ newValue: A, oldValue: A });
        await bind.refresh();
        bind.verifyIdleState(A, 1);

        globalConnectedState = false;
        bind.setValue(B);
        expect(bind.currentState).to.equal('IDLE');
        bind.refresh();
        expect(bind.currentState).to.equal('READ');
        bind.setValue(X);
        expect(bind.currentState).to.equal('READ');

        bind.addReadResult({ newValue: A, oldValue: B });

        globalConnectedState = true;
        bind.setValue(B);
        expect(bind.currentState).to.equal('DELAYED_WRITE');
        bind.addWriteResult({ newValue: B });
        bind.addReadResult({ newValue: B, oldValue: B });
        await bind.refresh();
        bind.verifyIdleState(B, 3);
    });
});
