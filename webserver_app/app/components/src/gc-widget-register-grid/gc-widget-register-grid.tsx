/**
 *  Copyright (c) 2021, Texas Instruments Incorporated
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

import { Component, h, Prop, Event, EventEmitter, Watch, State, Method, Element } from '@stencil/core';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { ITreeDataProvider, IDataProvider } from '../gc-widget-grid/lib/IDataProvider';
import { IDeviceRegisterInfo, IRegisterBlockInfo, IRegisterInfo, IRegisterFieldInfo } from '../gc-model-register/lib/IRegisterInfo';
import { IBindValue, valueChangedEventType, IBindFactory, IValueChangedEvent, bindingRegistry } from '../gc-core-databind/lib/CoreDatabind';
import { IListener } from '../gc-core-assets/lib/Events';
import { RegisterModel } from '../gc-model-register/lib/RegisterModel';
import { WidgetGrid } from '../gc-widget-grid/gc-widget-grid';
import { codecRegistry } from '../gc-target-configuration/lib/TargetConfiguration';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { FilterGridByRowCallback } from '../gc-widget-grid/IColumnCellRenderer';

class RegisterData {
    name: string;
    path: string;
    address: number;
    binding: IBindValue;
    readonly: boolean;
    visibleMask: number;
    reservedMask = 0;
    readonlyMask: number;

    constructor(regInfo: IRegisterInfo, registerModel: IBindFactory) {
        this.name = regInfo.id || regInfo.name;
        this.address = regInfo.addr;
        this.binding = registerModel.getBinding(this.name);
        this.readonly = regInfo.attrs?.readonly ?? false;
        this.path = `${regInfo.groupName}/${this.name}`;

        this.visibleMask = GcUtils.bitField.getMask(0, (regInfo.size || (regInfo.nBytes * 8) || 8) - 1);
        this.readonlyMask = this.readonly ? this.visibleMask : 0;

        regInfo.fields?.forEach( field => {
            if (field.attrs) {
                const mask = GcUtils.bitField.getMask(field.start, field.stop);
                if (field.attrs.isHidden) {
                    this.visibleMask = GcUtils.bitField.writeField(this.visibleMask, mask, field.start, 0);
                }
                if (field.attrs.isLocked) {
                    this.readonlyMask = GcUtils.bitField.writeField(this.readonlyMask, mask, field.start, -1);
                }
                if (field.attrs.isReserved) {
                    this.reservedMask = GcUtils.bitField.writeField(this.reservedMask, mask, field.start, -1);
                }
            }
        });
    }

    get value() {
        return this.binding.getValue();
    }

    set value(newValue: number) {
        if (!this.readonly) {
            this.binding.setValue(newValue);
        }
    }

    get status() {
        return this.binding.status;
    }

    get committedValue() {
        return this.binding.getValueCommitted();
    }

    get isDeferredWritePending() {
        return this.binding.isDeferredWritePending();
    }
}

class RegisterBlockDataProvider implements IDataProvider {
    private registers: RegisterData[];
    name: string;

    constructor(group: IRegisterBlockInfo, registerModel: IBindFactory) {
        this.name = group.name;
        this.registers = group.registers.filter( regInfo => !(regInfo.attrs?.isHidden)).map( regInfo => new RegisterData(regInfo, registerModel));
    }

    addChangeListeners(onChangedCallback: IListener<IValueChangedEvent>) {
        this.registers.forEach( register => register.binding.addEventListener(valueChangedEventType, onChangedCallback));
    }

    removeChangeListeners(onChangedCallback: IListener<IValueChangedEvent>) {
        this.registers.forEach( register => register.binding.removeEventListener(valueChangedEventType, onChangedCallback));
    }

    get rowCount() {
        return this.registers.length;
    }

    getValue(row: number, column: string): string | number | boolean {
        return this.registers[row][column];
    }

    setValue(row: number, column: string, value: string | number | boolean): void {
        this.registers[row][column] = value;
    }

    isReadonly(row: number): boolean {
        return this.registers[row].readonly;
    }

    lookupRowByName(name: string): number {
        return this.registers.findIndex( register => register.name === name);
    }

    lookupRegisterByName(name: string) {
        return this.registers[this.lookupRowByName(name)];
    }

    getPartName(row: number, column: string) {
        return (column === 'value' && this.registers[row].isDeferredWritePending) ? 'deferred' : '';
    }
}

class RegisterGridDataProvider implements ITreeDataProvider {
    addressSize: number;
    dataBits: number;
    private groups: RegisterBlockDataProvider[];

    constructor(registerModel?: IBindFactory) {
        const deviceData = registerModel?.getBinding('$registerDefinitions')?.getValue() as IDeviceRegisterInfo;
        this.dataBits = deviceData?.info.regsize || 16;
        const biggestAddress = deviceData?.regblocks.reduce( (max: number, block) => block.registers.reduce( (max: number, reg) => Math.max(max, reg.addr), max), 0) || 255;
        this.addressSize = biggestAddress.toString(16).length;
        this.groups = deviceData?.regblocks.filter( group => !(group.attrs?.isHidden) ).map( group => new RegisterBlockDataProvider(group, registerModel)) ?? [];
    }

    isExpandable(row: number): boolean {
        return true;
    }

    getChildDataProvider(row: number): ITreeDataProvider | IDataProvider | Promise<ITreeDataProvider | IDataProvider> {
        return this.groups[row];
    }

    get rowCount() {
        return this.groups.length;
    }

    getValue(row: number, column: string): string | number | boolean {
        return this.groups[row][column];
    }

    setValue() {
    }

    lookupRowByName(name: string): number {
        return this.groups.findIndex( group => group.name === name);
    }

    addChangeListeners(onChangedCallback: IListener<IValueChangedEvent>) {
        this.groups.forEach( group => group.addChangeListeners(onChangedCallback));
    }

    removeChangeListeners(onChangedCallback: IListener<IValueChangedEvent>) {
        this.groups.forEach( group => group.removeChangeListeners(onChangedCallback));
    }

    lookupRegisterByName(registerName: string): RegisterData | undefined {
        if (!registerName) {
            return;
        }
        return this.groups.reduce( (result: RegisterData,  group) => result ?? group.lookupRegisterByName(registerName), undefined);
    }
}

/**
 * `gc-widget-register-grid` is an register tree grid for editing register values and bits.
 *
 * @label Register Grid
 * @group Tables, Trees and Grids
 * @demo
 * @usage
 * @border
 * @archetype <gc-widget-register-grid style="height: 300px; width: 400px"></gc-widget-register-grid>
 * @css --gc-row-height | The fixed size of each row (px)
 * @css --gc-font-size | The font size (px)
 * @css --gc-font-color | The font color | { "kind": "color" }
 * @css --gc-background-color | The background color for the grid | { "kind": "color" }
 * @css --gc-font-color-selected | The font color for the selected row| { "kind": "color" }
 * @css --gc-background-color-selected | The background color for the selected row | { "kind": "color" }
 * @css --gc-font-color-highlighted | The font color for the highlighted row | { "kind": "color" }
 * @css --gc-background-color-highlighted | The background color for the highlighted row | { "kind": "color" }
 * @css --gc-icon-color | The color of tree column icons | { "kind": "color" }
 * @css --gc-heading-font-size | The font size for column headings (px)
 * @css --gc-heading-font-color | The font color for column headings | { "kind": "color" }
 * @css --gc-heading-color | The background color for the column headings | { "kind": "color" }
 * @css --gc-outline-color-focus | The color of the focus rectangle for cells in the grid | { "kind": "color" }
 */

