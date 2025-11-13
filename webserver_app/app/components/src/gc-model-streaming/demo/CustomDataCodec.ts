/**
 *  Copyright (c) 2021 Texas Instruments Incorporated
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

import { NamedDataRecord, NamedRecordFieldDescriptor, Int8, Uint8,  } from '../../gc-target-configuration/lib/NamedDataRecord';
import { AbstractDataCodecWithFrameDecoder } from '../../gc-target-configuration/lib/TargetConfiguration';
import { bindValueType } from '../../gc-core-databind/lib/CoreDatabind';
import { ICodecBaseParams } from '../../gc-target-configuration/lib/ICodecBaseParams';
import { streamingCodecDataType } from '../../gc-model-streaming/lib/StreamingDataModel';

// example commands to be used in the header of both the transmit and receive packet.  The read command comes up from the target
// with data about the current state of the led and blinking.  The Write command is sent to the target to set the state of the LED on or off.
// The Blink command is sent to the target to set the state of blinking on or off.  And the Ping command is sent to the target to get it
// force it to reply with a Read packet.
enum Command {
    Read = 0,
    Write,
    Blink,
    Ping
}

// example start byte to indicate the begining of a packet.
const PACKET_IDENTIFIER = 0x7c;

// This is pure typescript and defines the types of the information in the header only.  This is not needed for a pure .js implementation.
interface IHeader {
    startByte: number;
    cmd: number;
    len: number;
}

// Example header to be used for both transmit and receive packets, and defines the order and size (in bytes) of information in the header.
class Header extends NamedDataRecord<IHeader> {
    static fieldDescriptors:  NamedRecordFieldDescriptor<IHeader>[] = [
        ['startByte', Int8],
        ['cmd', Uint8],
        ['len', Uint8]
    ];
}

interface ITxPacket {
    on: boolean;
}

// Example payload for the transmit packet going to the target.  The 'on' value controls the blinking of the led on the target.
class TxPacket extends NamedDataRecord<ITxPacket> {
    static fieldDescriptors:  NamedRecordFieldDescriptor<ITxPacket>[] = [
        ['on', Uint8]
    ];
}

interface IPayload {
    blink: number;
    on: number;
}

// Example payload for the receive packet coming fromthe target.  The 'on' value indicates the current state of the led, and 'blink' indicates the state of blinking or not.
class Payload extends NamedDataRecord<IPayload> {
    littleEndian = true;
    static fieldDescriptors:  NamedRecordFieldDescriptor<IPayload>[] = [
        ['blink', Uint8],
        ['on', Uint8]
    ];
}

// Example receive packet that combines the common header and preceeding payload.
const RxPacket = Payload.extends(Header);

// Example custom codec that uses binary data packet to communicate with target instead of json strings
export class CustomDataCodec extends AbstractDataCodecWithFrameDecoder<object> {
    private txPacket = TxPacket.extends(Header).create();  // create a single transmit packet to be reused the single command sent to the target.

    // In this case, there are no extra prarmeters for this example codec, so we are just using the base parameters like id for example.
    constructor(readonly params: ICodecBaseParams) {
        super(params.id || 'custom', streamingCodecDataType, PACKET_IDENTIFIER);

        // initialize the fixed data in the single transmit packet.
        this.txPacket.startByte = PACKET_IDENTIFIER;
        this.txPacket.len = this.txPacket.length;
    }

    // this is required by the frame decoder function to determine how much data to read after the start byte.
    // In this example, it is a fixed size based on only one receive packet type is expected.
    getPacketLength() {
        return RxPacket.getSize();
    }

    // this is required to be implemented to send send commands to the target when binding values change in the streaming model.
    // In this case, we expect an object with either a blink member or on member and we send the appropriate command to the target.
    encode(data: bindValueType): void {
        if (data.blink !== undefined) {
            this.txPacket.on = data.blink ? true : false;
            this.txPacket.cmd = Command.Blink;
            this.targetEncoder.encode([...this.txPacket.asUint8Array]);
        }

        if  (data.on !== undefined) {
            this.txPacket.on = data.on ? true : false;
            this.txPacket.cmd = Command.Write;
            this.targetEncoder.encode([...this.txPacket.asUint8Array]);
        }
    }

    // Because we used the AbstractDataCodecWithFrameDecoder base class, this method is required to decode each packet received that
    // has the same start byte and the length of the packet is fixed.  In this case we simply create an RxPacket instance using the
    // raw data received, and since it has getter/setters for the on and blink memebers, we can pass this directly to the streaming
    // model without any more processing.
    decodePacket(packet: number[]): boolean | Error {
        this.targetDecoder.decode(RxPacket.create(packet));
        return true;
    }

    async ping() {
        // This is an example of sending raw bytes as an alternative to instead of using the NamedDataRecord helper
        this.targetEncoder.encode([PACKET_IDENTIFIER, 3, Command.Ping]);
    }

    async onConnect() {
        // send a ping command everytime the target connects, to make sure we get the current target state.
        return this.ping();
    }
}