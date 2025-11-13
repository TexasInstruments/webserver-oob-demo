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
import { IOperatorFactory } from './IOperator';
import { IBindExpressionParser } from './IBindExpressionParser';
import { IBindValue } from '../IBindValue';
import { QFunctionOperator } from './QFunctionOperator';
import { DotOperator } from './DotOperator';
import { ILookupBindValue } from '../ILookupBindValue';
import { AbstractLookupOperator, testLookupBinding } from './AbstractLookupOperator';

export abstract class AbstractLookupOperatorFactory implements IOperatorFactory {
    abstract readonly operator: string;

    abstract createOperator(lookupBinding: ILookupBindValue, indexBinding: IBindValue[]): AbstractLookupOperator<ILookupBindValue>;

    parse(uri: string, factory: IBindExpressionParser, precedence: number): IBindValue | null {
        const openingBrace = this.operator.charAt(0);
        const closingBrace = this.operator.charAt(1);

        const endPos = factory.findLastIndexOf(uri, closingBrace, true);
        if (endPos >= 0) {
            if (endPos === uri.length - 1) {
                // valid lookup operation
                const pos = factory.findLastIndexOf(uri, openingBrace);
                if (pos === 0) {
                    // literal array or just plain parentheses
                    return this.parseLiteral(uri.substring(1, uri.length - 1), factory, precedence);
                } else if (pos < 0) {
                    // missing matching '[' or '(' operator.
                    throw new Error(`I found a '${closingBrace}' operator, but I couldn't find the matching '${openingBrace}' operator.  ` +
                        `To be honest I was expecting one in the following text: ${uri.substring(0, endPos + 1)}`);
                } else if (pos === endPos - 1) {
                    // empty middle paramenter
                    throw new Error(`I found an empty operator '${this.operator}'.  To be honest, I was expecting to find something inside.`);
                } else {
                    // empty right paramenter, this is the normal case, nothing following the <expression>[].
                    let arrayText = uri.substring(0, pos);
                    const indexText = uri.substring(pos + 1, endPos);

                    if (arrayText === 'Q') {
                        return QFunctionOperator.factory.parse(indexText, factory, 0);
                    }

                    // strip parenthesis (since we are not registering lookup bindings in binding Registry)
                    while (arrayText.charAt(0) === '(' && arrayText.charAt(arrayText.length - 1) === ')') {
                        precedence = 0; // reset precedence do to parentheses found
                        arrayText = arrayText.substring(1, arrayText.length - 1);
                    }

                    const lookupBinding = factory.parseExpression(arrayText, precedence, true);
                    if (lookupBinding) {
                        testLookupBinding(lookupBinding, this.operator);  // throw exception if invalid binding found.

                        const indexBindings = [];

                        const parameters = indexText.split(',');
                        for (let i = 0; i < parameters.length; i++) {
                            const parameter = parameters[i];
                            if (parameter.length === 0) {
                                throw new Error('Empty array index or function parameter.  ' +
                                    'To be honest, I was expecting one or more parameters separated by commas, ' +
                                    'but found that one of the parameters was empty in: ' + indexText);
                            }

                            const indexBinding = factory.parseExpression(parameter, 0);
                            if (!indexBinding) {
                                throw new Error(`Index binding "${parameter}" does not exist`);
                            }

                            indexBindings.push(indexBinding);
                        }

                        return this.createOperator(lookupBinding as ILookupBindValue, indexBindings);
                    } else {
                        throw new Error(`Array binding '${arrayText}[] does not exist.`);
                    }
                }
            } else if (uri.charAt(endPos + 1) === '.' && endPos < uri.length - 2) {
                // dot operator found
                return DotOperator.factory.parse(uri, factory, precedence);
            } else { // extra trailing text.
                throw new Error(`I found an operator '${this.operator}' with unexpected characters following it.  ` +
                    `To be honest, I was not expecting to find another operator after the last '${closingBrace}` +
                    ` in the following text: ${uri.substring(endPos + 1)}`);
            }
        }
        return null;
    }

    abstract parseLiteral(uri: string, factory: IBindExpressionParser, precedence: number): IBindValue | null;
}

