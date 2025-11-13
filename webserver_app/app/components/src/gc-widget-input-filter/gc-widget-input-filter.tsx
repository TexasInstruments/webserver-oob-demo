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

import { Component, h, Prop, Event, EventEmitter, Element, Method, Listen } from '@stencil/core';
import { WidgetBaseIntermediateValueProps } from '../gc-widget-base/gc-widget-base-intermediate-value-props';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { WidgetBaseReadonlyProps } from '../gc-widget-base/gc-widget-base-readonly-props';
import { WidgetInput } from '../gc-widget-input/gc-widget-input';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';

/**
 *`gc-widget-input-filter` is a text input widget with filter support.
 *
 * @label Input Filter
 * @group Inputs
 * @css --gc-text-align | Text align | { "kind": "select", "options": ["", "center", "left", "right"] }
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-input-filter',
    styleUrl: 'gc-widget-input-filter.scss',
    shadow: true
})
export class WidgetInputFilter implements WidgetBaseIntermediateValueProps, WidgetBaseTooltipProps, WidgetBaseTitleProps, WidgetBaseDisabledProps, WidgetBaseReadonlyProps {
    private inputElement: WidgetInput;

    private base = new (
        class extends WidgetBase {
            get element() {
                return (this.parent as WidgetInputFilter).el;
            }
        }
    )(this);

    /**
     * Fired when the clear icon has clicked.
     */
    @Event({ eventName: 'clear-icon-clicked' }) clearIconClicked: EventEmitter;

    /**
     * Fired when the input value has changed.
     */
    @Event({ eventName: 'value-changed' }) valueChanged: EventEmitter<{ value: string }>;

    /**
     * The input value.
     * @order 2
     */
    @Prop({ mutable: true }) value: string;

    /**
     * The text to display when nothing has been entered into the input box.
     * @order 3
     */
    @Prop() placeholder: string;

    /**
     * Selects the input text when the widget has focus.
     * @order 4
     */
    @Prop() selectOnFocus: boolean;

    /**
     * Sets to `true` to show the clear icon.
     * @order 5
     */
    @Prop() hasClearIcon: boolean = false;

    /**
     * Sets to `true` to show the search icon.
     * @order 6
     */
    @Prop() hasSearchIcon: boolean = false;

    /**
     * Pattern used for full match regular expression validation of the value.
     * @order 7
     */
    @Prop() pattern: string;

    render() {
        // JSXON
        return this.base.render(
            <div id="root-container">
                { this.hasSearchIcon ? <gc-widget-icon id="search" icon="action:search"/> : null }
                <gc-widget-input
                    format="text"
                    ref={ (el: Element) => this.inputElement = el as unknown as WidgetInput }
                    disabled={ this.disabled }
                    readonly={ this.readonly }
                    value={ this.value }
                    pattern={ this.pattern }
                    placeholder={ this.placeholder }
                    selectOnFocus={ this.selectOnFocus }
                    intermediate-changes={ this.intermediateChanges }
                >
                </gc-widget-input>
                {
                    this.hasClearIcon ?
                        <gc-widget-icon id="clear" icon="content:delete_sweep" appearance="custom" size="s" on-mousedown={ () => this.onClearIconMouseDownHdlr() }></gc-widget-icon>
                        : null
                }
            </div>,
            { caption: this.caption, infoText: this.infoText, tooltip: this.tooltip }
        );
        // JSXOFF
    }

    @Listen('value-changed')
    onBaseValueChangedListener(event: CustomEvent) {
        this.value = event.detail.value;
    }

    @Method()
    async setFocus(): Promise<void> {
        return new Promise(resolve => {
            /* need to defer until render is completed before setting focus for the input item */
            setTimeout(() => {
                this.inputElement.setFocus();
                resolve();
            }, 1);
        });
    }

    @Method()
    async selectAll() {
        this.inputElement?.selectAll();
    }

    onClearIconMouseDownHdlr() {
        if (this.disabled) return;

        setTimeout(async () => {
            await (this.inputElement as unknown as WidgetInput).clear();
            await this.setFocus();
            this.clearIconClicked.emit();
        }, 10);
    }

    // #region gc-widget-base/gc-widget-base-intermediate-value-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls whether or not intermediate changes due to the user's mouse dragging or typing are committed
     * to the value attribute. If intermediate changes are not allowed, then the value attribute will only
     * update when the user has finished dragging or entering text.
     * @order 20
     */
    @Prop({ mutable: true }) intermediateChanges: boolean = false;
    // #endregion
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
    // #region gc-widget-base/gc-widget-base-readonly-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the widget readonly state.
     * @order 201
     */
    @Prop({ reflect: true }) readonly: boolean = false;
    // #endregion

}
