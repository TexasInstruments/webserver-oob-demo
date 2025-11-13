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

/**
 *  There are two status types - error or warning.
 *  Different types are displayed with different visual cues in the widgets.
 */
export enum StatusType {
    /** An error status type */
    ERROR = 0,
    /** A warning status type */
    WARNING = 1,
    /** An informational status type */
    INFO = 2
}

/**
 * Additional information like error or warning message that the model can provide
 * to the widget. Most GUI Composer widgets show the status as a small error or
 * warning icon to the top left of the widget.
 */
export interface IStatus {
    /**
	 *  There are two status types - error or warning.
	 *  Different types are displayed with different visual clues in the widgets.
	 */
    readonly type: StatusType;

    /**
	 * The messages displayed to the user when she hovers the status icon with the mouse.
	 */
    readonly message: string;

    /**
	 * Unique string that can be used to identify the type of error or warning
	 * in client's scripts. Once ids are defined they should not be changed because
	 * older scripts will expect the previously published values.
	 *
	 * Can be an empty string. It can be specific to a given model or shared between models.
	 */
    readonly id?: string;

    equals(status: IStatus | null): boolean;
}

/**
 * A factory for creating IStatus objects.
 *
 * @constructor
 * @implements gc.databind.IStatus
 */
export class Status implements IStatus {
    equals(status: IStatus | null) {
        return (status && status.message === this.message && status.type === this.type && status.id === this.id) || false;
    }
    private constructor(public readonly type: StatusType, public readonly message: string, public readonly id?: string) {
    }
    /**
	 * Factory method to create an IStatus object
	 *
	 */
    static createStatus(type?: StatusType, message?: string, id?: string) {
        // if no error message, then return OK status for all types.
        if (message === undefined) {
            return null;
        }

        type = type || StatusType.ERROR;

        return new Status(type, message, id);
    }
    /**
	 * Factory method to create an ERROR IStatus object
	 *
	 */
    static createErrorStatus(message: string, id?: string) {
        return this.createStatus(StatusType.ERROR, message, id);
    }

    /**
	 * Factory method to create a WARNING IStatus object
	 *
	 */
    static createWarningStatus(message: string, id?: string) {
        return this.createStatus(StatusType.WARNING, message, id);
    }
}

