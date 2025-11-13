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
import { IEncoder, IDecoder } from './AbstractCodec';
import { GcPromise, IDeferedPromise } from '../../../gc-core-assets/lib/GcPromise';
import { ITransport } from './ITransport';
import { capitalize } from './AbstractConnectionLogger';

/* eslint-disable @typescript-eslint/no-explicit-any */

type codecNodeType = IEncoder<any, any> | IDecoder<any, any>;

type TriState = 'yes' | 'no' | 'maybe';

function OR(x: TriState, y: TriState): TriState {
    return (x === 'yes' || y === 'yes') ? 'yes' : (x === 'maybe' || y === 'maybe') ? 'maybe' : 'no';
}

// eslint-disable-next-line no-useless-escape
const regExSplitOnCommaNotInParenthesis = /\,(?![^\)\()]*\))/;

const invalidNameRegEx = /[^0-9a-zA-Z_.$]/;

class CodecInfo {
    inUse = false;
    isConnected = false;
    private children: CodecInfo[] = [];
    order = -1;

    constructor(readonly codec: codecNodeType) {
    }

    isDeviceRequired(deviceId: string, recursive = false): TriState {
        let result: TriState = 'no';

        if (this.codec.deviceId === deviceId) {
            result = 'yes';
        } else if (recursive) {
            result = this.children.reduce((isUsed: TriState, child) => OR(isUsed, child.isDeviceRequired(deviceId, recursive)), 'no');
        }
        return this.isOptional() && result === 'yes' ? 'maybe' : result;
    }

    isOptional(): boolean {
        if (this.codec.optional) {
            // case 1: specifically marked as optional
            return true;
        } else if (this.children.length === 0) {
            // case 2: no children and not optional
            return false;
        } else {
            // case 3: not optional, but all children are optional.
            return this.children.reduce( (result: boolean, child) => result && child.isOptional(), true);
        }
    }

    isPartiallyConnected(): boolean {
        return this.isConnected && this.children.reduce( (result: boolean, child) => {
            return result || !child.isConnected || child.isPartiallyConnected();
        }, false);
    }

    async disconnect(transport: ITransport) {
        for (let i = 0; i < this.children.length; i++) {
            try {
                const child = this.children[i];
                await child.disconnect(transport);
            } catch (err) {
                // ignore errors on child disconnect, there is no recovery for a failed disconnect.
            }
        }
        if (this.codec.onDisconnect && this.isConnected) {
            try {
                transport.addDebugMessage(`Disconnecting ${this.codec.toString()}`);
                await this.codec.onDisconnect(transport);
            } catch (err) {
                transport.addWarningMessage(`${this.codec.toString()} failed to disconnect: ${err}`);
            }
        }
        this.isConnected = false;
    }

    async connect(transport: ITransport, failedDevicesList: Array<string>) {
        this.isConnected = false;
        if (this.codec.onConnect) {
            failedDevicesList.forEach((deviceId) => {
                if (this.isDeviceRequired(deviceId, true) === 'yes' || this.isDeviceRequired(deviceId, false) !== 'no') {
                    throw Error(`Program was not loaded successfully for device="${deviceId}".`);
                }
            }, true);

            transport.assertStillConnecting();
            try {
                transport.addDebugMessage(`Connecting ${this.codec.toString()}`);
                await this.codec.onConnect(transport);
            } catch (err) {
                transport.addDebugMessage(`${this.codec.toString()} failed to connect: ${err}`);
                throw err;
            }
        }
        this.isConnected = true;

        let childConnectCount = 0;
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            transport.assertStillConnecting();
            try {
                await child.connect(transport, failedDevicesList);
                childConnectCount++;
            } catch (err) {
                transport.assertStillConnecting();
                if (!child.isOptional()) {
                    throw err;
                }
            }
        }

