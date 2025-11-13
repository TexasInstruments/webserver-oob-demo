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

import { IDataProvider, ITreeDataProvider } from '../lib/IDataProvider';

/* eslint-disable @typescript-eslint/no-use-before-define */

export type FilterGridByRowCallback = (row: number, dataProvider: IDataProvider, filterByText: string, isOpen: boolean) => boolean;

interface IFilterStackFrame {
    filteredRows?: number[];
    filterByText?: string;
    next?: IFilterStackFrame;
}

/**
 * A class to store the current and past filter states.  The filter state includes the filter text and the mapping from
 * filtered rows to virtual rows.  Every time the filter text changes this stack of filter states will be popped until
 * a suitable starting state is found to filter from.  This way, as users type in filter text, the filter stack will
 * grow and as the user uses the backspace key the stack will shrink.  And filtered of user data will be minimized.
 *
 * @private
 */
class FilterStack {
    private tos: IFilterStackFrame = {};
    private _filterFn: FilterGridByRowCallback;

    /**
     * Method to push filter state onto the stack.  The sequence of operations should start will a pop() call to get to
     * a suitable starting state for filtering text, and then after further filtering the starting state, a new state of
     * filtered rows by text is pushed.
     *
     * @param filteredRows latest map of filtered rows to virtual rows to push on to this stack.
     * @param filterText the filter text used to filter the rows.
     */
    push(filteredRows: number[], filterByText: string) {
        this.tos = { filteredRows, filterByText, next: this.tos };
    }

    /**
     * Method to pop zero or more states off of this stack.  The number of states popped is dependent on the
     * filter function and filter text provided.  While the filtered text of the top of the stack is a sub-string of the
     * new text to filter by, the stack is popped.  The result will be an empty stack to start a new filter operation, or
     * a filter state where the new filter text is a super set of the old, and therefore, we can just filter the already
     * filtered row, and we do not need to filter all the rows.  However, if the filter function has changed, or we need to
     * clear the stack for any other purpose, the stack will be cleared completely to start a fresh filter operation.
     *
     * @param filterFn The current function to filter text with.  If this has changed, then the stack will be cleared.
     * @param filterText The new filter text that will be used to filter the rows after we pop this stack to an appropriate starting state.
     * @param clear flag indicating a new filter operation should be performed, and to ignore previous filter operations.
     * @returns a map of filtered rows to virtual rows to be used as the starting point for the next filter operation.
     */
    pop(filterFn: FilterGridByRowCallback, filterByText?: string, clear = false) {
        if (clear || !filterByText || filterFn !== this.filterFn) {
            this.tos = {};
        } else {
            while (this.tos.next && filterByText.indexOf(this.tos.filterByText!) < 0) {
                this.tos = this.tos.next;
            }
        }
        this._filterFn = filterFn;
        return this.tos.filteredRows;
    }

    /**
     * Method to retrieve the current filter by text.  This is typically used when expanding tree elements and we need to
     * start filtering children using the same filter function and text as the parent element.
     *
     * @returns the filter by text that is currently being applied.
     */
    get filterByText() {
        return this.tos.filterByText;
    }

    /**
     * Method to retrieve the current filter function.  This is typically used when expanding tree elements and we need to
     * start filtering children using the same filter function and text as the parent element.
     *
     * @returns the filter function that is currently being applied.
     */
    get filterFn() {
        return this._filterFn;
    }
}

/**
 * A class to manage a single IDataProvider that represents a branch of the tree with only leaf nodes.  This class
 * also serves as the base class for a BranchNode which may have additional child branches.
 *
 * Data providers provide row and column data.  Since the row is w.r.t the data provide, it is referred to in this file
 * as virtual row, in that if does not represent the physical row in the grid widget which may have more that one
 * data provider when representing a tree.  To avoid confusion, the physical row will be also refereed to as position or pos.
 *
 * Default filtering and sorting are supported by sorting first, then filtering rows.  The result is a mapping from
 * filtered rows (even if only sorting is used) to virtual rows.
 * Default sorting is by a single column in ascending order only.  In addition, the built-in sorting will place expandable (folders)
 * branches before non expandable leaf nodes (files).  As a result, the default is suitable for fileTree filtering and register
 * grid alphabetical filtering.  In addition, sorting is manual.  Data is not resorted when the values change.  Of course the
 * data provider is welcome to provide their sorting within the data provider itself, and can sort data columns in real time if they choose.
 *
 * @private
 */
