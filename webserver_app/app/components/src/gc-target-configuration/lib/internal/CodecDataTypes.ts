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
import { IDecoder, IEncoder, IDataDecoder, IDataEncoder, INoopEncoder, INoopDecoder } from './AbstractCodec';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface IEncoderType<T> {
    asEncoder(encoder: IEncoder<any, any>): T;
    readonly name: string;
    isCompatible(type: any): boolean;
}

export interface IDecoderType<T> {
    asDecoder(encoder: IDecoder<any, any>): T;
    readonly name: string;
    isCompatible(type: any): boolean;
}

export class EncoderType<TX> implements IEncoderType<TX> {
    constructor(public readonly name: string) {
    }
    asEncoder(encoder: IEncoder<any, any>): TX {
        if (!this.isCompatible(encoder.encoderInputType)) {
            throw new Error(`Type Mismatch.  ${encoder.id}'s encoder type ${encoder.encoderInputType.name} is not compatible with ${this.name}`);
        }
        return encoder as unknown as TX;
    }

    isCompatible(type: any): boolean {
        return this === type;
    }
}

export class DecoderType<RX> implements IDecoderType<RX> {
    constructor(public readonly name: string) {
    }
    asDecoder(decoder: IDecoder<any, any>): RX {
        if (!this.isCompatible(decoder.decoderInputType)) {
            throw new Error(`Type Mismatch.  ${decoder.id}'s encoder type ${decoder.decoderInputType.name} is not compatible with ${this.name}`);
        }
        return decoder as unknown as RX;
    }

    isCompatible(type: any): boolean {
        return this === type;
    }
}

export const NoopEncoderType = new EncoderType<INoopEncoder>('void');
export const NoopDecoderType = new DecoderType<INoopDecoder>('void');

export const NoopDataEncoderType = new EncoderType<IDataEncoder<any>>('void');
export const NoopDataDecoderType = new DecoderType<IDataDecoder<any>>('void');

export class PrimitiveDataType<T> extends EncoderType<IDataEncoder<T>> implements IDecoderType<IDataDecoder<T>> {
    asDecoder(decoder: IDecoder<any, any>): IDataDecoder<T> {
        if (!this.isCompatible(decoder.decoderInputType)) {
            throw new Error(`Type Mismatch.  ${decoder.id}'s encoder type ${decoder.decoderInputType.name} is not compatible with ${this.name}`);
        }
        return decoder as unknown as IDataDecoder<T>;
    }
}

export class CompositeDataType<T> extends PrimitiveDataType<T> {
    private baseTypes: PrimitiveDataType<any>[];
    constructor(...inputTypes: PrimitiveDataType<any>[]) {
        super(`${inputTypes.map((type) => type.name).join('|')}`);

        this.baseTypes = inputTypes;
    }

    isCompatible(outputType: any): boolean {
        return this.baseTypes.reduce((result: boolean, type) => result || outputType === type, false);
    }
}

export const bufferDataType = new PrimitiveDataType<Buffer | number[]>('buffer');
export const binaryDataType = new PrimitiveDataType<Uint8Array>('uint8array');
export const stringDataType = new PrimitiveDataType<string>('string');

export const bufferOrStringDataType = new CompositeDataType<string | Buffer | number[]>(stringDataType, bufferDataType);
export const binaryOrBufferDataType = new CompositeDataType<Uint8Array | Buffer | number[]>(binaryDataType, bufferDataType);

