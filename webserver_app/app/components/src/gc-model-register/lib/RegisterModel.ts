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

/**
 * Data binding Model for registers, and register bit fields, read and written to a target device.  This is a polling model
 * where the rate of polling can be controlled.  Reading and writing or register values is done through the
 * **{@link IRegisterModelEncoder}** interface.
 *
 * @packageDocumentation
 */

import { IRegisterInfo, IRegisterFieldInfo, IDeviceAddressMap, IRegisterBlockInfo, IRegisterJsonData, IDeviceRegisterInfo } from './IRegisterInfo';
import { GcPromise, IDeferedPromise } from '../../gc-core-assets/lib/GcPromise';
import { IPollingModelBaseParams } from '../../gc-target-configuration/lib/IPollingModelBaseParams';
import { GcUtils } from '../../gc-core-assets/lib/GcUtils';
import { RegisterBind, RegisterAllBind, RegisterArrayOperator } from './internal/RegisterBind';
import { FieldBind } from './internal/FieldBind';
import { GcConsole } from '../../gc-core-assets/lib/GcConsole';
import { IDecoder,  EncoderType, DecoderType, codecRegistry, ITransport } from '../../gc-target-configuration/lib/TargetConfiguration';
import { ReferenceBindValue, IBindFactory, IBindValue, AbstractPollingDataModel, VariableBindValue, UserPreferenceBindValue, ConstantBindValue, Status, AbstractBindFactory, bindingRegistry } from '../../gc-core-databind/lib/CoreDatabind';
import { GcFiles } from '../../gc-core-assets/lib/GcFiles';
import { connectionManager, activeConfigurationChangedEvent } from '../../gc-target-connection-manager/lib/ConnectionManager';

export * from './IRegisterInfo';

enum BIND_TYPE {
    CALCULATED,
    FIELD,
    CORE_REGISTER,
    USER,
    REGISTER_ALL,
    ACTIVE_REGISTER,
    BAD
}

const notIdentifierRegExp = /[^A-Za-z$_.0-9]+/;
const REGISTER_DEFINITIONS_BIND_NAME = '$registerDefinitions';
/**
 * Encoder interface for the register model.
 */
export interface IRegisterModelEncoder {
    /**
     * Read a register value from the target.
     *
     * @param info information about the register to read.
     * @param core specific core to read the register value from.
     */
    readValue(info: IRegisterInfo, core?: number): Promise<number | number[]>;

    /**
     * Write a register value to the target.
     *
     * @param info information about the register to write.
     * @value the value to write to the register.
     * @param core specific core to write the register value to.
     */
    writeValue(info: IRegisterInfo, value: number | number[], core?: number): Promise<void>;

    /**
     * Optional method to read multiple registers at on time.  If this
     * method is defined, it will only be used for consecutive registers addresses, so that only the starting register
     * address and the count is used to indicate which registers should be read.
     *
     * @param info information about the first register to read
     * @param count total number of consecutive registers to read at one time.
     * @param core specific core to read the register values from.
     */
    multiRegisterRead?(info: IRegisterInfo, count: number, core?: number): Promise<number[]>;
}

/**
 * An implementation of **{@link IRegisterModelEncoder}** that does nothing.
 */
