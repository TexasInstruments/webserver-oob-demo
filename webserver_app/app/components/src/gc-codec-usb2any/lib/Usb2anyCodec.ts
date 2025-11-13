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
 * Usb2any Codec.
 *
 * @example
 * ```typescript
 * import { Usb2anyCodec } from '<path-to>/gc-codec-usb2any/lib/Usb2anyCodec';
 *
 * const usb2anyCodec = new Usb2anyCodec({
*     connectTimeout: 100
 * });
 * ```
 *
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/camelcase */
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { GcPromise } from '../../gc-core-assets/lib/GcPromise';
import { AbstractMessageBasedDecoder, IFirmwareCheckBehavior, AbstractFrameDecoder, EncoderType, NoopDecoderType, INoopDecoder, IEncoder, ITransport } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ICodecAnalogControllerBaseParams, receivePayloadEventType, receiveInterruptEventType } from '../../gc-target-configuration/lib/ICodecAnalogControllerBaseParams';
import { IEvents, Events } from '../../gc-core-assets/lib/Events';

export interface IUsb2anyCodecParams extends ICodecAnalogControllerBaseParams {
    firmwareCheck?: IFirmwareCheckBehavior;
}

const console = new GcConsole('gc-codec-usb2any');

// packet types
const COMMAND_PACKET = 1;
const REPLY_PACKET = 2;
const ERROR_PACKET = 3;
const PAYLOAD_PACKET = 4;
const INTERRUPT_PACKET = 5;

// packet flags
const FLAG_MOREDATA = 1;

const PACKET_IDENTIFIER = 'T'.charCodeAt(0);

const PACKET_ID = 0;
const PACKET_PEC = 1;
const PACKET_PAYLOAD_LEN = 2;
const PACKET_TYPE = 3;
const PACKET_FLAGS = 4;
const PACKET_SEQ_NUM = 5;
const PACKET_STATUS = 6;
export const PACKET_COMMAND = 7;
export const PACKET_PAYLOAD = 8;

const MAX_PACKET_SIZE = 62; // size, in bytes, of a USB packet
const PACKET_HEADER_SIZE = PACKET_PAYLOAD;
export const MAX_PAYLOAD = MAX_PACKET_SIZE - PACKET_HEADER_SIZE;

