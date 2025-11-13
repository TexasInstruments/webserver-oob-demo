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

import { Component, h, Prop, Event, EventEmitter, State, Method, Element, Listen } from '@stencil/core';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { RegisterModel, IRegisterInfo, IRegisterFieldInfo, IDeviceRegisterInfo } from '../gc-model-register/lib/RegisterModel';
import { bindingRegistry, IValueChangedEvent, valueChangedEventType, IBindValue, DataConverter, AbstractAsyncBindValue, AbstractPollingDataModel, IProgressCounter, ProgressCounter, IBindFactory } from '../gc-core-databind/lib/CoreDatabind';
import { codecRegistry } from '../gc-target-configuration/lib/TargetConfiguration';
import { GcPromise } from '../gc-core-assets/lib/GcPromise';
import { FilterGridByRowCallback } from '../gc-widget-grid/IColumnCellRenderer';
import { WidgetRegisterGrid } from '../gc-widget-register-grid/gc-widget-register-grid';
import { ITreeDataProvider } from '../gc-widget-grid/lib/IDataProvider';
import { GcMessageDialog } from '../gc-widget-message-dialog/lib/GcMessageDialog';
import { CloseReason } from '../gc-widget-base/gc-widget-base-dialog-props';
import { WidgetToggleSwitch } from '../gc-widget-toggle-switch/gc-widget-toggle-switch';

/**
 * `gc-widget-register-view` is a view to display and edit register values.
 *
 * @label Register View
 * @group Tables, Trees and Grids
 * @container
 * @demo
 * @usage
 * @archetype <gc-widget-register-view style="height: 300px; width: 400px" layout horizontal></gc-widget-register-view>
 */

@Component({
    tag: 'gc-widget-register-view',
    styleUrl: 'gc-widget-register-view.scss',
    shadow: true
})
export class WidgetRegisterView implements WidgetBaseProps {
    private grid: WidgetRegisterGrid;
    private deferredModeToggle: WidgetToggleSwitch;
    private modelReadyPromises = new Map<string, Promise<void>>();
    private modelsDeferred = new Map<string, boolean>();
    private refreshIntervalBind: IBindValue;
    private registerDefinitionsBind: IBindValue;
    private searchBitFields = false;

    @State() modelIdLabels = '';
    @State() activeRegisterModelId?: string;
    @State() activeRegisterModel?: RegisterModel;
    @State() activeDeviceRegisterInfo?: IDeviceRegisterInfo;
    @State() selectedRegister?: string;
    @State() selectedFieldIndex =-1;
    @State() activeDeviceName = '';
    @State() deferredWriteEnabled = false;
    @State() autoReadValue = 100;
    @State() filterText = '';
    @State() showDetails?: string;
    @State() busyProgress?: IProgressCounter;

    @Prop()
    hideDeviceName = false;

    @Prop()
    autoReadSelectorLabels: string;

    @Prop()
    autoReadSelectorValues: string;

    @Event({ eventName: 'auto-read-value-changed' }) autoReadValueChanged: EventEmitter<{ value: number }>;

    private onSelectedRegisterChanged = (e: CustomEvent ) => {
        this.selectedRegister = e.detail.value;
    };

    private onSelectedFieldIndexChanged = (e: CustomEvent ) => {
        this.selectedFieldIndex = e.detail.value;
    };

    private onSearchBitFieldsCheckedChanged = (e: CustomEvent) => {
        this.searchBitFields = e.detail.value as boolean;
        this.setFilterMethod();
    };

