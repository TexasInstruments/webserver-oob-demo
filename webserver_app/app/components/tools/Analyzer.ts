/**
 *  Copyright (c) 2019, 2021 Texas Instruments Incorporated
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *  Redistributions of source code must retain the above copyright
 *  notice, this list of conditions and the following disclaimer.
 *  notice, this list of conditions and the following disclaimer in the
 *  documentation and/or other materials provided with the distribution.
 *  Neither the name of Texas Instruments Incorporated nor the names of
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

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-use-before-define */
import path from 'path';
import fs from 'fs';
import stencilDocJson from '../@ti/stencil-docs.json';
import { JsonDocs, JsonDocsProp } from '@stencil/core/internal';

interface CSSVariables {
    name: string;
    title: string;
}

/*
* Analyzer.ts
*
* This script uses the stencil-docs.json from the parsed Stencil TS source code to extract metadata.
* It generates `metadata.json`, which is used in widget demos and in the Designer
* (component palette, properties pane, etc).
*/

/**
 * The metadata associated with all instantiable custom elements. Format of
 * the `metadata.json` output.
 */
export interface MetadataJson {
    [elemTagname: string]: CustomElemMetadata; // e.g. "gc-widget-button"
}

/**
 * The metadata associated with an instantiable custom element.
 */
interface CustomElemMetadata {
    id: string; // registered html tag name, e.g. "gc-widget-button"
    tags: string; // the library tag, i.e stencil, polymer, etc...
    label?: string; // name displayed in the component palette, e.g. "Button"
    group?: string; // the component palette group that the element belongs to
    isHidden?: boolean; // element should not appear in component palette
    isContainer?: boolean; // element can contain other elements
    hasBorder?: boolean; //element can have a border
    hasLayout?: boolean; // element support layout CSS styles
    noGeneralStyle?: boolean; // element doesn't have general styles
    archetype?: string; // html template of the element to generate in index.gui
    importDependencies: string[]; // paths to the element and any dependencies, e.g. ["src/gc-widget-button/gc-widget-button"]
    metaProperties: ComponentPropsMetadata;
    cssVariables: CSSVariables[];
    version: number; // metadata version
}

/**
 * The metadata associated with a group of Stencil properties.
 * E.g. all properties of an instantiable Stencil Element.
 */
interface ComponentPropsMetadata {
    [propName: string]: StencilPropMetadata; // e.g. "buttonType"
}

/**
 * The metadata associated with a Stencil property.
 */
export interface StencilPropMetadata {
    /** JS object's property name, e.g. "buttonType" */
    name: string;
    /** Represents the type of the property. */
    kind: 'string' | 'text' | 'json' | 'color' | 'number' | 'boolean' | 'range' | 'select';
    /** If `kind==="range"`, `min` provides the minimum range value */
    min?: number;
    /** If `kind==="range"`, `max` provides the maximum range value */
    max?: number;
    /** If `kind==="range"`, `step` provides the slider increment value */
    step?: number;
    /** If `kind==="range"`, `defaultValue` provides the default range slider value */
    defaultValue?: number;
    /** If `kind==="select"`, `options` provides a list of the options to select from */
    options?: (string | number)[];
    /** Properties are presented in ascending `order` */
    order: number;
    /** If true, the property should not be exposed in the demo or properties tab */
    isHidden: boolean;
    /** A tooltip description of the property */
    title?: string;
    nosave?: boolean;
    if?: string;
}

/** The format of each custom tag. */
interface CustomTag {
    name: string;
    valType: 'string' | 'number' | 'boolean'; // the type of the custom tag's value
}

/**
 * Definition of custom tags that can used in the comments of an element's
 * properties. These can be used alongside standard jsdoc tags like
 * `@type {<my type(s)>}`
 */