        // when multiple children are all optional, we assume at least one is expected to connect.
        if (childConnectCount === 0 && this.children.length > 1) {
            throw Error('One or more codecs failed to connect without error.');
        }
    }

    async ping(): Promise<void> {
        if (this.isConnected) {
            if (this.codec.ping) {
                await this.codec.ping();
            }
            for (let i = 0; i < this.children.length; i++) {
                const child = this.children[i];
                await child.ping();
            }
        }
    }

    doDeconfigure() {
        if (this.inUse && this.codec.deconfigure) {
            this.codec.deconfigure();
        }
        this.inUse = false;
        this.isConnected = false;
        this.children = [];
        this.order = -1;
    }

    doConfigure(children: CodecInfo[], order: number) {
        if (this.codec.configure) {
            this.codec.configure();
        }
        this.inUse = true;
        this.children = children;
        this.order = order;
    }
}

class CodecRegistry {
    private instances = new Map<string, CodecInfo>();
    private waitForCodecs = new Map<string, IDeferedPromise<void>>();
    private order = 1;

    public configure(configuration: string) {
        // deconfigure any existing configuration.
        this.instances.forEach((item) => item.doDeconfigure() );

        // construct the new configuration.
        configuration = configuration.trim();
        if (configuration.length === 0) {
            throw Error('The config specification was empty.');
        }

        try {
            this.order = 1;  // reset the order codec order for the new configuration
            this.parseConfigurationList(configuration);
        } catch (e) {
            throw Error(`Invalid configuration specified: ${capitalize(e.message)} in "${configuration}".`);
        }
    }

    private parseConfigurationChain(config: string, children: CodecInfo[]): CodecInfo {
        const pos = config.indexOf('(');
        if (pos >= 0) {
            if (config.endsWith(')')) {
                if (children.length > 0) {
                    throw Error(`The configuration must represent a tree, but child nodes found after: "${config}"`);
                }
                const childConfig = config.substring(pos + 1, config.length - 1).trim();
                if (childConfig.length === 0) {
                    throw Error('Operator () is empty, but was expecting a comma separated list of child nodes');
                }
                children = this.parseConfigurationList(childConfig);
                const parentChain = config.substring(0, pos).trim();
                if (parentChain.length === 0) {
                    throw Error(`Operator () is missing the parent node, which was expected before the opening parentheses of "${config}"`);
                }
                return this.parseConfigurationChain(parentChain, children);
            } else {
                throw Error(`Operator () is missing a closing parenthesis ")" at the end of "${config}"`);
            }
        } else {
            const nodes = config.split('+');

            let codecInfo: CodecInfo;
            for (let i = nodes.length; i-- > 0;) {
                const nodeName = nodes[i].trim();

                if (nodeName.length === 0) {
                    if (i === 0) {
                        throw Error(`Operator + is missing it's left parameter in "${config}"`);
                    }
                    throw Error(`Operator + is missing it's right parameter in "${nodes[i - 1]}+"`);
                }
                codecInfo = this.getInstanceInfo(nodeName);

                if (codecInfo.inUse) {
                    throw Error(`${codecInfo.codec.toString()} is used twice`);
                }

                if (children.length > 0) {
                    const parent = codecInfo.codec as IEncoder<any, any>;
                    // Got TS2774 when writing as if (!(parent.addChildDecoder && parent.encoderInputType && parent.encoderOutputType))
                    if (parent.addChildDecoder === undefined || parent.encoderInputType === undefined || parent.encoderOutputType === undefined) {
                        throw  Error(`Invalid parent node.  "${parent.id}" is not an IEncoder.`);
                    }
                    children.forEach((c) => {
                        const child = c.codec as IDecoder<any, any>;
                        // Got TS2774 when writing as if (!(child.setParentEncoder && child.decoderInputType && child.decoderOutputType))
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
                    });
                }
                codecInfo.doConfigure(children, this.order++);
                children = [codecInfo];
            }
            return codecInfo!;
        }
    }

