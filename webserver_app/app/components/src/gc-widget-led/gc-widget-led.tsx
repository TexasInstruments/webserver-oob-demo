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
import { Component, Method, h, Watch, Prop, Event, EventEmitter, Element, Listen } from '@stencil/core';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';

/**
 * `gc-widget-led` is a bindable version of the <led> html element.
 * The LED widget displays a boolean value by 'lighting up' when the value is `true` and
 * 'turning off' when it is `false`. The on value is a boolean value (`true`/`false`).
 *
 * @label LED
 * @group Status Indicators
 * @css --gc-on-color | Led on color | #ff0000 { "kind": "color" }
 * @css --gc-off-color | Led off color | #63666a { "kind": "color" }
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-led',
    styleUrl: 'gc-widget-led.scss',
    shadow: true
})
export class WidgetLed implements WidgetBaseProps, WidgetBaseTooltipProps, WidgetBaseTitleProps, WidgetBaseDisabledProps {
    private oldOn: boolean;
    private base = new ( // keep on separate line to enable source mapping
        class extends WidgetBase {
            get element() {
                return this.led.el;
            }

            get led() {
                return this.parent as WidgetLed;
            }
        })(this);

    /**
     * The LED active state. When true, turns the LED 'on'.
     * @order 2
     */
    @Prop({ reflect: true }) on: boolean;

    /**
     * When true, turns the LED glow gradient 'on'.
     * @order 3
     */
    @Prop({ reflect: true }) glow: boolean = true;

    @Watch('on')
    onOnChanged(newValue: boolean, oldValue: boolean) {
        if (!this.disabled && (newValue !== this.oldOn)) {
            this.oldOn = newValue;
        } else {
            this.on = this.oldOn;
        }
    }

    componentWillLoad() {
        this.oldOn = this.on;
    }

    render() {
        // JSXON
        return this.base.render(
            <div id="top">
                <svg width="100%" height="100%" viewBox="0 0 80 80" preserveAspectRatio="xMidYMid meet" id="led-wrapper">
                    {/* led shadow (grey) */}
                    <g
                        transform="translate(4.3915046,4.8449881)"
                        id="led-shadow-grey">
                        <path
                            id="led_shadow_path"
                            d="m 57.281661,35.520848 c 0,11.693806 -9.436019,21.19661 -21.129748,21.279304 -11.69373,0.08269 -21.263201,-9.285718 -21.428582,-20.978355 -0.165383,-11.692636 9.18499,-21.576404 20.826686,-21.575994 11.694023,4.1e-4 21.939035,9.13316 21.772824,21.219838" />
                    </g>
                    {/* led residual shine (outer circle) */}
                    <g
                        id="led-residual-shine"
                        class="css-bind">
                        <path
                            id="led_res_path"
                            d="m 61.673165,40.365836 c 0,11.693806 -9.436019,21.19661 -21.129748,21.279304 -11.69373,0.08269 -21.263201,-9.285718 -21.428582,-20.978355 -0.165383,-11.692636 9.18499,-21.576404 20.826686,-21.575994 11.694023,4.1e-4 21.939035,9.13316 21.772824,21.219838" />
                    </g>
                    {/* led lit color (main circle)  */}
                    <g
                        transform="translate(25.3915046,25.8449881)"
                        id="led-lit-color"
                        class="css-bind">
                        <path
                            id="led_path"
                            transform="scale(0.4,0.4)"
                            d="m 76.355601,35.518697 c 0,22.185856 -17.902315,40.21487 -40.088026,40.371759 C 14.081864,76.047345 -4.0736375,58.273303 -4.3874056,36.089666 -4.7011736,13.906029 13.038647,-4.8457656 35.12564,-4.8449881 57.311908,-4.8442107 76.749061,12.482731 76.433728,35.413956" />
                    </g>
                    {/* glow circle */}
                    <g
                        transform="translate(-28,-28)"
                        id="glow-circle"
                        class="css-bind">
                        <path
                            id="glow_path"
                            transform="scale(1.7,1.7)"
                            d="m 60.588751,40.365959 c 0,11.097298 -8.954684,20.115356 -20.051908,20.193831 C 29.439617,60.63826 20.358289,51.747744 20.201344,40.651556 20.044398,29.555368 28.917803,20.175778 39.965649,20.176167 c 11.097504,3.88e-4 20.81991,8.667271 20.662181,20.1374" />
                    </g>
                </svg>
            </div>,
            { caption: this.caption, infoText: this.infoText, tooltip: this.tooltip }
        );
        // JSXOFF
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
