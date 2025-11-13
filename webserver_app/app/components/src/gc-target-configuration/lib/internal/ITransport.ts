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

import { IEvents, IEvent, EventType } from '../../../gc-core-assets/lib/Events';
import { IConnectionLog } from './AbstractCodec';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IAbortEvent extends IEvent {
}

export const abortEventType = new EventType<IAbortEvent>('abort');

export interface ITransport extends IEvents, IConnectionLog {
    /**
     * Current state of the transport.
     */
    readonly state: TRANSPORT_STATE;

    /**
     * Latest progress message generated during connection.  Typically shown in the status bar.
     */
    readonly progressMessage: string;

    /**
     * tooltip message to go with the progressMessage.
     */
    readonly tooltipMessage?: string;

    /**
     * `true` if this transport's progressMessage is an error message
     */
    hasErrors: boolean;

    /**
     * `true` if this transport's progressMessage is a warning message
     */
    hasWarnings: boolean;

    /**
     * Method to connect a transport.
     */
    connect(failedDevicesList?: Array<string>): Promise<void>;

    /**
     * Method to disconnect a transport.
     */
    disconnect(): Promise<void>;

    /**
     * Transport is in a connected state.
     */
    readonly isConnected: boolean;

    /**
     * Transport is in a state that allows it to be connected.
     */
    readonly canConnect: boolean;

    /**
     * Transport is in a disconnected state.
     */
    readonly isDisconnected: boolean;

    /**
     * Transport is in a state that allows it to be disconnected.
     */
    readonly canDisconnect: boolean;

    /**
     * Unique identifier of the transport.  Used to register transports with the connection manager.
     */
    readonly id: string;

    /**
     * description of the transport when connected to the target, typically shown in the status bar.
     */
    readonly connectionDescription?: string;

    /**
     * True if the connection is only partially connected.  Partial connection can result when one or more
     * transports, models, or codes are optional.
     */
    readonly isPartiallyConnected: boolean;

    /**
     * True if this transport is and XdsTransport, and therefore required for loading or flashing programs on the target.
     */
    readonly isXdsTransport: boolean;
}

export enum TRANSPORT_STATE {
    DISCONNECTED = 'disconnected',
    CONNECTED = 'connected',
    CONNECTING = 'connecting',
    DISCONNECTING = 'disconnecting'
}
/**
 * Event details for a connected state change event.
 */
export interface IConnectedStateChangedEvent extends IEvent {
    newState: TRANSPORT_STATE;
    transport: ITransport;
}

/**
 * Connected state change event type.
 */
export const connectedStateChangedEventType = new EventType<IConnectedStateChangedEvent>('ConnectedStateChanged');

