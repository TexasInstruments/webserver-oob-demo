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

import { Component, Prop, h, Method, JSX, Element, Watch, Event, EventEmitter } from '@stencil/core';
import { FormatType } from '../gc-widget-input/gc-widget-input';
import { IColumnCellRendererFactory, IColumnCellRenderer, IRowOperations } from './IColumnCellRenderer';
import { ICellData } from './internal/TreeState';
import { DataConverter } from '../gc-core-databind/lib/CoreDatabind';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { WidgetGridColumnBaseProps as WidgetGridColumnBaseProps } from './gc-widget-grid-column-base-props';
import { WidgetGridColumnBase as WidgetGridColumnBase } from './gc-widget-grid-column-base';
import { WidgetSelect } from '../gc-widget-select/gc-widget-select';

export type DataColumnType = 'boolean' | FormatType;

interface IInputElementSelectionState {
    start: number;
    end: number;
    direction: 'forward' | 'backward' | 'none';
    editMode: boolean;
}

const EDIT_MODE = 'edit-mode';

class DataColumnRenderer implements IColumnCellRenderer {
    private editMode = false;

    constructor(private params: WidgetGridDataColumn, private callback: IRowOperations) {
    }

    private onCheckboxKeyHandler = (e: KeyboardEvent) => {
        // the default operation is prevented in the parent grid for the space bar which would be a page down.
        // So we must stop propagation to avoid the parent from also preventing the default checkbox operation too.
        if (e.key === ' ' || e.key === 'Escape') {
            e.stopPropagation();
        }
    };

    private onCheckedValueChangedHandler = (e: MouseEvent) => {
        const checkbox = e.currentTarget as HTMLInputElement;
        this.callback.commitEditValueChange(+checkbox.id, this.params.name, checkbox.checked);
    };

    private onInputBlurHandler = (e: FocusEvent) => {
        this.enableEditMode(e.currentTarget as HTMLElement, false);
        this.undoEdit(e.currentTarget as HTMLInputElement);
    };

    private onInputChangedHandler = (e: Event) => {
        let value: number | string = (e.currentTarget as HTMLInputElement).value;
        if (this.params.format !== 'text') {
            value = DataConverter.convert(value as string, 'string', 'number') as number;
            if (isNaN(value)) {
                return this.undoEdit(e.currentTarget as HTMLInputElement);
            }
        }
        this.callback.commitEditValueChange(+(e.currentTarget as HTMLInputElement).id, this.params.name, value);
        this.undoEdit(e.currentTarget as HTMLInputElement, true);
    };

    private undoEdit(widget: HTMLInputElement, selectAll = false) {
        // restore committed value to undo any user input not yet committed.
        const value = this.callback.getCommittedEditValue(+widget.id, this.params.name);
        const displayValue = DataConverter.convert(value, typeof value, this.params.format, this.params.precision) || '';
        widget.value = displayValue;
        if (selectAll) {
            widget.select();
        } else {
            widget.setSelectionRange(widget.value.length, widget.value.length, 'none');
        }
    }

    private enableEditMode(input: HTMLElement, enabled: boolean) {
        if (this.editMode !== enabled) {
            this.editMode = enabled;
            // @ts-ignore
            this.params.el.f2EditMode = enabled; // this is for databinding to the f2EditMode event as a property.
            this.params.editModeChanged.emit( { value: enabled });

            if (this.editMode !== input.classList.contains(EDIT_MODE)) {
                if (this.editMode) {
                    input.classList.add(EDIT_MODE);
                } else {
                    input.classList.remove(EDIT_MODE);
                }
            }
        }
    }

