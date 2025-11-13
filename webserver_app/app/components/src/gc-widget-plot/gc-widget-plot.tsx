/**
 *  Copyright (c) 2021, Texas Instruments Incorporated
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

import { Component, h, Element, Prop, Watch, Listen, Method, Event, EventEmitter } from '@stencil/core';
import '../gc-widget-plot/internal/plotly.min.js'
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { IPlotDataBaseSeries, IPlotValueEvent } from './gc-widget-plot-data-base-props';

const Plotly = window.Plotly;

declare global {
    interface Window {
        Plotly: {
            react(...args: any[]); // eslint-disable-line @typescript-eslint/no-explicit-any
            relayout(...args: any[]); // eslint-disable-line @typescript-eslint/no-explicit-any
        };
    }
}

function getComputedSize(attr) {
    return (typeof attr === 'string') && (attr.substr(attr.length - 2) === 'px') && parseFloat(attr);
}

/**
 * An internal interface that describes the layout of a plot.
 * @hidden
 */
interface ILayout {
    title?: string;
    datarevision?: number;
    barmode?: 'stack' | 'group' | 'overlay' | 'relative';
}

/**
 * An internal interface that describes a plot.
 * @hidden
 */
interface IPlotObject {
    data?: IPlotDataBaseSeries[];
    layout?: ILayout;
}

/**
 * `gc-widget-plot` provides plotting of data.
 *
 * @usage
 * @demo
 * @label Plot
 * @group Graphs
 * @isContainer
 */
@Component({
    tag: 'gc-widget-plot',
    styleUrl: 'gc-widget-plot.scss',
    shadow: true
})

export class GcWidgetPlot implements WidgetBaseProps {
    private plotDiv: HTMLDivElement & IPlotObject;
    private resizeObserver: ResizeObserver;
    private traceMap: {[id: string]: number} = {};
    private base = new (
        class extends WidgetBase {
            get element() {
                return this.parent.el;
            }
        }
    )(this);

    connectedCallback() {
        this.resizeObserver = new ResizeObserver(() => {
            if (this.plotDiv !== undefined && this.plotDiv.layout !== undefined) {
                const computedStyle = window.getComputedStyle(this.el);
                const width = getComputedSize(computedStyle.width);
                const height = getComputedSize(computedStyle.height);
                Plotly.relayout(this.plotDiv, { width, height });
            }
        });
        this.resizeObserver.observe(this.el);
    }

    disconnectedCallback() {
        this.resizeObserver.disconnect();
    }

    async componentDidLoad() {
        const computedStyle = window.getComputedStyle(this.el);
        const width = getComputedSize(computedStyle.width);
        const height = getComputedSize(computedStyle.height);
        if (width > 0) this.plotDiv.style.width = computedStyle.width;
        if (height > 0) this.plotDiv.style.height = computedStyle.height;

        const dataChildren = this.el.children;
        const data = [];
        for (let idx = 0; idx < dataChildren.length; idx++) {
            this.traceMap[dataChildren[idx].id] = idx;
            data[idx] = {};
        }
        await Plotly.react(this.plotDiv,
            data,
            {
                title: this.plotTitle,
                xaxis: {
                    title: this.xAxisTitle
                },
                yaxis: {
                    title: this.yAxisTitle
                },
                datarevision: 1
            },
            {
                displaylogo: false,
                autosizable: true
            }
        );
    }

    render() {
        // JSXON
        return this.base.render(
            <div ref={ (el) => this.plotDiv = el }>
            </div>
        );
        // JSXOFF
    }

    @Listen('plotValue')
    plotValueHandler(event: CustomEvent<IPlotValueEvent>) {
        if (this.plotDiv !== undefined && this.plotDiv.data !== undefined) {
            const data = this.plotDiv.data;
            const layout = this.plotDiv.layout;
            layout.datarevision += 1;
            const index = this.traceMap[event.detail.id];
            data[index] = event.detail.series;
            Plotly.react(this.plotDiv, data, layout);
        }
    }

    /**
     * Specifies the plot title
     *
     * @order 20
     */
    @Prop()
    plotTitle = 'Plot Title';

    @Watch('plotTitle')
    plotTitleHandler(newValue: string) {
        if (this.plotDiv !== undefined) {
            Plotly.relayout(this.plotDiv, { title: newValue });
        }
    }

    /**
     * Specifies the x-axis title
     *
     * @order 20
     */
    @Prop()
    xAxisTitle = 'X-Axis Title';

    @Watch('xAxisTitle')
    xAxisTitleHandler(newValue: string) {
        if (this.plotDiv !== undefined) {
            Plotly.relayout(this.plotDiv, { 'xaxis.title': newValue });
        }
    }

    /**
     * Specifies the y-axis title
     *
     * @order 20
     */
    @Prop()
    yAxisTitle = 'Y-Axis Title';

    @Watch('yAxisTitle')
    yAxisTitleHandler(newValue: string) {
        if (this.plotDiv !== undefined) {
            Plotly.relayout(this.plotDiv, { 'yaxis.title': newValue });
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

}