class LeafNode {
    size: number;   // number or virtual rows given by the data provider
    private sortedRows?: number[];  // mapping of sorted rows to virtual rows.
    protected isDisposed = false;  // flag indicating he node has been disposed, and any promise based activity skipped.
    private selection = new Map<number, boolean>();  // map of selected rows by virtual row.
    protected filterStack = new FilterStack();   // stack for built-in filtering of rows.
    protected filteredRows?: number[];  // map of filtered row to virtual row.

    constructor(public dataProvider: IDataProvider) {
        this.size = dataProvider.rowCount;
    }

    /**
     * Method to retrieve the total number of rows represented by this leaf node.
     * @returns row count.
     */
    get rowCount() {
        return this.filteredRows ? this.filteredRows.length : this.size;
    }

    /**
     * Method to lookup the name of a row for the purposes of setting selectedPath property of the grid widget.
     * @returns the name of the row, or if this row is not represented by a name. the row number.
     */
    getName(virtualRow: number): string {
        return '' + (this.dataProvider.getValue(virtualRow, 'name') || virtualRow);
    }

    /**
     * Method called when a leaf nodes is no longer referenced and need to be disposed.
     */
    dispose() {
        this.isDisposed = true;
    }

    /**
     * Method to get a row iterator for a given physical row.  For a leaf node, the relative position is the same as the virtual row.
     *
     * @param pos: physical row in the grid relative to this node.
     * @returns: an iterator that can be used to manipulate the row, or move to next or previous rows in the tree.
     */
    getRow(pos: number, parent?: RowIterator): IRowIterator {
        return new RowIterator(this, pos, false, parent);
    }

    /**
     * Method to lookup the physical row, of a given filtered row, relative to this node.  For a leaf node this is simply the filtered row, but for
     * branches it has to count the children of all expanded rows before it.
     *
     * @param filteredRow index in to the map of filtered rows to virtual rows.
     * @returns the filtered position of the row within this node.  If this is the root node, then this represents the absolute row in the grid.
     */
    getRelativePos(filteredRow: number) {
        return filteredRow;
    }

    protected parseRowFromPathSegment(segment) {
        const digit = segment.charAt(0);
        let row = -1;
        if (digit < '0' || digit > '9') {
            if (this.dataProvider.lookupRowByName) {
                row = this.dataProvider.lookupRowByName(segment) ?? -1;
            }
        } else {
            row = +segment;
        }
        return row;
    }

    /**
     * Method to lookup the row using a path.  The path consists segments separated by a forward slash similar to a filepath.
     * Each segment in the path represents the either the name of the row, or the virtual row as a number.
     *
     * @param path forward slash separated path to the tree node to find.
     * @param indent level in the tree, where zero represents the root node, and 1 for children of the root, etc...
     * @param parent iterator for the parent row for this node.  Undefined if this node is the root of the tree.
     * @returns: an iterator that can be used to manipulate the row, or move to next or previous rows in the tree.
     */
    findRowByPath(path: string[], indent = 0, parent?: RowIterator) {
        if (indent !== path.length - 1) {
            // leaf node, must be the last segment in the path.
            return undefined;
        }

        const row = this.parseRowFromPathSegment(path[indent]);
        if (row >= 0 && row < this.size) {
            return new RowIterator(this, +row, true, parent);
        }
    }

    /**
     * Method to test if a row is expanded (open) or collapsed (closed).  For leaf nodes, this is always collapsed.
     *
     * @param virtualRow the index into the IDataProvider for the row to test.
     * @returns true if the row is expandable and currently expanded/open.
     */
    isOpen(virtualRow: number) {
        return false;
    }

    /**
     * Method to set a row as either selected or unselected.
     *
     * @param virtualRow the index into the IDataProvider for the row to set selected state.
     * @param isSelected true if the virtual row is selected or false if the virtual row is unselected.
     */
    setSelected(virtualRow: number, isSelected: boolean) {
        if (!isSelected) {
            this.selection.delete(virtualRow);
        } else {
            this.selection.set(virtualRow, true);
        }
    }

    /**
     * Method to test if a row is selected or not..
     *
     * @param virtualRow the index into the IDataProvider for the row.
     * @returns true if the row is selected, and false if the row is not selected.
     */
    isSelected(row: number): boolean {
        return this.selection.get(row) ?? false;
    }

