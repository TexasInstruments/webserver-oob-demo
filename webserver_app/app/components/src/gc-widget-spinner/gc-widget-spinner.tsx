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

import { Component, h, Prop, Event, EventEmitter, Element, Listen, Method, Watch } from '@stencil/core';
import { WidgetBaseIntermediateValueProps } from '../gc-widget-base/gc-widget-base-intermediate-value-props';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { WidgetBaseReadonlyProps } from '../gc-widget-base/gc-widget-base-readonly-props';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { NumericFormatType, WidgetInput } from '../gc-widget-input/gc-widget-input';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';

/**
 * `gc-widget-spinner` is a number input widget with buttons to increment or decrement the value by a fixed amount.
 *
 * @label Number Spinner
 * @group Inputs
 * @css --gc-text-align | Text align | { "kind": "select", "options": ["", "center", "left", "right"] }
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-spinner',
    styleUrl: 'gc-widget-spinner.scss',
    shadow: true
})
export class WidgetSpinner implements WidgetBaseIntermediateValueProps, WidgetBaseTooltipProps, WidgetBaseTitleProps, WidgetBaseDisabledProps, WidgetBaseReadonlyProps {
    private inputElement: WidgetInput;

    private base = new (
        class extends WidgetBase {
            get element() {
                return (this.parent as WidgetSpinner).el;
            }
        }
    )(this);

    /**
     * Fired when the input value has changed.
     */
    @Event({ eventName: 'value-changed' }) valueChanged: EventEmitter<{ value: number }>;

    /**
     * The numeric value input by the user.
     * @order 2
     */
    @Prop({ mutable: true }) value: number = 0;

    /**
     * The display format type.
     * @order 3
     */
    @Prop() format: NumericFormatType = 'dec';


    /**
     * Provides the numeric increment/decrement value that will be added/subtracted to the value
     * when the up/down arrow is pressed.
     * Controls whether to use as range slider (value and lvalue) or as single value slider.
     */
    @Prop() increment: number = 1;

    /**
     * The display format precision, only valid for numeric format type.<br><br>
     *
     * `binary` minimum digits with zero extended.<br>
     * `dec` number of decimal places to round to.<br>
     * `exp` number of decimal places to round to.<br>
     * `hex` minimum digits with zero extended.<br>
     * `q` the number of bits used to designate the fractional portion of the number.
     * @order 5
     */
    @Prop() precision: number;
    @Prop() noTicks: boolean = false;
    /**
     * Provides a minimum value below which the user cannot enter.
     * @order 6
     */
    @Prop() minValue: number;

    /**
     * Provides a maximum value above which the user cannot enter.
     * @order 7
     */
    @Prop() maxValue: number;

    /**
     * Selects the input text when the widget has focus.
     * @order 8
     */
    @Prop() selectOnFocus: boolean;

    render() {
        // JSXON
        return this.base.render(
            <div id="root-container">
                <gc-widget-input
                    ref={ (el: HTMLElement) => this.inputElement = el as unknown as WidgetInput }
                    format={ this.format }
                    disabled={ this.disabled }
                    readonly={ this.readonly }
                    value={ this.value }
                    precision={ this.precision }
                    intermediate-changes={ this.intermediateChanges }
                    selectOnFocus={ this.selectOnFocus }
                    min-value={ this.minValue }
                    max-value={ this.maxValue }
                >
                </gc-widget-input>
                <div id="arrow-icon-wrapper">
                    <gc-widget-icon icon="navigation:expand_less" size="xs" on-click={ this.incrementHdlr.bind(this) }></gc-widget-icon>
                    <gc-widget-icon icon="navigation:expand_more" size="xs" on-click={ this.decrementHdlr.bind(this) }></gc-widget-icon>
                </div>
            </div>,
            { caption: this.caption, infoText: this.infoText, tooltip: this.tooltip }
        );
        // JSXOFF
    }

    @Listen('value-changed')
    onBaseValueChangedListener(event: CustomEvent) {
        this.value = this.getValueInRange(event.detail.value);
    }

    @Watch('minValue')
    @Watch('maxValue')
    onMinMaxChanged() {
        this.inputElement.setMinMax(this.minValue, this.maxValue);
    }

    incrementHdlr() {
        if (this.disabled) return;
        this.value = this.getValueInRange(this.value + this.increment);
    }

    decrementHdlr() {
        if (this.disabled) return;
        this.value = this.getValueInRange(this.value - this.increment);
    }

    private getValueInRange(value: number) {
        if (value > this.maxValue) return this.maxValue;
        else if (value < this.minValue) return this.minValue;
        else return value;
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