@Component({
    tag: 'gc-widget-register-grid',
    styleUrl: 'gc-widget-register-grid.scss',
    shadow: true
})
export class WidgetRegisterGrid implements WidgetBaseProps {
    private grid: WidgetGrid;
    private static REFERENCE_FONT_SIZE = 14;
    private registerModel: RegisterModel;
    private fontSize = WidgetRegisterGrid.REFERENCE_FONT_SIZE;
    private registerModelIdMap = new Map<string, boolean>();

    @State() dataProvider?: RegisterGridDataProvider;
    @State() selectedRegisterPath= '';

    /**
     * Identifier for the register model to use for retrieving symbolic information and values for registers and bit fields.
     *
     * @order 3
     */
    @Prop()
    registerModelId: string;

    /**
     * Number of bits to display for register addresses
     *
     * @order 5
     */
    @Prop()
    addressBits: number;

    /**
     * Number of bits to display for register values
     *
     * @order 7
     */
    @Prop()
    dataBits: number;

    /**
     * A field name, of the selected register, to highlight in the bits column.
     *
     * @order 10
     */
    @Prop()
    selectedField: string;

    /**
     * The name of the currently selected register
     *
     * @order 11
     */
    @Prop({ mutable: true })
    selectedRegister = '';

    /**
     * Text used to filter registers in the grid.  Setting this property to blank will remove any filtering.
     * @order 12
     */
    @Prop() filterText: string;

    /**
     * Sort registers in the grid by either name or address.
     * @order 13
     */
    @Prop() sortBy: 'name' | 'address';