    /**
     * Method to sort and filter the rows.
     *
     * @param column the name of the column to sort by, or undefined if the unsorted order is to be restored.
     * @param filterFn a function for filtering rows, or undefined to remove any filtering of rows.
     * @param filterByText the text passed to the filterFn for filtering rows, or undefined to remove any filtering.
     */
    sortAndFilter(column: string, sortDescending = false, filterFn?: FilterGridByRowCallback, filterByText?: string) {
        if (!column) {
            this.sortedRows = undefined;
        } else {
            if (!this.sortedRows) {
                this.sortedRows = new Array(this.size).fill(null).map( (_, i) => i);
            }
            // created map of sorted index to unsorted index
            this.sortedRows = this.sortedRows.sort((a: number, b: number) => {

                if ((this.dataProvider as ITreeDataProvider).isExpandable) {
                    const aIsFolder = (this.dataProvider as ITreeDataProvider).isExpandable(a) || false;
                    const bIsFolder = (this.dataProvider as ITreeDataProvider).isExpandable(a) || false;

                    if (aIsFolder !== bIsFolder) {
                        return aIsFolder ? -1 : +1;
                    }
                }

                const valueA = this.dataProvider.getValue(a, column);
                const valueB = this.dataProvider.getValue(b, column);
                if (valueA > valueB) {
                    return +1;
                }
                if (valueA < valueB) {
                    return -1;
                }
                return a - b;  // maintain original order when values are the same.
            });

            if (sortDescending) {
                this.sortedRows = this.sortedRows.map( (_, i, array) => array[array.length - 1 - i]);
            }
        }
        this.filter(filterFn, filterByText, true);
    }

    /**
     * Method to get the virtual row for a particular filtered row.
     *
     * @param filteredRow index in to the map of filtered rows to virtual rows.
     * @param the virtual row corresponding to the filtered row.
     */
    lookupVirtualRow(filteredRow: number) {
        return this.filteredRows ? this.filteredRows[filteredRow] : filteredRow;
    }

    /**
     * Method to get the filtered row for a particular virtual row.
     *
     * @param virtualRow the index into the IDataProvider for the row.
     * @param the filtered row corresponding to the virtual row.
     */
    lookupFilteredRow(virtualRow: number) {
        return this.filteredRows ? this.filteredRows.indexOf(virtualRow) : virtualRow;
    }

    /**
     * Method to filter rows.
     *
     * @param filterFn a function for filtering rows, or undefined to remove any filtering of rows.
     * @param filterByText the text passed to the filterFn for filtering rows, or undefined to remove any filtering.
     * @param clear flag indicating a new filter operation should be performed, and to ignore previous filter operations.
     */
    filter(filterFn: FilterGridByRowCallback, filterByText?: string, clear = false): void {
        this.filteredRows = this.filterStack.pop(filterFn, filterByText, clear) || this.sortedRows;
        if (filterByText && this.filterStack.filterByText !== filterByText) {
            if (!this.filteredRows) {
                this.filteredRows = new Array(this.size).fill(null).map( (_, i) => i);
            }
            this.filteredRows = this.filteredRows.filter( row => this.filterRow(row, filterFn, filterByText));
            this.filterStack.push(this.filteredRows, filterByText);
        }
    }

    protected filterRow(row: number, filterFn: FilterGridByRowCallback, filterByText: string) {
        return filterFn(row, this.dataProvider, filterByText, false);
    }

    /**
     * Method to save the expanded and collapsed state of all rows.  This is used when collapsing a row to save the opened
     * child branches of the tree in case, so that when the user later expands the same row, we can restore the expanded
     * state of the children.
     *
     * @returns map of expanded states from this node and all its children.
     */
    saveExpandedStates(): ExpandedStatesMap {
        return new Map<string, ExpandedStatesMap>();
    }

    /**
     * Method to restore the expanded and collapsed state of all children.  This is used when expanding a row to restore
     * the previous state of expanded children, if any.
     *
     * @param onSizeChangedCallback callback used to update the state of the parent tree branches when child rows are expanded as a result of restoring the state.
     * @param expandedStates the map of expanded states previously retrieved by calling saveExpandedStates() method.
     */
    async restoreExpandedStates(onSizeChangedCallback: (extraRowCount: number) => void, expandedStates?: ExpandedStatesMap) {
        return;
    }

    /**
     * Method to determine if the current row is busy doing some operation, like expanding a branch.
     *
     * @param virtualRow the index into the IDataProvider for the row.
     * @returns true if in the middle of expanding a branch; otherwise false.
     */
    isBusy(virtualRow: number) {
        return false;
    }

    /**
     * Method to determine if a particular cell is read only and should not be edited.  This is only valid if the column is not
     * already read only.
     *
     * @param virtualRow the index into the IDataProvider for the row.
     * @param columnName the name of the column of the cell.
     * @returns true if a particular cell is read only; otherwise false.
     */
    isReadOnly(virtualRow: number, columnName: string): boolean {
        return this.dataProvider.isReadonly?.(virtualRow, columnName) || false;
    }

