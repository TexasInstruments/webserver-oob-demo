/**
 *  Copyright (c) 2020, Texas Instruments Incorporated
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
import { WidgetBase } from './gc-widget-base';
import { WidgetBaseMenuProps } from './gc-widget-base-menu-props';

/**
 * `WidgetBaseMenu` provides the base implementation for the menu system.
 */
export abstract class WidgetBaseMenu extends WidgetBase {
    private hotKeyShift: boolean;
    private hotkeyCtrl: boolean;
    private hotkeyAlt: boolean;
    private hotkeyChar: string;

    constructor(protected readonly parent: WidgetBaseMenuProps) {
        super(parent);
    }

    protected hotkeyPressed() {
        /* do nothing for default implementation */
    }

    componentWillLoad() {
        let hotkey = this.parent['hotkey'];

        if (hotkey) {
            hotkey = hotkey
                .replace(/shift/ig, 'Shift')
                .replace(/ctrl/ig, 'Ctrl')
                .replace(/alt/ig, 'Alt');

            const segments = hotkey.split('+');
            this.parent['hotkey'] = segments.map((segment: string) => {
                if (!['Shift', 'Ctrl', 'Alt'].includes(segment)) {
                    this.hotkeyChar = segment.toLowerCase();
                    return segment.toUpperCase();
                }
                return segment;
            }).join('+');

            this.hotKeyShift = hotkey.indexOf('Shift') !== -1;
            this.hotkeyCtrl  = hotkey.indexOf('Ctrl') !== -1;
            this.hotkeyAlt   = hotkey.indexOf('Alt') !== -1;
        }

        if (this.hotkeyChar) {
            window.addEventListener('keydown', (ev: KeyboardEvent) => {
                if (ev.key === this.hotkeyChar && ev.shiftKey === this.hotKeyShift && ev.ctrlKey === this.hotkeyCtrl && ev.altKey === this.hotkeyAlt) {
                    ev.preventDefault();
                    ev.cancelBubble = true;
                    this.hotkeyPressed();
                }
            });
        }
    }
}