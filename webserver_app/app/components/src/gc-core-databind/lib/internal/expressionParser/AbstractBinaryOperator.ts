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
import { bindValueType, IBindValue } from '../IBindValue';
import { IProgressCounter, nullProgressCounter } from '../ProgressCounter';
import { IDisposable, isDisposable } from '../IDisposable';
import { IStatus, Status } from '../Status';
import { DataConverter } from '../DataConverter';
import { IEvent, EventType, IListener, Events } from '../../../../gc-core-assets/lib/Events';
import { statusChangedEventType, IStatusEvent } from '../IBind';

export abstract class AbstractBinaryOperatorFactory implements IOperatorFactory {
    abstract operator: string;

    abstract createOperator(leftOperand: IBindValue, rightOperand: IBindValue): AbstractBinaryOperator;

    parse(uri: string, factory: IBindExpressionParser, precedence: number): IBindValue | null {
        const pos = factory.findLastIndexOf(uri, this.operator);
        if (pos > 0 && pos < uri.length - 1) { // can't be first or last character, because it's not a unary operator
            let operandText = uri.substring(0, pos);
            const leftOperand = factory.parseExpression(operandText, precedence);
            operandText = uri.substring(pos + this.operator.length);
            // there are no operators to the right of this one at the same precedence level
            const rightOperand = factory.parseExpression(operandText, precedence + 1);

            if (leftOperand === null || rightOperand === null) {
                throw new Error(`Missing operands for the ${this.operator} operator.`);
            }

            return this.createOperator(leftOperand, rightOperand);
        }
        return null;
    }
}

export abstract class AbstractBinaryOperator extends Events implements IBindValue, IDisposable {
    protected abstract operator: string;
    constructor(protected readonly leftOperand: IBindValue, protected readonly rightOperand: IBindValue) {
        super();
    }

    toString() {
        return this.leftOperand.toString() + ' ' + this.operator + ' ' + this.rightOperand.toString();
    }

    abstract doSetValue(lparam: bindValueType, rparam: bindValueType, write: boolean): void;

    setValue(value: bindValueType, progress?: IProgressCounter, forceWrite?: boolean) {
        if (!this.readOnly) {
            try {
                if (this.leftOperand.readOnly) {
                    value = this.doSetValue(value, this.leftOperand.getValue(), true);
                    const rightType = this.rightOperand.getType();
                    value = DataConverter.convert(value, typeof value, rightType);
                    this.rightOperand.setValue(value, progress, forceWrite);
                } else {
                    value = this.doSetValue(value, this.rightOperand.getValue(), false);
                    const leftType = this.leftOperand.getType();
                    value = DataConverter.convert(value, typeof value, leftType);
                    this.leftOperand.setValue(value, progress, forceWrite);
                }
            } catch (e) {
                this.status = Status.createErrorStatus(e.message);
            }
        }
    }

    updateValue() {
        throw new Error('Cannot updateValue on expressions');
    }

    dispose() {
        if (isDisposable(this.leftOperand)) {
            this.leftOperand.dispose();
        }
        if (isDisposable(this.rightOperand)) {
            this.rightOperand.dispose();
        }
    }

    private _status: IStatus | null = null;

    get status(): IStatus | null {
        return this._status || this.leftOperand.status || this.rightOperand.status;
    }

    set status(status: IStatus | null) {
        if (this._status !== status) {
            const oldStatus = this._status;
            this._status = status;
            this.fireEvent(statusChangedEventType, { newStatus: status, oldStatus: oldStatus, bind: this });
        }
    }

    protected evalBoolean?: (leftValue: bindValueType, rightValue: bindValueType) => bindValueType;

    private doBooleanOperation(leftValue: bindValueType, rightValue: bindValueType) {
        if (this.evalBoolean !== undefined) {
            return this.evalBoolean(leftValue, rightValue);
        } else {
            throw new Error(`Operator '${this.operator}' does not support boolean types`);
        }
    }

    protected evalNumber?: (leftValue: bindValueType, rightValue: bindValueType) => bindValueType;

    private doNumericOperation(leftValue: bindValueType, rightValue: bindValueType) {
        if (this.evalNumber !== undefined) {
            return this.evalNumber(leftValue, rightValue);
        } else {
            throw new Error(`Operator '${this.operator}' does not support numeric types`);
        }
    }

    protected evalArray?: (leftValue: bindValueType, rightValue: bindValueType) => bindValueType;

    private doArrayOperation(leftValue: bindValueType, rightValue: bindValueType) {
        if (this.evalArray !== undefined) {
            return this.evalArray(leftValue, rightValue);
        } else {
            throw new Error(`Operator '${this.operator}' does not support array types`);
        }
    }

    protected evalString?: (leftValue: bindValueType, rightValue: bindValueType) => bindValueType;

    private doStringOperation(leftValue: bindValueType, rightValue: bindValueType) {
        if (this.evalString !== undefined) {
            return this.evalString(leftValue, rightValue);
        } else {
            throw new Error(`Operator '${this.operator}' does not support string types`);
        }
    }

    protected evalObject?: (leftValue: bindValueType, rightValue: bindValueType) => bindValueType;

