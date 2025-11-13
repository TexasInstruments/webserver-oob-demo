/**
 *  Copyright (c) 2020, 2021, Texas Instruments Incorporated
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
 * SPI interface for Usb2any Codec.
 *
 * @example
 * ```typescript
 * import { Usb2anySpiCodec } from '<path-to>/gc-codec-usb2any-spi/lib/Usb2anySpiCodec';
 *
 * const spi = new Usb2anySpiCodec({
 *     clockPhase: 'first',
 *     clockPolarity: 'high',
 *     bitDirection: 'msb',
 *     characterLength: 8,
 *     latchType: 'packet',
 *     latchPolarity: 'low',
 *     clockDivider: 6
 * });
 * ```
 *
 * @packageDocumentation
 */
import { IRegisterModelEncoder, RegisterModelEncoderType, RegisterModelDecoderType, IRegisterModelDecoder, nullRegisterModelDecoder } from '../../gc-model-register/lib/RegisterModel';
import { Command, getResult, IUsb2anyEncoder, IUsb2anyEncoderType, nullUsb2anyEncoder } from '../../gc-codec-usb2any/lib/Usb2anyCodec';
import { NoopDecoderType, AbstractCodec, INoopDecoder, ITransport } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ICodecSpiBaseParams } from '../../gc-target-configuration/lib/ICodecSpiBaseParams';
import { IRegisterInfo } from '../../gc-model-register/lib/IRegisterInfo';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';

export interface IUsb2anySpiCodecParams extends ICodecSpiBaseParams {
    // For configure firmware
    clockPhase?: 'following' | 'first';
    clockPolarity?: 'low' | 'high';
    bitDirection?: 'lsb' | 'msb';
    characterLength?: 7 | 8;
    latchType?: 'byte' | 'packet' | 'word' | 'no_cs' | 'pulse_after_packet';
    latchPolarity?: 'high' | 'low';
    clockDivider?: number;

    // For read or write
    readBitOffset?: number; // exclusive with writeBitOffset
    writeBitOffset?: number; // exclusive with readBitOffset
}

export class Usb2anySpiCodec extends AbstractCodec<INoopDecoder, IUsb2anyEncoder, IRegisterModelDecoder, IRegisterModelEncoder> implements IRegisterModelEncoder {
    protected targetEncoder = nullUsb2anyEncoder;

    encoderInputType = RegisterModelEncoderType;
    encoderOutputType = RegisterModelDecoderType;
    protected targetDecoder = nullRegisterModelDecoder;

    private dataBitsMask = 0;
    private dataBitsOffset = 0;
    private addressBitsMask = 0;
    private addressBitsOffset = 0;
    private parity?: number | undefined;
    private parityBitsOffset = 0;
    private writeFlag = 0;
    private readFlag = 0;
    private readWriteData = [0];

    constructor(readonly params: IUsb2anySpiCodecParams) {
        super(params.id || 'spi', NoopDecoderType, IUsb2anyEncoderType, RegisterModelDecoderType, RegisterModelEncoderType);
    }

    /**
     * @hidden
     */
    onConnect(transport: ITransport) {
        const params = this.params;
        const dataBits = params.dataBits ?? 8;
        this.dataBitsMask = (1 << dataBits) -1;
        this.dataBitsOffset = params.dataBitsOffset ?? 0;

        const addressBits = params.addressBits ?? 6;
        this.addressBitsMask = (1 << addressBits) - 1;
        this.addressBitsOffset = params.addressBitsOffset ?? 8;

        const parityMap = { 'even': 0, 'odd': 1 };
        if (params.parity !== undefined) {
            this.parity = GcUtils.parseStringProperty('parity', params.parity, parityMap);
        }
        this.parityBitsOffset = params.parityBitsOffset ?? 0;

        let bitSize;
        this.writeFlag = 0;
        this.readFlag = 0;
        if (params.readBitOffset !== undefined) {
            bitSize = params.readBitOffset;
            this.readFlag = 1 << bitSize;
        } else if (params.writeBitOffset !== undefined) {
            bitSize = params.writeBitOffset;
            this.writeFlag = 1 << bitSize;
        } else {
            bitSize = 14;
            this.writeFlag = 1 << bitSize;
        }

        bitSize = Math.max(bitSize,
            addressBits + this.addressBitsOffset, dataBits + this.dataBitsOffset, this.parityBitsOffset);
        const byteSize = (bitSize+7)>>3;
        this.readWriteData = [byteSize];
        for (let i = 0; i < byteSize; i++) {
            this.readWriteData.push(0);
        }

        return this.configureFirmware();
    }

