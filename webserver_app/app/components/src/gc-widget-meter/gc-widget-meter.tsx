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

import { Component, h, Event, EventEmitter, Listen, Watch, Element, Method, Prop } from '@stencil/core';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { WidgetBaseGaugeProps } from '../gc-widget-base/gc-widget-base-gauge-props';
import { WidgetBaseGauge } from '../gc-widget-base/gc-widget-base-gauge';


/**
 * `gc-widget-meter` is a meter that displays value in a semi circular fashion.
 *
 * @label Meter
 * @group Instruments
 * @css --gc-arc-thickness | The thickness of the arc | { "kind": "select", "options": ["", "normal", "thick", "thin"] }
 * @css --gc-arc-background-color | The background color of the arc | { "kind": "color" }
 * @css --gc-arc-low-color | The low value foreground color of the arc | { "kind": "color" }
 * @css --gc-arc-mid-color | The mid value foreground color of the arc | { "kind": "color" }
 * @css --gc-arc-high-color | The high value foreground color of the arc | { "kind": "color" }
 * @css --gc-font-color | The label font color | { "kind": "color" }
 * @demo
 * @usage
 * @archetype
 */
@Component({
    tag: 'gc-widget-meter',
    styleUrl: 'gc-widget-meter.scss',
    shadow: true
})
export class WidgetMeter implements WidgetBaseGaugeProps, WidgetBaseDisabledProps, WidgetBaseTooltipProps, WidgetBaseTitleProps {
    private base = new ( // keep on separate line to enable source mapping
        class extends WidgetBaseGauge {
            get meter() {
                return this.parent as WidgetMeter;
            }

            get element() {
                return this.meter.el;
            }
        })(this);

    render() {
        // JSXON
        return this.base.render(
            <svg width="100%" height="100%" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet">
                <g id="face-layer">
                    <path id="arc-background" d={ this.createMeterPath(this.base.maxValue) } />
                    <path id="arc" d={ this.createMeterPath(this.base.value) } />
                </g>

                <g id="label-layer">
                    <text id="main-title" x="50" y="40">{ this.mainTitle }</text>
                    <text id="sub-title" x="50" y="47">{ this.subTitle }</text>
                    <text id="min-value" x={ this.meterThickness + 3 } y="49">{ (this.base.minValue < this.base.maxValue ? this.base.minValue : 0).toFixed(this.precision) }</text>
                    <text id="max-value" x={ 100 - this.meterThickness - 3 } y="49">{ (this.base.maxValue > this.base.minValue ? this.base.maxValue : 100).toFixed(this.precision) }</text>
                    <text id="value" x="50" y="30">{ this.base.value.toFixed(this.precision) }</text>
                </g>
            </svg>,
            { caption: this.caption, infoText: this.infoText, tooltip: this.tooltip }
        );
        // JSXOFF
    }

    componentWillLoad() {
        this.onValueChanged();
    }

    @Watch('value')
    onValueChanged() {
        this.setCSSProperty('--gc-internal-arc-color', this.getMeterFillColor());
    }

    @Watch('minValue')
    @Watch('maxValue')
    @Watch('precision')
    onPropChanged() {
        this.onValueChanged();
    }

    @Listen('css-property-changed')
    onCSSPropertyChanged(ev: CustomEvent) {
        this.setCSSProperty('--gc-internal-arc-color', this.getMeterFillColor());
        this.refresh();
    }

    private trimHexColor(hex: string) {
        return hex.charAt(0) === '#' ? hex.substring(1, 7) : hex;
    }

    private get meterThickness() {
        const thicknessCSSVar = this.base.getCSSProperty('--gc-arc-thickness');
        switch (thicknessCSSVar) {
            case 'thin'  : return 10;
            case 'normal': return 15;
            case 'thick' : return 20;
        }

        return 15;
    }

    private getArcFillColor() {
        const result = [];
        const lowColor = this.base.getCSSProperty('--gc-arc-low-color');
        const midColor = this.base.getCSSProperty('--gc-arc-mid-color');
        const highColor = this.base.getCSSProperty('--gc-arc-high-color');

        if (lowColor) result.push(lowColor);
        if (midColor) result.push(midColor);
        if (highColor) result.push(highColor);

        return result.length > 0 ? result : undefined;
    }

