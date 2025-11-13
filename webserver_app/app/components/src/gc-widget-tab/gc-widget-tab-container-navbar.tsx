/**
 *  Copyright (c) 2021 Texas Instruments Incorporated
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
import { h, Component, Prop, Event, EventEmitter, Element, Method } from '@stencil/core';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetLinkTabPanel } from './gc-widget-link-tab-panel';
import { WidgetTabContainer } from './gc-widget-tab-container';
import { WidgetTabPanel } from './gc-widget-tab-panel';

/**
 * `gc-widget-tab-container-navbar` is a widget that can be use to set the active tab of
 * the `gc-widget-tab-container` widget. The tab selection buttons information will be
 * automatically discovered from the associated tab container widget.
 *
 * @label Tab Container Navigation Bar
 * @group Containers
 * @demo demo/navbar.html
 * @usage gc-widget-tab-container-navbar-usage.md
 */
@Component({
    tag: 'gc-widget-tab-container-navbar',
    styleUrl: 'gc-widget-tab-container-navbar.scss',
    shadow: true
})
export class WidgetTabContainerNavbar implements WidgetBaseProps, WidgetBaseTitleProps {
    private tabContainer: HTMLElement;
    private tabPanels: Array<WidgetTabPanel|WidgetLinkTabPanel> = [];
    private tabActivatedListener: (e: CustomEvent) => void;

    private base = new (
        class extends WidgetBase {
            get element() {
                return (this.parent as WidgetTabContainerNavbar).el;
            }
        })(this);

    /**
     * The tab container id to associate with this widget. If not provided, the first
     * `gc-widget-tab-container` found in the document will be used.
     *
     * @order 2
     */
    @Prop() tabContainerId: string;

    /**
     * The `gc-widget-tab-panel` or `gc-widget-link-tab-panel` ids to be excluded from
     * rendering of the selection buttons. The list of ids are separated by ',', '|', or ';'.
     *
     * @order 3
     */
    @Prop() excludedTabPanelIds: string;

    render() {
        const excludeIds = GcUtils.parseArrayProperty(this.excludedTabPanelIds) || [];

        // JSXON
        return this.base.render(
            this.tabPanels.map((e: WidgetTabPanel|WidgetLinkTabPanel, index: number) =>
                !e.hidden ?
                    <div class="button" on-click={ () => this.buttonClicked(index) } hidden={ excludeIds.includes((e as unknown as HTMLElement).id) }>
                        <gc-widget-icon class="icon" icon={ e.iconName} path={ e.iconPath } size="xl" />
                        <gc-widget-label class="title" label={ e.label || '' } />
                        <gc-widget-label class="desc" label={ e.tooltip || '' } />
                    </div> :
                    undefined

            ),
            { caption: this.caption, infoText: this.infoText }
        );
        // JSXOFF
    }

    componentWillLoad() {
        this.tabActivatedListener = (e: CustomEvent) => {
            const index = e.detail.value;
            const buttons = this.el.shadowRoot.querySelectorAll('.button');
            for (let i = 0; i < buttons.length; ++i) {
                buttons[i].classList.remove('active');
            }
            if (index < buttons.length) {
                buttons[index].classList.add('active');
            }
        };
    }

    componentWillRender() {
        const tabContainer = this.tabContainerId ?
            document.querySelector(`#${this.tabContainerId}`) :
            document.querySelector('gc-widget-tab-container');
        this.tabPanels = [];

        if (this.tabContainer) {
            this.tabContainer.removeEventListener('index-changed', this.tabActivatedListener);
            this.tabContainer = undefined;
        }

        if (tabContainer) {
            for (let i = 0; i < tabContainer.children.length; ++i) {
                const tagName = tabContainer.children[i].tagName.toLowerCase();
                if (['gc-widget-tab-panel', 'gc-widget-link-tab-panel'].includes(tagName)) {
                    this.tabPanels.push(tabContainer.children[i] as unknown as WidgetTabPanel|WidgetLinkTabPanel);
                }
            }

            this.tabContainer = tabContainer as HTMLElement;
            tabContainer.addEventListener('index-changed', this.tabActivatedListener);
        }
    }

    componentDidRender() {
        if (this.tabActivatedListener && this.tabContainer) {
            const index = (this.tabContainer as unknown as WidgetTabContainer).index;
            this.tabActivatedListener(new CustomEvent('dummy', { detail: { value: index } }));
        }
    }

    buttonClicked(index: number) {
        if (this.tabContainer) {
            (this.tabContainer as unknown as WidgetTabContainer).index = index;
        }
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
