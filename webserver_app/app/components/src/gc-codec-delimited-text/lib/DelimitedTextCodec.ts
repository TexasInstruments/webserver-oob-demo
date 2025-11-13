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
import { AbstractDataCodec, bufferOrStringDataType, stringDataType, ITransport } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ICodecBaseParams } from '../../gc-target-configuration/lib/ICodecBaseParams';

export interface IDelimitedTextCodecParams extends ICodecBaseParams {
    delimiter?: string;
    escapeChar?: string;
}

export class DelimitedTextCodec extends AbstractDataCodec<string | number[] | Buffer, string, string, string | number[] | Buffer> {
    private partialMessage = '';
    private delimiter: string;
    escapeChar?: string;

    constructor(readonly params: IDelimitedTextCodecParams) {
        super(params.id || 'DelimitedTextCodec', bufferOrStringDataType, stringDataType, stringDataType, bufferOrStringDataType);
        this.delimiter = params.delimiter || '\n';
        this.escapeChar = params.escapeChar;
    }

    encode(data: number[] | string) {
        let message = data instanceof Array ? String.fromCharCode.apply(null, data) : data as string;

        if (this.escapeChar) {
            message = message.split(this.escapeChar).join(this.escapeChar + this.escapeChar);
            message = message.split(this.delimiter).join(this.escapeChar + this.delimiter);
        }
        this.targetEncoder.encode(message + this.delimiter);
    }

    decode(rawdata: number[] | string): boolean | Error {
        let result: boolean | Error = false;
        try {
            const message = typeof rawdata === 'string' ? rawdata : String.fromCharCode.apply(null, rawdata);
            const packets = (this.partialMessage + message).split(this.delimiter);
            const size = packets.length - 1;
            for (let i = 0; i < size; i++) {
                let packet = packets[i];
                if (this.escapeChar) {
                    if (packet.endsWith(this.escapeChar)) {
                        packets[i+1] = packet + this.delimiter + packets[i+1];
                        continue;
                    }
                    packet = packet.split(this.escapeChar + this.delimiter).join(this.delimiter);
                    packet = packet.split(this.escapeChar + this.escapeChar).join(this.escapeChar);
                }
                result = this.targetDecoder.decode(packet);
            }
            this.partialMessage = packets[size];
        } catch (ex) {
            result = new Error('Error converting buffer to text string');
        }
        return result;
    }

    async onConnect(transport: ITransport) {
        this.partialMessage = '';
    }
}
