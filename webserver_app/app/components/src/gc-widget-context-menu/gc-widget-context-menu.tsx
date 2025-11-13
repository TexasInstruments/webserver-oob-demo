/**
 *  Copyright (c) 2021, Texas Instruments Incorporated
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *  Redistributions of source code must retain the above copyright
 *  notice, this list of conditions and the following disclaimer.
 *  notice, this list of conditions and the following disclaimer in the
 *  documentation and/or other materials provided with the distribution.
 *  Neither the name of Texas Instruments Incorporated nor the names of
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

import { h, Component, Prop, Event, EventEmitter, Element, Method, Watch } from '@stencil/core';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { WidgetBaseKeepVisibleProps } from '../gc-widget-base/gc-widget-base-keep-visible-props';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetMenuItem } from '../gc-widget-menu/gc-widget-menuitem';
import { MenuManager, GC_WIDGET_MENUITEM } from '../gc-widget-menu/internal/MenuManager';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';


/**
 * `ti-widget-contextmenu` displays a context menu to which menu items can be added. Can be anchored to an element with ID otherwise uses the parent element it is dropped in.
 * Right click to open the menu.
 *
 * Context Menu items may contain
 * other menu items (sub-menus) or menu actions that perform individual operations.
 * To construct sub menu items on the context menu, it is often easier to construct the
 * sub menu first, then drop it onto a menu when it is complete. This makes it easier
 * to select the sub menu and drop things onto it in the designer.
 *
 * @label Context Menu
 * @group Menus & Toolbars
 * @demo
 * @usage
 * @container
 */

@Component({
    tag: 'gc-widget-context-menu',
    styleUrl: 'gc-widget-context-menu.scss',
    shadow: true
})
export class WidgetContextMenu implements WidgetBaseProps, WidgetBaseKeepVisibleProps {
    private menuDiv: HTMLElement;
    private anchorDiv: HTMLElement;
    private menuBound: DOMRect;

    private base = new (
        class extends WidgetBase {
            get element() {
                return (this.parent as WidgetContextMenu).el;
            }
        })(this);

    render() {
        return this.base.render(
            <div id="menu-container" class="top-level" tabindex="0"
                ref={(el: HTMLElement) => this.menuDiv = el}>
                <slot />
            </div>
        );
    }

    /**
     * Id for the anchor parent element. If empty, the parent element for the context menu is used.
     */
    @Prop({ mutable: true }) anchorId: string;
    @Watch('anchorId')
    anchorIdChanged() {
        if (this.anchorDiv) {
            this.anchorDiv.removeEventListener('contextmenu', this.contextmenuEvent);
            this.anchorDiv.removeEventListener('keydown', ((ev: KeyboardEvent ) => {
                if (ev.key === 'ContextMenu') {
                    this.contextmenuEvent;
                }
            }) as EventListener);
            this.el.removeEventListener('blur', this.closeMenu);
        }
        window.setTimeout(() => {
            this.setAnchor(this.anchorId?.trim());
            if (this.anchorDiv) {
                /* show corresponding context menu on containing anchor div */
                this.anchorDiv.addEventListener('contextmenu', this.contextmenuEvent);
                this.anchorDiv.addEventListener('keydown', ((ev: KeyboardEvent ) => {
                    if (ev.key === 'ContextMenu') {
                        this.contextmenuEvent;
                    }
                }) as EventListener);
                this.el.addEventListener('blur', this.closeMenu);
            }
        });
    }

    @Watch('keepVisibleInDesigner')
    keepVisibleInDesignerChanged() {
        if (GcUtils.isInDesigner && this.keepVisibleInDesigner && !this.hidden) this.openMenu();
    }

    @Watch('hidden')
    hiddenChanged() {
        /* hide context menu div as well */
        if (this.hidden) {
            this.menuDiv.style.visibility = 'hidden';
            this.closeMenu();
            this.keepVisibleInDesigner = false;
        } else {
            this.menuDiv.style.visibility = 'visible';
            if (this.keepVisibleInDesigner) {
                this.openMenu();
            }
        }
    }

    connectedCallback() {
        /* on drag + drop from the GC pallette, the parent element changes if dropped into another container etc. Triggers on DOM move to remove/add event listeners to the right parent element. */
        this.anchorIdChanged();
    }

    disconnectedCallback() {
        if (this.anchorDiv) {
            this.anchorDiv.removeEventListener('contextmenu', this.contextmenuEvent);
            this.anchorDiv.removeEventListener('keydown', ((ev: KeyboardEvent ) => {
                if (ev.key === 'ContextMenu') {
                    this.contextmenuEvent;
                }
            }) as EventListener);
            this.el.removeEventListener('blur', this.closeMenu);
        }
    }

    componentWillLoad() {
        this.contextmenuEvent = this.contextmenuEvent.bind(this);
    }

