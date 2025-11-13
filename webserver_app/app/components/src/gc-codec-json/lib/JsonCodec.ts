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
import { AbstractDataCodec,  bufferOrStringDataType, stringDataType, ITransport } from '../../gc-target-configuration/lib/TargetConfiguration';
import { streamingCodecDataType } from '../../gc-model-streaming/lib/StreamingDataModel';
import { bindValueType } from '../../gc-core-databind/lib/CoreDatabind';
import { ICodecBaseParams } from '../../gc-target-configuration/lib/ICodecBaseParams';

export class JsonCodec extends AbstractDataCodec<number[] | string | Buffer, string, object, object> {
    private numPacketsReceived = 0;

    constructor(readonly params: ICodecBaseParams) {
        super(params.id || 'json', bufferOrStringDataType, stringDataType, streamingCodecDataType, streamingCodecDataType);
    }

    encode(data: bindValueType): void {
        this.targetEncoder.encode(JSON.stringify(data));
    }

    decode(rawdata: number[] | string | Buffer): boolean | Error {
        let result: boolean | Error = false;
        try {
            let cleanPacket = '';
            const message = typeof rawdata === 'string' ? rawdata : String.fromCharCode(...rawdata);

            try {
                // remove any leading or trailing garbage characters
                cleanPacket = message.substring(message.indexOf('{'), message.lastIndexOf('}') + 1);
                const data = JSON.parse(cleanPacket);
                try {
                    result = this.targetDecoder.decode(data);
                } catch (e) {
                    result = e;
                }
            } catch (e) {
                if (this.numPacketsReceived > 0) {
                    result = Error(`Received bad JSON data string: ${cleanPacket}.`);
                }
            }
            this.numPacketsReceived++;
        } catch (ex) {
            result = new Error('Error converting buffer to text string');
        }
        return result;
    }

    async onConnect(transport: ITransport) {
        this.numPacketsReceived = 0;
    }
}