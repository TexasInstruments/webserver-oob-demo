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
import { IEvent, EventType, IEvents } from '../../../gc-core-assets/lib/Events';
import { IProgressCounter } from './ProgressCounter';
import { IBindValue } from './IBindValue';

/**
 * Listener interface that provides the client with notification when
 * its time to refresh something.
 */
export interface IRefreshEvent extends IEvent {

    /**
	* IProgressCounter instance for the client to indicate progress of
	* asynchronous operations so the client can determine when the refresh operation is fully completed.
	*/
    progress: IProgressCounter;
}

/**
 * Refresh event type.  This is fired when a refresh is required.
 */
export const refreshEventType = new EventType<IRefreshEvent>('onRefresh');

/**
 * This event is fired some amount of time prior to the refresh event.  The amount of time before the
 * refresh that this event is called is set using the **{@link RefreshIntervaleBindValue.setPreRefreshInterval}** method.  If no
 * pre-refresh interval is set, then no pre-refresh event is fired.
 */
export const preRefreshEventType = new EventType<IRefreshEvent>('onPreRefresh');

/**
 * A refresh interval provider is a binding that periodically sends a refresh event to it's listeners.  The value of the binding is the
 * refresh interval in milliseconds.  This is typically used by polling models to schedule read operations.
 * If the value of this binding is set to zero, this binding will fire refresh events as fast as possible.  A negative value will
 * stop the refresh events.
 */
export interface IRefreshIntervalProvider extends IEvents, IBindValue {
    /**
     * Method to start the refresh operation.
     *
     * @param progress progress counter to use for the refresh operation.
     * @returns a promise that resolves with the number of individual refreshes performed.
     */
    onRefresh(progress?: IProgressCounter): Promise<number>;
}

