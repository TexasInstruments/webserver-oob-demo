/**
 *  Copyright (c) 2020, 2021 Texas Instruments Incorporated
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

import { Component, h, Watch, State, Prop, Method, Event, EventEmitter, Element } from '@stencil/core';
import { JsonDocs, JsonDocsComponent, JsonDocsTag } from '@stencil/core/internal';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { WidgetMarkdown } from '../gc-widget-markdown/gc-widget-markdown';
import { GcConsole } from '../gc-core-assets/lib/GcConsole';
const console = new GcConsole('ti-component-help');

interface CustomCssVar {
    name: string;
    default: string;
    detail: string;
}
interface CustomDocsTag {
    init: boolean;
    text?: string;
}
export interface ComponentGroup {
    header: string;
    path: string;
}

/**
 * `gc-component-help` is documentation site for all the component
 * information and properties within GUI Composer. Currently it shows
 * only Stencil components and uses ./components/stencil-docs.json
 * for this information, which is generated in the build step by Stencil.
 *
 * @hidden
*/

@Component({
    tag: 'gc-component-help',
    styleUrl: 'gc-component-help.scss',
    shadow: true
})

export class ComponentHelp implements WidgetBaseProps {

    // Documentation data variables
    private targetComponent: JsonDocsComponent;
    private componentList: Array<{ components: JsonDocsComponent[]; header: string}> = [];
    /**
     * coreComponents = []
     * => use to filter to get
     */
    private manifestList: string[][] = [];
    private targetCSSVars: CustomCssVar[] = [];
    private usage: CustomDocsTag = { init: false };
    private demo: CustomDocsTag = { init: false };
    private targetRoot: string;

    // Page div references
    private demoElement: HTMLIFrameElement;
    private docsElement: WidgetMarkdown;
    private docPage: HTMLElement;

    // Demo page observer
    private observer: ResizeObserver;

    private base = new ( // keep on separate line to enable source mapping
        class extends WidgetBase {
            get element() {
                return (this.parent as ComponentHelp).el;
            }
        })(this);

    /**
     * Custom stencil component generated filepaths.
     */
    @Prop() componentGroupPaths: ComponentGroup[] = [{ header: 'Components', path: './@ti/stencil-docs.json' }];

    /**
     * The name of the widget selected. When changed, triggers re-render.
     * If empty, nothing is selected for display, default to the 'main' page.
     */
    @State() widgetName: string = '';
    @Watch('widgetName')
    async onWidgetNameChanged(newValue: boolean) {
        // clear everything
        this.targetCSSVars = [];
        this.usage = { init: false };
        this.demo = { init: false };
        this.targetRoot = '';
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // trigger new component data replacement
        if (newValue) {
            const newComponent = this.componentList[0].components.find(x => {
                return x.tag === this.widgetName;
            }) as JsonDocsComponent;
            // get demo info if it exists
            if (newComponent) {
                this.targetComponent = newComponent;
                this.checkCustomVars(this.targetComponent.docsTags);
                window.location.hash = this.widgetName;
            } else {
                // display main page
                this.widgetName = '';
            }
        }
    }

    /**
     * Iterates through the stencil 'undefined' (custom) tags in the component docstring
     * and deals with any matching tags.
     * Defined tags: @css, @usage, @demo
     *
     * @param tags docsTags array with all custom tags listed in the main component docstring
     */
    private checkCustomVars(tags: JsonDocsTag[]) {
        if (tags) {
            for (const custTagObject of tags) {
                if (custTagObject.name === 'css') {
                    const [name, detail, options] = custTagObject.text.split('|').map((i) => i.trim());

                    let value = options;
                    if (options) {
                        const startIndex = options.indexOf('{');
                        const endIndex = options.indexOf('}');
                        if (startIndex >= 0 && endIndex >= 0 && startIndex < endIndex) {
                            value = options.substr(0, startIndex).trim();
                        }
                    }

                    this.targetCSSVars.push({
                        name: name,
                        detail: detail,
                        default: value
                    });
                } else if (custTagObject.name === 'usage') {
                    this.usage.init = true;
                    // Given path structure: [prebuild/parentFolder/componentTag.tsx] -> get parentFolder/path
                    this.usage.text = custTagObject.text ? custTagObject.text : undefined;
                } else if (custTagObject.name === 'demo') {
                    this.demo.init = true;
                    // Given path structure: [prebuild/parentFolder/componentTag.tsx] -> get parentFolder/path
                    this.demo.text = custTagObject.text ? custTagObject.text : undefined;
                }
            }
            if (this.demo || this.usage) {
                // ex: "@ti/gc-component-help/gc-component-help.tsx" => "@ti/gc-component-help/"
                this.targetRoot = this.targetComponent.filePath.slice(0, this.targetComponent.filePath.lastIndexOf('/') + 1);
            }
        }
    }

