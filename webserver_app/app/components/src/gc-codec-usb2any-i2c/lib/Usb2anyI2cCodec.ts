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
 * I2C for Usb2any Codec.
 *
 * @example
 * ```typescript
 * import { Usb2anyI2cCodec } from '<path-to>/gc-codec-usb2any-i2c/lib/Usb2anyI2cCodec';
 *
 * const i2c = new Usb2anyI2cCodec({
 *     pullup: true,
 *     addressBits: 7,
 *     speed: 400,
 *     deviceAddress: 0x48
 * });
 * ```
 *
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/camelcase */

import { IRegisterModelEncoder, RegisterModelEncoderType, RegisterModelDecoderType, IRegisterModelDecoder, nullRegisterModelDecoder } from '../../gc-model-register/lib/RegisterModel';
import { Command, getPayload, getResult, getResultLSB,
    concatenateResults, MAX_PAYLOAD, IUsb2anyEncoder, IUsb2anyEncoderType, nullUsb2anyEncoder } from '../../gc-codec-usb2any/lib/Usb2anyCodec';
import { CRC, ICrcAttributes } from '../../gc-codec-aevm/lib/Crc';
import { NoopDecoderType, INoopDecoder, AbstractCodec, ITransport } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ICodecI2cBaseParams } from '../../gc-target-configuration/lib/ICodecI2cBaseParams';
import { IRegisterInfo } from '../../gc-model-register/lib/IRegisterInfo';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';

const I2C_100kHz = 0;
const I2C_400kHz = 1;
const I2C_10kHz  = 2;
const I2C_800kHz = 3;

const I2C_7Bits = 0;
const I2C_10Bits = 1;

const I2C_PullUps_OFF = 0;
const I2C_PullUps_ON = 1;

const MAX_COUNT = MAX_PAYLOAD - 6;

export interface IUsb2anyI2cCodecParams extends ICodecI2cBaseParams {
    // For configure firmware
    addressBits?: 7 | 10; // device address size in bits
    speed?: 100 | 400 | 10 | 800; // kHz

    // For read or write
    readWithAddress?: boolean;
    internalAddressBits?: number; // default 8
    sequentialRead?: boolean; // v2: controls multiRegisterRead. Default false - loop of readValue; true - readWithAddress with MAX_COUNT or count
    blockWriteBlockRead?: boolean;
    crc?: ICrcAttributes;
}

export class Usb2anyI2cCodec extends AbstractCodec<INoopDecoder, IUsb2anyEncoder, IRegisterModelDecoder, IRegisterModelEncoder> implements IRegisterModelEncoder {
    protected targetEncoder = nullUsb2anyEncoder;

    encoderInputType = RegisterModelEncoderType;
    encoderOutputType = RegisterModelDecoderType;
    protected targetDecoder: IRegisterModelDecoder = nullRegisterModelDecoder;

    protected readData = [0];
    protected writeData = [0];
    protected sequentialRead = false;
    protected readWithAddress = false;
    protected blockWriteBlockRead = false;
    protected crc?: CRC;
    protected setDataBytes = GcUtils.setBytes;
    protected getDataResult = getResult;
    protected dataEndian = 'big';
    protected internalAddrsBytes = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected crcUser?: any; // TODO (next PR cycle define crcUser type)

    constructor(readonly params: IUsb2anyI2cCodecParams) {
        super(params.id || 'i2c', NoopDecoderType, IUsb2anyEncoderType, RegisterModelDecoderType, RegisterModelEncoderType);
    }

    /**
     * @hidden
     */
    onConnect(transport: ITransport) {
        return this.configureFirmware();
    }

