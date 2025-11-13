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

/**
 * `gc-widget-grid` supports both grid and tree data providers to populate the grid.
 *
 * @packageDocumentation
 */

/**
 * Callback I/F for gc-widget-grid data providers.  This interface must be implemented
 * by clients to populate the gc-widget-grid with data.  The number of rows of data
 * must be fixed for a given data provider.  To change the number of rows, a new data
 * provider must be given to the gc-widget-grid, to replace the existing one.  Grid cell
 * data is provided by row number and column name.  Optionally, rows can be identified by name,
 * but this is only used to populate the selectedPath property of the grid widget.
 * If named rows are used, the optional lookupRowByName() method
 * must be implemented.  This method translates a row number to a name.  The method getValue(row, 'name') is used
 * to retrieve the name of any given row by number, regardless of whether or not there is a column in the grid that
 * displays the 'name' data values.
 */
export interface IDataProvider {
    /**
     * Total number of rows of data.  This is assumed to be fixed.  To change the number of rows in the grid
     * a new IDataProvider i/f should be set on the grid widget.
     */
    readonly rowCount: number;

    /**
     * Method to retrieve the data for a particular cell in the grid identified by row and column.
     * A column identified by 'name' has special meaning in that it can be used
     * to refer to a row by name instead of by number.
     *
     * @param row zero based indexed of the row to retrieve data for.
     * @param column the name of the column to retrieve data for.
     * @returns data for the cell identified by row and column, or undefined
     *      if no data exists for the cell.  In which case, a blank cell will be rendered.
     */
    getValue(row: number, column: string): number | string | boolean | object | undefined;

    /**
     * Method to set the data value for a particular cell in the grid identified by row and column.
     * This method is called when the user edits the grid and a new value needs to
     * be committed to the database.
     *
     * @param row zero based indexed of the row to set data for.
     * @param column the name of the column to set data for.
     * @param value the data value committed by user action.
     */
    setValue(row: number, column: string, value: number | string | boolean | object): void;

    /**
     * Method to retrieve the read only state of a particular cell in the database.  This optional
     * method need only be implemented if a particular column of data has a mix of read only and non-read only data.
     * Otherwise, you can use the gc-widget-grid-column to control the readonly state for the entire column.
     *
     * @param row zero based indexed of the row to test if read only.
     * @param column the name of the column to test if read only.
     * @returns true if this cell is not editable by the user.
     */
    isReadonly?(row: number, column: string): boolean;

    /**
     * Method to lookup a particular row by name.  If this method is
     * implemented, the data provider is expected to also have a 'name' column for converting row
     * numbers back to names.
     *
     * @param name the name of the row.
     * @returns the row index.
     */
    lookupRowByName?(name: string): number;

    /**
     * Optional method to retrieve an additional part name for a specific cell.  Part names are similar to class names
     * can be used to apply additional css styling to these cells in the grid.
     *
     * @param row zero based indexed of the row of the cell.
     * @param column the name of the column to of the cell.
     * @returns a part name to be applied to the cell .
     */
    getPartName?(row: number, column: string): string;
}


/**
 * Callback I/F for tree data that is represented in a gc-widget-grid. This interface must be implemented
 * by clients to populate the gc-widget-grid with tree data.  This interface extends the base IDataProvider
 * interface that populates the grid widget with data, to allow nested children within the database to support a
 * tree grid.
 */
export interface ITreeDataProvider extends IDataProvider {
    /**
     * Method to indicate if a row is expandable (has children) or not.  It is acceptable to return true even if there are
     * no children.  For example, a file tree with an empty folder can be shown visibly as expandable even if it is
     * empty when expanded.
     *
     * @param row zero based indexed of the row to retrieve the icon name for.
     * @returns true if the row can be expanded.
     */
    isExpandable(row: number): boolean;

    /**
     * Method to retrieve the data provider for the children of an expandable row.  This method may return a
     * promise if the children are not immediately available.  In this way, the gc-widget-grid can load children
     * on demand.  Children of expandable rows can be represented
     * by either a IDataProvider or ITreeProvider.
     *
     * @param row zero based indexed of the row to retrieve the child data provider for.
     * @returns a data provider callback for the children of this row, or a promise of a data provider.
     */
    getChildDataProvider(row: number): Promise<IDataProvider | ITreeDataProvider> | IDataProvider | ITreeDataProvider;

    /**
     * The gc-widget-tree-column can render option icons for rows including a different icon for expanded (open) and
     * collapsed (closed) states.  This optional method is used to retrieve the icon for either state.
     *
     * @param row zero based indexed of the row to retrieve the icon name for.
     * @param expanded true if the row is in the expanded state, and false if not.
     * @returns the icon identifier consisting of the icon category name followed by the icon name separated by a single semicolon, for example 'file:folder_open'
     */
    getIconName?(row: number, expanded: boolean): string;
}
