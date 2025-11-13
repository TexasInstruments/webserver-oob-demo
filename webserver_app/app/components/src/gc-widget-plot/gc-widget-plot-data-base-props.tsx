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

import { Prop, Element, Event, EventEmitter } from '@stencil/core';

/**
 * An internal interface that describes a data series inside a plot.
 * @hidden
 */
export interface IPlotDataBaseSeries {
    name?: string;
    type: string;
    marker?: {
        color?: string;
        size?: number;
        symbol?: string;
        line?: {
            color?: string;
            width?: number;
        };
    };
    showlegend?: boolean;
}

/**
 * An internal interface used by data series to describe the details
 * of an internal event about notifying its parent plot for plotting data.
 * @hidden
 */
export interface IPlotValueEvent {
    id: string;
    series: IPlotDataBaseSeries;
}

export class GcWidgetPlotDataBaseProps {
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

}

