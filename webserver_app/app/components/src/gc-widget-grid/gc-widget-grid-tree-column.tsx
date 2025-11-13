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

import { Component, h, Prop, Event, EventEmitter, Element, Method, Watch, JSX, getAssetPath } from '@stencil/core';
import { IColumnCellRendererFactory, IRowOperations, IColumnCellRenderer } from './IColumnCellRenderer';
import { ICellData } from './internal/TreeState';
import { WidgetGridColumnBase } from './gc-widget-grid-column-base';
import { WidgetGridColumnBaseProps } from './gc-widget-grid-column-base-props';

class TreeColumnRenderer implements IColumnCellRenderer {
    constructor(private params: WidgetGridTreeColumn, private parentTree: IRowOperations) {
    }
    private iconFolderPath = getAssetPath('../assets/icons/');
    align: 'start';

    private onClickHandler = (e: MouseEvent) => {
        this.parentTree.toggleOpen(+(e.currentTarget as HTMLElement).id);
    };

    private onInfoClickHandler = (e: UIEvent) => {
        this.params.infoIconClicked.emit({ row: +(e.currentTarget as HTMLElement).id });
    };

    private onKeyHandler = (e: KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') {
            this.parentTree.toggleOpen(+(e.currentTarget as HTMLElement).id);
        } else if (e.key === 'Escape') {
            e.stopPropagation(); // prevent loss of keyboard focus for tree tree column, since visibly there is no difference.
        } else if (e.key === 'F1' && this.params.showInfoIcon) {
            e.stopPropagation();
            this.onInfoClickHandler(e);
        }
    };

    renderCell(row: number, data: ICellData, rowSelected: boolean, cellSelected: boolean, tabIndex: number): { element: JSX.Element; focusable: boolean } {
        const key = `tree${row}`;
        const iconName = 'chevron_right';
        const iconUrl = `${this.iconFolderPath}filled/navigation.svg#${iconName}`;
        let folderIconUrl: string;
        const rowIconName = data.rowIcon;
        if (rowIconName) {
            const path = rowIconName.split(':');
            if (path.length === 3) {
                folderIconUrl = `${this.iconFolderPath}${path[0]}/${path[1]}.svg#${path[2]}`;
            } else if (path.length === 2) {
                folderIconUrl = `${this.iconFolderPath}filled/${path[0]}.svg#${path[1]}`;
            }
        }
        const hide = this.params.minimized || this.params.hidden;

        let infoIconUrl: string;
        if (this.params.showInfoIcon) {
            infoIconUrl = `${this.iconFolderPath}filled/action.svg#help_outline`;
        }

        // JSXON
        const element = <span key={key} id={`${row}`} hidden={hide} style={{ padding: '0px 2px 0px 3px' }} class="flex-row" tabIndex={tabIndex} onKeyDown={this.onKeyHandler}>
            <span style={{ width: this.getPadding(data), display: 'inline-block' }}/>
            <svg role="img" class="icon" id={`${row}`} onClick={this.onClickHandler} style={{
                transform: this.getTranslation(data),
                visibility: data.isExpandable ? '' : 'hidden'
            }}>
                <use xlinkHref={iconUrl}/>
            </svg>
            { data.isBusy ? <div class="progress"/> : null }
            <label key={key+'label'} id={`${row}`} class="flex" part={this.getPart(data)} onDblClick={this.onClickHandler}>
                { folderIconUrl ? <svg role="img" class="icon tree"><use xlinkHref={folderIconUrl}/></svg> : null }
                {data?.getValue(this.params.name || 'name') || ''}
                { infoIconUrl ? <svg role="img" id={`${row}`} class="icon info" onClick={this.onInfoClickHandler} style={{ display: data.isExpandable ? 'none' : '' }}>
                    <use xlinkHref={infoIconUrl}/>
                </svg> : null }
            </label>
        </span>;
        // JSXOFF
        return { element, focusable: !hide };
    }

    private getPadding(data: ICellData) {
        return `${(data?.indent || 0) * 20}px`;
    }

    private getTranslation(data: ICellData) {
        return `${data?.isOpen ? 'rotate(90deg)' : ''}`;
    }

    private getPart(data: ICellData) {
        return `${data?.isOpen ? 'open branch' : data?.isExpandable ? 'closed branch' : 'leaf'}`;
    }
}

/**
 * `gc-widget-grid-tree-column` is a column with expandable/collapsible content like categories or folders.  It is usually
 * added as the first child of a grid to make it a tree gird.
 *
 * @label Grid Tree Column
 * @group Tables, Trees and Grids
 * @demo demo/treeColumn
 * @container
 * @archetype <gc-widget-grid-tree-column name="tree" hide-minimized-action heading="Tree" layout></gc-widget-grid-tree-column-tree>
 * @usage
 * @css --gc-column-width | The width of this column (px)
 * @css --gc-font-color | The font color for the column heading | { "kind": "color" }
 * @css --gc-font-size | The font size for the column heading (px)
 * @css --gc-font-style | The font style for the column heading | { "kind": "select", "options": ["", "normal", "italic"] }
 * @css --gc-font-weight | The font weight for the column heading | { "kind": "select", "options": ["", "normal", "bold"] }
 * @css --gc-heading-color | The color for the column heading | { "kind": "color" }
 * @css --gc-heading-text-align | The alignment of heading text | { "kind": "select", "options": ["", "start", "center", "end"] }
 * @css --gc-focus-color | The color of the focus rectangle for the column heading | { "kind": "color" }
 */

@Component({
    tag: 'gc-widget-grid-tree-column',
    styleUrl: 'gc-widget-grid-column-base.scss',
    shadow: true
})

export class WidgetGridTreeColumn implements WidgetGridColumnBaseProps, IColumnCellRendererFactory{
    private base = new ( // keep on separate line to enable source mapping
        class extends WidgetGridColumnBase {
            get element() {
                return (this.parent as WidgetGridTreeColumn).el;
            }
        })(this);

    /**
     * Display a clickable information icon after the name for leaf nodes only.  When true, the on-info-clicked event
     * is fired when this icon is pressed with the mouse.  There is no keyboard shortcut.
     *
     * @order 40
     */
    @Prop() showInfoIcon = false;

    /**
     * Fired when the user clicks the optional info icon.
     */
    @Event({ eventName: 'info-icon-clicked', bubbles: true }) infoIconClicked: EventEmitter<{ row: number }>;

    /**
     * Method used by the gc-widget-grid to create a renderer that it can call during it's render() method to render individual
     * cells in this column.
     *
     * @hidden
     */
    @Method()
    async createCellRenderer(callback: IRowOperations): Promise<IColumnCellRenderer> {
        this.base.parentGrid = callback;
        return new TreeColumnRenderer(this, callback);
    }

    @Watch('showInfoIcon')
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
