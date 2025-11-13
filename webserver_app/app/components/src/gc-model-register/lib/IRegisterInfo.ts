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

interface INameAndDescriptionInfo {
    /**
     * Short name of register, block or field.
     */
    readonly name: string;

    /**
     * Description of register, block or field.
     */
    readonly desc?: string;

    /**
     * Identifier of register or field.
     */
    readonly id?: string;

    /**
     * Title of register or field.
     */
    readonly title?: string;
}

/**
 * Format options for displaying bit field data.
 */
export  type FORMAT_OPTIONS = 'hex' | 'dec' | 'binary' | 'exp';

/**
 * Description of an input widget to use for editing register field provided by register.json.
 */
export interface IRegisterFieldWidgetOptions {
    /**
     * Type of widget to use for editing a bit field.
     */
    readonly type: 'value' | 'spinner' | 'select' | 'checkbox' | 'indicator';

    /**
     * The minimum value for a spinner widget.
     */
    readonly min?: number;

    /**
     * The maximum value for a spinner widget.
     */
    readonly max?: number;

    /**
     * The step or increment for a spinner widget.
     */
    readonly step?: number;

    /**
     * The units to be displayed next tot the edit widget.
     */
    readonly units?: string;

    /**
     * The format to be used for displaying widgets of type 'value'.
     */
    readonly format?: FORMAT_OPTIONS;

    /**
     * The precision to be used for displaying widgets of type 'value'.
     */
    readonly precision?: number;

    /**
     * When the widget type is 'indicator', the color for the led when the bit field value is non zero.
     */
    readonly onColor?: string;

    /**
     * When the widget type is 'indicator', the color for the led when the bit field value is zero.
     */
    readonly offColor?: string;

    /**
     * Options on the widget member are deprecated.  Options should be defined up one level in **{@link IRegisterFieldInfo}**.
     * @deprecated
     */
    readonly options?: {
        /**
         * Display text for this option.
         */
        readonly display: string;

        /**
         * Specific value for this option.
         */
        readonly value: string | number;
    }[];
}

/**
 * Description of a register field provided by register.json.
 */
export interface IRegisterFieldInfo extends INameAndDescriptionInfo {
    readonly attrs?: {
        /**
         * Bit field is hidden.
         */
        readonly isHidden?: boolean;

        /**
         * Bit field is reserved.
         */
        readonly isReserved?: boolean;

        /**
         * Bit field is read only and cannot be modified.
         */
        readonly isLocked?: boolean;
    };

    /**
     * Start bit index for this field
     */
    readonly start: number;

    /**
     * Stop bit index for this field
     */
    readonly stop: number;

    /**
     * Data type for this field.  Can be "int", "unsigned int", "q<number>", or "unsigned q<number>".  For q type, the number
     * represents the decimal place to use for converting an integer value to a fixed point value.
     */
    readonly type?: string;

    /**
     * Getter binding expression for converting field data when read.  Use the keyword "this", in this expression to represent the value
     * of the field.  Ex., getter = "this*0.1+0.5".  If no setter expression is provided, then the inverse binding expression will be used
     * for setting the field value.  For example, "(this-0.5)/0.1" will be implied.
     */
    readonly getter?: string;

    /**
     * Setter binding expression for converting values to write into this field.  Use the keyword "this", in this expression to represent the value
     * of the field.  Ex., setter = "this*0.1+0.5".  If no getter expression is provided, then the inverse binding expression will be used
     * for getting the field value.  For example, "(this-0.5)/0.1" will be implied.  If the expression is not bi-direction, then you must specify
     * both getter and setter expression.
     */
    readonly setter?: string;

    /**
     * List of display text for each value represented by this field.  If specified, a select widget will be used to represent this field
     * in the register view.
     */
    readonly options?: {
        /**
         * Display text for this option.
         */
        readonly display: string;

        /**
         * Specific value for this option.
         */
        readonly value: number;
    }[];

    /**
     * A specific widget to use to represent this field in the register view.
     */
    readonly widget?: IRegisterFieldWidgetOptions;

    /**
     * Mode on a bit field is deprecated.  To indicate that a bit is read only, use attrs.isLocked = true instead.
     * @deprecated
     */
    readonly mode?: string;
}

export interface IRegisterTypeQualifiers {
    /**
     * Flag indicating this register is read only, and cannot be written.  This flag may be combined with nonvolatile to indicate
     * that this register will never change, and it's value represents a constant.
     */
    readonly readonly: boolean;

    /**
     * Flag indicating this register is write only, and cannot be read.
     */
    readonly writeonly: boolean;

    /**
     * Flag indicating this register is not volatile w.r.t to the host software.  In other, words, it means the register value
     * will not change internally and therefore there is no need for polling to read the current value.
     */
    readonly nonvolatile: boolean;

    /**
     * Flag indicating read back after write should be skipped.  Normally, the value of a register is read back immediately after
     * a write operation in case the value read is different than the value written.
     */
    readonly noverify: boolean;

    /**
     * Register is hidden.
     */
    readonly isHidden?: boolean;
}

/**
 * Description of a register provided by register.json.
 */
export interface IRegisterInfo extends INameAndDescriptionInfo {
    /**
     * Default value for a register or field.  Used until the actual values is read from the target.
     */
    readonly default?: number;

