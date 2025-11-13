/**
 *  Copyright (c) 2021, Texas Instruments Incorporated
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

import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { bindValueType } from '../../gc-core-databind/lib/CoreDatabind';
import { streamingCodecDataType } from '../../gc-model-streaming/lib/StreamingDataModel';
import { AbstractDataCodec, bufferDataType, binaryOrBufferDataType } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ICodecBaseParams } from '../../gc-target-configuration/lib/ICodecBaseParams';
import { MsgPackSerializer, MsgPackDeserializer, errorNotEnoughData } from './internal/MessagePack';

/**
 * Options to control how message pack encodes data.
 */
export interface IMsgPackSeralizerParams {
    /**
     * By default, an integer is encoded using the smallest bit size.
     * This option explicitly controls how an integer is encoded as 8-bit, 16-bit, or 32-bit.
     */
    encodeIntegerBitSize?: 8 | 16 | 32;
}

/**
 * Message pack codec parameters
 */
export interface IMessagePackCodecParams extends ICodecBaseParams, IMsgPackSeralizerParams {
}

export class MessagePackCodec extends AbstractDataCodec<number[] | Buffer | Uint8Array, number[] | Buffer, object, object> {
    private partialData: number[] = [];

    // In normal case, the partial data grows when not receiving a complete packet,
    // and shrinks when a complete packet is received and decoded.
    // If the partial data ever grows, the app will crash, and it is better
    // to log this warning. The lastPartialDataWarningSize is set to a high mark (400K),
    // and is doubled after each warning to avoid flood of warnings.
    private lastPartialDataWarningSize = 400000;

    private console: GcConsole;

    constructor(readonly params: IMessagePackCodecParams) {
        super(params.id || 'messagePackCodec', binaryOrBufferDataType, bufferDataType, streamingCodecDataType, streamingCodecDataType);
        this.console = new GcConsole('gc-codec-message-pack', this.params.id);
    }

    encode(data: bindValueType): void {
        const encodedData = new MsgPackSerializer().serialize(data, this.params);
        // encodedData is Uint8Array, need to change it to number[] for going through cloudagent ws
        // because it uses JSON.stringify(...) on one side and JSON.parse(...) on the other side.
        this.targetEncoder.encode(Array.from(encodedData));
    }

    decode(data: number[] | Uint8Array | Buffer): boolean | Error {
        this.partialData = this.partialData.concat(...data);
        let posHint = 0;
        const mpd = new MsgPackDeserializer(this.partialData);
        while (posHint < this.partialData.length) {
            try {
                const decodedResult = mpd.deserialize(posHint);
                posHint = decodedResult.nextIndex;
                if (decodedResult !== undefined) {
                    this.targetDecoder.decode(decodedResult.data);
                }
            } catch (error) {
                if (error === errorNotEnoughData) {
                    // Wait for next cycle to get more data
                    break;
                } else {
                    posHint++;
                }
            }
        }
        if (posHint > 0) {
            this.partialData = this.partialData.slice(posHint);
        } else if (posHint === 0 && this.partialData.length > this.lastPartialDataWarningSize) {
            // posHint 0 indicates the so-far partial data is not decodable due to incomplete packet.
            // If partialData.length is really big at the same time and keeps growing, it could be
            // the received data does not conform to messagePacket protocol.
            this.console.warning('Received data but cannot decode it. Please check the content of data.');
            this.lastPartialDataWarningSize = 2 * this.lastPartialDataWarningSize;
        }
        return true;
    }

}