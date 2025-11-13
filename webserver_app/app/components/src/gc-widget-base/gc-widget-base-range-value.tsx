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
import { WidgetBaseIntermediateValue } from './gc-widget-base-intermediate-value';
import { WidgetBaseRangeValueProps } from './gc-widget-base-range-value-props';

/**
 * `WidgetBaseRangeValue` provides the base implementation for the range value element.
 */
export abstract class WidgetBaseRangeValue extends WidgetBaseIntermediateValue {
    private intermediateLValue: unknown;

    constructor(protected readonly parent: WidgetBaseRangeValueProps) {
        super(parent);
    }

    abstract get lvalue(): unknown;
    abstract onLValueChanged(newValue: unknown, oldValue: unknown): void;

    get minValue() {
        return isNaN(this.parent.minValue) || this.parent.minValue >= this.parent.maxValue ? 0 : this.parent.minValue;
    }

    get maxValue() {
        return isNaN(this.parent.maxValue) || this.parent.minValue >= this.parent.maxValue ? 100 : this.parent.maxValue;
    }

    onIntermediateValueChanged(newValue: unknown, commit: boolean) {
        throw Error('Not supported, call onIntermediateRangeValueChanged.');
    }

    onIntermediateRangeValueChanged(lValue: number, value: number, commit: boolean) {
        super.onIntermediateValueChanged(value, commit);

        if (this.parent.intermediateChanges && (this.intermediateLValue !== lValue)) {
            const oldValue = this.intermediateLValue;
            this.intermediateLValue = lValue;
            this.onLValueChanged(lValue, oldValue);

        } else if (commit && lValue !== this.lvalue) {
            this.onLValueChanged(lValue, this.lvalue);
        }
    }
}