    /**
     * Method to determine if a particular row has children or not.
     *
     * @param virtualRow the index into the IDataProvider for the row.
     * @returns true this row has children, otherwise false.
     */
    hasChildren(virtualRow: number): boolean {
        return false;
    }
}

/**
 * Object to store child specific information used by BranchNode implementation.
 *
 * @private
 */
interface ChildInfo {
    /**
     * staring position of each child within the parent node.
     */
    start: number;
    /**
     * row count including all children of this child.
     */
    size: number;
    /**
     * flag indicating if the child is selected or not.
     */
    selected: boolean;
    /**
     * pointer to child node when expanded.  Otherwise, undefined when collapsed.
     */
    node?: BranchNode | LeafNode;
    /**
     * expanded states of all children when collapsed.  Undefined when expanded.
     */
    expandedStates?: ExpandedStatesMap;
    /**
     * promise for expanding a row, if undefined no expand in progress, otherwise in progress.
     */
    expandingPromise?: Promise<unknown>;
    /**
     * flag indicating the row was collapse before the expand operation completed.
     */
    expandingCancelled?: boolean;
}

/**
 * A class to manage a single ITreeDataProvider that represents a branch of the tree with both leaf and branch nodes.
 * This class extends the functionality in class LeafNode.
 *
 * @private
 */
class BranchNode extends LeafNode {
    private children: Array<ChildInfo>;
    private filteredChildren: Array<ChildInfo>;
    private sortByColumnName?: string;
    private sortDescending = false;
    private _rowCount: number;

    constructor(public dataProvider: ITreeDataProvider) {
        super(dataProvider);

        this.children = new Array<ChildInfo>(this.size).fill(null).map( (elem, i) => {
            return { start: i, size: 1, node: null, selected: false };  // initially all children are collapsed, so size = 1;
        });
        this.filteredChildren = this.children;
        this._rowCount = this.size;
    }

    get rowCount() {
        return this._rowCount;
    }

    /**
     * Method to collapse an expanded row, and discard child dataProviders.
     *
     * @param virtualRow the index into the IDataProvider for the row.
     * @returns a number indicating the number of virtual rows removed (children).
     */
    collapse(virtualRow: number) {
        const child = this.children[virtualRow];
        if (this.isDisposed || !child) {
            return 0;
        }

        if (child.expandingPromise) {
            child.expandingCancelled = true;
        }

        // Handle the case there the row is collapsed in the middle of an expand operation.
        if (!child.node) {
            return 0;
        }

        child.expandedStates = child.node.saveExpandedStates();

        const count = child.node.rowCount;
        child.node.dispose();
        child.node = null;
        child.size = 1;
        return -count;
    }

    /**
     * Method to expand a collapsed row, with a new child data provider.  This is an asynchronous operation that
     * will attempt to restore the previous state of expanded nested children too.  This may result in the number
     * of physical rows increasing in chunks at a time (for each child expanded).
     *
     * @param virtualRow the index into the IDataProvider for the row.
     * @param onSizeChangedCallback callback to for each increase in physical rows as a result of expanding this row.
     */
    async expand(virtualRow: number, onSizeChangedCallback: (extraRows: number) => void, expandedStates?: ExpandedStatesMap, childDataProvider?: IDataProvider | ITreeDataProvider) {
        const child = this.children[virtualRow];
        if (this.isDisposed || child.node) {
            return;
        }

        // handle the case where row is collapsed then re-expanded during one expand operation.  In this case just wait for the
        // original operation to complete, and ignore the collapse and re-expanded states.
        if (child.expandingCancelled) {
            child.expandingCancelled = false;
            if (child.expandingPromise) {
                return child.expandingPromise;
            }
        }

        const dataProvider = childDataProvider || this.dataProvider.getChildDataProvider(virtualRow);
        if (dataProvider instanceof Promise) {
            // if asynchronous data provider, wait for data provider before continuing.
            child.expandingPromise = dataProvider;
            onSizeChangedCallback(0); // this notifies caller that something, other than size has changed, and a redraw is needed.

            childDataProvider = await dataProvider;

            if (this.isDisposed) { // in-case we are disposed while waiting for data provider promise to resolve.
                return;
            }
        } else {
            childDataProvider = dataProvider;
        }

        let extraRows = 0;
        child.expandingPromise = undefined;

        if (child.expandingCancelled) {
            child.expandingCancelled = false;
        } else if (childDataProvider) {
            if (!(childDataProvider as ITreeDataProvider).isExpandable) {
                child.node = new LeafNode(childDataProvider as IDataProvider);
            } else {
                child.node = new BranchNode(childDataProvider as ITreeDataProvider);
            }

            child.node.sortAndFilter(this.sortByColumnName, this.sortDescending, this.filterStack.filterFn, this.filterStack.filterByText);
            extraRows = child.node.rowCount;  // update count with filtered children
        }

        onSizeChangedCallback(extraRows);

        expandedStates = expandedStates || child.expandedStates;
        child.expandedStates = undefined;
        // The following will also be skipped if expand operation was cancelled because child.node will still be undefined and not an instance of BranchNode
        if (childDataProvider && expandedStates && child.node instanceof BranchNode) {
            await child.node.restoreExpandedStates( (extraRows: number) => {
                onSizeChangedCallback(extraRows);
            }, expandedStates);
        }
    }