export enum Command {
    Cmd_LoopPacket = 0, // 0x00
    Cmd_I2C_Control = 1, // 0x01
    Cmd_I2C_Write = 2, // 0x02
    Cmd_I2C_Read = 3, // 0x03
    Cmd_I2CRead_WithAddress = 4, // 0x04
    Cmd_GPIO_Write_Control = 5, // 0x05
    Cmd_GPIO_Write_States = 6, // 0x06
    Cmd_GPIO_Read_States = 7, // 0x07
    Cmd_SPI_Control = 8, // 0x08
    Cmd_SPI_WriteAndRead = 9, // 0x09
    Cmd_FirmwareVersion_Read = 10, // 0x0A
    Cmd_MSP430_WordWrite = 11, // 0x0B
    Cmd_MSP430_WordRead = 12, // 0x0C
    Cmd_MSP430_ByteWrite = 13, // 0x0D
    Cmd_MSP430_ByteRead = 14, // 0x0E
    Cmd_UART_Control = 15, // 0x0F
    Cmd_MSP430_MemoryWrite = 16, // 0x10
    Cmd_MSP430_MemoryRead = 17, // 0x11
    Cmd_UART_Write = 18, // 0x12
    Cmd_UART_SetMode = 19, // 0x13
    Cmd_UART_Read = 20, // 0x14
    Cmd_Local_I2C_Write = 21, // 0x15
    Cmd_PWM_Write_Control = 22, // 0x16
    Cmd_Power_WriteControl = 23, // 0x17
    Cmd_Power_ReadStatus = 24, // 0x18
    Cmd_ADC_Control = 25, // 0x19
    Cmd_ADC_ConvertAndRead = 26, // 0x1A
    Cmd_LED_Control = 27, // 0x1B
    Cmd_Clock_Control = 28, // 0x1C
    Cmd_FEC_Control = 29, // 0x1D
    Cmd_FEC_CountAndRead = 30, // 0x1E
    Cmd_Interrupt_Control = 31, // 0x1F
    Cmd_Interrupt_Received = 32, // 0x20
    Cmd_EasyScale_Control = 33, // 0x21
    Cmd_EasyScale_Write = 34, // 0x22
    Cmd_EasyScale_Read = 35, // 0x23
    Cmd_EasyScale_ACK_Received = 36, // 0x24
    Cmd_GPIO_SetPort = 37, // 0x25
    Cmd_GPIO_WritePort = 38, // 0x26
    Cmd_GPIO_ReadPort = 39, // 0x27
    Cmd_Reserved_40 = 40, // 0x28 Reserved for end-user command **
    Cmd_Reserved_41 = 41, // 0x29 Reserved for end-user command **
    Cmd_Reserved_42 = 42, // 0x2A Reserved for end-user command **
    Cmd_Reserved_43 = 43, // 0x2B Reserved for end-user command **
    Cmd_Reserved_44 = 44, // 0x2C Reserved for end-user command **
    Cmd_Reserved_45 = 45, // 0x2D Reserved for end-user command **
    Cmd_Reserved_46 = 46, // 0x2E Reserved for end-user command **
    Cmd_Reserved_47 = 47, // 0x2F Reserved for end-user command **
    Cmd_Reserved_48 = 48, // 0x30 Reserved for end-user command **
    Cmd_Reserved_49 = 49, // 0x31 Reserved for end-user command **
    Cmd_SMBUS_SendByte = 50, // 0x32
    Cmd_SMBUS_WriteByte = 51, // 0x33
    Cmd_SMBUS_WriteWord = 52, // 0x34
    Cmd_SMBUS_WriteBlock = 53, // 0x35
    Cmd_SMBUS_ReceiveByte = 54, // 0x36
    Cmd_SMBUS_ReadByte = 55, // 0x37
    Cmd_SMBUS_ReadWord = 56, // 0x38
    Cmd_SMBUS_ReadBlock = 57, // 0x39
    Cmd_SMBUS_ProcessCall = 58, // 0x3A
    Cmd_SMBUS_BWBRProcessCall = 59, // 0x3B
    Cmd_SMBUS_Control = 60, // 0x3C
    Cmd_SMBUS_GetEchoBuffer = 61, // 0x3D
    Cmd_RFFE_RegZeroWrite = 62, // 0x3E
    Cmd_RFFE_RegWrite = 63, // 0x3F
    Cmd_RFFE_ExtRegWrite = 64, // 0x40
    Cmd_RFFE_ExtRegWriteLong = 65, // 0x41
    Cmd_RFFE_RegRead = 66, // 0x42
    Cmd_RFFE_ExtRegRead = 67, // 0x43
    Cmd_RFFE_ExtRegReadLong = 68, // 0x44
    Cmd_OneWire_SetMode = 69, // 0x45
    Cmd_OneWire_PulseSetup = 70, // 0x46
    Cmd_OneWire_PulseWrite = 71, // 0x47
    Cmd_OneWire_SetState = 72, // 0x48
    Cmd_Reserved_73 = 73, // 0x49 **
    Cmd_Reserved_74 = 74, // 0x4A **
    Cmd_Reserved_75 = 75, // 0x4B **
    Cmd_Reserved_76 = 76, // 0x4C **
    Cmd_Reserved_77 = 77, // 0x4D **
    Cmd_Reserved_78 = 78, // 0x4E **
    Cmd_Reserved_79 = 79, // 0x4F **
    Cmd_Reserved_80 = 80, // 0x50 **
    Cmd_Reserved_81 = 81, // 0x51 **
    Cmd_Reserved_82 = 82, // 0x52 **
    Cmd_Reserved_83 = 83, // 0x53 **
    Cmd_Packet = 84, // 0x54
    Cmd_GPIO_SetCustomPort = 85, // 0x55
    Cmd_GPIO_WriteCustomPort = 86, // 0x56
    Cmd_GPIO_ReadCustomPort = 87, // 0x57
    Cmd_GPIO_WritePulse = 88, // 0x58
    Cmd_Reserved_89 = 89, // 0x59 **
    Cmd_Reserved_90 = 90, // 0x5A **
    Cmd_Reserved_91 = 91, // 0x5B **
    Cmd_Reserved_92 = 92, // 0x5C **
    Cmd_Reserved_93 = 93, // 0x5D **
    Cmd_Reserved_94 = 94, // 0x5E **
    Cmd_Reserved_95 = 95, // 0x5F **
    Cmd_I2C_BlkWriteBlkRead = 96, // 0x60
    Cmd_InvokeBSL = 97, // 0x61
    Cmd_FirmwareDebugMode = 98, // 0x62
    Cmd_Restart = 99, // 0x63
    Cmd_I2C_ReadWithAddress = 100, // 0x64
    Cmd_I2C_ReadInternal = 101, // 0x65
    Cmd_I2C_WriteInternal = 102, // 0x66
    Cmd_GetErrorList = 103, // 0x67
    Cmd_LED_SetState = 104, // 0x68
    Cmd_Power_SetVoltageRef = 105, // 0x69
    Cmd_Status_GetControllerType = 106, // 0x6A
    Cmd_Power_Enable = 107, // 0x6B
    Cmd_ADC_Enable = 108, // 0x6C
    Cmd_ADC_Acquire = 109, // 0x6D
    Cmd_ADC_GetData = 110, // 0x6E
    Cmd_ADC_GetStatus = 111, // 0x6F
    Cmd_ADC_SetReference = 112, // 0x70
    Cmd_Status_GetBoardRevision = 113, // 0x71
    Cmd_Status_EVMDetect = 114, // 0x72
    Cmd_ADC_AcquireTriggered = 115, // 0x73
    Cmd_Power_Notify = 116, // 0x74
    Cmd_Digital_Capture = 117, // 0x75
    Cmd_Digital_GetData = 118, // 0x76
    Cmd_Digital_GetStatus = 119, // 0x77
    Cmd_EasyScale_WriteAndRead = 120, // 0x78
    Cmd_DisplayScale_Set = 121, // 0x79
    Cmd_DisplayScale_WriteReg = 122, // 0x7A
    Cmd_DisplayScale_ReadReg = 123, // 0x7B
    Cmd_DisplayScale_WriteAndRead = 124, // 0x7C
    Cmd_Reserved_125 = 125, // 0x7D **
    Cmd_Reserved_126 = 126, // 0x7E **
    Cmd_Invalid = 127, // 0x7F
    Cmd_Stream_Start = 128, // 0x80
    Cmd_Stream_Stop = 129, // 0x81
    Cmd_Stream_Status = 130, // 0x82
    Cmd_Stream_GetData = 131, // 0x83
    Cmd_Stream_Execute = 132, // 0x84
    Cmd_SPI_StreamOut = 133, // 0x85
    Cmd_SPI_StreamStop = 134, // 0x86
    Cmd_SPI_WriteAndReadEx = 135, // 0x87
    Cmd_Reserved_136 = 136, // 0x88 **
    Cmd_Reserved_137 = 137, // 0x89 **
    Cmd_Pegasus_Test = 138, // 0x8A
    Cmd_Reserved_139 = 139, // 0x8B **
    Cmd_Port_Setup = 140, // 0x8C
    Cmd_Port_Read = 141, // 0x8D
    Cmd_Port_Write = 142, // 0x8E
    Cmd_Port_WritePulse = 143, // 0x8F
    Cmd_END = 144
    // 0x90

// ** = UNUSED COMMAND
}

