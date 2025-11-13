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

import { WidgetBaseSelectorProps } from './gc-widget-base-selector-props';
import { WidgetBase } from './gc-widget-base';
import { GcConsole } from '../gc-core-assets/lib/GcConsole';

const console = new GcConsole('gc-widget-base-selector');

export type ValueType = number | string;

export interface IOption {
    index: number;
    label: string;
    value: ValueType;
    disabled: boolean;
}

/**
 * `WidgetBaseSelector` provides the base implementation for selector element.
 */
export abstract class WidgetBaseSelector extends WidgetBase {
    private options: Array<IOption> = [];
    private valuesArray: Array<ValueType> = [];
    private lastSelectedLabel?: string;
    private lastSelectedIndex?: number;
    private lastSelectedValue?: ValueType;
    private desired: undefined | 'Index' | 'Label' | 'Value' = undefined;
    private loaded: boolean = false;

    constructor(protected readonly parent: WidgetBaseSelectorProps) {
        super(parent);
    }

    initializeComponent() {
        if (this.loaded) return;

        const selectedIndex = this.parent.selectedIndex;
        const selectedValue = this.parent.selectedValue;
        const selectedLabel = this.parent.selectedLabel;

        this.loaded = true;
        this.labelsChanged();
        this.valuesChanged();
        this.sortedChanged();
        this.initialIndexChanged();

        if (typeof selectedLabel !== 'undefined') this.parent.selectedLabel = selectedLabel;
        if (typeof selectedValue !== 'undefined') this.parent.selectedValue = selectedValue;
        if (typeof selectedIndex !== 'undefined') this.parent.selectedIndex = selectedIndex;
    }

    protected abstract setOptions(options: IOption[]): void;
    protected abstract getValues(): Array<ValueType>;
    protected abstract getLabels(): Array<string>;
    /**
     * Get UI selected index.
     */
    protected abstract getSelectedIndex(): number;

    /**
     * Set UI selected index.
     * @param index
     */
    protected abstract setSelectedIndex(index: number): void;

    /**
     * Selection changed from UI.
     * @param index
     */
    protected abstract selectionChanged(index: number): void;

    protected getDisabledValues() {
        return new Array<ValueType>();
    }
    protected getSorted() {
        return false;
    }
    protected getSortedNumerically() {
        return false;
    }

    private findOption(propertyName: string, value: ValueType): null | { option: IOption; selectedIndex: number } {
        if (value !== null && value !== undefined && (propertyName !== 'index' || (value >= 0 && value < this.options.length))) {
            for (let i = this.options.length; i-- > 0;) {
                const option = this.options[i];

                // eslint-disable-next-line eqeqeq
                if (option[propertyName] == value) {
                    return { option: option, selectedIndex: i };
                }
            }
        }
        return null;
    }

    private updateProperties(selectedName?: 'Index' | 'Label' | 'Value', selectedProp?: ValueType) {
        let result = null;

        if (this.options.length > 0) {
            result =
                this.desired === undefined
                    ? this.findOption('index', this.parent.initialIndex === undefined ? this.parent.selectedIndex : this.parent.initialIndex)
                    : this.findOption(selectedName || this.desired.toLowerCase(), selectedProp || this.parent['selected' + this.desired]);
        }

        if (!result) {
            result = { option: { index: -1 }, selectedIndex: -1 };
        }

        if (result) {
            const option = result.option;
            if (this.desired !== 'Index' && this.parent.selectedIndex !== option.index) {
                this.lastSelectedIndex = option.index;
                this.parent.selectedIndex = option.index;
            }
            if (this.desired !== 'Label' && this.parent.selectedLabel !== option.label) {
                this.lastSelectedLabel = option.label;
                this.parent.selectedLabel = option.label;
            }
            // eslint-disable-next-line eqeqeq
            if (this.desired !== 'Value' && this.parent.selectedValue != option.value) {
                this.lastSelectedValue = option.value;
                this.parent.selectedValue = option.value;
            }
            if (result.selectedIndex !== this.getSelectedIndex()) {
                this.setSelectedIndex(result.selectedIndex);
            }
        } else {
            console.warning('Failed to update selected index, value, and label.');
        }
    }

    reset() {
        this.loaded = false;
    }

    private toNumberArrayIfAppropriate(stringArray: Array<ValueType>) {
        const isNumeric = stringArray.reduce((numeric, item: ValueType) => numeric && !isNaN(+item), true);
        return isNumeric ? stringArray.map(item => +item) : stringArray;
    }

