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

import { Component, h, Prop, Event, EventEmitter, Watch, Method, Element } from '@stencil/core';
import { GcWidgetPlotDataBaseProps, IPlotDataBaseSeries, IPlotValueEvent } from './gc-widget-plot-data-base-props';

/**
 * An internal interface that describes a scatter data series inside a plot.
 * @hidden
 */
interface ISeries extends IPlotDataBaseSeries {
    mode?: string;
    x: number[];
    y: number[];
    line?: {
        color?: string;
        width?: number;
        shape?: string;
        dash?: string;
    };
    fill?: string;
    fillcolor?: string;
}

/**
 * `gc-widget-plot-data-points-2d` specifies how a scatter data series is plotted.
 *
 * @usage
 * @label Scatter Data
 * @group Graphs
 * @archetype <gc-widget-plot-data-points-2d id="data2d"></gc-widget-plot-data-points-2d>
 * @css --gc-marker-color | Marker color | Auto assigned
 * @css --gc-marker-size | Marker size (px) | 6
 * @css --gc-marker-line-color | Marker line color | Auto assigned
 * @css --gc-marker-line-width | Marker line width (px) | 0
 * @css --gc-line-color | Line color | Auto assigned
 * @css --gc-line-width | Line width (px) | 2
 * @css --gc-fill-color | Fill color | Auto assigned
 */
@Component({
    tag: 'gc-widget-plot-data-points-2d',
})

export class GcWidgetPlotDataPoints2d implements GcWidgetPlotDataBaseProps {
    private series: ISeries = {
        type: 'scattergl',
        x: [],
        y: [],
        marker: {
            line: {}
        },
        line: {},
    };
    private cssPropertyNameToSetterMap = {
        '--gc-marker-color': (value: string) => this.series.marker.color = value,
        '--gc-marker-size': (value: string)  => this.series.marker.size = +value || 6,
        '--gc-marker-line-color': (value: string) => {
            this.series.marker.line = this.series.marker.line || {};
            this.series.marker.line.color = value;
        },
        '--gc-marker-line-width': (value: string) => {
            this.series.marker.line = this.series.marker.line || {};
            this.series.marker.line.width = +value || 0;
        },
        '--gc-line-color': (value: string) => this.series.line.color = value,
        '--gc-line-width': (value: string) => this.series.line.width = +value || 2,
        '--gc-fill-color': (value: string) => this.series.fillcolor = value
    };

    /**
     * Specifies the 2-d data points [x, y][].
     * If implicitX is true, data points is y[].
     *
     * @order 20
     */
    @Prop()
    point: (number[] | number)[];

    /**
     * Specifies whether x values are implicit, and so data points is y[].
     *
     * @order 21
     */
    @Prop()
    implicitX: boolean = false;

    /**
     * Streaming data listener for the 'point' binding.
     * @param value If implicitX is true, value is either a number representing
     * y, or a number[] representing y[].
     * Otherwise, value is a number[] representing [x,y],
     * or a number[][] representing [x,y][]
     */
    pointStreamingDataListener(value: number | number[] | number[][]) {
        let copyStartIndex = 0;
        let newValue: (number[] | number)[];
        if (!Array.isArray(value)) {
            newValue = [value];
        } else if (!this.implicitX && !Array.isArray(value[0])) {
            newValue = [value as number[]];
        } else {
            newValue = value;
        }
        if (this.capacity === undefined || this.capacity === 0) {
            this.series.x = this.implicitX ? undefined : [];
            this.series.y = [];
        } else {
            const deleteCount = this.series.y.length + newValue.length - this.capacity;
            if (this.implicitX) {
                this.series.x = undefined;
                if (deleteCount > 0) {
                    this.series.y.splice(0, deleteCount);
                }
            } else if (this.series.x === undefined) {
                // Just in case that it is changing from implicit x to explicit x, and
                // x was undefined, and y already had some data, this is to ensure
                // both x and y has same length after all.
                this.series.x = [];
                this.series.y = [];
            } else if (deleteCount > 0) {
                this.series.x.splice(0, deleteCount);
                this.series.y.splice(0, deleteCount);
            }
            copyStartIndex = (newValue.length < this.capacity) ? 0 : newValue.length - this.capacity;
        }
        if (this.implicitX) {
            for (let i = copyStartIndex; i < newValue.length; i++) {
                this.series.y.push(newValue[i] as number);
            }
        } else {
            for (let i = copyStartIndex; i < newValue.length; i++) {
                this.series.x.push(newValue[i][0]);
                this.series.y.push(newValue[i][1]);
            }
        }
        this.fireData();
    }

    /**
     * Specifies the drawing mode of the scatter data.
     *
     * @order 30
     */
    @Prop()
    mode: 'none' | 'lines' | 'markers' | 'lines+markers' = 'lines';

    @Watch('mode')
    modeHandler(newValue: string) {
        this.series.mode = newValue;
        this.fireData();
    }

    /**
     * Specifies the marker symbol type. Used only if mode is 'markers' or 'lines+markers'.
     * Default maker symbol type is circle.
     *
     * @order 31
     */
    @Prop()
    markerSymbol: string;

