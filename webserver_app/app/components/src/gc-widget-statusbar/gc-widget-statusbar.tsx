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
 *
 */
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { Component, h, Prop, State, Watch, Event, EventEmitter, Element, Method, getAssetPath } from '@stencil/core';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { GcFiles } from '../gc-core-assets/lib/GcFiles';
import { GcConsole } from '../gc-core-assets/lib/GcConsole';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';

const console = new GcConsole('gc-widget-statusbar');

/**
 * `gc-widget-statusbar` is a bar along the bottom of the application page that can display status message and progress.
 *
 * @label Status Bar
 * @group Status Indicators
 * @demo
 * @usage
 * @container
 */
@Component({
    tag: 'gc-widget-statusbar',
    styleUrl: 'gc-widget-statusbar.scss',
    shadow: true
})
export class WidgetStatusbar implements WidgetBaseProps {
    private base = new (
        class extends WidgetBase {
            get element(): HTMLElement {
                return (this.parent as WidgetStatusbar).el;
            }
        })(this);

    /**
     * A value (0-100) that represents the percentage complete to show in the progress bar.
     */
    @Prop() progress: number = 0;
    @Prop() statusText: string = null;
    @Prop() statusTooltip: string = null;

    @Prop() showEventLog: boolean = false;
    @Prop() showProgressString: boolean = false;
    @Prop() showProgressBar: boolean = true;
    @Prop() showBrandingImage: boolean = true;

    @State() brandingImage: string;
    @State() progressPercentage: number = 0;

    async componentWillLoad() {
        if (!GcUtils.isCCS) {
            try {
                const projectJson = await GcFiles.readJsonFile('project.json');
                this.showBrandingImage = !!projectJson['tiBrandingEnabled'];
            } catch { /* do nothing */ }
            this.onShowBrandingImageChanged();
        }
    }

    componentDidLoad() {
        window.dispatchEvent(new CustomEvent(`${this.el.tagName.toLowerCase()}-loaded`, { detail: this.el }));
    }

    render() {
        const progressStyle = { 'width': `${this.progressPercentage}%` };

        // JSXON
        return this.base.render(
            <div id="status-container">
                <div class="left">
                    { this.showEventLog ? <gc-widget-icon id="event-log-icon" icon="editor:note" appearance="custom" on-click={ this.logClickHdlr.bind(this) }></gc-widget-icon> : null }
                    <slot name="left"></slot>
                    { this.statusText ? <gc-widget-label id="app-status-text" label={ this.statusText } tooltip={ this.statusTooltip }></gc-widget-label> : null }
                </div>
                <div class="center">
                    <slot></slot>
                </div>

                <div class="right">
                    { this.showProgressString && this.progressPercentage > 0 ?<gc-widget-label id="progress-label" label={ this.progressPercentage + '%' } ></gc-widget-label> : null }
                    { this.showProgressBar && this.progressPercentage > 0 ?
                        <div id="progress-container">
                            <div id="progress-bar" style={ progressStyle }></div>
                        </div> : null }
                    { this.showBrandingImage ? <div id="branding" class="container" innerHTML={ this.brandingImage }></div> : null }
                </div>
            </div>
        );
        // JSXOFF
    }

    @Watch('showBrandingImage')
    async onShowBrandingImageChanged() {
        try {
            if (this.showBrandingImage && !this.brandingImage) {
                this.brandingImage = await GcFiles.readTextFile(getAssetPath('../assets/images/ti_horiz_banner_transparent.svg'));
            }
        } catch { /* do nothing */ }
    }

    @Watch('progress')
    onProgressChanged(value: number) {
        if (value > 100) this.progressPercentage = 100;
        else if (value < 0) this.progressPercentage = 0;
        else this.progressPercentage = value;
    }

    private logClickHdlr(ev: MouseEvent) {
        console.error('LogView not implemented yet!');
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
