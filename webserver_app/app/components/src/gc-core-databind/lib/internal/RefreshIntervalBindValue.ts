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
import { bindValueType, IValueChangedEvent } from './IBindValue';
import { VariableBindValue } from './VariableBindValue';
import { ProgressCounter, IProgressCounter } from './ProgressCounter';
import { refreshEventType, preRefreshEventType, IRefreshIntervalProvider } from './IRefreshIntervalProvider';

/**
 * Class that implements IBindValue for a refresh interval value.  Clients can
 * set the interval (in milliseconds) by calling setValue().  Also, clients can
 * register for onRefresh() listeners that will be called periodically based on
 * the current refresh interval.  This class is useful for providing the polling
 * events other bindings that need to poll to detect changes.
 *
 * @constructor
 * @extends gc.databind.VariableBindValue
 * @implements gc.databind.IValueBind
 */
export class RefreshIntervalBindValue extends VariableBindValue implements IRefreshIntervalProvider {
    private doOnRefresh: () => void;
    private doOnResetTimer: () => void;
    private hasListeners: boolean = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private timer: any;  // a token retrieved from setTimeout() and passed back to clearTimeout().

    constructor(defaultValue: bindValueType = 100) {
        super(defaultValue);

        this.doOnRefresh = this.onRefresh.bind(this);
        this.doOnResetTimer = this.onResetTimer.bind(this);

        this.addEventListenerOnFirstAdded(refreshEventType, () => {
            this.hasListeners = true;
            this.onResetTimer();
        });

        this.removeEventListenerOnLastRemoved(refreshEventType, () => {
            this.hasListeners = false;
        });
    }

    excludeFromStorageProviderData = true;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected onValueChanged(details: IValueChangedEvent) {
        this.excludeFromStorageProviderData = false;
        this.onResetTimer();  // kick start timer in case new value is not negative.
    }

    dispose() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }

    async onRefresh(progressCounter?: IProgressCounter) {
        // clear outstanding timer if there is one.
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        let progress: IProgressCounter = new ProgressCounter();
        this.fireEvent(preRefreshEventType, { progress });
        progress.done();
        if (progress.getProgress() < 100) {  // test if promise is resolve without waiting for next clock tick.
            await progress.promise;
        }

        progress = progressCounter ?? new ProgressCounter(this.doOnResetTimer);
        this.fireEvent(refreshEventType, { progress });
        progress.done();

        return await progress.promise;
    }

    protected onResetTimer() {
        // only restart the timer if we have listeners and a timer is not pending.
        if (this.timer === undefined && this.hasListeners) {
            const delay = this.getValue();
            if (delay >= 0) {
                this.timer = setTimeout(this.doOnRefresh, delay);
            }
        }
    }

    onDisconnected() {
        if (this.timer === undefined && this.hasListeners) {
            const delay = this.getValue();
            if (delay < 0) {
                // kick start a refresh in case we aren't polling, and we need to queue up one read operation for the next
                // time we connect.
                this.onRefresh();
            }
        }
    }
}
