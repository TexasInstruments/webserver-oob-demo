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
import { h, Component, Prop, Event, EventEmitter, Element, Method, Listen } from '@stencil/core';
import { WidgetBaseMenuProps } from '../gc-widget-base/gc-widget-base-menu-props';
import { GcConsole } from '../gc-core-assets/lib/GcConsole';
import { WidgetBaseMenu } from '../gc-widget-base/gc-widget-base-menu';
import { MenuManager } from './internal/MenuManager';
import { ActionRegistry } from './lib/ActionRegistry';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';

const console = new GcConsole('gc-widget-menu');

/**
 * `gc-widget-menuaction` a sub menu item that performs an action. These are typically dropped onto an
 * existing gc-widget-menuitem element. Actions are register in javascript so that they can be reused
 * in more than one place; for example, in toolbars and context menus, and also keep track of state like
 * enabled and disabled in one place. Menu action widgets will automatically show themselves as disabled
 * when the registered action is not found, or it has been explicitly disabled.
 *
 * @label Menu Action
 * @group Menus & Toolbars
 * @demo
 * @usage
 * @archetype <gc-widget-menuaction label="Menu Action"></gc-widget-menuaction>
 */
@Component({
    tag: 'gc-widget-menuaction',
    styleUrl: 'gc-widget-menuaction.scss',
    shadow: true
})
export class WidgetMenuAction implements WidgetBaseMenuProps, WidgetBaseTooltipProps {
    private base = new (
        class extends WidgetBaseMenu {
            get element() {
                return this.widget.el;
            }

            get widget() {
                return (this.parent as WidgetMenuAction);
            }

            hotkeyPressed() {
                this.widget.run();
            }
        })(this);

    /**
     * Identifies the action to perform when this menu is executed.
     *
     * @order 3
     */
    @Prop() actionId: string;

    /**
     * The optional accelerator hot key. i.e Ctrl+X, Ctrl+Shift+T
     *
     * @order 4
     */
    @Prop() hotkey?: string;

    /**
     * An optional attribute to enable toggle mode for this menu.
     *
     * @order 5
     */
    @Prop({ reflect: true }) toggle?: boolean;

    render() {
        return this.base.render(
            //JSXON
            <div class="grid-container">
                {
                    this.icon ? <gc-widget-icon class="icon" appearance="custom" icon={ this.icon } path={ this.iconFolderPath } /> :
                        this.toggle ? <div class="icon"><gc-widget-icon class="checkmark" appearance="custom" icon="navigation:check" /></div> :
                            <div class="icon" />
                }
                <span id="label">{ this.label }</span>
                { this.hotkey ? <span id="hotkey">{ this.hotkey }</span> : undefined }
            </div>,
            { tooltip: this.tooltip }
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

        if (!this.actionId) {
            this.actionId = this.el.id;
        }
    }

    private run() {
        console.log(`Run: ${this.label} (action-id: ${this.actionId})`);
        window.dispatchEvent(new CustomEvent('gc-command-run', { detail: { id: this.actionId } }));
    }

    @Listen('mouseenter')
    onMouseEnter() {
        window.dispatchEvent(new CustomEvent('gc-command-mouse-enter', { detail: { el: this.el } } ));
    }

    @Listen('mouseleave')
    onMouseExit() {
        window.dispatchEvent(new CustomEvent('gc-command-mouse-leave', { detail: { el: this.el } } ));
    }

    @Listen('click')
    onMouseClick(e: MouseEvent) {
        e.preventDefault();
        e.cancelBubble = true;
        if (ActionRegistry.isEnabled(this.actionId)) {
            this.run();
        }
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
    // #region gc-widget-base/gc-widget-base-tooltip-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the tooltip that is displayed for this widget.
     * @order 210
     */
    @Prop() tooltip: string;
    // #endregion

}
