/**
 *  Copyright (c) 2021 Texas Instruments Incorporated
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

import { h, Component, Prop, Event, EventEmitter, Element, Method, State, Watch, Listen } from '@stencil/core';
import { IOption, ValueType, WidgetBaseSelector } from '../gc-widget-base/gc-widget-base-selector';
import { WidgetBaseSelectorProps } from '../gc-widget-base/gc-widget-base-selector-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { WidgetBaseReadonlyProps } from '../gc-widget-base/gc-widget-base-readonly-props';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';

/**
 * `gc-widget-listbox` is a widget that allows the user to select item from a list of options.
 *
 * @label Listbox
 * @group Inputs
 * @border
 * @demo
 * @usage
 * @archetype <gc-widget-listbox labels="Item 1,Item 2,Item 3"></gc-widget-listbox>
 */
@Component({
    tag: 'gc-widget-listbox',
    styleUrl: 'gc-widget-listbox.scss',
    shadow: true
})
export class WidgetListbox implements WidgetBaseSelectorProps, WidgetBaseTitleProps, WidgetBaseReadonlyProps, WidgetBaseDisabledProps {
    private internalLabelsAndValuesChange: boolean;
    private valuesArray: ValueType[];
    private labelsArray: string[];

    @State() private selectedOptionIndex: number = -1;
    @State() private options: Array<IOption> = [];

    private base = new ( // keep on separate line to enable source mapping
        class extends WidgetBaseSelector {
            get widget() {
                return this.parent as WidgetListbox;
            }
            get element() {
                return this.widget.el;
            }
            protected setOptions(options: IOption[]): void {
                this.widget.options = options;
            }
            protected getValues(): ValueType[] {
                return this.widget.valuesArray;
            }
            protected getLabels(): string[] {
                return this.widget.labelsArray;
            }
            protected getSelectedIndex(): number {
                return this.widget.selectedOptionIndex;
            }
            protected setSelectedIndex(index: number): void {
                if (index >= 0 && index < this.widget.options.length) {
                    this.widget.selectedOptionIndex = index;
                }
            }
            protected selectionChanged(index: number): void {
                if (index >= 0 && index < this.widget.options.length) {
                    this.widget.selectedIndex = this.widget.options[index].index;
                }
            }
            protected getSorted() {
                return this.widget.sorted;
            }
        })(this);

    /**
     * A list of textual labels to be displayed in the options list. The list of labels are separated by ',', '|', or ';'.
     *
     * @order 2
     */
    @Prop({ mutable: true }) labels: string;

    /**
     * A list of values for the options list. This list should be the same length as the the list of
     * the labels and should be unique. The list of values are separated by ',', '|', or ';'.
     *
     * @order 3
     */
    @Prop({ mutable: true }) values: string;

    /**
     * Sets to `true` to sort the list of labels alphabetically.
     *
     * @order 4
     */
    @Prop() sorted: boolean;

    /**
     * If `true`, a delete icon will be displayed at the right side of the item when hovered.
     * Clicking on the icon will remove the item from the list.
     *
     * @order 5
     */
    @Prop({ reflect: true }) hasDeleteIcon: boolean;

    render() {
        // JSXON
        return this.base.render(
            this.options.map((option, index) =>
                <div key={ this.options[index].index } tabindex="-1" class={ this.selectedOptionIndex === index ? 'row selected' : 'row' }
                    on-click={ (e: MouseEvent) => !this.el.attributes['disabled'] && !this.el.attributes['readonly'] ?
                        this.selectedIndex = this.options[index].index : undefined }
                >
                    <div class='label'>{ option.label }</div>
                    {
                        this.hasDeleteIcon ?
                            <div class='icon-wrapper'>&nbsp;
                                <gc-widget-icon
                                    icon='content:delete_sweep'
                                    size='s'
                                    appearance='custom'
                                    on-click={ (e: MouseEvent) => {
                                        this.removeOption(index);
                                        e.preventDefault();
                                        e.cancelBubble = true;
                                    }}
                                >
                                </gc-widget-icon>
                            </div >: undefined
                    }
                </div>
            ),
            { caption: this.caption, infoText: this.infoText, tabIndex: 0 }
        );
        // JSXOFF
    }

