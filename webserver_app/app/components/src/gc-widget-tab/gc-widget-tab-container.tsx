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
import { h, Component, Prop, Event, EventEmitter, Element, Method, State, Listen, Watch } from '@stencil/core';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetLinkTabPanel } from './gc-widget-link-tab-panel';
import { WidgetTabPanel } from './gc-widget-tab-panel';
import { GcConsole } from '../gc-core-assets/lib/GcConsole';
import { Position as TooltipPosition } from '../gc-widget-tooltip/gc-widget-tooltip';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';

const console = new GcConsole('gc-widget-tab');

/**
 * `gc-widget-tab-container` is a tabbed container widget to host child widgets in different tab panels.
 *
 * @label Tab Container
 * @group Containers
 * @container
 * @border
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-tab-container',
    styleUrl: 'gc-widget-tab-container.scss',
    shadow: true
})
export class WidgetTabContainer implements WidgetBaseProps, WidgetBaseTitleProps {
    private base = new (
        class extends WidgetBase {
            get element() {
                return (this.parent as WidgetTabContainer).el;
            }
        })(this);

    /**
     * The tab selector navigation position. Set to `none` to hide the selector.
     * @order 2
     */
    @Prop() position: 'top'|'bottom'|'left'|'right'|'none' = 'top';

    /**
     * The selected tab panel index.
     * @order 3
     */
    @Prop({ mutable: true }) index: number;

    /**
     * The initial selected tab index.
     * @order 4
     */
    @Prop() initialIndex: number;

    /**
     * Set to `true` to hide the tab panel labels.
     * @order 5
     */
    @Prop() noLabels: boolean;

    /**
     * Fired when the `index` property has changed.
     */
    @Event({ eventName: 'index-changed' }) indexChanged: EventEmitter<{ value: number }>;

    @State() tabs: Array<WidgetTabPanel|WidgetLinkTabPanel> = [];
    @State() activeTab: WidgetTabPanel|WidgetLinkTabPanel = undefined;
    @State() iconOnly: boolean = false;

    render() {
        let tooltipPosition: TooltipPosition = undefined;
        switch (this.position) {
            case 'bottom': tooltipPosition = 'top';    break;
            case 'left'  : tooltipPosition = 'right';  break;
            case 'right' : tooltipPosition = 'left';   break;
            default      : tooltipPosition = 'bottom'; break;
        }

        // JSXON
        return this.base.render(
            <div id="root-container" class={ this.position }>
                {
                    this.position !== 'none' ?
                        <div id="tab-selector-container">
                            {
                                this.tabs.map((tab, index) =>
                                    <div id={ `tab_${index}` } class={ this.activeTab === tab ? 'active' : undefined } on-click={ () => this.activateTab(index) }>
                                        {
                                            tab.iconName ? <gc-widget-icon
                                                icon={ tab.iconName }
                                                path={ tab.iconPath }
                                                size={ this.iconOnly ? 'm' : 's' }
                                            >
                                            </gc-widget-icon> : undefined
                                        }
                                        { !this.noLabels && tab.label ? <gc-widget-label label={ tab.label }></gc-widget-label> : undefined }
                                        { tab.tooltip ? <gc-widget-tooltip anchor-id={ `tab_${index}` } text={ tab.tooltip } position={ tooltipPosition }></gc-widget-tooltip> : undefined }
                                    </div>)
                            }
                        </div>
                        : undefined
                }
                <div id="tab-panel-container">
                    <slot></slot>
                </div>
            </div>,
            { caption: this.caption, infoText: this.infoText }
        );
        // JSXOFF
    }

    componentWillLoad() {
        if (!GcUtils.isInDesigner && this.initialIndex !== -1) {
            this.index = !isNaN(this.initialIndex) ? this.initialIndex : 0;
        }
        this.updateTabs();
    }

    componentDidLoad() {
        const slot = this.el.shadowRoot.querySelector('slot');
        slot.addEventListener('slotchange', () => {
            this.updateTabs();
        });
    }

    @Listen('on-tab-panel-info-changed')
    onTabPanelInfoChanged(e: CustomEvent) {
        this.updateTabs();
    }

    private updateIconOnlyState() {
        this.iconOnly = !this.noLabels ? this.tabs.filter(tab => tab.label !== undefined && tab.label.length > 0).length === 0 : true;
    }

    private updateTabs() {
        const tabs: Array<WidgetTabPanel|WidgetLinkTabPanel> = [];
        this.el.querySelectorAll(':scope > gc-widget-tab-panel, :scope > gc-widget-link-tab-panel')
            .forEach(tab => tabs.push(tab as unknown as (WidgetTabPanel|WidgetLinkTabPanel)));
        this.tabs = tabs.filter(tab => !tab.hidden);

        if (this.tabs.length > 0) {
            this.updateIconOnlyState();
            this.activateTab(this.index < this.tabs.length ? this.index : this.tabs.length-1);
        }
    }

    activateTab(index: number) {
        if (index >= 0 && index < this.tabs.length) {
            const tab = this.tabs[index];

            console.log(`Activate tab: ${tab.label || tab['id']}`);
            this.tabs.forEach(_tab => (_tab as unknown as HTMLElement).style.display = _tab !== tab ? 'none' : '');
            this.activeTab = tab;
            this.index = index;
            this.refresh();

            if (typeof tab['activate'] === 'function') {
                tab['activate']();
            }
        }
    }

    @Watch('index')
    onIndexChanged(newValue: number) {
        this.activateTab(newValue);
        this.indexChanged.emit({ value: newValue });
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
    // #region gc-widget-base/gc-widget-base-title-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The widget caption text.
     * @order 207
     */
    @Prop({ reflect: true }) caption: string;

    /**
     * The widget info icon help text.
     * @order 208
     */
    @Prop({ reflect: true }) infoText: string;
    // #endregion

}
