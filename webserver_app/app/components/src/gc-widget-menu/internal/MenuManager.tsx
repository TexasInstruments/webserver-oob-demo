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

import { WidgetMenuItem } from '../gc-widget-menuitem';
import { WidgetMenuAction } from '../gc-widget-menuaction';

const divForMeasuringTextWidth = document.createElement('div');
divForMeasuringTextWidth.style.visibility = 'hidden';
divForMeasuringTextWidth.style.padding = '0';
divForMeasuringTextWidth.style.position = 'absolute';
divForMeasuringTextWidth.style.top = '0';
document.body.appendChild(divForMeasuringTextWidth);

export const GC_WIDGET_MENUBAR    = 'GC-WIDGET-MENUBAR';
export const GC_WIDGET_MENUITEM   = 'GC-WIDGET-MENUITEM';
export const GC_WIDGET_MENUACTION = 'GC-WIDGET-MENUACTION';
export const GC_WIDGET_CONTEXT_MENU = 'GC-WIDGET-CONTEXT-MENU';
export const GC_WIDGET_MENUSEPERATOR = 'GC-WIDGET-MENUSEPERATOR';

export class MenuManager {
    public static closeAllMenus() {
        const menuBars = document.querySelectorAll(GC_WIDGET_MENUBAR);
        menuBars.forEach(menubar => {
            const menuItems = menubar.querySelectorAll(GC_WIDGET_MENUITEM);
            menuItems.forEach((menuItem: HTMLElement) => {
                /* menu embedded inside more-item menuitem */
                const topMenuItem = MenuManager.getTopLevelMenuItem(menuItem);
                (topMenuItem as unknown as WidgetMenuItem)?.closeMenu();

                /* regular menuitem */
                (menuItem as unknown as WidgetMenuItem).closeMenu();
            });
        });
    }
    static calcMaxTextWidth(elements: HTMLElement[]) {
        let maxLabelWidth = 0;
        let maxHotkeyWidth = 0;
        elements.forEach((element: HTMLElement) => {
            if (MenuManager.isMenuItemOrActionItem(element)) {
                const styles = window.getComputedStyle(element);
                if (styles['display'] === 'none') return;

                const label = element['label'] || '';    // assumes that the element has a label property for menuitem and menuaction
                const hotkey = element['hotkey'] || '';  // assumes that the element has a hotkey property for menuitem and menuaction
                const font = [
                    styles['font-style'],
                    styles['font-variant'],
                    styles['font-weight'],
                    styles['font-size'],
                    styles['line-height'],
                    styles['font-family']
                ].join(' ');

                divForMeasuringTextWidth.style.font = font;

                if (label?.length > 0) {
                    divForMeasuringTextWidth.textContent = label;
                    maxLabelWidth = divForMeasuringTextWidth.clientWidth > maxLabelWidth ? divForMeasuringTextWidth.clientWidth : maxLabelWidth;
                }

                if (hotkey?.length > 0) {
                    divForMeasuringTextWidth.textContent = hotkey;
                    maxHotkeyWidth = divForMeasuringTextWidth.clientWidth > maxHotkeyWidth ? divForMeasuringTextWidth.clientWidth : maxHotkeyWidth;
                }

            }
        });
        return { label: maxLabelWidth, hotkey: maxHotkeyWidth };
    }

    static getMenuBar(element: HTMLElement): HTMLElement {
        let parent = element;
        while (parent) {
            if (parent.tagName === GC_WIDGET_MENUBAR) {
                return parent;
            }
            parent = parent.parentElement || parent.parentNode['host'];
        }
        return undefined;
    }

    static getActions(element: HTMLElement): WidgetMenuAction[] {
        const results = [];
        element?.querySelectorAll(`:scope > ${GC_WIDGET_MENUACTION}`).forEach(e => results.push(e));
        return results;
    }

    static getMenuItems(element: HTMLElement): WidgetMenuItem[] {
        const results = [];
        element?.querySelectorAll(`:scope > ${GC_WIDGET_MENUITEM}`).forEach(e => results.push(e));
        return results;
    }