export const nullRegisterModelEncoder = new (class implements IRegisterModelEncoder {
    readValue(): Promise<number | number[]> {
        throw new Error('Method not implemented.');
    }
    writeValue(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    multiRegisterRead?(): Promise<number[]> {
        throw new Error('Method not implemented.');
    }
})();

/**
 * Decoder interface for the register model.
 */
export interface IRegisterModelDecoder extends IBindFactory {
    /**
     * Helper method to get the I2C external device address for a particular register.
     *
     * @param info information about the register whose device address is required.
     */
    getDeviceAddressForRegister(info: IRegisterInfo): number | undefined;
}

/**
 * An implementation of **{@link IRegisterModelDecoder}** that does nothing.
 */
export const nullRegisterModelDecoder = new (class extends AbstractBindFactory implements IRegisterModelDecoder {
    getDeviceAddressForRegister(): number | undefined {
        return undefined;
    }
    createNewBind(): IBindValue {
        throw new Error('Method not implemented.');
    }
})('null');

/**
 * Runtime type identifier for all Register Model encoders.
 */
export const RegisterModelEncoderType = new EncoderType<IRegisterModelEncoder>('regInfo');

/**
 * Runtime type identifier for all Register Model decoders.
 */
export const RegisterModelDecoderType = new DecoderType<IRegisterModelDecoder>('regModel');

/**
 * Parameters for the Register Model.  All parameters are passed to the register model on construction, but
 * clients can change these values at any time; however, changes will only take effect the next time the register model is
 * connected.
 */
export interface IRegisterModelParams extends IPollingModelBaseParams {
    /**
     * The relative or absolute path to a json file containing the register definitions for an analog device.name of the target device.
     */
    registerInfo?: string;

    /**
     * The I2C bus address of this device.
     */
    deviceAddress?: number | string;

    /**
     * The optional flag that if true indicates that multi-device support is required.  All devices must be
     * of the same class, and therefore same register set.  Also, they all must be available on the same
     * interface through a single codec which also has multi-device support.
     */
    isDeviceArray?: boolean;

    /**
     * Under normal operation, this register model will queue up register writes when the target is not connected,
     * to be performed when the device first becomes connected.  If this flag is set, then write operations are instead
     * discard when the target is disconnected, and will not write the values to the target upon connection.
     */
    ignoreWriteOperationsWhenDisconnected?: boolean;

    /**
     * The name of the register to use for device verification.  If none specified, then no verification will occur.
     */

    verifyRegisterName?: string;

    /**
     * The value expected to be read from the verify register after applying the verification mask.  If not specified,
     * any value read for this register will be excepted as valid.
     */
    verifyValue?: number | string;

    /**
     * An optional mask value to be applied to the register value before comparing it to the verify value.  If not specified,
     * no mask will be applied, and the register value must match exactly the verify value.
     */
    verifyMask?: number | string;

    /**
     * An optional comma separated list of I2C device addresses to scan for verification of the device.
     * For example, verifyDeviceAddress="0x40,0x48,0x50".
     */
    verifyDeviceAddress?: string;
}

function resolveBlockRead(promises: IDeferedPromise<number | number[]>[], offset: number, size: number, results: number[]) {
    for (let i = 0; i < size; i++) {
        promises[i + offset].resolve(results[i]);
    }
}

function failBlockRead(promises: IDeferedPromise<number | number[]>[], offset: number, size: number, reason: string) {
    for (let i = 0; i < size; i++) {
        promises[i + offset].reject(reason);
    }
}

interface I2CRegisterInfo extends IRegisterInfo {
    __deviceAddressBinding: IBindValue | undefined | null;
}

class RegisterBlock {
    private registerModel: RegisterModel;
    addr: number;
    next?: RegisterBlock;
    private regs: IRegisterInfo[];
    len = 1;
    private promises?: IDeferedPromise<number | number[]>[];

    constructor(registerModel: RegisterModel, info: IRegisterInfo, next?: RegisterBlock) {
        this.registerModel = registerModel;
        this.addr = info.addr;
        this.next = next;
        this.regs = [info];
    }

    prependRegister(regInfo: IRegisterInfo) {
        this.len++;
        this.addr--;
        this.regs.unshift(regInfo);
    }

    appendRegister(regInfo: IRegisterInfo) {
        this.len++;
        this.regs.push(regInfo);

        if (this.next && regInfo.addr === this.next.addr - 1) {
            // combine next register block into this one.
            this.len += this.next.len;
            this.regs.push(...this.next.regs);
            this.next = this.next.next;
        }
    }

    private doReadRegisters (coreIndex?: number) {
        const promises = this.promises || [];

        for (let i = 0; i < promises.length; i++) {
            if (promises[i]) {
                let size = 1;
                while (promises[i+size]) {
                    size++;
                }

                const codec = this.registerModel.codec;
                if (codec) {
                    if (size > 1) {
                        // block read values
                        codec.multiRegisterRead!(this.regs[i], size, coreIndex).then((results) => {
                            resolveBlockRead(promises, i, size, results);
                        }).catch((err) => {
                            failBlockRead(promises, i, size, err);
                        });
                        i += size - 1;
                    } else {
                        // single value read
                        codec.readValue(this.regs[i], coreIndex).then(promises[i].resolve).catch(promises[i].reject);
                    }
                }
            }
        }
        this.promises = undefined;
    }

    readRegister(regInfo: IRegisterInfo, coreIndex?: number) {
        if (!this.promises) {
            this.promises = [];
            setTimeout(() => {
                this.doReadRegisters(coreIndex);
            }, 0);
        }
        const deferred = GcPromise.defer<number | number[]>();
        this.promises[regInfo.addr - this.addr] = deferred;
        return deferred.promise;
    }
}

class RegisterBlocks {
    private first?: RegisterBlock;
    constructor(private registerModel: RegisterModel) {
    }

    private findRegisterBlock(info: IRegisterInfo) {
        const addr = info.addr;
        if (addr !== undefined) {
            let cur = this.first;
            while (cur && addr >= cur.addr + cur.len) {
                cur = cur.next;
            }
            if (cur && addr >= cur.addr && cur.len > 1) {
                return cur;
            }
        }
    }

    addRegister(info: IRegisterInfo) {
        const addr = info.addr;
        if (addr !== undefined) {
            let cur = this.first;
            if (!cur) {
                // first element
                this.first = new RegisterBlock(this.registerModel, info);
            } else if (addr < cur.addr - 1) {
                // insert before first element
                this.first = new RegisterBlock(this.registerModel, info, cur);
            } else {
                // find insert point
                while (cur.next && addr >= cur.next.addr - 1 && addr !== cur.addr + cur.len) {
                    cur = cur.next;
                }
                if (addr === cur.addr - 1) {
                    // insert at beginning of block
                    cur.prependRegister(info);
                } else if (addr === cur.addr + cur.len) {
                    // insert at end of block
                    cur.appendRegister(info);
                } else {
                    // insert new block after current element.
                    cur.next = new RegisterBlock(this.registerModel, info, cur.next);
                }
            }
        }
    }

    readRegister(codec: IRegisterModelEncoder, info: IRegisterInfo, coreIndex?: number) {
        const block = this.findRegisterBlock(info);
        if (block && codec.multiRegisterRead) {
            return block.readRegister(info, coreIndex);
        }

        return codec.readValue(info, coreIndex);
    }
}

const calculatedBindingsPrefix = '_';
const NotDeviceArrayMessage = 'Must set is-device-array="true" on gc-model-register in order to use URIs that start with $cores';

interface RegisterInfo extends IRegisterInfo {
    fields: IRegisterFieldInfo[];
}

/**
 * Data binding Model for registers, and register bit fields, read and written to a target device.  This is a polling model
 * where the rate of polling can be controlled.  Reading and writing or register values done through the
 * **{@link IRegisterModelEncoder}** interface.
 */
export class RegisterModel extends AbstractPollingDataModel implements IDecoder<IRegisterModelDecoder, IRegisterModelEncoder> {
    decoderInputType = RegisterModelDecoderType;
    decoderOutputType = RegisterModelEncoderType;
    /**
     * The codec used to read and write registers to and from the target.
    */
    codec?: IRegisterModelEncoder;

    private registerJsonData?: IDeviceRegisterInfo;
    private registerJsonFilename?: string;
    private readRegisterInfoPromise?: Promise<void>;
    private symbols = new Map<string, IRegisterInfo | IRegisterFieldInfo | null>();
    private uriPrefix = '';
    private registerBlocksMap = new Map<string, RegisterBlocks>();
    private selectedConfigurationBind: IBindValue;
    private selectedDeviceBind: IBindValue;
    private deviceAddrs: IBindValue;
    private deviceAddrsUserPreferenceDefaults = new Map<string, number>();
    private console: GcConsole;

    constructor(private params: IRegisterModelParams) {
        super(params.id || 'reg', params.defaultRefreshInterval);

        this.console = new GcConsole('gc-register-model', params.id);
        this.setSymbols();

        this.selectedConfigurationBind = new VariableBindValue(connectionManager.activeConfigurationId);
        connectionManager.addEventListener(activeConfigurationChangedEvent, () => {
            this.selectedConfigurationBind.setValue(connectionManager.activeConfigurationId);
        });
        this.selectedDeviceBind = new VariableBindValue(this.params.deviceId);
        this.deviceAddrs = new VariableBindValue(this.params.deviceAddress === undefined ? undefined : +(this.params.deviceAddress ?? 0));

        if (this.isDeviceArray) {
            this.modelBindings.set('$selectedCore', new UserPreferenceBindValue(this.id, 'configuration', this.selectedConfigurationBind, 'device', this.selectedDeviceBind, 'core'));
            this.modelBindings.set('$cores.length', new VariableBindValue(undefined, true));
        }

        codecRegistry.register(this);
        bindingRegistry.registerModel(this);

        this.loadRegisterInfo();
    }

    dispose() {
        super.dispose();
        codecRegistry.unregister(this);
    }

    /**
     * True if this register model is configured to support an array of similar devices, rather that a single device.
     */
    get isDeviceArray(): boolean {
        return this.params.isDeviceArray || false;
    }

    getBinding(uri: string) {
        // use a prefix for looking up bindings, but only if a symbol exists for the prefix + uri, otherwise just use uri.
        if (this.uriPrefix) {
            if (this.deviceAddrsUserPreferenceDefaults.has(this.uriPrefix + uri)) {
                uri = this.uriPrefix + uri;
            }
        }

        return super.getBinding(uri);
    }

    createNewBind(uri: string) {
        const customRefreshBind = super.createNewBind(uri);
        if (customRefreshBind) {
            return customRefreshBind;
        }

        if (uri === REGISTER_DEFINITIONS_BIND_NAME) {
            return new VariableBindValue(undefined);
        }

        let bindResult: IBindValue;
        let registerAllBind: RegisterAllBind;
        let registerBind: RegisterBind;

        try {
            const segments = uri.split('.');

            switch (RegisterModel.getBindingTypeFromUri(uri, segments)) {
                case BIND_TYPE.FIELD: {
                    const pos = uri.lastIndexOf('.');
                    const parentBind = this.getBinding(uri.substring(0, pos));
                    if (parentBind instanceof RegisterBind || parentBind instanceof RegisterArrayOperator) {
                        const bitNumber = uri.substring(pos+1);
                        let symbolName = uri;
                        let symbolData = this.symbols.get(symbolName) as IRegisterFieldInfo;
                        if (!isNaN(+bitNumber)) {
                            symbolData = { start: +bitNumber, stop: +bitNumber, name: uri };
                            symbolName = '';
                        } else if (segments.length === 4) {
                            // strip $cores.xxx.  from the uri.
                            symbolName = segments[2] + '.' + segments[3];
                            symbolData = this.symbols.get(symbolName) as IRegisterFieldInfo;
                        }

                        bindResult = new FieldBind(symbolName, parentBind, symbolData, this);
                    } else {
                        throw parentBind?.status?.message || NotDeviceArrayMessage;
                    }
                    break;
                }

                case BIND_TYPE.USER: {
                    bindResult = new UserPreferenceBindValue(this.id, 'configuration', this.selectedConfigurationBind, 'device', this.selectedDeviceBind,  uri);
                    break;
                }

                case BIND_TYPE.CALCULATED: {
                    bindResult = new ReferenceBindValue(uri);
                    this.updateCalculatedBind(bindResult as ReferenceBindValue);
                    break;
                }
                case BIND_TYPE.ACTIVE_REGISTER: {
                    const symbolData= this.symbols.get(uri) as IRegisterInfo;
                    if (this.isDeviceArray) {
                        registerAllBind = this.getBinding('$cores.all.' + uri) as RegisterAllBind;
                        registerBind = new RegisterBind(uri, this, undefined, symbolData, registerAllBind);
                        registerBind.name = uri;
                        const activeRegisterBind = this.getBinding('$selectedCore');
                        bindResult = new RegisterArrayOperator(registerBind, activeRegisterBind!);
                    } else {
                        bindResult = new RegisterBind(uri, this, this.defaultRefreshBinding, symbolData);
                    }
                    break;
                }
                case BIND_TYPE.REGISTER_ALL: {
                    if (this.isDeviceArray) {
                        const symbolName = segments[2];
                        const symbolData = this.symbols.get(symbolName) as IRegisterInfo;
                        bindResult = new RegisterAllBind(symbolName, this, this.defaultRefreshBinding, symbolData);
                    } else {
                        throw NotDeviceArrayMessage;
                    }
                    break;
                }
                // eslint-disable-next-line no-fallthrough
                case BIND_TYPE.CORE_REGISTER: {
                    if (this.isDeviceArray) {
                        const symbolName = segments[2];
                        const symbolData = this.symbols.get(symbolName) as IRegisterInfo;
                        registerAllBind = this.getBinding('$cores.all.' + symbolName) as RegisterAllBind;
                        bindResult = new RegisterBind(symbolName, this, undefined, symbolData, registerAllBind);
                        (bindResult as RegisterBind).setIndex(segments[1]);
                    } else {
                        throw NotDeviceArrayMessage;
                    }
                    break;
                }
                default: {
                    throw `Invalid register bind name: ${uri}`;
                }
            }
        } catch (e) {
            bindResult = new ConstantBindValue();
            bindResult.status = Status.createErrorStatus(e);
        }
        return bindResult;
    }

    private updateAllBindings() {
        this.modelBindings.forEach( (bind, bindName) => {
            if (bind) {
                if (bind instanceof FieldBind) {
                    (bind as FieldBind).updateRegisterInfo(this);
                } else if (bind instanceof RegisterBind) {
                    (bind as RegisterBind).updateRegisterInfo();
                } else if (bind instanceof RegisterArrayOperator) {
                    (bind as RegisterArrayOperator).updateRegisterInfo();
                } else if (bind instanceof ReferenceBindValue) {
                    this.updateCalculatedBind(bind as ReferenceBindValue);
                } else if (bind instanceof UserPreferenceBindValue && (bind.name || '').split('.')[0] === 'deviceAddrs') {
                    this.updateUserPreferenceBind(bind as UserPreferenceBindValue);
                }
            }
        });
    }

    private addSymbol(symbolName: string, symbolData: IRegisterInfo | IRegisterFieldInfo, isRegister: boolean) {
        /* truth table
         *                       new entry
         * existing entry | Register |  Field   |
         * ===============+=====================+
         *      undefined | replace  | replace  |
         *           null | replace  |   skip   |
         *       Register | replace  |   skip   |
         *          Field | replace  | set null |
         */
        symbolName = symbolName.split(' ').join('_');  // convert spaces to underscores
        const symbolEntry = this.symbols.get(symbolName);
        if (symbolEntry === undefined || isRegister) {
            this.symbols.set(symbolName, symbolData);  // replace
        } else if (symbolEntry && !isRegister) {
            this.symbols.set(symbolName, null); // remove duplicates from the symbol table, unless field is trying to override a register.
        }
        return symbolName;
    }

    /**
     * Method to set or change the register.json information programmatically, as opposed to providing a filename as a paramter
     * to the constructor of the register model.
     */
    setSymbols(deviceInfo?: IRegisterJsonData) {
        this.registerBlocksMap = new Map<string, RegisterBlocks>();

        this.symbols.clear();
        this.clearAllModelSpecificBindExpressions();

        if (deviceInfo) {
            const groups: Array<IRegisterBlockInfo> = (deviceInfo.regblocks || []).map((groupInfo) => {
                const attrs = groupInfo.attrs ? {
                    ...groupInfo.attrs,
                    isHidden: GcUtils.string2boolean(groupInfo.attrs.isHidden),
                } : undefined;

                const regs: Array<IRegisterInfo> = (groupInfo.registers || []).map((regInfo) => {
                    const size = GcUtils.string2value(regInfo.size);
                    const id = (regInfo.id || regInfo.name).split(' ').join('_');

                    let regInfoAttrs = regInfo.attrs;
                    // convert deprecated mode to new attrs flogs.
                    switch (regInfo.mode) {
                        case 'R':
                            regInfoAttrs = { readonly: true };
                            break;
                        case 'W':
                            regInfoAttrs = { writeonly: true };
                            break;
                        case 'nonvolatile':
                            regInfoAttrs = { nonvolatile: true };
                    }

                    const attrs = regInfoAttrs ? {
                        ...regInfoAttrs,
                        readonly: GcUtils.string2boolean(regInfoAttrs?.readonly),
                        writeonly: GcUtils.string2boolean(regInfoAttrs?.writeonly),
                        nonvolatile: GcUtils.string2boolean(regInfoAttrs?.nonvolatile),
                        noverify: GcUtils.string2boolean(regInfoAttrs?.noverify),
                        isHidden: GcUtils.string2boolean(regInfoAttrs?.isHidden)
                    } : undefined;

                    const reg: RegisterInfo = {
                        ...regInfo,
                        id,
                        attrs,
                        size,
                        nBytes: Math.ceil((size === undefined ? 8 : size)/8),
                        addr: GcUtils.string2value(regInfo.addr) || 0,
                        writeAddr: GcUtils.string2value(regInfo.writeAddr),
                        default: GcUtils.string2value(regInfo.value) ?? GcUtils.string2value(regInfo.default),
                        deviceAddrs: regInfo.deviceAddrs || groupInfo.deviceAddrs || deviceInfo.deviceAddrsDefault,
                        fields: [],
                        groupName: groupInfo.name
                    };

                    reg.fields = (regInfo.fields || []).map( (fieldInfo) => {
                        const id = (fieldInfo.id || fieldInfo.name).split(' ').join('_');

                        const fieldOptions = fieldInfo.widget?.options ?? fieldInfo.options;
                        const options = fieldOptions ? fieldOptions.map( (option, i) => {
                            return { ...option, value: GcUtils.string2value(option.value) ?? i };
                        }) : undefined;

                        const start = GcUtils.string2value(fieldInfo.start) ?? 0;
                        const stop = GcUtils.string2value(fieldInfo.stop) ?? GcUtils.string2value(fieldInfo.start) ?? 0;

                        const widget = fieldInfo.widget ? {
                            ...fieldInfo.widget,
                            min: GcUtils.string2value(fieldInfo.widget.min) ?? 0,
                            max: GcUtils.string2value(fieldInfo.widget.max) ?? ( (1 << stop - start + 1) - 1),
                            step: GcUtils.string2value(fieldInfo.widget.step) ?? 1,
                        } : undefined;

                        const attrs = fieldInfo.attrs ? {
                            ...fieldInfo.attrs,
                            isHidden: GcUtils.string2boolean(fieldInfo.attrs.isHidden),
                            isLocked: GcUtils.string2boolean(fieldInfo.attrs.isLocked),
                            isReserved: GcUtils.string2boolean(fieldInfo.attrs.isReserved),
                        } : undefined;

                        const field: IRegisterFieldInfo = {
                            ...fieldInfo,
                            id,
                            start,
                            stop,
                            options,
                            widget,
                            attrs
                        };
                        const symbolName = (reg.id || reg.name) + '.' + (field.id || field.name);
                        this.addSymbol(symbolName.trim(), field, false);
                        return field;
                    });


                    // add registers to registerBlockMap to support Multi-register read operations.
                    if (reg.nBytes === 1) {
                        const blockname = reg.deviceAddrs || '.default';
                        let block = this.registerBlocksMap.get(blockname);
                        if (!block) {
                            block = new RegisterBlocks(this);
                            this.registerBlocksMap.set(blockname, block);
                        }
                        block.addRegister(reg);
                    }

                    const symbolName = reg.id || reg.name;
                    this.addSymbol(symbolName, reg, true);
                    return reg;
                });

                return {
                    ...groupInfo,
                    registers: regs,
                    attrs
                };
            });

            // @ts-ignore
            const calculatedBindings = deviceInfo.calculatedBindings ?? deviceInfo['calculated bindings'];

            this.registerJsonData = {
                ...deviceInfo,
                calculatedBindings,
                regblocks: groups
            };

            if (calculatedBindings) {
                Object.keys(calculatedBindings).forEach((calcBindName) => {
                    if (calcBindName.indexOf(calculatedBindingsPrefix) !== 0) {
                        const errorBind = new ConstantBindValue();
                        const errorMessage = `The calculated binding "${calcBindName}" must begin with the prefix "${calculatedBindingsPrefix}".  Please edit your system.json and ensure you prefix all your calculated binding definitions with this.`;
                        errorBind.status = Status.createErrorStatus(errorMessage);
                        this.modelBindings.set(calcBindName, errorBind);
                    } else {
                        // add symbols for calculated bindings
                        this.symbols.set(calcBindName, null);
                    }
                });
            }

            this.readDeviceAddressMap(deviceInfo);

        } else {
            this.registerJsonData = undefined;
        }
        this.updateAllBindings();  // update bindings to reflect new symbols available or not.
        this.getBinding(REGISTER_DEFINITIONS_BIND_NAME)!.setValue(this.registerJsonData);
    }

    private getSymbolSuggestions(prefix: string) {
        prefix = prefix || '';

        const result: string[] = [];
        this.symbols.forEach((value, key) => {
            if (key.indexOf(prefix) === 0) {
                result.push(key);
            }
        });
        return result;
    }

    /**
     * Read a register value directly from the target, without going through databinding.
     *
     * @param uri binding name for register to read a value from the target.
     * @param coreIndex specific core to read the register from.
     * @returns value read for a specific core, or all values across all cores if device array is enabled.
     */
    async readValue(uri: string, coreIndex?: number): Promise<number | number[]> {
        if (!this.isConnected()) {
            await this.whenConnected();
        }

        if (this.isDeviceArray && coreIndex === undefined) {
            // assumption is that this is coming from _scriptRead api and we should be using the active core.
            coreIndex = +this.getBinding('$selectedCore')!.getValue();
        } else {
            coreIndex = coreIndex || 0;
        }

        const symbolData = this.symbols.get(uri) as IRegisterInfo;
        if (symbolData) {
            if (this.codec) {
                const blockName = symbolData.deviceAddrs || '.default';
                const block = this.registerBlocksMap.get(blockName);
                if (block) {
                    return block.readRegister(this.codec, symbolData, coreIndex);
                }
                return this.codec.readValue(symbolData, coreIndex);
            }
        }
        throw `Register "${uri}" is not recognized for this device.  Please check the spelling.`;
    }

    /**
     * Read a register bit field directly from the target, without going through databinding.
     *
     * @param uri binding name for register bit field to read a value from the target.
     * @param coreIndex specific core to read the bit field from.
     * @returns value read for a specific core, or all values across all cores if device array is enabled.
     */
    async readBitfieldValue(uri: string, coreIndex?: number): Promise<number | number[]> {
        const segments = uri.split('.');
        const symbolData = this.symbols.get(uri) as IRegisterFieldInfo;
        if (segments.length > 1 && symbolData) {
            const value = await this.readValue(segments[segments.length-2], coreIndex);
            const { mask, shift, signBit } = FieldBind.calcShiftMaskAndSignBit(symbolData);
            if (value instanceof Array) {
                return value.map( (val) => GcUtils.bitField.readField(val, mask, shift, signBit));
            }
            return GcUtils.bitField.readField(value, mask, shift, signBit);
        } else {
            throw `Invalid register bitfield expression: ${uri}.`;
        }
    }

    /**
     * Write a register value directly to the target, without going through databinding.
     *
     * @param uri binding name for register to write the value to the target.
     * @param value value to write
     * @param coreIndex specific core to write the value to.
     */
    async writeValue(uri: string, value: number | number[], coreIndex?: number) {
        if (!this.isConnected()) {
            await this.whenConnected();
        }

        if (this.isDeviceArray && coreIndex === undefined) {
            // assumption is that this is coming from _scriptWrite api and we should be using the active core.
            coreIndex = +this.getBinding('$selectedCore')!.getValue();
        } else {
            coreIndex = coreIndex || 0;
        }

        const symbolData = this.symbols.get(uri) as IRegisterInfo;
        if (symbolData) {
            if (this.codec) {
                return this.codec.writeValue(symbolData, value, coreIndex);
            }
        }
        throw `Register "${uri}" is not recognized for this device.  Please check the spelling.`;
    }

    /**
     * Write a register bit field value directly to the target, without going through databinding.
     *
     * @param uri binding name for register bit field to write the value to the target.
     * @param value value to write
     * @param coreIndex specific core to write the value to.
     */
    async writeBitfieldValue(uri: string, value: number, coreIndex?: number) {
        const segments = uri.split('.');
        const symbolData = this.symbols.get(uri);
        if (segments.length > 1 && symbolData && symbolData) {
            const oldValue = await this.readValue(segments[segments.length-2], coreIndex);
            if (oldValue instanceof Array) {
                throw 'writeBitfield() method does not supported multi-core.  coreIndex must not be -1.';
            }
            const { shift, mask } = FieldBind.calcShiftMaskAndSignBit(symbolData as IRegisterFieldInfo);
            const newValue = GcUtils.bitField.writeField(oldValue, mask, shift, value);
            await this.writeValue(segments[segments.length-2], newValue, coreIndex);
        } else {
            throw `Invalid register bitfield expression: ${uri}`;
        }
    }

    private readDeviceAddressMap(settings: IDeviceAddressMap) {
        this.deviceAddrsUserPreferenceDefaults.clear();
        const deviceAddrsMap = settings.deviceAddrsMap;
        if (deviceAddrsMap) {
            Object.keys(deviceAddrsMap).forEach((blockName) => {
                const bindName = '$deviceAddrs.' + blockName;
                const bind = this.getBinding(bindName) as UserPreferenceBindValue;
                const defaultValue = GcUtils.string2value(deviceAddrsMap[blockName]) || 0;
                this.deviceAddrsUserPreferenceDefaults.set(bindName, defaultValue);
                this.updateUserPreferenceBind(bind, defaultValue);
            });

            if (!settings.deviceAddrsDefault) {
                this.console.error(name + ' interface in system.json file is missing required deviceAddrsDefault member');
            } else if (!(settings.deviceAddrsDefault in deviceAddrsMap)) {
                this.console.error('deviceAddrsDefault value does not match members in the deviceAddrsMap in the system.json file.');
            }
        }
    }

    getDeviceAddressForRegister(info: IRegisterInfo): number | undefined {
        let bind = (info as I2CRegisterInfo).__deviceAddressBinding;
        if (!bind) {
            const addrsExpression = info.deviceAddrs || '$deviceAddrs';
            this.uriPrefix = '$deviceAddrs.';
            bind = this.parseModelSpecificBindExpression(addrsExpression) || this.deviceAddrs;
            this.uriPrefix = '';
            (info as I2CRegisterInfo).__deviceAddressBinding = bind;
        }
        return bind.getValue();
    }

    /**
     * Retrieve the symbolic register information for a particular register or register field.
     *
     * @param uri binding name of the resister to retrieve the symbolic information for.
     */
    getRegisterInfo(uri: string): IRegisterInfo | IRegisterFieldInfo | undefined {
        return this.symbols.get(uri) || undefined;
    }

    private static getBindingTypeFromUri(uri: string, segments?: string[]): BIND_TYPE {
        const unexpectedCharacters = notIdentifierRegExp.exec(uri);
        if (unexpectedCharacters !== null || !uri) {
            return BIND_TYPE.BAD;
        }

        segments = segments || uri.split('.');

        if (segments[0] === '$cores') {
            switch (segments.length) {
                case 4: {
                    return (segments[1] === 'all' || !isNaN(+segments[1])) ? BIND_TYPE.FIELD : BIND_TYPE.BAD;
                }
                case 3: {
                    return segments[1] === 'all' ? BIND_TYPE.REGISTER_ALL : isNaN(+segments[1]) ? BIND_TYPE.BAD : BIND_TYPE.CORE_REGISTER;
                }
                default: {
                    return BIND_TYPE.BAD;
                }
            }
        }

        const firstSegmentFirstChar = segments[0].charAt(0);
        if (firstSegmentFirstChar === '$') {
            return BIND_TYPE.USER;  // any uri beginning with a $
        } else if (firstSegmentFirstChar === calculatedBindingsPrefix) {
            return BIND_TYPE.CALCULATED;
        } else if (segments.length === 2) {
            return BIND_TYPE.FIELD;
        } else if (segments.length > 2) {
            return BIND_TYPE.BAD;
        }
        return BIND_TYPE.ACTIVE_REGISTER;
    }

    private updateUserPreferenceBind(bind: UserPreferenceBindValue, defaultValue?: number) {
        defaultValue = defaultValue || this.deviceAddrsUserPreferenceDefaults.get(bind.name || '');

        if (defaultValue !== undefined) {
            bind.defaultValue = defaultValue;
            bind.status = null;
        } else {
            bind.status = Status.createErrorStatus(`Unknown User Preference Binding named: ${bind.toString()}`);
        }
    }

    private updateCalculatedBind(bind: ReferenceBindValue) {
        let bindExpression: string | undefined;
        const bindName = bind.name;
        if (this.registerJsonData?.calculatedBindings && bindName) {
            bindExpression = this.registerJsonData?.calculatedBindings[bindName];
        }
        bind.updateReferenceBinding(bindExpression, this);
    }

    setParentEncoder(parent: IRegisterModelEncoder): void {
        this.codec = parent;
    }

    deconfigure() {
        this.codec = undefined;
    }

    get _ignoreWriteOperationsWhenDisconnected() {
        return this.params.ignoreWriteOperationsWhenDisconnected || false;
    }

    private loadRegisterInfo() {
        if (this.registerJsonFilename !== this.params.registerInfo) {
            this.registerJsonFilename = this.params.registerInfo;
            if (this.registerJsonFilename) {
                this.readRegisterInfoPromise = GcFiles.readJsonFile(this.registerJsonFilename).then( (symbols) => {
                    this.setSymbols(symbols as IRegisterJsonData);
                }).catch( (err) => {
                    throw Error(`Failed to load register information form file ${this.registerJsonFilename}: ${err.message || err.toString()}`);
                });
            }
        }
    }

    /**
     * Method used to let the register model know that the deviceId parameter passed ot the construct has been changed.
     * This will cause the selected device binding to notify listeners of changes to the deviceId.
     */
    onDeviceChanged() {
        this.selectedDeviceBind.setValue(this.params.deviceId);
    }

    async onConnect(transport: ITransport) {
        super.onConnect(transport);

        this.deviceAddrs.setValue(this.params.deviceAddress === undefined ? undefined : +(this.params.deviceAddress ?? 0));

        this.loadRegisterInfo();
        // wait for register information to be read, if not already
        if (this.readRegisterInfoPromise) {
            await this.readRegisterInfoPromise;
            transport.assertStillConnecting();
        }

        if (this.params.verifyRegisterName) {
            transport.addProgressMessage('Verifying device ...');
            const value = await this.readValue(this.params.verifyRegisterName, 0) as number;
            transport.assertStillConnecting();

            const expectedValue = this.params.verifyValue;
            // if no verifyValue provided, assume we just want to verify the register can be read, and don't care about the value we get.
            if (expectedValue !== undefined) {
                const mask = +(this.params.verifyMask ?? -1);
                if ((value & mask) !== (+expectedValue & mask)) {
                    throw Error('Verification failed.  Value read was ${value}, but it did not match the expected value of ${expectedValue}.');
                }
            }
        }

        // TODO: search for deviceAddress from a list of possible address values for I2C bus given by verifyDeviceAddress.
    }
}
