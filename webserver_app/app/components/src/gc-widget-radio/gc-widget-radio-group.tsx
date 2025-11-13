
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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Component, h, Prop, Event, EventEmitter, Listen, Watch, Element, Method, State } from '@stencil/core';
import { WidgetRadio } from './gc-widget-radio';
import { WidgetBaseSelectorProps } from '../gc-widget-base/gc-widget-base-selector-props';
import { WidgetBaseSelector, ValueType, IOption } from '../gc-widget-base/gc-widget-base-selector';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';

/**
 * `gc-widget-radio-group` is a container for radio buttons that are mutually exclusive in selection.
 * Only one can be selected at a time.
 *
 * @label Radio Group
 * @group Inputs
 * @demo
 * @usage
 * @container
 * @border
 * @layout
 */
@Component({
    tag: 'gc-widget-radio-group',
    styleUrl: 'gc-widget-radio-group.scss',
    shadow: true
})
export class WidgetRadioGroup implements WidgetBaseTooltipProps, WidgetBaseSelectorProps, WidgetBaseTitleProps, WidgetBaseDisabledProps {
    private values = new Array<ValueType>();
    private labels = new Array<string>();

    private base = new (
        class extends WidgetBaseSelector {
            get radioGroup() {
                return this.parent as WidgetRadioGroup;
            }
            get element() {
                return this.radioGroup.el;
            }
            protected setOptions(options: IOption[]): void {
                /* do nothing */
            }
            protected getSelectedIndex(): number {
                const radios = this.radioGroup.getRadios();
                for (let i = 0; i < radios.length; ++i) {
                    if (radios[i].checked) {
                        return i;
                    }
                }
                return -1;
            }
            protected setSelectedIndex(index: number): void {
                this.radioGroup.selectedIndex = index;
                this.selectionChanged(index);
            }
            protected selectionChanged(index: number): void {
                const radios = this.radioGroup.getRadios();
                for (let i = 0; i < radios.length; ++i) {
                    const radio = radios[i] as any;
                    if (i === index) {
                        radio.checked = true;
                    } else {
                        radio.checked = false;
                    }
                }
            }
            protected getValues(): Array<ValueType> {
                return this.radioGroup.values;
            }
            protected getLabels(): string[] {
                return this.radioGroup.labels;
            }
        }
    )(this);

    @State() combinedErrorText: string;

    componentWillLoad() {
        this.el.className = 'ti-radio-group';

        /* initialize designer methods */
        this.el['onSettingChildPropertyValue'] = this.onSettingChildPropertyValue.bind(this);
    }

    componentDidLoad() {
        const radios = this.getRadios();
        for (let i = 0; i < radios.length; ++i) {
            const radio = radios[i];

            this.labels.push(radio.label);
            this.values.push(radio.value);
        }

        /* prevent changing element property value warning during render */
        setTimeout(() => {
            this.base.initializeComponent();
        }, 1);
    }

    render() {
        // JSXON
        return this.base.render(
            <ti-radio-group disabled={ this.disabled } value={ this.selectedValue }>
                <slot></slot>
            </ti-radio-group>,
            { caption: this.caption, infoText: this.infoText, tooltip: this.tooltip }
        );
        // JSXOFF
    }

    private getRadios(): Array<WidgetRadio> {
        const radios = this.el.querySelectorAll('gc-widget-radio');
        const result = [];
        for (let i = 0; i < radios.length; ++i) {
            result.push(radios[i] as unknown as WidgetRadio);
        }
        return result;
    }

    /**
     * Designer callback method.
     *
     * @param child
     * @param name
     * @param value
     */
    onSettingChildPropertyValue(child: WidgetRadio, name: string, value: any) {
        if (name === 'checked') {
            return {
                name: 'selectedLabel',
                value: value ? child.label : '',
                sideEffects: ['selectedIndex', 'selectedValue']
            };
        }
    }

    @Listen('tiChange')
    onTiChanged(event: CustomEvent) {
        if (event.currentTarget === this.el && event.detail.selected) {
            const radios = this.getRadios();
            for (let i = 0; i < radios.length; ++i) {
                if (radios[i].value === event.detail.value) {
                    // this.selectedIndex = i;
                    this.base.onSelectionChanged(i);
                    return;
                }
            }
        }
    }

    @Watch('disabled')
    onDisabledChanged(newValue: boolean) {
        const radios = this.getRadios();
        radios.forEach(radio => {
            radio.disabled = newValue;
        });
    }

    @Watch('selectedLabel')
    onSelectedLabelChanged(newValue: string) {
        this.base.selectedLabelChanged()
        this.selectedLabelChanged.emit({ value: newValue });
    }

    @Watch('selectedValue')
    onSelectedValueChanged(newValue: any) {
        this.base.selectedValueChanged();
        this.selectedValueChanged.emit({ value: newValue });
    }

    @Watch('selectedIndex')
    onSelectedIndexChanged(newValue: number) {
        this.base.selectedIndexChanged();
        this.selectedIndexChanged.emit({ value: newValue });
    }

    // #region gc-widget-base/gc-widget-base-tooltip-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the tooltip that is displayed for this widget.
     * @order 210
     */
    @Prop() tooltip: string;
    // #endregion
    // #region gc-widget-base/gc-widget-base-selector-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The zero-based index of the selected option.
     * @order 20
     */
    @Prop({ mutable: true }) selectedIndex: number;

    /**
     * Fired when the `selectedIndex` property has changed.
     */
    @Event({ eventName: 'selected-index-changed' }) selectedIndexChanged: EventEmitter<{ value: number }>;

    /**
     * The label of the selected option.
     * @order 21
     */
    @Prop({ mutable: true }) selectedLabel: string;

    /**
     * Fired when the `selectedLabel` property has changed.
     */
    @Event({ eventName: 'selected-label-changed' }) selectedLabelChanged: EventEmitter<{ value: string }>;

    /**
     * The value represented by the selected option.
     * @order 22
     */
    @Prop({ mutable: true }) selectedValue: number | string;

    /**
     * Fired when the `selectedValue` property has changed.
     */
    @Event({ eventName: 'selected-value-changed' }) selectedValueChanged: EventEmitter<{ value: number | string }>;

    /**
     * The index of the option to be initially selected by default.
     * @order 23
     */
    @Prop() initialIndex: number;
    // #endregion
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
    // #region gc-widget-base/gc-widget-base-title-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The widget caption text.
     * @order 207
     */
    @Prop({ reflect: true }) caption: string;

    /**
     * The widget info icon help text.
     * @order 208
     */
    @Prop({ reflect: true }) infoText: string;
    // #endregion
    // #region gc-widget-base/gc-widget-base-disabled-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the widget disabled state.
     * @order 202
     */
    @Prop({ reflect: true }) disabled: boolean = false;
    // #endregion

}
