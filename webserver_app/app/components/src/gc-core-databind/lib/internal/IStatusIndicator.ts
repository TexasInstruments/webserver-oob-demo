/**
 * Copyright (c) 2021, Texas Instruments Incorporated
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

import { StatusType } from './Status';

/**
 * A Status Indicator is used to show error, warning, and info messages overlaid on
 * any widget.  This interfaces allows clients to add and remove messages as needed
 * on a particular status indicator.  An error widget will be created and destroyed
 * as needed to show error, warning, or info messages.
 */
export interface IStatusIndicator {

    /**
     * Add a status messages to be displayed to the user for this indicator.  Old message
     * are not lost, but may be hidden by the new status message if there isn't room to show
     * all status messages for a given indicator.  If no type is provided, error is assumed.
     *
     * @param message - the new message to be added to this status indicator.
     * @param the type of new message to be added to this status indicator.  Error type is default.
     */
    addMessage(message: string, type?: StatusType): void;

    /**
     * Remove a status messages previously added to this indicator.  If there are more
     * than one message added to an indicator, the other status messages will not be lost.
     *
     * @param message - the old message to remove from this status indicator.
     */
    removeMessage(message: string): void;
}