const CUSTOM_PROPERTY_TAGS: Array<CustomTag> = [
    /** The ascending order the property should be displayed, in widget demos and the
     *  Properties tab. Example: `@order 15`
     */
    { name: 'order', valType: 'number' },

    /** Flags that changes made to the property from the Properties tab should not
     * be serialized into the index.gui file. Example: `@nosave`
     */
    { name: 'nosave', valType: 'boolean' },

    /** If this tag exists on a property, the string value will be used as a conditional
    * which must be true, for the property to be modifiable from the widget demo or
    * Properties tab. Example: `@if !otherMutuallyExclusiveProperty`
    */
    { name: 'if', valType: 'string' },

    /** If this tag exists on a property, `displayAs` value is a JSON string
    * , sets of key/value pairs that needs to be overwritten in the metadata object. If
    * the key does not exist, writes a new key:value based on the input string.
    */
    { name: 'displayAs', valType: 'string' },
];

/**
 * Definition of custom tags that can used in the comments of a Stencil element.
 */
const CUSTOM_ELEMENT_TAGS: Array<CustomTag> = [
    /** The element name displayed in the Component Palette
    * Example: `@label Checkbox`
    */
    { name: 'label', valType: 'string' },

    /** The group that the element should appear under in the Component Palette.
    * Example: `@group Dials & Gauges`
    */
    { name: 'group', valType: 'string' },

    /** Flags that the element should not appear in the Component Palette.
    * Example: `@isHidden`
    */
    { name: 'isHidden', valType: 'boolean' },

    /** Flags that the element can contain other elements.
    * Example: `@isContainer`
    */
    { name: 'isContainer', valType: 'boolean' },

    /** The html fragment to insert when the element is added to the canvas.
    * Example `@archetype <gc-widget-checkbox label="click me!"></gc-widget-checkbox>`
    */
    { name: 'archetype', valType: 'string' },


];

const rootDir = path.join(__dirname, '../'); // v3/components directory