    /**
     * This property has beed deprecated.  To indicate read only ("R") use attrs: { readonly: true }, and for write only ('W")
     * use attrs: { writeonly: true }.  The default is both readable and writable ("RW"), and you do not need to specify anything
     * in this case.
     * @deprecated
     */
    readonly mode?: string;

    readonly attrs?: IRegisterTypeQualifiers;

    /**
     * Size of the register in number of bits.
     */
    readonly size?: number;

    /**
     * Size of the register in number of bytes, which is calculated from size.
     */
    readonly nBytes: number;

    /**
     * Internal address of the register on the device.
     */
    readonly addr: number;

    /**
     * Internal write address of the register on the device, if it is different than the addr property.
     */
    readonly writeAddr?: number;

    /**
     * List of register bit fields.
     */
    readonly fields?: IRegisterFieldInfo[];

    /**
     * The external address of the device on a particular bus; for example, the I2C bus address.
     */
    readonly deviceAddrs?: string;

    /**
     * The name of the register block that this register is a member of.
     */
    readonly groupName?: string;
}

/**
 * Description of a block of registers provided by register.json.
 */
export interface IRegisterBlockInfo extends Omit<INameAndDescriptionInfo, 'id' | 'title'> {
    /**
     * List of register definitions in this block of registers.
     */
    readonly registers: IRegisterInfo[];
    /**
     * The default external address of the device on a particular bus for the registers within this block.  Ror example, the I2C bus address.
     */
    readonly deviceAddrs?: string;

    readonly attrs?: {
        /**
         * Register block field is hidden.
         */
        readonly isHidden?: boolean;
    };
}

/**
 * Description of the external address of the device on a particular bus; for example, I2C.
 */
export interface IDeviceAddressMap {
    /**
     * Map of logical address bus names to address values.  These logical names may be used in expression to represent a particular deviceAddrs
     * for a register; for example, "B0+4", indicates the register is found on the external bus address given by "B0" plus four.
     */
    readonly deviceAddrsMap?: { [index: string]: number };

    /**
     * The default external address of the device on a particular bus for all registers on a device.
     */
    readonly deviceAddrsDefault?: string;
}

/**
 * Description of a device provided by register.json.
 */
export interface IDeviceInfo extends IDeviceAddressMap {
    /**
     * Generic device information like name and description.
     */
    readonly info: {
        /**
         * Device name.
         */
        readonly name: string;

        /**
         * Short description of the device.
         */
        readonly desc?: string;

        /**
         * The size of registers within this device.
         */
        readonly regsize?: number;

        /**
         * Urls for more information on the registers defined here.
         */
        readonly urls?: string;
    };

    /**
     * Map of calculated bindings.  Calculated bindings are pseudo register values that are computed as an expression of other registers values.
     */
    readonly calculatedBindings?: { [index: string]: string };
}

/**
 * Description of a device and it's registers as provided by register.json.
 */
export interface IDeviceRegisterInfo extends IDeviceInfo {
    /**
     * List of register blocks on this device.
     */
    readonly regblocks: IRegisterBlockInfo[];
}

/**
 * The type definition for register.json files provided to the register model.  These register definitions are converted from this type
 * to **{@link IDeviceRegisterInfo}** internally.  Json formatted files do not support hexadecimal numeric types.  As a result,
 * all numeric types in IRegisterJsonData support both number and string; whereas all numeric types **{@link IDeviceRegisterInfo}**
 * only support number.  When the register.json file is loaded, all numeric types, that also support string type, are converted to numbers.
 */
export interface IRegisterJsonData extends IDeviceInfo {
    readonly regblocks: {
        readonly name: string;
        readonly desc?: string;
        readonly attrs?: {
            isHidden?: string | number | boolean;
        };
        readonly calculatedBindings?: { [index: string]: string };
        readonly registers: {
            readonly name: string;
            readonly desc?: string;
            readonly id?: string;
            readonly title?: string;
            readonly default?: number | string;
            readonly value?: number | string;
            readonly mode?: string;
            readonly attrs?: {
                readonly readonly?: string | number| boolean;
                readonly writeonly?: string | number | boolean;
                readonly nonvolatile?: string | number | boolean;
                readonly noverify?: string | number | boolean;
                isHidden?: string | number | boolean;
            };
            readonly size: number | string;
            readonly addr?: number | string;
            readonly writeAddr?: number | string;
            readonly fields?: {
                readonly attrs?: {
                    isHidden?: string | number | boolean;
                    isReserved?: string | number | boolean;
                    isLocked?: string | number | boolean;
                };
                readonly name: string;
                readonly desc?: string;
                readonly id?: string;
                readonly title?: string;
                readonly mode?: string;
                readonly start?: number | string;
                readonly stop?: number | string;
                readonly type?: string;
                readonly getter?: string;
                readonly setter?: string;
                readonly options?: {
                    readonly display: string;
                    readonly value: number | string;
                }[];
                readonly widget?: {
                    readonly type: 'value' | 'spinner' | 'select' | 'checkbox' | 'indicator';
                    readonly min?: number | string;
                    readonly max?: number | string;
                    readonly step?: number | string;
                    readonly format?: FORMAT_OPTIONS;
                    readonly precision?: number;
                    readonly units?: string;
                    readonly onColor?: string;
                    readonly offColor?: string;
                    readonly options?: {
                        readonly display: string;
                        readonly value: number | string;
                    }[];
                };
            }[];
            readonly deviceAddrs?: string;
        }[];
        readonly deviceAddrs?: string;
    }[];
}