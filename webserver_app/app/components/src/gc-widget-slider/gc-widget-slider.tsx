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

import { Component, h, Prop, Event, EventEmitter, Element, Method, Watch, Listen } from '@stencil/core';
import { WidgetBaseRangeValueProps } from '../gc-widget-base/gc-widget-base-range-value-props';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { WidgetBaseReadonlyProps } from '../gc-widget-base/gc-widget-base-readonly-props';
import { WidgetBaseRangeValue } from '../gc-widget-base/gc-widget-base-range-value';
import { GcConsole } from '../gc-core-assets/lib/GcConsole';

const console = new GcConsole('gc-widget-slider');

/**
 * `gc-widget-slider` is a widget with a slider that can be used to input a value. This widget
 * supports both single value and low and high values (range).
 *
 * @label Slider
 * @group Inputs
 * @css --gc-font-size | Label font size
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-slider',
    styleUrl: 'gc-widget-slider.scss',
    shadow: true
})
export class WidgetSlider implements WidgetBaseRangeValueProps, WidgetBaseTitleProps, WidgetBaseDisabledProps, WidgetBaseReadonlyProps {
    private isTiRangeSliderChange = false;

    private base = new (
        class extends (WidgetBaseRangeValue) {
            get slider() {
                return this.parent as WidgetSlider;
            }
            get element() {
                return this.slider.el;
            }
            get value() {
                return this.slider.value;
            }
            get lvalue() {
                return this.slider.lvalue;
            }
            onValueChanged(newValue: unknown, oldValue: unknown) {
                this.slider.value = newValue as number;
            }
            onLValueChanged(newValue: unknown, oldValue: unknown) {
                this.slider.lvalue = newValue as number;
            }
        }
    )(this);

    /**
     * Controls whether to use as range slider (value and lvalue) or as single slider.
     * @order 2
     */
    @Prop() rangeSlider: boolean = false;

    /**
     * The step value for the slider.
     * @order 3
     */
    @Prop() step: number;

    /**
     * Controls whether the tick marks are displayed.
     * @order 7
     */
    @Prop() noTicks: boolean;

    /**
     * Provides a list of text labels for the tick marks on the slider. The list of label must
     * be separated by either comma ',', semicolon ';', or pipe '|'.
     * @order 8
     */
    @Prop() labels: string;

    render() {
        return this.base.render(
            <ti-range-slider
                range={ [ this.base.minValue, this.base.maxValue ] }
                step={ this.step }
                labels={ this.labels }
                show-ticks={ !this.noTicks }
                min-is-fixed={ !this.rangeSlider }
                min={ Math.max(this.base.minValue, this.lvalue || 0) }
                max={ Math.min(this.base.maxValue, this.value || 0) }
                disabled={ this.disabled }
            >
            </ti-range-slider>,
            { caption: this.caption, infoText: this.infoText }
        );
    }

    @Watch('value')
    onValueChanged(newValue: number, oldValue: number) {
        this.valueChanged.emit({ value: newValue, oldValue: oldValue });
    }

    @Watch('lvalue')
    onLValueChanged(newValue: number, oldValue: number) {
        this.lvalueChanged.emit({ value: newValue, oldValue: oldValue });
    }

    @Listen('tiChangeStart')
    onTiChangeStart(event: CustomEvent) {
        this.isTiRangeSliderChange = true;
    }

    @Listen('tiChange')
    onTiChange(event: CustomEvent) {
        if (event.detail.range && event.detail.change) {
            const range = event.detail.range;
            const change = event.detail.change;

            if (['min', 'max'].includes(change)) {
                this.base.onIntermediateRangeValueChanged(range.min, range.max, !this.isTiRangeSliderChange ? true : false);
            }
        }
    }

    @Listen('tiChangeEnd')
    onTiChangeEnd(event: CustomEvent) {
        if (event.detail.range) {
            this.base.onIntermediateRangeValueChanged(event.detail.range.min, event.detail.range.max, true);
        }
        this.isTiRangeSliderChange = false;
    }

    // #region gc-widget-base/gc-widget-base-range-value-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Fired when the `value` property has changed.
     */
    @Event({ eventName: 'value-changed' }) valueChanged: EventEmitter<{ value: number; oldValue: number }>;

    /**
     * The value (high value).
     * @order 5
     */
    @Prop({ mutable: true }) value: number = 0;

    /**
     * Fired when the `lvalue` (low value) property has changed.
     */
    @Event({ eventName: 'lvalue-changed' }) lvalueChanged: EventEmitter<{ value: number; oldValue: number }> ;

    /**
     * The low value.
     * @order 6
     */
    @Prop({ mutable: true }) lvalue: number = 0;

    /**
     * The minimum value.
     * @order 11
     */
    @Prop() minValue: number = 0;

    /**
     * The maximum value.
     * @order 12
     */
    @Prop() maxValue: number = 100;
    // #endregion
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
