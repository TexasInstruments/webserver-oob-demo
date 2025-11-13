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
import { Trigger, ITriggerEvent } from './Trigger';
import { IListener } from '../../../gc-core-assets/lib/Events';

/**
 * Interface for a Trigger that is created using gc.databind.registry.createTrigger() method.
 *
 * @interface
 */

export interface ITrigger {
    /**
     * Sets or retrieves the enable state of the trigger.  A disabled trigger will not call the user's callback
     * even if the trigger condition is met.
     * If this method is called with no parameters, it acts as a getter returning the current enabled state.
     * Otherwise this method acts as a setter for the enabled state and returns the this pointer so that
     * the caller can chain additional calls to methods on this object.
     *
     * @param {boolean} [enable] - if present, the new enabled state for this trigger.
     * @returns {boolean|object} - if getter then the enabled state; otherwise, the this pointer.
     */
    enabled: boolean;

    /**
     * Sets the condition for this trigger to call the user's callback method.
     * The trigger will fire when this condition transitions from false to true, and the trigger is enabled.
     *
     * @param {string} condition - A binding expression, that evaluates to a boolean result, to be used as the condition.
     */
    condition: string;
};

/**
 * Factory method to create instances of event Triggers.
 *
 * @param {function} callback - callback method for when trigger condition is met.
 * @param {string} condition - A binding expression, that evaluates to a boolean result, to be used as the condition.
 * @returns {gc.databind.ITrigger} - newly created ITrigger instance.
 */
export function createTrigger(callback: IListener<ITriggerEvent>, condition: string): ITrigger {
    return new Trigger(callback, condition);
};