const szCommandName =
[
    'Cmd_LoopPacket', // 0x00
    'Cmd_I2C_Control', // 0x01
    'Cmd_I2C_Write', // 0x02
    'Cmd_I2C_Read', // 0x03
    'Cmd_I2CRead_WithAddress', // 0x04
    'Cmd_GPIO_Write_Control', // 0x05
    'Cmd_GPIO_Write_States', // 0x06
    'Cmd_GPIO_Read_States', // 0x07
    'Cmd_SPI_Control', // 0x08
    'Cmd_SPI_WriteAndRead', // 0x09
    'Cmd_FirmwareVersion_Read', // 0x0A
    'Cmd_MSP430_WordWrite', // 0x0B
    'Cmd_MSP430_WordRead', // 0x0C
    'Cmd_MSP430_ByteWrite', // 0x0D
    'Cmd_MSP430_ByteRead', // 0x0E
    'Cmd_UART_Control', // 0x0F
    'Cmd_Reserved_16', // 0x10 **
    'Cmd_Reserved_17', // 0x11 **
    'Cmd_UART_Write', // 0x12
    'Cmd_UART_SetMode', // 0x13
    'Cmd_UART_Read', // 0x14
    'Cmd_Local_I2C_Write', // 0x15
    'Cmd_PWM_Write_Control', // 0x16
    'Cmd_Power_WriteControl', // 0x17
    'Cmd_Power_ReadStatus', // 0x18
    'Cmd_ADC_Control', // 0x19
    'Cmd_ADC_ConvertAndRead', // 0x1A
    'Cmd_LED_Control', // 0x1B
    'Cmd_Clock_Control', // 0x1C
    'Cmd_FEC_Control', // 0x1D
    'Cmd_FEC_CountAndRead', // 0x1E
    'Cmd_Interrupt_Control', // 0x1F
    'Cmd_Interrupt_Received', // 0x20
    'Cmd_EasyScale_Control', // 0x21
    'Cmd_EasyScale_Write', // 0x22
    'Cmd_EasyScale_Read', // 0x23
    'Cmd_EasyScale_ACK_Received', // 0x24
    'Cmd_GPIO_SetPort', // 0x25
    'Cmd_GPIO_WritePort', // 0x26
    'Cmd_GPIO_ReadPort', // 0x27
    'Cmd_Reserved_40', // 0x28 Reserved for end-user command **
    'Cmd_Reserved_41', // 0x29 Reserved for end-user command **
    'Cmd_Reserved_42', // 0x2A Reserved for end-user command **
    'Cmd_Reserved_43', // 0x2B Reserved for end-user command **
    'Cmd_Reserved_44', // 0x2C Reserved for end-user command **
    'Cmd_Reserved_45', // 0x2D Reserved for end-user command **
    'Cmd_Reserved_46', // 0x2E Reserved for end-user command **
    'Cmd_Reserved_47', // 0x2F Reserved for end-user command **
    'Cmd_Reserved_48', // 0x30 Reserved for end-user command **
    'Cmd_Reserved_49', // 0x31 Reserved for end-user command **
    'Cmd_SMBUS_SendByte', // 0x32
    'Cmd_SMBUS_WriteByte', // 0x33
    'Cmd_SMBUS_WriteWord', // 0x34
    'Cmd_SMBUS_WriteBlock', // 0x35
    'Cmd_SMBUS_ReceiveByte', // 0x36
    'Cmd_SMBUS_ReadByte', // 0x37
    'Cmd_SMBUS_ReadWord', // 0x38
    'Cmd_SMBUS_ReadBlock', // 0x39
    'Cmd_SMBUS_ProcessCall', // 0x3A
    'Cmd_SMBUS_BWBRProcessCall', // 0x3B
    'Cmd_SMBUS_Control', // 0x3C
    'Cmd_SMBUS_GetEchoBuffer', // 0x3D
    'Cmd_RFFE_RegZeroWrite', // 0x3E
    'Cmd_RFFE_RegWrite', // 0x3F
    'Cmd_RFFE_ExtRegWrite', // 0x40
    'Cmd_RFFE_ExtRegWriteLong', // 0x41
    'Cmd_RFFE_RegRead', // 0x42
    'Cmd_RFFE_ExtRegRead', // 0x43
    'Cmd_RFFE_ExtRegReadLong', // 0x44
    'Cmd_OneWire_SetMode', // 0x45
    'Cmd_OneWire_PulseSetup', // 0x46
    'Cmd_OneWire_PulseWrite', // 0x47
    'Cmd_OneWire_SetState', // 0x48
    'Cmd_Reserved_73', // 0x49 **
    'Cmd_Reserved_74', // 0x4A **
    'Cmd_Reserved_75', // 0x4B **
    'Cmd_Reserved_76', // 0x4C **
    'Cmd_Reserved_77', // 0x4D **
    'Cmd_Reserved_78', // 0x4E **
    'Cmd_Reserved_79', // 0x4F **
    'Cmd_Reserved_80', // 0x50 **
    'Cmd_Reserved_81', // 0x51 **
    'Cmd_Reserved_82', // 0x52 **
    'Cmd_Reserved_83', // 0x53 **
    'Cmd_Packet', // 0x54
    'Cmd_GPIO_SetCustomPort', // 0x55
    'Cmd_GPIO_WriteCustomPort', // 0x56
    'Cmd_GPIO_ReadCustomPort', // 0x57
    'Cmd_GPIO_WritePulse', // 0x58 **
    'Cmd_Reserved_89', // 0x59 **
    'Cmd_Reserved_90', // 0x5A **
    'Cmd_Reserved_91', // 0x5B **
    'Cmd_Reserved_92', // 0x5C **
    'Cmd_Reserved_93', // 0x5D **
    'Cmd_Reserved_94', // 0x5E **
    'Cmd_Reserved_95', // 0x5F **
    'Cmd_I2C_BlkWriteBlkRead', // 0x60
    'Cmd_InvokeBSL', // 0x61
    'Cmd_FirmwareDebugMode', // 0x62
    'Cmd_Restart', // 0x63
    'Cmd_I2C_ReadWithAddress', // 0x64
    'Cmd_I2C_ReadInternal', // 0x65
    'Cmd_I2C_WriteInternal', // 0x66
    'Cmd_GetErrorList', // 0x67
    'Cmd_LED_SetState', // 0x68
    'Cmd_Power_SetVoltageRef', // 0x69
    'Cmd_Status_GetControllerType', // 0x6A
    'Cmd_Power_Enable', // 0x6B
    'Cmd_ADC_Enable', // 0x6C
    'Cmd_ADC_Acquire', // 0x6D
    'Cmd_ADC_GetData', // 0x6E
    'Cmd_ADC_GetStatus', // 0x6F
    'Cmd_ADC_SetReference', // 0x70
    'Cmd_Status_GetBoardRevision', // 0x71
    'Cmd_Status_EVMDetect', // 0x72
    'Cmd_ADC_AcquireTriggered', // 0x73
    'Cmd_Power_Notify', // 0x74
    'Cmd_Digital_Capture', // 0x75
    'Cmd_Digital_GetData', // 0x76
    'Cmd_Digital_GetStatus', // 0x77
    'Cmd_EasyScale_WriteAndRead', // 0x78
    'Cmd_DisplayScale_Set', // 0x79
    'Cmd_DisplayScale_WriteReg', // 0x7A
    'Cmd_DisplayScale_ReadReg', // 0x7B
    'Cmd_DisplayScale_WriteAndRead', // 0x7C
    'Cmd_Reserved_125', // 0x7D **
    'Cmd_Reserved_126', // 0x7E **
    'Cmd_Invalid', // 0x7F
    'Cmd_Stream_Start', // 0x80
    'Cmd_Stream_Stop', // 0x81
    'Cmd_Stream_Status', // 0x82
    'Cmd_Stream_GetData', // 0x83
    'Cmd_Stream_Execute', // 0x84
    'Cmd_SPI_StreamOut', // 0x85
    'Cmd_SPI_StreamStop', // 0x86
    'Cmd_SPI_WriteAndReadEx', // 0x87
    'Cmd_Reserved_136', // 0x88 **
    'Cmd_Reserved_137', // 0x89 **
    'Cmd_Pegasus_Test', // 0x8A
    'Cmd_Reserved_139', // 0x8B **
    'Cmd_Port_Setup', // 0x8C
    'Cmd_Port_Read', // 0x8D
    'Cmd_Port_Write', // 0x8E
    'Cmd_Port_ReadMultiple', // 0x8F
    'Cmd_END', // 0x90
    '' // for loop control
];

