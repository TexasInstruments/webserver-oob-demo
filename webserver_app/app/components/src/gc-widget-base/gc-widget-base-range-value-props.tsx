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
import { Prop, Event, EventEmitter } from '@stencil/core';
import { WidgetBaseIntermediateValueProps } from './gc-widget-base-intermediate-value-props';

export class WidgetBaseRangeValueProps extends WidgetBaseIntermediateValueProps {
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
}