    @Watch('markerSymbol')
    markerSymbolHandler(newValue: string) {
        this.series.marker.symbol = newValue;
        this.fireData();
    }

    /**
     * Specifies the line shape. Used only if mode is 'lines' or 'lines+markers'.
     * Default line shape is linear.
     * hv - horizotnal line followed by vertical line
     * vh - vertical line followed by horizontal line
     * hvh - horizotnal line half way, followed by vertical line, and then horizontal line
     * vhv - vertical line half way, followed by horizontal line, and then vertical line
     *
     * @order 41
     */
    @Prop()
    lineShape: 'linear' | 'hv' | 'vh' | 'hvh' | 'vhv' = 'linear';

    @Watch('lineShape')
    lineShapeHandler(newValue: string) {
        this.series.line.shape = newValue;
        this.fireData();
    }

    /**
     * Specifies the line dash type. Used only if mode is 'lines' or 'lines+markers'.
     * Default line dash type is solid.
     *
     * @order 42
     */
    @Prop()
    lineDash: 'solid' | 'dot' | 'dash' | 'longdash' | 'dashdot' | 'longdashdot' = 'solid';

    @Watch('lineDash')
    lineDashHandler(newValue: string) {
        this.series.line.dash = newValue;
        this.fireData();
    }

    /**
     * Sets the area to fill with a color. Used only if mode is 'lines' or 'lines+markers'.
     * Default fill area is none.
     *
     * @order 46
     */
    @Prop()
    fill: 'none' | 'tozeroy' | 'tozerox' | 'tonexty' | 'tonextx' | 'toself' | 'tonext' = 'none';

    @Watch('fill')
    fillHandler(newValue: string) {
        this.series.fill = newValue;
        this.fireData();
    }

    @Watch('capacity')
    capacityHandler(newValue: number, oldValue: number) {
        if (newValue > 0 && this.series.x.length > newValue) {
            const deleteCount = this.series.x.length - newValue;
            this.series.x.splice(0, deleteCount);
            this.series.y.splice(0, deleteCount);
            this.fireData();
        }
    }

    @Watch('legend')
    showLegendHandler(newValue: string) {
        this.series.showlegend = newValue === 'hide' ? false : newValue === 'show' ? true : undefined;
        this.fireData();
    }

    @Watch('legendName')
    legendNameHandler(newValue: string) {
        this.series.name = newValue ?? this.el.id;
        this.fireData();
    }

    /**
     * Modifies a css property of this component. Refer to the component documentation for
     * the supported property names.
     * @param name css property name
     * @param value new value of the specified property.
     */
    @Method()
    async setCSSProperty(name: string, value: string): Promise<void> {
        const setterFunction = this.cssPropertyNameToSetterMap[name];
        if (setterFunction !== undefined) {
            value = value.trim();
            setterFunction(value);
            this.el.style.setProperty(name, value);
            this.fireData();
        }
    }

    /**
     * Get the value of a css property of this component. Refer to the component documentation for
     * the supported property names.
     * @param name css property name
     */
    @Method()
    async getCSSProperty(name: string): Promise<string> {
        return window.getComputedStyle(this.el).getPropertyValue(name);
    }

    private fireData() {
        this.plotValue.emit({ id: this.el.id, series: this.series });
    }

    connectedCallback() {
        this.el['pointStreamingDataListener'] = this.pointStreamingDataListener.bind(this);
    }

    async componentWillLoad() {
        this.series.name = this.legendName ?? this.el.id;
        this.series.showlegend = this.legend === 'hide' ? false : this.legend === 'show' ? true : undefined;
        this.series.mode = this.mode;
        this.series.marker.symbol = this.markerSymbol;
        this.series.line.shape = this.lineShape;
        this.series.line.dash = this.lineDash;
        this.series.fill = this.fill;
        for (const name in this.cssPropertyNameToSetterMap) {
            const value = await this.getCSSProperty(name);
            value && await this.setCSSProperty(name, value);
        }
    }

    // #region gc-widget-plot/gc-widget-plot-data-base-props.tsx:
    // -----------Autogenerated - do not edit--------------
    @Element() el: HTMLElement;

    /**
     * An internal event used by data series to notify its parent plot to plot data.
     * @hidden
     */
    @Event() plotValue: EventEmitter<IPlotValueEvent>;

    /**
     * Specifies the buffer capacity of data points to be accumulated.
     * If the capacity is greater than zero, and when new data points
     * are added to the buffer that exceeds the capacity, old data points
     * will be removed.
     * If the capacity is undefined or zero, new data points will replace all old data points.
     *
     * @order 25
     */
    @Prop()
    capacity: number = 200;

    /**
     * Show or hide the legend of this series. If auto is specified, the plot shows the legend
     * when it has two or more series.
     *
     * @order 60
     */
    @Prop()
    legend: 'auto' | 'show' | 'hide' = 'auto';

    /**
     * Specifies the name of this series shown in legend. By default, the name is
     * same as the id of this component, which disallows space(s) and some other characters.
     * Use this property to specify the name when needed.
     *
     * @order 61
     */
    @Prop()
    legendName: string;

    // #endregion

}