    /**
     * Get manifest (sidebar) information from stencil docs -> component list -> component group.
     */
    private setManifest() {
        for (const componentGroup of this.componentList) {
            const manifestGroup: string[] = [];
            for (const component in componentGroup.components) {
                let isHidden = false;
                if (componentGroup.components[component].docsTags) {
                    /**
                     * Parse all component level `docTags` for @hidden or @isHidden (legacy)
                     * defined in the docstring.
                     * But show in sidebar if @showInComponentHelp regardless of @hidden for
                     * components that are hidden from the Palette but important to show in
                     * the help (ie: gc-widget-theme).
                    */
                    for (const custTagObject of componentGroup.components[component].docsTags) {
                        if (custTagObject.name === 'isHidden' || custTagObject.name === 'hidden') {
                            isHidden = true;
                        }
                    }
                }
                if (!isHidden) manifestGroup.push(componentGroup.components[component].tag);
            }
            // sort by alphabetically, by group
            manifestGroup.sort();
            this.manifestList.push(manifestGroup);
        }
    }

    /**
     * Read in generated info in provided stencil-docs.json
     */
    private async getComponentData() {
        try {
            for (const group of this.componentGroupPaths) {
                let response = await (await fetch(group.path)).text();
                response = group.header === 'Components'
                    // Clean paths / make all // be \ (for windows).
                    ? response.replace(/\\\\/g, '/').replace(/prebuild\//g, '@ti/')
                    : response.replace(/\\\\/g, '/');
                const stencilDocs = JSON.parse(response) as unknown as JsonDocs;

                // Always @ti component group is in the [0] index.
                this.componentList.push({ components: stencilDocs.components, header: group.header });
            }
            this.setManifest(); // Sidebar info
            // (routing) Set widget if name is in the address ie: '/v3/components/#gc-widget-led'
            if (location.hash) this.widgetName = location.hash.slice(1);

        } catch (e) {
            console.error(`Something went wrong: ${e.message}`);
        }
    }

    /**
     * iFrame functions
     */
    private demoFrameResize(target: EventTarget) {
        const demoFrame = target as HTMLIFrameElement;
        this.observer.observe(demoFrame.contentWindow.document.body);
    }
    private timer: NodeJS.Timeout | undefined = undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async debounce(n: number, fn: (...params: any[]) => void) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => fn.apply(this, fn), n);
    }
    private getElmHeight(window: globalThis.Window, element: HTMLElement) {
        const style = window.getComputedStyle(element);

        return [
            'margin-top', 'margin-bottom',
            'border-top', 'border-bottom',
            'padding-top', 'padding-bottom',
            'height'
        ].map(k => parseFloat(style.getPropertyValue(k))).reduce((prev, cur) => prev + cur);
    }

    async componentWillLoad() {
        await this.getComponentData();
    }

    componentDidRender() {
        // set the div that shows the description for the component and set the text content.
        if (this.docsElement) this.docsElement.setText(this.targetComponent.docs);
        if (this.demo.init) {
            this.observer = new ResizeObserver(() => {
                this.debounce(10, () => {
                    if (this.demoElement) {
                        const body = this.demoElement.contentDocument?.body;
                        this.demoElement.height = this.getElmHeight(this.demoElement.contentWindow, body) + 'px';
                    } else {
                        /** For some reason, sometimes between render() call and the ref
                         * for this.demoHeight becomes set to null even if this is called
                         * after render() */
                        const elem = this.el.shadowRoot.querySelector('#demoFrame') as HTMLIFrameElement;
                        if (elem) elem.height = (elem.contentWindow.document.documentElement.offsetHeight) + 'px';
                    }
                });
            });
        }
    }

    disconnectedCallback() {
        this.observer?.disconnect();
    }

    renderFooter(){
        const currentYear = new Date().getFullYear();
        return (
            <footer>
                <p>&copy; Copyright 2020-{currentYear}. Texas Instruments Incorporated. All rights reserved.</p>
            </footer>
        );
    }

    render() {
        // JSXON
        return (<div id="topContainer" class="user-select">
            <div id="sidebar">
                <h3 class="open-in-new" >Component Core Library
                    <a href="docs/" target="_blank"><gc-widget-icon size="s" icon="action:open_in_new"></gc-widget-icon></a>
                </h3>
                {/* Manifest Component groups */}
                {
                    this.componentList.map((componentGroup, index) =>
                        <h3 class="component-header" onClick={() => {
                            this.widgetName = '';
                            window.location.hash = '';
                        }}>
                            <gc-widget-icon size="s" icon="home"></gc-widget-icon>{componentGroup.header}
                        </h3>
                    )
                }
                {
                    // Right now, the only component group is for @ti v3 Components
                    this.manifestList[0].map((components) =>
                        <li class="component-label" onClick={() => {
                            this.widgetName = components;
                            this.docPage.scrollTo(0, 0);
                        }}>
                            <gc-widget-icon size="s" icon="navigation:chevron_right"></gc-widget-icon>
                            <div class="component-text">{components}</div>
                        </li>
                    )
                }
                {/* [GC-2556] TODO: V2 component listing  */}
            </div>
            {this.widgetName ?
                <div id="documentation" ref={(el) => this.docPage = el as HTMLElement} >
                    <section>
                        {/* NAME */}
                        <h1>{this.targetComponent.tag}</h1>
                        {/* DESCRIPTION */}
                        <gc-widget-markdown id="docs" ref={(el) => this.docsElement = el as unknown as WidgetMarkdown}></gc-widget-markdown>
                    </section>

                    {/* DEMO: Renders if @demo tag is found. */}
                    {this.demo.init ?
                        <section>
                            {/* open demo page in new window */}
                            <h2 class="open-in-new">
                                <a target="_blank" href={this.demo.text
                                    ? this.targetRoot + this.demo.text
                                    : this.targetRoot + 'demo/index.html'}>
                                        Demo
                                    <gc-widget-icon size="s" icon="action:open_in_new"></gc-widget-icon></a>
                            </h2>
                            <iframe
                                ref={(el) => this.demoElement = el as HTMLIFrameElement}
                                id="demoFrame"
                                scrolling="no"
                                frameBorder="0"
                                src={this.demo.text
                                    ? this.targetRoot + this.demo.text
                                    : this.targetRoot + 'demo/index.html'}
                                onLoad={(e) => this.demoFrameResize(e.target)}
                            ></iframe>
                        </section> : null}

                    {/* USAGE: Renders if @usage tag is found. */}
                    {this.usage.init ?
                        <section>
                            <h2>Usage</h2>
                            <gc-widget-markdown
                                id="usage"
                                file={this.usage.text
                                    ? this.targetRoot + this.usage.text
                                    : this.targetRoot + 'usage.md'}>
                            </gc-widget-markdown>
                        </section> : null}

                    {/* Custom CSS Properties: Renders if > 1 @css tag is found. */}
                    {(this.targetCSSVars.length > 0) ?
                        <section>
                            <h2>Styling</h2>
                            <table> <thead> <tr>
                                <th>Variable</th>
                                <th>Description</th>
                                <th>Default</th>
                            </tr> </thead>
                            <tbody>
                                {
                                    this.targetCSSVars.map(cssVar =>
                                        <tr key={this.targetComponent.tag+cssVar.name}>
                                            <td><code>{cssVar.name}</code></td>
                                            <td><div innerHTML={cssVar.detail}></div></td>
                                            <td><code>{cssVar.default}</code></td>
                                        </tr>
                                    )
                                }
                            </tbody> </table>
                        </section> : null}
                    {/* Shows chart if there are properties @Prop defined. */}
                    {(this.targetComponent.props.length > 0) ?
                        <section>
                            <h2>Properties</h2>
                            <table> <thead> <tr>
                                <th>Property</th>
                                <th>Description</th>
                                <th>Type</th>
                                <th>Default</th>
                            </tr> </thead>
                            <tbody>
                                {
                                    this.targetComponent.props.map(property =>
                                        <tr key={property.name}>
                                            <td><code>{property.name}</code></td>
                                            <td><div innerHTML={property.docs}></div></td>
                                            <td><code>{property.type}</code></td>
                                            <td><code>{property.default}</code></td>
                                        </tr>
                                    )
                                }
                            </tbody> </table>
                        </section> : null}

                    {/* Shows chart if there are events @Event */}
                    {(this.targetComponent.events.length > 0) ?
                        <section>
                            <h2>Events</h2>
                            <table> <thead> <tr>
                                <th>Event</th>
                                <th>Description</th>
                                <th>Detail</th>
                            </tr> </thead>
                            <tbody>
                                {
                                    this.targetComponent.events.map(event =>
                                        <tr key={this.targetComponent.tag+event.event}>
                                            <td><code>{event.event}</code></td>
                                            <td><div innerHTML={event.docs}></div></td>
                                            <td><code>{event.detail}
                                                {/* {
                                                // get "type" from stencil-docs.json given string format "{ value: type; }"
                                                (event.detail === 'any')
                                                    ? event.detail
                                                    : event.detail.split(': ')[1].slice(0, -3)
                                                } */}
                                            </code></td>
                                        </tr>
                                    )
                                }
                            </tbody> </table>
                        </section> : null}
                    {/* Shows chart if there are public API methods @Method */}
                    {(this.targetComponent.methods.length > 0) ?
                        <section id="methods">
                            <h2>Methods</h2>
                            {
                                this.targetComponent.methods.map(method =>
                                    <div class="method" key={this.targetComponent.tag+method.signature}>
                                        <h3><code>{method.signature}</code></h3>
                                        <ul><div innerHTML={method.docs}></div></ul>
                                    </div>
                                )
                            }
                        </section> : null}
                    {this.renderFooter()}
                </div> :
                <div id="documentation">
                    <gc-widget-markdown file="@ti/assets/main-page.md"></gc-widget-markdown>
                    {this.renderFooter()}
                </div>}
        </div>);
        // JSXOFF
    }

    // #region gc-widget-base/gc-widget-base-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The widget element.
     */
    @Element() el: HTMLElement;

    /**
     * Sets to `true` to hide the element, otherwise `false`.
     *
     * @order 200
     */
    @Prop({ reflect: true }) hidden: boolean = false;

    /**
     * Fired when a CSS property has changed.
     **/
    @Event({ eventName: 'css-property-changed' }) cssPropertyChanged: EventEmitter<{ name: string; value: string }>;

    /**
     * Sets the CSS property.
     *
     * @param {string} name the element style name
     * @param {string} value the new CSS property to be set
     */
    @Method()
    async setCSSProperty(name: string, value: string): Promise<void> {
        value = value.replace(/^[ ]+|[ ]+$/g, '');
        if (await this.getCSSProperty(name) !== value) {
            this.el.style.setProperty(name, value);
            this.cssPropertyChanged.emit({ name: name, value: value });
        }
    }

    /**
     * Returns the value of a CSS property.
     *
     * @param {string} name the element style property
     * @returns {string} the value of the property
     */
    @Method()
    async getCSSProperty(name: string): Promise<string> {
        return getComputedStyle(this.el).getPropertyValue(name).trim();
    }

    /**
     * Refresh the widget.
     */
    @Method()
    async refresh(): Promise<void> {
        return this.el['forceUpdate']();
    }
    // #endregion

}
