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
import { AbstractBindValue } from './AbstractBindValue';
import { ILookupBindValue, indexValueType } from './ILookupBindValue';
import { bindValueType } from './IBindValue';

/**
 * Abstract class that implements ILookupBindValue interface. Clients can either
 * instantiate this class directly or create classes derived from it for
 * their value bindable object.
 *
 * @constructor
 * @extends gc.databind.AbstractBindValue
 * @implements gc.databind.ILookupBindValue
 * @param {string} [defaultType] - the default type, used only if value is null.
 */
export abstract class AbstractLookupBindValue extends AbstractBindValue implements ILookupBindValue {
    protected indexValues: indexValueType[] = [];
    constructor(defaultType?: string) {
        super(defaultType);
    };
    /**
	 * Implementation of the ILookupBindValue.setIndex.  This implementation keeps track of the
	 * index(es) and calls the abstract method onIndexChanged() when any
	 * index value(s) change.  The getIndex() method can be used to retrieve the index
	 * values inside the onIndexChanged() method to re-evaluate the model data's location
	 * and possibly it's new value.
	 *
	 * @param {...number|string} index - one or more new index values to use for lookup
	 */
    setIndex(...indecies: indexValueType[]) {
        let changed = false;

        let i = 0;
        for (; i < indecies.length && i < this.indexValues.length; i++) {
            const oldIndex = this.indexValues[i];
            const newIndex = indecies[i];
            // eslint-disable-next-line eqeqeq
            if (oldIndex != newIndex) {
                this.indexValues[i] = newIndex;
                changed = true;
            }
        }
        for (; i < indecies.length; i++) {
            this.indexValues.push(indecies[i]);
            changed = true;
        }
        if (changed) {
            this.onIndexChanged(this.indexValues);
        }
    };

    /**
	 * Notification method to override that is called when any one of the multi-dimensional
	 * indecies have changed.  Implement this method to re-calcualate the location of the
	 * model data that is to be bound by this binding.  Call setValue() to update this bindings
	 * value and notify listeners if the value has changed due to the change in index.
	 *
	 * @abstract
	 * @param {Array.number|string} indices - the multi-dimensional index values to use for lookup.
	 * @return the new calculated value based on the new indices.  Will be used to update binding value and notify listeners.
	 */
    abstract onIndexChanged(indices: indexValueType[]): void;

    getIndex() {
        return this.indexValues;
    };

    protected assertNotNull(index: indexValueType) {
        if (index === null || index === undefined) {
            throw new Error('The index value is null.');
        }
    };

    protected assertValidArrayIndex(index: indexValueType, size: number = 1, startIndex: number = 0) {
        this.assertNotNull(index);

        const indexValue = +index;
        if (isNaN(indexValue)) {
            throw new Error(`The index is not valid. Cannot convert '${index}' to an integer.`);
        }

        const endIndex = size + startIndex - 1;

        if (indexValue < startIndex || indexValue > endIndex) {
            throw new Error(`The index ${indexValue} is out of bounds.  It must be between ${startIndex} and ${endIndex}`);
        }

        return indexValue;
    };

    protected assertValidFieldName(fieldName: string, possibleFieldNames?: object) {
        this.assertNotNull(fieldName);

        fieldName = fieldName.toString();

        // eslint-disable-next-line no-prototype-builtins
        if (possibleFieldNames === undefined || !possibleFieldNames.hasOwnProperty(fieldName)) {
            throw new Error(`The index '${fieldName}' was not found.`);
        }
        return fieldName;
    };

    protected assertValidData(index: indexValueType, data?: bindValueType) {
        this.assertNotNull(index);

        if (data === undefined) {
            throw new Error(`The index '${index}' was not found.`);
        }
    };
};