    private onInputKeyHandler = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'Escape':
                // revert any uncommitted user edit
                this.undoEdit(e.currentTarget as HTMLInputElement);
                break;
            case 'F2': {
                this.enableEditMode(e.currentTarget as HTMLInputElement, !this.editMode);
                e.stopPropagation();
                break;
            }
            case ' ':
                // stop propagation for spacebar to avoid preventing default operation.
                e.stopPropagation();
                break;
            case 'ArrowLeft':
            case 'ArrowRight':
            case 'Home':
            case 'End':
                if (this.editMode) {
                    e.stopPropagation(); // stop parent grid from performing any navigation until editMode disabled.
                }
                break;
        }
    };

    private onSelectChangedHandler = (e: CustomEvent) => {
        this.callback.commitEditValueChange(-1, this.params.name, e.detail.value);
    };

    private setFocusOnSelect = (e: FocusEvent) => {
        const focusTarget = e.currentTarget as HTMLElement;
        const droplist = focusTarget.firstElementChild as unknown as WidgetSelect;
        droplist?.setFocus?.();
    };

    private onSelectTabIntoHandler = (e: FocusEvent) => {
        (e.currentTarget as HTMLElement).parentElement.focus();
    };

    renderCell(row: number, data: ICellData, rowSelected: boolean, cellSelected: boolean, tabIndex: number): { element: JSX.Element; focusable: boolean } {
        const columnName = this.params.name;
        const value = data.getValue(columnName);
        const displayValue = DataConverter.convert(value, typeof value, this.params.format, this.params.precision) || '';
        const hide = value === undefined || this.params.minimized || this.params.hidden;
        let partName = data.getPartName(columnName);
        partName = partName ? ' ' + partName : '';

        let element: JSX.Element;
        if (this.params.format === 'boolean') {
            // JSXON
            element = <input type="checkbox" id={`${row}`} checked={displayValue || false}
                class="small" hidden={hide} disabled={this.params.readonly} onChange={this.onCheckedValueChangedHandler}
                tabIndex={tabIndex} onKeyDown={this.onCheckboxKeyHandler} part={`checkbox-editor${partName}`}
            />;
            // JSXOFF
        } else if (cellSelected && !this.params.readonly && !hide && this.params.options && this.params.options.length > 0) {
            // use select instead of input for editing cells
            const selectValues = GcUtils.parseArrayProperty(this.params.options);
            const selectLabels = selectValues.map( value => DataConverter.convert(value, typeof value, this.params.format, this.params.precision) );
            // JSXON
            element = <div tabIndex={-1} onFocus={this.setFocusOnSelect}>
                <gc-widget-select selected-value={value} values={this.params.options} preventEditWhenClosed
                    labels={`${selectLabels.join('|')}|`} onSelected-value-changed={this.onSelectChangedHandler}
                    part={`select-editor${partName}`} class="hiddenWithoutFocus"
                    style={{ '--gc-text-align': `${this.params.align}` }}
                />
                <span innerHTML={displayValue} class="hiddenWithFocus" tabIndex={tabIndex} onFocus={this.onSelectTabIntoHandler}/>
            </div>;
            // JSXOFF
        } else if (this.params.readonly || (this.params.options && this.params.options.length > 0)) {
            // JSXON
            element = <span hidden={hide} innerHTML={displayValue} tabIndex={tabIndex} part={partName}/>;
            // JSXOFF
        } else {
            // JSXON
            element = <input type="text" hidden={hide} id={`${row}`} value={displayValue}
                onBlur={this.onInputBlurHandler} onChange={this.onInputChangedHandler} class={`${cellSelected ? 'selected' : ''}`}
                onKeyDown={this.onInputKeyHandler} tabIndex={tabIndex} part={`input-editor${partName}`}
                readonly={data.isReadOnly(columnName)} style={{ margin: '0px', 'text-align': `${this.params.align}` }}
            />;
            // JSXOFF
        }
        return { element, focusable: !hide };
    }

    get align() {
        return this.params.align || 'start';
    }

    saveEditorSelectionState(widget: HTMLElement): IInputElementSelectionState | undefined {
        if (this.params.readonly) {
            return;
        }

        if (this.params.format === 'boolean') {
            return;
        }

        if (this.params.options && this.params.options.length > 0) {
            return; // we want the drop list menu to close when scrolling, so no need to save state.
        }

        const inputElement = (widget as HTMLInputElement);
        return {
            start: inputElement.selectionStart,
            end: inputElement.selectionEnd,
            direction: inputElement.selectionDirection,
            editMode: this.editMode
        };
    }

    restoreEditorSelectionState(widget: HTMLElement, options: { selectAll: boolean; selectionState?: IInputElementSelectionState; hint: string }) {
        if (this.params.readonly) {
            return;
        }

        if (this.params.options && this.params.options.length > 0) {
            if (options.hint === 'click' || options.hint === 'F2') {
                (widget.firstElementChild as unknown as WidgetSelect).setState(true);
            }
        } else if (this.params.format !== 'boolean') {
            const input = widget as HTMLInputElement;
            if (options.selectAll) {
                input.select();

            } else if (options.selectionState) {
                input.setSelectionRange?.(options.selectionState.start, options.selectionState.end, options.selectionState.direction);
            }
            this.enableEditMode(widget, options.hint === 'F2' || options.selectionState?.editMode || false);
        }
    }

    get hideFocusRectangle() {
        return !this.params.readonly && this.params.format !== 'boolean';
    }
}

