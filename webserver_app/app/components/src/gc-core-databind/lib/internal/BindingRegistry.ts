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
import { AbstractBindProvider } from './AbstractBindProvider';
import { IBindFactory } from './IBindFactory';
import { isDisposable } from './IDisposable';
import { IDataBinder } from './IDataBinder';
import { DataBinder, computeFn } from './DataBinder';
import { NAME } from './IBind';
import { IBindValue } from './IBindValue';
import { CollectionBindValue } from './CollectionBindValue';
import { Status } from './Status';
import { GcFiles } from '../../../gc-core-assets/lib/GcFiles';
import { AbstractBindValue } from './AbstractBindValue';
import './DataFormatter'; // this is required to register $hex formatters for example.
import { MathModel } from './MathModel';
import { PropertyModel } from './PropertyModel';
import { GcConsole as console } from '../../../gc-core-assets/lib/GcConsole';
import { WidgetModel } from './WidgetModel';
import { GcUtils } from '../../../gc-core-assets/lib/GcUtils';
import { IDeferedPromise, GcPromise } from '../../../gc-core-assets/lib/GcPromise';

const nullDataBinder = new (class implements IDataBinder {
    enabled: boolean = false;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    dispose() {
    }
});
const matchIDRegEx = /\s+id="([^"]+)"/;

interface IJsonWidgetBinding {
    widgetId: string;
    propertyName: string;
    serverBindName: string;
    options?: {
        dataType: string;
        defaultValue: string;
    };
}

interface IJsonWidgetBindings {
    widgetBindings: IJsonWidgetBinding[];
}

class BinderCollection implements IDataBinder {
    private binders: IDataBinder[] = [];
    private _enabled = false;
    set enabled(enable) {
        if (this._enabled !== enable) {
            this._enabled = enable;
            this.binders.forEach((binder) => binder.enabled = enable);
        }
    }

    get enabled() {
        return this._enabled;
    }

    add(binder?: IDataBinder) {
        if (binder) {
            this.binders.push(binder);
            binder.enabled = this.enabled;
        }
    }

    dispose() {
        this.enabled = false;
    }
}

/**
 * Singleton class where all bindings, and binding expressions are
 * registered. This is also where data model {@link IBindFactory}
 * instances are registered.
 */
class BindingRegistry extends AbstractBindProvider {

    private models = new Map<string, IBindFactory>();
    private waitForModelPromises = new Map<string, IDeferedPromise<IBindFactory>>();
    private defaultModelName?: string;

    private addModel(name: string, model: IBindFactory) {
        this.models.set(name, model);
        if (this.waitForModelPromises.has(name)) {
            this.waitForModelPromises.get(name)!.resolve(model);
            this.waitForModelPromises.delete(name);

            console.log(NAME, `Model id=${name} is ready.`);
        }
    }

    /**
     * Register a data model with the binding registry. At least one model must
     * be registered in order for this class to be able to create bindings.
     *
     * @param model the models binding factory to
     *        create new bindings.
     * @param makedefault optional flag to make this the new
     *        default model.
     * @param alias optional alias that can be used in place of the model name, for example, $ for widget
     */
    registerModel(model: IBindFactory, makeDefault: boolean = false, alias?: string) {
        const name = model.id;
        // use first registered model as default, if not already specified.
        this.defaultModelName = this.defaultModelName || name;
        if (makeDefault) {
            this.defaultModelName = name;
        }

        this.addModel(name, model);
        if (alias && !this.models.has(alias)) { // don't overwrite a real model name with an alias.
            this.addModel(alias, model);
        }
    }

    waitForModelReady(name: string, timeout = 0) {
        const model = this.getModel(name);
        if (model) {
            return Promise.resolve(model);
        }

        let defer = this.waitForModelPromises.get(name);
        if (!defer) {
            defer = GcPromise.defer<IBindFactory>();
            defer.promise = timeout > 0 ? GcPromise.timeout(defer.promise, timeout, `Timeout waiting for model id="${name}" to be ready`) : defer.promise;
            this.waitForModelPromises.set(name, defer);
        }
        return defer.promise;
    }

