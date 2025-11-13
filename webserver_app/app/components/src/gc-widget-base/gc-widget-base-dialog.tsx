/**
 *  Copyright (c) 2021, Texas Instruments Incorporated
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:\
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
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { WidgetBase, DIALOG_Z_INDEX } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseDialogProps, CloseReason } from './gc-widget-base-dialog-props';

let dialogCollection: HTMLElement[] = [];

/**
 * `DialogBase` provides the base implementation for GC dialogs.
 */
export abstract class WidgetBaseDialog extends WidgetBase {
    private hostResizeObserver: ResizeObserver;
    private dialogResizeObserver: ResizeObserver;
    private hostMoveObserver: MutationObserver;
    private resizeEventObserver: ResizeObserver;
    private layoutObserver: MutationObserver;
    private dialogDiv: HTMLElement;
    private contentDiv: HTMLElement;
    private topDiv: HTMLElement;
    private _isOpen = false;
    private _bound: DOMRect;

    constructor(protected readonly parent: WidgetBaseDialogProps) {
        super(parent);
    }

    protected renderContainer(content: JSX.Element): JSX.Element {
        return content;
    }

    render() {
        return super.render(
            <div id="top-container" ref={(el: HTMLElement) => this.topDiv = el} >
                <div id="dialog-div"
                    ref={(el: HTMLElement) => this.dialogDiv = el}
                    onMouseDown={this.dialogSelectedEvent}
                    tabIndex={0}>
                    { this.renderContainer(<div id="content" class="offsetParentForDesigner" ref={(el: HTMLElement) => this.contentDiv = el}><slot/></div>) }
                </div>
                {this.parent.modal ? <div class="modal-background"/> : null}
            </div>
        );
    }

    componentDidLoad() {
        /* opacity should be 0. */
        this.dialogDiv.style.display = 'flex';
        this.topDiv.style.display = 'flex';

        /* remove inline style */
        this.dialogDiv.style.display = '';
        this.topDiv.style.display = '';
        this.parent.el.tabIndex = -1;

        /* register event listeners */
        this.resizeEventObserver = new ResizeObserver(() => this.parent.resize.emit());
        this.resizeEventObserver.observe(this.dialogDiv); // listened to close the droplist on resize.

        if (GcUtils.isInDesigner) {
            /* In designer, match the dialog div and the host div. */
            this.dialogResizeObserver = new ResizeObserver(() => {
                this.matchBound(this.dialogDiv.getBoundingClientRect(), this.parent.el);
            });
            this.hostResizeObserver = new ResizeObserver(() => {
                this.matchBound(this.parent.el.getBoundingClientRect(), this.dialogDiv);
            });
            this.dialogResizeObserver.observe(this.dialogDiv);
            this.hostResizeObserver.observe(this.parent.el);

            /*  observe the movement change of host. */
            this.hostMoveObserver = new MutationObserver(() => {
                this.matchBound(this.parent.el.getBoundingClientRect(), this.dialogDiv);
            });
            this.hostMoveObserver.observe(this.parent.el, {
                attributes: true,
                attributeFilter: ['style']
            });

            const updateLayoutAttribute = () => {
                if (this.contentDiv) {
                    if (this.dialogDiv.attributes['layout']) {
                        this.contentDiv.setAttribute('layout', '');
                    } else {
                        this.contentDiv.removeAttribute('layout');
                    }
                }
            };
            this.layoutObserver = new MutationObserver(updateLayoutAttribute);
            this.layoutObserver.observe(this.dialogDiv, { attributes: true });
        }
    }

    disconnectedCallback() {
        if (GcUtils.isInDesigner) {
            this.dialogResizeObserver?.disconnect();
            this.hostResizeObserver?.disconnect();
            this.hostMoveObserver?.disconnect();
            this.layoutObserver?.disconnect();
        }
        this.resizeEventObserver?.disconnect();
    }

    /**
     * On click selection, make top dialog.
     */
    private dialogSelectedEvent = () => {
        if ((this.topDialog !== this.parent.el) && this._isOpen){
            this.initTopDialog(this.parent.el);
        }
    };

    /**
     * Make the input dialog be on top of all the other open dialogs.
     * @param element Dialog HTMLElement
     */
    private initTopDialog(element: HTMLElement){
        dialogCollection = dialogCollection.filter(dialog => dialog !== element);
        dialogCollection.push(element);
        // assign the proper zIndexes to the dialogCollection
        dialogCollection.forEach((dialog: HTMLElement, i: number) => {
            dialog.style.zIndex = `${i + DIALOG_Z_INDEX}`;
            dialog.tabIndex = i === (dialogCollection.length - 1) ? 0 : -1;
        });
        this.topDialog?.setAttribute('tabindex', '0');
        this.topDialog?.focus();
    }

    open(autoCenter: boolean = true) {
        if (!this._isOpen) {
            // use host size
            if (GcUtils.isInDesigner && this._bound){
                this.dialogDiv.style.display = 'flex';
                this.matchBound(this._bound, this.parent.el);
            }
            this.parent.el.classList.add('opened');
            this._isOpen = true;
            this.initTopDialog(this.parent.el);
        }
        this.dialogDiv.focus();
        this.parent.openedDialog.emit();
        if (autoCenter) {
            this.center();
        }
    }

    close(reason: CloseReason = 'dismiss' ): void {
        const options = { closeReason: reason, canClose: true };
        this.parent.closeDialog.emit(options);

        if (options.canClose){
            if (GcUtils.isInDesigner) {
                // save host size
                const bound  = this.dialogDiv.getBoundingClientRect();
                // resizeObserver gets triggered -after- display is set to none.
                if (bound.height > 0) this._bound = bound;
            }
            this.parent.el.tabIndex = -1;
            this.parent.el.classList.remove('opened');
            this._isOpen = false;
            // find the closed dialog in open stack and filter out.
            dialogCollection = dialogCollection.filter(dialog => dialog !== this.parent.el);
            this.parent.el.style.zIndex = '';
            // reassign focus to next open dialog
            if (dialogCollection.length > 0) {
                this.initTopDialog(this.topDialog);
            }
        }
    }

    center(): void {
        if (this.dialogBox) {
            /* allow elements to render before calculating position */
            requestAnimationFrame(() => {
                const bound = this.dialogBox.getBoundingClientRect();
                const windowCenterX = window.innerWidth / 2;
                const windowCenterY = window.innerHeight / 2;

                const dialogWidth = bound.width / 2;
                const dialogHeight = bound.height / 2;

                this.dialogBox.style.left = `${windowCenterX - dialogWidth}px`;
                this.dialogBox.style.top = `${windowCenterY - dialogHeight}px`;
                this.matchBound(this.dialogBox.getBoundingClientRect(), this.parent.el);
            });
        }
    }

    /**
     * Match the size and position of one DOMRect to a target element.
     * @param bound DOMRect position of an element
     * @param targetElement
     */
    private matchBound(bound: DOMRect, targetElement: HTMLElement){
        targetElement.style.width = `${bound.width}px`;
        targetElement.style.height = `${bound.height}px`;
        targetElement.style.top = `${bound.top}px`;
        targetElement.style.left = `${bound.left}px`;
        targetElement.style.position = 'fixed';
    }

    /**
     * Returns the current topmost open Dialog Element by z-index.
     */
    get topDialog(){
        return dialogCollection.slice(-1)[0] ?? undefined;
    }

    /**
     * The current floating dialog div with all the contents.
     */
    get dialogBox() {
        return this.dialogDiv;
    }
}