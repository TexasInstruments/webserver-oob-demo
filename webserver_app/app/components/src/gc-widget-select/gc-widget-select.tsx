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

import { h, Component, Prop, Event, EventEmitter, Element, Method, State, Watch, Listen } from '@stencil/core';
import { WidgetBaseSelector, ValueType, IOption } from '../gc-widget-base/gc-widget-base-selector';
import { WidgetBaseSelectorProps } from '../gc-widget-base/gc-widget-base-selector-props';
import { WidgetBaseTitleProps } from '../gc-widget-base/gc-widget-base-title-props';
import { WidgetBaseDisabledProps } from '../gc-widget-base/gc-widget-base-disabled-props';
import { WidgetBaseReadonlyProps } from '../gc-widget-base/gc-widget-base-readonly-props';
import { GcConsole } from '../gc-core-assets/lib/GcConsole';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { WidgetInputFilter } from '../gc-widget-input-filter/gc-widget-input-filter';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';

const console = new GcConsole('gc-widget-select');

// Is there a need to have a property to allow app to set escape characters?
const createFilterRegEx = (text: string) => {
    ['(', ')'].forEach(c => {
        text = text.replace(new RegExp(`\\${c}`, 'g'), `\\${c}`);
    });
    return new RegExp(`.*${text}.*`, 'i');
};

/**
 * `gc-widget-select` is a drop down selection widget, supporting standard select type and filter type.
 *
 * @label Select
 * @group Inputs
 * @css --gc-menuitem-background-color-hover | Menu item hover background color | { "kind": "color" }
 * @css --gc-menuitem-background-color-selected | Menu item selected background color | { "kind": "color" }
 * @css --gc-menuitem-border-color-selected | Menu item selected border color | { "kind": "color" }
 * @css --gc-menuitem-color-hover | Menu item hover font color | { "kind": "color" }
 * @css --gc-menuitem-color-selected | Menu item selected font color | { "kind": "color" }
 * @css --gc-text-align | Text align | { "kind": "select", "options": ["", "center", "left", "right"] }
 * @demo
 * @usage
 * @archetype <gc-widget-select labels="Apple,Orange,Peach,Banana" initial-index="0"></gc-widget-select>
 */
@Component({
    tag: 'gc-widget-select',
    styleUrl: 'gc-widget-select.scss',
    shadow: true
})
export class WidgetSelect implements WidgetBaseSelectorProps, WidgetBaseTooltipProps, WidgetBaseTitleProps, WidgetBaseDisabledProps, WidgetBaseReadonlyProps {
    private setInitialFilterValue = true;
    private menuElement: HTMLElement;
    private inputContainerElement: HTMLElement;
    private inputElement: WidgetInputFilter;
    private toggleMenu: boolean;
    private valuesArray: Array<string> = [];
    private labelsArray: Array<string> = [];
    private dialogElement: HTMLElement;

    private options: Array<IOption> = [];
    private selectedOptionIndex: number = -1;

    private oldFilterText: string;
    private filterFunction: (options: IOption[]) => IOption[];

