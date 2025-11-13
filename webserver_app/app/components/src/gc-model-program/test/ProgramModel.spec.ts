import '../../gc-core-assets/lib/NodeJSEnv';
import { expect } from 'chai';
import { INoopDecoder, codecRegistry } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ProgramModelEncoderType, ProgramModel, IProgramModelEncoder, ProgramModelDecoderType } from '../lib/ProgramModel';
import { GcPromise, IDeferedPromise } from '../../gc-core-assets/lib/GcPromise';
import { IListener, Events } from '../../gc-core-assets/lib/Events';
import { bindValueType, IBindValue, bindingRegistry, valueChangedEventType, IStaleEvent, staleChangedEventType, ProgressCounter, AbstractAsyncBindValue, RefreshIntervalBindValue } from '../../gc-core-databind/lib/CoreDatabind';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

GcConsole.setLevel('gc-model-program', processArgs.enableLog);

describe('ProgramModel', () => {

    class DSCodecStub extends Events implements IProgramModelEncoder {
        encoderInputType = ProgramModelEncoderType;
        encoderOutputType = ProgramModelDecoderType;
        readonly id = 'xds';
        data: bindValueType = [];

        constructor() {
            super();
            codecRegistry.register(this);
        }

        addChildDecoder(child: INoopDecoder): void {
        }
        deconfigure(): void {
        }

        async readValue(info: string) {
            await GcUtils.delay(10);
            return this.data[info];
        }

        async writeValue(info: string, value: bindValueType) {
            this.data[info] = +value;
        }

        async initCore() {
        }

        dispose() {
            codecRegistry.unregister(this);
        }
    }

    let listenerPromise: IDeferedPromise<void> | undefined;
    let dsStub: DSCodecStub;
    let programModel: ProgramModel;
    let bind: IBindValue;
    const X = 'x';
    const nullListener = () => {};

    before(() => {
        bindingRegistry.dispose();

        dsStub = new DSCodecStub();
        programModel = new ProgramModel({ id: 'pm' });
        bindingRegistry.defaultModel = 'pm';

        bind = bindingRegistry.getBinding(X) as IBindValue;
        bind.addEventListener(valueChangedEventType, () => {
            if (listenerPromise) {
                listenerPromise.resolve();
            }
        });
    });

    after(() => {
        dsStub.dispose();

        bindingRegistry.dispose();
    });

    beforeEach( () => {
        listenerPromise = undefined;
    });

    it('configure', () => {
        expect(() => {
            codecRegistry.configure('xds+pm');
        }).to.not.throw();
        expect(codecRegistry.isActive('pm')).to.be.true;
        expect(codecRegistry.isActive('xds')).to.be.true;
    });

    it('refresh_interval', () => {
        const refreshBind = bindingRegistry.getBinding('$refresh_interval');
        expect(refreshBind).to.exist;
        refreshBind!.setValue(500);

        expect(refreshBind!.getValue()).to.equal(500);
    });

    it('isStale', async () => {
        const value = 56;
        dsStub.data[X] = value;
        expect(bind.isStale()).to.be.true;
        expect(bind.getValue()).to.be.undefined;
        expect(programModel.isConnected()).to.be.false;

        let staleListener: IListener<IStaleEvent> = nullListener;

        await GcPromise.timeout(new Promise<void>( (resolve) => {
            staleListener = () => {
                resolve();
            };
            bind.addEventListener(staleChangedEventType, staleListener);

            // this should trigger the first read, and cause stale to be false.
            programModel.onConnect({});
        }), 75, 'timeout waiting for stale changed event');

        expect(bind.isStale()).to.be.false;
        expect(bind.getValue()).to.equal(value);

        bind.removeEventListener(staleChangedEventType, staleListener);
    });

    it('changeNotification', async () => {
        const newValue = 'ok';
        listenerPromise = GcPromise.defer<void>();

        expect(bind.getValue()).to.equal(56);
        dsStub.data[X] = newValue;

        // wait for change event (500ms refresh intervale);
        await GcPromise.timeout(listenerPromise.promise, 600, 'Timeout on waiting for value change event');

        expect(bind.getValue()).to.equal(newValue);
    });

    it('setValue', async () => {
        let callback = false;
        const progress = new ProgressCounter(function() {
            // finished operation
            callback = true;
        });
        const newValue = -1256;
        bind.setValue(newValue, progress);
        expect(callback).to.be.false;
        progress.done();
        await progress.promise;
        expect(callback).to.be.true;
        expect(dsStub.data[X]).to.equal(newValue);
    });

    it('setRefreshIntervalProvider', async () => {
        // getting a binding should trigger readValue event to retrieve the current value.
        const value = -56;
        const newValue = 0;
        dsStub.data['Y'] = value;
        const bind = bindingRegistry.getBinding('Y');
        expect(bind).to.be.instanceof(AbstractAsyncBindValue);
        bind!.addEventListener(valueChangedEventType, nullListener);

        // changing the refresh interval should cause an immediate refresh event, but since a read is outstanding it will be ignored.
        const customRefresh = bindingRegistry.getBinding('pm.$refresh_interval.custom');
        expect(customRefresh).to.exist;
        customRefresh!.setValue(100);
        expect(customRefresh).to.be.instanceof(RefreshIntervalBindValue);
        (bind as AbstractAsyncBindValue).setRefreshIntervalProvider(customRefresh as RefreshIntervalBindValue);

        expect(bind!.isStale()).to.be.true;
        expect(bind!.getValue()).to.be.undefined;

        await GcUtils.delay(50);  // wait for first value to be written

        dsStub.data['Y'] = newValue;
        expect(bind!.isStale()).to.be.false;
        expect(bind!.getValue()).to.equal(value);

        await GcUtils.delay(100);  // wait for second polling read to compolete.
        expect(bind!.getValue()).to.equal(newValue);

        bind!.removeEventListener(valueChangedEventType, nullListener);
    });

    it('setActiveContext', async () => {

        listenerPromise = GcPromise.defer<void>();

        const contextBinding = bindingRegistry.getBinding('pm.$active_context_name');
        expect(contextBinding).to.exist;
        let newValue = -123;
        dsStub.data[X] = newValue;
        contextBinding!.setValue('oldContext');
        await GcPromise.timeout(listenerPromise.promise, 50, 'Timeout waiting for active context value change event');
        expect(bind.getValue()).to.equal(newValue);

        newValue = 40988;
        dsStub.data[X] = newValue;
        listenerPromise = GcPromise.defer<void>();
        contextBinding!.setValue('newContext');
        await GcPromise.timeout(listenerPromise.promise, 50, 'Timeout waiting for active context value change event');
        expect(bind.getValue()).to.equal(newValue);
    });
});

