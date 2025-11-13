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
import { IBind } from './IBind';
import { IProgressCounter } from './ProgressCounter';
import { IEvent, EventType } from '../../../gc-core-assets/lib/Events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type bindValueType = any;

/**
 * Value changed event fired when a binding changes its value.
 */
export interface IValueChangedEvent {
    /**
     * New value of binding
     */
    readonly newValue: bindValueType;

    /**
     * Old value of binding
     */
    readonly oldValue: bindValueType;

    /**
     * Progress counter used to track the progress of committing new binding values to the target.
     */
    readonly progress: IProgressCounter;
}

/**
 * Value changed event type.  Used when add and remove listeners.
 */
export const valueChangedEventType = new EventType<IValueChangedEvent>('onValueChanged');

/**
 * Stale binding event, fired when a binding changes between stale and not stale states.
 */
export interface IStaleEvent extends IEvent {
    stale: boolean;
}

/**
 * Stale changed event type.  Used when add and remove listeners.
 */
export const staleChangedEventType = new EventType<IStaleEvent>('onStaleChanged');

/**
 * Streaming data values event fired when new bind values are set, regardless as to whether the new value has
 * changed compared to the old value.
 */
export interface IStreamingDataEvent extends IEvent {
    data: bindValueType;
}

/**
 * Streaming data event type.  Used when add and remove listeners.
 */
export const streamingDataEventType = new EventType<IStreamingDataEvent>('onStreamingDataReceived');

/**
* This interface represents bindable object that has value.
* Setting the value can be a asynchronous operation.
* When getValue() is called it may return a cached value.
*
* If the value of a bindable object cannot be changed for given period its
* isReadOnly() should return true for that period. Setting the value in
* that case will do nothing.
*
* Clients do not implement this class directly.
* They need to inherit from AbstractBindValue instead.
*/
export interface IBindValue extends IBind {
    /**
     * Returns the value of this bindable object.
     * In the case that the model obtains the value asynchronously the value will
     * be returned from an internal cache to conform to a synchronous method.
     */
    getValue(): bindValueType;

    /**
     * Sets the value of this bindable object. Setting the value can be an asynchronous
     * operation. A progress counter is used to mark the completion of asynchronous operations.
     *
     * @param value the new value.
     * @param progress progress counter to keep track of asynchronous operations.
     * @param forceWrite flag indicating the new binding value should be committed to the target even if unchanged.
     */
    setValue(value: bindValueType, progress?: IProgressCounter, forceWrite?: boolean): void;

    /**
     * Updates the value of this bindable object, and notify all listeners. This
     * method is identical to setValue() method except it does not call
     * onValueChanged() even if the value has changed. Derived objects should
     * use this method to update the underlying value instead of setValue().
     * Then derived objects can then use onValueChanged() to detect when the
     * value has been changed by others only.
     *
     * @param value the new value.
     * @param progress optional progress
     *        counter if you wish to keep track of when the new value has
     *        propagated through all bindings bound to this one.
     * @param skipStreamingListeners true, if you do not want
     *        to notify streaming listeners of the new value; for example, if
     *        you are updating the default value before reading the target.
     */
    updateValue(value: bindValueType, progress?: IProgressCounter, skipStreamingListeners?: boolean): void;

    /**
     * The type of the bindable object's value. Usually the class of the value.
     * If the value's type is not going to change, it can be set in the case the value is null.
     *
     * @returns the class of the value, or other class if the value has not been set yet.
     *		   null means the values has not been set yet and also the value can change its type.
     */
    getType(): string | undefined;

    /**
     * This method is used to determine if the value of the binding object is being changed.
     * Stale state means that setValue() has been called, but the real value of the model
     * hasn't been updated yet. The method will be used to determine if changes should be
     * propagated now, or wait until the binding is no longer stale to propagate changes.
     *
     * @returns true if the value is going to change soon; otherwise, false.
     */
    isStale(): boolean;

    /**
     * This method indicates whether or not the value of this bindable object is modifiable or not.
     * If this method returns true, then calling setValue() will do nothing.
     *
     * @returns true if this binding is read only (can't be modified).
     */
    readonly readOnly: boolean;

    /**
     * Enable or disable the deferred mode of operation.  In deferred mode, write operations
     * to the target device are deferred until the deferred mode is cleared.  The value of
     * this binding is not effected by the deferred mode; however, the value on the target
     * may be out of sync with this binding.
     *
     * @param deferredMode true to set deferred mode, and false to clear it.
     * @param forceWrite write deferred value to the target even if the values didn't changed.
     */
    setDeferredMode(deferredMode: boolean, progress?: IProgressCounter, forceWrite?: boolean): void;

    /**
     * Get the value of this binding before any pending deferred write operation.  This method is
     * equivalent to getValue() when not in deferred mode.  So if getValue() and getValueCommitted()
     * return different values, there must be a deferred write operation pending.
     *
     * @returns the value of this binding before any deferred write operations.
     */
    getValueCommitted(): bindValueType;

    /**
     * Clear any pending deferred write for the binding by reverting the pending value to be
     * written to the committed value
     */
    clearDeferredWrite(): void;

    /**
     * Method to test if the committed value is different from the current value for this binding.
     * This method returns true if the current values is different than the committed value (the
     * original value before deferred mode was enabled).  This method will always return false when
     * deferred mode is off.
     *
     * @returns true if the bind value has been changed in deferred mode.
     */
    isDeferredWritePending(): boolean;

    /**
     * Optional method that is called when the model that this binding belongs to is disconnected from
     * the target.
     */
    onDisconnected?(): void;

    /**
     * Optional method for receiving streaming data into this binding.
     *
     * @param data next binding data value received
     */
    onStreamingDataReceived?(data: bindValueType): void;

    /**
     * Optional flag indicating that this binding should not be saved when saving binding values to file.
     */
    excludeFromStorageProviderData?: boolean;
}