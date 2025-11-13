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
 *
 */
import { Component, h, Prop, Method, Event, EventEmitter, Element, Watch, Listen, JSX } from '@stencil/core';
import { WidgetBaseKeepVisibleProps } from '../gc-widget-base/gc-widget-base-keep-visible-props';
import { WidgetBaseDialog } from '../gc-widget-base/gc-widget-base-dialog';
import { WidgetBaseDialogProps, CloseReason } from '../gc-widget-base/gc-widget-base-dialog-props';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';

/**
 * `gc-widget-dialog` for creating customized modal dialogs. It has a header, content area, and an action bar.
 * The header can contain a main title, description, and an image. The action bar
 * contains a set of buttons. The dialog can be movable by dragging the header section,
 * and can be resizable.
 *
 * @label Dialog
 * @group Dialogs
 * @css --gc-modal-color | dialog modal background color | unset { "kind": "color"}
 * @css --gc-modal-opacity | dialog modal background opacity | unset { "kind": "string"}
 * @layout
 * @demo
 * @usage
 * @layout
 * @container
 */

@Component({
    tag: 'gc-widget-dialog',
    styleUrl: 'gc-widget-dialog.scss',
    shadow: true
})
export class WidgetDialog implements WidgetBaseDialogProps, WidgetBaseKeepVisibleProps {
    private headerDiv: HTMLElement;
    private moving = false;
    private offset = [0, 0];
    private confirmBtns: NodeListOf<HTMLElement>;
    private dismissBtns: NodeListOf<HTMLElement>;

    private base = new (
        class extends WidgetBaseDialog {
            get dialog() {
                return this.parent as WidgetDialog;
            }
            get element() {
                return this.dialog.el;
            }
            renderContainer(content: JSX.Element): JSX.Element {
                return this.dialog.renderContainer(content);
            }
        }
    )(this);

    renderContainer(content: JSX.Element): JSX.Element {
        return [
            this.heading ?
                <div id="header" ref={(el: HTMLElement) => this.headerDiv = el} onMouseDown={this.mouseDownEvent}>
                    <div id="title-stack"><h1 id="heading" >{this.heading}</h1>
                        {this.desc ? <h4 id="desc" >{this.desc}</h4> : null}</div>
                    {this.icon ? <gc-widget-icon appearance="reversed" icon={this.icon} path={this.iconPath} size="xl"/> : null}
                </div> : null,
            content, /* content from the base */
            <slot name="action-bar"/>
        ];
    }

    render() {
        return this.base.render();
    }

    componentDidRender() {
        this.base.dialogBox.style.minWidth = window.getComputedStyle(this.el).minWidth;
        this.base.dialogBox.style.maxWidth = window.getComputedStyle(this.el).maxWidth;
        this.base.dialogBox.style.minHeight = window.getComputedStyle(this.el).minHeight;
        this.base.dialogBox.style.maxHeight = window.getComputedStyle(this.el).maxHeight;
        this.base.dialogBox.style.width = window.getComputedStyle(this.el).width;

        if (this.el.classList.contains('height-fit-content')) {
            this.base.dialogBox.style.height = 'fit-content';
        } else {
            this.base.dialogBox.style.height = window.getComputedStyle(this.el).height;
        }
    }

    /**
     * The string to display in the header.
     * @order 1
     */
    @Prop({ reflect: true }) heading: string;

    /**
      * The description string to display under the heading string in the header.
      * @order 2
      */
    @Prop({ reflect: true }) desc: string;

    /**
     * The icon in the header.
     * @order 3
     */
    @Prop({ reflect: true }) icon?: string;

    /**
     * Path to the icon folder, can be used to override the default icon-theme and icon-file.
     * @order 4
     */
    @Prop({ reflect: true }) iconPath?: string = undefined;

    /**
     * If true, the dialog will close if the esc key is pressed
     * @order 5
     */
    @Prop({ reflect: true }) closeOnEsc: boolean = true;

    /**
     * Main way to toggle showing the dialog in the Designer.
     */
    @Watch('keepVisibleInDesigner')
    keepVisibleInDesignerChanged() {
        if (GcUtils.isInDesigner && !this.hidden) {
            this.keepVisibleInDesigner ? this.open() : this.close();
        }
    }

    @Watch('hidden')
    hiddenChanged() {
        if (GcUtils.isInDesigner && this.keepVisibleInDesigner) {
            this.hidden ? this.close() : this.open();
        } else if (this.hidden) {
            this.close();
        }
    }

    @Watch('heading')
    headingChanged(newValue: string, oldValue?: string) {
        if (newValue && !oldValue) {
            // mousedown event added when headerDiv is rendered.
            window.addEventListener('mouseup', this.mouseUpEvent);
            window.addEventListener('mousemove', this.mouseMoveEvent);
        } else if (!newValue && oldValue) {
            //remove listeners
            window.removeEventListener('mousemove', this.mouseMoveEvent);
            window.removeEventListener('mouseup', this.mouseUpEvent);
        }
    }

