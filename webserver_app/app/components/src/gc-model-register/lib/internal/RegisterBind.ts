/**
 *  Copyright (c) 2020, 2021 Texas Instruments Incorporated
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *  *   Redistributions of source code must retain the above copyright
 *  notice, this list of conditions and the following disclaimer.
 *  notice, this list of conditions and the following disclaimer in the
 *  documentation and/or other materials provided with the distribution.
 *  *   Neither the name of Texas Instruments Incorporated nor the names of
 *  its contributors may be used to endorse or promote products derived
 *  from this software without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 *  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 *  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 *  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 *  OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 *  OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 *  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { EventType, IListener, IEvent } from '../../../gc-core-assets/lib/Events';
import { IRegisterInfo, IRegisterTypeQualifiers } from '../IRegisterInfo';
import { RegisterModel } from '../RegisterModel';
import { ArrayOperator, AbstractAsyncBindValue, IBindValue, IValueChangedEvent, IStreamingDataEvent, IRefreshIntervalProvider, valueChangedEventType, streamingDataEventType, bindValueType, IProgressCounter, nullProgressCounter, Status, IStatus, statusChangedEventType, ILookupBindValue } from '../../../gc-core-databind/lib/CoreDatabind';

export class RegisterBind extends AbstractAsyncBindValue {
    protected coreIndex = 0;
    protected coreCountBind?: IBindValue;
    private parentBind?: RegisterAllBind;
    private onFailure: (err: { message?: string }) => number;
    private onSuccess: (result: number | number[]) => number | number[];
    private onParentValueChangedHandler?: IListener<IValueChangedEvent>;
    private onDataReceivedHandler?: IListener<IStreamingDataEvent>;

    protected defaultValue?: number;

    constructor(public readonly symbolName: string, protected parentModel: RegisterModel, refreshIntervalProvider?: IRefreshIntervalProvider, symbolData?: IRegisterInfo, registerAllBind?: RegisterAllBind, defaultType = 'number') {
        super(defaultType);

        this.onFailure = (errMsg) =>  {
            if (this.parentModel.isConnected()) {
                this.reportErrorStatus(errMsg.message || errMsg.toString());
            }
            return this.cachedValue; // don't record a new value, keep the same value as before.
        };

        this.onSuccess = (result: number | number[]) => {
            // clear errors on successful read
            this.reportCriticalError(null);


            if (this.coreCountBind) {
                // must be RegisterAllBind
                // support single core case where readValue returns non array value, and we need to convert to array.
                if (!Array.isArray(result)) {
                    result = [result];
                }
                // update the $cores.length binding as needed.
                this.coreCountBind.updateValue(result.length);
            }
            return result;
        };

        this.setRefreshIntervalProvider(refreshIntervalProvider);

        this.updateRegisterInfo();

        this.parentBind = registerAllBind;
        if (this.parentBind) {
            this.addEventListenerOnFirstAdded(valueChangedEventType, () => {
                this.getValue();  // update cached value without generating a changed event to newly added listener.
                this.onParentValueChangedHandler = () => {
                    this.doUpdateRegisterValue(true);
                };
                this.parentBind!.addEventListener(valueChangedEventType, this.onParentValueChangedHandler);
            });

            this.addEventListenerOnLastRemoved(valueChangedEventType, () => {
                if  (this.onParentValueChangedHandler) {
                    this.parentBind!.removeEventListener(valueChangedEventType, this.onParentValueChangedHandler);
                    this.onParentValueChangedHandler = undefined;
                }
            });

            this.addEventListenerOnFirstAdded(streamingDataEventType, () => {
                this.onDataReceivedHandler = () => {
                    this.doUpdateRegisterValue(false);
                };
                this.parentBind!.addEventListener(streamingDataEventType, this.onDataReceivedHandler);
            });

            this.addEventListenerOnLastRemoved(streamingDataEventType, () => {
                if (this.onDataReceivedHandler) {
                    this.parentBind!.removeEventListener(streamingDataEventType, this.onDataReceivedHandler);
                    this.onDataReceivedHandler = undefined;
                }
            });
        }
    }

    dispose() {
        super.dispose();
        if (this.parentBind) {
            if (this.onParentValueChangedHandler) {
                this.parentBind.removeEventListener(valueChangedEventType, this.onParentValueChangedHandler);
                this.onParentValueChangedHandler = undefined;
            }

            if (this.onDataReceivedHandler) {
                this.parentBind.removeEventListener(streamingDataEventType, this.onDataReceivedHandler);
                this.onDataReceivedHandler = undefined;
            }

            this.parentBind = undefined;
        }
    }

    private doUpdateRegisterValue(skipStreamingListeners: boolean) {
        this.updateValue(this.parentBind!.getValueFor(this.coreIndex), undefined, skipStreamingListeners);
        this.setStale(false);
    }

    getValue(): bindValueType {
        if (this.parentBind && !this.onParentValueChangedHandler) {
            this.cachedValue = this.parentBind.getValueFor(this.coreIndex);
        }
        return super.getValue();
    }

    onValueChanged(details: IValueChangedEvent) {
        super.onValueChanged(details);

        if (this.parentBind) {
            this.parentBind.updateValueFor(this.coreIndex, details.newValue);
        }
    }

    updateValue(value: bindValueType, progress: IProgressCounter = nullProgressCounter, skipStreamingListeners?: boolean) {
        super.updateValue(value, progress, skipStreamingListeners);

        if (this.parentBind) {
            this.parentBind.updateValueFor(this.coreIndex, this.getValue());
        }
    }

    async writeValue() {
        try {
            await this.parentModel.writeValue(this.symbolName, this.cachedValue, this.coreIndex);
        } catch (err) {
            this.onFailure(err);
        }
    }

    readValue() {
        return this.parentModel.readValue(this.symbolName, this.coreIndex).then(this.onSuccess).catch(this.onFailure);
    }

    reportErrorStatus(errorMessage: string) {
        let status = null;
        if (errorMessage && errorMessage.length > 0) {
            status = Status.createErrorStatus(errorMessage, 'target');
        }
        this.reportCriticalError(status);
    }

    getRegisterInfo() {
        return this.parentModel.getRegisterInfo(this.symbolName) as IRegisterInfo;
    }

    updateRegisterInfo() {
        const symbolData = this.getRegisterInfo();
        if (symbolData) {
            this.defaultValue = symbolData.default;
            // restore default for the new device, before reading the actual value.
            if (this.defaultValue !== undefined) {
                this.updateValue(this.defaultValue, undefined, true);
                this.setStale(false);
            } else {
                this.setStale(true);
            }

            // support for qualifiers in register symbol data
            // remove existing qualifiers
            if (!this.readable) {
                this.readable = true;
            }
            if (!this.writable) {
                this.writable = true;
            }
            if (!this.volatile) {
                this.volatile = true;
            }
            if (!this.verifiable) {
                this.verifiable = true;
            }

            if (symbolData.attrs) {
                let qualifier: keyof IRegisterTypeQualifiers;
                for (qualifier in symbolData.attrs) {
                    if (symbolData.attrs[qualifier] as boolean) {
                        this.setQualifier(qualifier);
                    }
                }
            }

            // clear errors on successful read
            this.reportCriticalError(null);
        } else {
            this.reportCriticalError(Status.createErrorStatus('Register named "' + this.symbolName + '" is not recognized for this device.'));
        }
    }

    onIndexChanged() {
        const index = this.getIndex();
        if (index) {
            this.coreIndex = Math.max(0, +index[0]);  // make sure index >= 0

            if (this.parentBind && !this.parentBind.isStale()) {
                // use parent bind to update value because it is not stale
                this.doUpdateRegisterValue(true);
            } else if (this.defaultValue !== undefined) {
                // binding never stale if there is a default value defined.
                this.updateValue(this.defaultValue, undefined, true);
            } else {
                // no default value and parent (it there is one) is stale.
                this.setStale(true);
            }

            // discard any deferred write operations when index is changed.  The register view will
            // prompt user before switching active cores to allow the user to commit or clear the deferred writes.
            this.committedValue = this.cachedValue;
        }
    }

    isConnected() {
        return this.parentModel.isConnected();
    }

    get status(): IStatus | null {
        let status = super.status;
        if (!status && this.parentBind) {
            status = this.parentBind.status;
        }
        return status;
    }

    set status(status: IStatus | null) {
        super.status = status;
    }

    addEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        super.addEventListener(type, listener);

        if (type.id === statusChangedEventType.id && this.parentBind) {
            this.parentBind.addEventListener(type, listener);
        }
    }

    removeEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        super.removeEventListener(type, listener);
        if (type.id === statusChangedEventType.id && this.parentBind) {
            this.parentBind.removeEventListener(type, listener);
        }
    }

    kickStartAReadOperation(force: boolean) {
        // prevent automatic reads when there is a RegisterAll parent binding, but still allow manual onRefresh() calls.
        if (!this.parentBind) {
            super.kickStartAReadOperation(force);
        }
    }
}

export class RegisterAllBind extends RegisterBind implements ILookupBindValue {
    protected coreIndex = -1;

    constructor(symbolName: string, model: RegisterModel, refreshIntervalProvider?: IRefreshIntervalProvider, symbolData?: IRegisterInfo) {
        super(symbolName, model, refreshIntervalProvider, symbolData, undefined, 'array');

        this.coreCountBind = model.getBinding('$cores.length')!;
    }

    getValueFor(index: number) {
        return (this.cachedValue && Array.isArray(this.cachedValue) && this.cachedValue[index]) || this.defaultValue || 0;
    }

    private static updateValueInArrayByIndex(array: number[], index: number, newValue: number, defaultValue?: number) {
        const result: (number | undefined)[] = array ? array.slice() : [];
        for (let i = result.length; i < index; i++ ) {
            result.push(defaultValue);
        }
        result[index] = newValue;
        return result;
    }

    updateValueFor(index: number, newValue: number) {
        if (this.getType() === 'array' && newValue !== this.getValueFor(index)) {
            const newValues = RegisterAllBind.updateValueInArrayByIndex(this.cachedValue, index, newValue, this.defaultValue);

            if (this.deferredMode) {
                this.committedValue = RegisterAllBind.updateValueInArrayByIndex(this.committedValue, index, newValue, this.defaultValue);
            }

            this.updateValue(newValues, undefined, true); // skip streaming data listeners.
        }
    }
}

export class RegisterArrayOperator extends ArrayOperator<RegisterBind> {
    constructor(registerBind: RegisterBind, indexBind: IBindValue) {
        // binary operator adds listeners to figure out when either the registerBind or indexBind changes
        // when array operator changes it will call setIndex on the registerBind.  (the first param specifies the new index)
        super(registerBind, [indexBind]);
    }

    refresh(progress?: IProgressCounter, force = true) {
        return this.lookupBinding.refresh(progress, force);
    }

    refreshAndLog(progress?: IProgressCounter) {
        return this.lookupBinding.refreshAndLog(progress);
    }

    setDeferredMode(deferredMode: boolean = false, progress: IProgressCounter = nullProgressCounter, forceWrite = false) {
        return this.lookupBinding.setDeferredMode(deferredMode, progress, forceWrite);
    }

    isConnected() {
        return this.lookupBinding.isConnected();
    }

    clearDeferredWrite() {
        return this.lookupBinding.clearDeferredWrite();
    }

    get readOnly() {
        return this.lookupBinding.readOnly;
    }

    isDeferredWritePending() {
        return this.lookupBinding.isDeferredWritePending();
    }

    getValueCommitted() {
        return this.lookupBinding.getValueCommitted();
    }

    updateRegisterInfo() {
        return this.lookupBinding.updateRegisterInfo();
    }

    onDisconnected() {
        return this.lookupBinding.onDisconnected();
    }

    updateValue(value: bindValueType, progress: IProgressCounter = nullProgressCounter, skipStreamingListeners?: boolean) {
        return this.lookupBinding.updateValue(value, progress, skipStreamingListeners);
    }
}