    private doObjectOperation(leftValue: bindValueType, rightValue: bindValueType) {
        if (this.evalObject !== undefined) {
            return this.evalObject(leftValue, rightValue);
        } else {
            throw new Error(`Operator '${this.operator}' does not support object types`);
        }
    }

    private doGetValue(leftValue: bindValueType, rightValue: bindValueType): bindValueType {
        if (leftValue === null || rightValue === null) {
            return null; // one side or the other cannot be evaulated, so pass this information along.
        } else if (leftValue === undefined || rightValue === undefined) {
            return undefined;
        }

        const leftType = this.leftOperand.getType();
        const rightType = this.rightOperand.getType();

        try {
            if (leftType === 'boolean' && rightType === 'boolean') {
                return this.doBooleanOperation(leftValue, rightValue);
            } else if (leftType === 'array') {
                return this.doArrayOperation(leftValue, rightType === 'array' ? rightValue : [rightValue]);
            } else if (rightType === 'array') {
                return this.doArrayOperation([leftValue], rightValue);
            } else if (leftType === 'string') {
                return this.doStringOperation(leftValue, rightType === 'string' ? rightValue : rightValue.toString());
            } else if (rightType === 'string') {
                return this.doStringOperation(leftValue.toString(), rightValue);
            } else if (leftType === 'number' && rightType === 'number') {
                return this.doNumericOperation(leftValue, rightValue);
            } else if (leftType === 'number' && typeof rightValue.valueOf() === 'number') {
                return this.doNumericOperation(leftValue, rightValue.valueOf());
            } else if (leftType === 'number' && rightType === 'boolean') {
                return this.doNumericOperation(leftValue, rightValue ? 1 : 0);
            } else if (rightType === 'number' && typeof leftValue.valueOf() === 'number') {
                return this.doNumericOperation(leftValue.valueOf(), rightValue);
            } else if (rightType === 'number' && leftType === 'boolean') {
                return this.doNumericOperation(leftValue ? 1 : 0, rightValue);
            } else if (this.evalString !== undefined) {
                return this.doStringOperation(leftValue.toString(), rightValue.toString());
            } else if (leftType === 'object' && rightType === 'object') {
                return this.doObjectOperation(leftValue, rightValue);
            } else {
                let type = 'object';
                if (this.evalBoolean === undefined && (leftType === 'boolean' || rightType === 'boolean')) {
                    type = 'boolean';
                }
                if (this.evalNumber === undefined && (leftType === 'number' || rightType === 'number')) {
                    type = 'numeric';
                }

                throw new Error(`Operator '${this.operator}' does not support ${type} types`);
            }
        } catch (e) {
            this.status = Status.createErrorStatus(e.message);
            return null;
        }
    }

    getValue() {
        const leftValue = this.leftOperand.getValue();
        const rightValue = this.rightOperand.getValue();
        return this.doGetValue(leftValue, rightValue);
    }

    getType() {
        const value = this.getValue();
        if (value !== null && value !== undefined) {
            let result: string = typeof value;
            if (result === 'object' && value instanceof Array) {
                result = 'array';
            }
            return result;
        }

        const leftType = this.leftOperand.getType();
        const rightType = this.rightOperand.getType();

        if (leftType === rightType) {
            return leftType;
        } else if (leftType === 'array' || rightType === 'array') {
            return 'array';
        } else if (leftType === 'string' || rightType === 'string') {
            return 'string';
        } else if (leftType === 'number' || rightType === 'number') {
            return 'number';
        } else {
            return 'object';
        }
    }

    isStale() {
        return this.leftOperand.isStale() || this.rightOperand.isStale();
    }

    get readOnly() {
        return ((this.leftOperand.readOnly ? 1 : 0) ^ (this.rightOperand.readOnly ? 1 : 0)) === 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onValueChanged() {
    }

    addEventListener<T extends IEvent>(type: EventType<T | IStatusEvent>, listener: IListener<T>): void {
        this.leftOperand.addEventListener<T>(type, listener);
        this.rightOperand.addEventListener<T>(type, listener);

        if (type === statusChangedEventType) {
            super.addEventListener<T>(type, listener);
        }
    }

    removeEventListener<T extends IEvent>(type: EventType<T | IStatusEvent>, listener: IListener<T>): void {
        this.leftOperand.removeEventListener<T>(type, listener);
        this.rightOperand.removeEventListener<T>(type, listener);

        if (type === statusChangedEventType) {
            super.removeEventListener<T>(type, listener);
        }
    }

    setDeferredMode(deferredMode: boolean, progress: IProgressCounter = nullProgressCounter, forceWrite = false): void {
        this.leftOperand.setDeferredMode(deferredMode, progress, forceWrite);
        this.rightOperand.setDeferredMode(deferredMode, progress, forceWrite);
    }

    getValueCommitted() {
        const leftValue = this.leftOperand.getValueCommitted();
        const rightValue = this.rightOperand.getValueCommitted();
        return this.doGetValue(leftValue, rightValue);
    }

    clearDeferredWrite(): void {
        this.leftOperand.clearDeferredWrite();
        this.rightOperand.clearDeferredWrite();
    }

    isDeferredWritePending(): boolean {
        return this.leftOperand.isDeferredWritePending() || this.rightOperand.isDeferredWritePending();
    }
}


