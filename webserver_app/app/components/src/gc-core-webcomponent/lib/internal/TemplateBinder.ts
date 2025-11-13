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

import { AbstractBindValue, WidgetModel, DataBinder, IValueChangedEvent, bindValueType, IBindFactory } from '../../../gc-core-databind/lib/CoreDatabind';
import { IProperty } from '../GcWebComponentHelper';
import { GcConsole } from '../../../gc-core-assets/lib/GcConsole';
import './IDomApi.js';
import './htmlParser.js';

export { IBindFactory } from '../../../gc-core-databind/lib/CoreDatabind';

export interface IPropertyManager {
    watch(name: string, listener: (value: bindValueType) => void): void;
    setValue(property: IProperty, newValue: bindValueType): void;
    getProperty(name: string): IProperty | undefined;
};

export interface ITemplateBindInfo {
    widgetId: string;
    serverBindName: string;
    propertyName: string;
    options?: {
        oneWay?: boolean;
    };
};

interface ITemplateAnnotations {
    text: string;
    type: 'error' | 'warning' | 'info';
    row: number;
    column: number;
};

class HostPropertyValueBind extends AbstractBindValue {
    constructor(private property: IProperty, private propertyHelper: IPropertyManager) {
        super(property.type);

        propertyHelper.watch(property.name, (newValue: bindValueType) => {
            this.updateValue(newValue);
        });

        this.cachedValue = property.value;
    }

    protected onValueChanged(details: IValueChangedEvent): void {
        this.propertyHelper.setValue(this.property, details.newValue);
    }
};

class TemplateBindingModel extends WidgetModel {

    constructor(shadowRoot: DocumentFragment | Element, private propertyManager: IPropertyManager) {
        super(shadowRoot);
    }

    createNewBind(uri: string): AbstractBindValue | null {
        if (uri.startsWith('$.')) {
            return super.createNewBind(uri.substring('$.'.length));
        } else {
            const property = this.propertyManager.getProperty(uri);
            if (property) {
                return new HostPropertyValueBind(property, this.propertyManager);
            }
        }
        return null;
    };
};

export class TemplateBinder {
    private template = document.createElement('template');
    private bindings: ITemplateBindInfo[] = [];
    private static instances = new Map<string, TemplateBinder>();

    private constructor(componentName: string, htmlText: string) {
        const parser = window.gc.htmlParserFactory.create(htmlText, 3);
        const annotations = parser.getAnnotations() as ITemplateAnnotations[];
        if (annotations && annotations.length > 0) {
            const details = annotations[0];
            const errorMessage = `&lt;${componentName}&gt; has syntax ${details.type} on line ${details.row + 1}: ${details.text}`;
            this.template.innerHTML = `<gc-widget-icon icon="action:error_outline" appearance="error" size="l" tooltip="${errorMessage}"></gc-widget-icon>`;
        } else {
            this.bindings = parser.extractAllTemplateBindings() as ITemplateBindInfo[];
            this.template.innerHTML = parser.getText();
        }
    };

    stampTemplate(shadowRoot: DocumentFragment | Element, propertyManager: IPropertyManager, console: GcConsole, extraBindings?: ITemplateBindInfo[]): IBindFactory {

        // clone template
        const templateInstance = this.template.content.cloneNode(true);
        shadowRoot.appendChild(templateInstance);

        // create bindings
        const model = new TemplateBindingModel(shadowRoot, propertyManager);
        TemplateBinder.createBindings(model, this.bindings, console);
        if (extraBindings) {
            TemplateBinder.createBindings(model, extraBindings, console);
        }
        return model;
    };

    static createBindings(model: IBindFactory, bindings: ITemplateBindInfo[], console: GcConsole) {
        bindings.forEach( (binding) => {
            try {
                const modelBind = model.parseModelSpecificBindExpression(binding.serverBindName);
                if (!modelBind) {
                    console.error(`Can't bind to missing property: ${binding.serverBindName}`);
                }
                const targetBind = model.getBinding(`$.${binding.widgetId}.${binding.propertyName}`);
                if (!targetBind) {
                    console.error(`Can't bind to property: ${binding.propertyName}, on widget: ${binding.widgetId}`);
                }
                if (modelBind && targetBind) {
                    DataBinder.bind(targetBind, modelBind, undefined, undefined, binding.options && binding.options.oneWay);
                }
            } catch (error) {
                console.error(`Bind expression "${binding.serverBindName}" parsing error: ${error.message || error.toString()}`);
            }
        });
    };

    static async getInstance(componentName: string, htmlText?: string, htmlFilepath?: string) {
        let result = this.instances.get(componentName);
        if (!result) {
            if (!htmlText) {
                if (htmlFilepath) {
                    htmlText =  await (await fetch(htmlFilepath)).text();
                } else {
                    throw Error('Missing template for custom component');
                }

            }
            result = new TemplateBinder(componentName, htmlText || '');
            this.instances.set(componentName, result);
        }
        return result;
    };
};
