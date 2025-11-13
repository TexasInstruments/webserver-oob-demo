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
import { IEncoder, ICodec, IDecoder, AbstractDecoder, codecRegistry, AbstractConnectionLogger, ITransport, TRANSPORT_STATE } from '../../../gc-target-configuration/lib/TargetConfiguration';
import { GcConsole } from '../../../gc-core-assets/lib/GcConsole';
import { ICodecBaseParams } from '../../../gc-target-configuration/lib/ICodecBaseParams';

export interface IDecoderConstructor<T extends IDecoder<unknown, unknown>, P extends ICodecBaseParams> {
    new(params: P): T;
}

class ConnectionLogger extends AbstractConnectionLogger implements ITransport {
    state = TRANSPORT_STATE.CONNECTED;
    async connect(failedDevicesList?: string[]): Promise<void> {
    }
    async disconnect(): Promise<void> {
    }
    get isConnected(): boolean {
        return true;
    }
    get canConnect(): boolean {
        return false;
    }
    get isDisconnected(): boolean {
        return false;
    }
    get canDisconnect(): boolean {
        return true;
    }
    connectionDescription?: string;
    get isPartiallyConnected(): boolean {
        return false;
    }
    readonly id = 'progress';
    assertStillConnecting() {
        return true;
    }
    protected readonly console = new GcConsole('gc-transport-usb');

    readonly isXdsTransport = false;
}

export class TargetConfigurationBuilder {
    private activeCodecList: ICodec<unknown, unknown, unknown, unknown>[] = [];
    private logger = new ConnectionLogger();

    constructor(private targetEncoder: IEncoder<unknown, unknown>) {
    }

    async dispose() {
        for (let i = this.activeCodecList.length; i --> 0; ) {
            const codec = this.activeCodecList[i];
            if (codec.onDisconnect) {
                await codec.onDisconnect(this.logger);
            }
        }
        if (this.targetEncoder.onDisconnect) {
            await this.targetEncoder.onDisconnect(this.logger);
        }

        this.activeCodecList.reverse().forEach( codec => codec.deconfigure && codec.deconfigure() );
        this.targetEncoder.deconfigure && this.targetEncoder.deconfigure();
    }

    async appendCodec<T extends IDecoder<unknown, unknown>, P extends ICodecBaseParams>(decoderFactory: IDecoderConstructor<T, P>, params: P, parent?: IEncoder<unknown, unknown>): Promise<T> {
        const child = this.clone(decoderFactory, params);
        await this.append(child, parent);
        return child;
    }

    private clone<P extends ICodecBaseParams, T extends IDecoder<unknown, unknown>>(decoderFactory: IDecoderConstructor<T, P>, params: P) {
        params = { ...params };  // copy parameters so I can modify the id without change the caller's object;
        if (params.id) {
            try {
                const codecToClone = codecRegistry.getInstance(params.id) as AbstractDecoder<unknown, unknown>;
                params = { ...codecToClone.params, ...params };   // use params as overrides for the real codecs parameters.
            } catch (e) {
                // nothing to do if no registered codec found.
            }
        } else {
            params.id = decoderFactory.name;
        }

        params.id += '_$_transient';  // make sure we don't register this in place of the real codec.
        const result = new decoderFactory(params);
        codecRegistry.unregister(result);  // don't need to keep this registered, it's only temporary.
        return result;
    }

    private async append(child: IDecoder<unknown, unknown>, parent?: IEncoder<unknown, unknown>) {
        if (!parent) {
            parent = this.targetEncoder;
        } else if (!this.activeCodecList.includes(parent as ICodec<unknown, unknown, unknown, unknown>)) {
            throw Error(`Parent encoder ${parent.id} was not found.`);
        }

        if (child.setParentEncoder === undefined || child.decoderInputType === undefined || child.decoderOutputType === undefined) {
            throw Error(`Invalid child node.  "${child.id}" is not an IDecoder`);
        }
        if (child.decoderInputType.isCompatible(parent.encoderOutputType)) {
            if (parent.encoderInputType.isCompatible(child.decoderOutputType)) {
                parent.addChildDecoder(child);
                child.setParentEncoder(parent);
            } else {
                throw Error(`Type Mismatch: ${parent.id} input type "${parent.encoderInputType.name}" is incompatible with ${child.id} output type "${child.decoderOutputType.name}"`);
            }
        } else {
            throw Error(`Type Mismatch: ${parent.id} output type "${parent.encoderOutputType.name}" is incompatible with ${child.id} input type "${child.decoderInputType.name}"`);
        }

        if (child.configure) {
            child.configure();
        }
        if (child.onConnect) {
            await child.onConnect(this.logger);
        }
        this.activeCodecList.push(child as ICodec<unknown, unknown, unknown, unknown>);
    }
}