    private async setActiveModel(id?: string) {
        if (this.refreshIntervalBind) {
            this.refreshIntervalBind.removeEventListener(valueChangedEventType, this.onModelRefreshRateValueChanged);
            this.refreshIntervalBind = undefined;
        }

        if (this.registerDefinitionsBind) {
            this.registerDefinitionsBind.removeEventListener(valueChangedEventType, this.onRegisterDefinitionsChanged);
            this.registerDefinitionsBind = undefined;
        }

        this.activeRegisterModelId = id;
        this.activeRegisterModel = undefined;
        this.activeDeviceRegisterInfo = undefined;

        if (id) {
            if (!this.modelReadyPromises.has(id)) {
                this.modelReadyPromises.set(id, GcPromise.timeout(codecRegistry.whenConfigurationReady(id), 5000, 'Timeout on model ready'));
            }
            await this.modelReadyPromises.get(id);

            const model = bindingRegistry.getModel(id) as RegisterModel;
            if (model && this.activeRegisterModelId === id) {
                this.refreshIntervalBind = model.getBinding('$refresh_interval');
                if (this.refreshIntervalBind) {
                    this.refreshIntervalBind.addEventListener(valueChangedEventType, this.onModelRefreshRateValueChanged);
                    this.autoReadValue = +this.refreshIntervalBind.getValue();
                }

                this.activeRegisterModel = model;
                this.registerDefinitionsBind = this.activeRegisterModel.getBinding('$registerDefinitions');
                if (this.registerDefinitionsBind) {
                    this.registerDefinitionsBind?.addEventListener(valueChangedEventType, this.onRegisterDefinitionsChanged);
                    this.activeDeviceRegisterInfo = this.registerDefinitionsBind?.getValue() as IDeviceRegisterInfo;

                    // restore deferred mode when switching models.
                    this.deferredWriteEnabled = this.modelsDeferred.get(this.activeRegisterModelId) ?? false;
                }
            }
        }
    }

    private onSelectedModelChanged = (e: CustomEvent ) => {
        this.setActiveModel(e.detail.value);
    };

    private get autoReadLabels() {
        return this.autoReadSelectorLabels || 'Off|As fast as possible|15ms Delay|50ms Delay|100ms Delay|500ms Delay|1s Delay|5s Delay|10s Delay|60s Delay';
    }

    private get autoReadValues() {
        return this.autoReadSelectorValues || '-1,0,15,50,100,500,1000,5000,10000,60000';
    }

    private onModelRefreshRateValueChanged = (e: IValueChangedEvent) => {
        this.autoReadValue = e.newValue;
    };

    private onRegisterDefinitionsChanged = (e: IValueChangedEvent) => {
        this.activeDeviceRegisterInfo = e.newValue as IDeviceRegisterInfo;
    };

    private onAutoReadSelectedValueChanged = (e: CustomEvent) => {
        const refreshBinding = this.activeRegisterModel?.getBinding('$refresh_interval');
        refreshBinding?.setValue(e.detail.value);
    };

    private onFilterTextChanged = (e: CustomEvent) => {
        this.filterText = e.detail.value;
    };

    private async startProgress(message = 'Written') {
        const busyProgress = this.busyProgress = new ProgressCounter();
        const { progress, result } = await GcMessageDialog.progress('', `${message.substring(0, 4)}ing registers ...`, '', true, 0, 100, true);
        const hdr = setInterval(() => {
            const count = busyProgress.count -1;
            const total = busyProgress.totalCount -1;
            if (count < total) {
                progress.setMessage(`${count} of ${total} registers ${message.toLowerCase()}`);
            } else {
                progress.setMessage(`${total} registers ${message.toLowerCase()}`);
            }
            progress.setValue(busyProgress.getProgress());
        }, 100);

        await result;
        clearInterval(hdr);
        this.busyProgress = undefined;
    }

    private doRead = () => {
        if (!this.activeRegisterModel?.isConnected()) {
            GcMessageDialog.error('Must be connected to target to read registers.');
            return;
        }

        const bind = this.activeRegisterModel?.getBinding(this.selectedRegister) as AbstractAsyncBindValue;
        if (bind?.refresh) {
            this.startProgress('Read');
            bind.refresh(this.busyProgress);
            this.busyProgress.done();
        }
    };

    private doReadAll = () => {
        if (!this.activeRegisterModel?.isConnected()) {
            GcMessageDialog.error('Must be connected to target to read registers.');
            return;
        }

        if (this.activeRegisterModel?.refreshAllBindings) {
            this.startProgress('Read');
            this.activeRegisterModel.refreshAllBindings(this.busyProgress);
            this.busyProgress.done();
        }
    };