    configureFirmware(): Promise<void> {
        const clockPhaseMap = { 'following': 0, 'first': 1 };
        const clockPolarityMap = { 'low': 0, 'high': 1 };
        const bitDirectionMap = { 'lsb': 0, 'msb': 1 };
        const latchTypeMap = { 'byte': 0, 'packet': 1, 'word': 2, 'no_cs': 3, 'pulse_after_packet': 255 };
        const latchPolarityMap = { 'high': 0, 'low': 1 };

        const clockPhase = GcUtils.parseStringProperty('clockPhase', this.params.clockPhase ?? 'first', clockPhaseMap);
        const clockPolarity = GcUtils.parseStringProperty('clockPolarity', this.params.clockPolarity ?? 'low', clockPolarityMap);
        const bitDirection = GcUtils.parseStringProperty('bitDirection', this.params.bitDirection ?? 'msb', bitDirectionMap);
        const characterLength = 8 - GcUtils.parseNumberProperty('characterLength', this.params.characterLength ?? 8, 7, 8);
        const latchType = GcUtils.parseStringProperty('latchType', this.params.latchType ?? 'packet', latchTypeMap);
        const latchPolarity = GcUtils.parseStringProperty('latchPolarity', this.params.latchPolarity ?? 'low', latchPolarityMap);

        const divider = this.params.clockDivider ?? 1;
        const dividerHigh = (divider >>> 8 ) & 0xFF;
        const dividerLow = divider & 0xFF;

        return this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_SPI_Control, [
            clockPhase, clockPolarity, bitDirection, characterLength, latchType, latchPolarity, dividerHigh, dividerLow
        ])) as unknown as Promise<void>;
    }

    private getDataResult(data: number[]) {
        const command = getResult(data);
        if (this.parity !== undefined && this.parity !== GcUtils.computeParity(command, this.readWriteData[0] * 8)) {
            throw Error('parity error on register data received');
        }
        return (command >>> this.dataBitsOffset) & this.dataBitsMask;
    }

    async readValue(info: IRegisterInfo, coreIndex?: number) {
        let command = this.readFlag | (((info.addr || 0) & this.addressBitsMask) << this.addressBitsOffset);
        if (this.parity !== undefined) {
            const parity = this.parity ^ GcUtils.computeParity(command, this.readWriteData[0] * 8);
            command = command | (parity << this.parityBitsOffset);
        }

        GcUtils.setBytes(this.readWriteData, this.readWriteData[0], command, 1);
        const result = await this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_SPI_WriteAndRead, this.readWriteData));
        return this.getDataResult(result);
    }

    async writeValue(info: IRegisterInfo, value: number, coreIndex?: number) {
        let command = this.writeFlag |
                        (((info.addr || 0) & this.addressBitsMask) << this.addressBitsOffset) |
                        ((value & this.dataBitsMask) << this.dataBitsOffset);

        if (this.parity !== undefined) {
            const parity = this.parity ^ GcUtils.computeParity(command,  this.readWriteData[0] * 8);
            command = command | (parity << this.parityBitsOffset);
        }

        GcUtils.setBytes(this.readWriteData, this.readWriteData[0], command, 1);
        return this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_SPI_WriteAndRead, this.readWriteData)) as unknown as Promise<void>;
    }
}
