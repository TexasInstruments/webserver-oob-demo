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
import { Prop, Event, EventEmitter } from '@stencil/core';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';

export class WidgetGridColumnBaseProps extends WidgetBaseProps {
    /**
     * The column heading text for this column in the grid.  For line breaks, use \n to delimit multiple lines.
     * @order 3
     */
    @Prop() heading: string;

    /**
     * The name of the column.  This is used to identify column data in the data provider.
     * @order 2
     */
    @Prop() name: string;

    /**
     * Option to hide the minimize action in the heading of this column so that end users cannot control the minimized state.
     * @order 31
     */
    @Prop() hideMinimizeAction = false;

    /**
     * When true, this column is shown in a minimized state.
     * @order 30
     */
    @Prop({ reflect: true }) minimized = false;

    /**
     * Fired when the minimized state of this column changes.
     **/
    @Event({ eventName: 'minimized-changed' }) minimizedChanged: EventEmitter<{ value: boolean }>;
}
