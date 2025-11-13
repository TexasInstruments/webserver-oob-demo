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
import { IStatus } from '../Status';
import { IDisposable, isDisposable } from '../IDisposable';
import { valueChangedEventType, bindValueType, IValueChangedEvent, staleChangedEventType, IBindValue } from '../IBindValue';
import { IEvent, EventType, IListener } from '../../../../gc-core-assets/lib/Events';
import { IProgressCounter, nullProgressCounter } from '../ProgressCounter';
import { indexValueType, ILookupBindValue } from '../ILookupBindValue';

export abstract class AbstractLookupOperator<T extends ILookupBindValue> implements ILookupBindValue, IDisposable {
    abstract readonly operator: string;
    onValueChangedListener: IListener<IValueChangedEvent>;
    constructor(protected readonly lookupBinding: T, protected readonly indexBindings: IBindValue[]) {

        this.onValueChangedListener = this.onValueChanged.bind(this);
        for (let j = indexBindings.length; j-- > 0;) {
            // add listeners to index changes.
            indexBindings[j].addEventListener(valueChangedEventType, this.onValueChangedListener);
        }
    }
    get status(): IStatus | null {
        let status = this.lookupBinding.status;
        for (let i = 0; status === null && i < this.indexBindings.length; i++) {
            status = this.indexBindings[i].status;
        }
        return status;
    }

    set status(status: IStatus | null) {
        this.lookupBinding.status = status;
    }

    dispose() {
        if (isDisposable(this.lookupBinding)) {
            this.lookupBinding.dispose();
        }

        for (let i = this.indexBindings.length; i-- > 0;) {
            const indexBinding = this.indexBindings[i];
            indexBinding.removeEventListener(valueChangedEventType, this.onValueChangedListener);
            if (isDisposable(indexBinding)) {
                indexBinding.dispose();
            }
        }
    }

    getType() {
        return this.lookupBinding.getType();
    }

    isStale() {
        let result = this.lookupBinding.isStale();

        for (let i = this.indexBindings.length; result === false && i-- > 0;) {
            result = this.indexBindings[i].isStale();
        }
        return result;
    }

    get readOnly() {
        return this.lookupBinding.readOnly;
    }

    addEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        this.lookupBinding.addEventListener<T>(type, listener);
    }

    removeEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T> | undefined) {
        this.lookupBinding.removeEventListener<T>(type, listener);
    }

    private staleIndexBinding: IBindValue | undefined;
    private cachedIndecies: indexValueType[] = [];

    setIndex(...args: indexValueType[]) {
        const indecies: indexValueType[] = [];

        let i = 0;
        for (; i < this.indexBindings.length; i++) {
            const indexBinding = this.indexBindings[i];
            if (indexBinding.isStale()) {
                // postpone calling setIndex on lookupBinding until all indecies have
                // non stale values.  We only have to listen to one stale index at a time.
                if (this.staleIndexBinding === undefined) {
                    const listener = () => {
                        indexBinding.removeEventListener(staleChangedEventType, listener);
                        this.setIndex(...this.cachedIndecies);
                    };
                    indexBinding.addEventListener(staleChangedEventType, listener);
                }
                this.cachedIndecies = args;
                return;
            }
            indecies.push(indexBinding.getValue());
        }
        for (i = 0; i < args.length; i++) {
            indecies.push(args[i]);
        }

        this.lookupBinding.setIndex(...indecies);
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onIndexChanged() {
    }

    getValue() {
        return this.lookupBinding.getValue();
    }

    setValue(value: bindValueType, progress?: IProgressCounter, forceWrite?: boolean) {
        this.lookupBinding.setValue(value, progress, forceWrite);
    }

    updateValue(value: bindValueType, progress?: IProgressCounter, skipStreamingListeners?: boolean) {
        this.lookupBinding.updateValue(value, progress, skipStreamingListeners);
    }

    protected onValueChanged() {
        this.setIndex();
    }

    toString() {
        let result = this.lookupBinding.toString() + this.operator.charAt(0) + this.indexBindings[0].toString();

        for (let i = 1; i < this.indexBindings.length; i++) {
            result += ', ' + this.indexBindings[i].toString();
        }
        return result + this.operator.charAt(1);
    }

    setDeferredMode(deferredMode: boolean, progress: IProgressCounter = nullProgressCounter, forceWrite = false): void {
        this.lookupBinding.setDeferredMode(deferredMode, progress, forceWrite);
    }

    getValueCommitted() {
        return this.lookupBinding.getValueCommitted();
    }

    clearDeferredWrite(): void {
        this.lookupBinding.clearDeferredWrite();
    }

    isDeferredWritePending(): boolean {
        return this.lookupBinding.isDeferredWritePending();
    }
}

export function testLookupBinding(lookupBinding: IBindValue, operator: string) {
    if (lookupBinding === null) {
        throw new Error(`Missing the left operand for the ${operator} operator.`);
    }
    if (!((lookupBinding as ILookupBindValue).setIndex)) {
        const text = operator === '()' ? 'a function' : operator === '.' ? 'an object' : 'an array';
        throw new Error(`'${lookupBinding.toString()}' is not ${text} type.  It cannot be used with the ${operator} operator.`);
    }
}
