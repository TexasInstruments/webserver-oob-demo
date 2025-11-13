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
import { h, Component, Prop, Event, EventEmitter, Element, Method, Watch, State } from '@stencil/core';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { MenuManager } from './internal/MenuManager';
import { WidgetMenuItem } from './gc-widget-menuitem';
import { GcConsole } from '../gc-core-assets/lib/GcConsole';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { GcFiles } from '../gc-core-assets/lib/GcFiles';

const console = new GcConsole('gc-widget-menu');

/**
 * `gc-widget-menubar` a menu bar to which menu items can be added.
 *
 * The menu bar has three main sections:
 * The first is optional can show a product name and/or product icon if required. The second section is
 * for `gc-widget-menuitems` that are dropped onto the menu bar and appears on the left side immediately
 * after the optional first section. The third and final section is for all other widgets that are dropped
 * onto the menu bar that are not `gc-widget-menuitems`. The third section is justified to the right side of
 * the menu bar.
 *
 * When there is not enough room to display everything on the menu bar, a more menu button will appear between
 * the second and third sections. All the menu items that cannot be displayed in the second section will be
 * placed in a dropdown menu accessible from this button.
 *
 * Typically the menu bar is placed using either absolute or fixed position with left, top, and right being
 * set to zero. This positions the bar at the top of whichever the container it was added to. You can then
 * set a margin that is non zero to create space around the menu bar if so desired.
 *
 * @label Menu Bar
 * @group Menus & Toolbars
 * @demo
 * @usage
 * @container
 */
@Component({
    tag: 'gc-widget-menubar',
    styleUrl: 'gc-widget-menubar.scss',
    shadow: true
})
export class WidgetMenubar implements WidgetBaseProps {
    private base = new (
        class extends WidgetBase {
            get element() {
                return (this.parent as WidgetMenubar).el;
            }
        })(this);

    /**
     * Provides an optional product name that can be displayed at the left hand side of the
     * menubar, immediately after the logo image, and before the menu items.
     *
     * @order 2
     */
    @Prop() productName?: string;

    /**
     * Provides an optional logo icon (svgFilename:iconName, e.g. objects:chip)
     * that can be displayed at the left hand side of the menubar, before the product
     * name, and before the menu items.
     *
     * @order 3
     */
    @Prop() productIcon?: string;

    /**
     * Provides the optional path to the custom SVG icon folder.
     *
     * @order 4
     */
    @Prop() productIconFolderPath?: string;

    /**
     * Enable the menu to show on mouse hover.
     *
     * @order 5
     */
    @Prop() openOnHover: boolean = false;

    /**
     * Fired when the the product name or product icon has clicked.
     */
    @Event({ eventName: 'product-name-clicked' }) productNameClicked: EventEmitter;

    @State() windowMaximized = false;

    render() {
        return this.base.render(
            //JSXON
            <div id='menubar-container' class='container' tabindex='0'>
                {
                    /* product icon and product name */
                    this.productName || this.productIcon ?
                        <div id='product-container' class='container' onClick={ this.productNameClicked.emit.bind(this) }>
                            { this.productIcon ? <gc-widget-icon id='product-icon' icon={ this.productIcon } path={ this.productIconFolderPath } appearance='custom'> </gc-widget-icon> : null }
                            { this.productName ? <div id='product-name'>{ this.productName }</div> : null }
                            <div class='v-separator' />
                        </div> : null
                }

                {
                    /* menu list */
                    <div id='menu-list'><slot></slot></div>
                }

                <div id='drag-area'></div>

                {
                    /* tool list */
                    <div id='tool-list'><slot name='tool-list'></slot></div>
                }

                {
                    /* more list */
                    <div id='more-list'>
                        <gc-widget-menuitem class='more-item' icon='navigation:more_vert' label=''>
                            <slot name='more-item'></slot>
                        </gc-widget-menuitem>
                    </div>
                }

                {
                    /* window buttons */
                    GcUtils.isNW ?
                        <div id='win-buttons-container'>
                            <gc-widget-icon
                                appearance='custom'
                                icon='round:action:minimize'
                                onClick={ () => this.minimizeWin() }
                                onMouseEnter={ (e: MouseEvent) => (e.target as HTMLElement).classList.add('hover') }
                                onMouseLeave={ (e: MouseEvent) => (e.target as HTMLElement).classList.remove('hover' )}
                            ></gc-widget-icon>
                            <gc-widget-icon
                                appearance='custom'
                                icon={ this.windowMaximized ? 'round:image:filter_none' : 'round:image:crop_square' }
                                size={ this.windowMaximized ? 's' : 'm' } // workaround icon size
                                onClick={ () => this.toggleWinState() }
                                onMouseEnter={ (e: MouseEvent) => (e.target as HTMLElement).classList.add('hover') }
                                onMouseLeave={ (e: MouseEvent) => (e.target as HTMLElement).classList.remove('hover' )}
                            ></gc-widget-icon>
                            <gc-widget-icon
                                appearance='custom'
                                icon='round:navigation:close'
                                onClick={ () => this.closeWin() }
                                onMouseEnter={ (e: MouseEvent) => (e.target as HTMLElement).classList.add('hover') }
                                onMouseLeave={ (e: MouseEvent) => (e.target as HTMLElement).classList.remove('hover' )}
                            ></gc-widget-icon>
                        </div>
                        : undefined
                }
            </div>
            //JSXOFF
        );
    }