    static getTopLevelMenuItem(element: HTMLElement): HTMLElement {
        /* Special case: check if the element is embedded in the more-item menuitem */

        let moreElement = MenuManager.getMoreMenuItem(element);
        if (moreElement) {
            return moreElement;
        }

        let lastMenuItem = undefined;
        let parent = element.parentElement;
        while (parent) {
            moreElement = MenuManager.getMoreMenuItem(parent);
            if (moreElement) {
                return moreElement;
            } else if (MenuManager.isMenuItem(parent)) {
                lastMenuItem = parent;
            }
            parent = parent.parentElement;
        }
        return lastMenuItem;
    }

    static getMoreMenuChildItems(moreMenuItem: HTMLElement): HTMLElement[] {
        return moreMenuItem.querySelector('slot').assignedElements() as HTMLElement[];
    }

    private static getMoreMenuItem(element: HTMLElement) {
        const moreElement = element?.assignedSlot?.parentElement;
        if (MenuManager.isMoreMenuItem(moreElement)) {
            return moreElement;
        } else {
            return undefined;
        }
    }

    static getAllChildrenMenuActions(element: HTMLElement): HTMLElement[] {
        const result = [];
        element?.querySelectorAll(`${GC_WIDGET_MENUACTION}`).forEach(e => result.push(e));
        return result;
    };

    static getAllChildrenMenuItems(element: HTMLElement): HTMLElement[] {
        const result = [];
        element?.querySelectorAll(`${GC_WIDGET_MENUITEM}`).forEach(e => result.push(e));
        return result;
    }

    static getParentMenuItem(element: HTMLElement) {
        /* Special case: check if the element is embedded in the more-item menuitem */

        const moreElement = MenuManager.getMoreMenuItem(element);
        if (moreElement) {
            return moreElement;
        }

        let parent = element.parentElement;
        while (parent) {
            if (MenuManager.isMenuItem(parent) || parent.tagName === GC_WIDGET_CONTEXT_MENU)
                return parent;
            parent = parent.parentElement;
        }
        return undefined;
    }

    static isTopLevelMenuItem(element: HTMLElement) {
        if (MenuManager.isMoreMenuItem(element)) {
            return true;
        }
        if (!element.assignedSlot) {
            return false;
        }

        let parent = element.assignedSlot.parentElement;
        while (parent) {
            if (MenuManager.isMenuItem(parent) || (parent.classList.contains('top-level') && element.parentElement.tagName === GC_WIDGET_CONTEXT_MENU)) return false;
            parent = parent.parentElement || parent.parentNode['host'];
        }
        return true;
    }

    static isMoreMenuItem(element: HTMLElement) {
        return element?.classList.contains('more-item');
    }

    static isMenuItem(element: HTMLElement) {
        return GC_WIDGET_MENUITEM === element.tagName;
    }

    static isMenuAction(element: HTMLElement) {
        return GC_WIDGET_MENUACTION === element.tagName;
    }

    static isSubMenuItem(element: HTMLElement) {
        return element.classList.contains('sub-menu');
    }

    static isMenuItemOrActionItem(element: HTMLElement) {
        return MenuManager.isMenuItem(element) || MenuManager.isMenuAction(element);
    }

    static updateMenuLayout(element: HTMLElement) {
        /* set has-hot-key class for styling the grid column template */
        const menuActions = MenuManager.getActions(element);
        const menuItems = MenuManager.getMenuItems(element);
        const hasHotKey = menuActions.reduce((acc, e) => acc || !!(e as unknown as WidgetMenuAction).hotkey, false);
        const hasChevron = menuItems.length > 0;

        let colCount = 2;
        if (hasChevron) colCount++;
        if (hasHotKey) colCount++;

        [...menuActions, ...menuItems].forEach(e => {
            if (MenuManager.isMenuAction(e as unknown as HTMLElement) || MenuManager.isSubMenuItem(e as unknown as HTMLElement)) {
                const classList = (e as unknown as HTMLElement).classList;
                classList.remove('col-count-2', 'col-count-3', 'col-count-4');
                classList.add(`col-count-${colCount}`);

                if (hasHotKey) {
                    classList.add('has-hotkey');
                } else {
                    classList.remove('has-hokey');
                }
            }
        });

    }
};