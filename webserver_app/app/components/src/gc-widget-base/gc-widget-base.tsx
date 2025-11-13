/**
 *  Copyright (c) 2019, 2021 Texas Instruments Incorporated
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
import '../gc-core-assets/gc-core-assets';
import '../gc-widget-message-dialog/lib/GcMessageDialog';
import { GcLocalStorage } from '../gc-core-assets/lib/GcLocalStorage';
import { h, JSX, EventEmitter } from '@stencil/core';
import { WidgetBaseProps } from './gc-widget-base-props';

export type RenderOptions = {
    tabIndex?: number;
    caption?: string;
    infoText?: string;
    tooltip?: string;
};

const STORAGE_ROOT = 'GC-SETTINGS';
export const DIALOG_Z_INDEX = 9700;
export const MENU_Z_INDEX = 9800;

/**
 * `WidgetBase` provides the base implementation for TI widgets.
 */
export abstract class WidgetBase {
    constructor(protected readonly parent: WidgetBaseProps) { }

    abstract get element(): HTMLElement;

    protected renderInfoText(infoText?: string): JSX.Element {
        if (infoText) {
            // JSXON
            return (
                <div class="help-text icon" key="info">
                    <gc-widget-icon appearance="custom" icon="action:help_outline" size="xs" />
                    <gc-widget-tooltip text={ infoText } anchorId="elementWrapper"/>
                </div>
            );
            // JSXOFF
        } else {
            return null;
        }
    }

    render(element: JSX.Element | JSX.Element[], options?: RenderOptions): JSX.Element {
        if (options && (options.caption || options.infoText)) {
            // JSXON
            return (
                <div class="root-container" onClick={ (e: Event) => this.onClickHandler(e, e.target as HTMLElement) }>
                    { options?.caption ? <div key="header" class="header-container top">
                        { options?.caption ? <div class="caption" key="caption">{ options.caption }</div> : null }
                        { this.renderInfoText(options?.infoText) }
                    </div> : null }

                    { options?.tooltip ? (<div id="elementWrapper" key="element" tabIndex={ options?.tabIndex }>{ element }
                        <gc-widget-tooltip class="tooltip" text={ options?.tooltip } anchorId="elementWrapper"/>
                    </div>) :
                        <div id="elementWrapper" key="element" tabIndex={ options?.tabIndex }>{ element }</div>
                    }
                    { options?.infoText && !options?.caption ? <div class="header-container side" key="header">
                        { this.renderInfoText(options?.infoText) }
                    </div> : null }
                </div>
            );
            // JSXOFF
        } else {
            // JSXON
            return (
                <div id="elementWrapper" tabIndex={ options?.tabIndex }>{ element }
                    { (options && options?.tooltip) ? <gc-widget-tooltip class="tooltip" text={ options?.tooltip } anchorId="elementWrapper" /> : null }
                </div>
            );
            // JSXOFF
        }
    }

    private onClickHandler(event: Event, element: HTMLElement) {
        if (element) {
            const parent = element.parentElement;
            if (parent && parent.id === 'elementWrapper') {
                return;

            } else if (!element.classList.contains('root-container')) {
                this.onClickHandler(event, element.parentElement);

            } else {
                event.stopPropagation();
            }
        }
    }

    /**
     * Saves the setting to local storage.
     *
     * @param {string} name the setting name
     * @param {string} value the value
     */
    saveSetting(name: string, value: string) {
        const id = this.element.tagName.toLowerCase();
        const root = JSON.parse(GcLocalStorage.getItem(STORAGE_ROOT) || '{}');
        if (!root[id]) {
            root[id] = {};
        }
        root[id][name] = value;
        GcLocalStorage.setItem(STORAGE_ROOT, JSON.stringify(root));
    }

    /**
     * Loads the setting from local storage.
     *
     * @param {string} name the setting name
     * @return {object} the setting JSON object
     */
    loadSetting(name: string): object {
        const id = this.element.tagName.toLowerCase();
        const root = JSON.parse(GcLocalStorage.getItem(STORAGE_ROOT) || '{}');
        const element = root[id] || {};
        return element[name];
    }
}