    valuesChanged() {
        if (this.loaded) {
            this.valuesArray = this.toNumberArrayIfAppropriate(this.getValues());
            const disabledArray = this.getDisabledValues();
            if (this.valuesArray.length === 0) {
                this.valuesArray = undefined;
            }

            for (let i = this.options.length; i-- > 0;) {
                const option = this.options[i];
                option.value = this.valuesArray ? this.valuesArray[option.index] : option.index + 1;
                option.disabled = option.value ? disabledArray.includes(option.value.toString()) : false;
            }

            this.setOptions(this.options);
            this.updateProperties();
        }
    }

    labelsChanged() {
        if (this.loaded) {
            const labelsArray = this.getLabels();
            const disabledArray = this.getDisabledValues();
            this.valuesArray = this.getValues();
            this.options = [];

            for (let i = 0; i < labelsArray.length; i++) {
                const value = this.valuesArray ? this.valuesArray[i] : i + 1;
                const option: IOption = {
                    index: i,
                    label: labelsArray[i],
                    value: value,
                    disabled: value ? disabledArray.includes(value.toString()) : false
                };
                this.options.push(option);
            }

            if (this.getSorted()) {
                this.doSort();
            }

            this.setOptions(this.options);
            this.updateProperties();
        }
    }

    private doSort() {
        if (this.options.length > 0) {
            if (this.getSorted()) {
                if (!this.getSortedNumerically()) {
                    this.options = this.options.sort((a, b) => {
                        return a.label.toLocaleLowerCase().localeCompare(b.label.toLocaleLowerCase());
                    });
                } else {
                    this.options = this.options.sort((a, b) => {
                        return +a.label - +b.label;
                    });
                }
            } else {
                this.options = this.options.sort((a, b) => {
                    return a.index - b.index;
                });
            }
        }
    }

    sortedChanged() {
        if (this.loaded) {
            this.doSort();

            // update widget with new order of options
            this.setOptions(this.options);

            const result = this.findOption('index', this.parent.selectedIndex);
            this.setSelectedIndex(result === null ? -1 : result.selectedIndex);
        }
    }

    selectedValueChanged() {
        // eslint-disable-next-line eqeqeq
        if (this.loaded && this.parent.selectedValue != this.lastSelectedValue) {
            this.lastSelectedValue = this.parent.selectedValue;
            const i = this.getSelectedIndex();
            if (i === undefined || i === null) return;
            // eslint-disable-next-line eqeqeq
            if (i >= 0 && i < this.options.length ? this.options[i].value != this.parent.selectedValue : this.parent.selectedValue !== undefined) {
                this.desired = 'Value';
                this.updateProperties();
            }
        }
    }

    selectedLabelChanged() {
         if (this.loaded && this.parent.selectedLabel !== this.lastSelectedLabel) {
            this.lastSelectedLabel = this.parent.selectedLabel;
            const i = this.getSelectedIndex();
            if (i === undefined || i === null) return;
            if (i >= 0 && i < this.options.length ? this.options[i].label !== this.parent.selectedLabel : this.parent.selectedLabel !== undefined) {
                this.desired = 'Label';
                this.updateProperties();
            }
        }
    }

    selectedIndexChanged() {
        if (this.loaded && this.parent.selectedIndex !== this.lastSelectedIndex) {
            this.lastSelectedIndex = this.parent.selectedIndex;
            const i = this.getSelectedIndex();
            if (i === undefined || i === null) return;
            if (i >= 0 && i < this.options.length ? this.options[i].index !== this.parent.selectedIndex : this.parent.selectedIndex !== undefined) {
                this.desired = 'Index';
                this.updateProperties();
            }
        }
    }

    /**
     * UI selection changed.
     * @param index
     */
    onSelectionChanged(index: number) {
        if (this.desired === undefined) {
            // arbitrarily choose to preserve index if user makes changes before model does.
            this.desired = 'Index';
        }

        // const index = this.getSelectedIndex();
        const option = this.options[index];
        if (option) {
            this.parent.selectedIndex = option.index;
            // prevent changing the selectedValue if string value is the same as the numeric value, i.e 2 == '2'
            // eslint-disable-next-line eqeqeq
            if (this.parent.selectedValue != option.value) {
                this.parent.selectedValue = option.value;
            }
            this.parent.selectedLabel = option.label;
        }

        this.selectionChanged(index);
    }

    private initialIndexChanged() {
        if (this.loaded && this.desired === undefined) {
            const i = this.getSelectedIndex();
            if (i >= 0 && i < this.options.length ? this.options[i].index !== this.parent.initialIndex : this.parent.initialIndex !== undefined) {
                this.updateProperties();
            }
        }
    }
}