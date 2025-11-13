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

/**
 * Base parameters for all transports, models, and codecs.
 */
export interface ICodecBaseParams {
    /**
     * Identifier.  This is used to register a transport, model, and or codec with the codec registry.  If not provided, this codec
     * will not be registered with the codec registry, and cannot be referenced in the active configuration.
     */
    id?: string;

    /**
     * Optional, unique identifier for a particular device in you target configuration.  This is used to associate program loaders
     * and models to particular devices in a multi-device configuration, so that the connection manager can do device specific connections.
     * It can also be used to reference properties for the transport, model, or codec that are device specific.  This way, you can
     * define multiple target devices in your system, and switch between them by just changing one deviceId property in one
     * or more codecs; for example.
     */
    deviceId?: string;

    /**
     * Transports, models, or codecs that are marked with the optional property are not considered to be necessary for a successful connection.
     * As a result, if optional transports, models, or codes fail to connect, the entire connection is not aborted and you can end up
     * in a partially connected state.
     */
    optional?: boolean;
}