    componentDidLoad() {
        window.setTimeout(() => {
            this.el.style.visibility = 'hidden';
            this.el.style.display = 'flex';
            this.menuBound = this.menuDiv.getBoundingClientRect();
            this.el.style.display = 'none';
            this.el.style.visibility = 'visible';
        }, 100);

        this.closeMenu = this.closeMenu.bind(this);

        /* open by default if in designer.*/
        if (GcUtils.isInDesigner) {
            this.el.style.display = 'flex';
            /* dimensions of a standard menuitem, setting a min area to drag new items in if the contextmenu is empty */
            this.el.style.minWidth = '188px';
            this.el.style.minHeight = '44px';
        }

        /* hide menu on click if not keepVisibleInDesigner */
        window.addEventListener('click', ((ev) => {
            if ((!GcUtils.isInDesigner || !this.keepVisibleInDesigner) && (ev.target as HTMLElement).tagName !== 'GC-WIDGET-MENUSEPARATOR') {
                this.closeMenu(ev);
            }
        }) as EventListener);

        window.addEventListener('contextmenu', this.closeMenu);
        window.addEventListener('resize', this.closeMenu);
        window.addEventListener('gc-command-run', this.closeMenu);
        window.addEventListener('wheel', this.closeMenu);

        /* gc-command-menu-click is a gc-menu-item event */
        window.addEventListener('gc-command-menu-click', ((ev: CustomEvent) => {
            const mi = this.castToMenuItem(ev.detail.el as HTMLElement);
            mi['_opened']
                ? mi.closeMenu()
                : mi.openMenu();
        }) as EventListener);

        window.addEventListener('gc-command-mouse-enter', ((ev: CustomEvent) => {
            const el = ev.detail.el as HTMLElement;

            /* close all other menu items */
            const allMenuItems: Array<HTMLElement> = [];
            MenuManager.getAllChildrenMenuItems(this.el).forEach(menuItem => allMenuItems.push(menuItem as HTMLElement));
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

            /* if el is same menu item as this context menu and it is an menu item, open it */
            if (MenuManager.isMenuItem(el)) {
                const mi = this.castToMenuItem(el);
                mi.openMenu();
                el.classList.add('active');
            }
        }) as EventListener);

        window.addEventListener('gc-command-mouse-leave', ((ev: CustomEvent) => {
            const el = ev.detail.el as HTMLElement;
            if (MenuManager.isMenuItem(el)) {
                const mi = this.castToMenuItem(el);
                mi.closeMenu();
                if (!mi['_opened']) {
                    el.classList.remove('active');
                }
            }
        }) as EventListener);

        this.anchorIdChanged();
    }

    private setAnchor(anchorId?: string) {
        this.anchorDiv = (anchorId)
            ? this.el.parentElement.querySelector(`#${anchorId}`) || document.querySelector(`#${anchorId}`)
            : this.el.parentElement;
    }

    private contextmenuEvent(e) {
        if (!this.hidden && !e.target.hidden) this.openMenu(e);
    }

    private castToMenuItem(element: Element) {
        return element as unknown as WidgetMenuItem;
    }

    private closeMenu(e?: Event) {
        if (this.keepVisibleInDesigner && GcUtils.isInDesigner) {
            /* contextmenu and wheel events need to continue */
            if (e && (e.type !== 'contextmenu') && (e.type !== 'wheel')) {
                e.preventDefault();
                e.stopPropagation();
            }
        } else {
            /* contextmenu and wheel events need to continue */
            if (e && (e.type !== 'contextmenu') && (e.type !== 'wheel')) {
                e.preventDefault();
                e.stopPropagation();
            }
            /* close all menus inside context menu*/
            this.el?.querySelectorAll(GC_WIDGET_MENUITEM)?.forEach((menuEntry: Element) => {
                this.castToMenuItem(menuEntry).closeMenu();
            });
            this.el.style.display = 'none';
        }
    }

    private openMenu(e?: MouseEvent) {
        let x = 0;
        let y = 0;
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            x = e.clientX;
            y = e.clientY;
        } else if (GcUtils.isInDesigner) {
            // default show where host is in designer
            x = parseInt(this.el.style.left, 10);
            y = parseInt(this.el.style.top, 10);
        }

        // update el size in designer in case new items were added
        if (GcUtils.isInDesigner) {
            this.el.style.visibility = 'hidden';
            this.el.style.display = 'flex';
            this.menuBound = this.menuDiv.getBoundingClientRect();
        }

        // test if contextmenu will display out of bounds
        const rect = this.menuBound;
        const width = rect.right - rect.left;
        const screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        // width out of bounds
        if (x + width > screenWidth) {
            x = x - width;
            x = Math.max(x, 0);
        }
        const height = rect.bottom - rect.top;
        const screenHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        // height out of bounds
        if (y + height > screenHeight) {
            y = y - height;
            y = Math.max(y, 0);
        }

        this.menuDiv.style.top = `${y}px`;
        this.menuDiv.style.left = `${x}px`;

        // adjust size of host in designer only for drag/drop
        if (GcUtils.isInDesigner) {
            this.el.style.width = `${width}px`;
            this.el.style.height = `${height}px`;
        }

        // show the menu
        this.el.style.display = 'flex';
        this.el.style.visibility = 'visible';
        this.el.removeAttribute('hidden');
        MenuManager.updateMenuLayout(this.el);
        this.el.focus();
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
    // #region gc-widget-base/gc-widget-base-keep-visible-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the widget visibility in the designer.
     * @order 900
     */
    @Prop({ reflect: true }) keepVisibleInDesigner: boolean;
    // #endregion

}
