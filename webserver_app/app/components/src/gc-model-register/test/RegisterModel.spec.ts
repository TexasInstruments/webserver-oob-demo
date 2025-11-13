import '../../gc-core-assets/lib/NodeJSEnv';
import { expect } from 'chai';
import { IRegisterModelEncoder, IRegisterModelDecoder, RegisterModelEncoderType, RegisterModelDecoderType, RegisterModel } from '../lib/RegisterModel';
import { IRegisterInfo, IRegisterJsonData } from '../lib/IRegisterInfo';
import { GcPromise, IDeferedPromise } from '../../gc-core-assets/lib/GcPromise';
import { codecRegistry, AbstractTransport } from '../../gc-target-configuration/lib/TargetConfiguration';
import { IBindFactory, ConstantBindValue, IStatusEvent, IStatus, IScriptLogEvent, IRefreshableBindValue, IDisposable, IRefreshIntervalProvider, statusChangedEventType, scriptLogEventType, Status, IBindValue, IValueChangedEvent, IStreamingDataEvent, valueChangedEventType, streamingDataEventType, bindingRegistry } from '../../gc-core-databind/lib/CoreDatabind';
import { isArray } from 'util';
import { Events } from '../../gc-core-assets/lib/Events';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { processArgs } from '../../gc-core-assets/test/TestArgs';

GcConsole.setLevel('gc-model-register', processArgs.enableLog);

