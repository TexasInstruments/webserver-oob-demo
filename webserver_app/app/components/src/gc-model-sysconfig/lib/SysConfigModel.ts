/**
 *  Copyright (c) 2021, Texas Instruments Incorporated
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *  *   Redistributions of source code must retain the above copyright
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
import { AbstractBindFactory, Status, IBindValue, bindingRegistry, AbstractBindValue, IValueChangedEvent, bindValueType } from '../../gc-core-databind/lib/CoreDatabind';
import { asyncCreateEnv, SysConfigEnv, Instance, Configurable, Module }  from './internal/sysConfig';
import { ICodecBaseParams } from '../../gc-target-configuration/lib/ICodecBaseParams';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { GcFiles } from '../../gc-core-assets/lib/GcFiles';

export interface ISysConfigModelParams extends ICodecBaseParams {
    metadataPath?: string;
    scriptPath?: string;
    boardPath?: string;
    package?: string;
    partName?: string;
}

class ConfigurableBind extends AbstractBindValue {
    constructor(private readonly model: SysConfigModel) {
        super();
    }

    protected onValueChanged(details: IValueChangedEvent): void {
        this.model.onConfigurableValueChanged(this.name!, this.cachedValue);
    }
}

/**
 * `SysConfigModel` is binding model for manipulating system configuration (.syscfg) files
 * within a GUI Composer app.
 *
 * @example
 * ```typescript
 * import { SysConfigModel } from '<path-to>/gc-model-sysconfig/lib/SysConfigModel';
 *
 * const model = new SysConfigModel({ metadataPath: '.metadata/project.json', scriptPath: 'myconfig.syscfg' deviceId: 'CC3235S' });
 * const script = model.getConfigScript();
 * const output = model.getGeneratedFile('templateName');
 * ```
 *
 * @packageDocumentation
 */
export class SysConfigModel extends AbstractBindFactory {
    private script?: SysConfigEnv;
    private scriptLoaded = false;
    private console: GcConsole;

    constructor(private readonly params: ISysConfigModelParams) {
        super('sysconfig');

        this.console = new GcConsole('gc-model-sysconfig', this.params.id);

        bindingRegistry.registerModel(this);

        // TODO: Support loading config script in the designer to have edit completion on SysConfig bindings.
        this.loadConfigScript();
    }

    /**
     * Method to reload a script.  This method is used when the paramters passed to the constructor have been changed
     * and a the script, metadata, or board or device have changes.
     *
    */
    async loadConfigScript() {
        this.scriptLoaded = false;
        if (!this.params.scriptPath || !this.params.metadataPath) {
            return;
        }

        const args = [];
        if (this.params.boardPath) {
            args.push('--board');
            args.push(this.params.boardPath);
        } else if (this.params.deviceId) {
            args.push('--device');
            args.push(this.params.deviceId);

            if (this.params.package) {
                args.push('--package');
                args.push(this.params.package);
            }
            if (this.params.partName) {
                args.push('--part');
                args.push(this.params.partName);
            }
        }

        args.push('--product');
        args.push(this.params.metadataPath);
        // args.push(this.params.scriptPath);

        const loadScriptPromise = GcFiles.readTextFile(this.params.scriptPath);
        this.script = await asyncCreateEnv(args);
        const scriptText = await loadScriptPromise;

        await this.script.internals.asyncChange( () => {
            const system = this.script?.system;
            const scripting = this.script?.scripting;
            eval(scriptText);
        });

        this.scriptLoaded = true;
        this.updateAllBindings();
    }

    private findConfigurablesByName(instance: Instance, filter: string): string[] {
        try {
            return instance.$module?.config?.map(config => config.name).filter(configName => !filter || configName.startsWith(filter));
        } catch (e) {
            this.console.error(e.message || e.toString());
        }
        return [];
    }