function genMetadata() {
    try {
        const nativeElementsMetadata = fs.readFileSync(path.join(rootDir, 'native.metadata.json'), { encoding: 'utf8' });

        // elements -> components
        const metadata = { ...JSON.parse(nativeElementsMetadata), ...stencilJsonToMetadata(stencilDocJson as unknown as JsonDocs) };

        fs.writeFileSync(path.join(rootDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
        console.log('Finished compiling components/metadata.json file.');
    } catch (e) {
        console.error(`Failed to generate metadata.json: ${e.toString()}`);
    }
};

/**
 * Parses `stencil-docs.json` into type `MetadataJson`, and returns it.
 * @param jsonDoc the JSON object from `stencil-docs.json``
 * @return a MetadataJson with all components and associated properties.
 */
function stencilJsonToMetadata(jsonDoc: JsonDocs): MetadataJson {
    const metadata: MetadataJson = {};
    // find all metadata for each component
    for (const component of jsonDoc.components) {
        const elemMeta: CustomElemMetadata = {
            id: component.tag,
            tags: 'stencil',
            label: component.tag,
            group: undefined,
            isHidden: false,    //default
            isContainer: false,  //default
            archetype: undefined,
            importDependencies: ['components/@ti/build/gc-components.esm.js'],
            metaProperties: {},
            cssVariables: [],
            version: 3
        };

        // parsing `docTags` for custom Tags defined in the component docstring
        for (const custTagObject of component.docsTags) {
            switch (custTagObject.name) {
                case 'label':
                    if (custTagObject.text) elemMeta.label = custTagObject.text;
                    break;
                case 'group':
                    if (custTagObject.text) elemMeta.group = custTagObject.text;
                    break;
                case 'isHidden':
                case 'hidden':
                    elemMeta.isHidden = true;
                    break;
                case 'isContainer':
                case 'container':
                    elemMeta.isContainer = true;
                    break;
                case 'border':
                    elemMeta.hasBorder = true;
                    break;
                case 'layout':
                case 'hasLayout':
                    elemMeta.hasLayout = true;
                    break;
                case 'noGeneralStyle':
                    elemMeta.noGeneralStyle = true;
                    break;
                case 'archetype':
                    if (custTagObject.text) elemMeta.archetype = custTagObject.text;
                    break;
                case 'css':
                    if (custTagObject.text) {
                        const [name, title, options] = custTagObject.text.split('|').map(e => e.trim());
                        let _options = {};
                        if (options) {
                            const startIndex = options.indexOf('{');
                            const endIndex = options.indexOf('}');
                            if (startIndex >= 0 && endIndex >= 0) {
                                _options = JSON.parse(options.substr(startIndex, endIndex+1).trim());
                                const defaultValue = options.substr(0, startIndex).trim();
                                if (defaultValue && defaultValue.length > 0) {
                                    _options['defaultValue'] = defaultValue;
                                }
                            }
                        }
                        elemMeta.cssVariables.push(Object.assign({
                            name: name,
                            title: title,
                        }, _options));
                    }
                    break;
                default:
                    break;
            }
        }

        const importPath = `components/@ti/${component.filePath?.split(/[\\, /]+/).slice(-2, -1)[0] || component.tag}`.replace('components/@ti', 'src');
        const metadataJsonFile = path.join(rootDir, importPath, 'metadata.json');
        if (fs.existsSync(metadataJsonFile)) {
            const metadataJson = JSON.parse(fs.readFileSync(metadataJsonFile, 'utf-8').trim());
            elemMeta.importDependencies = [...elemMeta.importDependencies, ...(metadataJson.importDependencies || [])];
        }
        const externalArchetype = path.join(rootDir, importPath, `${elemMeta.id}.archetype`);
        if (fs.existsSync(externalArchetype)) {
            elemMeta.archetype = fs.readFileSync(externalArchetype, 'utf-8').trim();
        }
        if (!elemMeta.archetype) {
            elemMeta.archetype = `<${elemMeta.id}></${elemMeta.id}>`;
        }

        parseProperties(component.props, elemMeta.metaProperties);

        // add to metadata object
        metadata[elemMeta.id] = elemMeta;
    }
    return metadata;
}

/**
 * Parses each stencil property of `elemName` from `analysis` into type `ComponentPropsMetadata`,
 * and adds it to the `retProperties` object.
 *
 * @param jsonProps Array of JsonDocsProp or properties found in the component
 * @param retProperties output parameter; properties are added to this object
 */
function parseProperties(jsonProps: JsonDocsProp[], retProperties: ComponentPropsMetadata): void {
    for (const prop of jsonProps) {
        let propertyMeta: StencilPropMetadata = {
            name: prop.name || '',
            kind: 'string', // default to widest type
            order: Infinity, // default
            isHidden: false, // default
        };

        // property description
        if (prop.docs) propertyMeta.title = `\n${prop.docs.trim()}\n\n`;

        // find 'kind' | 'options' | 'min' | 'max' | 'step' | 'defaultValue' tag values
        propertyMeta = { ...propertyMeta, ...parseType(prop.type) };

        // parse designer display modifications tags
        for (const custTagObject of prop.docsTags) {
            switch (custTagObject.name) {
                case 'order':
                    // must be a integer
                    if (custTagObject.text && !isNaN(+custTagObject.text)) propertyMeta.order = Number(+custTagObject.text);
                    break;
                case 'isHidden':
                case 'hidden':
                    propertyMeta.isHidden = true;
                    break;
                case 'nosave':
                    propertyMeta.nosave = true;
                    break;
                case 'if':
                    if (custTagObject.text) propertyMeta.if = custTagObject.text;
                    break;
                case 'displayAs':
                    if (custTagObject.text) propertyMeta = overridePropertyMetadata(custTagObject.text, propertyMeta);
                    break;
            }
        }
        retProperties[propertyMeta.name] = propertyMeta;
    }
}

/**
 * Parses a `<property>.displayAs` string input from the `stencil-docs.json` file,
 * which are sets of key/value pairs that needs to be overwritten in the metadata object. If
 * the key does not exist, writes a new key:value based on the input string.
 * Do not use and does not work with designer display modifications tags ie:
 * `order`, `isHidden`, `nosave`, `if`.
 *
 * @param metadataString formatted string
 * @param propertyMeta the metadata object for one Stencil component property
 *
 * e.g: `{"kind": "select"} | {"options": ["stop", "start"]}`
 */
function overridePropertyMetadata(metadataString: string, propertyMeta: StencilPropMetadata): StencilPropMetadata {
    const overrides = JSON.parse(metadataString);

    //case: do not allow overwrite of `kind` to `select` unless `options` exists
    if (('select' in overrides || 'option' in overrides) && !('select' in overrides && 'option' in overrides)) {
        delete overrides.select;
        delete overrides.option;
    }
    // add or override new values
    for (const tag in overrides) {
        propertyMeta[tag] = overrides[tag];
    }
    return propertyMeta;
}


/**
 * Parses a `<property>.type` string input from the `stencil-docs.json` file, into a
 * subset of `StencilPropMetadata` that contains type information.
 * @param input the string from `elements.<element>.properties.<property>.type`
 *
 * e.g.: `"boolean"`, `"string"`, `"number"`, `"color"`, `"text"`,
 *  `"(\"black\" | \"red\" | \"teal\")"`, `"range(0,100,1,50)"`
 */
function parseType(input: string): Pick<StencilPropMetadata, 'kind' | 'options' | 'min' | 'max' | 'step' | 'defaultValue'> {
    // trim `(` `)` if needed
    if (input[0] === '(' && input[input.length - 1] === ')') {
        input = input.substring(1, input.length - 1);
    }

    // search for string options (string literal types) from input
    let strOptions: Array<string> | null = input.match(/"([^"]*)"/g);
    if (strOptions === null) strOptions = [];

    // remove each string literal from input (to avoid interference w/ next searches)
    strOptions.forEach((str) => {
        input = input.replace(str, '');
    });
    // trim `"` at start and end of each string option
    strOptions = strOptions.map((str) => {
        return str.substring(1, str.length - 1);
    });

    // search for non-literal types (widest-to-narrowest) and return them
    // note: union of literal and non-literal types are currently not supported
    // note: `undefined` and `null` types are currently ignored
    if (input.includes('any') || input.includes('?') || input.includes('string')) {
        return { kind: 'string' };
    } else if (input.includes('text')) {
        return { kind: 'text' };
    } else if (input.includes('json')) {
        return { kind: 'json' };
    } else if (input.includes('color')) {
        return { kind: 'color' };
    } else if (input.includes('number')) {
        return { kind: 'number' };
    } else if (input.includes('boolean')) {
        return { kind: 'boolean' };
    } else if (input.includes('range')) {
        // regex to select args in `range(...)`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rangeRgx: any = input.match(/range[ ]*\((?<args>.*)\)/);
        if (rangeRgx && rangeRgx.groups && rangeRgx.groups.args) {
            const argsStr = rangeRgx.groups.args.trim() as string;
            const args = argsStr.split(',');
            // test for args: min, max, step, defaultValue (optional)
            if (args[0] && args[0].trim().length && !isNaN(Number(args[0])) &&
                args[1] && args[1].trim().length && !isNaN(Number(args[1])) &&
                args[2] && args[2].trim().length && !isNaN(Number(args[2]))) {
                if (args[3] && args[3].trim().length && !isNaN(Number(args[3]))) {
                    return {
                        kind: 'range',
                        min: Number(args[0]),
                        max: Number(args[1]),
                        step: Number(args[2]),
                        defaultValue: Number(args[3])
                    };
                } else {
                    return {
                        kind: 'range',
                        min: Number(args[0]),
                        max: Number(args[1]),
                        step: Number(args[2])
                    };
                }
            }
        }
        return { kind: 'range' };
    }

    // literal types are considered narrowest
    // search for number options (number literal types)
    const numOptions: Array<number> = [];
    input.split('|').forEach((el) => {
        if (el.trim().length && !isNaN(Number(el))) {
            numOptions.push(Number(el));
        }
    });
    // return all string and number options, if any found
    if (strOptions.length || numOptions.length) {
        return {
            kind: 'select',
            options: [...strOptions, ...numOptions]
        };
    }

    // no type information found; return widest type
    return { kind: 'string' };

}

genMetadata();