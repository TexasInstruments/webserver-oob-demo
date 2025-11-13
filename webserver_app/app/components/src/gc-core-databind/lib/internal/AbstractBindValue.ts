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
import { AbstractBind } from './AbstractBind';
import { IBindValue, bindValueType, IValueChangedEvent, valueChangedEventType, streamingDataEventType, staleChangedEventType } from './IBindValue';
import { IStatusEvent } from './IBind';
import { IProgressCounter, nullProgressCounter } from './ProgressCounter';

/* eslint-disable @typescript-eslint/no-unused-vars */

export let blockNewEditUndoOperationCreation = false;

/**
 * Abstract class that implements IBindValue interface. Clients can either
 * instantiate this class directly or create classes derived from it for
 * their value bindable object.
 *
 */
export abstract class AbstractBindValue extends AbstractBind implements IBindValue {
    constructor(protected defaultType?: string) {
        super();
    }
    protected cachedValue: bindValueType;
    private stale = false;

    /**
     * Perform a deep compare on two values to determine if they have changes.
     * written to the committed value
     *
     * @returns {boolean} true if the new value is not the same as the current value.
     */
    isValueNotEqualTo(newValue: bindValueType): boolean {
        const oldValue = this.cachedValue;
        if (newValue instanceof Array && oldValue instanceof Array && newValue.length === oldValue.length) {
            // compare all elements of the array
            for (let i = newValue.length; i-- > 0;) {
                if (newValue[i] !== oldValue[i]) {
                    return true;
                }
            }
            return false;
        }
        return (newValue !== oldValue && ((typeof newValue !== 'number') || !isNaN(newValue) || (typeof oldValue !== 'number') || !isNaN(oldValue)));
    }

