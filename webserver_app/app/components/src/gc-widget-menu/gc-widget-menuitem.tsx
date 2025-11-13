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
import { h, Component, Prop, Event, EventEmitter, Element, Method, Listen, State } from '@stencil/core';
import { WidgetBaseMenuProps } from '../gc-widget-base/gc-widget-base-menu-props';
import { MenuManager } from './internal/MenuManager';
import { ActionRegistry } from '../gc-widget-menu/lib/ActionRegistry';
import { WidgetBaseMenu } from '../gc-widget-base/gc-widget-base-menu';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { WidgetMenuAction } from './gc-widget-menuaction';

/**
 * `gc-widget-menuitem` a menu item to add to a menu bar. Menu items may contain
 * other menu items (sub-menus) or menu actions that perform individual operations.
 * To construct sub menu items on the menu bar, it is often easier to construct the
 * sub menu first, then drop it onto a menu when it is complete. This makes it easier
 * to select the sub menu and drop things onto it in the designer.
 *
 * @label Menu Item
 * @group Menus & Toolbars
 * @demo
 * @usage
 * @container
 */
@Component({
    tag: 'gc-widget-menuitem',
    styleUrl: 'gc-widget-menuitem.scss',
    shadow: true
})
export class WidgetMenuItem implements WidgetBaseMenuProps {
    private handlingDesignerEvent = false;
    private refCount = 0;
    private opened = false;
    private base = new (
        class extends WidgetBaseMenu {
            get element() {
                return (this.parent as WidgetMenuItem).el;
            }
        })(this);

    @State() hasChevron: boolean;

    render() {
        return this.base.render(
            //JSXON
            <div class="grid-container">
                { this.icon ? <gc-widget-icon appearance="custom" icon={ this.icon } path={ this.iconFolderPath }></gc-widget-icon> : <div /> }
                <span id="label">{ this.label }</span>
                <span id="hotkey"></span>
                { this.hasChevron ? <gc-widget-icon appearance="custom" icon="navigation:chevron_right"></gc-widget-icon> : undefined }

                <div id="sub-menu" hidden>
                    <slot></slot>
                </div>
            </div>
            //JSXOFF
        );
    }

    connectedCallback() {
        MenuManager.getParentMenuItem(this.el) ?
            this.el.classList.add('sub-menu') :
            this.el.classList.remove('sub-menu');
    }

    componentWillLoad() {
        this.base.componentWillLoad();

        /* private _setChevron method, this can be call to update the hasChevron state of this element */
        this.el['_setChevron'] = (chevron: boolean) => {
            this.hasChevron = chevron;
        };

        /* private opened property, this can be call to query the state of this element */
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        Object.defineProperty(this.el, '_opened', {
            get() {
                return self.opened;
            }
        });

        if (GcUtils.isInDesigner) {
            this.el['designerMenuItem']         = this;
            this.el['designerGetClientRects']   = this.designerGetClientRects.bind(this);
            this.el['designerContainerEntered'] = this.designerContainerEntered.bind(this);
        }
    }

    componentDidRender() {
        /* defer changing the state within render */
        setTimeout(() => {
            /* add chevron if not top level menu */
            if (!MenuManager.isTopLevelMenuItem(this.el)) {
                this.hasChevron = MenuManager.getAllChildrenMenuActions(this.el).length > 0 ||
                MenuManager.getAllChildrenMenuItems(this.el).length > 0;
            }
        });

        MenuManager.updateMenuLayout(this.el);
    }

    private designerGetClientRects() {
        return [
            this.el.getBoundingClientRect(),
            this.subMenu.getBoundingClientRect()
        ];
    }

    private designerContainerEntered(entered: boolean) {
        this.designerUpdateEnteredRef(entered);
        if (entered) {
            this.handlingDesignerEvent = true;
            this.openMenu();

        } else {
            let parent = this.el;
            while (parent) {
                const mi = parent['designerMenuItem'] as WidgetMenuItem;
                if (mi?.refCount === 0) {
                    mi.handlingDesignerEvent = false;
                    mi.closeMenu();
                }
                parent = MenuManager.getParentMenuItem(parent);
            }
        }
    }

    private designerUpdateEnteredRef(add: boolean) {
        let parent = this.el;
        while (parent) {
            const mi = parent['designerMenuItem'];
            if (mi) {
                add ? mi.refCount++ : mi.refCount--;
            }
            parent = MenuManager.getParentMenuItem(parent);
        }
    }

    /**
     * Close the menu.
     */
    @Method()
    async closeMenu() {
        this.opened = false;
        this.el.classList.remove('active');
        this.subMenu.style.display = 'none';
    }

    @Listen('mouseenter')
    onMouseEnter() {
        if (!this.handlingDesignerEvent) {
            window.dispatchEvent(new CustomEvent('gc-command-mouse-enter', { detail: { el: this.el } } ));
        }
    }

    @Listen('mouseleave')
    onMouseExit() {
        if (!this.handlingDesignerEvent) {
            window.dispatchEvent(new CustomEvent('gc-command-mouse-leave', { detail: { el: this.el } } ));
        }
    }

