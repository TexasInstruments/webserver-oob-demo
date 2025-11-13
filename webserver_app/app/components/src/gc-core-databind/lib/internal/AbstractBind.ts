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
import { Events } from '../../../gc-core-assets/lib/Events';
import { IStatus } from './Status';
import { statusChangedEventType, IStatusEvent, IBind } from './IBind';

/**
 * Abstract class that implements IBind interface. Clients should not derive from
 * this class directly. Instead, they need to derive from some of its derived classes:
 * AbstractBindValue or AbstractBindAction.
 */
export abstract class AbstractBind extends Events implements IBind {
    private _status: IStatus | null = null;
    get status(): IStatus | null {
        return this._status;
    };

    set status(status: IStatus | null) {
        if (status !== this._status) {
            if (!(status && status.equals(this._status))) {
                const details: IStatusEvent = { newStatus: status, oldStatus: this._status, bind: this };
                this.onStatusChanged(details);
                this._status = status;
                this.fireEvent(statusChangedEventType, details);
            }
        }
    };

    /**
	 * Derived classes can override this method to be notified for status changes.
	 */
    protected abstract onStatusChanged(details: IStatusEvent): void;

    name?: string;

    toString() {
        return this.name || '';
    };
};