/**
 * `gc-widget-grid-column` is added as children to the grid to define columns in the grid.
 *
 * @label Grid Data Column
 * @group Tables, Trees and Grids
 * @demo demo/dataColumn
 * @container
 * @archetype <gc-widget-grid-data-column name="data" heading="Data" layout></gc-widget-grid-data-column>
 * @usage
 * @css --gc-column-width | The width of this column (px)
 * @css --gc-text-align | The alignment of data in this column | { "kind": "select", "options": ["", "start", "center", "end"] }
 * @css --gc-font-color | The font color for the column heading | { "kind": "color" }
 * @css --gc-font-size | The font size for the column heading (px)
 * @css --gc-font-style | The font style for the column heading | { "kind": "select", "options": ["", "normal", "italic"] }
 * @css --gc-font-weight | The font weight for the column heading | { "kind": "select", "options": ["", "normal", "bold"] }
 * @css --gc-heading-color | The color for the column heading | { "kind": "color" }
 * @css --gc-heading-text-align | The alignment of heading text | { "kind": "select", "options": ["", "start", "center", "end" ]}
 * @css --gc-focus-color | The color of the focus rectangle for the column heading | { "kind": "color" }
 */
@Component({
    tag: 'gc-widget-grid-data-column',
    styleUrl: 'gc-widget-grid-column-base.scss',
    shadow: true
})

export class WidgetGridDataColumn implements WidgetGridColumnBaseProps, IColumnCellRendererFactory {
    align: 'start' | 'center' | 'end' = 'start';
    private base = new ( // keep on separate line to enable source mapping
        class extends WidgetGridColumnBase {
            get element() {
                return (this.parent as WidgetGridDataColumn).el;
            }
            parentGrid?: IRowOperations;
        })(this);

    private onCssStyleChanged = async () => {
        const align = await this.getCSSProperty('--gc-text-align') ?? 'start';
        if (align !== this.align && (align === 'start' || align === 'center' || align === 'end')) {
            this.align = align;
            this.base.parentGrid?.redraw();
        }
    };

    connectedCallback() {
        this.onCssStyleChanged();
        this.el.addEventListener('css-property-changed', this.onCssStyleChanged);
    }

    disconnectedCallback() {
        this.el.removeEventListener('css-property-changed', this.onCssStyleChanged);
    }

    /**
     * Method used by the gc-widget-grid to create a renderer that it can call during it's render() method to render individual
     * cells in this column.
     *
     * @hidden
     */
    @Method()
    async createCellRenderer(callback: IRowOperations): Promise<IColumnCellRenderer> {
        this.base.parentGrid = callback;
        return new DataColumnRenderer(this, callback);
    }

    /**
     * The format of the data displayed in this column.  For 'boolean' the data will be rendered as a checkbox.
     * @order 6
     */
    @Prop() format: DataColumnType = 'text';

    /**
     * The display format precision, only valid for numeric format type.<br><br>
     *
     * `binary` minimum digits with zero extended.<br>
     * `dec` number of decimal places to round to.<br>
     * `exp` number of decimal places to round to.<br>
     * `hex` minimum digits with zero extended.<br>
     * `q` the number of bits used to designate the fractional portion of the number.
     * @order 4
     */
    @Prop() precision?: number;

    /**
     * Flag indicating whether or not this column represents fixed non editable data.
     * @order 7
     */
    @Prop() readonly = false;

    /**
     * List of options for data values using comma (,), semi-colon (;) or pipe (|) delimiters.  While editing
     * a droplist of these options will be present for the user to select from.
     * @order 15
     */
    @Prop() options?: string;

    /**
     * Fired when the F2 edit mode is changed.  F2 edit mode is changed through user input; for example, pressing
     * the F2 key, or selecting a new cell in the grid to edit.
     **/
    @Event({ eventName: 'f2-edit-mode-changed' }) editModeChanged: EventEmitter<{ value: boolean }>;

    @Watch('format')
    @Watch('precision')
    @Watch('options')
    @Watch('readonly')
    @Watch('hidden')
    @Watch('hideMinimizeAction')
    @Watch('minimized') onColumnPropertyChanged() {
        this.base.parentGrid?.redraw();
    }

    @Watch('minimized')
    onMinimizedChanged() {
        this.minimizedChanged.emit({ value: this.minimized });
    }

    componentDidLoad() {
        this.el.style.setProperty('display', 'block', 'important');  // prevent [hidden] from setting display = "none".
    }

    render() {
        return this.base.renderHeader();
    }

    // #region gc-widget-grid/gc-widget-grid-column-base-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The column heading text for this column in the grid.  For line breaks, use \n to delimit multiple lines.
     * @order 3
     */
    @Prop() heading: string;

    /**
     * The name of the column.  This is used to identify column data in the data provider.
     * @order 2
     */
    @Prop() name: string;

    /**
     * Option to hide the minimize action in the heading of this column so that end users cannot control the minimized state.
     * @order 31
     */
    @Prop() hideMinimizeAction = false;

    /**
     * When true, this column is shown in a minimized state.
     * @order 30
     */
    @Prop({ reflect: true }) minimized = false;

    /**
     * Fired when the minimized state of this column changes.
     **/
    @Event({ eventName: 'minimized-changed' }) minimizedChanged: EventEmitter<{ value: boolean }>;
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

}
