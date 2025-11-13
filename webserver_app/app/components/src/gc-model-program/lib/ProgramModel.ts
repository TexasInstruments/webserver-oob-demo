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

import { IPollingModelBaseParams } from '../../gc-target-configuration/lib/IPollingModelBaseParams';
import { DSEvalBind } from './internal/DSEvalBind';
import { codecRegistry, IDecoder, INoopDecoder, EncoderType, DecoderType } from '../../gc-target-configuration/lib/TargetConfiguration';
import { bindValueType, IBindFactory, IBindValue, AbstractAsyncBindValue, AbstractPollingDataModel, VariableBindValue, valueChangedEventType, QUALIFIER, bindingRegistry } from '../../gc-core-databind/lib/CoreDatabind';
import { IProgramLoaderParams } from '../../gc-service-program-loader/lib/ProgramLoaderService';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IProgramModelParams extends IPollingModelBaseParams, IProgramLoaderParams {
}

export interface IProgramModelEncoder {
    readValue(info: string, core?: string): Promise<bindValueType>;
    writeValue(info: string, value: bindValueType, core?: string): Promise<void>;
    initCore(params: IProgramLoaderParams, programAlreadyLoaded?: boolean): Promise<void>;
}

export const nullProgramModelEncoder = new (class implements IProgramModelEncoder {
    async readValue(): Promise<bindValueType> {
        throw new Error('Method not implemented.');
    }
    async writeValue(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    async initCore(): Promise<void> {
        throw new Error('Method not implemented.');
    }
})();

export type IProgramModelDecoder = INoopDecoder;
export const nullProgramModelDecoder: IProgramModelDecoder = {};

export interface IProgramModel extends IBindFactory{
    codec?: IProgramModelEncoder;
}

export const ProgramModelDecoderType = new DecoderType<IProgramModelDecoder>('pm');
export const ProgramModelEncoderType = new EncoderType<IProgramModelEncoder>('GEL');

class QualifiedBindFactory {
    constructor(private qualifier: string) {
    }
    create(bind: IBindValue) {
        if (!(bind as AbstractAsyncBindValue).setQualifier) {
            return null;
        } else {
            (bind as AbstractAsyncBindValue).setQualifier(this.qualifier);
            return bind;
        }
    }
}

export class ProgramModel extends AbstractPollingDataModel implements IProgramModel, IBindFactory,  IDecoder<IProgramModelDecoder, IProgramModelEncoder> {
    decoderInputType = ProgramModelDecoderType;
    decoderOutputType = ProgramModelEncoderType;
    codec?: IProgramModelEncoder;
    private programAlreadyLoaded = false;

    constructor(protected params: IProgramModelParams) {
        super(params.id || 'pm', params.defaultRefreshInterval);

        const activeDebugContext = new VariableBindValue('');
        this.modelBindings.set('$active_context_name', activeDebugContext);
        activeDebugContext.addEventListener(valueChangedEventType, () => {
            // clear out critical errors on every context change
            const bindings = this.getAllBindings();
            bindings.forEach((bind) => {
                if (bind && bind.onDisconnected) {
                    bind.onDisconnected();
                }
            });

            // force a read on all bindings for the new context.
            this.refreshAllBindings();
        });

        for (const qualifier in QUALIFIER) {
            this.addQualifier(qualifier, new QualifiedBindFactory(qualifier));
        }

        bindingRegistry.registerModel(this);
        codecRegistry.register(this);
    }

    dispose() {
        super.dispose();
        codecRegistry.unregister(this);
    }

    createNewBind(uri: string): IBindValue | null {
        let result = super.createNewBind(uri);
        result = result || new DSEvalBind(uri, this.defaultRefreshBinding, this);
        return result;
    }

    async invokeMethod(method: string, args: string[]) {
        let expression = method.trim();
        if (expression.startsWith('GEL_')) {
            expression = expression + '(' + (args ? args.join(', ') : '') + ')';
        }

        if (!this.isConnected()) {
            await this.whenConnected();
        }
        return this.codec?.readValue(expression).then(function(data: bindValueType) {
            try {
                return Number.parseInt(data, 16);
            } catch (e) {
                return -1;
            }
        });
    }

    setParentEncoder(parent: IProgramModelEncoder): void {
        this.codec = parent;
    }

    deconfigure() {
        this.codec = undefined;
    }

    async onConnect(transport: unknown) {
        if (this.codec) {
            await this.codec.initCore(this.params, this.programAlreadyLoaded);
            if (!this.params.sram) {
                this.programAlreadyLoaded = true;
            }
            await super.onConnect(transport);
        } else {
            throw Error('Missing a parent codec.');
        }
    }
}
