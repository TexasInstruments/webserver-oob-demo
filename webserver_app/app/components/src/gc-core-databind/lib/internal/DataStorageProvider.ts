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
import { AbstractBindFactory } from './AbstractBindFactory';
import { bindValueType } from './IBindValue';

export interface DataStorageObject {
    [index: string]: { [index: string]: bindValueType };
}

export class DataStorageProvider {
    private static dataModels = new Map<string, AbstractBindFactory>();

    static addDataModel(dataProvider: AbstractBindFactory) {
        this.dataModels.set(dataProvider.id, dataProvider);
    }

    static removeDataModel(dataProvider: AbstractBindFactory) {
        this.dataModels.delete(dataProvider.id);
    }

    static readDataForSave() {
        const data: DataStorageObject = {};

        this.dataModels.forEach((dataProvider, providerName) => {
            data[providerName] = this.readData(dataProvider);
        });
        return data;
    };

    static writeDataForLoad(data: DataStorageObject): void {
        this.dataModels.forEach((dataProvider, providerName) => {
            const modelData = data[providerName];
            if (modelData) {
                this.writeData(dataProvider, modelData);
            }
        });
    };

    private static readData(model: AbstractBindFactory) {
        const data: { [index: string]: bindValueType } = {};
        model.getAllBindings().forEach((bind, bindName) => {
            if (bind && !bind.readOnly && !bind.excludeFromStorageProviderData) {
                data[bindName] = bind.getValue();
            }
        });
        return data;
    };

    private static writeData(model: AbstractBindFactory, data: { [index: string]: bindValueType }): void {
        for (const bindName in data) {
            // eslint-disable-next-line no-prototype-builtins
            if (data.hasOwnProperty(bindName)) {
                const bind = model.getAllBindings().get(bindName);
                if (bind) {
                    bind.setValue(data[bindName]);
                }
            }
        }
    };
};