// error code constants
const ERR_OK                      =  0;
const ERR_COM_RX_OVERFLOW         = -1;
const ERR_COM_RX_BUF_EMPTY        = -2;
const ERR_COM_TX_BUF_FULL         = -3;
const ERR_COM_TX_STALLED          = -4;
const ERR_COM_TX_FAILED           = -5;
const ERR_COM_OPEN_FAILED         = -6;
const ERR_COM_PORT_NOT_OPEN       = -7;
const ERR_COM_PORT_IS_OPEN        = -8;
const ERR_COM_READ_TIMEOUT        = -9;
const ERR_COM_READ_ERROR          = -10;
const ERR_COM_WRITE_ERROR         = -11;
const ERR_DEVICE_NOT_FOUND        = -12;
const ERR_COM_CRC_FAILED          = -13;

const ERR_INVALID_PORT            = -20;
const ERR_ADDRESS_OUT_OF_RANGE    = -21;
const ERR_INVALID_FUNCTION_CODE   = -22;
const ERR_BAD_PACKET_SIZE         = -23;
const ERR_INVALID_HANDLE          = -24;
const ERR_OPERATION_FAILED        = -25;
const ERR_PARAM_OUT_OF_RANGE      = -26;
const ERR_PACKET_OUT_OF_SEQUENCE  = -27;
const ERR_INVALID_PACKET_HEADER   = -28;
const ERR_UNIMPLEMENTED_FUNCTION  = -29;
const ERR_TOO_MUCH_DATA           = -30;
const ERR_INVALID_DEVICE          = -31;
const ERR_UNSUPPORTED_FIRMWARE    = -32;
const ERR_BUFFER_TOO_SMALL        = -33;
const ERR_NO_DATA                 = -34;
const ERR_RESOURCE_CONFLICT       = -35;
const ERR_NO_EVM                  = -36;
const ERR_COMMAND_BUSY            = -37;
const ERR_ADJ_POWER_FAIL          = -38;
const ERR_NOT_ENABLED             = -39;

const ERR_I2C_INIT_ERROR          = -40;
const ERR_I2C_READ_ERROR          = -41;
const ERR_I2C_WRITE_ERROR         = -42;
const ERR_I2C_BUSY                = -43;
const ERR_I2C_ADDR_NAK            = -44;
const ERR_I2C_DATA_NAK            = -45;
const ERR_I2C_READ_TIMEOUT        = -46;
const ERR_I2C_READ_DATA_TIMEOUT   = -47;
const ERR_I2C_READ_COMP_TIMEOUT   = -48;
const ERR_I2C_WRITE_TIMEOUT       = -49;
const ERR_I2C_WRITE_DATA_TIMEOUT  = -50;
const ERR_I2C_WRITE_COMP_TIMEOUT  = -51;
const ERR_I2C_NOT_MASTER          = -52;
const ERR_I2C_ARBITRATION_LOST    = -53;
const ERR_I2C_NO_PULLUP_POWER     = -54;

