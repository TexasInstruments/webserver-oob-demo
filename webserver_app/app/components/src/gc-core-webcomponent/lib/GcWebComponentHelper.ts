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

import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { TemplateBinder, ITemplateBindInfo, IPropertyManager, IBindFactory } from './internal/TemplateBinder';

const console = new GcConsole('GcWebComponentHelper');
const camelToDashCase = GcUtils.camelToDashCase;
const dashToCamelCase = GcUtils.dashToCamelCase;

/**
 * Returns the module path.
 *
 * @example
 *      getModulePath(import.meta);
 *
 * @param importMeta the import meta
 */
export const getModulePath = (importMeta: { url: string }) => {
    return importMeta?.url?.split('/').slice(0, -1).join('/');
};

type ValueType = undefined|string|number|boolean;
type PropWatcherListener = (newValue: ValueType, oldValue: ValueType) => void;

export interface IProperty {
    name: string;
    type: 'number'|'boolean'|'string';
    value?: ValueType;                      /* default is undefined */
    notify?: boolean;                       /* default is false     */
    readonly?: boolean;                     /* default is false     */
    reflect?: boolean;                      /* default is false     */
}

/**
 * `GcWebComponentHelper` provides an abstract implementation of the standard WebComponent implementation.
 *
 * @example
 *      const helper = new GcWebComponentHelper(htmlElement, ID, MODULE_PATH);
 *      helper.templateHtmlFile = './template.html';
 *      helper.cssFile = './styles.css';
 *      helper.defineProperty({ name: 'on', type: 'boolean' });
 *      helper.bindProperty('on', 'checkbox', 'checked');
 *      helper.init();
 */
export class GcWebComponentHelper implements IPropertyManager {
    private templateBindingModel?: IBindFactory;
    private cssFilePath?: string;
    private templateHtmlFilePath?: string;
    private templateStr?: string;
    private properties: Array<IProperty> = [];
    private bindings: Array<ITemplateBindInfo> = [];
    private propWatchers: Array<{ prop: string; listener: PropWatcherListener }> = [];

    constructor(private readonly htmlElement: HTMLElement, private readonly componentName: string, private readonly modulePath: string) {
        this.setProperties();
    }

    /**
     * Sets the inline template string. This property will have a high priority than `templateHtmlFile` and `cssFile`.
     */
    set template(value: string) {
        this.templateStr = value;
    }

    /**
     * Sets the template html filepath.
     */
    set templateHtmlFile(value: string) {
        this.templateHtmlFilePath = value;
    }

    /**
     * Sets the css filepath.
     */
    set cssFile(value: string) {
        this.cssFilePath = value;
    }

    /**
     * Defines a property.
     *
     * @param property the property
     */
    defineProperty(property: IProperty) {
        this.properties.push(property);
    }

    /**
     * Creates a binding for this element and the shadow root element.
     *
     * @param hostProp the html host element property
     * @param shadowElId the shadow element id
     * @param shadowElProp the shadow element property
     * @param oneWay if true, data only flows in one direction, from host to shadow element.
     */
    bindProperty(hostProp: string, shadowElId: string, shadowElProp: string, oneWay = false) {
        const binding = {
            serverBindName: hostProp,
            widgetId: shadowElId,
            propertyName: shadowElProp,
            options: {
                oneWay: oneWay
            }
        };

        if (!this.templateBindingModel) {
            this.bindings.push(binding);
        } else {
            TemplateBinder.createBindings(this.templateBindingModel, [binding], console);
        }
    }

    /**
     * Adds a property change watcher.
     *
     * @param prop the property to watch
     * @param listener the change listener
     */
    watch(prop: string, listener: PropWatcherListener) {
        this.propWatchers.push({ prop: prop, listener: listener });
    }

    /**
     * Initialize the WebComponent.  This includes creating shadow dom elements from the provided template,
     * creating bindings defined with bindProperty() and from mustache notation within the template, and
     * initializing properties values from the web components attributes.
     */
    async init() {

        this.addPropertyAssessors();
        this.setValuesFromAttributes();

        /* create templated element */
        const htmlFilePath = this.templateHtmlFilePath ? `${this.modulePath}/${this.templateHtmlFilePath}` : undefined;
        const template = await TemplateBinder.getInstance(this.componentName, this.templateStr, htmlFilePath);

        /* create shadow root */
        const shadowRoot = this.htmlElement.attachShadow({ mode: 'open' });

        this.templateBindingModel = template.stampTemplate(shadowRoot, this, console, this.bindings);
        this.bindings.splice(0, this.bindings.length);

        /* create external css link */
        if (this.cssFilePath) {
            const cssLinkElm = document.createElement('link');
            cssLinkElm.setAttribute('rel', 'stylesheet');
            cssLinkElm.setAttribute('href', `${this.modulePath}/${this.cssFilePath}`);
            shadowRoot.appendChild(cssLinkElm);
        }
    }