    /**
     * Sort registers in descending order instead of ascending order.  This is only relevant if sortBy is specified.
     * @order 14
     */
    @Prop() sortDescending = false;

    /**
     * Hide the address column from being displayed.
     *
     * @order 15
     */
    @Prop()
    hideAddressColumn = false;

    /**
     * Hide the bits column from being displayed.
     *
     * @order 16
     */
    @Prop()
    hideBitsColumn = false;

    /**
     * Fired when the currently selected register changes.
     */
    @Event({ eventName: 'selected-register-changed' }) selectedRegisterChanged: EventEmitter<{ value: string }>;

    private onSelectedPathChanged = () => {
        this.selectedRegisterPath = this.grid?.selectedPath ?? '';
        const segments = this.selectedRegisterPath.split('/');
        if (segments.length > 1) {
            this.selectedRegister = segments[1];
        } else {
            this.selectedRegister = '';
        }
    };

    private onRegisterValueChangedListener = () => {
        this.grid?.refresh();
    };

    private getExpandToLevel() {
        if (this.registerModel) {
            if (this.registerModelIdMap.has(this.registerModelId)) {
                return 0;
            }
            this.registerModelIdMap.set(this.registerModelId, true);
        }
        return 2;
    }

    private onRegisterSymbolsChangedListener = () => {
        this.dataProvider?.removeChangeListeners(this.onRegisterValueChangedListener);
        this.dataProvider = new RegisterGridDataProvider(this.registerModel);
        this.grid?.setDataProvider(this.dataProvider, this.getExpandToLevel(), this.registerModel ? this.registerModelId : undefined);
        this.dataProvider.addChangeListeners(this.onRegisterValueChangedListener);
    };

    private async addRegisterDefinitionsListener() {
        if (this.registerModelId) {
            this.registerModel = bindingRegistry.getModel(this.registerModelId) as RegisterModel;

            if (!this.registerModel) {
                const modelId = this.registerModelId;
                await codecRegistry.whenConfigurationReady(this.registerModelId);
                if (this.registerModelId !== modelId) {
                    return;
                }
                this.registerModel = bindingRegistry.getModel(this.registerModelId) as RegisterModel;
            }
        }
        this.onRegisterSymbolsChangedListener();
        if (this.registerModel) {
            this.registerModel.getBinding('$registerDefinitions').addEventListener(valueChangedEventType, this.onRegisterSymbolsChangedListener);
        }
    }

    private removeRegisterDefinitionsListener() {
        if (this.registerModel) {
            this.registerModel.getBinding('$registerDefinitions').removeEventListener(valueChangedEventType, this.onRegisterSymbolsChangedListener);
        }
        this.registerModel = undefined;
    }

    private get addressPrecision() {
        return this.addressBits ? Math.ceil(this.addressBits / 4) : this.dataProvider?.addressSize || 2;
    }

    private get displayBits() {
        return this.dataBits || this.dataProvider?.dataBits || 8;
    }

    private get dataPrecision() {
        return Math.ceil(this.displayBits / 4);
    }

    componentWillRender() {
        const fontSize = Number.parseFloat(getComputedStyle(this.el).getPropertyValue('font-size'));
        if (!isNaN(fontSize)) {
            this.fontSize = fontSize;
        }
    }

    render() {
        const valueWidth = Math.ceil(((Math.max(this.dataPrecision, 8) + 2) * 10) * this.fontSize / WidgetRegisterGrid.REFERENCE_FONT_SIZE);

        let selectedBitsMask = 0;
        if (this.selectedField && this.selectedRegister) {
            const fieldInfo = this.registerModel?.getRegisterInfo(`${this.selectedRegister}.${this.selectedField}`) as IRegisterFieldInfo;
            if (fieldInfo) {
                selectedBitsMask = GcUtils.bitField.getMask(fieldInfo.start, fieldInfo.stop);
            }
        }

        // JSXON
        return <gc-widget-grid id="grid" ref={ (el: HTMLElement) => this.grid = el as unknown as WidgetGrid } selectedPath={this.selectedRegisterPath} onSelected-path-changed={this.onSelectedPathChanged} filterText={this.filterText} sortByColumn={this.sortBy} sortDescending={this.sortDescending}>
            <gc-widget-grid-tree-column heading="Register Name" hideMinimizeAction showInfoIcon>
                <slot></slot>
            </gc-widget-grid-tree-column>
            { this.hideAddressColumn ? null : <gc-widget-grid-data-column key="address" heading="Address" name="address" readonly format="hex" precision={this.addressPrecision}/> }
            <gc-widget-grid-data-column key="value" heading="Value" name="value" format="hex" precision={this.dataPrecision}
                style={{ '--gc-column-width': `${valueWidth}px` }}/>
            { this.hideBitsColumn ? null : <gc-widget-register-bits-column id="bitsHeader" heading="Bits" name="value" dataBits={this.displayBits} selectedBitsMask={selectedBitsMask}/> }
        </gc-widget-grid>;
        // JSXOFF
    }