const ERR_SPI_INIT_ERROR          = -60;
const ERR_SPI_WRITE_READ_ERROR    = -61;

const ERR_DATA_WRITE_ERROR        = -70;
const ERR_DATA_READ_ERROR         = -71;
const ERR_TIMEOUT                 = -72;
const ERR_DATA_CRC_FAILED         = -73;
const ERR_INVALID_PARAMETER       = -74;
const ERR_NOT_INITIALIZED         = -75;

const getErrorString = function(code: number): string | undefined {
    switch (code) {
        case ERR_OK:                         return 'No error';                             //  0
        case ERR_COM_RX_OVERFLOW:            return 'Receiver overflowed';                  // -1
        case ERR_COM_RX_BUF_EMPTY:           return 'Receive buffer is empty';              // -2
        case ERR_COM_TX_BUF_FULL:            return 'Transmit buffer is full';              // -3
        case ERR_COM_TX_STALLED:             return 'Transmit is stalled';                  // -4
        case ERR_COM_TX_FAILED:              return 'Transmit failed';                      // -5
        case ERR_COM_OPEN_FAILED:            return 'Failed to open communications port';   // -6
        case ERR_COM_PORT_NOT_OPEN:          return 'Communications port is not open';      // -7
        case ERR_COM_PORT_IS_OPEN:           return 'Communications port is open';          // -8
        case ERR_COM_READ_TIMEOUT:           return 'Receive timeout';                      // -9
        case ERR_COM_READ_ERROR:             return 'Communications port read error';       // -10
        case ERR_COM_WRITE_ERROR:            return 'Communications port write error';      // -11
        case ERR_DEVICE_NOT_FOUND:           return 'Communications device not found';      // -12
        case ERR_COM_CRC_FAILED:             return 'Communications CRC failed';            // -13

        case ERR_INVALID_PORT:               return 'Invalid port';                         // -20
        case ERR_ADDRESS_OUT_OF_RANGE:       return 'Address is out of accepted range';     // -21
        case ERR_INVALID_FUNCTION_CODE:      return 'Invalid function code';                // -22
        case ERR_BAD_PACKET_SIZE:            return 'Invalid packet size';                  // -23
        case ERR_INVALID_HANDLE:             return 'Invalid handle';                       // -24
        case ERR_OPERATION_FAILED:           return 'Operation failed';                     // -25
        case ERR_PARAM_OUT_OF_RANGE:         return 'Parameter is out of range';            // -26
        case ERR_PACKET_OUT_OF_SEQUENCE:     return 'Packet is out of sequence';            // -27
        case ERR_INVALID_PACKET_HEADER:      return 'Invalid packet header';                // -28
        case ERR_UNIMPLEMENTED_FUNCTION:     return 'Function not implemented';             // -29
        case ERR_TOO_MUCH_DATA:              return 'Too much data';                        // -30
        case ERR_INVALID_DEVICE:             return 'Invalid device';                       // -31
        case ERR_UNSUPPORTED_FIRMWARE:       return 'Unsupported firmware version';         // -32
        case ERR_BUFFER_TOO_SMALL:           return 'Buffer is too small';                  // -33
        case ERR_NO_DATA:                    return 'No data available';                    // -34
        case ERR_RESOURCE_CONFLICT:          return 'Resource conflict';                    // -35
        case ERR_NO_EVM:                     return 'EVM is required for external power';   // -36
        case ERR_COMMAND_BUSY:               return 'Command is busy';                      // -37
        case ERR_ADJ_POWER_FAIL:             return 'Adjustable power supply failure';      // -38
        case ERR_NOT_ENABLED:                return 'Not enabled';                          // -39

        case ERR_I2C_INIT_ERROR:             return 'I2C initialization failed';            // -40
        case ERR_I2C_READ_ERROR:             return 'I2C read error';                       // -41
        case ERR_I2C_WRITE_ERROR:            return 'I2C write error';                      // -42
        case ERR_I2C_BUSY:                   return 'I2C busy (transfer is pending)';       // -43
        case ERR_I2C_ADDR_NAK:               return 'Address not acknowledged (NAK)';       // -44
        case ERR_I2C_DATA_NAK:               return 'Data not acknowledged (NAK)';          // -45
        case ERR_I2C_READ_TIMEOUT:           return 'Read timeout';                         // -46
        case ERR_I2C_READ_DATA_TIMEOUT:      return 'Read data timeout';                    // -47
        case ERR_I2C_READ_COMP_TIMEOUT:      return 'Timeout waiting for read complete';    // -48
        case ERR_I2C_WRITE_TIMEOUT:          return 'Write timeout';                        // -49
        case ERR_I2C_WRITE_DATA_TIMEOUT:     return 'Write data timeout';                   // -50
        case ERR_I2C_WRITE_COMP_TIMEOUT:     return 'Timeout waiting for write complete';   // -51
        case ERR_I2C_NOT_MASTER:             return 'I2C not in Master mode';               // -52
        case ERR_I2C_ARBITRATION_LOST:       return 'I2C arbitration lost';                 // -53
        case ERR_I2C_NO_PULLUP_POWER:        return 'I2C pullups require 3.3V power';       // -54

        case ERR_SPI_INIT_ERROR:             return 'SPI initialization failed';            // -60
        case ERR_SPI_WRITE_READ_ERROR:       return 'SPI write/read error';                 // -61

        case ERR_DATA_WRITE_ERROR:           return 'Data write error';                     // -70
        case ERR_DATA_READ_ERROR:            return 'Data read error';                      // -71
        case ERR_TIMEOUT:                    return 'Operation timeout';                    // -72
        case ERR_DATA_CRC_FAILED:            return 'Data CRC failed';                      // -73

        default:
            if (code > 0) {
                return 'Success';                              // any positive value
            }
            break;
    }
};

