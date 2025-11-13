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

import { bindValueType, AbstractAsyncBindValue, IRefreshIntervalProvider, Status } from '../../../gc-core-databind/lib/CoreDatabind';
import { IProgramModel } from '../ProgramModel';

type callback = (err: { message?: string }) => bindValueType;

export class DSEvalBind extends AbstractAsyncBindValue {
    private onFailure: callback;
    private onSuccess: callback;
    constructor(public name: string, refreshIntervalProvider: IRefreshIntervalProvider, protected parentModel: IProgramModel) {
        super('number');

        this.onFailure = (err) => {
            const errMsg = err.message || err.toString();
            if (this.isConnected() && errMsg.toLowerCase().indexOf('target failed') < 0) {
                this.reportErrorStatus(errMsg);
            }
            return this.cachedValue;  // don't record a new value, keep the same value as before.
        };

        this.onSuccess = (result) => {
            // clear errors on succesfull read
            this.reportCriticalError(null);
            return result;
        };

        this.setRefreshIntervalProvider(refreshIntervalProvider);
    };

    async writeValue() {
        if (!this.parentModel.isConnected()) {
            await this.parentModel.whenConnected();
        }
        this.parentModel.codec?.writeValue(this.getTargetExpression(), this.cachedValue).catch(this.onFailure);
    };

    async readValue() {
        if (!this.parentModel.isConnected()) {
            await this.parentModel.whenConnected();
        }
        return this.parentModel.codec?.readValue(this.getTargetExpression()).then(this.onSuccess).catch(this.onFailure);
    };

    private getTargetExpression() {
        let result = this.name;
        const indecies = this.getIndex();
        if (indecies) {
            for (let i = 0; i < indecies.length; i++) {
                const index = indecies[i];
                const number = +index;
                if (isNaN(number)) {
                    result += '.' + index;
                } else {
                    result += '[' + number + ']';
                }
            }
        }
        return result;
    };

    private reportErrorStatus(dsErrorMessage: string) {
        let status = null;
        if (dsErrorMessage && dsErrorMessage.length > 0) {
            if (dsErrorMessage.indexOf('identifier not found') >= 0 && dsErrorMessage.indexOf(this.getTargetExpression()) >= 0) {
                dsErrorMessage = `Missing identifier: ${this.getTargetExpression()}, it cannot be found in the target program's symbols.`;
            }
            status = Status.createErrorStatus(dsErrorMessage, 'target');
        }
        this.reportCriticalError(status);
    };

    isConnected() {
        return this.parentModel.isConnected();
    };
};

