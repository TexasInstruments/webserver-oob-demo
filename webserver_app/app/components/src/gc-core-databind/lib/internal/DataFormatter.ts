/**
 *  Copyright (c) 2020, Texas Instruments Incorporated
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
import { bindValueType, IBindValue } from './IBindValue';
import { QualifierFactoryMap } from './QualifierFactoryMap';
import { AbstractDataFormatter } from './AbstractDataFormatter';

export interface IDataFormatter {
    readonly operator: string;
    readonly precision?: number;
    readonly formattedType: string;
    readonly unFormattedType?: string;
    formatValue(this: null, value: bindValueType, precision?: number): bindValueType;
    unFormatValue?(this: null, value: bindValueType, precision?: number): bindValueType;
}

export class DataFormatterRegistry {
    static add(formatter: IDataFormatter) {
        const CustomDataFormatter = class extends AbstractDataFormatter {
            operator = formatter.operator;
            formattedType = formatter.formattedType;
            unFormattedType = formatter.unFormattedType;
            formatValue = formatter.formatValue;
            unFormatValue = formatter.unFormatValue;

            constructor(operand: IBindValue, public precision?: number) {
                super(operand);
            }
            static create(bind: IBindValue, param?: number) {
                return new CustomDataFormatter(bind, param);
            }
        };

        QualifierFactoryMap.add(formatter.operator, CustomDataFormatter);
    };
};