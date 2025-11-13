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

import { h, Component, Prop, Event, EventEmitter, Element, Method, State, Watch, JSX } from '@stencil/core';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { IRegisterInfo, IRegisterFieldInfo, FORMAT_OPTIONS } from '../gc-model-register/lib/IRegisterInfo';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { RegisterModel } from '../gc-model-register/lib/RegisterModel';
import { DataConverter, bindingRegistry, valueChangedEventType, IBindValue } from '../gc-core-databind/lib/CoreDatabind';
import { codecRegistry } from '../gc-target-configuration/lib/TargetConfiguration';

type WIDGET_TYPE = 'label' | 'checkbox' | 'select' | 'indicator' | 'value' | 'spinner';

/**
 * `gc-widget-bitfield-viewer` is list of editable bit fields for a particular register value.
 *
 * @label Register Bitfield Viewer
 * @group Tables, Trees and Grids
 * @hidden
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-register-bitfield-viewer',
    styleUrl: 'gc-widget-register-bitfield-viewer.scss',
    shadow: true
})

export class WidgetRegisterBitfieldViewer implements WidgetBaseProps {

    private registerValueBind?: IBindValue;
    private keyCounters = new Map<WIDGET_TYPE, { count: number; total: number }>();
    private isRendering = false;

    @State() registerModel?: RegisterModel;
    @State() registerInfo?: IRegisterInfo;

    private onRegisterValueChangedListener = () => {
        this.value = this.registerValueBind?.getValue() ?? this.registerInfo.default;
    };

    private onRegisterSymbolsChangedListener = () => {
        this.registerInfo = this.registerModel?.getRegisterInfo(this.registerName) as IRegisterInfo;
        this.selectedFieldIndex = -1;
    };

    private getBitFieldType(bitField: IRegisterFieldInfo) {
        if (bitField.attrs?.isLocked || this.registerInfo?.attrs?.readonly) {
            return 'R';
        }
        if (this.registerInfo?.attrs?.writeonly) {
            return 'W';
        }
        return 'RW';
    }

    private isReadOnly(bitField: IRegisterFieldInfo): boolean {
        return this.getBitFieldType(bitField) === 'R';
    }

    private getBitFieldRange(bitField?: IRegisterFieldInfo, separator = ':'): string {
        if (bitField === undefined) {
            return '';
        }

        if (bitField.stop > bitField.start) {
            return `${bitField.stop}${separator}${bitField.start}`;
        }
        if (bitField.stop === bitField.start){
            return `${bitField.stop}`;
        }
        return '';
    }

    private getSelectValues(bitField: IRegisterFieldInfo) {
        if (bitField.options) {
            return `${bitField.options.map( option => option.value).join('|')}|`;
        }
        const width = bitField.stop - bitField.start + 1;
        const numOptions = 1 << width;
        return `${new Array<string>(numOptions).fill('').map( (_, i) => `${i}`).join('|')}|`;
    }

    private getSelectLabels(bitField: IRegisterFieldInfo) {
        if (bitField.options) {
            return `${bitField.options.map( option => option.display).join('|')}|`;
        }
        const width = bitField.stop - bitField.start + 1;
        const numOptions = 1 << width;

        return `${new Array<string>(numOptions).fill('').map( (_, i) => `b${DataConverter.convert(i, 'number', 'binary', width)}`).join('|')}|`;
    }

    private isDecimalFormat(bitField: IRegisterFieldInfo) {
        return bitField.widget && (bitField.widget.format === 'dec' || bitField.widget.format === 'exp' ||
                (!bitField.widget.format && bitField.widget.type === 'spinner'));
    }

    private getBitFieldValue(bitField: IRegisterFieldInfo): number {
        if (this.isDecimalFormat(bitField)) {
            // decimal values could be signed, fixed point, or have getters and setters, so use register model to get the value.
            return this.registerModel.getBinding(`${this.registerName}.${this.getSymbolName(bitField)}`).getValue();
        }

        // simple binary and hexadecimal values don't care about signed, decimal point or getters and setters, and we just need raw value.
        const mask = GcUtils.bitField.getMask(bitField.start, bitField.stop);
        return GcUtils.bitField.readField(this.value, mask, bitField.start);
    }

    private setBitFieldValue(bitField: IRegisterFieldInfo, value: number) {
        if (this.isRendering) {
            // during rendering we are reusing widgets, so we expect to have widget change listeners firing, and they need to be ignored.
            return;
        }

        if (this.isDecimalFormat(bitField)) {
            // decimal values could be signed, fixed point, or have getters and setters, so use register model to set the value.
            this.registerModel.getBinding(`${this.registerName}.${this.getSymbolName(bitField)}`).setValue(value);
        } else {
            // simple binary and hexadecimal values don't care about signed, decimal point or getters and setters, and we just need to set the raw value.
            const mask = GcUtils.bitField.getMask(bitField.start, bitField.stop);
            // @Watch on value will commit the new value to the register binding.
            this.value = GcUtils.bitField.writeField(this.value, mask, bitField.start, value);
        }
    }

    private getFormat(bitField: IRegisterFieldInfo): FORMAT_OPTIONS {
        return bitField.widget?.format ?? (bitField.widget?.type === 'spinner' ? 'dec' : 'hex');
    }

    private getPrecision(bitField: IRegisterFieldInfo): number | undefined {
        if (bitField.widget?.type === 'spinner' && !bitField.widget.format) {
            let decimalPlaces = 0;
            const incrementString = bitField.widget.step?.toString() ?? '';
            if (incrementString.includes('.')) {
                decimalPlaces = incrementString.length - incrementString.indexOf('.') - 1;
            }
            return decimalPlaces;
        }
        return bitField.widget?.format ? bitField.widget.precision : Math.ceil((bitField.stop - bitField.start + 1) / 4);
    }

    private getReadOnlyDisplayValue(bitField: IRegisterFieldInfo, bitFieldValue: number): string {
        if (bitField.options && bitField.options.length > bitFieldValue) {
            return bitField.options[bitFieldValue].display;
        }

        const width = bitField.stop - bitField.start + 1;

        let format: string;
        let precision: number;

        if (bitField.widget?.format) {
            // user provided format and precision (assumed, because undefined precision is allowed)
            format = bitField.widget.format;
            precision = bitField.widget.precision;
        } else {
            // default format and precision
            format = width < 8 ? 'binary' : 'hex';  // This is from V2, where read only values, less that 8 bits, were displayed in boolean.
            precision = width < 8 ? width : Math.ceil(width / 4);
        }
        const displayValue = DataConverter.convert(bitFieldValue, 'number', format, precision);
        return format === 'binary' ? 'b' + displayValue : displayValue;
    }

    private getSymbolName(info: IRegisterFieldInfo | IRegisterInfo) {
        return info.id || info.name;
    }

    private getRegisterDisplayName() {
        return this.registerInfo ? `${this.registerInfo.groupName ? `${this.registerInfo.groupName} / ` : ''}${this.registerInfo.name}` : '';
    }

    private onIndicatorToggle = (e: UIEvent) => {
        const bitFieldIndex = +(e.currentTarget as HTMLElement).id;
        const bitField = this.registerInfo?.fields?.[bitFieldIndex];
        if (bitField && !this.isReadOnly(bitField)) {
            this.setBitFieldValue(bitField, this.getBitFieldValue(bitField) ? 0 : 1);
        }
    };

    private onIndicatorKeyHandler = (e: KeyboardEvent) => {
        if (e.key === ' ' && !e.shiftKey && !e.ctrlKey) {
            this.onIndicatorToggle(e);
            e.preventDefault();
            e.stopPropagation();
        }
    };

    private toggleHelp = (e: MouseEvent) => {
        if (this.selectedFieldIndex < 0) {
            this.selectedFieldIndex = +(e.currentTarget as HTMLElement).id;
        } else {
            this.selectedFieldIndex = -1;
        }
    };

    private onWidgetValueChanged = (e: CustomEvent) => {
        const bitFieldIndex = +(e.currentTarget as HTMLElement).id;
        const bitField = this.registerInfo?.fields?.[bitFieldIndex];
        if (bitField) {
            this.setBitFieldValue(bitField, +e.detail.value);
        }
    };

    private getBifFieldWidgetType(bitField: IRegisterFieldInfo): WIDGET_TYPE {
        const readonly = this.isReadOnly(bitField);
        const isWidget = bitField.widget?.type !== undefined && bitField.widget.type !== 'value';

        if (readonly && !isWidget) {
            return 'label';
        }

        if (bitField.widget?.type) {
            return bitField.widget.type;
        }

        if (bitField.options) {
            return 'select';
        }

        if (bitField.stop === bitField.start) { // 1 bit
            return 'checkbox';
        }

        if (bitField.stop <= bitField.start + 3) { // 2-4 bits
            return 'select';
        }
        return 'value';  // more than 4 bits
    }


    private generateKey(type: WIDGET_TYPE) {
        let counter = this.keyCounters.get(type);
        if (counter === undefined) {
            counter = { count: 0, total: 0 };
            this.keyCounters.set(type, counter);
        }
        counter.count++;
        if (counter.count > counter.total) {
            counter.total = counter.count;
        }
        return `${type}${counter.count}`;
    }

    private renderBitFieldWidget(type: WIDGET_TYPE, readonly: boolean, id = undefined, bitField?: IRegisterFieldInfo) {
        const value = bitField ? this.getBitFieldValue(bitField) : 0;
        const align = bitField?.widget?.units ? 'flex right-align' : 'flex';

        switch (type) {
            case 'label':
                // JSXON
                return <gc-widget-label id={id} label={bitField ? this.getReadOnlyDisplayValue(bitField, value) : undefined}/>;
                // JSXOFF
            case 'checkbox':
                // JSXON
                return <gc-widget-checkbox id={id} readonly={readonly} checked={value !== 0}
                    onChecked-changed={this.onWidgetValueChanged}/>;
                // JSXOFF
            case 'select':
                // JSXON
                return <gc-widget-select id={id} class={align} readonly={readonly} selected-value={value}
                    values={bitField ? this.getSelectValues(bitField) : '0'} labels={bitField ? this.getSelectLabels(bitField) : '_'}
                    onSelected-value-changed={this.onWidgetValueChanged}/>;
                // JSXOFF
            case 'spinner':
                // JSXON
                return <gc-widget-spinner id={id} class="flex right-align" readonly={readonly} value={value}
                    min-value={bitField?.widget?.min} max-value={bitField?.widget?.max} increment={bitField?.widget?.step}
                    format={bitField ? this.getFormat(bitField) : 'dec'} precision={bitField ? this.getPrecision(bitField) : undefined}
                    onValue-changed={this.onWidgetValueChanged}/>;
                // JSXOFF
            case 'indicator':
                // JSXON
                return <gc-widget-led id={id} on={value !== 0} onClick={this.onIndicatorToggle} tabIndex={0}
                    style={{ '--gc-on-color': bitField?.widget?.onColor, '--gc-off-color': bitField?.widget?.offColor }}
                    onKeyDown={this.onIndicatorKeyHandler}/>;
                // JSXOFF
            default:
                // JSXON
                return <gc-widget-input id={id} class={align} readonly={readonly} value={value}
                    format={bitField ? this.getFormat(bitField) : 'hex'} precision={bitField ? this.getPrecision(bitField) : 4}
                    onValue-changed={this.onWidgetValueChanged}/>;
                // JSXOFF
        }
    }

    private renderBitField(type: WIDGET_TYPE, bitFieldIndex = -1, bitField?: IRegisterFieldInfo) {
        const readonly = bitField ? this.isReadOnly(bitField) : false;
        const id = bitFieldIndex < 0 ? undefined: `${bitFieldIndex}`;
        const isSelected = bitFieldIndex < 0 ? false : bitFieldIndex === this.selectedFieldIndex;
        const hidden = bitFieldIndex < 0 || (!isSelected && this.selectedFieldIndex >= 0);
        const key = this.generateKey(type);

        // JSXON
        return <div class="field-container" key={key} id={key} hidden={hidden}>
            <div class="header-container">
                <div class="caption">{`${bitField?.name ?? ''}[${this.getBitFieldRange(bitField)}]`}</div>
                <gc-widget-icon id={id} appearance={isSelected ? 'primary' : 'custom'} icon={isSelected ? 'navigation:cancel' : 'action:help_outline'} size={isSelected ? 's' : 'xs'} onClick={this.toggleHelp}/>
            </div>
            <div class="widget-container">
                <gc-widget-icon hidden={!readonly} size="xs" appearance="tertiary" icon="action:lock"/>
                { this.renderBitFieldWidget(type, readonly, id, bitField) }
                {bitField?.widget?.units ? <gc-widget-label label={bitField.widget.units}></gc-widget-label> : null}
            </div>
        </div>;
        // JSXOFF
    }

    render() {
        const bitField: IRegisterFieldInfo = this.registerInfo?.fields[this.selectedFieldIndex] ?? { name: '', start: 0, stop: 0 };
        const hideInfo = this.selectedFieldIndex < 0;

        // reset key counters per widget type
        this.keyCounters.forEach( counter => counter.count = 0 );

        // create bit field containers, and increment key counters in the process
        const bitFieldContainers: JSX.Element[] = this.registerInfo?.fields?.map(
            (bitField, i) => bitField.attrs?.isHidden ? null : this.renderBitField(this.getBifFieldWidgetType(bitField), i, bitField)) ?? [];

        // create extra hidden field containers to prevent destruction of field widgets, to improve performance.
        const extraHiddenFieldContainers: JSX.Element[] = [];
        this.keyCounters.forEach( (counter, type) => {
            while (counter.count < counter.total) {
                extraHiddenFieldContainers.push(this.renderBitField(type));
            }
        });

        // JSXON
        return <div class="container">
            { this.heading ? <div key="heading" class="heading">{this.heading}</div> : null }
            <div key="sub-heading" class="sub-heading">{this.getRegisterDisplayName()}</div>
            <div key="scroll-container" class="scroll-container">
                { extraHiddenFieldContainers }
                { bitFieldContainers }
                { hideInfo ? null : <div key="forceDividerLine"/> }
                <div class="info-container" key="information" hidden={hideInfo}>
                    <div class="info-title">Field</div>
                    <gc-widget-label label={bitField.title || bitField.name}/>
                    <div class="info-title">Bit</div>
                    <gc-widget-label label={this.getBitFieldRange(bitField, ' - ')}/>
                    <div class="info-title">Type</div>
                    <gc-widget-label label={this.getBitFieldType(bitField)}/>
                    <div class="info-title">Description</div>
                    <div innerHTML={bitField.desc?.split('\n').join('<br>')}/>
                </div>
            </div>
        </div>;
        // JSXOFF
    }

    private addRegisterBindListener() {
        if (this.registerModel) {
            this.registerModel.getBinding('$registerDefinitions').addEventListener(valueChangedEventType, this.onRegisterSymbolsChangedListener);
            if (this.registerInfo) {
                this.registerValueBind = this.registerModel.getBinding(this.getSymbolName(this.registerInfo));
                this.registerValueBind.addEventListener(valueChangedEventType, this.onRegisterValueChangedListener);
            }
        }
    }

    private removeRegisterBindListener() {
        if (this.registerValueBind) {
            this.registerValueBind.removeEventListener(valueChangedEventType, this.onRegisterValueChangedListener);
            this.registerValueBind = undefined;
        }
        if (this.registerModel) {
            this.registerModel.getBinding('$registerDefinitions').removeEventListener(valueChangedEventType, this.onRegisterSymbolsChangedListener);
        }
    }

    connectedCallback() {
        this.onRegisterInfoChanged();
    }

    disconnectedCallBack() {
        this.removeRegisterBindListener();
    }

    componentWillRender() {
        this.isRendering = true;
    }
    componentDidRender() {
        this.isRendering = false;
    }

    /**
     * The text to be displayed as a heading for this bit field viewer.
     *
     * @order 10
     */
    @Prop()
    heading: string;

    /**
     * The name of the register to display the bit fields for.
     *
     * @order 11
     */
    @Prop()
    registerName: string;

    /**
     * Identifier for the register model to use for retrieving bit field symbolic information and values.
     *
     * @order 12
     */
    @Prop()
    registerModelId: string;

    /**
     * Index of the register field that is selected and isolated for showing additional information.
     *
     * @order 15
     */
    @Prop({ mutable: true })
    selectedFieldIndex = -1;

    /**
     * The value of the register with all bit fields.
     *
     * @order 17
     */
    @Prop({ mutable: true })
    value = 0;

    /**
     * Fired when the `value` property has changed.
     */
    @Event({ eventName: 'value-changed' }) valueChanged: EventEmitter<{ value: number }>;

    /**
     * Fired when the `selectFieldIndex` property has changed.  This happens when the user clicks on the help icon to show more
     * information about a particular bit field in the register.
     */
    @Event({ eventName: 'selected-field-index-changed' }) selectedFieldIndexChanged: EventEmitter<{ value: number }>;

    @Watch('value')
    onValueChanged() {
        this.registerValueBind?.setValue(this.value);
        this.valueChanged.emit({ value: this.value });
    }

    @Watch('registerModelId')
    @Watch('registerName')
    onRegisterInfoChanged() {
        this.removeRegisterBindListener();

        let model: RegisterModel;
        if (this.registerModelId) {
            model = bindingRegistry.getModel(this.registerModelId) as RegisterModel;
            if (!model && this.registerModelId) {
                codecRegistry.whenConfigurationReady(this.registerModelId).then( () => this.onRegisterInfoChanged());
            }
        }
        this.registerModel = (model?.getConvertedValue) ? model : undefined;

        this.onRegisterSymbolsChangedListener();
        this.addRegisterBindListener();
        if (this.registerInfo) {
            this.onRegisterValueChangedListener();
        }
    }

    @Watch('selectedFieldIndex')
    onSelectedFieldChanged() {
        this.selectedFieldIndexChanged.emit({ value: this.selectedFieldIndex });
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