    private doWriteDeferredRegister(bind?: IBindValue, force = false) {
        if (force || bind?.isDeferredWritePending()) {
            bind.setDeferredMode(false, this.busyProgress, force);
            bind.setDeferredMode(true);
        }
    }

    private doWrite = () => {
        const bind = this.activeRegisterModel?.getBinding(this.selectedRegister);
        if (bind) {
            if (this.activeRegisterModel.isConnected()) {
                this.startProgress();
            } else {
                GcMessageDialog.warning(`Write to ${this.selectedRegister} enqueued - not connected to target.`);
            }
            this.doWriteDeferredRegister(bind, true);

            if (this.busyProgress) {
                this.busyProgress.done();
                this.grid?.redrawGrid();
            }
        }
    };

    private getUncommittedWriteCount(model?: IBindFactory): number {
        return this.activeDeviceRegisterInfo?.regblocks.reduce( (count: number, regBlock) => {
            return count + regBlock.registers.reduce( (count: number, register) => {
                return count + (model.getBinding(register.id)?.isDeferredWritePending() ? 1 : 0);
            }, 0);
        }, 0);
    }

    private  doWriteAll = () => {
        if (this.activeDeviceRegisterInfo?.regblocks.length > 0) {
            if (this.activeRegisterModel.isConnected()) {
                this.startProgress();
            } else {
                const uncommittedCount = this.getUncommittedWriteCount(this.activeRegisterModel);
                if (uncommittedCount > 0) {
                    GcMessageDialog.warning(`Write to ${uncommittedCount} register(s) enqueued - not connected to target.`);
                }
            }
            this.activeDeviceRegisterInfo.regblocks.forEach( regBlock => {
                regBlock.registers.forEach( register => {
                    this.doWriteDeferredRegister(this.activeRegisterModel?.getBinding(register.id));
                });
            });

            if (this.busyProgress) {
                this.busyProgress.done();
                this.grid?.redrawGrid();
            }
        }
    };

    private onWriteDeferredModeChanged = async (e: CustomEvent) => {
        const deferred = e.detail.value ? true : false;
        if (deferred === this.deferredWriteEnabled) {
            return;
        }

        let response: CloseReason;

        if (this.activeRegisterModelId) {
            this.modelsDeferred.set(this.activeRegisterModelId, deferred);
        }

        const uncommittedCount = deferred ? 0 : this.getUncommittedWriteCount(this.activeRegisterModel);
        if (uncommittedCount > 0) {
            response = await GcMessageDialog.prompt('Register View', 'Commit Pending Writes?', 'content:create', true, false, 'no,yes');
        }

        if (response === 'dismiss') {
            this.deferredModeToggle.checked = true;
            return;
        }

        if (response === 'yes') {
            if (this.activeRegisterModel?.isConnected()) {
                this.startProgress();
            } else {
                GcMessageDialog.warning(`Write to ${uncommittedCount} register(s) enqueued - not connected to target.`);
            }
        }

        this.activeDeviceRegisterInfo?.regblocks.forEach( regBlock => {
            regBlock.registers.forEach( register => {
                const bind = this.activeRegisterModel?.getBinding(register.id);
                if (response === 'no') {
                    bind?.clearDeferredWrite();
                }
                bind?.setDeferredMode(deferred, this.busyProgress, false);
            });
        });
        this.busyProgress?.done();

        if (response === 'confirm') {
            this.grid.redrawGrid();  // committing values does not generate value changes, so we need to redraw to remove deferred styling.
        }

        this.deferredWriteEnabled = deferred;
    };

    private toggleDetails = () => {
        this.showDetails = this.showDetails ? undefined : this.selectedRegister;
        this.setFilterMethod();
    };

    private filterRegisterForDetailsCallback: FilterGridByRowCallback = (row, dataProvider, filterByText) => {
        const name = '' + dataProvider.getValue(row, 'name');
        // need to do exact match on register name, and not a register group either.
        return name === filterByText && !(dataProvider as ITreeDataProvider).isExpandable?.(row);
    };