    @Listen('keydown')
    onKeydownHdlr(e: KeyboardEvent) {
        if (this.el.attributes['readonly'] || this.el.attributes['disabled']) return;

        let index = undefined;
        if (e.code === 'ArrowDown' && this.selectedOptionIndex < this.options.length-1) {
            this.selectedIndex = this.options[index = ++this.selectedOptionIndex].index;

        } else if (e.code === 'ArrowUp' && this.selectedOptionIndex > 0) {
            this.selectedIndex = this.options[index = --this.selectedOptionIndex].index;
        }

        if (index !== undefined) {
            e.preventDefault();
            e.cancelBubble = true;
            const element = this.el.shadowRoot.querySelectorAll('.row')[index].children[0];
            element.scrollIntoView({ block: 'nearest' });
        }
    }

    private removeOption(optionIndex: number) {
        if (GcUtils.isInDesigner) {
            return;
        }

        this.internalLabelsAndValuesChange = true;
        const index = this.options[optionIndex].index;

        /* clear selection if selected item is removed, force fire change events */
        if (this.selectedIndex === index) {
            this.selectedOptionIndex = this.selectedIndex = -1;
            this.selectedIndexChanged.emit({ value: -1 });

            this.selectedValue = null;
            this.selectedValueChanged.emit({ value: null });

            this.selectedLabel = null;
            this.selectedLabelChanged.emit({ value: null });
        }

        /* update labels */
        if (this.labels?.length > index) {
            const delimiter = GcUtils.parseDelimiter(this.labels);
            const array = GcUtils.parseArrayProperty(this.labels);
            array.splice(index, 1);
            this.labels = array.join(delimiter);
        }

        /* update values */
        if (this.values?.length > index) {
            const delimiter = GcUtils.parseDelimiter(this.values);
            const array = GcUtils.parseArrayProperty(this.values);
            array.splice(index, 1);
            this.values = array.join(delimiter);
        }

        /* reinitialize component */
        this.base.reset();
        this.initializeComponent(false);
        this.reloadComponent();

        this.internalLabelsAndValuesChange = false;
    }

    componentWillLoad() {
        this.initializeComponent();
        this.reloadComponent();
    }

    private reloadComponent() {
        this.base.initializeComponent();
    }

    private initializeComponent(setInitialIndex = true) {
        this.labelsArray =  GcUtils.parseArrayProperty(this.labels) || [];
        this.valuesArray =  GcUtils.parseArrayProperty(this.values) || [];

        if (setInitialIndex && this.initialIndex && !GcUtils.isInDesigner) {
            this.selectedIndex = this.initialIndex;
        }
    }

    @Watch('labels')
    @Watch('values')
    onLabelsOrValuesChanged() {
        if (!this.internalLabelsAndValuesChange) {
            this.selectedOptionIndex = -1;
            this.base.reset();
            this.initializeComponent();
            this.reloadComponent();
        }
    }

    @Watch('selectedIndex')
    onSelectedIndexChanged(newValue: number, oldValue: number) {
        this.base.selectedIndexChanged();
        this.selectedIndexChanged.emit({ value: newValue });
    }

    @Watch('selectedValue')
    onSelectedValueChanged(newValue: any, oldValue: any) {
        this.base.selectedValueChanged();
        this.selectedValueChanged.emit({ value: newValue });
    }

    @Watch('selectedLabel')
    onSelectedLabelChanged(newValue: string, oldValue: string) {
        this.base.selectedLabelChanged();
        this.selectedLabelChanged.emit({ value: newValue });
    }

    @Watch('sorted')
    onSortedChanged() {
        this.base.sortedChanged();
    }

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
    // #region gc-widget-base/gc-widget-base-readonly-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the widget readonly state.
     * @order 201
     */
    @Prop({ reflect: true }) readonly: boolean = false;
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
