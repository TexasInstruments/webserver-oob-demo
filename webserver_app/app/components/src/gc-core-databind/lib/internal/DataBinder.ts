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
import { IBindValue, bindValueType, IStreamingDataEvent, streamingDataEventType, IValueChangedEvent, staleChangedEventType, IStaleEvent, valueChangedEventType } from './IBindValue';
import { IListener } from '../../../gc-core-assets/lib/Events';
import { GcConsole as console } from '../../../gc-core-assets/lib/GcConsole';
import { statusChangedEventType, NAME } from './IBind';
import { DataConverter } from './DataConverter';
import { IDisposable } from './IDisposable';
import { IDataBinder } from './IDataBinder';
import { IProgressCounter } from './ProgressCounter';

export type computeFn = (value: bindValueType) => bindValueType;

interface IBindListener {
    enable(): void;
    disable(): void;
    statusChangedHandler: () => void;
};

abstract class AbstractBindListener implements IBindListener {
    statusChangedHandler: () => void;
    constructor(protected srcBinding: IBindValue, protected destBinding: IBindValue) {
        this.statusChangedHandler = () => this.destBinding.status = this.srcBinding.status;
    };

    abstract enable(): void;

    abstract disable(): void;
};

class StreamingListener extends AbstractBindListener {
    private dataReceivedHandler: IListener<IStreamingDataEvent>;

    constructor(srcBinding: IBindValue, destBinding: IBindValue, private computeValue?: computeFn) {
        super(srcBinding, destBinding);
        this.dataReceivedHandler = () => this.onDataReceived();
    };

    enable() {
        this.srcBinding.addEventListener(statusChangedEventType, this.statusChangedHandler);
        this.srcBinding.addEventListener(streamingDataEventType, this.dataReceivedHandler);
    };

    disable() {
        this.srcBinding.removeEventListener(statusChangedEventType, this.statusChangedHandler);
        this.srcBinding.removeEventListener(streamingDataEventType, this.dataReceivedHandler);
    };

    private onDataReceived() {
        let newValue = this.srcBinding.getValue();  // always calculate new value in case srcBinding is an expression that needs to be evaluated.
        let srcType = this.srcBinding.getType();
        if (this.computeValue) {
            newValue = this.computeValue(newValue);
            srcType = undefined;
        }
        newValue = DataConverter.convert(newValue, srcType, this.destBinding.getType());
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.destBinding.onStreamingDataReceived!(newValue);
    };
};

class BindingListener extends AbstractBindListener {
    private valueChangedHandler: IListener<IValueChangedEvent>;
    private staleChangedHandler: IListener<IStaleEvent>;
    constructor(srcBinding: IBindValue, destBinding: IBindValue, private computeValue?: computeFn) {
        super(srcBinding, destBinding);
        this.valueChangedHandler = (details: IValueChangedEvent) => this.onValueChanged(details.progress);
        this.staleChangedHandler = () => this.onStaleChanged();
    };

    onValueChanged(progress?: IProgressCounter) {
        if (this.srcBinding.isStale()) {
            // defer passing the data along until the value has fully changed.
            this.srcBinding.addEventListener(staleChangedEventType, this.staleChangedHandler);
        } else {
            let newValue = this.srcBinding.getValue();
            const oldValue = this.destBinding.getValue();

            let srcType = this.srcBinding.getType();
            if (this.computeValue) {
                newValue = this.computeValue(newValue);
                srcType = undefined;
            }
            const destType = this.destBinding.getType();

            // protect against writing back values changed solely due to their conversion to and back again.
            // eslint-disable-next-line eqeqeq
            if (newValue != DataConverter.convert(oldValue, destType, srcType)) {
                newValue = DataConverter.convert(newValue, srcType, destType);
                this.destBinding.setValue(newValue, progress);
            }
        }
    };

    onStaleChanged() {
        if (!this.srcBinding.isStale()) {
            this.srcBinding.removeEventListener(staleChangedEventType, this.staleChangedHandler);
            this.onValueChanged(); // force the value to be synced
        }
    };

    enable() {
        this.srcBinding.addEventListener(statusChangedEventType, this.statusChangedHandler);
        this.srcBinding.addEventListener(valueChangedEventType, this.valueChangedHandler);
    };

    disable() {
        this.srcBinding.removeEventListener(statusChangedEventType, this.statusChangedHandler);
        this.srcBinding.removeEventListener(valueChangedEventType, this.valueChangedHandler);
    };

    get status() {
        return this.srcBinding.status;
    };
};

const nullListener = new (class implements IBindListener {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    enable() {
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    disable() {
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    statusChangedHandler() {
    };
});

export class DataBinder implements IDataBinder, IDisposable {
    private targetListener: IBindListener = nullListener;
    private modelListener: IBindListener = nullListener;
    constructor(private targetBinding: IBindValue, private modelBinding: IBindValue, private getter?: computeFn, private setter?: computeFn, oneWay = false) {
        // support for readOnly bindings, don't write values.
        if (oneWay || (getter && !setter)) {
            this.modelListener = DataBinder.createListener(modelBinding, targetBinding, getter);
        } else if (setter && !getter) {
            // switch model and target, so model gets initialized from the target.
            this.modelListener = DataBinder.createListener(targetBinding, modelBinding, setter);
        } else {
            // two-way binding support (with both getter or setter, or neither getter or setter (no computation)
            this.targetListener = DataBinder.createListener(targetBinding, modelBinding, setter);
            this.modelListener = DataBinder.createListener(modelBinding, targetBinding, getter);
        }
        this.enabled = true;
    };

    private static createListener = function (srcBinding: IBindValue, targetBinding: IBindValue, computeValue?: computeFn): IBindListener {
        if (targetBinding.onStreamingDataReceived) {
            return new StreamingListener(srcBinding, targetBinding, computeValue);
        } else {
            return new BindingListener(srcBinding, targetBinding, computeValue);
        }
    };
    private _enabled = false;
    set enabled(enable: boolean) {

        if (this._enabled !== enable) {
            this._enabled = enable;

            if (enable) {
                this.targetListener.enable();
                this.modelListener.enable();

                // force model to sync the target value in case it changed
                // between disable() and subsequent enable() calls.
                if (typeof (this.modelListener as BindingListener).onValueChanged === 'function') {
                    (this.modelListener as BindingListener).onValueChanged();
                }

                // force status to be reflected in target as it now is in the
                // model, in case it change between time.
                this.modelListener.statusChangedHandler();
            } else {
                this.targetListener.disable();
                this.modelListener.disable();
            }
        }
    };

    get enabled() {
        return this._enabled;
    };

    dispose() {
        this.enabled = false;
    };

    static bind(targetBinding: IBindValue | null, modelBinding: IBindValue | null, getter?: computeFn, setter?: computeFn, oneWay = false): IDataBinder | null {
        if (targetBinding !== null && modelBinding !== null) {
            return new DataBinder(targetBinding, modelBinding, getter, setter, oneWay);
        }
        console.error(NAME, 'Cannot bind target and model bindings together because one of them is not an IBindValue.');
        return null;
    };
};