    private hasFilteredField(registerInfo: IRegisterInfo, filterByText: string) {
        const fields: IRegisterFieldInfo[] = registerInfo?.fields ?? [];
        for (let i = 0; i < fields.length; i++) {
            if (fields[i].name?.toLowerCase().includes(filterByText) &&
                !(fields[i].attrs?.isHidden || (fields[i].name.toLowerCase() === 'reserved' && fields[i].attrs?.isReserved))) {
                return true;
            }
        }
        return false;
    }

    private hasFilterRegister(name: string, filterByText: string) {
        const registerBlock = this.activeDeviceRegisterInfo?.regblocks.find( block => block.name === name );
        return registerBlock.registers.reduce( (found: boolean, register) => {
            found = found || register.name.toLowerCase().includes(filterByText);
            if (this.searchBitFields) {
                found = found || this.hasFilteredField(register, filterByText);
            }
            return found;
        }, false);
    }

    private filterRegistersOnlyCallback: FilterGridByRowCallback = (row, dataProvider, filterByText, isOpen) => {
        if (isOpen) {
            return false;  // opened register groups have already been filtered at this point.
        }
        const name = '' + dataProvider.getValue(row, 'name');
        if ((dataProvider as ITreeDataProvider).isExpandable) {
            // closed register group needs to be included if it has any children that match the filter text.
            return this.hasFilterRegister(name, filterByText);
        }
        return name?.toLowerCase().includes(filterByText) ?? false;
    };

    private filterRegistersAndFieldsCallback: FilterGridByRowCallback = (row, dataProvider, filterByText, isOpen) => {
        if (this.filterRegistersOnlyCallback(row, dataProvider, filterByText, isOpen)) {
            return true;
        }

        if (!isOpen && this.activeRegisterModelId) {
            const name = '' + dataProvider.getValue(row, 'name');
            const registerInfo = this.activeRegisterModel?.getRegisterInfo(name) as IRegisterInfo;
            return this.hasFilteredField(registerInfo, filterByText);
        }
        return false;
    };

    private setFilterMethod() {
        this.grid?.setFilterMethod(this.showDetails ? this.filterRegisterForDetailsCallback : this.searchBitFields ? this.filterRegistersAndFieldsCallback : this.filterRegistersOnlyCallback);
    }

    private renderFieldDetail(field: IRegisterFieldInfo) {
        // JSXON
        return <tr>
            <td>{field.stop}:{field.start}</td>
            <td>{field.name}</td>
            <td class="col3" innerHTML={field.desc?.split('\n').join('<br>')}/>
        </tr>;
        // JSXOFF
    }

    private renderDetails(register: IRegisterInfo) {
        const defaultValue = DataConverter.convert(register.default ?? 0, 'number', 'hex', register.nBytes * 2);

        // JSXON
        return <div id="registerDetails" class="stretch">
            <div class="detail-heading">{register.title || register.name}</div>
            <gc-widget-icon appearance="primary" icon="navigation:cancel" size="s" class="clickable" onClick={this.toggleDetails}/>
            <div innerHTML={register.desc?.split('\n').join('<br/>') ?? ''}/>
            <div>{`Default value: ${defaultValue}`}</div>
            <table>
                <tr>
                    <th>Bits</th>
                    <th>Name</th>
                    <th>Description</th>
                </tr>
                { register.fields?.map( field => this.renderFieldDetail(field)) }
            </table>
        </div>;
        // JSXOFF
    }