    /**
     * Method to expand all children
     *
     * @param depth the number of levels deep the expansion should do.  For example, 1 should only expand immediate children.
     * @param onSizeChangedCallback callback to for each increase in physical rows as a result of expanding a row.
     */
    async expandAll(onSizeChangedCallback: (extraRows: number) => void, depth = 100): Promise<void> {
        if (depth > 0) {
            depth = depth - 1;
            await Promise.all(this.filteredChildren.map( async (child, filteredRow) => {
                if (this.isDisposed || child.node) {
                    return;
                }

                const virtualRow = this.lookupVirtualRow(filteredRow);
                if (this.dataProvider.isExpandable(virtualRow)) {
                    child.expandedStates = undefined;   // don't restore expanded states when expanding all instead.
                    const childSizeChangedCallback = (extraRows: number) => {
                        this.adjustSize(filteredRow, extraRows);
                        onSizeChangedCallback(extraRows);
                    };
                    await this.expand(virtualRow, childSizeChangedCallback);
                    if (child.node instanceof BranchNode) {
                        await child.node.expandAll(childSizeChangedCallback, depth);
                    }
                }

            }));
        }
    }

    saveExpandedStates() {
        const result = super.saveExpandedStates();
        this.children.forEach( (child, i) => {
            if (child.node) {
                result.set('' + this.getName(i), child.node.saveExpandedStates());
            }
        });
        return result;
    }

    async restoreExpandedStates(onSizeChangedCallback: (extraRowCount: number) => void, expandedStates?: ExpandedStatesMap): Promise<void> {
        if (expandedStates) {
            await Promise.all(this.children.map( async (child, virtualRow) => {
                if (this.isDisposed || child.node) {
                    return;
                }

                const childExpandedStates = expandedStates.get(this.getName(virtualRow));
                if (childExpandedStates && this.dataProvider.isExpandable(virtualRow)) {
                    await this.expand(virtualRow, (extraRows: number) => {
                        this.adjustSize(this.lookupFilteredRow(virtualRow), extraRows);
                        onSizeChangedCallback(extraRows);
                    }, childExpandedStates);
                }
            }));
        }
    }

    isOpen(virtualRow: number): boolean {
        const child = this.children[virtualRow];
        return child.node !== null || (child.expandingPromise && !child.expandingCancelled);
    }

    dispose(): void {
        super.dispose();

        this.children.forEach((childInfo) => {
            if (childInfo.node) {
                childInfo.node.dispose();
            }
        });
    }

    /**
     * Method to retrieve a row iterator for the children of this row.
     *
     * @param filteredRow index in to the map of filtered rows to virtual rows.
     * @param parentIterator the iterator of the parent of the child iterator.
     * @returns the child iterator, or the next iteration of the parent if there are not children.
     */
    getChildIterator(filteredRow: number, parentIterator: RowIterator): IRowIterator {
        const child = this.filteredChildren[filteredRow].node;
        if (child !== null && child.rowCount > 0) {
            return new RowIterator(child, 0, false, parentIterator);
        }
        return parentIterator.next(true);
    }

    /**
     * Method to adjust row count based on inserting or removing rows due to expanding or collapsing a branch.
     *
     * @param filteredRow index in to the map of filtered rows to virtual rows.
     * @param diff the change in the row size of the child given by filteredRow.
     */
    adjustSize(filteredRow: number, diff: number) {
        if (diff === 0 || filteredRow < 0) {
            return;
        }

        this._rowCount += diff;
        this.filteredChildren[filteredRow].size = (this.filteredChildren[filteredRow].node?.rowCount ?? 0) + 1;
        for (let i = filteredRow + 1; i < this.filteredChildren.length; i++) {
            this.filteredChildren[i].start += diff;
        }
    }