    /**
     * Get a data model that has already been registered with this binding provider.
     *
     * @param name identifier for the model. E.g. widget. If missing returns the default model.
     * @returns the model found or undefined if it  is not registered.
     */
    getModel(name?: string): IBindFactory | null {
        name = name || this.defaultModelName; // use default if not specified.
        return name ? this.models.get(name) || null : null;
    }

    /**
     * The default model, which is usually the widget model.
     */
    get defaultModel() {
        return this.defaultModelName;
    }

    set defaultModel(name: string | undefined) {
        this.defaultModelName = name;
    }

    /**
     * Method to delete and dispose of all bindings and models in the binding
     * registry.
     */
    dispose() {
        super.dispose();

        this.models.forEach((model) => {
            if (isDisposable(model)) {
                model.dispose();
            }
        });
        this.models.clear();
        this.waitForModelPromises.clear();
        this.defaultModelName = undefined;
    }

    parseModelFromBinding(uri: string): { model: IBindFactory; bindName: string } {
        let modelFactory: IBindFactory | null = null;
        let pos = uri.indexOf('.');
        if (pos > 0) {
            let modelName = uri.substring(0, pos);
            if (modelName === 'widget' || modelName === '$') {
                const endPos = uri.indexOf('.', pos + 1);
                if (endPos > 0) {
                    const widgetModelName = uri.substring(pos + 1, endPos);
                    if (this.getModel(widgetModelName)) {
                        modelName = widgetModelName;
                        pos = endPos;
                    }
                }
            }

            modelFactory = this.getModel(modelName);

            if (modelFactory) {
                uri = uri.substring(pos + 1);
            }
        }

        modelFactory = modelFactory || this.getModel();

        if (!modelFactory) {
            throw new Error('There is no default model for bindings');
        }
        return { model: modelFactory, bindName: uri };
    }

    /**
     * Method to disable a binding previously created using the bind() method.
     * This will also unregister the two bind values that are being bound together.
     * If no other binding or expression is using the bind values, then garbage collection
     * will dispose of them.  Otherwise, new bindings may create additional bindValues
     * and you will end up with multiple bindValues for the same model or target data.
     * This will not cause problems, but is less efficient.
     *
     * @param binder the binding to delete.
     *        as a setter function. E.g. widget.
     * @param model the name of the default model
     *        when used as getter, or the this pointer when used as a setter.
     */
    unbind(binder: IDataBinder): void {
        binder.enabled = false;
    }

    private createBindingCollection(bindings: string | object) {
        if (typeof bindings === 'object') {
            const result = new Map<string, IBindValue>();
            for (const name in bindings) {
                // eslint-disable-next-line no-prototype-builtins
                if (bindings.hasOwnProperty(name)) {
                    let binding: IBindValue | null;
                    // @ts-ignore
                    const bindName = bindings[name];
                    try {
                        binding = this.getBinding(bindName);
                    } catch (e) {
                        throw new Error(`Can't parse binding "${bindName}".\n${e}`);
                    }
                    if (binding !== null) {
                        result.set(name, binding);
                    } else {
                        throw new Error(`Binding "${bindName}" could not be found.`);
                    }
                }
            }
            return new CollectionBindValue(result);
        } else {
            try {
                return this.getBinding(bindings);
            } catch (message) {
                throw new Error(`Can't parse binding "${bindings}".\n${message}`);
            }
        }
    }

