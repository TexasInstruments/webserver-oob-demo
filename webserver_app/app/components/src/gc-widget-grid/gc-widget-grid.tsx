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

import { Component, h, Prop, Event, EventEmitter, Element, Method, Watch, State, JSX } from '@stencil/core';
import { TreeStates, IRowIterator, FilterGridByRowCallback, ExpandedStatesMap } from './internal/TreeState';
import { IColumnCellRendererFactory, IColumnCellRenderer, IRowOperations, IEditorSelectionStateOptions } from './IColumnCellRenderer';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { IDataProvider } from './lib/IDataProvider';
import { GcConsole } from '../gc-core-assets/lib/GcConsole';

// this map is used to listen to flex attribute changes on child columns in the designer to force a redraw of the grid.
const flexAttributeMap = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'].reduce( (map, name, i) => {
    map.set(name, i);
    return map;
}, new Map<string, number>());

/**
 * `gc-widget-grid` is an editable grid with rows and columns.  This widget also support a tree column.
 *
 * @label Grid
 * @group Tables, Trees and Grids
 * @demo
 * @usage
 * @container
 * @border
 * @archetype <gc-widget-grid layout horizontal style="height: 300px; width: 400px"></gc-widget-grid>
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
    tag: 'gc-widget-grid',
    styleUrl: 'gc-widget-grid.scss',
    shadow: true
})
export class WidgetGrid implements WidgetBaseProps, IRowOperations {
    private gridContent: HTMLElement;
    private scrollContainer: HTMLElement;
    private grid: HTMLElement;
    private treeStates = new TreeStates();
    private startRow = 0;
    private nVisibleRows = 0;
    private pageSize = 1;
    private pageHeight = 1;
    private activeSelectedRow = -1;
    private activeSelectedColumn = -1;
    private setFocusAfterRender?: FocusOptions & IEditorSelectionStateOptions;
    private editorSelectionState?: { path: string; column: number; selectionState: unknown };
    private resizeObserver?: ResizeObserver;
    private childObserver?: MutationObserver;
    private rowHeight = 24;
    private columnHeadings: HTMLElement[] = [];
    private filterFn?: FilterGridByRowCallback;
    private logger: GcConsole;
    private savedExpandedStatesMap = new Map<string, ExpandedStatesMap>();
    private activeDataProviderId = '';

    @State() activeSelection?: IRowIterator;
    @State() cellEditorEnabled = false;
    @State() scrollTop = 0;
    @State() totalRows = 0;
    @State() columns: IColumnCellRenderer[] = [];

    private updateTotalRowCount = (extraRows?: number) => {
        const rowCount = this.treeStates.totalRowCount;
        if (this.totalRows !== rowCount) {
            this.totalRows = rowCount;
            if (this.activeSelection) {
                this.selectedRow = this.activeSelection.pos;
            }
            this.logger.debug(`Total number of rows changed to ${rowCount}`);
        } else if (extraRows === 0) {
            this.refresh();
        }
    };

    /**
     * Use a virtual dom, and only create the rows that are actually visible.  This is necessary if you have
     * virtual data, but it can improve performance too.  If enabled, columns may resize when scrolling up and down.
     *
     * @order 3
     */
    @Prop() virtual = false;

    /**
     * Allow scrolling up and down of partial rows.  By default, the grid uses snap scrolling where the top row
     * is never partially visible.
     *
     * @order 4
     */
    @Prop() smoothScrolling = false;

    /**
     * Sort grid by the value of a particular named column.
     * @order 53
     */
    @Prop() sortByColumn: string;

    /**
     * Sort the grid in descending order instead of ascending order.  This is only relevant if sortByColumn is specified.
     * @order 54
     */
    @Prop() sortDescending = false;

    /**
     * Text used to filter the rows in the grid.  Setting this string to blank will remove any filtering.
     * @order 55
     */
    @Prop() filterText: string;

    /**
     * The row number that is currently selected.  If the grid contains a tree column, expanded branches before the
     * selected row will increase the row number.  If no row is selected, or to unselect the active selection, the value
     * will be -1.
     *
     * @order 55
     */
    @Prop({ mutable: true }) selectedRow = -1;

    /**
     * A forward slash delimited path of the currently selected row.  Assuming the grid contains a tree column, the path
     * is a forward slash '/' delimited string where each segment represents a level in the tree.  Each level represents
     * one branch or leaf in the tree and is represented using the value of the column named 'name' given by the data provider,
     * or the relative row withing the parent branch.  For example path="root/folder/23", represents the 24th element in the
     * folder of the root. The selectedPath is not affected by expanding or collapsing branches in the tree.
     * @order 55
     */
    @Prop({ mutable: true }) selectedPath = '';

    /**
     * Fired when the selected row number changes.
     **/
    @Event({ eventName: 'selected-row-changed' }) selectedRowChanged: EventEmitter<{ value: number }>;

    /**
     * Fired when the selected path changes.
     **/
    @Event({ eventName: 'selected-path-changed' }) selectedPathChanged: EventEmitter<{ value: string }>;

    @Watch('sortByColumn')
    @Watch('sortDescending')
    onSortByColumnChanged() {
        this.treeStates.sortAndFilterBy(this.sortByColumn, this.sortDescending, this.filterFn, this.filterText);
        this.updateTotalRowCount();
    }

    @Watch('filterText')
    onFilterTextChanged() {
        // TODO: need to keep track of start row when filtering, scroll bar does not return to same place.  preserve place in list, or make selection visible.
        this.treeStates.filterBy(this.filterFn, this.filterText);
        this.updateTotalRowCount();
    }

    @Watch('selectedRow')
    onSelectedRowChanged() {
        const activeRow = this.activeSelection?.pos ?? -1;
        if (activeRow !== this.selectedRow) {
            this.activeSelection = this.treeStates.setSelection(this.treeStates.getRow(this.selectedRow));
            this.selectedPath = this.activeSelection?.path ?? '';
        }

        if (this.selectedRow >= 0) {
            // ensure selected row remains visible
            let pageHeight: number;
            let offset: number;
            const scrollTop = this.scrollContainer.scrollTop;
            if (this.smoothScrolling) {
                offset = this.selectedRow * this.rowHeight - scrollTop;
                pageHeight = this.pageHeight - this.rowHeight;
            } else {
                offset = (this.selectedRow - Math.max(0, Math.floor(scrollTop / this.rowHeight))) * this.rowHeight;
                pageHeight = this.pageSize * this.rowHeight;
            }

            if (offset < 0) {
                this.scrollContainer?.scrollBy(0, offset);
            } else if (offset > pageHeight) {
                this.scrollContainer.scrollBy(0, offset - pageHeight);
            }
        }

        this.selectedRowChanged.emit( { value: this.selectedRow });
    }

    @Watch('selectedPath')
    onSelectedPathChanged() {
        const activePath = this.activeSelection?.path ?? '';
        const newPath = this.selectedPath ?? '';
        if (activePath !== newPath) {
            this.activeSelection = this.treeStates.setSelection(this.treeStates.getRowByPath(newPath));
            this.selectedRow = this.activeSelection?.pos ?? -1;
        }

        this.selectedPathChanged.emit( { value: this.selectedPath });
    }

    /**
     * Method to set or change the root data provider for populating the grid.  For a tree grid, previously
     * expanded branches (identified by path) will remain expanded.  Optionally, you can provide an identifier
     * to store the expanded branches state by id, to allow switching between different data providers.  When
     * specified, the expandToLevel will be applied after the previous expanded state is restored, so the if you
     * only want to expand the first time, then subsequent calls should use expandToLevel set to zero.
     *
     * @param dataProvider new data provider for populating the grid.
     * @param expandToLevel force tree branches, to a certain depth, level, to be automatically expanded.
     * @param id optional identifier used to store expanded state when switching between different data providers.
     */
    @Method()
    async setDataProvider(dataProvider: IDataProvider, expandToLevel = 0, id = '') {
        const path = this.selectedPath;

        this.savedExpandedStatesMap.set(this.activeDataProviderId, this.treeStates.saveExpandedStatesAndDispose());
        this.activeDataProviderId = id;
        this.treeStates = TreeStates.create(this.updateTotalRowCount, dataProvider, this.savedExpandedStatesMap.get(this.activeDataProviderId));
        if (this.sortByColumn) {
            this.treeStates.sortAndFilterBy(this.sortByColumn, this.sortDescending, this.filterFn, this.filterText);
        } else if (this.filterText) {
            this.treeStates.filterBy(this.filterFn, this.filterText);
        }
        this.updateTotalRowCount();
        await this.expandToLevel(expandToLevel);
        this.selectedPath = path;  // restore the selected path.

        this.refresh();  // force a refresh which if the data provider were a property, would happen automatically.
    }

    /**
     * Method to expand all tree branches in the grid to a specified level.
     *
     * @param level depth or level expanded tree branches.
     */
    @Method()
    expandToLevel(level: number): Promise<void> {
        return this.treeStates.expandAll(this.updateTotalRowCount, level);
    }

    /**
     * Method to set or change the filter function for filtering rows in the grid.  If no callback is
     * provided, the default filtering will be performed on the column named 'name'.
     *
     * @param filterGridByRowCallback callback method that returns true if the row should remain after filtering.
     */
    @Method()
    async setFilterMethod(filterGridByRowCallback?: FilterGridByRowCallback) {
        this.filterFn = filterGridByRowCallback;
        if (this.filterText) {
            this.treeStates.filterBy(this.filterFn, this.filterText);
            this.updateTotalRowCount();
        }
    }

    private preventScroll = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.scrollViewport(this.scrollContainer.scrollTop);
    };

    private onScroll = () => {
        if (this.virtual) {
            if (this.scrollTop !== this.scrollContainer.scrollTop) {
                this.saveActiveEditorSelectionState();
                this.scrollTop = this.scrollContainer.scrollTop;  // need to re-render for virtual to move selection and row editors.
            }
        } else {
            // move the viewport, in non-virtual mode this will do the smooth or snap scroll action, otherwise we are done
            this.scrollViewport(this.scrollContainer.scrollTop);
        }
    };

    private onSelectHandler = (e: MouseEvent) => {
        const key = (e.currentTarget as HTMLElement).id;
        const indices = key.split(',');
        if (indices.length === 2) {
            const selectedRow = +indices[0];
            const selectedColumn = +indices[1];
            this.logger.debug(`onSelectHandler: click on cell x=${selectedColumn} y=${selectedRow}`);
            if (selectedRow !== this.activeSelectedRow || selectedColumn !== this.activeSelectedColumn) {
                this.activeSelection = this.treeStates.setSelection(this.treeStates.getRow(selectedRow + this.startRow));
                this.activeSelectedColumn = selectedColumn;
                this.selectedRow = this.activeSelection?.pos ?? -1;
                this.selectedPath = this.activeSelection?.path ?? '';

                this.setFocusAfterRender = { selectAll: false, preventScroll: true, hint: 'click' };
                this.cellEditorEnabled = true;
            } else if (!this.cellEditorEnabled) {
                this.setFocusAfterRender = { selectAll: false, preventScroll: true, hint: 'click' };
                this.cellEditorEnabled = true;
            }
        }
    };

    private setFocusOnActiveEditor = () => {
        // whenever focus is set on the selected cell, we try to pass focus to the active editor (if enabled).
        if (this.cellEditorEnabled && this.activeSelectedColumn >= 0 && this.activeSelectedRow >= 0) {
            const row = this.gridContent.children[this.activeSelectedRow];
            const cell = row?.children[this.activeSelectedColumn];
            const alreadyHasFocus = cell.querySelector('*:focus-within');
            const child = cell?.firstElementChild as HTMLElement;
            if (child && !cell.classList.contains('noFocus') && !alreadyHasFocus) {
                const column = this.columns[this.activeSelectedColumn];
                this.logger.debug(`setFocusOnActiveEditor: focus redirected to editor x=${this.activeSelectedColumn} y=${this.activeSelectedRow}`);
                (child as HTMLElement).focus(this.setFocusAfterRender || { preventScroll: true });
                let options: IEditorSelectionStateOptions = { selectAll: false, hint: '' };
                if (this.editorSelectionState?.path === this.selectedPath && this.editorSelectionState.column === this.activeSelectedColumn) {
                    options = { selectAll: false, selectionState: this.editorSelectionState.selectionState, hint: '' };
                    this.editorSelectionState = undefined;
                }
                column.restoreEditorSelectionState?.(child as HTMLElement, this.setFocusAfterRender || options);
            }
        }
    };

    private setFocusOnCell = () => {
        // whenever focus is set on the grid, we try to pass focus to the selected cell and then possibly to the active editor.
        // we need to set focus on the selected cell first in case the active editor does not accept focus.
        if (this.activeSelectedColumn >= 0 && this.activeSelectedRow >= 0) {
            const row = this.gridContent.children[this.activeSelectedRow];
            const cell = row?.children[this.activeSelectedColumn];
            if (cell) {
                this.logger.debug(`setFocusOnCell: focus redirected to cell x=${this.activeSelectedColumn} y=${this.activeSelectedRow}`);
                (cell as HTMLElement).focus(this.setFocusAfterRender || { preventScroll: true });
            }
        }
    };

    private setFocusOnGrid = () => {
        // Set the focus on the active editor, or cell.  IF there is no active cell, the focus is parked on the scrollbar to preserve tab order.
        // Also, we want to explicitly set the focus here, and not rely on onFocus handlers to passing along the focus.  Because,
        // if any of these already had focus, the chain would be broken, and the active editor would not receive the focus it requires.
        if (this.activeSelectedRow >= 0 && this.activeSelectedColumn >= 0) {
            const row = this.gridContent.children[this.activeSelectedRow];
            const cell = row?.children[this.activeSelectedColumn];
            const child = cell?.firstElementChild;
            if (this.cellEditorEnabled && child && !cell.classList.contains('noFocus')) {
                this.setFocusOnActiveEditor();
            } else {
                this.setFocusOnCell();
            }
        } else {
            this.logger.debug('setFocusOnGrid: focus set on grid');
            this.scrollContainer?.focus({ preventScroll: true });
        }
    };

    private onMousewheelHandler = (e: WheelEvent) => {
        // test for non-zero scroll in vertical direction. We don't want to interfere with horizontal only scrolling.
        if (e.deltaY) {
            e.preventDefault();
            this.scrollContainer.scrollBy(0, e.deltaY);
        }
    };

    private forceActiveEditorToCommitChanges() {
        if (this.cellEditorEnabled) {
            // disable cell editor so focus handler on the cell does not pass focus to editor.
            this.cellEditorEnabled = false;
            this.setFocusOnCell();
            // the next render will restore focus to the active editor.
            this.cellEditorEnabled = true;
        }
    }

    private saveActiveEditorSelectionState(): void {
        if (this.cellEditorEnabled) {
            const column = this.columns[this.activeSelectedColumn];
            if (column.saveEditorSelectionState) {
                const row = this.gridContent.children[this.activeSelectedRow];
                const cell = row && row.children[this.activeSelectedColumn].firstElementChild;
                if (cell) {
                    this.editorSelectionState = {
                        path: this.selectedPath,
                        column: this.activeSelectedColumn,
                        selectionState: this.columns[this.activeSelectedColumn].saveEditorSelectionState?.(cell as HTMLElement)
                    };
                }
            }
            this.forceActiveEditorToCommitChanges();
        }
    }

    private isColumnVisible(columnIndex: number): boolean {
        const column = this.columnHeadings[columnIndex] as unknown as IColumnCellRendererFactory;
        return column && !(column.hidden || column.minimized);
    }

    private gotoNextVisibleColumn(start: number, direction: number) {
        do {
            start = start + direction;

            if (start < 0 || start >= this.columns.length || isNaN(start)) {
                // ran out of columns in the search direction, so return no change to selected column
                return this.activeSelectedColumn;
            }
        } while (!this.isColumnVisible(start));
        return start;
    }

    private moveToCell(e: KeyboardEvent, rowOffset = 0, nextSelectedColumn?: number) {
        if (this.selectedRow >= 0) {
            // convert the relative selected row change to an absolute row number, before doing limit testing.
            let nextSelectedRow = rowOffset + this.selectedRow;
            nextSelectedRow = Math.max(nextSelectedRow, 0);
            nextSelectedRow = Math.min(nextSelectedRow, (this.totalRows || 0) - 1);
            if (nextSelectedRow !== this.selectedRow || nextSelectedColumn !== this.activeSelectedColumn) {
                this.logger.debug(`moveToCell: removing focus on active editor at x=${this.activeSelectedColumn} y=${this.activeSelectedRow}`);
                this.forceActiveEditorToCommitChanges();
                const preventScroll = nextSelectedColumn === this.activeSelectedColumn;
                if (nextSelectedColumn !== undefined) {
                    this.activeSelectedColumn = nextSelectedColumn;
                }
                this.cellEditorEnabled = true;
                this.setFocusAfterRender = { selectAll: true, preventScroll, hint: e.key };
                this.activeSelection = this.treeStates.setSelection(this.treeStates.getRow(nextSelectedRow));
                this.selectedRow = this.activeSelection?.pos ?? -1;
                this.selectedPath = this.activeSelection?.path ?? '';
            }
        }
        e.preventDefault();
        e.stopPropagation();
    }

    private onKeyHandler = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'End':
                if (e.ctrlKey) {
                    this.moveToCell(e, this.totalRows);
                } else {
                    this.moveToCell(e, 0, this.gotoNextVisibleColumn(this.columns.length, -1));
                }
                break;
            case 'Home':
                if (e.ctrlKey) {
                    this.moveToCell(e, -this.totalRows);
                } else {
                    this.moveToCell(e, 0, this.gotoNextVisibleColumn(-1, +1));
                }
                break;
            case 'PageUp':
                this.moveToCell(e, -this.pageSize);
                break;
            case 'PageDown':
                this.moveToCell(e, +this.pageSize);
                break;
            case 'ArrowUp':
                this.moveToCell(e, -1);
                break;
            case 'ArrowDown':
                this.moveToCell(e, +1);
                break;
            case 'ArrowLeft':
                this.moveToCell(e, 0, this.gotoNextVisibleColumn(this.activeSelectedColumn, -1));
                break;
            case 'ArrowRight':
                this.moveToCell(e, 0, this.gotoNextVisibleColumn(this.activeSelectedColumn, +1));
                break;
            case ' ':  // default space bar is to page down in grid,
                e.preventDefault(); // need to disable this because it uses the wrong scrollbar.
                break;
            case 'Escape':
                if (this.cellEditorEnabled) {
                    this.cellEditorEnabled = false;
                    // The render() may cause a loss of focus to the grid, so we need to ensure we regain focus.
                    this.setFocusAfterRender = { selectAll: false, preventScroll: true, hint: e.key  };
                }
                e.preventDefault();
                break;
            case 'F2':
                if (!this.cellEditorEnabled) {
                    this.setFocusAfterRender = { selectAll: true, preventScroll: true, hint: e.key };
                    this.cellEditorEnabled = true;
                }
                break;
        }
    };

    private calculateVisibleRowCount(height: number) {
        const result = Math.ceil(height / this.rowHeight);
        return Math.min(this.totalRows, result);
    }

    private calculateStartRowAndScrollTop(scrollTop: number = 0): [number, number] {
        let startRow = Math.max(0, Math.floor(scrollTop / this.rowHeight));

        let relativeScrollTop = this.smoothScrolling ? scrollTop % this.rowHeight : 0;

        // We also need to account for the extra rows we created in the render function.  When we get to the bottom
        // of the scroll area we need to increase the scrollTop to bring those rows into view.
        const extraRows = startRow + this.nVisibleRows - this.totalRows;
        if (extraRows > 0) {
            relativeScrollTop += extraRows * this.rowHeight;
            startRow -= extraRows;
        }

        return [ startRow, relativeScrollTop ];
    }

    private getGridColumnWidths() {
        const colWidths = this.columnHeadings.map( (column, i) => {
            if ((column as unknown as IColumnCellRendererFactory).hidden === true) {
                return '0px';
            }
            if ((column as unknown as IColumnCellRendererFactory).minimized === true)  {
                return 'min-content';
            }
            const widthStyle = getComputedStyle(column).getPropertyValue('--gc-column-width');
            if (widthStyle) {
                return widthStyle;
            }

            if (column.hasAttribute('flex')) {
                return (getComputedStyle(column).getPropertyValue('flex-grow') || '1') + 'fr';
            }
            if (column.style.width) {
                return column.style.width;
            }
            return 'min-content';

        });
        return colWidths.join(' ');
    }

    private renderRows(startRow: number, nVisibleRows: number): JSX.Element[] {
        this.activeSelectedRow = -1;
        let iterator = this.treeStates.getRow(startRow);
        return new Array(nVisibleRows).fill(null).map((_, rowIndex) => {
            try {
                const rowSelected = iterator.selected;
                const selectedColumn = rowSelected ? this.activeSelectedColumn : -1;
                const selectedCell = this.cellEditorEnabled ? selectedColumn : -1;
                if (rowSelected) {
                    this.activeSelectedRow = rowIndex;
                }
                const cells = this.columns.map( (column, columnIndex) => {
                    const { element, focusable } = column.renderCell(rowIndex, iterator, rowSelected, selectedCell === columnIndex, selectedCell === columnIndex ? 0 : -1);
                    const className = `grid-column ${column.align || 'start'}${this.cellEditorEnabled && focusable ? (column.hideFocusRectangle ? ' noOutline' : '') : ' noFocus'}`;
                    // JSXON
                    return <div class={className} key={`${columnIndex}`} id={`${rowIndex},${columnIndex}`}
                        tabIndex={(!this.cellEditorEnabled || !focusable) && selectedColumn === columnIndex ? 0 : -1} onFocus={this.setFocusOnActiveEditor}
                        onMouseDown={this.onSelectHandler}>{element}</div>;
                    // JSXOFF
                });
                // JSXON
                return <div class={`grid-row${rowSelected ? ' selected' : ''}`} key={rowIndex} id={`${rowIndex}`}>
                    {cells}
                </div>;
                // JSXOFF
            } catch (e) {
                // JSXON
                return <div>{e.message || e.toString()}</div>;
                // JSXOFF
            } finally {
                iterator = iterator.next();
            }
        });
    }

    render() {
        const lineHeight = parseInt(getComputedStyle(this.el).getPropertyValue('line-height').trim());
        if (!isNaN(lineHeight)) {
            this.rowHeight = lineHeight || 1;  // avoid divide by zero
        }

        // the following visible row count does not include the header, so this will have extra rows on purpose
        // add these rows will be visible when you get to the end of the scroll, or you resize the window bigger
        // before we get a chance to render() again.
        const height = (this.grid || this.el).clientHeight;
        this.nVisibleRows = this.virtual ? this.calculateVisibleRowCount(height) : this.totalRows;

        this.startRow = this.calculateStartRowAndScrollTop(this.scrollContainer?.scrollTop)[0];

        const columnWidths = this.getGridColumnWidths();

        // JSXON
        return <div key="container" class="container">
            <template><slot></slot></template>
            <div key="grid" class="grid" ref={ (el: HTMLElement) => this.grid = el}
                onKeyDown={this.onKeyHandler}
                onWheel={this.onMousewheelHandler} onScroll={this.preventScroll} style={{
                    'grid-template-rows': `min-content repeat(${this.nVisibleRows || 1}, ${this.rowHeight}px)`,
                    'grid-template-columns': `${columnWidths}`
                }}>
                <div key="grid-header" class="grid-header">
                    <slot name="columns"/>
                </div>
                <div key="grid-content" class="grid-content grid-focusable" ref={ (el: HTMLElement) => this.gridContent = el} tabIndex={-1}>
                    {this.renderRows(this.startRow, this.nVisibleRows)}
                </div>
                <div key="grid-padding" class="grid-padding" style={{ height: `${this.smoothScrolling ? 0 : this.rowHeight}px` }}/>
            </div>
            <div key="grid-scrollbar" tabIndex={this.activeSelectedRow >= 0 && this.activeSelectedColumn >= 0 ? -1 : 0}
                class="grid-scrollbar grid-focusable" onKeyDown={this.onKeyHandler} onFocus={this.setFocusOnCell}
                ref={ (el: HTMLElement) => this.scrollContainer = el } onScroll={this.onScroll}
            >
                <div key="grid-scrollbar-content" class="grid-scrollbar-content"/>
            </div>
        </div>;
        // JSXOFF
    }

    private setupScrollbar() {

        // calculate the max height of all column headers in case they are different sizes.
        const children = this.el.children;
        let headerHeight = this.rowHeight;
        for (let i = 0; i < children.length; i++) {
            headerHeight = Math.max(headerHeight, (children[i] as HTMLElement).offsetHeight);
        }

        this.pageHeight = this.grid.clientHeight - headerHeight;
        this.pageSize = Math.max(Math.floor((this.pageHeight) / this.rowHeight), 2) - 1;

        const totalHeight = this.totalRows * this.rowHeight;
        const showScrollBar = totalHeight > this.pageHeight;

        if (showScrollBar) {
            (this.scrollContainer.firstElementChild as HTMLElement).style.height = `${headerHeight +
                totalHeight + (this.smoothScrolling ? 0 : this.rowHeight)}px`;

            // adjust our virtual scrollbar to add horizontal scroll if necessary.  This is only need
            // even though it will not be visible to ensure the corner rectangle is displayed when
            // we have both horizontal and vertical scrolls.
            if (this.grid.offsetHeight > this.grid.clientHeight) {
                // grid has horizontal scroll bar,so add one too
                this.scrollContainer.style.overflowX = 'scroll';
            } else {
                this.scrollContainer.style.overflowX = '';
            }

            // adjust virtual scrollbar width to match the grid's own scrollbar which we are covering up.
            if (this.scrollContainer.clientWidth !== 0) {
                this.scrollContainer.style.width = `${this.scrollContainer.offsetWidth - this.scrollContainer.clientWidth}px`;
            }
        }

        // show/hide virtual scroll as necessary
        this.scrollContainer.style.display = showScrollBar ? '' : 'none';
        this.grid.style.overflowY = showScrollBar ? 'scroll' : 'hidden';
    }

    private scrollViewport(scrollTop: number) {
        if (this.columns.length > 0) {
            this.grid.scrollTop = this.calculateStartRowAndScrollTop(scrollTop)[1];
        }
    }

    componentDidRender() {
        this.setupScrollbar();
        this.scrollViewport(this.scrollContainer.scrollTop);

        this.logger.debug(`Component did render at x=${this.activeSelectedColumn} y=${this.activeSelectedRow}`);
        if (this.setFocusAfterRender || this.el.shadowRoot.querySelector('.grid-focusable:focus-within')) {
            this.setFocusOnGrid();
        }

        this.setFocusAfterRender = undefined;
    }

    /**
     * Expands or collapses a specific branch in the tree.
     *
     * @param {string} row the in the tree grid to toggle open.
     */
    @Method()
    async toggleOpen(row: number) {  // TODO: make explicit expand and collapse or open and close API.
        const folder = this.treeStates.getRow(row + this.startRow);
        if (folder && !folder.isBusy) {
            if (folder.isOpen) {
                this.updateTotalRowCount(folder.close());
            } else {
                await folder.open(this.updateTotalRowCount);
            }
        }
    }

    redraw(row = -1) {
        if (row < 0 || (this.startRow <= row && row <= this.startRow + this.nVisibleRows)) {
            this.refresh();
        }
    }

    commitEditValueChange(row: number, columnName: string, value: number | string | boolean) {
        const iterator = row < 0 ? this.activeSelection : this.treeStates.getRow(row + this.startRow);
        if (iterator) {
            iterator.setValue(columnName, value);
            this.redraw(row);
        }
    }

    getCommittedEditValue(row: number, columnName: string) {
        const iterator = row < 0 ? this.activeSelection : this.treeStates.getRow(row + this.startRow);
        if (iterator) {
            return iterator.getValue(columnName);
        }
    }

    setFocus() {
        this.cellEditorEnabled = false;
        this.setFocusOnGrid();
    }

    get visibleRowCount() {
        return this.virtual ? this.nVisibleRows : this.pageSize;
    }

    scrollIntoViewHorizontally(element: HTMLElement) {
        const viewport = this.grid.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        const scrollLeft = viewport.left - rect.left;
        const scrollRight = rect.right - viewport.right;
        if (scrollLeft > 0 && scrollRight < 0) {
            this.grid.scrollBy(-Math.min(scrollLeft, -scrollRight), 0);
        } else if (scrollLeft < 0 && scrollRight > 0) {
            this.grid.scrollBy(Math.min(-scrollLeft, scrollRight), 0);
        }
    }

    private async updateColumnHeadings() {
        this.editorSelectionState = undefined;  // selection state includes column index, which may not be accurate any longer.

        // get column information and renderers.
        const children = this.el.children;
        const columns: Promise<IColumnCellRenderer>[] = [];
        this.columnHeadings = [];
        for (let i = 0; i < children.length; ++i) {
            const child = children[i];
            if ((child as unknown as IColumnCellRendererFactory).createCellRenderer) {
                this.columnHeadings.push(child as HTMLElement);
                // move valid columns to the header slot, otherwise hide them in a non-visible slot.
                child.setAttribute('slot', 'columns');
                columns.push((children[i] as unknown as IColumnCellRendererFactory).createCellRenderer(this));

                /* Headings need a z-index of > 0 otherwise sticky headers will not show above grid data when scrolled.
                Heading tooltips do not show on top of neighboring headings with the same z-index. So a work around
                is to set the z-index in descending increments of 1 so that the last column has a z-index of 1 and will
                show tooltips from the 2nd last headings, etc..
                */
                (child as HTMLElement).style.setProperty('z-index', `${children.length - i}`);
            }
        }
        this.columns = await Promise.all(columns);
    }

    private onCSSPropertyChanged = () => {
        this.refresh();
    };

    connectedCallback() {
        this.logger = new GcConsole('gc-widget-grid', this.el.id);

        this.updateColumnHeadings();

        this.resizeObserver = new ResizeObserver(() => {
            this.refresh();
        });
        this.resizeObserver.observe(this.el);

        this.childObserver = new MutationObserver((mutations: MutationRecord[]) => {
            mutations.forEach( mutation => {
                if (mutation.type === 'childList' && mutation.target === this.el) {
                    this.updateColumnHeadings();
                } else if (mutation.type === 'attributes' && mutation.target !== this.el && flexAttributeMap.has(mutation.attributeName)) {
                    this.refresh(); // redraw if gc layout attributes change in the designer.
                }
            });
        });
        this.childObserver.observe(this.el, { attributes: true, childList: true, subtree: true });

        this.el.addEventListener('css-property-changed', this.onCSSPropertyChanged);
    }

    disconnectedCallBack() {
        this.resizeObserver.disconnect();
        this.childObserver.disconnect();

        this.el.removeEventListener('css-property-changed', this.onCSSPropertyChanged);
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
