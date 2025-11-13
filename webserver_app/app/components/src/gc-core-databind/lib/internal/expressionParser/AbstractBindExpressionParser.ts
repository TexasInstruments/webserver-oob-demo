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
import { IBindExpressionParser } from './IBindExpressionParser';
import { IOperatorFactory } from './IOperator';
import { NumberLiteral } from './NumberLiteral';
import { StringLiteral } from './StringLiteral';
import { BooleanLiteral } from './BooleanLiteral';
import { ExpressionParserUtils } from './ExpressionParserUtils';
import { OperatorList } from './OperatorList';
import { ILookupBindValue } from '../ILookupBindValue';
import { IBindValue } from '../IBindValue';
import { IDisposable, isDisposable } from '../IDisposable';

// below is a regular expression. It has three alternatives to match
// 1. ^\s+ this matches all leading spaces
// 2. this matches two alternatives plus the optional spaces around it
// 2a. [^A-Za-z0-9$_ ']+ this matches anything that is not an identifier or
// anything in quotes.
// The space is a terminator for the character group. Dots are not included
// because we can
// remove the spaces around them.
// 2b. '[^']' this matches quoted text and includes spaces in between quotes
// 3. \s+$ this matches trailing spaces
// Alternative 1 & 3 have an empty capture group, and alternative 2's
// capture group excludes the
// surrounding spaces.
const stripSpacesMatchString = /^\s+|\s*([^A-Za-z0-9$_ ']+|'[^']*')\s*|\s+$/g;

export class Bracket {
    constructor(private openingBrace: string, private closingBrace: string, public link?: Bracket) {
    }
    countBraces(text: string, brace: string, endingPos: number) {
        let count = 0;
        for (let pos = 0; pos <= endingPos;) {
            pos = text.indexOf(brace, pos);
            if (pos < 0 || pos > endingPos) {
                break;
            } else if (pos === 0 || (text.charAt(pos - 1) !== '\\' &&
                (this.link === undefined || !this.link.isInBracket(text, pos)))) {
                count++;
            }
            pos = pos + brace.length;
        }
        return count;
    }

    isInBracket(text: string, endingPos: number): boolean {
        let count = this.countBraces(text, this.openingBrace, endingPos);
        if (count > 0) {
            if (this.closingBrace !== this.openingBrace) {
                count -= this.countBraces(text, this.closingBrace, endingPos);
                return count !== 0;
            } else if ((count & 1) !== 0) { // if odd count, then we are in a bracket; otherwise we are not.
                return true;
            }
        }

        // if not in this bracket, try the next one
        if (this.link !== undefined) {
            return this.link.isInBracket(text, endingPos);
        }
        return false;  // we are not in any of the brackets.
    }
}

export abstract class AbstractBindExpressionParser implements IBindExpressionParser, IDisposable {
    protected abstract bindValue(name: string, isLookupBinding?: boolean): IBindValue | null;
    private operatorFactories: IOperatorFactory[] = [];
    private brackets: Bracket = new Bracket('(', ')');

    constructor(protected bindings: Map<string, IBindValue | null> = new Map<string, IBindValue | null>()) {
    }

    addOperatorFactory(...factories: IOperatorFactory[]) {
        if (factories.length > 1) {
            this.operatorFactories.push(new OperatorList(factories));
        } else if (factories.length > 0) {
            this.operatorFactories.push(factories[0]);
        }

    }

    addBraces(openingBrace: string, closingBrace: string) {
        // ensure parenthesis () are kept at front of list, because order matters.
        this.brackets.link = new Bracket(openingBrace, closingBrace, this.brackets.link);
    }

    static parseLiteral(uri: string) {
        let result = NumberLiteral.parseLiteral(uri);
        if (result === null) {
            result = BooleanLiteral.parseLiteral(uri);
        }
        if (result === null) {
            result = StringLiteral.parseLiteral(uri);
        }
        return result;
    }

    findFirstIndexOf(text: string, operator: string, startingPos: number = 0): number {
        let pos = startingPos;
        const len = operator.length - 2;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            pos = text.indexOf(operator, pos);
            if (pos > 0 && this.brackets.isInBracket(text, pos + len)) {
                pos = pos + operator.length;
                if (pos >= text.length) {
                    pos = -1;  // ran out of text, so indicate no match found.
                    break;
                }
            } else {
                break;
            }
        }
        return pos;
    }

    findLastIndexOf(text: string, operator: string, includeOperator: boolean): number {
        let pos = text.lastIndexOf(operator);
        const len = includeOperator ? operator.length - 1 : -1;
        while (pos > 0 && this.brackets.isInBracket(text, pos + len)) {
            pos = text.lastIndexOf(operator, pos - operator.length);
        }
        return pos;
    }

    findMatchingBrace(text: string, openingBrace: string, closingBrace: string): number {
        let pos = -1;
        let nestedBracePos = -1;
        do {
            pos = this.findFirstIndexOf(text, closingBrace, pos + 1);
            nestedBracePos = this.findFirstIndexOf(text, openingBrace, nestedBracePos + 1);
        }
        while (nestedBracePos >= 0 && pos > nestedBracePos);

        return pos;
    }

    parseExpression(uri: string, precedence?: number, isLookupBinding = false): IBindValue | null {
        if (uri.length === 0) {
            return null;
        }

        if (precedence === undefined) {
            // first time strip extra spaces in the expression so that
            // expressions that
            // differ only in extra spaces can be matched by string compares.
            // second time (called from expressionParser) there will be a hint
            // provided.
            uri = uri.replace(stripSpacesMatchString, '$1');
            precedence = 0;
        }

        if (!isLookupBinding && this.bindings.has(uri)) {
            return this.bindings.get(uri) || null;
        }

        let result: IBindValue | null = null;
        const unrecognizedText = ExpressionParserUtils.notIdentifierRegExp.exec(uri);

        // parse operators first
        if (unrecognizedText !== null) {
            for (let i = precedence; i < this.operatorFactories.length && result === null; i++) {
                const operatorFactory = this.operatorFactories[i];
                result = operatorFactory.parse(uri, this, i);
            }
        }

        // no operators found, try parsing literal
        let literalErrorMessage = null;
        if (result === null) {
            try {
                result = AbstractBindExpressionParser.parseLiteral(uri);
            } catch (e) {
                if (ExpressionParserUtils.isDigit(uri.charAt(0))) {
                    // identifiers can't start with a digit, so re throw this exception.
                    // hopefully this error message will be more meaningful that the identifier error message.
                    throw e;
                }
                literalErrorMessage = e.toString();
            }
        }

        // try parsing config variable references
        if (result === null) {
            if (unrecognizedText === null) {
                result = this.bindValue(uri, isLookupBinding);
            } else {
                ExpressionParserUtils.composeUnrecognizedIdentifier(unrecognizedText[0], literalErrorMessage);
            }
        }

        if (result) {
            result.uri = uri;

            if (typeof (result as ILookupBindValue).setIndex === 'function') {
                (result as ILookupBindValue).setIndex();  // kick start index lookups if parseLookupExpression returns a lookup operator.
            }
        }
        if (!isLookupBinding) {
            this.bindings.set(uri, result);
        }
        return result;
    }

    dispose() {
        this.bindings.forEach((bind) => {
            if (isDisposable(bind)) {
                bind.dispose();
            }
        });
        this.bindings.clear();
    }

    getBindingCount() {
        return this.bindings.size;
    }
}
