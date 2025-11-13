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
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS'
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
import { GcUtils } from './GcUtils';

/**
 * A callback function that return a list of possible autofill options for the given property name.
 */
export type GetAutoFillOptionsHandler = () => Promise<string[]>;

/**
 * IPropertyAutoFill interface.
 */
export interface IPropertyAutoFill {
    /**
     * Registers an autofill handler for the given property name. If there are multiple handlers,
     * one can chain the register calls together.
     *
     * For example:
     *     createPropertyAutoFill(this.el).register(propertyName1, handler1).register(propertyName2, handler2);
     *
     * @param propertyName the property name
     * @param handler the handler
     * @see createPropertyAutoFill
     */
    register(propertyName: string, handler: GetAutoFillOptionsHandler): IPropertyAutoFill;

    /**
     * Unregister the autofill handler for the given property name. If there are multiple handlers,
     * one can chain the unregister calls together.
     *
     * @param propertyName the property name
     */
    unregister(propertyName: string): IPropertyAutoFill;
}

class PropertyAutoFillImpl implements IPropertyAutoFill {
    private handlers = new Map<string, GetAutoFillOptionsHandler>();

    constructor(element: HTMLElement) {
        if (GcUtils.isInDesigner) {
            // @ts-ignore
            element['designerGetPropertyAutoFillOptions'] = async (propertyName: string) => {
                const handler = this.handlers.get(propertyName);
                if (handler) {
                    return await handler();
                }
            };
        }
    }

    register(propertyName: string, handler: GetAutoFillOptionsHandler): IPropertyAutoFill {
        if (this.handlers.get(propertyName)) {
            throw Error(`${propertyName} is already registered.`);
        }

        this.handlers.set(propertyName, handler);
        return this;
    }

    unregister(propertyName: string): IPropertyAutoFill {
        this.handlers.delete(propertyName);
        return this;
    }
}

/**
 * Creates a property autofill object to handle Designer property autofill callback.
 * @param element the HTML element
 */
export const createPropertyAutoFill = (element: HTMLElement): IPropertyAutoFill => {
    return new PropertyAutoFillImpl(element);
};