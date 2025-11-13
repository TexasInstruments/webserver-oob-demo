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

import { Prop, Component, Element } from '@stencil/core';
import { AevmI2cCodec } from '../gc-codec-aevm-i2c/lib/AevmI2cCodec';
import { GcCodecBaseProps } from '../gc-target-configuration/gc-codec-base-props';
import { GcCodecI2cBaseProps } from '../gc-target-configuration/gc-codec-i2c-base-props';
import { createTargetParamsProxy } from '../gc-target-device-programmable/TargetDeviceParamsProxy';
import { GcTargetDeviceAddressProps } from '../gc-target-device-analog/gc-target-device-address-props';

/**
 * `gc-codec-aevm-i2c` is a non visual component for encoding and decoding I2C messages for Analog EVM.
 *
 * @usage
 * @label AEVM I2C Codec
 * @group Transports, Models, and Codecs
 * @archetype <gc-codec-aevm-i2c pullup></gc-codec-aevm-i2c>
 */
@Component({
    tag: 'gc-codec-aevm-i2c',
    shadow: true
})

export class GcCodecAevmI2c implements GcCodecI2cBaseProps, GcCodecBaseProps {
    private impl: AevmI2cCodec | undefined;

    connectedCallback() {
        this.impl = new AevmI2cCodec(createTargetParamsProxy(this.el));
    }

    disconnectedCallback() {
        this.impl.dispose();
    }

    /**
     * Speed in Kbps.
     *
     * @order 50
     */
    @Prop() speed: 100 | 400 | 1000 | 3400 = 100;

    /**
     * I2C bus number.
     *
     * @order 51
     */
    @Prop() unit = 2;

    /**
     * Register address size in bits.
     *
     * @order 52
     */
    @Prop() registerAddressBits = 8;

    /**
     * Register address endianness.
     *
     * @order 53
     */
    @Prop() registerAddressEndian: 'little' | 'big' = 'big';


    /**
     * Determine the format of optional register address and optional opcode in command packet for reading data.
     * If this flag is 'combined', opcode and register address are put together using
     * bitwise operation, in particular, readOpcode | (registerAddress << readRegisterAddressBitShift).
     * If this flag is 'separated', opcode is followed by register address, and they are separated in byte boundaries.
     * In both cases, opcode and register address are optional.
     *
     * @order 54
     */
    @Prop() readRegisterAddressOpcodeFormat: 'separated' | 'combined' = 'separated';

    /**
     * Optional opcode for reading data.
     *
     * @order 55
     */
    @Prop() readOpcode: number;

    /**
     * Register address bitshift for reading data. Used when readRegisterAddressOpcodeFormat is combined
     *
     * @order 56
     */
    @Prop() readRegisterAddressBitShift = 0;

    /**
     * Determine the format of optional register address and optional opcode in command packet for writing data.
     * If this flag is 'combined', opcode and register address are put together using
     * bitwise operation, in particular, writeOpcode | (registerAddress << writeRegisterAddressBitShift).
     * If this flag is 'separated', opcode is followed by register address, and they are separated in byte boundaries.
     * In both cases, opcode and register address are optional.
     *
     * @order 57
     */
    @Prop() writeRegisterAddressOpcodeFormat: 'separated' | 'combined' = 'separated';

    /**
     * Optional opcode for writing data.
     *
     * @order 58
     */
    @Prop() writeOpcode: number;

    /**
     * Register address bitshift for writing data. Used when writeRegisterAddressOpcodeFormat is combined
     *
     * @order 59
     */
    @Prop() writeRegisterAddressBitShift = 0;

    // #region gc-target-configuration/gc-codec-i2c-base-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Pull-up
     *
     * @order 61
     */
    @Prop() pullup = false;

    /**
     * Data endianness.
     *
     * @order 62
     */
    @Prop() dataEndian: 'little' | 'big' = 'big';

    // #endregion
    // #region gc-target-device-analog/gc-target-device-address-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The I2C bus address of this device.
     *
     * @order 39
     */
    @Prop() deviceAddress: string;
    // #endregion
    // #region gc-target-configuration/gc-codec-base-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * A flag indicating that this model, transport, codec, or device is not necessary for connecting
     * to the target.  Any failure should not prevent the connection from continuing, which may
     * result in a partial connection.
     *
     * @order 77
     */
    @Prop() optional: boolean = false;

    /**
     * An optional identifier of a target device that is associated with this model, transport or codec.
     * Specifying a target device indicates that this component is necessary and/or optional for
     * properly connecting to the target device.  If a required component fails to connect, other components
     * will not be connected that are associated with the same device by id.  This way you can associate
     * a gc-target-program-loader with a gc-transport-usb so that if the program fails to load the transport
     * will not attempt to connect and will fail, unless the gc-target-program-loader has the optional property
     * set.  The absence of a target device indicates this is necessary and/or optional
     * for connecting to any device.  As a result, specifying the deviceId is not necessary if you only have
     * one device in you target configuration, any failure to connect will result in the entire connection
     * being aborted.
     *
     * @order 80
     */
    @Prop() deviceId: string;

    @Element() el: HTMLElement;
    // #endregion

}
