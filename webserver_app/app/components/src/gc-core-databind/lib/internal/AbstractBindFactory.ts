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
import { IBindFactory } from './IBindFactory';
import { VariableBindValue } from './VariableBindValue';
import { QualifierFactoryMap, IQualifierFactory } from './QualifierFactoryMap';
import { IScriptingTarget, scriptValueType, IScriptLogEvent, scriptLogEventType } from './IScriptingTarget';
import { IBindValue, bindValueType } from './IBindValue';
import { IDisposable } from './IDisposable';
import { AbstractBindProvider } from './AbstractBindProvider';
import { IBindProvider } from './IBindProvider';
import { ProgressCounter } from './ProgressCounter';
import { Events } from '../../../gc-core-assets/lib/Events';
import { GcPromise, IDeferedPromise } from '../../../gc-core-assets/lib/GcPromise';

const TARGET_CONNECTED_BINDNAME = '$target_connected';

class ModelBindProvider extends AbstractBindProvider implements IDisposable {
    constructor(private model: IBindFactory) {
        super(new Map<string, IBindValue | null>([['this', new VariableBindValue(undefined)]]));
    }

    parseModelFromBinding(name: string): { model: IBindFactory; bindName: string } {
        return { model: this.model, bindName: name };
    }
}

/**
 * Abstract class that provides default implementation of IBindFactory.  This class
 * implements the getName() method for IBindFactory.
 *
 * @constructor
 * @implements gc.databind.IBindFactory
 * @param {string} id - uniquely identifiable name for this bind factory.
*/
export abstract class AbstractBindFactory extends Events implements IBindFactory, IScriptingTarget {
    private modelQualifiers = new QualifierFactoryMap();
    protected modelBindings: Map<string, IBindValue | null>;

    constructor(readonly id: string) {
        super();
        this.modelBindings = new Map<string, IBindValue>();
        this.modelBindings.set(TARGET_CONNECTED_BINDNAME, new VariableBindValue(false, true));
    }

    abstract createNewBind(name: string): IBindValue | null;

    getBinding(name: string): IBindValue | null {
        // ensure aliased bindings like "uart.temp" and "target_dev.temp" return the same instance of the model's binding.
        // We do this by storing model bindings in the model factory so we can lookup aliased bindings.
        let bind: IBindValue | null = this.modelBindings.get(name) || null;
        if (!bind) {
            bind = this.createNewBind(name);
            if (bind) {
                bind.name = name;
            }
            this.modelBindings.set(name, bind);
        }
        return bind;
    }

    hasBinding(bindingName: string) {
        return this.modelBindings.has(bindingName);
    }

    getAllBindings() {
        return this.modelBindings;
    }

    parseModelFromBinding(uri: string): { model: IBindFactory; bindName: string } {
        return { model: this, bindName: uri };
    }

    parseQualifier(uri: string) {
        return this.modelQualifiers.getQualifier(uri);
    }

    /**
     * Method to set the connected or disconnected state of the model.  This method
     * is called by the transport when a connecting is established or broken.  The connected
     * state is available as a binding, "$target_connected", to app developers if they
     * need to show the connected state of a transport.
     * This method must be called once from the concrete class instance's constructor.
     *
     * @param {boolean} newState - true if to set state to connected, otherwise new state is disconnected.
     */
    protected setConnectedState(newState: boolean) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.modelBindings.get(TARGET_CONNECTED_BINDNAME)!.updateValue(newState);