    private findRowBinarySearch(start: number, end: number, pos: number): number {
        const midpoint = Math.round((start + end)/2);
        const midBlock = this.filteredChildren[midpoint];
        if (pos < midBlock.start) {
            return this.findRowBinarySearch(start, midpoint-1, pos);
        }
        if (pos >= midBlock.start + midBlock.size) {
            return this.findRowBinarySearch(midpoint+1, end, pos);
        }
        return midpoint;
    }

    getRow(pos: number, parent?: RowIterator): IRowIterator {
        let start = 0;
        let row = 0;
        row = this.findRowBinarySearch(0, this.filteredChildren.length-1, pos);
        const child = this.filteredChildren[row];
        start = child.start;
        const next = new RowIterator(this, row, false, parent);
        return start === pos ? next : child.node.getRow(pos - start - 1, next);
    }

    getRelativePos(filteredRow: number) {
        let result = 0;
        for (let i = 0; i < filteredRow; i++) {
            result += (this.filteredChildren[i].node?.rowCount ?? 0) + 1;
        }
        return result;
    }

    findRowByPath(path: string[], indent = 0, parent?: RowIterator) {
        if (indent === path.length - 1) {
            return super.findRowByPath(path, indent, parent);
        }

        const row = this.parseRowFromPathSegment(path[indent]);
        if (row >= 0 && row < this.children.length && this.children[row].node) {
            return this.children[row].node.findRowByPath(path, indent+1, new RowIterator(this, row, true, parent));
        }
    }

    setSelected(virtualRow: number, isSelected: boolean) {
        const childInfo = this.children[virtualRow];
        if (childInfo) {
            childInfo.selected = isSelected;
        }
    }

    isSelected(virtualRow: number): boolean {
        const childInfo = this.children[virtualRow];
        return (childInfo ? childInfo.selected : false);
    }

    sortAndFilter(column: string, sortDescending = false, filterFn?: FilterGridByRowCallback, filterByText?: string) {
        this.sortByColumnName = column;
        this.sortDescending = sortDescending;

        this.children.forEach( child => child.node?.sortAndFilter(column, sortDescending, filterFn, filterByText));

        super.sortAndFilter(column, sortDescending, filterFn, filterByText);
        this.reindex();
    }

    private reindex() {
        this.filteredChildren = this.filteredRows ? this.filteredRows.map( (_, i) => this.children[this.lookupVirtualRow(i)]) : this.children;

        let start = 0;
        for (let i = 0; i < this.filteredChildren.length; i++) {
            const child = this.filteredChildren[i];
            child.start = start;
            child.size = (child.node?.rowCount ?? 0) + 1;
            start += child.size;
        }
        this._rowCount = start;
    }

    filter(filterFn: FilterGridByRowCallback, filterByText?: string, clear = false): void {
        // recursively filter all children first
        this.children.forEach( child => child.node?.filter(filterFn, filterByText));

        super.filter(filterFn, filterByText, clear);
        this.reindex();
    }

    protected filterRow(virtualRow: number, filterFn: FilterGridByRowCallback, filterByText?: string) {
        const child = this.children[virtualRow];
        const size = (child.node?.rowCount ?? 0) + 1;
        return size > 1 || filterFn(virtualRow, this.dataProvider, filterByText, !!child.node);
    }

    isBusy(virtualRow: number): boolean {
        const child = this.children[virtualRow];
        return child.expandingPromise && !child.expandingCancelled;
    }

    hasChildren(virtualRow: number): boolean {
        const child = this.children[virtualRow];
        return child.size > 1;
    }
}

/**
 * Interface for column renderers to retrieve the data they need to render a particular cell.
 */
export interface ICellData {
    /**
     * The level within the tree, where level 0 has zero indent, level 1 has 1 indent, etc...
     */
    readonly indent: number;

    /**
     * Retrieve the value to display in a cell.
     * @param column name of column to get data for.
     */
    getValue(column: string): number | string | boolean | object | undefined;

    /**
     * Flag if this cell can be expanded or not.
     */
    readonly isExpandable: boolean;

    /**
     * The name of the optional icon to display in the tree renderer.
     */
    readonly rowIcon: string;

    /**
     * Flag indicating if this row is already expanded or not.
     */
    readonly isOpen: boolean;

    /**
     * Flag indicating if this row is in the process of expanding.  This is used by the tree renderer to show a busy
     * icon to indicate that the children are still being fetched.
     */
    readonly isBusy: boolean;

    /**
     * Test if a given column is read only or not.
     *
     * @param column name of column to test for read only.
     */
    isReadOnly(column: string): boolean;

    /**
     * Method to retrieve cell specific part name for customizing the grid.
     *
     * @param column name of the column to get part name for.
     * @returns part name for specified cell, or an empty string if no part name should be added.
     */
    getPartName(column: string): string;
}

