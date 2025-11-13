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

import { Component, h, Prop, Event, EventEmitter, Element, Method, Watch, JSX } from '@stencil/core';
import { IColumnCellRenderer, IRowOperations, ICellData, IColumnCellRendererFactory, IEditorSelectionStateOptions } from '../gc-widget-grid/IColumnCellRenderer';
import { WidgetGridColumnBaseProps } from '../gc-widget-grid/gc-widget-grid-column-base-props';
import { WidgetGridColumnBase } from '../gc-widget-grid/gc-widget-grid-column-base';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';

const MAX_BITS_SUPPORTED = 32;
const CELL_WIDTH = 22;

function getGridStyle(bits: number, hide: boolean) {
    return {
        'display': hide ? 'none' : 'grid',
        'grid-template-columns': bits > MAX_BITS_SUPPORTED ? 'min-content' : `repeat(${bits}, ${CELL_WIDTH}px)`,
    };
}

class RegisterBitsColumnRenderer implements IColumnCellRenderer {
    private focusedElement?: HTMLElement;

    constructor(private params: WidgetRegisterBitsColumn, private parentTree: IRowOperations) {
    }

    private getCell(row: HTMLElement, bit: number) {
        if (bit < 0) {
            return undefined;
        }
        return row.querySelector(`span:nth-last-child(${bit+1})`) as HTMLElement;
    }

    private doToggleBit(cell?: HTMLElement) {
        const ids = cell?.id.split(':') ?? [];
        if (ids.length === 2) {  // readonly bits will have three sections. row:bit:R instead of row:bit
            const row = +ids[0];
            const bit = +ids[1];
            const oldValue = this.parentTree.getCommittedEditValue(row, this.params.name) as number;
            const mask = GcUtils.bitField.getMask(bit, bit);
            const newValue = GcUtils.bitField.writeField(oldValue, mask, bit, GcUtils.bitField.readField(oldValue, mask, bit) ^ 1);
            this.parentTree.commitEditValueChange(+ids[0], this.params.name, newValue);
        }
    }

    private onToggleBitClickHandler = (e: MouseEvent) => {
        this.doToggleBit(e.currentTarget as HTMLElement);
    };

    bitSelectClickHandler = (e: MouseEvent) => {
        const cell = e.target as HTMLElement;
        const ids = cell.id.split(':');
        if (ids.length > 1) {
            this.params.selectedBit = +ids[1];
            this.setFocusOnBit(e.currentTarget as HTMLElement, this.params.selectedBit);
        }
    };

    private setFocusOnBit(row: HTMLElement, bit: number) {
        const nextFocusedElement = this.getCell(row, bit);

        if (this.focusedElement && this.focusedElement !== nextFocusedElement) {
            this.focusedElement.classList.remove('focused');
            this.focusedElement = undefined;
        }

        this.focusedElement = nextFocusedElement;

        if (this.focusedElement && !this.focusedElement.classList.contains('focused')) {
            this.focusedElement.classList.add('focused');
            this.parentTree.scrollIntoViewHorizontally(this.focusedElement);
        }
    }

    private onFocusHandler = (e: FocusEvent) => {
        const row = e.currentTarget as HTMLElement;
        this.setFocusOnBit(row, this.params.selectedBit);
    };

    private onBlurHandler = (e: FocusEvent) => {
        this.setFocusOnBit(e.currentTarget as HTMLElement, -1);
    };

    onKeyboardHandler = (e: KeyboardEvent) => {
        let nextSelectedBit = this.params.selectedBit;
        const row = e.currentTarget as HTMLElement;

        switch (e.key) {
            case '1':
            case '0':
            case 'Enter':
            case ' ':
                // If the cell does not contain the desired value, attempt to toggle it.
                if ((this.getCell(row, nextSelectedBit)?.innerHTML ?? e.key) !== e.key) {
                    this.doToggleBit(this.getCell(row, nextSelectedBit));
                }
                e.stopPropagation();
                e.preventDefault();
                break;

            case 'F2':
                nextSelectedBit -= 1;  // compensate for fall through to arrow left which adds 1.
            case 'ArrowLeft':
                nextSelectedBit += 2;  // compensate for fall through to arrow right which subtracts 1.
            case 'ArrowRight':
                nextSelectedBit -= 1;
                if (nextSelectedBit >= 0 && nextSelectedBit < (this.params.dataBits || 1)) {
                    this.params.selectedBit = nextSelectedBit;
                    this.setFocusOnBit(row, nextSelectedBit);
                    e.stopPropagation();
                    e.preventDefault();
                }
                break;

            case 'Escape':
                this.setFocusOnBit(row, -1);
                e.stopPropagation();
                e.preventDefault();
                break;
        }
    };