    async componentWillLoad() {
        this.el.setAttribute('contenteditable', '');

        if (GcUtils.isNW) {
            const win = require('nw.gui').Window.get();
            win.on('restore', () => {
                this.windowMaximized = false;

                // When minimizing the window, :hover is not removed. So, icon needs to be manually insert the hover class and
                // remove the hover class.  During the restore window callback, the hover class also needs to be remove so that
                // the window button icon has the correct rendering.
                this.el.shadowRoot.querySelectorAll('gc-widget-icon').forEach(el => el.classList.remove('hover'));
            });
            win.on('maximize', () => this.windowMaximized = true);
        }

        window.addEventListener('resize', () => {
            this.closeAllMenus();
            this.updateLayout();
        });

        this.el.addEventListener('blur', this.closeAllMenus.bind(this));

        window.addEventListener('gc-command-run', () => {
            this.closeAllMenus();
        });

        window.addEventListener('gc-command-menu-click', ((ev: CustomEvent) => {
            const el = ev.detail.el as HTMLElement;
            if (!this.openOnHover) {
                const mi = this.castToMenuItem(el);
                if (mi['_opened']) {
                    mi.closeMenu();
                    // @ts-ignore
                    document.activeElement.blur();
                } else {
                    mi.openMenu();
                }
            }
        }) as EventListener);

        window.addEventListener('gc-command-mouse-enter', ((ev: CustomEvent) => {
            const el = ev.detail.el as HTMLElement;
            console.log(`Mouse enter ${el['label']}`);

            const mb = MenuManager.getMenuBar(el);

            /* close all other menu items */
            const allMenuItems: Array<HTMLElement> = [this.el.shadowRoot.querySelector('.more-item')];
            MenuManager.getAllChildrenMenuItems(mb).forEach(menuItem => allMenuItems.push(menuItem as HTMLElement));
            const menuItemTree = [];

            let parent = MenuManager.isMenuItem(el) ? el : MenuManager.getParentMenuItem(el);
            while (parent) {
                menuItemTree.push(parent);
                parent = MenuManager.getParentMenuItem(parent);
            }
            allMenuItems.forEach((menuItem: HTMLElement) => {
                if (menuItemTree.indexOf(menuItem) === -1) {
                    menuItem.classList.remove('active');
                    this.castToMenuItem(menuItem).closeMenu();
                }
            });

            /* if el is same menu item as this menu bar and it is an menu item, open it */
            if (mb === this.el && MenuManager.isMenuItem(el)) {
                if (document.activeElement === mb || this.openOnHover) {
                    const mi = this.castToMenuItem(el);
                    mi.openMenu();
                }
                el.classList.add('active');
            }
        }) as EventListener);

        window.addEventListener('gc-command-mouse-leave', ((ev: CustomEvent) => {
            const el = ev.detail.el as HTMLElement;
            console.log(`Mouse leave ${el['label']}`);

            const mb = MenuManager.getMenuBar(el);
            if (mb === this.el && MenuManager.isMenuItem(el)) {
                const mi = this.castToMenuItem(el);

                if (this.openOnHover) {
                    mi.closeMenu();

                } else if (!mi['_opened']) {
                    el.classList.remove('active');
                }
            }
        }) as EventListener);
    }

    componentDidLoad() {
        this.updateLayout();
    }

    private castToMenuItem(element: HTMLElement) {
        return element as unknown as WidgetMenuItem;
    }

    private closeAllMenus() {
        MenuManager.closeAllMenus();
    }

    private get productContainer(): HTMLElement {
        return this.el.shadowRoot.querySelector('#product-container') as HTMLElement;
    }

    private get menuList() {
        return this.el.shadowRoot.querySelector('#menu-list') as HTMLElement;
    }

    private get toolList() {
        return this.el.shadowRoot.querySelector('#tool-list') as HTMLElement;
    }

    private get moreList() {
        return this.el.shadowRoot.querySelector('#more-list') as HTMLElement;
    }

    private get winButtonsContainer(): HTMLElement {
        return this.el.shadowRoot.querySelector('#win-buttons-container');
    }

    private get menuListMinWidth() {
        const productContainerWidth = this.productContainer ? this.productContainer.offsetWidth : 0;
        const winButtonsContainerWidth = this.winButtonsContainer ? this.winButtonsContainer.offsetWidth : 0;
        return Math.ceil(this.el.getBoundingClientRect().width - productContainerWidth - winButtonsContainerWidth - this.toolList.offsetWidth - this.moreList.offsetWidth) + 2;
    }

    private updateLayout() {
        /* move elements from menu-list */
        const moreSlot = this.moreList.querySelector('slot');
        const moreItems = moreSlot.assignedElements();
        while ((moreItems.length > 0) && (this.menuList.offsetWidth < this.menuListMinWidth)) {
            const menuItem = moreItems.shift();
            if (menuItem['_setChevron']) {
                menuItem['_setChevron'](false);
            }
            menuItem.removeAttribute('slot');
        }

        /* move elements to more-list */
        const menuSlot = this.menuList.querySelector('slot');
        const menuItems = menuSlot.assignedElements();
        while ((menuItems.length > 0) && (this.menuList.offsetWidth > this.menuListMinWidth)) {
            menuItems.pop().setAttribute('slot', 'more-item');
        }

        this.moreList.style.display = moreSlot.assignedElements().length <= 0 ? 'none' : '';
    }

    private minimizeWin() {
        if (GcUtils.isNW) {
            require('nw.gui').Window.get().minimize();
        }
    }

    private closeWin() {
        if (GcUtils.isNW) {
            require('nw.gui').Window.get().close();
        }
    }

    private toggleWinState() {
        if (GcUtils.isNW) {
            const win = require('nw.gui').Window.get();
            if (this.windowMaximized) {
                win.restore();
            } else {
                win.maximize();
            }
        }
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