const INTERRUPT_INT0 = 0; // Interrupt pin INT0
const INTERRUPT_INT1 = 1; // Interrupt pin INT1
const INTERRUPT_INT2 = 2; // Interrupt pin INT2
const INTERRUPT_INT3 = 3; // Interrupt pin INT3
const INTERRUPT_EVM = 4; // Interrupt pin EVM_DETECT
const INTERRUPT_POWER = 5; // Interrupt for power event
const INTERRUPT_ADC = 6; // Interrupt for ADC event
const INTERRUPT_DIGITAL = 7; // Interrupt for Digital Capture event
const INTERRUPT_ASYNC_IO = 8; // Interrupt for asynchronous I/O
const INTERRUPT_CALLBACK_101 = 9; // Callback for Cmd_I2C_ReadInternal
const INTERRUPT_CALLBACK_102 = 10; // Callback for Cmd_I2C_WriteInternal
const INTERRUPT_SOURCES = 11; // Total number of interrupt sources

// Controller Type constants
const CTRLR_UNKNOWN = 0x0000;
const CTRLR_USB2ANY = 0x0001;
const CTRLR_ONEDEMO = 0x0002;
const CTRLR_UNSUPPORTED = 0x0004;

const VERSION_SIZE_IN_BYTES = 4;
const VERSION_TO_DWORD = function(packet: number[], offset: number): number {
    let version = 0;
    for (let i = 0; i < VERSION_SIZE_IN_BYTES; i++) {
        version = (version << 8) | packet[offset + i];
    }
    return version;
};

const MIN_FIRMWARE_REQUIRED = VERSION_TO_DWORD([2, 6, 2, 20], 0);

const CRC8TABLE = [
    0x00, 0x07, 0x0E, 0x09, 0x1C, 0x1B, 0x12, 0x15, 0x38, 0x3F, 0x36, 0x31, 0x24, 0x23, 0x2A, 0x2D, 0x70, 0x77, 0x7E, 0x79, 0x6C, 0x6B, 0x62, 0x65, 0x48, 0x4F, 0x46, 0x41, 0x54, 0x53, 0x5A, 0x5D, 0xE0, 0xE7, 0xEE, 0xE9, 0xFC, 0xFB, 0xF2, 0xF5, 0xD8, 0xDF, 0xD6, 0xD1, 0xC4, 0xC3, 0xCA, 0xCD, 0x90, 0x97, 0x9E,
    0x99, 0x8C, 0x8B, 0x82, 0x85, 0xA8, 0xAF, 0xA6, 0xA1, 0xB4, 0xB3, 0xBA, 0xBD, 0xC7, 0xC0, 0xC9, 0xCE, 0xDB, 0xDC, 0xD5, 0xD2, 0xFF, 0xF8, 0xF1, 0xF6, 0xE3, 0xE4, 0xED, 0xEA, 0xB7, 0xB0, 0xB9, 0xBE, 0xAB, 0xAC, 0xA5, 0xA2, 0x8F, 0x88, 0x81, 0x86, 0x93, 0x94, 0x9D, 0x9A, 0x27, 0x20, 0x29, 0x2E, 0x3B, 0x3C,
    0x35, 0x32, 0x1F, 0x18, 0x11, 0x16, 0x03, 0x04, 0x0D, 0x0A, 0x57, 0x50, 0x59, 0x5E, 0x4B, 0x4C, 0x45, 0x42, 0x6F, 0x68, 0x61, 0x66, 0x73, 0x74, 0x7D, 0x7A, 0x89, 0x8E, 0x87, 0x80, 0x95, 0x92, 0x9B, 0x9C, 0xB1, 0xB6, 0xBF, 0xB8, 0xAD, 0xAA, 0xA3, 0xA4, 0xF9, 0xFE, 0xF7, 0xF0, 0xE5, 0xE2, 0xEB, 0xEC, 0xC1,
    0xC6, 0xCF, 0xC8, 0xDD, 0xDA, 0xD3, 0xD4, 0x69, 0x6E, 0x67, 0x60, 0x75, 0x72, 0x7B, 0x7C, 0x51, 0x56, 0x5F, 0x58, 0x4D, 0x4A, 0x43, 0x44, 0x19, 0x1E, 0x17, 0x10, 0x05, 0x02, 0x0B, 0x0C, 0x21, 0x26, 0x2F, 0x28, 0x3D, 0x3A, 0x33, 0x34, 0x4E, 0x49, 0x40, 0x47, 0x52, 0x55, 0x5C, 0x5B, 0x76, 0x71, 0x78, 0x7F,
    0x6A, 0x6D, 0x64, 0x63, 0x3E, 0x39, 0x30, 0x37, 0x22, 0x25, 0x2C, 0x2B, 0x06, 0x01, 0x08, 0x0F, 0x1A, 0x1D, 0x14, 0x13, 0xAE, 0xA9, 0xA0, 0xA7, 0xB2, 0xB5, 0xBC, 0xBB, 0x96, 0x91, 0x98, 0x9F, 0x8A, 0x8D, 0x84, 0x83, 0xDE, 0xD9, 0xD0, 0xD7, 0xC2, 0xC5, 0xCC, 0xCB, 0xE6, 0xE1, 0xE8, 0xEF, 0xFA, 0xFD, 0xF4,
    0xF3
];

export const calculateCRC = function(buf: number[]|Uint8Array, offset: number, len?: number) {
    let crc = 0;

    len = len || buf.length;
    for (let i = offset; i < len; i++) {
        crc = CRC8TABLE[buf[i] ^ crc];
    }

    return crc;
};

export const concatenateResults = function(result: number[][]): number[] {
    return Array.prototype.concat.apply([], result);
};

export const getResult = function(array: number[]): number {
    let result = 0;
    const size = PACKET_PAYLOAD + (array[PACKET_PAYLOAD_LEN] || 0);
    for (let i = PACKET_PAYLOAD; i < size; i++) {
        result = (result << 8) | (array[i] & 0xff);
    }
    return result;
};