    /**
     * <p>
     * Method to bind together a target and a model binding.
     * </p>
     * <p>
     * The difference between the target binding and the model binding is
     * subtle. The modelBinding contains the initial value. Otherwise there is
     * no distinction between model and target. Once the bindings are bound
     * together, their value and status will forever be the same. If either
     * value of status changes on one binding, the other will be updated to
     * reflect the change. This is typically used to keep widget and model data
     * in sync.
     * </p>
     * <p>
     * This method returns a binder object that can be used to control the
     * enabled disabled state of this two-way data binding between target and
     * model bindings.
     * </p>
     *
     * @param targetBinding name or expression for the target
     *        binding.
     * @param modelBinding name or expression for the model
     *        binding.
     * @param getter getter/preprocessing for a computed value
     * @param setter setter/postprocessing for a computed value
     * @returns interface to control the binding created between
     *          the the target and model bindings.
     */
    bind(targetBinding: string | object, modelBinding: string | object, getter?: computeFn, setter?: computeFn): IDataBinder | null {
        let targetBind: IBindValue | null = null;
        let modelBind: IBindValue | null = null;
        try {
            targetBind = this.createBindingCollection(targetBinding);
            modelBind = this.createBindingCollection(modelBinding);
            return DataBinder.bind(targetBind, modelBind, getter, setter);
        } catch (e) {
            const errorStatus = Status.createErrorStatus(e.message);
            if (targetBind) {
                targetBind.status = errorStatus;
            } else {
                try {
                    if (!modelBind) {
                        modelBind = typeof modelBinding === 'object' ? this.createBindingCollection(modelBinding) : this.getBinding(modelBinding);
                    }
                    if (modelBind) {
                        modelBind.status = errorStatus;
                    }
                    // eslint-disable-next-line no-empty
                } catch (err) {
                }
            }

            console.error(NAME, e);
            return nullDataBinder;
        }
    }

    getDefaultBindingFile() {
        try {
            let path = window.location.pathname;
            const pos = path.lastIndexOf('/');

            if (pos !== path.length - 1) {
                path = path.substring(pos + 1);
                return path.replace('.html', '.json');
            }
        } catch (e) {/* do nothing */ }

        return 'index.json';
    }

    getDefaultPropertyFile() {
        return 'index_prop.json';
    }

    private bindingCollections = new Map<string, BinderCollection>();

    unloadBindingsFromFile(jsonFile: string) {
        jsonFile = jsonFile || this.getDefaultBindingFile();

        const binder = this.bindingCollections.get(jsonFile);
        if (binder) {
            binder.enabled = false;
        }
    }

    private async loadBinding(wb: IJsonWidgetBinding, jsonFile: string) {
        try {
            if (wb.widgetId) {
                await WidgetModel.whenWidgetReady(wb.widgetId);
            }

            if (wb.serverBindName) {
                const bindSegments = wb.serverBindName.split('.');
                if (bindSegments.length > 1) {
                    let modelId = bindSegments[0];
                    if (modelId === 'widget' || modelId ==='$') {
                        const widget = await WidgetModel.whenWidgetReady(bindSegments[1]);
                        if (widget && widget.tagName.toLowerCase().startsWith('gc-model-')) {
                            modelId = widget.id;
                        }
                    }
                    try {
                        await this.waitForModelReady(modelId, 10000);
                    } catch (e) {
                        console.error(NAME, `${e.message || e.toString()} for binding ${wb.serverBindName}.`);
                    }
                }
            }
        } catch (e) {
            // ignore timeout errors, missing widget error messages will be generated below
        }

        // set the default type for the widget binding
        const widgetBindName = `widget.${wb.widgetId}.${wb.propertyName}`;
        if (wb.options && wb.options.dataType) {
            const widgetBind = this.getBinding(widgetBindName);
            let defaultType = wb.options.dataType.toLowerCase();
            if (defaultType === 'long' || defaultType === 'short' || defaultType === 'int' || defaultType === 'double' || defaultType === 'float') {
                defaultType = 'number';
            }
            if (widgetBind && (widgetBind as AbstractBindValue).setDefaultType) {
                (widgetBind as AbstractBindValue).setDefaultType(defaultType);
            } else {
                console.error(NAME, `Cannot set default type on binding "${widgetBindName}" because it does not exist.`);
            }
        }

        // Binding records with no widgetId are used to initialize backplane bindings.
        if (!wb.widgetId && wb.serverBindName && wb.options && (typeof wb.options.defaultValue !== 'undefined')) {
            const bind = this.getBinding(wb.serverBindName);
            if (bind) {
                bind.setValue(wb.options.defaultValue);
            } else {
                console.error(NAME, `Cannot set default binding value because the binding "${wb.serverBindName}" does not exist.`);
            }

        } else {
            const binder = this.bind(widgetBindName, wb.serverBindName) ?? undefined;
            if (!binder) {
                console.error(NAME, `Cannot find binding "${widgetBindName}", that is referenced in json file "${jsonFile}".`);
            }
            return binder;
        }
    }

