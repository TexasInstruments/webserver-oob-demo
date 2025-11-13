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

import { h, JSX } from '@stencil/core';
import { ICellData, FilterGridByRowCallback } from './internal/TreeState';

export { ICellData, FilterGridByRowCallback };
/**
 * Interface for IColumnCellRenderer.restoreEditorSelectionState() options parameter.  These options are w.r.t setting the
 * selection state on a cell editor.
 */
export interface IEditorSelectionStateOptions {
    /**
     * flag indicating the editor should select all the text in the editor, if appropriate.
     */
    readonly selectAll: boolean;

    /**
     * The selection state, specific to the cell editor, to restore.  The selection state object was previously
     * retrieved with a call to IColumnCellRenderer.saveEditorSelectionState() for this cell renderer.
     */
    readonly selectionState?: unknown;

    /**
     * A hint as to what user action was the cause.  'click' for a right mouse press, or the name of the keyboard key
     * that was pressed down.  For example, 'F2', 'Escape', 'ArrowUp', etc...
     */
    readonly hint: 'click' | string;
}

/**
 * Interface that all column cell renderers must implement to be compatible with the grid.
 */
export interface IColumnCellRenderer {
    /**
     * Render a single cell in the grid.  The renderer should honor the current column state of hidden or minimized,
     * if supported, and return a JSX.Element with a hidden attribute set.  By returning a normally rendered widget
     * with a hidden attribute set, there is less flicker when the users toggles hidden and or minimized states.  This
     * occurs because the browser is much slower at creating/destroying dom elements verses change CSS properties to hide
     * a widget.  There are no guarantees that renderCell() wont be called for hidden cells including cells that are spanned
     * by neighboring cells.  This gives the grid some freedom in how it renders these states.  Also, this method must return
     * a flag indicating whether or not the particular cell is focusable.  IF the cell is focusable, the tabIndex given must
     * be applied to the element returned.
     *
     * @param row physical row number.
     * @param data interface to retrieve cell data from the data provider.
     * @param rowSelected flag indicating the row of this cell is the actively selected row.
     * @param cellSelected flag indicating the cell to render is the actively selected cell for editing.
     * @param tabIndex the tab order for the rendered cell.
     * @returns element to render in the cell, and a  flag indicating if the cell is focusable.  If multiple elements
     * are needed, they should be encapsulated in a single span or div.
     */
    renderCell(row: number, data: ICellData, rowSelected: boolean, cellSelected: boolean, tabIndex: number): { element: JSX.Element; focusable: boolean };

    /**
     * Alignment for the data in rendered in this cell.  This alignment will be applied to the parent div.
     */
    readonly align: 'start' | 'end' | 'center';

    /**
     * Optional method to retrieve the span for this cell.  The default is that the cell spans just one column.  If a
     * position integer is returned, then that number of cells will be spanned.  This should only be used by
     * private cell renderers that understand how many rows they are allowed to span.
     *
     * @param row the row number to get the span count for.
     * @param data interface to retrieve cell data by row for the purposes of determining the span count.
     * @returns the span count.
     */
    getSpan?(row: number, data: ICellData): number;

    /**
     * Method to retrieve the current selection state of a editor widget.  Typically this is for text editors to return the
     * range of text that is selected, so that this state can be transferred to a different editor widget.  The object returned
     * will be passed in the options parameter of the setFocus() method to restore the selection state to another editor instance.
     *
     * @param widget HTMLElement corresponding to the JSX.Element returned from renderCell for the actively selected  editor cell.
     * @returns object containing the state in any form.
     */
    saveEditorSelectionState?(widget: HTMLElement): unknown;

    /**
     * Optional method to restore or set editor selection state for the actively cell editor.  This will be called after the grid is rendered,
     * and focus is set on the widget.
     *
     * @param widget the HTMLElement corresponding to the JSX.Element returned by the renderCell method of the
     * actively selected cell for editing, which has just received focus.
     * @param options set of options to be applied when setting focus, if appropriate.
     */
    restoreEditorSelectionState?(widget: HTMLElement, options: IEditorSelectionStateOptions): void;

    /**
     * Optional, flag indicating that the default focus rectangle on the parent grid cell should not be displayed for this column.
     * By default, the grid cell draws a focus rectangle; however, if the cell editor provides it's own form of focus
     * indication, the default one can be disabled by having this property be true.
     */
    readonly hideFocusRectangle?: boolean;
}

/**
 * Interface provided by the grid for the cell renderer to manipulate the parent grid.
 */
export interface IRowOperations {
    /**
     * Method, used by the gc-widget-grid-tree-column, to expand and collapse tree branch based on user action.  Typically,
     * only the column that renders the tree column in the grid should use this method.
     *
     * @param row the row to expand or collapse.
     * @returns promise indicating when the expand or collapse operation has completed.
     */
    toggleOpen(row: number): Promise<void>;

    /**
     * Method to commit a value changed by the user through a cell editor.
     *
     * @param row number of the row to commit an edited value.
     * @param columnName name of the column to commit the edit value for.
     * @param value new value to set into the data provider.
     */
    commitEditValueChange(row: number, columnName: string, value: string | number | boolean): void;

    /**
     * Method to retrieve the current data value for a cell.  This method is typically used in a cell editor that handles the
     * escape key by discarding an user input and restoring the previously committed value in the editor.
     *
     * @param row number of the row to retrieve the data value for.
     * @param columnName name of the column to retrieve the data value for.
     * @returns current data value provided by the data provider.
     */
    getCommittedEditValue(row: number, columnName: string): string | number | boolean | object;

    /**
     * Method to cause a re-render() of the grid.  This should be called when anything visual changes including cell data.
     *
     * @param row a single row that needs to be redrawn.  If provided, this is used to skip a re-render of the grid if the row is not visible.
     */
    redraw(row?: number): void;

    /**
     * Method used to pass focus back to the grid, and blur the actively selected editor.
     */
    setFocus(): void;

    /**
     * Property to retrieve the number of rows that are visible in the grid.  This is intended to be used as a hint as to
     * how much data will fetched each time the grid is rendered; however, there are no guarantees.  For example, if
     * virtual dom is not enable, we fetch all the data anyway.  And, if filtering or sorting is used, we will
     * fetch data out of order and out of sequence.
     */
    readonly visibleRowCount: number;

    /**
     * Method to ensure a element that was rendered is visible in the viewport, and if not scroll the grid left or right just
     * enough to show the entire element if possible.
     */
    scrollIntoViewHorizontally(element: HTMLElement): void;
}

/**
 * Interface that must be implemented by every column widget in order to
 * be visible in the parent grid.  Each column creates one cell renderer to render all cells in the column.  This includes
 * creating an active editor as needed.
 */
export interface IColumnCellRendererFactory {
    /**
     * Method to create a cell renderer for this column
     *
     * @param callback interface to manipulate the parent gird
     * @returns column renderer
     */
    createCellRenderer(callback: IRowOperations): Promise<IColumnCellRenderer>;

    /**
     * Property indicating that the column is minimized.
     */
    readonly minimized?: boolean;

    /**
     * Property indicating that the column is hidden.
     */
    readonly hidden?: boolean;
}


