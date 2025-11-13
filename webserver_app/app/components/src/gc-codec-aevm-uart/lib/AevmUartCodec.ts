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
 * Uart for `Aevm` Codec.
 *
 * @example
 * ```typescript
 * import { AevmUartCodec } from '<path-to>/gc-codec-aevm-uart/lib/AevmUartCodec';
 *
 * const uart = new AevmUartCodec({
 *     baudRate: 9600,
 *     parity: 'none',
 *     characterLength: 8,
 *     stopBits: 1,
 *     unit: 1
 * });
 * ```
 *
 * @packageDocumentation
 */
import { NoopDecoderType, bufferDataType, INoopDecoder, IDataDecoder, IDataEncoder, AbstractCodec, nullDataCodec, ITransport } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ICodecUartBaseParams } from '../../gc-target-configuration/lib/ICodecUartBaseParams';
import { IAevmEncoder, nullAevmEncoder, IAevmEncoderType } from '../../gc-codec-aevm/lib/AevmCodec';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';

export interface IAevmUartCodecParams extends ICodecUartBaseParams {
    parity?: 'none' | 'even' | 'odd' | 'zero' | 'one';
    characterLength?: 5 | 6 | 7 | 8;
    unit?: number;
}

const parityMap = { 'none': 0, 'even': 1, 'odd': 2, 'zero': 3, 'one': 4 };

const UART_TYPE = 0x06;
const enum Cmd {
    Enable,
    Config,
    Write,
    Read,
    DisableReceiver
}

export class AevmUartCodec extends AbstractCodec<INoopDecoder, IAevmEncoder, IDataDecoder<number[]>, IDataEncoder<number[]>> implements IDataEncoder<number[]> {
    protected targetEncoder = nullAevmEncoder;

    protected targetDecoder: IDataDecoder<number[]> = nullDataCodec;

    constructor(readonly params: IAevmUartCodecParams) {
        super(params.id || 'uart', NoopDecoderType, IAevmEncoderType, bufferDataType, bufferDataType);
    }

    /**
     * @hidden
     */
    onConnect(transport: ITransport) {
        return this.configureFirmware();
    }

    async configureFirmware() {
        const params = this.params;
        const unit = params.unit ?? 6;
        const baudRate = params.baudRate ?? 9600;
        const parity = GcUtils.parseStringProperty('parity', params.parity ?? 'none', parityMap);
        const characterLength = GcUtils.parseNumberProperty('characterLength', params.characterLength ?? 8, 5, 8) - 5;
        const stopBits = GcUtils.parseNumberProperty('stopBits', params.stopBits ?? 1, 1, 2) === 1 ? 0 : 1;
        await this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(
            UART_TYPE, unit, Cmd.Enable, [unit, 1], []
        ));
        await this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(
            UART_TYPE, unit, Cmd.Config, [unit, baudRate, parity, characterLength, stopBits], []
        ));
    }

    encode(data: number[]) {
        const unit = this.params.unit ?? 6;
        return this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(
            UART_TYPE, unit, Cmd.Write, [unit, data.length], data));
    }
}