    configureFirmware(): Promise<void> {
        const params = this.params;

        // internal setup for read and write.
        const deviceAddress = +(params.deviceAddress ?? 0);
        const i2cAddressHi = (deviceAddress >> 8) & 0xff;
        const i2cAddressLo = deviceAddress & 0xff;

        this.readData = [ i2cAddressHi, i2cAddressLo ];
        this.writeData = [ i2cAddressHi, i2cAddressLo ];

        const internalAddressBits = GcUtils.parseNumberProperty('internalAddressBits', params.internalAddressBits ?? 8, 1, 16);
        this.internalAddrsBytes = Math.ceil(internalAddressBits/8);

        this.sequentialRead = params.sequentialRead ?? false;
        this.readWithAddress = params.readWithAddress ?? false;
        this.blockWriteBlockRead = params.blockWriteBlockRead ?? false;

        if (params.crc) {
            this.crc = new CRC(params.crc);
        }
        if (params.dataEndian === 'little') {
            this.setDataBytes = GcUtils.setBytesLSB;
            this.getDataResult = getResultLSB;
            this.dataEndian = params.dataEndian;
        } else {
            this.setDataBytes = GcUtils.setBytes;
            this.getDataResult = getResult;
        }

        // configure firmware
        let speed = I2C_10kHz;
        switch (params.speed) {
            case 100:
                speed = I2C_100kHz;
                break;
            case 400:
                speed = I2C_400kHz;
                break;
            case 800:
                speed = I2C_800kHz;
                break;
        }

        let addressBits = I2C_7Bits;
        switch (params.addressBits) {
            case 10:
                addressBits = I2C_10Bits;
                break;
        }

        const pullUps = params.pullup ? I2C_PullUps_ON : I2C_PullUps_OFF;

        return this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_I2C_Control, [
            speed, addressBits, pullUps
        ])) as unknown as Promise<void>;
    }

    private setDeviceAddress(buffer: number[], info: IRegisterInfo) {
        let deviceAddrs = 0;
        if (info.deviceAddrs && !isNaN(info.deviceAddrs as unknown as number)) {
            deviceAddrs = +info.deviceAddrs;
            buffer[0] = (deviceAddrs >> 8) & 0xff;
            buffer[1] = deviceAddrs & 0xff;
        } else if (this.targetDecoder !== undefined) {
            deviceAddrs = +(this.targetDecoder.getDeviceAddressForRegister(info) ?? this.params.deviceAddress ?? 0);
            buffer[0] = (deviceAddrs >> 8) & 0xff;
            buffer[1] = deviceAddrs & 0xff;
        }
    }

    async readValue(info: IRegisterInfo, coreIndex?: number) {
        this.setDeviceAddress(this.readData, info);
        const numBytes = info.nBytes !== undefined ? info.nBytes : Math.ceil(info.size !== undefined ? info.size/8 : 1);

        if (this.readWithAddress) {
            // Using I2C ReadWithAddress API
            this.readData[2] = info.addr || 0;
            this.readData[3] = numBytes;
        } else {
            // Using I2C ReadInternal API
            // readData[0-1] - device address
            // readData[2] - size of internal address, in bytes (must be 0, 1, or 2)
            this.readData[2] = this.internalAddrsBytes;

            // readData[3-4] - number of bytes of data
            this.readData[3] = (numBytes >> 8) & 0xff;
            this.readData[4] = numBytes & 0xff;

            // readData[5-6] - Internal address of the data to read
            if (this.internalAddrsBytes === 1) {
                // 1 byte register address
                this.readData[5] = info.addr || 0;
            } else {
                // 2 byte register address
                this.readData[5] = info.addr ? (info.addr >> 8) & 0xff : 0;
                this.readData[6] = info.addr ? info.addr & 0xff : 0;
            }
        }

        const cmd = this.readWithAddress ? Command.Cmd_I2C_ReadWithAddress : Command.Cmd_I2C_ReadInternal;

        if (this.crcUser && this.crc) {
            let data = this.readData.slice();
            let crcData = this.crcUser.embed_crc_data(this.crc, {
                write: false,
                deviceAddr: (this.readData[0] << 8) | (this.readData[1] & 0xff),
                registerAddr: info.addr,
                payload: data,
                numBytes: numBytes
            });

            data = (crcData && crcData.payload) || data;

            if (crcData && crcData.numBytes) {
                if (this.readWithAddress) {
                    data[3] = crcData.numBytes;
                } else {
                    data[3] = (crcData.numBytes >> 8) & 0xff;
                    data[4] = crcData.numBytes & 0xff;
                }
            }
            const result = await this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(cmd, data));
            let payload = getPayload(result);
            crcData = this.crcUser.verify_crc_data(this.crc, {
                payload: payload
            });

            if (crcData && crcData.valid === false) {
                return Promise.reject('Invalid CRC');
            }

            payload = (crcData && crcData.payload) || payload;
            let resultValue = 0;
            if (this.dataEndian === 'little') {
                for (let i = payload.length-1; i >= 0; i--) {
                    resultValue = (resultValue << 8) | (payload[i] & 0xff);
                }
            } else {
                for (let i = 0; i < payload.length; i++) {
                    resultValue = (resultValue << 8) | (payload[i] & 0xff);
                }
            }
            return resultValue;
        } else {
            return this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(cmd, this.readData)).then(this.getDataResult);
        }
    }

    multiRegisterRead(startRegisterInfo: IRegisterInfo, count: number, coreIndex?: number) {
        if (this.sequentialRead) {
            return this.sequentialReadRegisters(startRegisterInfo, count);
        } else {
            const promises = [];
            const info = { ...startRegisterInfo };
            for (let i = 0; i < count; i++) {
                promises.push(this.readValue(info, coreIndex));
                info.addr++;
            }
            return Promise.all(promises);
        }
    }

    private sequentialReadRegisters(startRegisterInfo: IRegisterInfo, count: number) {
        this.setDeviceAddress(this.readData, startRegisterInfo);
        const numBytesPerRegister = startRegisterInfo.nBytes !== undefined ? startRegisterInfo.nBytes : Math.ceil(startRegisterInfo.size !== undefined ? startRegisterInfo.size/8 : 1);
        const maxRegisterCountPerPacket = Math.floor(MAX_PAYLOAD / numBytesPerRegister);
        let startAddrs = startRegisterInfo.addr || 0;
        const promises = [];
        while (count > maxRegisterCountPerPacket) {
            promises.push(this.sequentialReadRegistersOnePacketHelper(startAddrs, maxRegisterCountPerPacket, numBytesPerRegister));
            count -= maxRegisterCountPerPacket;
            startAddrs += maxRegisterCountPerPacket;
        }
        promises.push(this.sequentialReadRegistersOnePacketHelper(startAddrs, count, numBytesPerRegister));
        return Promise.all(promises).then(concatenateResults);
    }

    private sequentialReadRegistersOnePacketHelper(startAddrs: number, regCount: number, numBytesPerRegister: number) {
        let cmd = Command.Cmd_I2C_ReadWithAddress;
        const numReadBytes = regCount * numBytesPerRegister;
        if (this.readWithAddress) {
            this.readData[2] = startAddrs;
            this.readData[3] = numReadBytes;
        } else if (this.blockWriteBlockRead) {
            cmd = Command.Cmd_I2C_BlkWriteBlkRead;
            this.readData[2] = this.internalAddrsBytes;  // number of write bytes
            this.readData[3] = numReadBytes & 0xff; // number of read bytes
            // bytes to write is register address in this case
            if (this.internalAddrsBytes === 1) {
                this.readData[4] = startAddrs;
            } else {
                this.readData[4] = (startAddrs >> 8) & 0xff;
                this.readData[5] = startAddrs & 0xff;
            }
        } else {
            cmd = Command.Cmd_I2C_ReadInternal;
            // readData[2] - size of internal address, in bytes (must be 0, 1, or 2)
            this.readData[2] = this.internalAddrsBytes;
            // readData[3-4] - number of bytes of data
            this.readData[3] = (numReadBytes >> 8) & 0xff;
            this.readData[4] = numReadBytes & 0xff;
            // readData[5-6] - Internal address of the data to read
            if (this.internalAddrsBytes === 1) {
                // 1 byte register address
                this.readData[5] = startAddrs;
            } else {
                // 2 byte register address
                this.readData[5] = (startAddrs >> 8) & 0xff;
                this.readData[6] = startAddrs & 0xff;
            }
        }
        return this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(cmd, this.readData)).then(getPayload).then((payload) => {
            const array: number[] = [];
            if (this.dataEndian === 'little') {
                for (let reg = 0; reg < regCount; reg++) {
                    let result = 0;
                    for (let i = numBytesPerRegister - 1; i >= 0; i--) {
                        result = (result << 8) | (payload[reg * numBytesPerRegister + i] & 0xff);
                    }
                    array[reg] = result;
                }
            } else {
                for (let reg = 0; reg < regCount; reg++) {
                    let result = 0;
                    for (let i = 0; i < numBytesPerRegister; i++) {
                        result = (result << 8) | (payload[reg * numBytesPerRegister + i] & 0xff);
                    }
                    array[reg] = result;
                }
            }
            return array;
        });
    }

    writeValue(info: IRegisterInfo, value: number, coreIndex?: number): Promise<void> {
        const nBytes = info.nBytes !== undefined ? info.nBytes : Math.ceil(info.size !== undefined ? info.size/8 : 1);
        const size = 4 + nBytes;
        if (size <= this.writeData.length) {
            this.writeData = this.writeData.slice(0, size);
        }
        this.setDeviceAddress(this.writeData, info);

        this.writeData[2] = nBytes+1;
        this.writeData[3] = (info.writeAddr === undefined ? info.addr : info.writeAddr) || 0;
        this.setDataBytes(this.writeData, nBytes, value, 4);

        let data = this.writeData.slice();
        if (this.crcUser && this.crc) {
            const crcData = this.crcUser.embed_crc_data(this.crc, {
                write: true,
                deviceAddr: (this.writeData[0] << 8) | (this.writeData[1] & 0xff),
                registerAddr: this.writeData[3],
                writeData: value,
                payload: data,
                numBytes: nBytes
            });

            data = (crcData && crcData.payload) || data;

            if (crcData && crcData.numBytes) {
                data[2] = Math.min(crcData.numBytes+1, data.length-3); // GC-2381
            }
        }

        return this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_I2C_Write, data)) as unknown as Promise<void>;
    }
}