    /**
     * Sets the value of this bindable object. Setting the value can be an
     * asynchronous operation. If the caller is interested in knowing when the
     * operation is complete, they will pass in an
     * {gc.databind.IProgressCounter} object to keep track of the progress till
     * completion. This class implements this method and calls {#onValueChanged}
     * if the new value is in fact different. It also notifies IValueChanged
     * listeners and passes along the progress counter to them as well. Clients
     * should not override this method. Instead they should override
     * {#onValueChanged} instead.
     *
     * @param {Object} value - the new value.
     * @param {gc.databind.IProgressCounter} [progress] - notification when the
     *        value is set in the model.
     */
    setValue(value: bindValueType, progress: IProgressCounter = nullProgressCounter, forceWrite?: boolean) {
        const blockEditOperation = blockNewEditUndoOperationCreation;
        blockNewEditUndoOperationCreation = true;  // tell widget model to not create Undo/Redo actions based on target data changes.
        try {
            if (!this.readOnly && (forceWrite || this.isValueNotEqualTo(value))) {
                const oldValue = this.cachedValue;
                this.cachedValue = value;
                const details: IValueChangedEvent = { newValue: value, oldValue: oldValue, progress: progress };
                this.onValueChanged(details);
                this.fireEvent(valueChangedEventType, details);
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
        } finally {
            blockNewEditUndoOperationCreation = blockEditOperation;
        }
    }

    /**
     * Updates the value of this bindable object, and notify all listeners. This
     * method is identical to setValue() method except it does not call
     * onValueChanged() even if the value has changed. Derived objects should
     * use this method to update the underlying value instead of setValue().
     * Then derived objects can then use onValueChanged() to detect when the
     * value has been changed by others only.
     *
     * @protected
     * @param {Object} value - the new value.
     * @param {gc.databind.IProgressCounter} [progress] - optional progress
     *        counter if you wish to keep track of when the new value has
     *        propagated through all bindings bound to this one.
     * @param {Boolean} [skipStreamingListeners] - true, if you do not want
     *        to notify streaming listeners of the new value; for example, if
     *        you are updating the default value before reading the target.
     */
    updateValue(value: bindValueType, progress: IProgressCounter = nullProgressCounter, skipStreamingListeners?: boolean) {
        const blockEditOperation = blockNewEditUndoOperationCreation;
        blockNewEditUndoOperationCreation = true;  // tell widget model to not create Undo/Redo actions based on target data changes.
        try {
            if (this.isValueNotEqualTo(value)) {
                const oldValue = this.cachedValue;
                this.cachedValue = value;
                const details: IValueChangedEvent = { newValue: value, oldValue: oldValue, progress: progress };
                this.fireEvent(valueChangedEventType, details);
            }

            if (!skipStreamingListeners) {
                this.fireEvent(streamingDataEventType, { data: value });
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
        } finally {
            blockNewEditUndoOperationCreation = blockEditOperation;
        }
    }

    /**
     * Returns the value of this bindable object. In the case that the model
     * obtains the value asynchronously the value will be returned from an
     * internal cache to conform to a synchronous method.
     *
     * @return {Object} the value of this bindable object. The value will be
     *         returned from an internal cache.
     */
    getValue() {
        return this.cachedValue;
    }

    /**
     * The type of the bindable object's value. Usually the class of the value.
     * If the value's type is not going to change, it can be set in the case the
     * value is null.
     *
     * @return {string} the class of the value, or other class if the value has
     *         not been set yet. null means the values has not been set yet and
     *         also the value can change its type.
     */
    getType(): string | undefined {
        let result = this.defaultType;
        if (this.cachedValue !== undefined && this.cachedValue !== null) {
            result = typeof this.cachedValue;
            if (this.cachedValue instanceof Array) {
                result = 'array';
            }
        }
        return result;
    }

    /**
     * Method to change the bindable object's default type. The default type is
     * used when the current value is undefined or null.
     *
     * @param {string} the new default type of the value.
     */
    setDefaultType(defaultType: string) {
        this.defaultType = defaultType;
    }

    /**
     * Notification when the value of this bindable object changes. Derived
     * classes can override this method to be notified of changes caused by
     * setValue() method calls. The default implementation of this method does
     * nothing. If this method is a proxy for an asynchronous operation then use
     * the progress counter provided to record the progress and completion of
     * this operation.
     *
     * @protected
     * @param {Object} oldValue - the old value.
     * @param {Object} newValue - the new value.
     * @param {gc.databind.IProgressCounter} progress - progress counter to keep
     *        track of when this value has been truely set.
     */
    protected abstract onValueChanged(details: IValueChangedEvent): void;

    toString() {
        if (this.cachedValue === undefined) {
            return super.toString();
        } else if (this.cachedValue === null) {
            return 'null';
        }
        return this.cachedValue.toString();
    }

    /**
     * This method is used to determine if the value of the binding object is
     * being changed. Stale state means that setValue() has been called, but the
     * real value of the model hasn't been updated yet. The method will be used
     * to determine if changes should be propagated now, or wait until the
     * binding is no longer stale to propagate changes.
     *
     * @return {boolean} true if the value is going to change soon; otherwise,
     *         false.
     */
    isStale(): boolean {
        return this.stale;
    }

    /**
     * Derived classes can call this method to set the stale state of the
     * object.
     *
     * @param {boolean} stale - if the value of stale or not.
     */
    setStale(stale: boolean = false) {
        if (this.stale !== stale) {
            this.stale = stale;
            this.fireEvent(staleChangedEventType, { stale: stale });
        }
    }

    /**
     * This method indicates whether or not the value of this bindable object is
     * modifiable or not. If this method returns true, then calling setValue()
     * will do nothing.
     *
     * @returns {boolean} true if this binding is read only (can't be modified).
     */
    get readOnly(): boolean {
        return false;
    }

    protected deferredMode = false;
    protected committedValue: bindValueType;

    setDeferredMode(deferredMode: boolean = false, progress: IProgressCounter = nullProgressCounter, forceWrite = false) {
        if (deferredMode !== this.deferredMode) {
            this.deferredMode = deferredMode;
            this.committedValue = this.cachedValue;
        }
    }

    isDeferredWritePending() {
        return this.deferredMode && this.isValueNotEqualTo(this.committedValue);
    }

    getValueCommitted() {
        return this.deferredMode ? this.committedValue : this.cachedValue;
    }

    clearDeferredWrite() {
        if (this.deferredMode) {
            this.updateValue(this.committedValue, undefined, true);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    protected onStatusChanged(details: IStatusEvent) {
    }
}
