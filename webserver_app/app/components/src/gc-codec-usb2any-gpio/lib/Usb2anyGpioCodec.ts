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
 * GPIO interface for `Usb2any` Codec.
 *
 * @example
 * ```typescript
 * import { Usb2anyGpioCodec } from '<path-to>/gc-codec-usb2any-gpio/lib/Usb2anyGpioCodec';
 *
 * const gpio = new Usb2anyGpioCodec({
*     pins: [{
*         pin: 3,
*         mode: 'output',
*         state: 'high'
*     },
*     {
*         pin: 7,
*         mode: 'input'
*     }]
 * });
 * ```
 *
 * @packageDocumentation
 */
import { Command, IUsb2anyEncoder, nullUsb2anyEncoder, IUsb2anyEncoderType, getPayload } from '../../gc-codec-usb2any/lib/Usb2anyCodec';
import { NoopDecoderType, INoopDecoder, IDataEncoder, IDataDecoder, AbstractCodec, nullDataCodec, ITransport } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ICodecGpioBaseParams, IGpioPinBaseParams, modeMap, resistorMap } from '../../gc-target-configuration/lib/ICodecGpioBaseParams';
import { streamingCodecDataType } from '../../gc-model-streaming/lib/StreamingDataModel';
import { RefreshIntervalBindValue, refreshEventType } from '../../gc-core-databind/lib/CoreDatabind';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';

export interface IUsb2anyGpioCodecParams extends ICodecGpioBaseParams {
    pins?: IGpioPinBaseParams[];
}

const pinStateMap = { 'high': 2, 'low': 1 };

const maxPinCount = 13; // maximum number of pins in USB2ANY is 13, pin number is from 0 to 12.

export class Usb2anyGpioCodec extends AbstractCodec<INoopDecoder, IUsb2anyEncoder, IDataDecoder<object>, IDataEncoder<object>> implements IDataEncoder<object> {
    protected targetEncoder = nullUsb2anyEncoder;

    protected targetDecoder = nullDataCodec;

    private refreshBinding?: RefreshIntervalBindValue;
    private refreshListener = () => {
        this.read();
    };

    private inputPins: number[] = [];
    private pinNameMap: {[pin: number]: string} = {};

    constructor(readonly params: IUsb2anyGpioCodecParams) {
        super(params.id || 'gpio', NoopDecoderType, IUsb2anyEncoderType, streamingCodecDataType, streamingCodecDataType);
    }

    /**
     * @hidden
     */
    async onDisconnect(transport: ITransport) {
        this.removeRefreshListener();
    }

    /**
     * @hidden
     */
    onConnect(transport: ITransport) {
        return this.configureFirmware();
    }

    configureFirmware(): Promise<void> {
        const params = this.params;
        const pinParams = params.pins ?? [];
        this.inputPins = [];
        this.pinNameMap = {};
        const promises = [];
        for (const pinParm of pinParams) {
            if (pinParm.pin === undefined) {
                throw Error('GPIO missing required pin number');
            }
            const pin = GcUtils.parseNumberProperty('pin, in the GPIO interface', pinParm.pin!, 0, maxPinCount - 1);
            if (pinParm.id !== undefined) {
                this.pinNameMap[pin] = pinParm.id!;
            }
            let pinFunction = GcUtils.parseStringProperty('mode', pinParm.mode ?? '', modeMap);
            if (pinFunction === modeMap.input) {
                this.inputPins.push(pin);
                if (pinParm.resistor !== undefined) {
                    pinFunction += GcUtils.parseStringProperty('resistor', pinParm.resistor, resistorMap);
                }
            }
            promises.push(this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_GPIO_SetPort, [pin, pinFunction])));
            if (pinParm.state !== undefined) {
                const state = GcUtils.parseStringProperty('state, in the GPIO interface', pinParm.state, pinStateMap);
                promises.push(this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_GPIO_WritePort, [pin, state])));
            }
        }
        if (this.inputPins.length > 0) {
            const refereshInterval = params.refereshInterval ?? 100;
            if (this.refreshBinding === undefined) {
                this.refreshBinding = new RefreshIntervalBindValue(refereshInterval);
                this.refreshBinding.addEventListener(refreshEventType, this.refreshListener);
            } else {
                this.refreshBinding.setValue(refereshInterval);
            }
        } else {
            this.removeRefreshListener();
        }
        return Promise.all(promises) as unknown as Promise<void>;
    }

    private removeRefreshListener() {
        if (this.refreshBinding !== undefined) {
            this.refreshBinding.removeEventListener(refreshEventType, this.refreshListener);
            this.refreshBinding = undefined;
        }
    }

    encode(data: {[pinName: string]: boolean}) {
        const payload: number[] = [];
        for (let pinNumber = 0; pinNumber < maxPinCount; pinNumber++) {
            const pinName = this.pinNameMap[pinNumber];
            if (pinName in data) {
                // set to 1 means set to low state to this pin,
                // set to 2 means set to high state.
                payload.push(data[pinName] ? 2 : 1);
            } else {
                // set to 0 means set no change on this pin
                payload.push(0);
            }
        }
        this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_GPIO_Write_States, payload));
    }

    private async read() {
        const payload: number[] = [];
        for (let i = 0; i < maxPinCount; i++) {
            payload.push(0);
        }
        try {
            let result = await this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_GPIO_Read_States, payload));
            result = getPayload(result);
            const data: {[pinName: string]: boolean} = {};
            for (const pinNumber of this.inputPins) {
                const pinName = this.pinNameMap[pinNumber];
                if (pinName !== undefined) {
                    data[pinName] = result[pinNumber] === 1;
                }
            }
            this.targetDecoder.decode(data);
        } catch (error) {
            // If the command packet is just sent, and its response has not arrived before disconnect,
            // the message queue will reject the response promise.
            // Catch error here and it is fine not to do anything.
        }
    }

    writePulse(pin: number, isPulseHigh: boolean, microSeconds: number) {
        return this.targetEncoder.readResponse(this.targetEncoder.sendCommandPacket(Command.Cmd_GPIO_WritePulse, [
            pin, isPulseHigh ? 1 : 0, (microSeconds >> 8) & 0xff, microSeconds & 0xff
        ])) as unknown as Promise<void>;
    }
}

