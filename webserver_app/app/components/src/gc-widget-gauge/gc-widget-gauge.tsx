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

import { Component, h, Prop, Event, EventEmitter, Listen, Watch, Element, Method, State } from '@stencil/core';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { WidgetBaseGaugeProps } from '../gc-widget-base/gc-widget-base-gauge-props';
import { WidgetBaseGauge } from '../gc-widget-base/gc-widget-base-gauge';

type TickElement = {
    tick: string;
    tickStrokeWidth: number;
    major: boolean;

    label?: string;
    labelAnchor: string;
    labelX: number;
    labelY: number;
};

const angleRange = 300;
const startAngle = 150;

/**
 * `gc-widget-gauge` displays a value using a needle on a circular dial like an analogue-style meter.
 *
 * @label Gauge
 * @group Instruments
 * @css --gc-background-color | The gauge background color | { "kind": "color" }
 * @css --gc-detail-value-background-color | The detail value background color | { "kind": "color" }
 * @css --gc-detail-value-font-color | The detail value font color | { "kind": "color" }
 * @css --gc-font-color | The tick labels font color | { "kind": "color" }
 * @css --gc-font-size | The tick labels font size (px)
 * @css --gc-major-tick-color | The major tick marks color | { "kind": "color" }
 * @css --gc-needle-color | The needle color | { "kind": "color" }
 * @css --gc-ring-color | The color for the ring surrounding the gauge face | { "kind": "color" }
 * @css --gc-tick-color | The minor tick marks color | { "kind": "color" }
 * @css --gc-tick-style | The major tick style | { "kind": "select", "options": ["", "bold", "long"]}
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-gauge',
    styleUrl: 'gc-widget-gauge.scss',
    shadow: true
})
export class WidgetGauge implements WidgetBaseGaugeProps, WidgetBaseTooltipProps, WidgetBaseTitleProps, WidgetBaseDisabledProps {
    private base = new ( // keep on separate line to enable source mapping
        class extends WidgetBaseGauge {
            get gauge() {
                return this.parent as WidgetGauge;
            }

            get element() {
                return this.gauge.el;
            }
        })(this);

    /**
     * Controls whether the gauge has a detail value or not.
     * @order 5
     */
    @Prop() hasDetailValue: boolean;

    /**
     * The detail value.
     * @order 6
     */
    @Prop() detailValue: string;

    /**
     * The number of ticks for each value increment of 1 (can be fractional)
     * @order 7
     */
    @Prop() numTicksPerUnit: number = 1;

    /**
     * The number of ticks between each major tick.
     * @order 8
     */
    @Prop() numTicksPerNumberLabel: number = 10;

    /**
     * The number of ticks before the first major tick.
     * @order 9
     */
    @Prop() numTicksToFirstLabel: number = 0;

    render() {
        const tickElements = this.createTicks();
        const percentFullScale = (this.base.value - this.base.minValue) / (this.base.maxValue - this.base.minValue);
        const needleRotation = (percentFullScale * angleRange ) + startAngle + 60;

        // JSXON
        return this.base.render(
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">

                {/* face and ring */}
                <g id="face-layer">
                    <ellipse id="outer-circle" ry="50" rx="50" cy="25" cx="25" />
                    <ellipse id="inner-circle" ry="44" rx="44" cy="25" cx="25" />
                </g>

                {/* ticks and labels */}
                <g id="scale-layer">
                    {
                        tickElements?.map((element) => {
                            return [
                                <path class={ element.major ? 'major' : undefined } d={ element.tick } stroke-width={ element.tickStrokeWidth } />,
                                element.label ? <text x={ element.labelX } y={ element.labelY } text-anchor={ element.labelAnchor }>{ element.label }</text> : undefined
                            ];
                        })
                    }
                </g>

                {/* titles and detailValue */}
                <g id="label-layer">
                    <clipPath id="detail-value-clip-path"><rect x="38" y="60" width="30" height="8" /></clipPath>
                    <clipPath id="main-title-clip-path"><rect x="32" y="26" width="36" height="10" /></clipPath>
                    <clipPath id="sub-title-clip-path"><rect x="32" y="32" width="36" height="10"/></clipPath>

                    <g clip-path="url(#main-title-clip-path)"><text id="main-title" x="50" y="32">{ this.mainTitle }</text></g>
                    <g clip-path="url(#sub-title-clip-path)"><text id="sub-title" x="50" y="40">{ this.subTitle }</text></g>

                    {
                        this.hasDetailValue ? [
                            <rect id="detail-value-background" x="35" y="60" width="30" height="8" />,
                            <g clip-path="url(#detail-value-clip-path)"><text id="detail-value" x="63" y="65.55">{ this.detailValue }</text></g>
                        ] : undefined
                    }
                </g>

                {/* needle */}
                <g id="needle-layer">
                    <circle cx="0" cy="0" r="3" />
                    <path style={{ transform: `rotate(${needleRotation}deg)` }} d="m -1.19,-2.7 1.19,-39.83 1.19,39.83 -1.19,2.7 z" />
                </g>
            </svg>,
            { caption: this.caption, infoText: this.infoText, tooltip: this.tooltip }
        );
        // JSXOFF
    }

    @Listen('css-property-changed')
    onCSSPropertyChanged(ev: CustomEvent) {
        if (ev.detail.name === '--gc-tick-style') {
            this.refresh();
        }
    }

    private getTickProperties(tickNumber: number, numTicks: number, majorTick: boolean, halfwayTick: boolean, value: number, majorTickStyle: string, fontSize: number): TickElement {
        let labelAnchor = 'start';
        let tickStrokeWidth = 0.2;

        let tickLength = 6;
        if (!majorTick) {
            if (halfwayTick) {
                switch (majorTickStyle) {
                    case 'bold':
                        tickLength = 2;
                        tickStrokeWidth = 0.45;
                        break;
                    default:
                        tickLength = 4;
                }
            } else {
                tickLength = 2;
            }
        } else {
            switch (majorTickStyle) {
                case 'bold':
                    tickLength = 2;
                    tickStrokeWidth = 0.9;
                    break;
                default:
                    tickLength = 4;
            }
        }

        const minAngle = -240;
        const yOffset = 50;
        const xOffset = 50;
        const startRadius = 42;
        const endRadius = startRadius - tickLength;
        const labelRadius = endRadius - 4;
        const angle = (((angleRange / numTicks) * tickNumber + minAngle) % 360) * Math.PI / 180;
        const cosAngle = Math.cos(angle);
        const sinAngle = Math.sin(angle);
        const xStart = xOffset + cosAngle * startRadius;
        const xEnd = xOffset + cosAngle * endRadius;
        const yStart = yOffset + sinAngle * startRadius;
        const yEnd = yOffset + sinAngle * endRadius;

        if (tickNumber > numTicks * 0.7) {
            labelAnchor = 'end';
        } else if (tickNumber > numTicks * 0.3) {
            labelAnchor = 'middle';
        }

        return {
            tick: `M ${xStart} ${yStart} L ${xEnd} ${yEnd} z`,
            tickStrokeWidth: tickStrokeWidth,
            major: majorTick,
            label: majorTick ? Number(value).toFixed(this.precision) : '',
            labelAnchor: labelAnchor,
            labelX: xOffset + cosAngle * labelRadius,
            labelY: yOffset + sinAngle * labelRadius + (+fontSize) / 2
        };
    }

    private createTicks(): TickElement[] {
        const minValue = this.base.minValue;
        const maxValue = this.base.maxValue;
        if (minValue < maxValue /*&& this.innerCircle*/) {
            const majorTickStyle = this.base.getCSSProperty('--gc-tick-style');
            const fontSize = +(this.base.getCSSProperty('--gc-font-size') || '4.75px').replace(/px/, '');
            const incr = 1 / this.numTicksPerUnit;
            const numTicks = (maxValue - minValue) * this.numTicksPerUnit;

            let value = minValue;
            let majorTick = false;
            let halfwayTick = false;

            const result = [];
            for (let i = 0; i <= numTicks; ++i) {
                if ((i >= this.numTicksToFirstLabel) && (((i - this.numTicksToFirstLabel) % this.numTicksPerNumberLabel) === 0)) {
                    majorTick = true;
                    halfwayTick = false;
                } else {
                    majorTick = false;
                    halfwayTick = (
                        (this.numTicksPerNumberLabel % 2 === 0) &&
                        (i >= this.numTicksToFirstLabel) && (i - this.numTicksToFirstLabel) % (this.numTicksPerNumberLabel / 2) === 0
                    ) ? true : false;
                }

                result.push(this.getTickProperties(i, numTicks, majorTick, halfwayTick, value, majorTickStyle, fontSize));
                value += incr;
            }

            return result;
        }
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