    private base = new (
        class extends WidgetBaseSelector {
            get widget() {
                return this.parent as WidgetSelect;
            }
            get element() {
                return this.widget.el;
            }
            setOptions(options: IOption[]) {
                this.widget.options = options;
                if (this.widget.filterFunction) {
                    this.widget.filteredOptions = this.widget.filterFunction(options);
                } else {
                    const filterRegex = createFilterRegEx(this.widget.filterText);
                    this.widget.filteredOptions = options.filter((option) => option.label.match(filterRegex));
                }
            }
            protected getValues(): (string | number)[] {
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
                    this.widget.inputText = this.widget.options[index].label;
                }
            }
            protected selectionChanged(index: number): void {
                if (index >= 0 && index < this.widget.options.length) {
                    console.debug(`Selection changed, option=${JSON.stringify(this.widget.options[index])}`);
                    this.widget.selectedIndex = this.widget.options[index].index;
                    this.widget.inputText = this.widget.selectedLabel;
                    this.widget.highlightedOptionIndex = index;
                }
            }
            protected getSorted() {
                return this.widget.sorted;
            }
        })(this);

    /**
     * The type of selection. `select` type provides a list of items in the drop down menu when pressed,
     * and `filter` type provides a text input to allow entering text to filter the available items in
     * the drop down menu.
     *
     * @order 2
     */
    @Prop({ reflect: true }) type: 'select'|'filter' = 'select';

    /**
     * A list of textual labels to be displayed in the drop down menu. The list of labels are separated by ',', '|', or ';'.
     *
     * @order 3
     */
    @Prop() labels: string;

    /**
     * A list of values for the drop down menu options. This list should be the same length as the the list of
     * the labels; otherwise the values extra options will have undefined values. The list of values are
     * separated by ',', '|', or ';'.
     *
     * @order 4
     */
    @Prop() values: string;

    /**
     * The text to display when nothing has been entered into the input box.
     *
     * @order 5
     */
    @Prop() placeholder: string;

    /**
     * Set to `true` to sort the list of labels alphabetically.
     *
     * @order 6
     */
    @Prop() sorted: boolean;

    /**
     * For filter type. Sets to `true` to automatic open the drop down menu when the input box is pressed.
     *
     * @order 7
     */
    @Prop() autoOpen: boolean = false;

    /**
     * For filter type. The text input value of this widget, the value can be a regular expression.
     *
     * @order 8
     */
    @Prop({ mutable: true }) filterText: string = '';

    /**
     * Fired when the `filterText` property has changed.
     */
    @Event({ eventName: 'filter-text-changed' }) filterTextChanged: EventEmitter<{ value: string }>;

    /**
     * Fired when the 'filterText` property has committed.
     */
    @Event({ eventName: 'filter-text-committed' }) filterTextCommitted: EventEmitter<{ value: string }>;

    /**
     * The maximum number of drop down menu options to show.
     *
     * @order 9
     */
    @Prop() maxVisibleItems: number = 4;

    /**
     * For filter type. Pattern used for full match regular expression validation of the value.
     * @order 10
     */
    @Prop() pattern: string;

    /*
     * Set to true to prevent changing the selection using the arrow keys, when the drop down menu is closed.
     *
     * @order 36
     */
    @Prop() preventEditWhenClosed: boolean = false;

    /**
     * Sets the filter function to provide custom filter for the dropdown menu.
     * This function should be set when the widget type is a 'filter'.
     *
     * @param callback the filter callback function, call when the filterText changed
     */
    @Method()
    async setFilterFunction(callback: (options: IOption[]) => IOption[]) {
        this.filterFunction = callback;
    }

    /* internal states */
    @State() opened: boolean = false;
    @State() highlightedOptionIndex: number = -1;
    @State() filteredOptions: Array<IOption> = [];
    @State() inputText: string;
    @State() uncommittedChanges: boolean = false;

    render() {
        return this.base.render(
            // JSXON
            <div id='root-container' class={ this.uncommittedChanges ? 'dirty' : '' }>
                <div id='input-container' ref={ (el: Element) => this.inputContainerElement = el as HTMLElement }>
                    <gc-widget-input-filter
                        class={ this.type }
                        ref={ (el: Element) => this.inputElement = el as unknown as WidgetInputFilter }
                        intermediateChanges
                        readonly={ this.readonly || (this.type === 'select' && !this.disabled) }
                        disabled={ this.disabled }
                        selectOnFocus={ this.type === 'filter' }
                        placeholder={ this.placeholder }
                        value={ this.inputText }
                        pattern={ this.pattern }
                        hasClearIcon={ this.type === 'filter' }
                        onClear-icon-clicked={ this.onClearIconMouseDownHdlr }
                        onKeyDown={ this.onInputKeyDownHdlr }
                        onMouseDown={ this.onInputMouseDownHdlr }
                    >
                    </gc-widget-input-filter>
                    {
                        this.type === 'filter' && this.uncommittedChanges ?
                            <gc-widget-icon id='warning-icon' icon='notification:priority_high' size='s' appearance='custom' tooltip='Press enter to commit changes.' /> : undefined
                    }
                    <div id='arrow-icon-wrapper' onMouseDown={ this.onInputIconMouseDownHdlr }>
                        <gc-widget-icon id='menu-icon' icon='navigation:expand_more' size='s' />
                    </div>
                </div>

                {
                    this.opened ?
                        <div onWheel={this.stopPropagation}
                            id="menu"
                            ref={ (el: Element) => this.menuElement = el as HTMLElement }>
                            {
                                this.filteredOptions.map((option, index) =>
                                    <div
                                        class={ `menu-item ${index === this.selectedOptionIndex ? 'selected' : ''} ${index === this.highlightedOptionIndex ? 'highlighted' : ''}` }
                                        onMouseDown={ () => this.onMenuMouseDownItemHdlr(index) }
                                    >{ option.label }</div>
                                )
                            }
                        </div> : null
                }
            </div>,
            { caption: this.caption, infoText: this.infoText, tooltip: this.tooltip }
            // JSXOFF
        );
    }

    componentDidRender() {
        if (this.setInitialFilterValue && this.type === 'filter' && this.inputElement) {
            this.setInitialFilterValue = false;
            this.inputElement.value = this.filterText;
        }

        if (this.opened) {
            this.updateMenuPosition();

            // make selected or highlighted menu item visible
            let item = undefined;
            if (this.type === 'filter') {
                item = this.el.shadowRoot.querySelector('.menu-item.highlighted');
            }
            if (!item) {
                item = this.el.shadowRoot.querySelector('.menu-item.selected');
            }

            if (item) {
                item.scrollIntoView();
            }
        }
    }

    componentWillLoad() {
        this.selectedValue = this.fixSelectedValue(this.selectedValue);
        this.onLabelsChanged();
        this.onValuesChanged();
        this.base.initializeComponent();
    }

    connectedCallback() {
        // add resize listener to a gc-widget-dialog to close the menu
        let parent = this.el.parentElement;
        while (parent && parent !== parent.parentElement) {
            if (parent.tagName === 'GC-WIDGET-DIALOG') {
                this.dialogElement = parent;
                this.dialogElement.addEventListener('dialog-resize', this.resizeHandler);
                break;
            }
            parent = parent.parentElement;
        }
    }

    disconnectedCallback() {
        if (this.dialogElement) {
            this.dialogElement.removeEventListener('dialog-resize', this.resizeHandler);
            this.dialogElement = undefined;
        }
    }

    private fixSelectedValue(value: number|string) {
        if (typeof value === 'string') {
            const myVale = +value;
            if (!isNaN(myVale)) {
                return myVale;
            }
        }
        return value;
    }

    private updateMenuPosition() {
        if (this.opened) {
            const style = this.menuElement.style;

            if (this.menuElement.children.length > 0) {
                const inputContainerRect = this.inputContainerElement.getBoundingClientRect();

                /* max height */
                const itemHeight = this.menuElement.children[0].getBoundingClientRect().height;
                const maxHeight = itemHeight * Math.min(this.maxVisibleItems, this.menuElement.children.length);
                style.height = maxHeight + 2 /* border */ + 'px';

                /* top */
                const menuElementRect = this.menuElement.getBoundingClientRect();
                const screenHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
                if (menuElementRect.height + inputContainerRect.top + inputContainerRect.height > screenHeight) {
                    style.top = (inputContainerRect.top - menuElementRect.height) + 'px';
                } else {
                    style.top = (inputContainerRect.top + inputContainerRect.height) + 'px';
                }

                /* left & width, -1 and +2 account for border width */
                style.left = inputContainerRect.left - 1 + 'px';
                style.width = inputContainerRect.width + 2 + 'px';

            } else {
                style.width = style.height = 0 + 'px';
            }
        }
    }

    @Watch('filterText')
    onFilterTextChanged() {
        if (this.type === 'filter' && this.oldFilterText !== this.filterText) {
            this.inputText = this.filterText;
            if (this.inputElement) {
                this.inputElement.value = this.filterText;
            }
            this.filterTextChanged.emit({ value: this.filterText });
        }
    }

    @Watch('labels')
    onLabelsChanged() {
        this.labelsArray = GcUtils.parseArrayProperty(this.labels) || [];

        if (this.valuesArray.length < this.labelsArray.length ) {
            for (let i = this.valuesArray.length; i < this.labelsArray.length; ++i) {
                this.valuesArray.push((i+1).toString());
            }
        }
        this.base.labelsChanged();
    }

    @Watch('values')
    onValuesChanged() {
        this.valuesArray = GcUtils.parseArrayProperty(this.values) || [];

        if (this.valuesArray.length < this.labelsArray.length ) {
            for (let i = this.valuesArray.length; i < this.labelsArray.length; i++) {
                this.valuesArray.push((i+1).toString());
            }
        }
        this.base.valuesChanged();
    }

    @Watch('selectedLabel')
    onSelectedLabelChanged(newValue: string, oldValue: string) {
        this.base.selectedLabelChanged();
        if (this.type === 'filter') {
            this.filterText = newValue;
        }
        this.selectedLabelChanged.emit({ value: newValue /*, oldValue: oldValue*/ });
    }

    @Watch('selectedValue')
    onSelectedValueChanged(newValue: any, oldValue: ValueType) {
        this.base.selectedValueChanged();
        this.selectedValueChanged.emit({ value: newValue /*, oldValue: oldValue*/ });
    }

    @Watch('selectedIndex')
    onSelectedIndexChanged(newValue: number, oldValue: number) {
        this.base.selectedIndexChanged();
        this.selectedIndexChanged.emit({ value: newValue });
    }

    @Watch('sorted')
    onSortedChanged() {
        this.base.sortedChanged();
    }

    @Watch('opened')
    onOpenedChanged() {
        if (this.opened) {
            if (this.type === 'filter') {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                this.onInputChangeHdlr({ detail: { value: this.filterText }});

                this.highlightedOptionIndex = this.selectedOptionIndex;
            }

            let parent = this.el.parentElement as Element;
            while (parent && parent !== parent.parentElement) {
                parent.addEventListener('scroll', this.scrollHandler);
                parent = parent.parentElement || (parent.getRootNode() as ShadowRoot).host;
            }
            window.addEventListener('scroll', this.scrollHandler);
            window.addEventListener('wheel', this.scrollHandler);
        } else {
            let parent = this.el.parentElement as Element;
            while (parent && parent !== parent.parentElement) {
                parent.removeEventListener('scroll', this.scrollHandler);
                parent = parent.parentElement || (parent.getRootNode() as ShadowRoot).host;
            }
            window.removeEventListener('scroll', this.scrollHandler);
            window.removeEventListener('wheel', this.scrollHandler);
        }
    }

    @Listen('blur')
    onInputBlurHdlr() {
        if (!this.toggleMenu) {
            this.opened = false;
        }

        if (this.type === 'filter') {
            this.doCommitChanges();
        }
    }

    @Listen('value-changed')
    onInputChangeHdlr(e: CustomEvent) {
        if (this.type === 'filter') {
            this.filterText = e.detail.value;
            // save current highlighted option
            let index = this.highlightedOptionIndex;
            if (this.highlightedOptionIndex >= 0 && this.highlightedOptionIndex < this.filteredOptions.length) {
                index = this.filteredOptions[this.highlightedOptionIndex].index;
            }

            try {
                // update filtered options
                if (this.filterFunction) {
                    this.filteredOptions = this.filterFunction(this.options);
                } else {
                    const filterRegex = createFilterRegEx(this.filterText);
                    this.filteredOptions = this.options.filter((option) => option.label.match(filterRegex));
                }

                // update highlighted index;
                if (index >= 0) {
                    let found = false;
                    for (let i = 0; !found && i < this.filteredOptions.length; ++i) {
                        if (this.filteredOptions[i].index === index) {
                            this.highlightedOptionIndex = i;
                            found = true;
                        }
                    }
                    if (!found) this.highlightedOptionIndex = Math.min(index, this.filteredOptions.length-1);
                }

                // update selected option index
                this.selectedOptionIndex = -1;
                for (let i = 0; i < this.filteredOptions.length; ++i) {
                    if (this.filteredOptions[i].index === this.selectedIndex) {
                        this.selectedOptionIndex = i;
                        break;
                    }
                }
            } catch (e) {
                //ignore malformed regex
            }
        } else {
            this.filteredOptions = this.options;
        }
    }

    private doCommitChanges() {
        if (this.type === 'filter') {
            // user hasn't make any selection yet
            if (this.highlightedOptionIndex === -1) {

                if (this.filteredOptions.length === 0) {
                    this.selectedIndex = -1;

                } else {
                    for (let i = 0; i < this.filteredOptions.length; ++i) {
                        if (this.filteredOptions[i].label === this.filterText) {
                            const index = this.getOptionIndex(this.filteredOptions[i].index);
                            this.base.onSelectionChanged(index);
                            break;
                        }
                    }
                }

            // user has navigated with keyboard to make a selection
            } else if (this.highlightedOptionIndex >= 0 && this.filteredOptions.length > this.highlightedOptionIndex) {
                if (this.highlightedOptionIndex !== this.selectedOptionIndex) {
                    const tmp = this.filteredOptions[this.highlightedOptionIndex];
                    this.base.onSelectionChanged(this.getOptionIndex(tmp.index));

                } else {
                    for (let i = 0; i < this.filteredOptions.length; ++i) {
                        if (this.filteredOptions[i].label === this.filterText) {
                            const index = this.getOptionIndex(this.filteredOptions[i].index);
                            this.base.onSelectionChanged(index);
                            break;
                        }
                    }
                }
            }
            this.inputElement.value = this.filterText;
            this.fireFilterTextCommitted();
        }
    }

    private fireFilterTextCommitted() {
        if (this.filterText !== this.oldFilterText) {
            this.oldFilterText = this.filterText;
            this.filterTextCommitted.emit({ value: this.filterText });
        }
        this.uncommittedChanges = false;
    }

    private resizeHandler = () => this.onInputBlurHdlr();
    private scrollHandler = (e: Event) => {
        if (e.target !== this.el) {
            this.onInputBlurHdlr();
        }
    };

    private onInputMouseDownHdlr = () => {
        if (this.disabled) return;

        if (this.type === 'select') {
            this.onInputIconMouseDownHdlr();

        } else if (this.autoOpen) {
            this.opened = true;
        }
    };

    private onClearIconMouseDownHdlr = () => {
        if (this.disabled) return;

        setTimeout(() => {
            this.inputElement.setFocus().then(() => {
                if (this.autoOpen) {
                    this.opened = true;
                }
            });
        }, 10);
    };

    private onInputKeyDownHdlr = (e: KeyboardEvent) => {
        if (this.disabled || this.readonly) return;

        if (e.code === 'Escape') {
            this.opened = false;
        } else if (e.code === 'F2') {
            this.opened = true;
        } else if (e.code === 'ArrowDown') {
            this.scrollMenu(1, e);
        } else if (e.code === 'ArrowUp') {
            this.scrollMenu(-1, e);
        } else if (e.code === 'PageDown') {
            this.scrollMenu(this.maxVisibleItems + 1, e);
        } else if (e.code === 'PageUp') {
            this.scrollMenu(-this.maxVisibleItems - 1, e);
        } else if (e.code === 'Home') {
            if (this.type === 'filter') {
                this.highlightedOptionIndex = 0;
            } else {
                this.selectedIndex = this.filteredOptions[0].index;
                e.stopPropagation();
                e.preventDefault();
            }
        } else if (e.code === 'End') {
            if (this.type === 'filter') {
                this.highlightedOptionIndex = this.filteredOptions.length - 1;
            } else {
                this.selectedIndex = this.filteredOptions[this.filteredOptions.length - 1].index;
                e.stopPropagation();
                e.preventDefault();
            }
        } else if (e.code === 'Enter') {
            this.doCommitChanges();
            this.opened = false;
        } else if (e.key.length === 1 || e.code === 'Backspace' || e.code === 'Delete') {
            if (this.type === 'filter') {
                this.opened = true;
                this.uncommittedChanges = true;
            }
        }
    };

    private onInputIconMouseDownHdlr = () => {
        if (this.disabled) return;

        this.toggleMenu = true;

        /* if opened is true, it will cause a re-render */
        this.opened = !this.opened;

        this.inputElement.setFocus().then(() => {
            this.toggleMenu = false;
        });
    };

    private getOptionIndex(index: number) {
        for (let i = 0; i < this.options.length; ++i) {
            if (index === this.options[i].index) {
                return i;
            }
        }
    }

    private onMenuMouseDownItemHdlr(index: number) {
        const i = this.getOptionIndex(index);
        if (i >= 0) {
            this.base.onSelectionChanged(this.options[i].index);
            this.inputElement.setFocus().then(() => {
                if (this.type === 'filter') {
                    this.filterText = this.options[i].label;
                    this.fireFilterTextCommitted();
                }
                this.opened = false;
            });
        }
    }

    private stopPropagation = (e: Event) => {
        e.stopPropagation();
    };

    private scrollMenu(position: number, e: Event) {
        if (!this.opened && this.preventEditWhenClosed) {
            return;
        }

        e.stopPropagation();
        e.preventDefault();

        if (this.filteredOptions.length > 0) {
            let selectedToIndex = this.filteredOptions[0].index;
            let optionIndex = this.type === 'select' ? this.selectedOptionIndex : this.highlightedOptionIndex;
            if (optionIndex >= 0) {
                selectedToIndex = this.filteredOptions[optionIndex].index;
                for (let i = 0; i < this.filteredOptions.length; ++i) {
                    if (this.filteredOptions[i].index === selectedToIndex) {
                        optionIndex = i + position;
                        optionIndex = optionIndex < this.filteredOptions.length ? optionIndex : this.filteredOptions.length-1;
                        optionIndex = optionIndex >= 0 ? optionIndex : 0;
                        selectedToIndex = this.filteredOptions[optionIndex].index;
                        break;
                    }
                }
            } else {
                optionIndex = 0;
            }

            console.debug(`Scroll to option=${JSON.stringify(this.filteredOptions[optionIndex])}`);
            if (this.type === 'select') {
                this.selectedIndex = selectedToIndex;
            } else {
                this.highlightedOptionIndex = optionIndex;
            }
        }
    }

    /**
     * Method to set the opened state of the drop down menu for the select widget.
     * @param opened true to open the menu, and false to close it.
     */
    @Method()
    async setState(opened: boolean) {
        this.opened = opened;
    }

    /**
     * Method to programmatically set the focus on this widget.
     */
    @Method()
    async setFocus() {
        if (!this.opened) {
            return this.inputElement.setFocus();
        }
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
    // #region gc-widget-base/gc-widget-base-tooltip-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the tooltip that is displayed for this widget.
     * @order 210
     */
    @Prop() tooltip: string;
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
    // #region gc-widget-base/gc-widget-base-readonly-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the widget readonly state.
     * @order 201
     */
    @Prop({ reflect: true }) readonly: boolean = false;
    // #endregion

}