    componentWillLoad() {
        this.dismissActionEvent = this.dismissActionEvent.bind(this);
        this.confirmDefaultActionEvent = this.confirmDefaultActionEvent.bind(this);

        // Set the action bar buttons to have custom button-type,
        // so that they can be overridden with a dialog button style.
        const els = this.el.querySelectorAll<HTMLElement>('gc-widget-button[slot="action-bar"]');
        els.forEach(element => {
            element.setAttribute('button-type', 'custom');
            element.style.setProperty('--gc-text-transform', 'uppercase');
        });
    }

    componentDidLoad(){
        this.base.componentDidLoad();
        this.headingChanged(this.heading);

        if (!GcUtils.isInDesigner) {
            /* buttons by default in the archetype */
            this.el.addEventListener('keydown', this.keyDownEvent);
            /* Find all buttons with class that contains dialog-dismiss/
            dialog-confirm and add the event listeners needed. */
            this.confirmBtns = this.el.querySelectorAll<HTMLElement>('*[class*="dialog-confirm"]');
            this.confirmBtns?.forEach((element)=>{
                element.addEventListener('click',
                    this.confirmDefaultActionEvent);
            });
            this.dismissBtns = this.el.querySelectorAll<HTMLElement>('*[class*="dialog-dismiss"]');
            this.dismissBtns?.forEach((element)=>{
                element.addEventListener('click', this.dismissActionEvent);
            });

        } else if (this.keepVisibleInDesigner) {
            this.open(); // onload in designer
        }
    }

    disconnectedCallback() {
        this.base.disconnectedCallback();
        if (!GcUtils.isInDesigner && this.heading) {
            window.removeEventListener('mousemove', this.mouseMoveEvent);
            window.removeEventListener('mouseup', this.mouseUpEvent);
        }
    }

    matchBound(bound: DOMRect, targetElement: HTMLElement){
        targetElement.style.width = `${bound.width}px`;
        targetElement.style.height = `${bound.height}px`;
        targetElement.style.top = `${bound.top}px`;
        targetElement.style.left = `${bound.left}px`;
        targetElement.style.position = 'fixed';
    }

    /* INTERACTIONS */
    private dismissActionEvent = () => {
        this.base.close();
    };

    private confirmDefaultActionEvent = () => {
        this.base.close('confirm');
    };

    private mouseDownEvent = (e: MouseEvent) => {
        this.moving = true;
        const bound = this.base.dialogBox.getBoundingClientRect();
        this.base.dialogBox.style.top = `${bound.top}px`;
        this.offset = [
            this.base.dialogBox.offsetLeft - e.clientX,
            this.base.dialogBox.offsetTop - e.clientY
        ];
    };

    private mouseUpEvent = (e: MouseEvent) => {
        if (this.moving) {
            e.preventDefault();
            this.moving = false;
            this.matchBound(this.base.dialogBox.getBoundingClientRect(), this.el);
        }
    };

    private mouseMoveEvent = (e: MouseEvent) => {
        if (this.moving) {
            e.preventDefault();
            const x = e.clientX  + this.offset[0];
            const y = e.clientY + this.offset[1];
            // limit drag to more than (0,0) [top left corner] to keep div in view
            this.base.dialogBox.style.left = `${x > 0 ? x : 0}px`;
            this.base.dialogBox.style.top = `${y > 0 ? y : 0}px`;
        }
    };

    private keyDownEvent = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && (this.base.topDialog === this.el) && this.closeOnEsc) {
            e.preventDefault();
            this.close();
        }
    };

    // #region gc-widget-base/gc-widget-base-dialog-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Fired when the dialog has closed.
     */
    @Event({ eventName: 'dialog-close' }) closeDialog: EventEmitter<{ canClose: boolean; closeReason: CloseReason }>;

    /**
     * Fired when the dialog has opened.
     */
    @Event({ eventName: 'dialog-open' }) openedDialog: EventEmitter;


    /**
     * Fired when the dialog has resized.
     */
    @Event({ eventName: 'dialog-resize' }) resize: EventEmitter;

    /**
     * If `true`, shows a backdrop that blocks click events on background elements.
     * @order 83
     */
    @Prop({ reflect: true }) modal: boolean = false;

    /**
     * If `true`, the dialog will have a resize handler.
     * @order 84
     */
    @Prop({ reflect: true }) resizable: boolean = true;

    /**
     * Closes the dialog.
     * @param reason the reason to close the dialog, default to `dismiss`
     */
    @Method()
    async close(reason?: CloseReason): Promise<void> {
        this['base']['close'](reason);
    }

    /**
     * Opens the dialog ,on top of all other open dialogs.
     * @param autoCenter `true` to auto center the dialog when opened
     */
    @Method()
    async open(autoCenter: boolean = true): Promise<void> {
        this['base']['open'](autoCenter);
    }

    /**
     * Center the dialog to the browser window. This method can be use to
     * center the dialog after it is opened.
     */
    async center(): Promise<void> {
        this['base']['center']();
    }
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
    // #region gc-widget-base/gc-widget-base-keep-visible-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * Controls the widget visibility in the designer.
     * @order 900
     */
    @Prop({ reflect: true }) keepVisibleInDesigner: boolean;
    // #endregion

}