describe('RegisterModel', () => {

    function getBinding(model: IBindFactory, uri: string): IBindValue {
        return model.getBinding(uri) || new ConstantBindValue();
    }

    class TestCodec extends Events implements IRegisterModelEncoder {
        private entity?: IRegisterInfo;
        coreIndex?: number;
        value?: number;
        private model?: IRegisterModelDecoder;
        private commandMap = new Map<number, IDeferedPromise<number | Array<number>>>();
        encoderInputType = RegisterModelEncoderType;
        encoderOutputType = RegisterModelDecoderType;
        readonly id = 'test';

        constructor() {
            super();

            codecRegistry.register(this);
        }

        addChildDecoder(decoder: IRegisterModelDecoder) {
            this.model = decoder;
        }

        deconfigure() {
            this.model = undefined;
        }

        addCommand(id: number) {
            const defer = GcPromise.defer<number | Array<number>>();
            this.commandMap.set(id, defer);
            return defer.promise;
        }

        addResponse(value: number | number[], id: number) {
            const defer = this.commandMap.get(id);
            if (defer) {
                this.commandMap.delete(id);

                defer.resolve(value);
            } else {
                throw `Missing Command for reading 0x${value.toString(16)} from address ${id}`;
            }
        }

        addErrorResponse(message: string, id: number) {
            const defer = this.commandMap.get(id);
            if (defer) {
                this.commandMap.delete(id);

                defer.reject(message);
            } else {
                throw `Missing Command for address ${id}`;
            }
        }

        readValue(entity: IRegisterInfo, coreIndex?: number) {

            // handle register reads
            this.entity = entity;
            this.coreIndex = coreIndex;
            const countBind = getBinding(this.model!, '$packetCount');
            countBind.updateValue(countBind.getValue() + 1);

            return this.addCommand(entity.addr).finally(function () {
                countBind.updateValue(countBind.getValue() - 1);
            });
        }

        writeValue(entity: IRegisterInfo, value: number, coreIndex: number) {
            this.entity = entity;
            this.coreIndex = coreIndex;
            this.value = value;

            return Promise.resolve();
        }
        dispose() {
            codecRegistry.unregister(this);
        }
    }

    let codec: TestCodec;
    before(function() {
        codec = new TestCodec();
    });

    after(() => {
        codec.dispose();
        bindingRegistry.dispose();
    });

    class ChangeListener {
        didValueChange = false;
        didReceiveData = false;
        didStatusChange = false;
        newValue = 0;
        dataReceived = 0;
        newMessage = '';

        onValueChanged = (details: IValueChangedEvent) => {
            this.didValueChange = true;
            this.newValue = details.newValue;
        };

        verifyValueChangedTo(newValue: number | number[]) {
            expect(this.didValueChange, `value change to ${newValue}`).to.be.true;
            if (isArray(newValue)) {
                expect(this.newValue).to.deep.equal(newValue);
            } else {
                expect(this.newValue).to.equal(newValue);
            }
            this.didValueChange = false;
        }

        onDataReceived = (details: IStreamingDataEvent) => {
            this.didReceiveData = true;
            this.dataReceived = details.data;
        };

        verifyDataReceivedWas(newData: number) {
            expect(this.didReceiveData).to.be.true;
            expect(this.dataReceived).to.equal(newData);
            this.didReceiveData = false;
        }

        onStatusChanged = (details: IStatusEvent) => {
            this.didStatusChange = true;
            this.newMessage = details.newStatus ? details.newStatus.message : '';
        };

        verifyStatusChangedTo(newStatus: IStatus | string) {
            const message = (newStatus && (newStatus as IStatus).message) ? (newStatus as IStatus).message : (newStatus || '');
            expect(this.didStatusChange).to.be.true;
            expect(this.newMessage).to.equal(message);
            this.didStatusChange = false;
        }
    }

    let scriptingData: IScriptLogEvent | undefined = undefined;

    function scriptingListener(details: IScriptLogEvent) {
        scriptingData = details;
    }

    function createRegisterJsonData(addr1: number | string = '0x00', start: number | string = 8, addr2: number | string = 0x3, enableCalculated = true) {
        const regJsonInfo: IRegisterJsonData = {
            info: {
                name: 'test'
            },
            calculatedBindings: enableCalculated ? {
                _calc: 'reg.field + reg.field3'
            } : undefined,
            regblocks: [
                {
                    name: 'all',
                    registers: [
                        {
                            name: 'reg',
                            size: 16,
                            addr: addr1,
                            fields: [
                                {
                                    start: '0',
                                    stop: '3',
                                    name: 'field'
                                },
                                {
                                    start: start,
                                    stop: '8',
                                    name: 'field2'
                                },
                                {
                                    start: 12,
                                    stop: 15,
                                    name: 'field3'
                                },
                                {
                                    start: 0x9,
                                    stop: 0xb,
                                    name: 'spinner',
                                    getter: 'this*0.016+3.504',
                                    widget: {
                                        type: 'spinner',
                                        min: 3.504,
                                        max: 3.616,
                                        step: 0.016
                                    }
                                }]
                        },
                        {
                            name: 'reg2',
                            size: 64,
                            default: -1234,
                            addr: addr2,
                            fields: [
                                {
                                    stop: 31,
                                    name: 'field',
                                    type: 'int'
                                }]
                        }]
                }]
        };
        return regJsonInfo;
    }

    let regBind: IRefreshableBindValue;
    let regFieldBind: IBindValue;
    let reg2Bind: IRefreshableBindValue;
    let reg2FieldBind: IBindValue & IDisposable;
    let regField2Bind: IBindValue;
    let regField3Bind: IBindValue;
    let listener: ChangeListener;
    let bind: IBindValue;
    let calcBind: IBindValue;
    let packetCount: IBindValue;
    let model: RegisterModel;
    let refreshBind: IRefreshIntervalProvider;
    let isMultiCore = false;

    // The following test cases must pass for both multi-core and single core cases.
    const modes = [ '', ': multi-core' ];
    for (let i = 0; i < modes.length; i++) {

        const mode = modes[i];  // mode is blank (false) for single core, and non-blank (true) for multi-core.

        it('configure' + mode, () => {
            model = new RegisterModel({ id: 'reg', isDeviceArray: isMultiCore });
            refreshBind = getBinding(model, '$refresh_interval') as IRefreshIntervalProvider;
            refreshBind.setValue(-1);  // use manual refresh for testing.
            isMultiCore = true;  // setup for second pass where isDeviceArray === true;

            packetCount = getBinding(model, '$packetCount');
            packetCount.setValue(0);

            codecRegistry.register(model);

            expect(() => {
                codecRegistry.configure('test+reg');
            }).to.not.throw();
            expect(codecRegistry.isActive('test')).to.be.true;
            expect(codecRegistry.isActive('reg')).to.be.true;
        });


        it('Bad URI' + mode, () => {
            bind = getBinding(model, 'invalid@character');
            expect(bind.status).to.exist;
            bind = getBinding(model, '$cores.active');
            expect(bind.status).to.exist;
            bind = getBinding(model, '$cores.all.reg');
            expect(bind.status).to.exist;
            bind = getBinding(model, '$cores.0.reg.field');
            expect(bind.status).to.exist;
        });

        it('Bad Symbol Name' + mode, () => {
            regFieldBind = getBinding(model, 'reg.field');
            expect(regFieldBind.status).to.exist;
            regBind = getBinding(model, 'reg') as IRefreshableBindValue;
            expect(regBind.status).to.exist;
        });

        it('Stale bindings' + mode, async () => {
            await model.onConnect(new (class extends AbstractTransport {
                id = 'tx';
                params = {};
                protected console = new GcConsole('tx');
            })());
            await GcUtils.delay(1);

            expect(regBind.status).to.exist;

            model.setSymbols(createRegisterJsonData());
            expect(regBind.status).to.be.null;
            expect(regBind.isStale()).to.be.true;
            expect(regFieldBind.isStale()).to.be.true;

            reg2Bind = getBinding(model, 'reg2') as IRefreshableBindValue;
            expect(reg2Bind.status).to.be.null;
            expect(reg2Bind.isStale()).to.be.false;

            reg2FieldBind = getBinding(model, 'reg2.field') as IBindValue & IDisposable;
            expect(reg2Bind.isStale()).to.be.false;
            expect(reg2FieldBind.getValue()).to.equal(-1234);
        });

        it('Read Value' + mode, async () => {
            listener = new ChangeListener();
            reg2FieldBind = getBinding(model, 'reg2.field') as IBindValue & IDisposable;
            reg2FieldBind.addEventListener(statusChangedEventType, listener.onStatusChanged);
            reg2FieldBind.addEventListener(valueChangedEventType, listener.onValueChanged);
            reg2FieldBind.addEventListener(streamingDataEventType, listener.onDataReceived);
            codec.addResponse(0xbabe, 0);
            await GcUtils.delay(1);
            expect(listener.didStatusChange).to.be.false;
            expect(listener.didValueChange).to.be.false;
            expect(listener.didReceiveData).to.be.false;
            expect(regBind.getValue()).to.equal(0xbabe);
            expect(regFieldBind.getValue()).to.equal(0xe);
            regField2Bind = getBinding(model, 'reg.field2');
            expect(regField2Bind.getValue()).to.equal(0);
            regField3Bind = getBinding(model, 'reg.field3');
            expect(regField3Bind.getValue()).to.equal(0xb);
            codec.addResponse(0xFFFF00, 0x3);
            await GcUtils.delay(1);
            expect(listener.didStatusChange).to.be.false;
            listener.verifyValueChangedTo(0xFFFF00);
            listener.verifyDataReceivedWas(0xFFFF00);
            expect(reg2FieldBind.getValue()).to.equal(0xFFFF00);
        });

        it('Getter' + mode, async() => {
            expect(regBind.getValue()).to.equal(0xbabe);
            expect(getBinding(model, 'reg.spinner').getValue()).to.equal(3.584);
            expect(model.hasBinding('this')).to.be.false;
        });

        it('Calculated Bindings' + mode, () => {
            calcBind = getBinding(model, '_calc');
            expect(calcBind.getValue()).to.equal(0xb+0xe);
        });

        it('Change symbols' + mode, async () => {
            expect(listener.didValueChange).to.be.false;
            expect(listener.didReceiveData).to.be.false;

            model.setSymbols(createRegisterJsonData(1, 7, 4, false));

            listener.verifyValueChangedTo(-1234);
            expect(listener.didReceiveData).to.be.false;
            expect(calcBind.status).to.exist;
            expect(regBind.status).to.be.null;
            expect(regBind.isStale()).to.be.true;
            expect(regFieldBind.isStale()).to.be.true;
            expect(reg2Bind.status).to.be.null;
            expect(reg2Bind.isStale()).to.be.false;
            expect(reg2FieldBind.isStale()).to.be.false;
            expect(reg2FieldBind.getValue()).to.equal(-1234);
            packetCount = getBinding(model, '$packetCount');
            expect(packetCount.getValue()).to.equal(0);
            let done = false;
            refreshBind.onRefresh().then( () => {
                done = true;
            });
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(2);
            codec.addResponse(1234, 4);
            expect(done).to.be.false;
            codec.addResponse(0xface, 1);
            await GcUtils.delay(1);
            expect(done).to.be.true;
            listener.verifyValueChangedTo(1234);
            listener.verifyDataReceivedWas(1234);
            expect(packetCount.getValue()).to.equal(0);
            expect(regBind.status).to.be.null;
            expect(regBind.isStale()).to.be.false;
            expect(regBind.getValue()).to.equal(0xface);
            expect(regField2Bind.isStale()).to.be.false;
            expect(regField2Bind.getValue()).to.equal(1);
            expect(reg2FieldBind.getValue()).to.equal(1234);
        });

        it('Write Value' + mode, async () => {
            const newValue = -0x45410532;
            expect(listener.didValueChange).to.be.false;
            expect(listener.didReceiveData).to.be.false;
            reg2FieldBind.setValue(newValue);
            await GcUtils.delay(1);
            listener.verifyValueChangedTo(newValue);
            expect(listener.didReceiveData).to.be.false;
            expect(packetCount.getValue()).to.equal(1);
            expect(codec.value).to.equal(0xbabeface);
            codec.addResponse(newValue, 0x4);
            await GcUtils.delay(1);
            expect(listener.didValueChange).to.be.false;
            listener.verifyDataReceivedWas(newValue);
            expect(packetCount.getValue()).to.equal(0);
            expect(listener.didStatusChange).to.be.false;
            reg2FieldBind.setValue(newValue);
            await GcUtils.delay(1);
            expect(codec.value).to.equal(0xbabeface);
            expect(listener.didValueChange).to.be.false;
            expect(listener.didReceiveData).to.be.false;
            expect(packetCount.getValue()).to.equal(0);
        });

        it('setter' + mode, async() => {
            const newValue = 0xf2ce;
            expect(regBind.getValue()).to.equal(0xface);
            getBinding(model, 'reg.spinner').setValue(3.52);
            expect(regBind.getValue()).to.equal(newValue);
            await GcUtils.delay(1);
            expect(codec.value).to.equal(newValue);
            codec.addResponse(newValue, 0x1);
        });

        it('Streaming Data' + mode, async () => {
            const newValue = -0x45410532;
            reg2Bind.refresh();
            expect(packetCount.getValue()).to.equal(1);
            codec.addResponse(newValue, 0x4);
            await GcUtils.delay(1);
            expect(listener.didValueChange).to.be.false;
            listener.verifyDataReceivedWas(newValue);
            expect(packetCount.getValue()).to.equal(0);
            expect(listener.didStatusChange).to.be.false;
        });

        it('Deferred Write' + mode, async () => {
            regBind.setDeferredMode(true);
            expect(regBind.isDeferredWritePending()).to.be.false;
            regBind.setValue(regBind.getValue());
            expect(regBind.isDeferredWritePending()).to.be.false;
            (regBind as IRefreshableBindValue).refresh();
            expect(regBind.isDeferredWritePending()).to.be.false;
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(1);
            codec.addResponse(0xdead, 1);
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(0);
            expect(regBind.isDeferredWritePending()).to.be.false;
            regField2Bind.setValue(3);
            expect(regBind.isDeferredWritePending()).to.be.true;
            regBind.setValue(0xdead);
            expect(regBind.isDeferredWritePending()).to.be.false;
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(0);
            regBind.setDeferredMode(false, undefined, true);  // force write of same value
            regBind.setDeferredMode(true);
            expect(codec.coreIndex).to.equal(0);
            expect(codec.value).to.equal(0xdead);
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(1);
            codec.addResponse(0xbeef, 1);
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(0);
            expect(regBind.getValue()).to.equal(0xbeef);
            expect(regBind.isDeferredWritePending()).to.be.false;
            regBind.setValue(123);
            expect(regBind.isDeferredWritePending()).to.be.true;
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(0);
            regBind.setDeferredMode(false);
            expect(regBind.isDeferredWritePending()).to.be.false;
            await GcUtils.delay(1);
            expect(codec.coreIndex).to.equal(0);
            expect(codec.value).to.equal(123);
            expect(packetCount.getValue()).to.equal(1);
            codec.addResponse(123, 1);
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(0);
        });

        it('Clear Deferred Write' + mode, async () => {
            regBind.setDeferredMode(true);
            expect(regBind.isDeferredWritePending()).to.be.false;
            regBind.setValue(0x1234);
            expect(regBind.isDeferredWritePending()).to.be.true;
            regBind.setValue(123);
            expect(regBind.isDeferredWritePending()).to.be.false;
            regBind.setDeferredMode(false);
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(0);
            expect(regBind.isDeferredWritePending()).to.be.false;
        });

        it('Cancel Deferred Write' + mode, async () => {
            regBind.addEventListener(valueChangedEventType, listener.onValueChanged);
            regBind.addEventListener(streamingDataEventType, listener.onDataReceived);
            regBind.setDeferredMode(true);
            expect(regBind.isDeferredWritePending()).to.be.false;
            regBind.setValue(0x1234);
            expect(regBind.isDeferredWritePending()).to.be.true;
            listener.verifyValueChangedTo(0x1234);
            expect(listener.didReceiveData).to.be.false;
            regBind.clearDeferredWrite();
            expect(regBind.isDeferredWritePending()).to.be.false;
            listener.verifyValueChangedTo(123);
            expect(listener.didReceiveData).to.be.false;
            regBind.setDeferredMode(false);
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(0);
            expect(regBind.isDeferredWritePending()).to.be.false;
            regBind.removeEventListener(valueChangedEventType, listener.onValueChanged);
            regBind.removeEventListener(streamingDataEventType, listener.onDataReceived);
        });

        it('refresh count' + mode, async () => {
            let refreshCount = 0;
            refreshBind.onRefresh().then( (totalJobs) => {
                refreshCount = totalJobs;
            });
            await GcUtils.delay(1);
            expect(refreshCount).to.be.equal(0);
            expect(packetCount.getValue()).to.equal(2);
            codec.addResponse(reg2Bind.getValue(), 4);
            codec.addResponse(regBind.getValue(), 1);
            await GcUtils.delay(1);
            expect(refreshCount).to.be.equal(2);
            expect(packetCount.getValue()).to.equal(0);
        });

        it('Logging to Script' + mode, async () => {
            model.addEventListener(scriptLogEventType, scriptingListener);
            regBind.refreshAndLog();
            expect(scriptingData).to.exist;
            expect(scriptingData!.command).to.equal('read');
            expect(scriptingData!.name).to.equal('reg');
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(1);
            regBind.setValue(regBind.getValue(), undefined, true); // force a write to log a script operation.
            expect(scriptingData).to.exist;
            expect(scriptingData!.command).to.equal('write');
            expect(scriptingData!.name).to.equal('reg');
            expect(scriptingData!.value).to.equal(regBind.getValue());
            expect(packetCount.getValue()).to.equal(1);
            codec.addResponse(regBind.getValue(), 1);
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(1);
            codec.addResponse(regBind.getValue(), 1);
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(0);
        });

        it('Executing Script' + mode, async () => {
            const activeCore = getBinding(model, '$selectedCore');
            activeCore.setValue(0);
            model.scriptRead('reg').then(function() {
                model.scriptWrite('reg', 123);
            });
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(1);
            expect(codec.coreIndex).to.equal(0);
            codec.addResponse(regBind.getValue(), 1);
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(1);
            expect(codec.coreIndex).to.equal(0);
            expect(codec.value).to.equal(regBind.getValue());
            codec.addResponse(regBind.getValue(), 1);
            await GcUtils.delay(1);
            expect(packetCount.getValue()).to.equal(0);
        });

        it('Register Attrs' + mode, async function() {
            try {
                const qualifiers = ['noverify', 'nonvolatile', 'nonvolatile noverify', 'readonly', 'readonly nonvolatile', 'writeonly'];
                for (let i = 0; i < qualifiers.length; i++) {
                    const qualifier = qualifiers[i];
                    const writable = !qualifier.includes('readonly');
                    const readable = !qualifier.includes('writeonly');
                    const volatile = !qualifier.includes('nonvolatile');
                    const readBack = !qualifier.includes('noverify');
                    model.setSymbols({
                        info: {
                            name: 'device'
                        },
                        regblocks: [{
                            name: 'core',
                            registers: [{
                                name: 'main',
                                size: 16,
                                addr: 50+i,
                                attrs: {
                                    readonly: qualifier.includes('readonly'),
                                    writeonly: qualifier.includes('writeonly'),
                                    nonvolatile: qualifier.includes('nonvolatile'),
                                    noverify: qualifier.includes('noverify'),
                                }
                            }]
                        }]
                    });
                    const listener = new ChangeListener();
                    const bind = getBinding(model, 'main');
                    bind.addEventListener(statusChangedEventType, listener.onStatusChanged);
                    bind.addEventListener(valueChangedEventType, listener.onValueChanged);
                    try {
                        if (readable) {
                            codec.addResponse(0x1230 + i, 50 + i);
                            await GcUtils.delay(1);
                            expect(listener.didStatusChange, `status changed for ${qualifier}`).to.be.false;
                            expect(listener.didValueChange, `value changed for ${qualifier}`).to.be.true;
                            listener.verifyValueChangedTo(0x1230 + i);
                        } else {
                            expect(listener.didStatusChange, `status changed for ${qualifier}`).to.be.false;
                            expect(listener.didValueChange, `value changed for ${qualifier}`).to.be.false;
                        }

                        bind.setValue(0x4320 + i);
                        await GcUtils.delay(1);
                        if (writable) {
                            expect(codec.value).to.equal(0x4320 + i);
                        } else {
                            expect(codec.value).to.not.equal(0x4320 + i);
                        }
                        if (writable) {
                            listener.verifyValueChangedTo(0x4320 + i);
                        } else {
                            expect(listener.didValueChange, `did value change for ${qualifier}`).to.be.false;
                        }

                        if (readBack && readable && writable) {
                            codec.addResponse(0x8340 + i, 50 + 1);
                            await GcUtils.delay(1);
                            expect(listener.didStatusChange, `status changed for ${qualifier} during read back`).to.be.false;
                            listener.verifyValueChangedTo(0x8340 + i);
                        } else {
                            expect(listener.didStatusChange, `status changed for ${qualifier} during read back`).to.be.false;
                            expect(listener.didValueChange, `value changed for ${qualifier} during read back`).to.be.false;
                        }


                    } finally {
                        bind.removeEventListener(statusChangedEventType, listener.onStatusChanged);
                        bind.removeEventListener(valueChangedEventType, listener.onValueChanged);
                    }
                }
            } finally {
                // restore original symbols
                model.setSymbols(createRegisterJsonData(1, 7, 4, false));
                codec.addResponse(regBind.getValue(), 1);
                codec.addResponse(reg2Bind.getValue(), 4);
                await GcUtils.delay(1);
                listener.didValueChange = false;
                listener.didReceiveData = false;
                listener.verifyStatusChangedTo('');
            }
        });
    }

    // The following test cases are only for multi-core support
    let activeCore: IBindValue;
    let cores2reg2FieldBind: IBindValue;
    let cores2regBind: IRefreshableBindValue;
    let cores2reg2Bind: IRefreshableBindValue;
    let coresLength: IBindValue;
    let coresAllRegBind: IBindValue;
    let coresAllReg2Bind: IRefreshableBindValue;
    let coresAllRegField3Bind: IBindValue;
    let cores1regBind: IBindValue;

    it('RegisterAllBind Read', async () => {
        coresLength = getBinding(model, '$cores.length');
        expect(coresLength.status).to.be.null;
        expect(coresLength.getValue()).to.equal(1);
        coresAllRegBind = getBinding(model, '$cores.all.reg');
        expect(coresAllRegBind.status).to.be.null;
        expect(coresAllRegBind.isStale()).to.be.false;
        coresAllReg2Bind = getBinding(model, '$cores.all.reg2') as IRefreshableBindValue;
        expect(coresAllReg2Bind.status).to.be.null;
        expect(coresAllReg2Bind.isStale()).to.be.false;

        refreshBind.onRefresh();
        await GcUtils.delay(1);
        expect(packetCount.getValue()).to.be.equal(2);
        expect(codec.coreIndex).to.be.equal(-1);
        codec.addResponse([-1, 2, -3], 4);
        codec.addResponse([0xfb4e, 0xbabe, 0xace], 1);
        await GcUtils.delay(1);
        expect(coresLength.getValue()).to.be.equal(3);
        listener.verifyValueChangedTo(-1);
        listener.verifyDataReceivedWas(-1);
        expect(listener.didStatusChange).to.be.false;

        expect(coresAllRegBind.getValue()).to.deep.equal([0xfb4e, 0xbabe, 0xace]);
        expect(regField2Bind.getValue()).to.be.equal(2);
        expect(regField3Bind.getValue()).to.be.equal(0xf);
        coresAllRegField3Bind = getBinding(model, '$cores.all.reg.field3');
        expect(coresAllRegField3Bind.status).to.be.null;
        expect(coresAllRegField3Bind.isStale()).to.be.false;
        expect(coresAllRegField3Bind.getValue()).to.deep.equal([0xf, 0xb, 0]);
    });

    it('Read Core Specific Register', async () => {
        cores2reg2FieldBind = getBinding(model, '$cores.2.reg2.field');
        cores2regBind = getBinding(model, '$cores.2.reg') as IRefreshableBindValue;
        expect(cores2regBind.status).to.be.null;
        expect(cores2regBind.isStale()).to.be.false;
        expect(cores2regBind.getValue()).to.be.equal(0xace);
        cores2reg2Bind = getBinding(model, '$cores.2.reg2') as IRefreshableBindValue;
        expect(cores2reg2Bind.status).to.be.null;
        expect(cores2reg2Bind.isStale()).to.be.false;
        expect(cores2reg2Bind.getValue()).to.be.equal(-3);
        expect(packetCount.getValue()).to.be.equal(0);
        expect(cores2reg2FieldBind.status).to.be.null;
        expect(cores2reg2FieldBind.isStale()).to.be.false;
        expect(cores2reg2FieldBind.getValue()).to.be.equal(-3);
        reg2FieldBind.removeEventListener(statusChangedEventType, listener.onStatusChanged);
        reg2FieldBind.removeEventListener(valueChangedEventType, listener.onValueChanged);
        reg2FieldBind.removeEventListener(streamingDataEventType, listener.onDataReceived);
        cores2reg2Bind.addEventListener(statusChangedEventType, listener.onStatusChanged);
        cores2reg2Bind.addEventListener(valueChangedEventType, listener.onValueChanged);
        cores2reg2Bind.addEventListener(streamingDataEventType, listener.onDataReceived);
        cores2reg2Bind.refresh();
        await GcUtils.delay(1);
        expect(packetCount.getValue()).to.be.equal(1);
        expect(codec.coreIndex).to.be.equal(2);
        codec.addResponse(0xbeef, 4);
        await GcUtils.delay(1);
        expect(coresLength.getValue()).to.be.equal(3);
        listener.verifyValueChangedTo(0xbeef);
        listener.verifyDataReceivedWas(0xbeef);
        expect(listener.didStatusChange).to.be.false;
        expect(cores2reg2Bind.getValue()).to.be.equal(0xbeef);
        expect(coresAllReg2Bind.getValue()).to.deep.equal([-1, 2, 0xbeef]);
        expect(packetCount.getValue()).to.be.equal(0);
    });

    it('RegisterAllBind Write', async () => {
        cores2reg2Bind.removeEventListener(statusChangedEventType, listener.onStatusChanged);
        cores2reg2Bind.removeEventListener(valueChangedEventType, listener.onValueChanged);
        cores2reg2Bind.removeEventListener(streamingDataEventType, listener.onDataReceived);
        coresAllRegBind.addEventListener(statusChangedEventType, listener.onStatusChanged);
        coresAllRegBind.addEventListener(valueChangedEventType, listener.onValueChanged);
        cores1regBind = getBinding(model, '$cores.1.reg');
        cores1regBind.addEventListener(streamingDataEventType, listener.onDataReceived);
        coresAllRegField3Bind.setValue([5, 4, 0xc]);
        listener.verifyValueChangedTo([0x5b4e, 0x4abe, 0xcace]);
        expect(listener.didReceiveData).to.be.false;
        expect(cores2regBind.getValue()).to.be.equal(0xcace);
        await GcUtils.delay(1);
        expect(codec.coreIndex).to.be.equal(-1);
        expect(codec.value).to.deep.equal([0x5b4e, 0x4abe, 0xcace]);
        expect(packetCount.getValue()).to.be.equal(1);
        codec.addResponse([0x5b4e, 0x4abe, 0xcacf], 1);
        await GcUtils.delay(1);
        listener.verifyValueChangedTo([0x5b4e, 0x4abe, 0xcacf]);
        listener.verifyDataReceivedWas(0x4abe);
        expect(listener.didStatusChange).to.be.false;
        expect(packetCount.getValue()).to.be.equal(0);
    });

    it('Write Specific Core Register', async () => {
        coresAllRegBind.setDeferredMode(true);
        cores1regBind.setValue(9668);
        listener.verifyValueChangedTo([0x5b4e, 9668, 0xcacf]);
        await GcUtils.delay(1);
        expect(listener.didReceiveData).to.be.false;
        expect(packetCount.getValue()).to.be.equal(1);
        expect(codec.coreIndex).to.be.equal(1);
        expect(codec.value).to.be.equal(9668);
        codec.addResponse(9668, 1);
        await GcUtils.delay(1);
        expect(coresLength.getValue()).to.be.equal(3);
        listener.verifyDataReceivedWas(9668);
        expect(listener.didStatusChange).to.be.false;
        expect(listener.didValueChange).to.be.false;
        coresAllRegBind.setDeferredMode(false);
        await GcUtils.delay(1);
        expect(packetCount.getValue()).to.be.equal(0);
        expect(regBind.isDeferredWritePending()).to.be.false;
    });

    it('Active Register', async () => {
        expect(listener.didValueChange).to.be.false;
        expect(listener.didReceiveData).to.be.false;
        coresAllRegBind.removeEventListener(statusChangedEventType, listener.onStatusChanged);
        coresAllRegBind.removeEventListener(valueChangedEventType, listener.onValueChanged);
        cores1regBind.removeEventListener(streamingDataEventType, listener.onDataReceived);
        regBind.addEventListener(statusChangedEventType, listener.onStatusChanged);
        regBind.addEventListener(valueChangedEventType, listener.onValueChanged);
        regBind.addEventListener(streamingDataEventType, listener.onDataReceived);

        activeCore = getBinding(model, '$selectedCore');
        activeCore.setValue(2);
        expect(reg2Bind.getValue()).to.be.equal(0xbeef);
        expect(reg2FieldBind.getValue()).to.be.equal(0xbeef);
        expect(regBind.getValue()).to.be.equal(0xcacf);
        expect(regFieldBind.getValue()).to.be.equal(0xf);
        expect(regField2Bind.getValue()).to.be.equal(0x1);
        expect(regField3Bind.getValue()).to.be.equal(0xc);
        expect(regBind.isStale()).to.be.false;
        expect(regField3Bind.isStale()).to.be.false;
        expect(reg2Bind.isStale()).to.be.false;
        await GcUtils.delay(1);
        expect(packetCount.getValue()).to.be.equal(0);
        listener.verifyValueChangedTo(0xcacf);
        expect(listener.didReceiveData).to.be.false;
        regBind.removeEventListener(statusChangedEventType, listener.onStatusChanged);
        regBind.removeEventListener(valueChangedEventType, listener.onValueChanged);
        regBind.removeEventListener(streamingDataEventType, listener.onDataReceived);
        reg2FieldBind.addEventListener(statusChangedEventType, listener.onStatusChanged);
        reg2FieldBind.addEventListener(valueChangedEventType, listener.onValueChanged);
        reg2FieldBind.addEventListener(streamingDataEventType, listener.onDataReceived);
        activeCore.setValue(1);
        expect(reg2Bind.getValue()).to.be.equal(2);
        expect(reg2FieldBind.getValue()).to.be.equal(2);
        expect(regBind.getValue()).to.be.equal(9668);
        expect(regFieldBind.getValue()).to.be.equal(4);
        expect(regField2Bind.getValue()).to.be.equal(3);
        expect(regField3Bind.getValue()).to.be.equal(2);
        expect(regBind.isStale()).to.be.false;
        expect(regField3Bind.isStale()).to.be.false;
        expect(reg2Bind.isStale()).to.be.false;
        await GcUtils.delay(1);
        expect(packetCount.getValue()).to.be.equal(0);
        listener.verifyValueChangedTo(2);
        expect(listener.didReceiveData).to.be.false;
        expect(listener.didStatusChange).to.be.false;
        activeCore.setValue(1);
        expect(listener.didValueChange).to.be.false;
        expect(listener.didReceiveData).to.be.false;
        expect(listener.didStatusChange).to.be.false;
        await GcUtils.delay(1);
        expect(packetCount.getValue()).to.be.equal(0);
    });

    it('setStatus', async () => {
        coresAllReg2Bind.status = Status.createErrorStatus('reg all error');
        expect(reg2FieldBind.status!.message).to.be.equal('reg all error');
        expect(reg2Bind.status!.message).to.be.equal('reg all error');
        expect(coresAllReg2Bind.status!.message).to.be.equal('reg all error');
        listener.verifyStatusChangedTo('reg all error');
        reg2Bind.status = Status.createErrorStatus('active error');
        expect(reg2FieldBind.status!.message).to.be.equal('active error');
        expect(reg2Bind.status!.message).to.be.equal('active error');
        expect(coresAllReg2Bind.status!.message).to.be.equal('reg all error');
        listener.verifyStatusChangedTo('active error');
        reg2FieldBind.status = Status.createErrorStatus('field error');
        expect(reg2FieldBind.status!.message).to.be.equal('field error');
        expect(reg2Bind.status!.message).to.be.equal('active error');
        expect(coresAllReg2Bind.status!.message).to.be.equal('reg all error');
        listener.verifyStatusChangedTo('field error');
        reg2Bind.status = null;
        expect(reg2FieldBind.status!.message).to.be.equal('field error');
        expect(reg2Bind.status!.message).to.be.equal('reg all error');
        expect(coresAllReg2Bind.status!.message).to.be.equal('reg all error');
        reg2FieldBind.status = null;
        expect(reg2FieldBind.status!.message).to.be.equal('reg all error');
        expect(reg2Bind.status!.message).to.be.equal('reg all error');
        expect(coresAllReg2Bind.status!.message).to.be.equal('reg all error');
        expect(listener.didStatusChange).to.be.true;
        listener.didStatusChange = false;
        coresAllReg2Bind.status = null;
        expect(reg2FieldBind.status).to.be.null;
        expect(reg2Bind.status).to.be.null;
        expect(coresAllReg2Bind.status).to.be.null;
        listener.verifyStatusChangedTo('');
    });

    it('Read Errors', async () => {
        coresAllReg2Bind.refresh();
        await GcUtils.delay(1);
        expect(packetCount.getValue()).to.be.equal(1);
        expect(codec.coreIndex).to.be.equal(-1);
        codec.addErrorResponse('no response', 4);
        await GcUtils.delay(1);
        expect(reg2FieldBind.status!.message).to.be.equal('no response');
        expect(reg2Bind.status!.message).to.be.equal('no response');
        expect(coresAllReg2Bind.status!.message).to.be.equal('no response');
        listener.verifyStatusChangedTo('no response');
        await GcUtils.delay(1);
        coresAllReg2Bind.refresh();
        reg2Bind.refresh();
        await GcUtils.delay(1);
        expect(packetCount.getValue()).to.be.equal(1);
        expect(codec.coreIndex).to.be.equal(1);
        codec.addErrorResponse('bad core index', 4);
        await GcUtils.delay(1);
        expect(reg2FieldBind.status!.message).to.be.equal('bad core index');
        expect(reg2Bind.status!.message).to.be.equal('bad core index');
        expect(coresAllReg2Bind.status!.message).to.be.equal('no response');
        listener.verifyStatusChangedTo('bad core index');
        coresAllReg2Bind.refresh();
        reg2Bind.refresh();
        await GcUtils.delay(1);
        expect(packetCount.getValue()).to.be.equal(0);
        model.onDisconnect();
        await GcUtils.delay(1);
        expect(reg2FieldBind.status).to.be.null;
        expect(reg2Bind.status).to.be.null;
        expect(coresAllReg2Bind.status).to.be.null;
        listener.verifyStatusChangedTo('');
        expect(packetCount.getValue()).to.be.equal(0);
    });

    it('Change value after disconnect', async () => {
        reg2Bind.setValue(-101);
        await GcUtils.delay(1);
        expect(packetCount.getValue()).to.be.equal(0);
        listener.verifyValueChangedTo(-101);
        expect(listener.didReceiveData).to.be.false;
        expect(listener.didStatusChange).to.be.false;
    });

    it('Dispose', async () => {
        reg2Bind.dispose();
        coresAllReg2Bind.setValue([0xdead, 0xface]);
        expect(reg2Bind.getValue()).to.be.equal(-101);
        expect(listener.didValueChange).to.be.false;
        expect(listener.didReceiveData).to.be.false;
        expect(listener.didStatusChange).to.be.false;
        reg2FieldBind.dispose();
        reg2Bind.setValue(0);
        expect(reg2FieldBind.getValue()).to.be.equal(-101);
        expect(listener.didValueChange).to.be.false;
        expect(listener.didReceiveData).to.be.false;
        expect(listener.didStatusChange).to.be.false;
    });
});
