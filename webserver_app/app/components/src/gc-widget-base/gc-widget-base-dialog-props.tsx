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
import { Method, Prop, Event, EventEmitter } from '@stencil/core';
import { WidgetBaseProps } from './gc-widget-base-props';

export type CloseReason = 'dismiss' | 'confirm' | string;

export class WidgetBaseDialogProps extends WidgetBaseProps {
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
}