    renderCell(row: number, data: ICellData, rowSelected: boolean, cellSelected: boolean, tabIndex: number): { element: JSX.Element; focusable: boolean } {
        const bits = this.params.dataBits || 1;
        const value = data.getValue('value') as number;
        const committedValue = value !== undefined ? data.getValue('committedValue') as number : 0;
        let mask = bits > MAX_BITS_SUPPORTED ? 1 : GcUtils.bitField.getMask(bits-1, bits-1);  // avoid exception thrown when bits > 32
        const hide = this.params.minimized || this.params.hidden;

        const bitCells = bits <= MAX_BITS_SUPPORTED ? new Array(bits).fill(null).map((_, i) => {
            const bit = bits - i - 1;
            let parts: string;
            let displayValue: string;
            let isReadonly: boolean;

            if (value !== undefined) {
                const isReserved = ((data.getValue('reservedMask') as number ?? 0) & mask) !== 0;
                isReadonly = isReserved || ((data.getValue('readonlyMask') as number ?? 0) & mask) !== 0;
                const isHidden = ((data.getValue('visibleMask') as number ?? -1) & mask) === 0;
                const isSelected = rowSelected ? ((this.params.selectedBitsMask || 0) & mask) !== 0 : false;
                displayValue = isReserved ? '-' : isHidden ? '' : GcUtils.bitField.readField(value, mask) ? '1' : '0';
                const isDeferred = (isReserved || isHidden || isReadonly) ? false : displayValue !== (GcUtils.bitField.readField(committedValue, mask) ? '1' : '0');
                parts = `bit-cell${isReadonly ? ' readonly' : ''}${isHidden ? ' empty' : ''}${isSelected ? ' selected' : ''}${isDeferred ? ' deferred' : ''}`;
            } else {
                displayValue = '';
                parts = 'bit-cell empty';
                isReadonly = true;
            }
            mask = mask >>> 1;

            // JSXON
            return <span id={`${row}:${bit}${isReadonly ? ':R' : ''}`} part={parts} onDblClick={this.onToggleBitClickHandler}>{displayValue}</span>;
            // JSXOFF
        }): [
            // JSXON
            <span/>
            // JSXOFF
        ];

        // JSXON
        const element = <div part="bits-container" tabIndex={tabIndex} style={getGridStyle(bits, hide)}
            onMouseDown={this.bitSelectClickHandler} onKeyDown={this.onKeyboardHandler}
            onFocus={this.onFocusHandler} onBlur={this.onBlurHandler}>{bitCells}</div>;
        // JSXOFF
        return { element, focusable: !hide };
    }

    align: 'start' | 'end' | 'center' = 'center';

    restoreEditorSelectionState?(widget: HTMLElement, options: IEditorSelectionStateOptions): void {
        switch (options.hint) {
            case 'ArrowRight':
            case 'Home':
                this.params.selectedBit = (this.params.dataBits || 1) - 1;
                break;
            case 'ArrowLeft':
            case 'End':
                this.params.selectedBit = 0;
                break;
        }
        this.setFocusOnBit(widget, this.params.selectedBit);
    }

    hideFocusRectangle = true;
}

/**
 * `gc-widget-register-bits-column` is added a child to the register grid to define show individual register bits for each register row.
 *
 * @label Register Grid Bits Column
 * @group Tables, Trees and Grids
 * @hidden
 * @css --gc-column-width | The width of this column (px)
 * @css --gc-font-color | The font color for the column heading | { "kind": "color" }
 * @css --gc-font-size | The font size for the column heading (px)
 * @css --gc-font-style | The font style for the column heading | { "kind": "select", "options": ["", "normal", "italic"] }
 * @css --gc-font-weight | The font weight for the column heading | { "kind": "select", "options": ["", "normal", "bold"] }
 * @css --gc-heading-color | The color for the column heading | { "kind": "color" }
 * @css --gc-heading-text-align | The alignment of heading text | { "kind": "select", "options": ["", "start", "center", "end"] }
 * @css --gc-focus-color | The color of the focus rectangle for the column heading | { "kind": "color" }
 * @css --gc-register-field-background-color-selected | { "kind": "color" }
 */

@Component({
    tag: 'gc-widget-register-bits-column',
    styleUrl: '../gc-widget-grid/gc-widget-grid-column-base.scss',
    shadow: true
})
export class WidgetRegisterBitsColumn implements WidgetGridColumnBaseProps, IColumnCellRendererFactory{
    private base = new ( // keep on separate line to enable source mapping
        class extends WidgetGridColumnBase {
            get element() {
                return (this.parent as WidgetRegisterBitsColumn).el;
            }
        })(this);

    /**
     * The number of bit columns to display.  If not specified, a minimum of one bit column will display.
     * Use the minimized or hidden properties to display no bit columns.
     */
    @Prop()
    dataBits: number;

    /**
     * A mask used to highlight a number of selected bits for the currently selected row.
     */
    @Prop()
    selectedBitsMask: number;

    /**
     * The currently selected bit column.
     */
    @Prop({ mutable: true })
    selectedBit = -1;

    /**
     * Fired when the currently selected bit column is changed.
     */
    @Event({ eventName: 'selected-bit-changed' }) selectedBitChanged: EventEmitter<{ value: number }>;

    @Watch('selectedBit')
    onSelectedBitChanged() {
        this.selectedBitChanged.emit({ value: this.selectedBit });
    }

    private onFocusHandler = () => {
        this.base.parentGrid?.setFocus();
    };

    render() {
        const bits = this.dataBits || 1;

        // JSXON
        const subHeadingCells = bits <= MAX_BITS_SUPPORTED ? new Array(bits).fill(null).map( (_, i) => {
            return <span part={`bit-cell${i === 0 ? ' first-child' : ''}`}>{bits - i - 1}</span>;
        }) : [
            <span part="bit-cell">{`Greater than ${MAX_BITS_SUPPORTED} bit wide registers are not supported`}</span>
        ];

        return <div style={{ 'display': 'flex', 'flex-direction': 'column' }}  tabIndex={-1} onFocus={this.onFocusHandler}>
            { this.base.renderHeader() }
            { this.hidden || this.minimized ? <div part="bits-header-padding">1</div> : null }
            <div  part="bits-container" style={getGridStyle(bits, this.hidden || this.minimized)}>{subHeadingCells}</div>
        </div>;
        // JSXOFF
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
        return new RegisterBitsColumnRenderer(this, callback);
    }

    @Watch('dataBits')
    @Watch('selectedBitsMask')
    @Watch('hidden')
    @Watch('hideMinimizeAction')
    @Watch('minimized') onColumnPropertyChanged() {
        this.base.parentGrid?.redraw();
    }

    @Watch('minimized')
    onMinimizedChanged() {
        this.minimizedChanged.emit({ value: this.minimized });
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
