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
import { IOperatorFactory } from './IOperator';
import { IBindExpressionParser } from './IBindExpressionParser';
import { IEvent, EventType, IListener, Events } from '../../../../gc-core-assets/lib/Events';
import { IStatus, Status } from '../Status';
import { IDisposable, isDisposable } from '../IDisposable';
import { IProgressCounter, nullProgressCounter } from '../ProgressCounter';
import { bindValueType, IBindValue } from '../IBindValue';
import { statusChangedEventType, IStatusEvent } from '../IBind';

export abstract class AbstractUnaryOperatorFactory implements IOperatorFactory {
    abstract operator: string;
    abstract createOperator(operand: IBindValue): AbstractUnaryOperator;

    parse(uri: string, factory: IBindExpressionParser, precedence: number = 0) {
        if (uri.indexOf(this.operator) === 0) {
            const operandText = uri.substring(this.operator.length);
            const operand = factory.parseExpression(operandText, precedence);
            if (operand !== null) {
                return this.createOperator(operand);
            }
        }
        return null;
    }
}

export abstract class AbstractUnaryOperator extends Events implements IBindValue, IDisposable {
    protected abstract operator: string;

    constructor(protected readonly operand: IBindValue) {
        super();
    }

    addEventListener<T extends IEvent>(type: EventType<T | IStatusEvent>, listener: IListener<T>) {
        this.operand.addEventListener<T>(type, listener);

        if (type === statusChangedEventType) {
            super.addEventListener<T>(type, listener);
        }
    }

    removeEventListener<T extends IEvent>(type: EventType<T | IStatusEvent>, listener: IListener<T> | undefined) {
        this.operand.removeEventListener<T>(type, listener);

        if (type === statusChangedEventType) {
            super.removeEventListener<T>(type, listener);
        }
    }

    private _status: IStatus | null = null;

    get status(): IStatus | null {
        return this._status || this.operand.status;
    }

    set status(status: IStatus | null) {
        if (this._status !== status) {
            const oldStatus = this._status;
            this._status = status;
            this.fireEvent(statusChangedEventType, { newStatus: status, oldStatus: oldStatus, bind: this });
        }
    }

    dispose() {
        if (isDisposable(this.operand)) {
            this.operand.dispose();
        }
    }

    setValue(value: bindValueType, progress?: IProgressCounter, forceWrite?: boolean) {
        if (value === null || value === undefined) {
            return; // ignore null values
        }

        const type = this.operand.getType();
        let result;

        try {
            if (type === 'boolean') {
                result = this.doBooleanOperation(value, true);
            } else if (type === 'number') {
                result = this.doNumericOperation(value, true);
            } else if (type === 'array') {
                result = this.doArrayOperation(value, true);
            } else if (type === 'string') {
                result = this.doStringOperation(value, true);
            } else if (type === 'object') {
                result = this.doObjectOperation(value, true);
            } else {
                throw new Error(`Operator '${this.operator}' does not support ${type} types`);
            }
            this.operand.setValue(result, progress, forceWrite);
        } catch (e) {
            this.status = Status.createErrorStatus(e.message);
        }
    }

    updateValue() {
        throw new Error('Cannot updateValue on expressions');
    }

    getValue() {
        const value = this.operand.getValue();

        if (value === null || value === undefined) {
            return value; // parameter is not available, pass this on.
        }

        const type = this.operand.getType();

        try {
            if (type === 'boolean') {
                return this.doBooleanOperation(value, false);
            } else if (type === 'number') {
                return this.doNumericOperation(value, false);
            } else if (type === 'array') {
                return this.doArrayOperation(value, false);
            } else if (type === 'string') {
                return this.doStringOperation(value, false);
            } else if (type === 'object') {
                return this.doObjectOperation(value, false);
            } else {
                throw new Error(`Operator '${this.operator}' does not support ${type} types`);
            }
        } catch (e) {
            this.status = Status.createErrorStatus(e.message);
            return null;
        }
    }

    protected evalBoolean?: (value: bindValueType, write: boolean) => bindValueType;

    private doBooleanOperation(value: bindValueType, write: boolean) {
        if (this.evalBoolean !== undefined) {
            return this.evalBoolean(value, write);
        } else {
            throw new Error(`Operator '${this.operator}' does not support boolean types`);
        }
    }

    protected evalNumber?: (value: bindValueType, write: boolean) => bindValueType;

    private doNumericOperation(value: bindValueType, write: boolean) {
        if (this.evalNumber !== undefined) {
            return this.evalNumber(value, write);
        } else {
            throw new Error(`Operator '${this.operator}' does not support numeric types`);
        }
    }

    protected evalArray?: (value: bindValueType, write: boolean) => bindValueType;

    private doArrayOperation(valueArray: bindValueType, write: boolean) {
        if (this.evalArray !== undefined) {
            if (valueArray instanceof Array) {
                return this.evalArray(valueArray, write);
            } else {
                return this.evalArray([valueArray], write);
            }
        } else {
            throw new Error(`Operator '${this.operator}' does not support array types`);
        }
    }

    protected evalString?: (value: bindValueType, write: boolean) => bindValueType;

    private doStringOperation(value: bindValueType, write: boolean) {
        if (this.evalString !== undefined) {
            return this.evalString(value, write);
        } else {
            throw new Error(`Operator '${this.operator}' does not support string types`);
        }
    }

    protected evalObject?: (value: bindValueType, write: boolean) => bindValueType;

    private doObjectOperation(value: bindValueType, write: boolean) {
        if (this.evalObject !== undefined) {
            return this.evalObject(value, write);
        } else { // try converting using number or string conversion if available before reporting object types not supported.
            value = value.valueOf();  // Object.valueOf() returns this (so unchanged if not overridden).
            const type = typeof value;
            if (type === 'number' && this.evalNumber !== undefined) {
                return this.evalNumber(value, write);
            } else if (this.evalString !== undefined) {
                return this.evalString(value.toString(), write);
            } else {
                throw new Error(`Operator '${this.operator}' does not support object types`);
            }
        }
    }

    getType() {
        return this.operand.getType();
    }

    toString() {
        return this.operator + this.operand.toString();
    }

    isStale() {
        return this.operand.isStale();
    }

    get readOnly() {
        return this.operand.readOnly;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onValueChanged() {
    }

    setDeferredMode(deferredMode: boolean, progress: IProgressCounter = nullProgressCounter, forceWrite = false): void {
        this.operand.setDeferredMode(deferredMode, progress, forceWrite);
    }
    getValueCommitted() {
        this.operand.getValueCommitted();
    }
    clearDeferredWrite(): void {
        this.operand.clearDeferredWrite();
    }
    isDeferredWritePending(): boolean {
        return this.operand.isDeferredWritePending();
    }
}
