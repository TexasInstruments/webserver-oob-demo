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

import { Component, h, Prop, Event, EventEmitter, Watch, Element, Method } from '@stencil/core';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';

/**
 * `gc-widget-progressbar` displays a determinate progress bar where the percentage of the operation complete is known or indeterminate bar if progress indications are not given.
 *
 * @label Progress Bar
 * @group Status Indicators
 * @css --gc-background-color | The background color | { "kind": "color" }
 * @css --gc-color | The progressbar color | { "kind": "color" }
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-progressbar',
    styleUrl: 'gc-widget-progressbar.scss',
    shadow: true
})
export class WidgetProgressbar implements WidgetBaseProps, WidgetBaseTooltipProps, WidgetBaseTitleProps, WidgetBaseDisabledProps {
    private percent: number;
    private setMin: number = 0; // internal min (default)
    private setMax: number = 100; // internal max (default)
    private currVal: number; //internal value

    private base = new ( // keep on separate line to enable source mapping
        class extends WidgetBase {
            get element() {
                return (this.parent as WidgetProgressbar).el;
            }
        })(this);

    render() {
        const mode = !this.indeterminate ? 'determinate' : 'indeterminate';
        let percent: number;
        if (!this.indeterminate) {
            if ((this.setMax > this.setMin) && this.currVal) {
                if (this.currVal >= this.setMax) {
                    percent = 100;
                } else if (this.currVal <= this.setMin) {
                    percent = 0;
                } else {
                    percent = (this.currVal - this.setMin)/(this.setMax - this.setMin) * 100;
                }
            }
        }
        // JSXON
        return this.base.render(
                <div id='progress-container'>
                    <div id='bar' class={ mode } >
                        { !this.indeterminate ? <div id='progress-indicator' style={{ width: `${percent}%` }} /> : null }
                    </div>
                    { this.message ? <div id='message'>{ this.message }</div>: null }
                </div>
            ,
            { caption: this.caption, infoText: this.infoText, tooltip: this.tooltip }
        );
        // JSXOFF
    }

    /**
     * The value to be shown.
     * @order 2
     */
    @Prop() value: number;

    /**
     * The min value.
     *
     * @order 3
     */
    @Prop() minValue: number;

    /**
     * The max value.
     * @order 4
     */
    @Prop() maxValue: number;

    /**
     * The min value.
     * @order 5
     */
    @Prop() indeterminate: boolean;

    /**
     * The progress message.
     */
    @Prop() message: string;

    /**
     * Fired when the `value` property has changed.
     */
    @Event({ eventName: 'value-changed' }) valueChanged: EventEmitter<{ value: number }>;

    @Watch('value')
    onValueChanged(newValue: number, oldValue?: number) {
        if (((oldValue !== newValue) || !(isNaN(oldValue) && isNaN(newValue)))) {
            if (GcUtils.isNumber(newValue)) {
                this.currVal = +newValue;
                if (this.el.isConnected) {
                    this.valueChanged.emit({ value: this.currVal });
                }
            } else {
                this.currVal = this.setMin;
            }
        }
    }
    @Watch('minValue')
    onMinChanged(newValue: number, oldValue?: number) {
        if (!this.disabled && ((oldValue !== newValue) && !(isNaN(oldValue) && isNaN(newValue)))) {
            this.setMin = GcUtils.isNumber(newValue) ? +newValue : 0;
        }
    }
    @Watch('maxValue')
    onMaxChanged(newValue: number, oldValue?: number) {
        if (!this.disabled && ((oldValue !== newValue) || !(isNaN(oldValue) && isNaN(newValue)))) {
            this.setMax = GcUtils.isNumber(newValue) ? +newValue : 100;
        }
    }

    componentWillLoad() {
        if (this.maxValue) this.setMax = this.maxValue;
        if (this.minValue) this.setMin = this.minValue;
        this.currVal = this.value ?? this.setMin;
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