export const getResultLSB = function(array: number[]): number {
    // little endian
    let result = 0;
    const size = PACKET_PAYLOAD + (array[PACKET_PAYLOAD_LEN] || 0);
    for (let i = size-1; i >= PACKET_PAYLOAD; i--) {
        result = (result << 8) | (array[i] & 0xff);
    }
    return result;
};

export const getPayload = function(array: number[]) {
    return array.slice(PACKET_PAYLOAD, PACKET_PAYLOAD + (array[PACKET_PAYLOAD_LEN] || 0));
};

export interface IUsb2anyEncoder extends IEncoder<INoopDecoder, IUsb2anyEncoder>, IEvents {
    sendCommandPacket(cmd: number, payload: number[]): number[];
    readResponse(forPacket: number[]): Promise<number[]>;
}

export const IUsb2anyEncoderType = new EncoderType<IUsb2anyEncoder>('u2aPacket');

class NullUsb2anyEncoder extends Events implements IUsb2anyEncoder {
    id = 'nullUsb2anyEncoder';
    encoderInputType = IUsb2anyEncoderType;
    encoderOutputType = NoopDecoderType;
    sendCommandPacket(cmd: number, payload: number[]): number[] {
        throw Error('Null encoder is called.');
    }
    readResponse(forPacket: number[]): Promise<number[]> {
        throw Error('Null encoder is called.');
    }
    addChildDecoder(child: INoopDecoder): void {
    }
    dispose() {
    }
}

export const nullUsb2anyEncoder = new NullUsb2anyEncoder();

export class Usb2anyCodec extends AbstractMessageBasedDecoder implements IUsb2anyEncoder {
    private isConnected = false;
    private numPacketsReceived: number = 0;
    private packetErrorCount: number = 0;
    private txPacketSeqNum: number = 1;
    private rxReceivedPacketSeqNo: number = 0;
    private nControllerType: number = CTRLR_UNKNOWN;
    private dwFirmwareVersion: number = 0;
    private version: string = '';
    private controllerName: string = '';
    encoderInputType = IUsb2anyEncoderType;
    encoderOutputType = NoopDecoderType;

    private frameDecoder = new (class extends AbstractFrameDecoder {
        readonly params = {};
        constructor(private packetDecoder: Usb2anyCodec) {
            super('u2aPacketFrameDecoder', PACKET_IDENTIFIER);
        }
        getPacketLength(buffer: number[], offset: number): number {
            return buffer.length - offset < PACKET_HEADER_SIZE ? 0 : buffer[offset + PACKET_PAYLOAD_LEN] + PACKET_HEADER_SIZE;
        }
        decodePacket(packet: number[]): boolean | Error {
            return this.packetDecoder.decodePacket(packet);
        }
    })(this);

    constructor(readonly params: IUsb2anyCodecParams) {
        super(params.id || 'u2a', console);
    }

    /**
     * @hidden
     */
    addChildDecoder(child: INoopDecoder) {
        // called by CodecRegistry, after deconfigure but before connect
    }

    /**
     * @hidden
     */
    async onConnect(transport: ITransport) {
        // Since checkFirmware will wait for user's input, it should have no timeout. Hence u2aOpen has one timeout,
        // and the sequence of Interface(s).control has another timeout.

        this.isConnected = true;
        try {
            const timeoutInMs = this.params.connectTimeout ?? 250;
            await GcPromise.timeout(this.u2aOpen(), timeoutInMs, 'No response from USB2ANY controller.');

            // Let the logic compare version, prompt user and wait for user's decision, and update firmware if needed. Hence there is no timeout.
            await this.checkFirmware({ detectedFirmwareVersion: this.version, modelID: this.params.id || 'u2a', codec: this, controller: 'usb2any' }, this.params.firmwareCheck);

            this.readResponse(this.sendCommandPacket(Command.Cmd_LED_SetState, [2, 0]));  // turn on the green LED
        } catch (error) {
            this.isConnected = false;
            console.log(error);
            throw error;
        }
    }

    /**
     * @hidden
     */
    async onDisconnect() {
        this.isConnected = false;

        await super.doDisconnect();
        this.rxReceivedPacketSeqNo = 0;
        this.txPacketSeqNum = 1;
        this.packetErrorCount = 0;
        this.nControllerType = CTRLR_UNKNOWN;
    }

    decode(data: number[]): boolean | Error {
        return this.frameDecoder.detectPackets(data);
    }