    render() {
        const isMultiModel = this.modelIdLabels.indexOf(';') > 0;
        const selectedRegister = this.activeRegisterModel?.getRegisterInfo(this.selectedRegister) as IRegisterInfo;
        const selectedField = selectedRegister?.fields?.[this.selectedFieldIndex];
        const readDisabled = this.busyProgress !== undefined || this.autoReadValue > -1;
        const writeDisabled = !this.deferredWriteEnabled || !selectedRegister || selectedRegister.attrs?.readonly;
        const deviceName = this.hideDeviceName ? undefined : this.activeDeviceRegisterInfo?.info.name;
        const detailsRegister = this.showDetails ? this.activeRegisterModel?.getRegisterInfo(this.showDetails) as IRegisterInfo : undefined;

        // JSXON
        return <div class="root-container column">
            <div class="row bottom">
                <div class="stretch">
                    <div class="title">
                        <span class="heading">Register Map</span>
                        <span class="sub-heading">{deviceName}</span>
                    </div>
                </div>
                { isMultiModel ? <gc-widget-select id="modelSelect" key="models" caption="Register model" labels={this.modelIdLabels}
                    onSelected-label-changed={this.onSelectedModelChanged} initialIndex={0}/> : null }
                <slot></slot>
                <gc-widget-select id="autoReadSelect" key="autoRead" caption="Auto read" labels={this.autoReadLabels} values={this.autoReadValues}
                    selectedValue={this.autoReadValue} onSelected-value-changed={this.onAutoReadSelectedValueChanged}/>
                <gc-widget-button id="read" label="Read" disabled={selectedRegister === undefined || readDisabled} onClick={this.doRead}/>
                <gc-widget-button id="readAll" label="Read all" disabled={readDisabled} onClick={this.doReadAll}/>
                <gc-widget-button id="write" label="Write" disabled={writeDisabled} onClick={this.doWrite}/>
                <gc-widget-button id="writeAll" label="Write all" disabled={!this.deferredWriteEnabled} onClick={this.doWriteAll}/>
                <gc-widget-toggle-switch id="deferredModeSwitch" caption="Write mode" label="Immediate" labelWhenChecked="Deferred"
                    onChecked-changed={this.onWriteDeferredModeChanged} checked={this.deferredWriteEnabled} ref={ (el: HTMLElement) => this.deferredModeToggle = el as unknown as WidgetToggleSwitch }/>
            </div>
            <gc-widget-container class="stretch">
                <div class="row fill" id="main">
                    <div class="stretch column fill">
                        <div class="row center">
                            <gc-widget-input-filter id="search" placeholder="Search registers by name" class="stretch"
                                hasClearIcon hasSearchIcon selectOnFocus intermediateChanges onValue-changed={this.onFilterTextChanged}/>
                            <gc-widget-checkbox id="searchBitFieldsCheckbox" label="Search bitfields" onChecked-changed={this.onSearchBitFieldsCheckedChanged}></gc-widget-checkbox>
                        </div>
                        <gc-widget-container class={detailsRegister ? 'no-shrink' : 'stretch'}>
                            <gc-widget-register-grid id="registerGrid" ref={ (el: HTMLElement) => this.grid = el as unknown as WidgetRegisterGrid }
                                class="fill" register-model-id={this.activeRegisterModelId}
                                selected-field={selectedField?.id} onSelected-register-changed={this.onSelectedRegisterChanged}
                                filterText={ detailsRegister ? this.showDetails : this.filterText?.toLowerCase() }>
                            </gc-widget-register-grid>
                        </gc-widget-container>
                        { detailsRegister ? this.renderDetails(detailsRegister) : null }
                    </div>
                    <gc-widget-register-bitfield-viewer id="bitFieldViewer" heading="Field View" registerModelId={this.activeRegisterModelId}
                        registerName={this.selectedRegister} onSelected-field-index-changed={this.onSelectedFieldIndexChanged}/>
                </div>
            </gc-widget-container>
        </div>;
        // JSXOFF
    }

    connectedCallback() {
        const models = document.querySelectorAll('gc-model-register');
        const modelIds = [];
        if (models) {
            models.forEach( model => modelIds.push(model.id));
        }
        this.modelIdLabels = modelIds.join(';'); // TODO: filter models by active configuration, and listen for configuration changes.
        this.setActiveModel(modelIds[0]);
    }

    disconnectedCallback() {
        this.setActiveModel();
    }

    componentDidLoad() {
        this.setFilterMethod();
    }

    @Listen('info-icon-clicked')
    private onInfoIconClicked() {
        this.toggleDetails();
    }

    /**
     * Method to expand all register groups to a specified level.
     *
     * @param level depth or level expanded register groups.
     */
    @Method()
    expandToLevel(level: number): Promise<void> {
        if (!this.grid) {
            throw new Error('Register view not rendered yet.  You cannot expand levels until the register view has rendered at least once.');
        }
        return this.grid.expandToLevel(level);
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
