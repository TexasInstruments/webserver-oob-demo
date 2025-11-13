/**
 *  Copyright (c) 2019, 2021 Texas Instruments Incorporated
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
import { Component, h, Prop, Element, Event, EventEmitter, Method, Listen } from '@stencil/core';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';

/**
 * `gc-widget-button` is a button with bindable properties.
 *
 * @label Button
 * @group Common
 * @css --gc-color | Font color | { "kind": "color" }
 * @css --gc-color-disabled | Text disabled color | { "kind": "color" }
 * @css --gc-color-hover | Font hover color | { "kind": "color" }
 * @css --gc-background-color | Background color | { "kind": "color" }
 * @css --gc-background-color-disabled | Background disabled color | { "kind": "color" }
 * @css --gc-background-color-hover | Background hover color | { "kind": "color" }
 * @css --gc-border-color | Border color | { "kind": "color" }
 * @css --gc-border-color-disabled | Border disabled color | { "kind": "color" }
 * @css --gc-border-color-hover | Border hover color | { "kind": "color" }
 * @css --gc-text-decoration | Text decoration | { "kind": "select", "options": ["", "line-through", "overline", "underline"] }
 * @css --gc-text-decoration-hover | Text hover decoration | { "kind": "select", "options": ["", "line-through", "overline", "underline"] }
 * @css --gc-text-transform | Specifies how to capitalize the text | { "kind": "select", "options": ["", "capitalize", "lowercase", "uppercase" ] }
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-button',
    styleUrl: 'gc-widget-button.scss',
    shadow: true
})
export class WidgetButton implements WidgetBaseProps, WidgetBaseTooltipProps, WidgetBaseTitleProps, WidgetBaseDisabledProps {
    private base = new ( // keep on separate line to enable source mapping
        class extends WidgetBase {
            get element() {
                return (this.parent as WidgetButton).el;
            }
        }
    )(this);

    /**
     * Button type. For custom buttonType, CSS styling can be used to style the look of the button. See
     * the available CSS variables that can be use set the style.
     * @order 2
     */
    @Prop({ reflect: true }) buttonType: 'primary' | 'secondary' | 'link' | 'custom' = 'primary';

    /**
     * The text displayed as the button caption.
     * @order 3
     */
    @Prop() label: string;

    /**
     * The icon to be displayed before the label.
     * @order 4
     */
    @Prop() icon: string;

    /**
     * (deprecated) Incremented each time the button is clicked.  This can be used to
     * e.g. bind to a target variable that causes an action to be performed when it changes.
     * The target should change the value of the bound variable back to 0 when the action is complete,
     * and trigger the action when bindableTrigger changes it to > 0.
     * @hidden
     * @deprecated use `click` event listener
     */
    @Prop() bindableTrigger: number = 0;

    render() {
        // JSXON
        return this.base.render(
            <ti-button appearance={ this.buttonType } disabled={ this.disabled }
                onClick={ () => !GcUtils.isInDesigner ? this.bindableTrigger++ : null }>
                <div class="content">
                    { this.icon ? <gc-widget-icon class={ this.label ? '' : 'no-label' } appearance="custom" size="m" icon={ this.icon }></gc-widget-icon> : null }
                    { <span>{ !this.icon && !this.label ? 'Button' : this.label }</span> }
                </div>
            </ti-button>,
            { caption: this.caption, infoText: this.infoText, tooltip: this.tooltip }
        );
        // JSXOFF
    }

    componentDidRender() {
        // workaround ti-button not flexing to parent size
        const tiButton = this.el.shadowRoot.querySelector('ti-button');
        if (tiButton && tiButton.shadowRoot) {
            const button = tiButton.shadowRoot.querySelector('button');
            if (button) {
                button.style.height = 'inherit';
                button.style.width = 'inherit';
            }
        }
    }

    @Listen('click')
    onClickHdlr(event: MouseEvent) {
        if (this.disabled) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }
    }

    getButtonType() {
        if (this.buttonType === 'custom') {
            return 'primary';
        } else {
            return this.buttonType ? this.buttonType : '';
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
    // #region gc-widget-base/gc-widget-base-tooltip-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the tooltip that is displayed for this widget.
     * @order 210
     */
    @Prop() tooltip: string;
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
    // #region gc-widget-base/gc-widget-base-disabled-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the widget disabled state.
     * @order 202
     */
    @Prop({ reflect: true }) disabled: boolean = false;
    // #endregion

}