    protected decodePacket(rawData: number[]): boolean | Error {
        super.decode(rawData); // must call AbstractMessagedBasedCodec to deal with pending transmissions

        try {
            const nRead = rawData.length;

            if (nRead < PACKET_HEADER_SIZE) {
                this.packetErrorCount++;
                throw Error(getErrorString(ERR_BAD_PACKET_SIZE));
            }
            if (rawData[PACKET_ID] !== PACKET_IDENTIFIER || rawData[PACKET_PAYLOAD_LEN] > MAX_PAYLOAD) {
                // Possible firmware bug causing garbage data to send instead of the expected status packet
                // indicating ADC data is ready. Check if we are using ADC interface before throwing error.
                // TODO we ignore error for a certain case in v2. So far v3 has no idea of adcInterface, what to do here.
                // if (this.adcInterface) {
                // ignore error
                // } else {
                throw Error(getErrorString(ERR_INVALID_PACKET_HEADER));
                // }
            }
            const crc = calculateCRC(rawData, PACKET_PAYLOAD_LEN, rawData[PACKET_PAYLOAD_LEN] + PACKET_HEADER_SIZE);
            if (rawData[PACKET_PEC] !== crc) {
                console.warning('ignoring USB2ANY error: ' + getErrorString(ERR_COM_CRC_FAILED));
                return true;
            }
            const type = rawData[PACKET_TYPE];

            if (type === PAYLOAD_PACKET) {
                this.fireEvent(receivePayloadEventType, { payload: getPayload(rawData) });
            } else if (type === INTERRUPT_PACKET) {
                this.fireEvent(receiveInterruptEventType, { payload: getPayload(rawData) });
            } else if (type === REPLY_PACKET) {
                this.packetErrorCount = 0;
                this.rxReceivedPacketSeqNo = rawData[PACKET_SEQ_NUM] || this.rxReceivedPacketSeqNo;
                this.addResponse(rawData, rawData[PACKET_COMMAND], rawData[PACKET_SEQ_NUM]);
            } else if (type === ERROR_PACKET) {
                const errorCode = rawData[PACKET_STATUS];
                const errorMsg = getErrorString(errorCode - 256) || '';

                this.rxReceivedPacketSeqNo = rawData[PACKET_SEQ_NUM] || this.rxReceivedPacketSeqNo;
                this.addErrorResponse(errorMsg, rawData[PACKET_COMMAND], rawData[PACKET_SEQ_NUM]);
                if (this.packetErrorCount++ > 0) {
                    throw errorMsg;
                }

                console.warning(`USB2ANY error packet received: ${errorMsg} for command ${rawData[PACKET_COMMAND]}, seq# ${rawData[PACKET_SEQ_NUM]}`);
            }
            this.numPacketsReceived++;
            return true;
        } catch (e) {
            throw Error('USB2ANY error: ' + e);
        }
    }

    sendCommandPacket(cmd: number, payload: number[]) {
        if (payload.length > MAX_PAYLOAD) {
            throw Error('Too much payload data for a single packet.');
        }
        if (this.txPacketSeqNum === 255) {
            this.txPacketSeqNum = 1;   // 0 is reserved for asynchronous packets
        }
        let packet = [
            PACKET_IDENTIFIER, 0, payload.length, COMMAND_PACKET, 0, this.txPacketSeqNum++, 0, cmd
        ];
        packet = packet.concat(payload);
        packet[PACKET_PEC] = calculateCRC(packet, PACKET_PAYLOAD_LEN);

        this.encode(packet);
        return packet;
    }

    async readResponse(forPacket: number[]) {
        try {
            return await this.addCommand(forPacket[PACKET_COMMAND], forPacket[PACKET_SEQ_NUM]);
        } catch (err) {
            if (!this.isConnected) {
                throw err;
            }

            let errorMsg = err.message || err.toString();
            const MISSING_RESPONSE ='missing response';
            if (errorMsg.includes(MISSING_RESPONSE)) {
                errorMsg = MISSING_RESPONSE;
            }
            // retry one time
            console.log(`Retrying command due to ${errorMsg} for command ${forPacket[PACKET_COMMAND]}, seq# ${forPacket[PACKET_SEQ_NUM]}`);
            const retryPacket = this.sendCommandPacket(forPacket[PACKET_COMMAND], forPacket.slice(PACKET_PAYLOAD));
            return await this.addCommand(retryPacket[PACKET_COMMAND], retryPacket[PACKET_SEQ_NUM]);
        }
    }

    invokeBSL() {
        return this.readResponse(this.sendCommandPacket(Command.Cmd_InvokeBSL, []));
    }

    private async u2aOpen() {
        const controllerTypeResponse = await this.readResponse(this.sendCommandPacket(Command.Cmd_Status_GetControllerType, [ 0, 0, 0, 0 ]));
        const responsePacket = await this.readResponse(this.sendCommandPacket(Command.Cmd_FirmwareVersion_Read, [ 0, 0, 0, 0 ]));
        const nReceived = responsePacket[PACKET_PAYLOAD_LEN];
        if (nReceived !== VERSION_SIZE_IN_BYTES) {
            this.dwFirmwareVersion = 0;
            this.version = 'UNKNOWN';
        } else {
            this.dwFirmwareVersion = VERSION_TO_DWORD(responsePacket, PACKET_PAYLOAD);
            this.version = responsePacket[PACKET_PAYLOAD] + '.' + responsePacket[PACKET_PAYLOAD + 1] + '.' + responsePacket[PACKET_PAYLOAD + 2] + '.' + responsePacket[PACKET_PAYLOAD + 3];
        }

        this.nControllerType = controllerTypeResponse[PACKET_PAYLOAD];
        switch (this.nControllerType) {
            case CTRLR_USB2ANY:
                this.controllerName = 'USB2ANY';
                break;
            case CTRLR_ONEDEMO:
                this.controllerName = 'OneDemo';
                break;
            default:
                this.nControllerType = this.dwFirmwareVersion === 0 ? CTRLR_UNKNOWN : CTRLR_USB2ANY;
                this.controllerName = this.dwFirmwareVersion === 0 ? '<unknown device>' : 'USB2ANY';
                break;
        }

        if (this.dwFirmwareVersion < MIN_FIRMWARE_REQUIRED) {
            this.nControllerType = CTRLR_UNSUPPORTED;
            throw Error('Unsupported USB2ANY controller');
        }
    }

    async ping() {
        await super.ping();
        const pingPromise = this.readResponse(this.sendCommandPacket(Command.Cmd_FirmwareVersion_Read, [0, 0, 0, 0]));
        return GcPromise.timeout(pingPromise, 250, 'Ping failure: no response of firmware version read from ' + this.id) as unknown as Promise<void>;
    }

    /**
     * @hidden
     */
    shouldPauseTransmission(txPacket: number[] | Buffer): boolean {
        const seqNo = txPacket[PACKET_SEQ_NUM];
        if (seqNo) { // non zero sequence number
            let diff = seqNo - this.rxReceivedPacketSeqNo;
            if (diff < 0) {
                diff += 255;
            }
            return diff > (this.params.maxOutstandingCommands ?? 30);
        }
        return false;
    }
}
