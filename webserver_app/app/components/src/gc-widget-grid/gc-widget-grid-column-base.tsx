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
 */
import { JSX, h } from '@stencil/core';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { IRowOperations } from './IColumnCellRenderer';
import { WidgetGridColumnBaseProps } from './gc-widget-grid-column-base-props';

/**
 * `WidgetGridColumnBase` provides the base implementation for Grid column widgets.
 */
export abstract class WidgetGridColumnBase extends WidgetBase {
    constructor(protected readonly parent: WidgetGridColumnBaseProps) {
        super(parent);
    }
    parentGrid?: IRowOperations;

    protected onCSSPropertyChanged(name: string, value: string) {
        if (name === '--gc-column-width') {
            this.parentGrid?.redraw();
        }
    }

    private onMinimizeHandler = () => {
        this.parent.minimized = !this.parent.minimized;
    };

    private onFocusHandler = () => {
        this.parentGrid?.setFocus();
    };

    private onKeyHandler = (e: KeyboardEvent) => {
        switch (e.key) {
            case ' ':
            case 'Enter':
                this.onMinimizeHandler();
                break;
        }
        e.stopPropagation();
    };

    // TODO add 2nd slot for two row header.
    renderHeader(): JSX.Element {
        const isMinimized = this.parent.minimized;
        const hide = this.parent.hidden || isMinimized;
        // JSXON
        return <div class="header-container" style={{ display: 'flex' }} tabIndex={-1} onFocus={this.onFocusHandler}>
            <label key="title" class="stretch" hidden={hide} innerHTML={this.parent.heading?.split('\\n').join('<br>') || this.parent.name}></label>
            <span hidden={hide}>
                <slot></slot>
            </span>
            {this.parent.hideMinimizeAction ? null : <gc-widget-icon id="minIcon" icon={`content:${isMinimized ? 'add' : 'remove'}`} size="s"
                onClick={this.onMinimizeHandler} hidden={this.parent.hidden} class="action" tabIndex={0} onKeyDown={this.onKeyHandler}
                appearance="custom" tooltip={`${isMinimized ? 'show' : 'hide'}`}/>}
        </div>;
        // JSXOFF
    }
}