/**
 *  Copyright (c) 2020, Texas Instruments Incorporated
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
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS'
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
import { IDisposable } from './IDisposable';
import { ITrigger } from './ITrigger';
import { IBindValue, IValueChangedEvent, bindValueType, valueChangedEventType } from './IBindValue';
import { IListener, IEvent } from '../../../gc-core-assets/lib/Events';
import { bindingRegistry } from './BindingRegistry';
import { IProgressCounter } from './ProgressCounter';

export interface ITriggerEvent extends IEvent {
    progress: IProgressCounter;
};

/**
 * Concrete Class for a Trigger that fires a user callback when a condition is met.
 *
 * @constructor
 * @implements {gc.databind.ITrigger}
 */

export class Trigger implements ITrigger, IDisposable {
    constructor(private triggerEventCallback: IListener<ITriggerEvent>, condition: string) {
        this.condition = condition;
        this.onChangedListener = (details) => this.onValueChanged(details);
    }
    private conditionBind: IBindValue | null = null;
    private cachedValue: bindValueType;
    private _enabled = true;
    private onChangedListener: IListener<IValueChangedEvent>;

    get enabled() {
        return this._enabled;
    }
    set enabled(enabled: boolean) {
        enabled = !!enabled;
        if (this._enabled !== enabled) {
            if (enabled && this.conditionBind) {
                this.conditionBind.addEventListener(valueChangedEventType, this.onChangedListener);
            } else if (this.conditionBind) {
                this.conditionBind.removeEventListener(valueChangedEventType, this.onChangedListener);
            }
            this._enabled = enabled;
        }
    };

    protected onValueChanged(details: IValueChangedEvent) {
        if (this.conditionBind) {
            const newValue = !!this.conditionBind.getValue();
            if (this.cachedValue !== newValue) {
                this.cachedValue = newValue;
                if (newValue && this._enabled) {
                    this.triggerEventCallback(details);
                }
            }
        }
    };

    /**
     * Sets the condition for this trigger to call the users callback method.
     * The trigger will fire when this condition transitions from false to true, and the trigger is enabled.
     *
     * @param {string} condition - A binding expression, that evaluates to a boolean result, to be used as the condition.
     * @returns {boolean|object} - if getter then the enabled state; otherwise, the this pointer.
     */
    set condition(newCondition: string) {
        // remove listener from old condition if there was one.
        if (this.conditionBind && this._enabled) {
            this.conditionBind.removeEventListener(valueChangedEventType, this.onChangedListener);
        }

        // get new condition binding
        this.conditionBind = newCondition && bindingRegistry.getBinding(newCondition) || null;

        // add listener if we are enabled
        if (this.conditionBind && this._enabled) {
            this.conditionBind.addEventListener(valueChangedEventType, this.onChangedListener);
        }

        // initialize fCachedValue so we can detect changes going forward in order to fire events.
        this.cachedValue = !!(this.conditionBind && this.conditionBind.getValue());
    };

    dispose() {
        if (this.conditionBind) {
            this.conditionBind.removeEventListener(valueChangedEventType, this.onChangedListener);
            this.conditionBind = null;
        }
    };

};