    async loadBindingsFromFile(jsonFile?: string): Promise<IDataBinder> {
        jsonFile = jsonFile || this.getDefaultBindingFile();

        let results = this.bindingCollections.get(jsonFile);
        if (!results) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = await GcFiles.readJsonFile(jsonFile) as IJsonWidgetBindings;
                results = new BinderCollection();
                this.bindingCollections.set(jsonFile, results);
                if (data) {

                    const promises = data.widgetBindings.map( wb => this.loadBinding(wb, jsonFile!));
                    const binders = await Promise.all(promises);
                    binders.forEach(binder => results!.add(binder));
                }
            } catch (error) {
                console.error(NAME, error);
                return nullDataBinder;
            }
        }
        results.enabled = true;
        return results;
    }

    async loadPropertiesFromFile(model: string, jsonFile: string): Promise<object | undefined> {
        jsonFile = jsonFile || this.getDefaultPropertyFile();

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const jsonData = await GcFiles.readJsonFile(jsonFile) as any;
            return jsonData ? jsonData[model] : undefined;
        } catch (error) {
            console.error(NAME, error);
            return undefined;
        }
    }

    parseBindingsFromGist(modelName: string, arrayOfLines: string[], modelID: string) {
        const re = new RegExp('\\s+(\\w+)\\s*=\\s*"\\s*{{\\s*\\$\\.' + modelName + '\\.([a-zA-Z0-9_\\.$]+)', 'g');
        const bindingsData = [];
        if (this.defaultModel === modelID) {
            modelID = '';
        } else {
            modelID = modelID + '.';
        }
        for (let i = 0; i < arrayOfLines.length; i++) {
            const pos = arrayOfLines[i].indexOf('$.' + modelName + '.');
            if (pos >= 0) {
                // parse binding expression and property name
                const matches = arrayOfLines[i].match(matchIDRegEx);
                if (matches) {
                    const widgetId = matches[1];
                    let match = re.exec(arrayOfLines[i]);
                    while (match) {
                        const bindingExpression = match[2];
                        const propertyName = match[1];

                        bindingsData.push(
                            {
                                propertyName: propertyName,
                                serverBindName: modelID + bindingExpression,
                                widgetId: widgetId
                            });

                        match = re.exec(arrayOfLines[i]);
                    }
                }
            }
        }
        return bindingsData;
    }

    saveJsonFile(jsonFile: string, jsonObject: object) {
        return GcFiles.writeJsonFile(jsonFile, jsonObject);
    }

    savePropertiesToFile(jsonFile: string, properties: object) {
        jsonFile = jsonFile || this.getDefaultPropertyFile();

        return this.saveJsonFile(jsonFile, properties);
    }

    saveBindingsToFile(jsonFile: string, bindings: object) {
        let jsonObject = bindings;
        if (bindings instanceof Array) {
            jsonObject = {
                widgetBindings: bindings
            };
        }
        jsonFile = jsonFile || this.getDefaultBindingFile();

        return this.saveJsonFile(jsonFile, jsonObject);
    }
}

export const bindingRegistry = new BindingRegistry();

bindingRegistry.registerModel(new MathModel());
bindingRegistry.registerModel(new PropertyModel());
bindingRegistry.registerModel(WidgetModel.instance, true, '$');

if (!GcUtils.isNodeJS) {
    (async function init() {
        await WidgetModel.documentContentLoaded;

        // Fire legacy ready event for gc.databind.ready
        document.dispatchEvent(new CustomEvent('gc-databind-ready', { detail: { registry: bindingRegistry } }));

        if (!GcUtils.isInDesigner) {
            bindingRegistry.loadBindingsFromFile();
        }
    })();
}
