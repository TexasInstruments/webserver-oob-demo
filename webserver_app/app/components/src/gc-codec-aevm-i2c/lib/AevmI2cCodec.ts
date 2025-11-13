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
 * I2C for Aevm Codec.
 *
 * @example
 * ```typescript
 * import { AevmI2cCodec } from '<path-to>/gc-codec-aevm-i2c/lib/AevmI2cCodec';
 *
 * const i2c = new AevmI2cCodec({
 *     unit: 2,
 *     pullup: true,
 *     speed: 100,
 *     deviceAddress: 0x18,
 *     readOpcode: 0x10,
 *     writeOpcode: 0x8
 * });
 * ```
 *
 * @packageDocumentation
 */
import { NoopDecoderType, INoopDecoder, AbstractCodec, ITransport } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ICodecI2cBaseParams } from '../../gc-target-configuration/lib/ICodecI2cBaseParams';
import { IAevmEncoder, nullAevmEncoder, IAevmEncoderType, getPayload } from '../../gc-codec-aevm/lib/AevmCodec';
import { IRegisterModelEncoder, RegisterModelEncoderType, RegisterModelDecoderType, IRegisterModelDecoder, nullRegisterModelDecoder } from '../../gc-model-register/lib/RegisterModel';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { IRegisterInfo } from '../../gc-model-register/lib/IRegisterInfo';

export interface IAevmI2cCodecParams extends ICodecI2cBaseParams {
    speed?: 100 | 400 | 1000 | 3400;
    unit?: number;

    registerAddressBits?: number; // register address size in bits, either 8 bits or 16 bits. It is not device address size in bits.
    registerAddressEndian?: 'little' | 'big';
    readRegisterAddressOpcodeFormat?: 'separated' | 'combined';
    readOpcode?: number;
    readRegisterAddressBitShift?: number;
    writeRegisterAddressOpcodeFormat?: 'separated' | 'combined';
    writeOpcode?: number;
    writeRegisterAddressBitShift?: number;
}

const speedMap = {
    '100': 0,
    '400': 1,
    '1000': 2,
    '3400': 3
};

const I2C_TYPE = 0x03;
const enum Cmd {
    Enable,
    Config,
    Write,
    Read,
    WriteRegister,
    ReadRegister,
    BlockWriteBlockRead
}

const opcodeAddr = (opcode?: string | number, addr?: number, addrShift?: number) =>
    (opcode !== undefined ? +opcode : 0) | (addr !== undefined ? addr << (addrShift ?? 0) : 0);

export class AevmI2cCodec extends AbstractCodec<INoopDecoder, IAevmEncoder, IRegisterModelDecoder, IRegisterModelEncoder> implements IRegisterModelEncoder {
    protected targetEncoder = nullAevmEncoder;

    encoderInputType = RegisterModelEncoderType;
    encoderOutputType = RegisterModelDecoderType;
    protected targetDecoder: IRegisterModelDecoder = nullRegisterModelDecoder;

    constructor(readonly params: IAevmI2cCodecParams) {
        super(params.id || 'i2c', NoopDecoderType, IAevmEncoderType, RegisterModelDecoderType, RegisterModelEncoderType);
    }

    /**
     * @hidden
     */
    onConnect(transport: ITransport) {
        return this.configureFirmware();
    }

    async configureFirmware() {
        const params = this.params;
        const unit = params.unit ?? 2;
        const speed = GcUtils.parseStringProperty('speed', '' + params.speed ?? '100', speedMap);

        await this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(
            I2C_TYPE, unit, Cmd.Enable, [unit, 1], []
        ));
        await this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(
            I2C_TYPE, unit, Cmd.Config, [unit, speed, params.pullup ? 1 : 0], []
        ));
    }

    private getDeviceAddress(info: IRegisterInfo) {
        let addr = 0;
        if (info.deviceAddrs && !isNaN((info.deviceAddrs as unknown as number))) {
            addr = +info.deviceAddrs;
        } else if (this.targetDecoder !== undefined) {
            addr = +(this.targetDecoder.getDeviceAddressForRegister(info) ?? this.params.deviceAddress ?? 0);
        }
        return addr;
    }

    async readValue(info: IRegisterInfo, coreIndex?: number) {
        const regAddr = info.addr;
        const format = this.params.readRegisterAddressOpcodeFormat ?? 'separated';
        const opcode = this.params.readOpcode;
        const payload: number[] = [];
        if (format === 'separated') {
            if (opcode !== undefined) {
                payload.push(+opcode);
            }
            if (regAddr !== undefined) {
                const addrBytes = ((this.params.registerAddressBits ?? 8) + 7) >> 3;
                if (this.params.registerAddressEndian === 'little') {
                    GcUtils.setBytesLSB(payload, addrBytes, regAddr, payload.length);
                } else {
                    GcUtils.setBytes(payload, addrBytes, regAddr, payload.length);
                }
            }
        } else {
            const opCodeOrRegAddr = opcodeAddr(opcode, regAddr, this.params.readRegisterAddressBitShift);
            payload.push(opCodeOrRegAddr);
        }
        const unit = this.params.unit ?? 2;
        const deviceAddrs = this.getDeviceAddress(info);
        const dataBytes = info.nBytes ?? ((info.size ?? 8) + 7) >> 3;
        const params = [unit, deviceAddrs, dataBytes];
        const result = await this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(
            I2C_TYPE, unit, Cmd.BlockWriteBlockRead, params, payload
        ));
        return GcUtils.bytesToValue(getPayload(result), this.params.dataEndian ?? 'big');
    }

    writeValue(info: IRegisterInfo, value: number, coreIndex?: number) {
        const regAddr = info.writeAddr ?? info.addr;
        const format = this.params.writeRegisterAddressOpcodeFormat ?? 'separated';
        const opcode = this.params.writeOpcode;
        let flags = ((this.params.registerAddressBits ?? 8) + 7) >> 4;
        let opCodeOrRegAddr = 0;
        const payload: number[] = [];
        if (format === 'separated') {
            if (opcode !== undefined) {
                opCodeOrRegAddr = +opcode;
                flags = 0;
                if (regAddr !== undefined) {
                    const addrBytes = ((this.params.registerAddressBits ?? 8) + 7) >> 3;
                    if (this.params.registerAddressEndian === 'little') {
                        GcUtils.setBytesLSB(payload, addrBytes, regAddr, payload.length);
                    } else {
                        GcUtils.setBytes(payload, addrBytes, regAddr, payload.length);
                    }
                }
            } else {
                opCodeOrRegAddr = regAddr;
            }
        } else {
            opCodeOrRegAddr = opcodeAddr(opcode, regAddr, this.params.writeRegisterAddressBitShift);
        }
        const dataBytes = info.nBytes ?? ((info.size ?? 8) + 7) >> 3;
        if (this.params.dataEndian === 'little') {
            GcUtils.setBytesLSB(payload, dataBytes, value, payload.length);
        } else {
            GcUtils.setBytes(payload, dataBytes, value, payload.length);
        }

        const unit = this.params.unit ?? 2;
        const deviceAddrs = this.getDeviceAddress(info);
        const params = [unit, deviceAddrs, opCodeOrRegAddr, flags];
        return this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(
            I2C_TYPE, unit, Cmd.WriteRegister, params, payload
        )) as unknown as Promise<void>;
    }
}
