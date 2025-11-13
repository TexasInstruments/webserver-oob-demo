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
import { Component, h, Prop, Event, EventEmitter, Element, Method, Listen, Watch, State } from '@stencil/core';
import { WidgetBaseIntermediateValueProps } from '../gc-widget-base/gc-widget-base-intermediate-value-props';
import { WidgetBaseIntermediateValue } from '../gc-widget-base/gc-widget-base-intermediate-value';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { WidgetBaseReadonlyProps } from '../gc-widget-base/gc-widget-base-readonly-props';
import { DataConverter } from '../gc-core-databind/lib/CoreDatabind';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';

export type NumericFormatType = 'binary' | 'dec' | 'hex' | 'exp' | 'q';
export type FormatType = 'text' | NumericFormatType;
export type ValueType = string | number;

/**
 * `gc-widget-input` is an editable auto value format input widget.
 *
 * @label Input
 * @group Inputs
 * @css --gc-text-align | Text align | { "kind": "select", "options": ["", "center", "left", "right"] }
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-input',
    styleUrl: 'gc-widget-input.scss',
    shadow: true
})
export class WidgetInput implements WidgetBaseIntermediateValueProps, WidgetBaseTooltipProps, WidgetBaseTitleProps, WidgetBaseDisabledProps, WidgetBaseReadonlyProps {
    private editing: boolean = false;
    private displayValue: string;
    private maxValue: number = Number.MAX_SAFE_INTEGER;
    private minValue: number = Number.MIN_SAFE_INTEGER;
    private tiInputElement: HTMLElement;

    private base = new (
        class extends WidgetBaseIntermediateValue {
            get input() {
                return this.parent as WidgetInput;
            }

            get element() {
                return this.input.el;
            }

            get value() {
                return this.input.displayValue;
            }

            onValueChanged(newValue: unknown, oldValue: unknown): void {
                const editing = this.input.editing;
                const format = this.input.format;
                let value = newValue as ValueType;

                if (format !== 'text') {
                    value = DataConverter.convert(newValue as string, 'string', 'number') as number;

                    if (editing && isNaN(value)) {
                        return;
                    }
                } else {
                    value = newValue as string;
                }

                if (this.input.maxValue && value > this.input.maxValue) value = this.input.maxValue;
                else if (this.input.minValue && value < this.input.minValue) value = this.input.minValue;

                if (this.input.value !== value) {
                    this.input.value = value;

                } else {
                    this.input.updateDisplayValue();
                }
            }
        }
    )(this);

    /**
     * The display format type.
     * @order 2
     */
    @Prop() format: FormatType = 'text';

    /**
     * The input value. This is the committed value unless `intermediate-changes` is set to `false`.
     * @order 3
     */
    @Prop() value: ValueType;

    /**
     * The display format precision, only valid for numeric format type.<br><br>
     *
     * `binary` minimum digits with zero extended.<br>
     * `dec` number of decimal places to round to.<br>
     * `exp` number of decimal places to round to.<br>
     * `hex` minimum digits with zero extended.<br>
     * `q` the number of bits used to designate the fractional portion of the number.
     * @order 4
     */
    @Prop() precision: number;

    /**
     * Placeholder text when input is empty.
     * @order 5
     */
    @Prop() placeholder: string;

    /**
     * Automatic select the text when the widget has focus.
     * @order 6
     */
    @Prop() selectOnFocus: boolean;

    /**
     * Pattern used for full match regular expression validation of the value.
     * @order 6
     */
    @Prop() pattern: string;

    /**
     * Fired when the `value` property has changed.
     */
    @Event({ eventName: 'value-changed' }) valueChanged: EventEmitter<{ value: ValueType }>;

    render() {
        return this.base.render(
            // JSXON
            <div id="root-container">
                <ti-input
                    ref={ (el: HTMLElement) => this.tiInputElement = el }
                    placeholder={ this.placeholder }
                    disabled={ this.disabled }
                    readonly={ this.readonly }
                    pattern={ this.pattern }
                >
                </ti-input>
            </div>,
            // JSXOFF
            { caption: this.caption, infoText: this.infoText, tooltip: this.tooltip }
        );
    }

    componentDidRender() {
        this.updateDisplayValue();
    }

    /**
     * Sets the min and max value.
     *
     * @param min the min value
     * @param max the max value
     * @hidden
     */
    @Method()
    async setMinMax(min: number, max: number) {
        if (min) this.minValue = min;
        if (max) this.maxValue = max;
    }

    private getInput() {
        return this.tiInputElement?.shadowRoot?.querySelector('input');
    }

    /**
     * Selects the input text.
     */
    @Method()
    async selectAll() {
        this.getInput()?.select();
    }

    /**
     * Sets the focus on the input element.
     */
    @Method()
    async setFocus() {
        this.getInput()?.focus({ preventScroll: true });
    }

    /**
     * Clears the input element value.
     */
    @Method()
    async clear() {
        this.value = '';

        // @ts-ignore
        if (this.tiInputElement)  this.tiInputElement.value = '';

        const input = this.getInput();
        if (input) input.value = '';

        this.editing = false;
    }

    @Listen('focus')
    onFocusChanged(event: FocusEvent) {
        if (this.selectOnFocus) {
            this.selectAll();
        }
    }

    @Listen('tiChange')
    onTiChanged(event: CustomEvent) {
        this.editing = !event.detail.commit;
        this.base.onIntermediateValueChanged(event.detail.value, !this.editing);
    }

    @Watch('value')
    onValueChanged(newValue: ValueType) {
        this.updateDisplayValue();
        this.valueChanged.emit({ value: newValue });
    }

    @Watch('format')
    onFormatChanged(newValue: FormatType) {
        this.updateDisplayValue();
    }

    @Watch('precision')
    onPrecisionChanged(newValue: number) {
        this.updateDisplayValue();
    }

    updateDisplayValue() {
        if (this.editing && this.intermediateChanges) return;

        if (this.value !== null && this.value !== undefined) {
            if (this.format !== 'text') {
                this.displayValue = DataConverter.convert(this.value, typeof this.value, this.format, this.precision);
            } else {
                this.displayValue = this.value.toString();
            }
        } else {
            this.displayValue = undefined;
        }

        // When binding displayValue to ti-input value in the render function,
        // it is causing the two widgets to continuously updating each other's
        // properties . Hence, manually update the underline input is required.
        const input = this.getInput();
        if (input) input.value = this.displayValue ?? '';
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