/**
 * Interface to iterate over rows in the tree.  This interface extends ICellData, and provides api for the grid to
 * walk the tree in preorder traversal.
 */
export interface IRowIterator extends ICellData {
    /**
     * The full path to this row in the tree.  This is a forward slash concatenation of all parent node names.
     */
    readonly path: string;

    /**
     * The physical row in the grid including sorting and filtering.
     */
    readonly pos: number;

    /**
     * Method to retrieve the iterator for the next row in preorder traversal order.
     */
    next(): IRowIterator;

    /**
     * Method to set a new data value for a cell in the grid, based on user input.
     *
     * @param column name of the column to set data for.
     * @param value the new data value to set for the cell.
     */
    setValue(column: string, value: number | string | boolean | object): void;

    /**
     * Method to expand an node and display the children, if any.

     * @param onSizeChangedCallback callback to for each increase in physical rows as a result of expanding a row.
     */
    open(onSizeChangedCallback: (extraRows: number) => void): Promise<void>;

    /**
     * Method to collapse a node and hid the children, if any.
     *
     * @returns the number of children hidden as a result of collapsing this row.
     */
    close(): number;

    /**
     * Flag indicating the selected state of this row.  True is currently selected; otherwise false.
     */
    selected: boolean;

    /**
     * Flag indicating whether an expanded row, after any filtering, actually has children.  True if there is at least one expanded child; otherwise false.
     */
    readonly hasChildren: boolean;
}

class RowIterator implements IRowIterator {
    private dataProvider: IDataProvider | ITreeDataProvider;
    readonly indent: number;
    private virtualRow: number;

    constructor(private node: LeafNode | BranchNode, private filteredRow: number = 0, unfiltered = false, private parent?: RowIterator) {
        this.dataProvider = node.dataProvider;
        this.indent = parent ? parent.indent + 1: 0;
        if (unfiltered) {
            this.virtualRow = filteredRow;
            this.filteredRow = this.node.lookupFilteredRow(filteredRow);
        } else {
            this.virtualRow = this.node.lookupVirtualRow(filteredRow);
        }
    }

    get hasChildren() {
        return this.node.hasChildren(this.virtualRow);
    }

    get path() {
        return (this.indent > 0 ? `${this.parent.path}/`: '') + this.node.getName(this.virtualRow);
    }

    get pos() {
        const filteredRow = this.node.lookupFilteredRow(this.virtualRow);
        if (filteredRow < 0) {
            return filteredRow;
        }
        return (this.indent > 0 ? this.parent.pos + 1 : 0) + this.node.getRelativePos(filteredRow);
    }

    next(skipChildren = false): IRowIterator | undefined {
        if (!skipChildren && this.node.isOpen(this.virtualRow)) {
            return (this.node as BranchNode).getChildIterator(this.filteredRow, this);
        }
        this.filteredRow++;
        if (this.filteredRow < this.node.size) {
            this.virtualRow = this.node.lookupVirtualRow(this.filteredRow);
            return this;
        }
        return this.parent?.next(true);
    }

    getValue(column: string): number | string | boolean | object | undefined {
        return this.dataProvider.getValue(this.virtualRow, column);
    }

    setValue(column: string, value: number | string | boolean | object): void {
        return this.dataProvider.setValue(this.virtualRow, column, value);
    }

    get isExpandable(): boolean {
        return (this.dataProvider as ITreeDataProvider).isExpandable?.(this.virtualRow);
    }

    get rowIcon(): string {
        return (this.dataProvider as ITreeDataProvider).getIconName?.(this.virtualRow, this.isOpen) || '';
    }

    get isOpen() {
        return this.node.isOpen(this.virtualRow);
    }

    get isBusy() {
        return this.node.isBusy(this.virtualRow);
    }

    isReadOnly(column: string): boolean {
        return this.node.isReadOnly(this.virtualRow, column);
    }

    async open(onSizeChangedCallback: (extraRows: number) => void): Promise<void> {
        if (this.isExpandable && !this.isOpen) {
            await (this.node as BranchNode).expand(this.virtualRow, (extraRows: number) => {
                this.adjustSize(extraRows);
                onSizeChangedCallback(extraRows);
            });
        }
    }

    close() {
        if (!this.isOpen) {
            return 0;
        }

        const sizeDecrease = (this.node as BranchNode).collapse(this.virtualRow);
        this.adjustSize(sizeDecrease);
        return sizeDecrease;
    }

    get selected(): boolean {
        return this.node.isSelected(this.virtualRow);
    }

    set selected(isSelected: boolean) {
        this.node.setSelected(this.virtualRow, isSelected);
    }