    private parseConfigurationList(config: string): CodecInfo[] {
        let configs = config.split(regExSplitOnCommaNotInParenthesis);
        configs = configs.map((value) => value.trim());
        if (configs.reduce((state, value) => state || value.length === 0, false)) {
            throw Error(`Missing at least one child in this comma separated list "${config}"`);
        }
        return configs.map((child) => this.parseConfigurationChain(child, []));
    }

    private validateCodecName(name: string) {
        name = name.toLowerCase();
        if (!(name && name.match(invalidNameRegEx) === null)) {
            throw Error(`Bad identifier "${name}".  Identifiers for Codecs, models, and transports must only contain numbers, letters, underscore, period, or $ characters.`);
        }
        return name;
    }

    /**
     * Method for registering codecs for use in active configurations.  Only codecs with id's will be registered.
     *
     * @param instance - the instance of the codec to register.
     */
    register(instance: codecNodeType): void {
        if (instance.id) {
            const id = this.validateCodecName(instance.id);
            this.instances.set(id, new CodecInfo(instance));

            const promise = this.waitForCodecs.get(id);
            if (promise) {
                promise.resolve();
            }
        }
    }

    /**
     * Method for unregistering codecs no longer to be use in active configurations.
     *
     * @param instance - the instance of the codec to unregister.
     */
    unregister(instance: codecNodeType): void {
        if (instance.id) {
            const info = this.instances.get(instance.id);
            if (info && info.codec === instance) {  // only remove it, if it has been overridden by another instance with the same name already.
                this.instances.delete(instance.id);
                this.waitForCodecs.delete(instance.id);
            }
        }
    }

    private getInstanceInfo(name: string) {
        const id = this.validateCodecName(name);
        const result = this.instances.get(id);
        if (!result) {
            throw Error(`Missing a model, transport, or codec with id="${name}"`);
        }
        return result;
    }

    getInstance(name: string) {
        return this.getInstanceInfo(name).codec;
    }

    isActive(name: string) {
        return this.getInstanceInfo(name).inUse;
    }

    isConnected(name: string) {
        return this.getInstanceInfo(name).isConnected;
    }

    isPartiallyConnected(name: string) {
        return this.getInstanceInfo(name).isPartiallyConnected();
    }

    ping(name: string) {
        return this.getInstanceInfo(name).ping();
    }

    connect(name: string, transport: ITransport, failedDevicesList: Array<string> = []) {
        return this.getInstanceInfo(name).connect(transport, failedDevicesList);
    }

    disconnect(name: string, transport: ITransport) {
        return this.getInstanceInfo(name).disconnect(transport);
    }

    isOptional(name: string) {
        return this.getInstanceInfo(name).isOptional();
    }

    isDeviceRequired(names: string | Array<string>, deviceId: string, recursive = false): TriState {
        if (names instanceof Array) {
            return names.reduce<TriState>((isUsed: TriState, name) => OR(isUsed, this.getInstanceInfo(name).isDeviceRequired(deviceId, recursive)), 'no');
        } else {
            return this.getInstanceInfo(names).isDeviceRequired(deviceId, recursive);
        }
    }

    compareOrder(name1: string, name2: string): number {
        return this.getInstanceInfo(name1).order - this.getInstanceInfo(name2).order;
    }

    async whenConfigurationReady(configuration: string) {
        const ids = configuration.toLowerCase().split(/[,()+]+/g);
        for (let i = 0; i < ids.length; i++ ) {
            const id = ids[i].trim();
            if (id && id.match(invalidNameRegEx) === null && !this.instances.get(id)) {
                if (!this.waitForCodecs.get(id)) {
                    this.waitForCodecs.set(id, GcPromise.defer<void>());
                }
                await this.waitForCodecs.get(id)!.promise;
            }
        }
    }

    dispose() {
        this.instances = new Map<string, CodecInfo>();
        this.waitForCodecs = new Map<string, IDeferedPromise<void>>();
    }

}

export const codecRegistry = new CodecRegistry();