        if (newState && this.connectDeferred) {
            this.connectDeferred.resolve();
            this.connectDeferred = undefined;
        }
    }

    /**
     * Query method to determine if the model is connected or disconnected from a target.
     *
     * @return {boolean} - true if the model is connected to a target, otherwise false.
     */
    isConnected(): boolean {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.modelBindings.get(TARGET_CONNECTED_BINDNAME)!.getValue();
    }

    /**
     * Method to register model specific qualifiers.  Qualifiers are registered by name with a factory method
     * for creating the qualifier on demand.  To use a qualifier on a binding, append '.$' plus the name of the
     * qualifier with an optional numeric argument; for example, "mybind.$q7" would apply the "q" value qualifier with 7 fractional bits.
     * All qualifiers can have an optional single value numeric argument.  This means that the qualifier name cannot end with numeric characters;
     * otherwise, they will be parsed as an argument instead of the qualifier name.  All models have the default "q", "hex", "dec", etc..., number
     * formatting qualifiers already registered.  Use this method to register additional, model specific qualifiers.
     *
     *
     * @param {string} name - the name of the qualifier, without the '.$' prefix.
     * @param {gc.databind.AbstractBindFactory#qualifierFactoryMethod} factory - the factory method to create the qualifier on a specific binding.
     */
    protected addQualifier(name: string, factory: IQualifierFactory) {
        this.modelQualifiers.add(name, factory);
    }

    private connectDeferred?: IDeferedPromise<void>;

    /**
     * Helper method to get a promise that is resolved when the model is connected to a target.
     * Derived classes should use this to delay accessing the target until the model is connected.
     *
     * @return {promise} - a promise that is either already resolved, or will resolve the next time
     * the model is connected to a target through a transport.
     */
    whenConnected(): Promise<void> {
        this.connectDeferred = this.connectDeferred || GcPromise.defer<void>();
        return this.connectDeferred.promise;
    }

    /**
     * Implementation for reading value from the target.
     *
     * @protected
     * @param {string} uri - the name of the binding to read
     * @return {Promise} - a promise that resolves to the value read.
     */
    scriptRead(uri: string): Promise<scriptValueType> {
        const binding = this.getBinding(uri);
        if (binding) {
            return Promise.resolve(binding.getValue());
        } else {
            return Promise.reject(`Failed to read value since bind "${uri}" does not exist.`);
        }
    }

    /**
     * Implementation for writing value to the target.
     *
     * @protected
     * @param {string} uri - the name of the binding to write
     * @param {Object} value - the value to write
     * @return {Promise} - that resolves when the write operation has completed.
     */
    async scriptWrite(uri: string, value: scriptValueType): Promise<void> {
        const binding = this.getBinding(uri);
        const progress = new ProgressCounter();
        if (binding) {
            binding.setValue(value, progress, true);
            progress.done();
            await progress.promise;
        } else {
            return Promise.reject(`Failed to write value since bind "${uri}" does not exist.`);
        }
    }

    /**
     * Sub-class can override this method to expose method that can be invoked by the scripting engine.
     *
     * @protected
     * @param {String} method - name of the method to invoke from the script
     * @param {Object[]} args - array of arguments to pass to the method
     * @param {String} [inf] - name of the interface to invoke the method, if appropriate.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    invokeMethod(method: string, args: string[], interfaceName: string): Promise<scriptValueType> {
        return Promise.reject(`Failed to invoke ${method} method.`);
    }

    private bindProvider?: IBindProvider;

    /**
     * Helper method to parse a binding expression using this model as the default for all binding URI's.
     * The resulting bind expression will not be store in the global registry, but rather in a private one.
     * Therefore, you must use this API to retrieve existing model specific bind expressions.
     *
     * @param {string} expression - the binding expression to parse.
     *
     * @return {gc.databind.IBind} - the existing or newly created bindable object, or null if this name is not supported by this model.
     */
    parseModelSpecificBindExpression(expression: string): IBindValue | null {
        this.bindProvider = this.bindProvider || new ModelBindProvider(this);
        return this.bindProvider.getBinding(expression);
    }

    /**
     * Helper method clear all private model specific bind expressions that have been created.  Use this to clear bindings
     * created with the parseModelSpecificBindExpression() helper method.
     */
    clearAllModelSpecificBindExpressions() {
        if (this.bindProvider) {
            this.bindProvider = undefined;
        }
    }

    dispose() {
        if (this.bindProvider) {
            this.bindProvider.dispose();
        }
    }

    async onConnect(transport: unknown) {
        this.setConnectedState(true);
    }

    /**
     * Method called when a transport is disconnected from the target.  The default implementation is to iterate through
     * all the bindings and call onDisconnected() on each binding if it supports such a method.  The purpose is for those
     * bindings to clear any critical errors that might have incurred.
     */
    async onDisconnect() {
        this.setConnectedState(false);

        const bindings = this.getAllBindings();
        bindings.forEach((bind) => {
            if (bind && bind.onDisconnected) {
                bind.onDisconnected();
            }
        });
    }

    toString() {
        return `model id="${this.id}"`;
    }

    fireScriptLogEvent(event: IScriptLogEvent): void {
        this.fireEvent(scriptLogEventType, event);
    }

    /**
     * <p>Helper method that can be used to do custom conversion of values based on getter and setter bind expressions.  It is not
     * necessary to provide both a getter and setter for this conversion to work.  The getter and setter expressions are model
     * specific bind expressions that can use other model bindings and a 'this' variable.  The 'this' variable is expected
     * to be used in these expressions because it represents the value to be converted.  If a 'this' variable is not used, then
     * the result of the conversion will be independent of the input value.</p>
     *
     * <p>If a getter expression is specified, the 'this' variable is assigned the value passed in, and the return value is
     * calculated by calling getValue() on this getter expression.</p>
     * <p>If a setter expression is specified, the setValue() of setter bind expression is called with the value passed in, and
     * the value of the 'this' variable is returned as the result.  In this situation, the setter expression must be a bi-directional
     * expression since it will be evaluated inversely.  A bi-directional expression is an expression that contains only one
     * variable bind and uses simple scale and shift operations; for example, 'this*9/5+32'.  This example could be used to
     * convert Celsius values to Fahrenheit if passed in as the getter expression.  When passed in as the setter expression it
     * performs the inverse operation and converts Fahrenheit to Celsius.</p>
     *
     * @param value - the value that is to be converted
     * @param getter - the getter expression to do the conversion.  If specified, the setter expression is not used.
     * @param setter - the setter expression to do the inverse conversion if no getter is specified..
     * @return the converted value based on the getter expression, or if not provided, then the setter expression.
     */
    getConvertedValue(value: bindValueType, getterExpression?: string, setterExpression?: string) {
        if (getterExpression) {
            const expr = this.parseModelSpecificBindExpression(getterExpression);
            this.bindProvider!.getBinding('this')!.setValue(value);
            return expr && expr.getValue();
        } else if (setterExpression) {
            const expr = this.parseModelSpecificBindExpression(setterExpression);
            if (expr) {
                const thisBind = this.bindProvider!.getBinding('this');
                thisBind!.setValue(undefined);
                expr.setValue(value);
                return thisBind!.getValue();
            }
            return undefined;
        } else {
            return value;
        }
    }

}


