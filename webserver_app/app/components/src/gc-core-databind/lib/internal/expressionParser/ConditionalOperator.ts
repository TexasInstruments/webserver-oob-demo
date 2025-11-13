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
import { IBindExpressionParser } from './IBindExpressionParser';
import { IOperatorFactory, IOperator } from './IOperator';
import { IBindValue, streamingDataEventType, valueChangedEventType, IStreamingDataEvent, IValueChangedEvent, bindValueType } from '../IBindValue';
import { IEvent, EventType, IListener } from '../../../../gc-core-assets/lib/Events';
import { IDisposable, isDisposable } from '../IDisposable';
import { IProgressCounter, nullProgressCounter } from '../ProgressCounter';

const openingBrace = '?';
const closingBrace = ':';
const OP = openingBrace + closingBrace;

class Factory implements IOperatorFactory {
    operator = OP;
    parse(uri: string, factory: IBindExpressionParser, precedence: number): IBindValue | null {
        let pos = factory.findFirstIndexOf(uri, openingBrace, 0);
        if (pos === 0) {
            // empty condition paramenter
            throw new Error('I found a \'?\' operator but nothing in front of it.  ' +
                `To be honest, I was expecting to find something before the '?' in the following text: ${uri}`);
        } else if (pos > 0) {
            const conditionText = uri.substring(0, pos);
            const remainingText = uri.substring(pos + 1);

            pos = factory.findMatchingBrace(remainingText, openingBrace, closingBrace);

            if (pos < 0) {
                // missing matching ':' operator.
                throw new Error('I found a \'?\' operator, but I couldn\'t find the matching \':\' operator.  ' +
                    `To be honest I was expecting one in the following text: ${remainingText}`);
            } else if (pos === 0) {
                // empty middle paramenter
                throw new Error('I found a \':\' imediately following a \'?\' operator.  To be honest, I was expecting to find something between them.');
            } else if (pos >= remainingText.length - 1) {
                // empty right paramenter
                throw new Error('I found a \'?\' operator a with matching \':\', but nothing after the \':\' operator.  ' +
                    `To be honest, I was expecting to find something after the ':' in the following text: ${remainingText}`);
            } else {
                const trueText = remainingText.substring(0, pos);
                const falseText = remainingText.substring(pos + 1);

                const condition = factory.parseExpression(conditionText, precedence);
                const trueOperand = factory.parseExpression(trueText, precedence);
                const falseOperand = factory.parseExpression(falseText, precedence);
                if (condition === null || trueOperand === null || falseOperand === null) {
                    throw new Error('Missing operands for the conditional (?:) operator.');
                }

                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                return new ConditionalOperator(condition, trueOperand, falseOperand);
            }
        }
        return null;
    }
}

export class ConditionalOperator implements IOperator, IBindValue, IDisposable {
    operator = OP;
    static factory = new Factory();
    constructor(private readonly condition: IBindValue, private readonly trueOperand: IBindValue, private readonly falseOperand: IBindValue) {
    }

    private streamingListenerMap = new Map<unknown, IListener<IValueChangedEvent>>();

    addEventListener<T extends IEvent>(type: EventType<T | IStreamingDataEvent>, listener: IListener<T>) {
        if (type === streamingDataEventType) {
            let streamingOperand = this.getConditionalBranch();
            streamingOperand.addEventListener(type, listener);
            const valueChangedListener = () => {
                streamingOperand.removeEventListener<T>(type, listener);
                streamingOperand = this.getConditionalBranch();
                streamingOperand.addEventListener<T>(type, listener);
            };
            this.streamingListenerMap.set(listener, valueChangedListener);
            this.condition.addEventListener(valueChangedEventType, valueChangedListener);

        } else {

            this.condition.addEventListener<T>(type, listener);
            this.trueOperand.addEventListener<T>(type, listener);
            this.falseOperand.addEventListener<T>(type, listener);
        }
    }

    removeEventListener<T extends IEvent>(type: EventType<T | IStreamingDataEvent>, listener: IListener<T> | undefined) {
        if (type === streamingDataEventType) {
            const valueChangedListener = this.streamingListenerMap.get(listener);
            if (valueChangedListener && listener) {
                this.condition.removeEventListener<IValueChangedEvent>(valueChangedEventType, valueChangedListener);
                this.streamingListenerMap.delete(listener);
            }
        } else {
            this.condition.removeEventListener<T>(type, listener);
        }
        this.trueOperand.removeEventListener<T>(type, listener);
        this.falseOperand.removeEventListener<T>(type, listener);
    }

    dispose() {
        if (isDisposable(this.condition)) {
            this.condition.dispose();
        }
        if (isDisposable(this.trueOperand)) {
            this.trueOperand.dispose();
        }
        if (isDisposable(this.falseOperand)) {
            this.falseOperand.dispose();
        }
    }
    private getConditionalBranch() {
        const value = this.condition.getValue();

        return (value ? this.trueOperand : this.falseOperand);
    }


    getValue() {
        return this.getConditionalBranch().getValue();
    }

    setValue(value: bindValueType, progress?: IProgressCounter, forceWrite?: boolean) {
        this.getConditionalBranch().setValue(value, progress, forceWrite);
    }

    updateValue(value: bindValueType, progress?: IProgressCounter, skipStreamingListeners?: boolean) {
        this.getConditionalBranch().updateValue(value, progress, skipStreamingListeners);
    }

    getType() {
        return this.getConditionalBranch().getType();
    }

    get status() {
        return this.getConditionalBranch().status;
    }

    set status(status) {
        this.getConditionalBranch().status = status;
    }

    toString() {
        return ' ? ' + this.trueOperand.toString() + ' : ' + this.falseOperand.toString();
    }

    isStale() {
        return this.condition.isStale() || this.getConditionalBranch().isStale();
    }

    get readOnly() {
        return this.getConditionalBranch().readOnly;
    }

    setDeferredMode(deferredMode: boolean, progress: IProgressCounter = nullProgressCounter, forceWrite = false): void {
        this.getConditionalBranch().setDeferredMode(deferredMode, progress, forceWrite);
    }
    getValueCommitted() {
        this.getConditionalBranch().getValueCommitted();
    }
    clearDeferredWrite(): void {
        this.getConditionalBranch().clearDeferredWrite();
    }
    isDeferredWritePending(): boolean {
        return this.getConditionalBranch().isDeferredWritePending();
    }
}

