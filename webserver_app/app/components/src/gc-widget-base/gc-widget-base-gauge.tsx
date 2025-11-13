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
import { WidgetBase } from './gc-widget-base';
import { WidgetBaseGaugeProps } from './gc-widget-base-gauge-props';

/**
 * `WidgetBaseGauge` provides the base implementation for the gauge element.
 */
export abstract class WidgetBaseGauge extends WidgetBase {
    constructor(protected readonly parent: WidgetBaseGaugeProps) {
        super(parent);
    }

    get minValue() {
        return isNaN(this.parent.minValue) || this.parent.minValue >= this.parent.maxValue ? 0 : this.parent.minValue;
    }

    get maxValue() {
        return isNaN(this.parent.maxValue) || this.parent.minValue >= this.parent.maxValue ? 100 : this.parent.maxValue;
    }

    get value() {
        if (isNaN(this.parent.value)) return this.minValue;
        if (this.parent.value < this.minValue) return this.minValue;
        if (this.parent.value > this.maxValue) return this.maxValue;
        return this.parent.value;
    }

    getCSSProperty(name: string) {
        return getComputedStyle(this.parent.el).getPropertyValue(name).trim();
    }
}