    @Listen('click')
    onClick(ev: MouseEvent) {
        ev.preventDefault();
        ev.cancelBubble = true;
        window.dispatchEvent(new CustomEvent('gc-command-menu-click', { detail: { el: this.el } } ));
    }

    get childMenuItems() {
        return this.subMenu?.querySelector('slot').assignedElements() as Array<HTMLElement>;
    }

    get subMenu() {
        return this.el.shadowRoot.querySelector<HTMLElement>('#sub-menu');
    }

    @Method()
    async openMenu() {
        this.opened = true;
        this.el.classList.add('active');
        MenuManager.updateMenuLayout(this.el);

        /* dynamically query menu item states */
        const actions = MenuManager.getActions(this.el);
        actions.forEach(action => {
            const el = action as unknown as HTMLElement;

            /* test for enablement */
            const enabled = ActionRegistry.isEnabled(action.actionId);
            enabled ? el.classList.remove('disabled') : el.classList.add('disabled');

            /* test for visibility */
            const visible = ActionRegistry.isVisible(action.actionId);
            visible ? el.removeAttribute('hidden') : el.setAttribute('hidden', 'true');

            /* test for checked */
            const toggle = el.getAttribute('toggle');
            if (toggle !== null || toggle !== undefined) {
                ActionRegistry.isChecked(action.actionId) ? el.classList.add('checked') : el.classList.remove('checked');
            }
        });

        /* initialize the menu with a chevron and set the width */
        const childMenuItems = MenuManager.isMoreMenuItem(this.el) ? MenuManager.getMoreMenuChildItems(this.el) : this.childMenuItems;
        const textWidth = MenuManager.calcMaxTextWidth(childMenuItems);
        childMenuItems.forEach((child: HTMLElement )=> {
            /* set the min-width for each child element */
            if (MenuManager.isMenuItemOrActionItem(child)) {
                const label = child.shadowRoot.querySelector<HTMLElement>('#label');
                if (label) {
                    label.style.minWidth = (textWidth.label + 10 /* extra spacing */) + 'px';
                }

                const hotkey = child.shadowRoot.querySelector<HTMLElement>('#hotkey');
                if (hotkey) {
                    hotkey.style.minWidth = (textWidth.hotkey) + 'px';
                }
            }
        });

        /* calculate the submenu horizontal/vertical direction and position */
        let top = null, left = null;
        const isSubMenu = MenuManager.isSubMenuItem(this.el);
        const subMenuStyle = this.subMenu.style;
        const borderWidth = +window.getComputedStyle(this.subMenu).borderWidth.replace('px', '');

        if (isSubMenu) {
            top  = this.el.offsetTop;
            left = this.el.getBoundingClientRect().width;
        } else {
            top  = this.el.offsetTop + this.el.clientHeight;
            left = this.el.offsetLeft;
        }

        subMenuStyle.top     = top + 'px';
        subMenuStyle.left    = left + 'px';
        subMenuStyle.right   = '';
        subMenuStyle.bottom  = '';
        subMenuStyle.display = 'flex';

        const screenWidth    = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        const screenHeight   = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        const menuRect       = this.el.getBoundingClientRect();
        const subMenuRect    = this.subMenu.getBoundingClientRect();
        const isRootMenuItem = MenuManager.isTopLevelMenuItem(this.el);
        if (subMenuRect.width + menuRect.right > screenWidth) {
            this.setSubMenuHorizontalPosition(isRootMenuItem, borderWidth, screenWidth, menuRect);
        }
        if (subMenuRect.height + menuRect.bottom > screenHeight) {
            this.setSubMenuVerticalPosition(isRootMenuItem, borderWidth, screenHeight, menuRect);
        }
    }

    private setSubMenuVerticalPosition(isTopMenuItem: boolean, borderWidth: number, screenHeight: number, menuRect: DOMRect) {
        const subMenuStyle = this.subMenu.style;

        if (isTopMenuItem) {
            const mb = MenuManager.getMenuBar(this.el);
            const mbHeight = mb ? mb.clientHeight : 0;
            subMenuStyle.bottom = (screenHeight - menuRect.y + menuRect.height - mbHeight) + 'px';

        } else {
            subMenuStyle.bottom = (this.el.offsetHeight - this.el.clientHeight) - borderWidth + 'px';
        }
        subMenuStyle.top = '';
    }

    private setSubMenuHorizontalPosition(isTopMenuItem: boolean, borderWidth: number, screenWidth: number, menuRect: DOMRect) {
        const subMenuStyle = this.subMenu.style;

        if (isTopMenuItem) {
            subMenuStyle.right = screenWidth - (menuRect.x + menuRect.width) + 'px';

        } else {
            subMenuStyle.right = this.el.offsetWidth + 'px';
            subMenuStyle.top = (this.el.offsetTop - borderWidth) + 'px';
        }
        subMenuStyle.left = '';
    }

    // #region gc-widget-base/gc-widget-base-menu-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The menu label.
     *
     * @order 2
     */
    @Prop() label: string;

    /**
     * The optional icon to be displayed (svgFilename:iconName, e.g. objects:info-circle)
     *
     * @order 11
     */
    @Prop() icon?: string;

    /**
     * Provides the optional path to the custom SVG icon folder.
     *
     * @order 12
     */
    @Prop() iconFolderPath?: string;
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
