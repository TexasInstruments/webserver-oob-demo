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
import { IStatus } from './Status';
import { IEvent, EventType, IEvents } from '../../../gc-core-assets/lib/Events';

export const NAME = 'gc-core-databind';

/**
 * Listener interface that provides the client with notification when
 * the status of a bindable object changes.
 */
export interface IStatusEvent extends IEvent {
    oldStatus: IStatus | null;
    newStatus: IStatus | null;
    bind: IBind;
};

export const statusChangedEventType = new EventType<IStatusEvent>('statusChangedListener');

/**
 * The basic bindable object that models provide.
 * Provides status information for the bind.
 *
 * Clients do not implement this interface directly.
 * They need to inherit from AbstractBindValue or AbstractBindAction instead.
 */
export interface IBind extends IEvents {
    /**
	 * The status of this bindable object.
	 */
    status: IStatus | null;

    /**
	 * The name of this bindable object.
	 */
    name?: string;

    /**
	 * The unique identifier for this bindable object.
	 */
    uri?: string;

    toString(): string;
};