    private adjustSize(diff: number) {
        if (diff === 0) {
            return;
        }

        (this.node as BranchNode).adjustSize(this.filteredRow, diff);
        if (this.parent) {
            this.parent.adjustSize(diff);
        }
    }

    getPartName(column: string): string {
        return this.node.dataProvider.getPartName?.(this.virtualRow, column) ?? '';
    }
}

export const nullDataProvider = new (class implements IDataProvider {
    rowCount = 0;
    setValue() {};
    getValue() {
        return '';
    };
})();

export type ExpandedStatesMap  = Map<string, ExpandedStatesMap>;

const defaultFilterFn: FilterGridByRowCallback = (row, dataProvider, filterByText) => {
    const name = '' + dataProvider.getValue(row, 'name');
    return name?.includes(filterByText) ?? true;
};

/**
 * Class to maintain the tree data and start for the grid widget.
 */
export class TreeStates {
    private readonly root = new LeafNode(nullDataProvider);
    private currentSelection: IRowIterator;

    constructor(rootDataProvider: IDataProvider = nullDataProvider) {
        if (!(rootDataProvider as ITreeDataProvider).isExpandable) {
            this.root = new LeafNode(rootDataProvider);
        } else {
            this.root = new BranchNode(rootDataProvider as ITreeDataProvider);
        }
    }

    /**
     * Retrieve the row iterator for the given position.
     *
     * @param pos physical row in the grid after sorting and filtering.
     */
    getRow(pos: number) {
        if (pos >= 0 && pos < this.totalRowCount) {
            return this.root.getRow(pos);
        }
    }

    /**
     * Retrieve the row iterator for the tree node based on the path.
     *
     * @param path forward slash separated path name
     */
    getRowByPath(path: string) {
        return this.root.findRowByPath(path.split('/'));
    }

    /**
     * Change the active selection.
     *
     * @param activeSelection new active selection, if any.
     */
    setSelection(activeSelection?: IRowIterator): IRowIterator | undefined {
        if (this.currentSelection) {
            this.currentSelection.selected = false;
        }
        this.currentSelection = activeSelection;
        if (this.currentSelection) {
            this.currentSelection.selected = true;
        }
        return this.currentSelection;
    }

    /**
     * Total number of physical rows, after sorting and filtering.
     *
     * @param activeSelection new active selection, if any.
     */
    get totalRowCount() {
        return this.root.rowCount;
    }

    /**
     * Method to sort and filter the rows in the tree.
     *
     * @param column name of the column to sort by, or blank string to remove sorting.
     * @param sortDescending true to sort in descending order; otherwise sorting is performed in ascending order.
     * @param filterFn callback method used for filtering rows, in not provided default filtering will be used.
     * @param filterByText the current text to filterBy.  If not provided, no filtering will take place.
     */
    sortAndFilterBy(column: string, sortDescending = false, filterFn = defaultFilterFn, filterByText?: string) {
        this.root.sortAndFilter(column, sortDescending, filterFn, filterByText);
    }

    /**
     * Method to filter the rows in the tree.  By default, rows are filtered by the 'name' column if it exists.
     *
     * @param filterFn callback method used for filtering rows
     * @param filterByText the current text to filterBy.  If not provided, no filtering will take place.
     */
    filterBy(filterFn = defaultFilterFn, filterByText?: string) {
        this.root.filter(filterFn, filterByText);
    }

    /**
     * Method to expand all child nodes in the tree up to a specified depth.
     *
     * @param onSizeChangedCallback callback method used to update total rows incrementally as each child is expanded.
     * @param depth the maximum depth to expand to.
     */
    async expandAll(onSizeChangedCallback: (extraRows: number) => void, depth = 100): Promise<void> {
        if (this.root instanceof BranchNode) {
            await this.root.expandAll(onSizeChangedCallback, depth);
        }
    }

    saveExpandedStatesAndDispose() {
        const result = this.root.saveExpandedStates();
        this.root.dispose();
        return result;
    }

    /**
     * Factory method to create a new TreeStates instance
     *
     * @param onSizeChangedCallback callback method used to update total rows incrementally as each child is expanded.
     * @param newDataProvider the root data provider to create the tree from.
     * @param expandedStates the previous state of expanded branches to be restored.
     */
    static create(onSizeChangedCallback: (extraRows: number) => void, newDataProvider: IDataProvider | ITreeDataProvider, expandedStates?: ExpandedStatesMap): TreeStates {
        const result = new TreeStates(newDataProvider);
        result.root.restoreExpandedStates(onSizeChangedCallback, expandedStates);
        return result;
    }
}

