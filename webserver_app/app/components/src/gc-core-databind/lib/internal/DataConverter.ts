/**
 *  Copyright (c) 2020, 2021 Texas Instruments Incorporated
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
import { bindValueType } from './IBindValue';

export interface IDataConverter {
    convert(input: bindValueType, param?: number): bindValueType;
}

const nullConverter: IDataConverter = {
    convert: function (input) {
        return input;
    }
};

function jsonStringifyConverter(input: bindValueType) {
    try {
        return JSON.stringify(input);
    } catch (e) {
        return '' + input;
    }
}

const converters: { [index: string]: { [index: string]: IDataConverter } } =
{
    'string':
    {
        any: {
            convert: function (input) {
                return '' + input;
            }
        },
        'object': { convert: jsonStringifyConverter }
    },
    'boolean':
    {
        any: {
            convert: function (input) {
                return !!input;
            }
        },
        'string': {
            convert: function (input) {
                return isNaN(+input) ? input.toLowerCase().trim() === 'true' : +input !== 0;
            }
        }
    },
    'number': {
        any: {
            convert: function (input) {
                return +input;
            }
        }
    },
    'array': {
        any: {
            convert: function (input) {
                return input ? ('' + input).split(',').map(function (e) {
                    return +e;
                }) : [];
            }
        }
    }
};

/**
 * Singleton Class to register data converters that will be used by the DataBinder to
 * convert data between bindings of different types.
 *
 */
export class DataConverter {
    /**
	 * Method to register custom data converters to be used by the DataBindiner singleton
	 * to convert data between bindings of different types.
	 *
	 * @static
	 * @param {gc.databind.IDataConverter} converter - data converter to use to convert between the srcType and destType.
	 * @param {string} [srcType] - the type of the source that this converter is to be used on.  If not supplied, then it will
	 * be the default converter for all source types if a specific one cannot be found.
	 * @param {string} destType - the type of the output value from this converter.
	 */
    static register(converter: IDataConverter, destType: string | null, srcType: string = 'any') {
        if (destType !== null) {
            let destConverters = converters[destType];
            if (!destConverters) {
                destConverters = {};
                converters[destType] = destConverters;
            }

            destConverters[srcType] = converter;
        }
    }

    /**
	 * Method to retrieve the converter for converting one source type to another destination type.
	 *
	 * @static
	 * @param {string} [srcType] - the type of the source that this converter is to be used on.  If not supplied, then it will
	 * be the default converter for all source types if a specific one cannot be found.
	 * @param {string} destType - the type of the output value from this converter.
	 * @return {gc.databind.IDataConverter} - the converter found or undefined if not found.
	 */
    static getConverter(srcType: string | undefined, destType: string): IDataConverter | undefined {
        let converter = nullConverter;
        const destConverters = converters[destType];
        if (destConverters !== undefined) {
            converter = destConverters[srcType || 'any'];
            if (converter === undefined) {
                converter = destConverters.any;
            }
        }
        return converter;
    }

    /**
	 * Method to convert an element of data from one data type to another.
	 *
	 * @static
	 * @param {string} [srcType] - the type of the source that this converter is to be used on.  If not supplied, then it will
	 * be the default converter for all source types if a specific one cannot be found.
     * @param {string} destType - the type of the output value required from this conversion.
     * @param {number} param - optional numeric parameter to control the conversion like the precision for decimal and q values.
	 * @return {*} - the converted data or undefined if no converter found.
	 */
    static convert(data: bindValueType, srcType?: string, destType?: string, param?: number): bindValueType {
        if (data === null || data === undefined) {
            return data;  // null is null independent of type, so no conversion required.
        }
        srcType = srcType || typeof data;

        let converter: IDataConverter | undefined;
        if (srcType !== destType && destType !== undefined && destType !== null) {
            converter = this.getConverter(srcType, destType);
        }

        return converter ? converter.convert(data, param) : data;
    }

}