    private findTopModuleInstancesByName(filter: string, exactMatch = false): Instance[] {
        const result: Instance[] = [];
        if (!this.script?.system?.modules) {
            return result;
        }

        for (const moduleName in this.script.system.modules) {
            const module: Module = this.script.system.modules[moduleName];
            module.$instances.forEach( instance => {
                if (exactMatch ? instance.$name === filter : instance.$name.startsWith(filter)) {
                    result.push(instance);
                }
            });
        }
        return result;
    }

    private getValueByPath(path: string) {
        const segments = path.split('.');
        const topInstance = this.findTopModuleInstancesByName(segments[0], true);
        if (topInstance.length !== 1) {
            throw `Cannot find Module instance ${segments[0]}`;
        }
        let result = topInstance[0];
        for (let i = 1; i < segments.length; i++) {
            // eslint-disable-next-line no-prototype-builtins
            if (!result.hasOwnProperty(segments[i])) {
                throw `Cannot find member ${segments[i]}`;
            }
            result = result[segments[i]];
        }
        return result;
    }

    private setValueByPath(path: string, value: bindValueType) {
        const segments = path.split('.');
        const firstInstance = this.findTopModuleInstancesByName(segments[0], true);
        if (firstInstance.length !== 1) {
            throw `Cannot find Module instance ${segments[0]}`;
        }
        let result = firstInstance[0];
        for (let i = 1; i < segments.length-1; i++) {
            // eslint-disable-next-line no-prototype-builtins
            if (!result.hasOwnProperty(segments[i])) {
                throw `Cannot find member ${segments[i]}`;
            }
            result = result[segments[i]];
        }
        this.script?.internals.asyncChange( () => {
            result[segments[segments.length-1]] = value;
        });
    }

    /**
     * @hidden
    */
    lookupSuggestedBindings(filter: string): string[] {
        if (!this.script) {
            return [];
        }

        filter = filter || '';
        const pos = filter.lastIndexOf('.');
        let start: string;
        let prefix: string;
        if (pos > 0) {
            start = filter.substring(pos + 1);
            prefix = filter.substring(0, pos);
        } else  {
            start = filter;
            prefix = '';
        }

        if (prefix) {
            const instance = this.getValueByPath(prefix);
            if (instance) {
                return this.findConfigurablesByName(instance, start);
            }
        } else {
            return this.findTopModuleInstancesByName(start)?.map(instance => instance.$name);
        }

        return [];
    }

    private updateBindValue(bind: IBindValue, uri: string) {
        if (uri.startsWith('$') || !this.scriptLoaded) {
            return;
        }

        try {
            const value = this.getValueByPath(uri);
            bind.updateValue(value);
            bind.status = null;
        } catch (e) {
            bind.updateValue(undefined);
            bind.status = Status.createErrorStatus(e.message || e.toString());
        }
    }

    createNewBind(uri: string) {
        const result = new ConfigurableBind(this);
        this.updateBindValue(result, uri);
        return result;
    }

    private updateAllBindings() {
        this.modelBindings.forEach( (bind, uri) => bind && this.updateBindValue(bind, uri));
    }

    /**
     * @hidden
    */
    onConfigurableValueChanged(uri: string, value: bindValueType) {
        try {
            this.setValueByPath(uri, value);
            this.updateAllBindings();
        } catch (e) {
            this.console.warning(`Unable to set configurable ${uri} = ${value}.`);
        }
    }

    /**
     * Method to generate the .syscfg script.
    */
    async getConfigScript() {
        if (this.script) {
            return await this.script.internals.asyncSerialize();
        }
        throw new Error('There is no config script loaded.  Please call loadConfigScript() first.');
    }

    /**
     * Method to generate template files.
    */
    async getGeneratedFile(templateName: string) {
        if (this.script) {
            return await this.script.internals.asyncGenerate(templateName);
        }
        throw new Error('There is no config script loaded.  Please call loadConfigScript() first.');
    }
}

