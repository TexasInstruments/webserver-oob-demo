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

/* eslint-disable @typescript-eslint/camelcase */

/**
 * Uart interface for Usb2any Codec.
 *
 * @example
 * ```typescript
 * import { Usb2anyUartCodec } from '<path-to>/gc-codec-usb2any-uart/lib/Usb2anyUartCodec';
 *
 * const uart = new Usb2anyUartCodec({
 *     baudRate: 9600,
 *     parity: 'none',
 *     bitDirection: 'lsb',
 *     characterLength: 8,
 *     stopBits: 1
 * });
 * ```
 *
 * @packageDocumentation
 */
import { Command, IUsb2anyEncoder, IUsb2anyEncoderType, nullUsb2anyEncoder } from '../../gc-codec-usb2any/lib/Usb2anyCodec';
import {  NoopDecoderType, bufferDataType, INoopDecoder, IDataDecoder, IDataEncoder, AbstractCodec, nullDataCodec, ITransport } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ICodecUartBaseParams } from '../../gc-target-configuration/lib/ICodecUartBaseParams';
import { IReceivePacketEvent, receivePayloadEventType } from '../../gc-target-configuration/lib/ICodecAnalogControllerBaseParams';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';

const parityMap = { 'none': 0, 'even': 1, 'odd': 2 };
const bitDirectionMap = { 'lsb': 0, 'msb': 1 };

const baudRateMap = {
    '9600': 0,
    '19200': 1,
    '38400': 2,
    '57600': 3,
    '115200': 4,
    '230400': 5,
    '300': 6,
    '320': 7,
    '600': 8,
    '1200': 9,
    '2400': 10,
    '4800': 11
};

export interface IUsb2anyUartCodecParams extends ICodecUartBaseParams {
    parity?: 'none' | 'even' | 'odd';
    bitDirection?: 'lsb' | 'msb';
    characterLength?: 7 | 8;
}

export class Usb2anyUartCodec extends AbstractCodec<INoopDecoder, IUsb2anyEncoder, IDataDecoder<number[]>, IDataEncoder<number[]>> implements IDataEncoder<number[]> {
    protected targetEncoder = nullUsb2anyEncoder;

    protected targetDecoder: IDataDecoder<number[]> = nullDataCodec;

    protected receivePacketEventListsener = (details: IReceivePacketEvent) => {
        this.targetDecoder.decode(details.payload);
    };

    constructor(readonly params: IUsb2anyUartCodecParams) {
        super(params.id || 'uart', NoopDecoderType, IUsb2anyEncoderType, bufferDataType, bufferDataType);
    }

    /**
     * @hidden
     */
    async onDisconnect(transport: ITransport) {
        this.targetEncoder.removeEventListener(receivePayloadEventType, this.receivePacketEventListsener);
    }

    /**
     * @hidden
     */
    onConnect(transport: ITransport) {
        this.targetEncoder.addEventListener(receivePayloadEventType, this.receivePacketEventListsener);
        return this.configureFirmware();
    }

    async configureFirmware() {
        const params = this.params;
        const baudRate = GcUtils.parseStringProperty('baudRate', '' + params.baudRate ?? '9600', baudRateMap);
        const parity = GcUtils.parseStringProperty('parity', params.parity ?? 'none', parityMap);
        const bitDirection = GcUtils.parseStringProperty('bitDirection', params.bitDirection ?? 'lsb', bitDirectionMap);
        const characterLength = 8 - GcUtils.parseNumberProperty('characterLength', params.characterLength ?? 8, 7, 8);
        const stopBits = GcUtils.parseNumberProperty('stopBits', params.stopBits ?? 1, 1, 2) === 1 ? 0 : 1;

        await this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_UART_Control, [
            baudRate, parity, bitDirection, characterLength, stopBits
        ]));
        await this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_UART_SetMode, [0]));
    }

    encode(data: number[]) {
        return this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_UART_Write, data));
    }
}