    private setProperties() {
        /* get defined properties from html element */
        // @ts-ignore
        const properties = this.htmlElement.constructor.properties;
        if (properties) {
            for (const prop in properties) {
                if (Object.prototype.hasOwnProperty.call(properties, prop)) {
                    const property: IProperty = {
                        name: prop,
                        type: properties[prop].type,
                    };
                    if (properties[prop].value)     property.value     = properties[prop].value;
                    if (properties[prop].notify)    property.notify    = properties[prop].notify;
                    if (properties[prop].readonly)  property.readonly  = properties[prop].readonly;
                    if (properties[prop].reflect)   property.reflect   = properties[prop].reflect;

                    this.defineProperty(property);
                }
            }
        }
    }

    /**
     * Method to retrieve property information defined through defineProperty()
     *
     * @param name the name of the property to retrieve info for.
     * @returns the IProperty object for the desired property.
     */
    getProperty(name: string) {
        return this.properties.find( property => name === property.name );
    }

    /**
     * Method to set a property's value.  Use this for setting read-only properties, because
     * using this.<propertyName> = <newValue> will not work for this case.
     *
     * @param property the reference to the property to set the value for.
     * @param value new value for the property.
     */
    setValue(property: IProperty, value: ValueType) {
        this.updatePropertyValue(property, value, true);
    }

    private addPropertyAssessors() {
        /* add observed attributes getter */
        const attributes = this.properties.map(property => property.name);
        const attributeObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName) {
                    this.onAttributeChanged(
                        mutation.attributeName,
                        (mutation.target as HTMLElement).getAttribute(mutation.attributeName) as string
                    );
                }
            });
        });
        attributeObserver.observe(this.htmlElement, {
            attributes: true,
            attributeFilter: attributes
        });

        /* define getter and setter for each property */
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        for (const property of this.properties) {
            Object.defineProperty(this.htmlElement, property.name, {
                get() {
                    return property.value;
                },
                set(value) {
                    self.updatePropertyValue(property, value);
                }
            });
        }
    }

    private setValuesFromAttributes() {
        for (const prop of this.properties) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let value: any = prop.value;

            for (let i = this.htmlElement.attributes.length-1; i >= 0; --i) {
                const attr = this.htmlElement.attributes.item(i)?.name;

                if (attr === camelToDashCase(prop.name)) {
                    value = this.htmlElement.getAttribute(attr);
                    break;
                }
            }

            this.updatePropertyValue(prop, value, true);
        }
    }

    /**
     * Retrieves elements in this components shadow dom by id.
     *
     * @param id the id of the element to find.
     * @returns the shadow dom element or undefined if the element is not found.
     */
    getElement(id: string) {
        return id === 'this' ? this.htmlElement : this.htmlElement.shadowRoot?.getElementById(id);
    }

    private onAttributeChanged(name: string, value: string) {
        for (const property of this.properties) {
            if (property.name === dashToCamelCase(name)) {
                // make sure we pass a true value for an empty string and a boolean type.  In all other cases,
                // the string will be converted properly by updatePropertyValue.
                this.updatePropertyValue(property, (property.type === 'boolean' && value === '') ? true : value);
                break;
            }
        }
    }

    private setPropertyValue(property: IProperty, value: ValueType) {
        if (value === undefined || typeof value === property.type) {
            property.value = value;
        } else switch (property.type) {
            case 'number':
                property.value = +value;
                break;
            case 'boolean':
                property.value = value === 'false' ? false : Boolean(value);
                break;
            case 'string':
                property.value = String(value);
                break;
        }
    }

    private updatePropertyValue(property: IProperty, value: ValueType, internal: boolean = false) {
        if (!property.readonly || internal) {
            const oldValue = property.value;
            this.setPropertyValue(property, value);

            /*
             * perform updates:
             *  1) attribute
             *  2) fire change events
             */
            if (oldValue !== property.value) {

                /* update attribute */
                if (property.reflect) {
                    const attrName = camelToDashCase(property.name);
                    if (property.type === 'boolean') {
                        if (property.value !== this.htmlElement.hasAttribute(attrName)) {
                            if (property.value) {
                                this.htmlElement.setAttribute(attrName, '');
                            } else {
                                this.htmlElement.removeAttribute(attrName);
                            }
                        }
                    } else {
                        const attrValue = value?.toString() || null;
                        if (this.htmlElement.getAttribute(attrName) !== attrValue) {
                            if (attrValue !== null) {
                                this.htmlElement.setAttribute(attrName, attrValue);
                            } else {
                                this.htmlElement.removeAttribute(attrName);
                            }
                        }
                    }
                }

                /* fire change event */
                if (property.notify) {
                    if (internal || property.notify) {
                        console.debug(`Firing ${property.name}-changed event, value=${property.value}`);
                        this.htmlElement.dispatchEvent(new CustomEvent(`${property.name}-changed`, { detail: { value: property.value } }));
                    }

                    for (const watcher of this.propWatchers) {
                        if (watcher.prop === property.name) {
                            console.debug(`Notifying watchers '${property.name}' property changed, value=${property.value}`);
                            watcher.listener(property.value, oldValue);
                        }
                    }
                }
            }
        }
    }
}