    private getMeterFillColor(gradient: boolean = true) {
        const pct = this.base.value / this.base.maxValue;
        const percentageColors = this.getArcFillColor() ?? ['#329b46 ', '#f3cd34 ', '#dd0000'];
        const length = percentageColors.length;

        if (length === 1) return percentageColors[0];
        const inc = gradient ? (1 / (length - 1)) : (1 / length);
        const colors = [];
        for (let i = 0; i < length; ++i) {
            const percentage = gradient ? inc * i : inc * (i + 1);
            const red   = parseInt(this.trimHexColor(percentageColors[i]).substring(0, 2), 16);
            const green = parseInt(this.trimHexColor(percentageColors[i]).substring(2, 4), 16);
            const blue  = parseInt(this.trimHexColor(percentageColors[i]).substring(4, 6), 16);
            colors[i] = { pct: percentage, color: { r: red, g: green, b: blue } };
        }

        if (pct === 0) {
            return `rgb(${colors[0].color.r}, ${colors[0].color.g}, ${colors[0].color.b})`;
        }

        for (let i = 0; i < colors.length; ++i) {
            if (pct <= colors[i].pct) {
                if (gradient) {
                    const lower = colors[i - 1];
                    const upper = colors[i];
                    const range = upper.pct - lower.pct;
                    const rangePct = (pct - lower.pct) / range;
                    const pctLower = 1 - rangePct;
                    const pctUpper = rangePct;
                    const color = {
                        r: Math.floor(lower.color.r * pctLower + upper.color.r * pctUpper),
                        g: Math.floor(lower.color.g * pctLower + upper.color.g * pctUpper),
                        b: Math.floor(lower.color.b * pctLower + upper.color.b * pctUpper)
                    };
                    return `rgb(${color.r}, ${color.g}, ${color.b})`;
                } else {
                    return `rgb(${colors[i].color.r}, ${colors[i].color.g}, ${colors[i].color.b})`;
                }
            }
        }
    }

    private createMeterPath(value: number) {
        const Ro = 50;                       // outer radius
        const Ri = Ro - this.meterThickness; // inner radius - thickness

        let val = value;
        if (this.base.minValue > this.base.maxValue) {
            val = Math.max(val, this.base.maxValue);
            val = Math.min(val, this.base.minValue);
            val = (this.base.minValue - val) / (this.base.minValue - this.base.maxValue);
        } else {
            val = Math.max(val, this.base.minValue);
            val = Math.min(val, this.base.maxValue);
            val = (val - this.base.minValue) / (this.base.maxValue - this.base.minValue);
        }

        const alpha = (1 - val) * Math.PI;
        const Xo = Ro * Math.cos(alpha);
        const Yo = Ro * Math.sin(alpha);
        const Xi = Ri * Math.cos(alpha);
        const Yi = Ri * Math.sin(alpha);

        return 'M 0 50 '
             + `A ${Ro} ${Ro} 0 0 1 ${Ro + Xo} ${Ro - Yo} `
             + `L ${Ro + Xi} ${Ro - Yi} `
             + `A ${Ri} ${Ri} 0 0 0 ${Ro - Ri} ${Ro} Z`;
    }

    // #region gc-widget-base/gc-widget-base-gauge-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The display value.
     * @order 2
     */
    @Prop() value: number = 0;

    /**
     * The minimum value to display.
     * @order 3
     */
    @Prop() minValue: number = 0;

    /**
     * The maximum value to display.
     * @order 4
     */
    @Prop() maxValue: number = 100;

    /**
     * The decimal precision to display for the tick labels.
     * @order 11
     */
    @Prop() precision: number = 0;

    /**
     * The main title text displayed on the gauge.
     * @order 12
     */
    @Prop() mainTitle: string;

    /**
     * The sub title text displayed on the gauge.
     * @order 13
     */
    @Prop() subTitle: string;
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
    // #region gc-widget-base/gc-widget-base-disabled-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the widget disabled state.
     * @order 202
     */
    @Prop({ reflect: true }) disabled: boolean = false;
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

}
