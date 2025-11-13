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
import { IBindValue } from './IBindValue';
import { IQualifierFactory } from './QualifierFactoryMap';
import { IEvents } from '../../../gc-core-assets/lib/Events';
import { IScriptLogEvent } from './IScriptingTarget';

/**
 * Interface that allows clients to obtain references to IBind objects.
 * Both the backplane and all models implement this interface.
 * Bindable object can also implement this interface to provide more bindable objects.
 *
 * Models should inherit from AbstractBindFactory instead of implementing this interface.
 */
export interface IBindFactory extends IEvents {

    /**
     * Returns a bindable object associated with the given name.
     *
     * @param name - expression of binding URIs.
     * @return a reference to the bindable object or null if bindable object
     *          with this name is not supported.
     */
    getBinding(name: string): IBindValue | null;

    /**
     * Creates a bindable object associated with the given name.
     *
     * @param {String} name - uniquely identifying the bindable object within the model.
     * @return {gc.databind.IBind} - the newly created bindable object, or null if this name is not supported.
     */
    createNewBind(name: string): IBindValue | null;

    parseQualifier(uri: string): { bindName: string; qualifier?: IQualifierFactory; param?: number };

    /**
     * Unique identifying name of the model.
     *
     */
    readonly id: string;

    /**
     * Query method to determine if the model is connected or disconnected from a target.
     *
     * @return {boolean} - true if the model is connected to a target, otherwise false.
     */
    isConnected(): boolean;

    /**
     * Helper method to wait for model to be connected to the target.
     */
    whenConnected(): Promise<void>;

    /**
     * Parse the model specific binding expression.
     *
     * @param expression
     */
    parseModelSpecificBindExpression(expression: string): IBindValue | null;

    fireScriptLogEvent(event: IScriptLogEvent): void;

    _ignoreWriteOperationsWhenDisconnected?: boolean;
};
