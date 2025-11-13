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

import { GcUtils } from '../../../gc-core-assets/lib/GcUtils';
import { EventType, IListener, IEvent } from '../../../gc-core-assets/lib/Events';
import { IRegisterFieldInfo, IRegisterInfo } from '../IRegisterInfo';
import { RegisterModel } from '../RegisterModel';
import { bindValueType, AbstractBindValue, IDisposable, IValueChangedEvent, IStreamingDataEvent, IBindValue, valueChangedEventType, streamingDataEventType, Status, staleChangedEventType, statusChangedEventType, IStatus } from '../../../gc-core-databind/lib/CoreDatabind';

const typeParser = /\s*(unsigned\s|signed\s)?\s*(int|q(\d+))\s*/i;

export class FieldBind extends AbstractBindValue implements IDisposable {
    excludeFromStorageProviderData = true;
    private parentValueChangedListener: IListener<IValueChangedEvent>;
    private parentStreamingDataListener: IListener<IStreamingDataEvent>;
    protected mask = 1;
    protected shift = 0;
    protected q?: number;
    protected signBit?: number;
    private _readOnly = false;

    constructor(public symbolName: string, private parentBind: IBindValue, symbolData: IRegisterFieldInfo, parentModel: RegisterModel) {
        super(parentBind.getType());

        this.parentValueChangedListener = () => {
            this.onParentValueChangedHandler();
        };
        parentBind.addEventListener(valueChangedEventType, this.parentValueChangedListener);

        this.parentStreamingDataListener = () => {
            this.onDataReceived();
        };
        this.addEventListenerOnFirstAdded(streamingDataEventType, () => {
            this.parentBind.addEventListener(streamingDataEventType, this.parentStreamingDataListener);
        });
        this.addEventListenerOnLastRemoved(streamingDataEventType, () => {
            this.parentBind.removeEventListener(streamingDataEventType, this.parentStreamingDataListener);
        });

        this.doUpdateRegisterInfo(symbolData, parentModel);
    }

    dispose() {
        this.parentBind.removeEventListener(valueChangedEventType, this.parentValueChangedListener);
    }

    private onParentValueChangedHandler() {
        let regValue = this.parentBind.getValue();
        const isArrayType = this.parentBind.getType() === 'array';
        if (!isArrayType) {
            regValue = [regValue];
        }
        let newValue: number[] | number = [];
        for (let i = 0; i < regValue.length; i++) {
            let value = GcUtils.bitField.readField(regValue[i], this.mask, this.shift, this.signBit);

            if (this.q && !isNaN(value)) {
                value = value / (Math.pow(2, this.q));
            }

            if (this.getConvertedValue) {
                value = this.getConvertedValue(value);
            }

            newValue[i] = value;
        }

        if (!isArrayType) {
            newValue = newValue[0];
        }
        this.updateValue(newValue, undefined, true);

    }

    static calcShiftMaskAndSignBit(symbolData?: IRegisterFieldInfo) {
        // setup default mask, shift and bitWidth for when no symbol data is available.
        let shift = 0;
        let mask = 1;
        let signBit = undefined;
        let q = undefined;

        if (symbolData) {
            const startBit = symbolData.start;
            const stopBit = symbolData.stop;
            mask = GcUtils.bitField.getMask(startBit, stopBit);
            shift = startBit;

            const type = symbolData.type;
            if (type) {
                const match = typeParser.exec(type);
                if (match && match.index === 0) {
                    const isSigned = !(match[1] && match[1].toLowerCase() === 'unsigned');
                    if (isSigned) {
                        signBit = GcUtils.bitField.getMask(stopBit, stopBit);
                    }
                    if (match[3] !== undefined) {
                        q = +match[3];
                        if (q === undefined || isNaN(q) || q < 0) {
                            throw 'invalid type declaration for field: ' + symbolData.name;
                        }
                    }
                } else {
                    throw 'invalid type declaration for field: ' + symbolData.name;
                }
            }

        }

        return { shift: shift, mask: mask, signBit: signBit, q: q };
    }

    private getConvertedValue?: (value: bindValueType) => bindValueType;
    private setConvertedValue?: (value: bindValueType) => bindValueType;

    private doUpdateRegisterInfo(symbolData: IRegisterFieldInfo, model: RegisterModel) {
        try {
            const { mask, shift, signBit, q } = FieldBind.calcShiftMaskAndSignBit(symbolData);
            this.mask = mask;
            this.shift = shift;
            this.signBit = signBit;
            this.q = q;
            // Some of this is for backwards compatibility since we no longer generate bit fields that have a mode property
            this._readOnly = this.parentBind.readOnly || symbolData.attrs?.isLocked || symbolData.mode === 'R';

            if (symbolData) {
                if (symbolData.getter || symbolData.setter) {
                    this.getConvertedValue = value => model.getConvertedValue(value, symbolData.getter, symbolData.setter);
                    this.setConvertedValue = value => model.getConvertedValue(value, symbolData.setter, symbolData.getter);
                } else {
                    this.getConvertedValue = undefined;
                    this.setConvertedValue = undefined;
                }

                // initialize value based on default register value.
                this.onParentValueChangedHandler();

                this.status = null;  // clear any errors,
            } else {
                throw 'Bit field "' + this.symbolName + '" is not recognized for this device.';
            }
        } catch (e) {
            this.status = Status.createErrorStatus(e);
        }
    }

    updateRegisterInfo(parentModel: RegisterModel) {
        const symbolData = parentModel.getRegisterInfo(this.symbolName) as IRegisterFieldInfo;
        return this.doUpdateRegisterInfo(symbolData, parentModel);
    }

    onValueChanged(details: IValueChangedEvent) {
        let newValue = details.newValue;
        if (!Array.isArray(newValue)) {
            newValue = [newValue];
        }

        let regValue = this.parentBind.getValue();
        const isArrayType = this.parentBind.getType() === 'array';
        if (isArrayType) {
            regValue = regValue ? regValue.slice() : [];
        } else {
            regValue = [regValue];
        }

        for ( let i = 0; i < regValue.length; i++) {
            let value = newValue[i];
            if (value !== undefined) {
                if (this.setConvertedValue) {
                    value = this.setConvertedValue(value);
                }
                if (this.q && !isNaN(value)) {
                    value = Math.round(value * Math.pow(2, this.q));
                }
                regValue[i] = GcUtils.bitField.writeField(regValue[i], this.mask, this.shift, value);
            }
        }

        if (!isArrayType) {
            regValue = regValue[0];
        }

        this.parentBind.setValue(regValue);
    }

    private onDataReceived() {
        this.fireEvent(streamingDataEventType, { data: this.cachedValue });
    }

    isStale() {
        return this.parentBind.isStale();
    }

    addEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        if (type.id === staleChangedEventType.id) {
            this.parentBind.addEventListener(type, listener);
        } else {
            super.addEventListener(type, listener);

            if (type.id === statusChangedEventType.id) {
                this.parentBind.addEventListener(type, listener);
            }
        }
    }

    removeEventListener<T extends IEvent>(type: EventType<T>, listener: IListener<T>) {
        if (type.id === staleChangedEventType.id && this.parentBind) {
            this.parentBind.removeEventListener(type, listener);
        } else {
            super.removeEventListener(type, listener);
            if (type.id === statusChangedEventType.id) {
                super.removeEventListener(type, listener);
            }
        }
    }

    get status() {
        let status = super.status;
        if (!status && this.parentBind) {
            status = this.parentBind.status;
        }
        return status;
    }

    set status(status: IStatus | null) {
        super.status = status;
    }

    get readOnly() {
        return this._readOnly;
    }
}
