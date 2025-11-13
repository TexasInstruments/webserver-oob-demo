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
import { IBindValue, bindValueType } from './IBindValue';
import { IProgressCounter, nullProgressCounter } from './ProgressCounter';
import { DataConverter } from './DataConverter';
import { IEvent, EventType, IListener } from '../../../gc-core-assets/lib/Events';
import { IStatus } from './Status';

export class CollectionBindValue implements IBindValue {
    constructor(private bindings: Map<string, IBindValue>) { };

    getValue(): bindValueType {
        const values: { [index: string]: bindValueType } = {};
        this.bindings.forEach((binding, bindName) => {
            values[bindName] = binding.getValue();
        });
        return values;
    }

    setValue(value: bindValueType, progress?: IProgressCounter, forceWrite?: boolean): void {
        this.bindings.forEach((binding, bindName) => {
            let newValue = value[bindName];
            if (newValue !== undefined) {
                newValue = DataConverter.convert(newValue, undefined, binding.getType());
                binding.setValue(newValue, progress, forceWrite);
            }
        });
    }

    updateValue(value: bindValueType, progress?: IProgressCounter, skipStreamingListeners?: boolean) {
        this.bindings.forEach((binding, bindName) => {
            let newValue = value[bindName];
            if (newValue !== undefined) {
                newValue = DataConverter.convert(newValue, undefined, binding.getType());
                binding.updateValue(value, progress, skipStreamingListeners);
            }
        });
    }

    getType(): string {
        return 'object';
    }

    addEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        this.bindings.forEach((binding) => {
            binding.addEventListener<T>(type, listener);
        });
    }

    removeEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        this.bindings.forEach((binding) => {
            binding.removeEventListener<T>(type, listener);
        });
    }

    isStale(): boolean {
        for (const binding of this.bindings.values()) {
            if (binding.isStale()) {
                return true;
            }
        }
        return false;
    }

    get readOnly(): boolean {
        for (const binding of this.bindings.values()) {
            if (binding.readOnly) {
                return true;
            }

        }
        return false;
    }

    private _status: IStatus | null = null;
    get status(): IStatus | null {
        if (this._status) {
            return this._status;
        } else {
            for (const binding of this.bindings.values()) {
                const status = binding.status;
                if (status) {
                    return status;
                }
            }
            return null;
        }
    }

    set status(status: IStatus | null) {
        this._status = status;
    }

    setDeferredMode(deferredMode: boolean, progress: IProgressCounter = nullProgressCounter, forceWrite = false): void {
        this.bindings.forEach((binding) => {
            binding.setDeferredMode(deferredMode, progress, forceWrite);
        });
    }

    getValueCommitted(): bindValueType {
        const values: { [index: string]: bindValueType } = {};
        this.bindings.forEach((binding, bindName) => {
            values[bindName] = binding.getValueCommitted();
        });
        return values;
    }
    clearDeferredWrite(): void {
        this.bindings.forEach((binding) => {
            binding.clearDeferredWrite();
        });
    }
    isDeferredWritePending(): boolean {
        for (const binding of this.bindings.values()) {
            if (binding.isDeferredWritePending()) {
                return true;
            }
        }
        return false;
    }
    onDisconnected(): void {
        this.bindings.forEach((binding) => {
            if (binding.onDisconnected) {
                binding.onDisconnected();
            }
        });
    }
}