    @Watch('registerModelId')
    onRegisterModelIdChanged() {
        this.removeRegisterDefinitionsListener();
        this.addRegisterDefinitionsListener();
    }

    @Watch('selectedRegister')
    onSelectedRegisterChanged() {
        let registerData: RegisterData;
        // push selected register change to the grid.  If the change came from the grid originally, this should have no effect.
        if (this.selectedRegister) {
            registerData = this.dataProvider?.lookupRegisterByName(this.selectedRegister);
            this.selectedRegisterPath = registerData?.path ?? '';
        } else if ((this.selectedRegisterPath).split('/').length > 1) {
            // We don't want to remove a selected group, so we need to make sure the path includes a register name to be cleared.
            this.selectedRegisterPath = '';
        }
        this.selectedRegisterChanged.emit({ value: this.selectedRegister });
    }

    /**
     * Helper method to find a the corresponding bit field, of the selected register, from a single bit of the register.
     *
     * @param bit zero based index of the bit to find the corresponding bit field for.
     */
    @Method()
    async lookupFieldByBit(bit: number): Promise<string | undefined> {
        const symbolInfo = this.registerModel?.getRegisterInfo(this.selectedRegister) as IRegisterInfo;
        const fieldInfo = symbolInfo?.fields?.find( field => field.start >= bit && field.stop <= bit);
        return fieldInfo?.id || fieldInfo?.name;
    }

    /**
     * Method to set or change the filter function for filtering registers in the grid.  If no callback is
     * provided, the default filtering will be performed on the register name.
     *
     * @param filterGridByRowCallback callback method that returns true if the row should remain after filtering.
     */
    @Method()
    async setFilterMethod(filterGridByRowCallback?: FilterGridByRowCallback) {
        this.grid?.setFilterMethod(filterGridByRowCallback);
    }

    /**
     * Method to redraw the underlying grid.  Calling refresh() may not cause the data in the grid to
     * redraw, so this method can be used to force a redrawing of the grid data.
     */
    @Method()
    async redrawGrid() {
        this.grid?.refresh();
    }

    /**
     * Method to expand all register groups to a specified level.
     *
     * @param level depth or level expanded register groups.
     */
    @Method()
    expandToLevel(level: number): Promise<void> {
        if (!this.grid) {
            throw new Error('Register grid not rendered yet.  You cannot expand levels until the grid has rendered at least once.');
        }
        return this.grid.expandToLevel(level);
    }

    connectedCallback() {
        this.addRegisterDefinitionsListener();
    }

    disconnectedCallBack() {
        this.removeRegisterDefinitionsListener();
    }

    componentDidLoad() {
        if (this.dataProvider) {
            // if we already have our first dataProvider, then we missed setting it on the grid, since the grid is only available
            // after the first render, which is now.
            this.grid?.setDataProvider(this.dataProvider, this.getExpandToLevel(), this.registerModel ? this.registerModelId : undefined);
        }
    }

    // #region gc-widget-base/gc-widget-base-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The widget element.
     */
    @Element() el: HTMLElement;

    /**
     * Sets to `true` to hide the element, otherwise `false`.
     *
     * @order 200
     */
    @Prop({ reflect: true }) hidden: boolean = false;

    /**
     * Fired when a CSS property has changed.
     **/
    @Event({ eventName: 'css-property-changed' }) cssPropertyChanged: EventEmitter<{ name: string; value: string }>;

    /**
     * Sets the CSS property.
     *
     * @param {string} name the element style name
     * @param {string} value the new CSS property to be set
     */
    @Method()
    async setCSSProperty(name: string, value: string): Promise<void> {
        value = value.replace(/^[ ]+|[ ]+$/g, '');
        if (await this.getCSSProperty(name) !== value) {
            this.el.style.setProperty(name, value);
            this.cssPropertyChanged.emit({ name: name, value: value });
        }
    }

    /**
     * Returns the value of a CSS property.
     *
     * @param {string} name the element style property
     * @returns {string} the value of the property
     */
    @Method()
    async getCSSProperty(name: string): Promise<string> {
        return getComputedStyle(this.el).getPropertyValue(name).trim();
    }

    /**
     * Refresh the widget.
     */
    @Method()
    async refresh(): Promise<void> {
        return this.el['forceUpdate']();
    }
    // #endregion

}
