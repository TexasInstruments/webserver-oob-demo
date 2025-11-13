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
import { Component, h, Prop, Method, Event, EventEmitter, Element, State } from '@stencil/core';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { WidgetDialog } from '../gc-widget-dialog/gc-widget-dialog';
import { CloseReason } from '../gc-widget-base/gc-widget-base-dialog-props';
import { WidgetButton } from '../gc-widget-button/gc-widget-button';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';

/**
  * `gc-widget-message-dialog` is a dialog that can be used to inform users about a task and can contain critical information,
  * require decision, or involve multiple tasks. Additionally, it can have a progress bar to show long running task.
  *
  * @label Message Dialog
  * @group Dialogs
  * @demo
  * @usage
  */
@Component({
    tag: 'gc-widget-message-dialog',
    styleUrl: 'gc-widget-message-dialog.scss',
    shadow: true
})
export class WidgetMessageDialog implements WidgetBaseProps {
    private dialog: WidgetDialog;
    private opened = false;

    private base = new (
        class extends WidgetBase {
            get element(): HTMLElement {
                return (this.parent as WidgetMessageDialog).el;
            }
        }
    )(this);

    render() {
        const customButtons = GcUtils.parseArrayProperty(this.customButtons);
        return this.base.render(
            // JSXON
            <gc-widget-dialog class='height-fit-content' modal closeOnEsc={ this.hasCancel } heading={ this.heading } icon={ this.icon } ref={ (el: HTMLElement) => this.dialog = el as unknown as WidgetDialog }>

                <div id='content-container'>
                    <div id='content-message' innerHTML={ this.message } />
                    <div style={ { flex: '1' } }></div>
                    { this.hasProgress ? <gc-widget-progressbar minValue={ this.minValue } maxValue={ this.maxValue } value={ this.progressValue } message={ this.progressMessage } /> : null }
                </div>

                { this.hasCancel ? <gc-widget-button slot='action-bar' class='message-cancel' label='CANCEL' disabled={ this.disableCancelButton } onClick={ this.onCancelHdlr }/>: null }
                { customButtons ? customButtons.map( text => <gc-widget-button class={`message-${text.toLowerCase()}`} slot='action-bar' label={text.toUpperCase()} disabled={this.disableCustomButtons} onClick={ this.onCustomButtonHdlr }/>) : null }
                { this.hasOk ?
                    <gc-widget-button slot='action-bar' class='message-ok' label='OK'
                        onClick={ this.onOKHdlr }
                        disabled={ this.hasProgress ? (this.progressValue ? (this.progressValue < this.maxValue) : true) : false } />
                    : null }
            </gc-widget-dialog>
            // JSXOFF
        );
    }

    /**
     * The string to display in the header.
     * @order 2
     */
    @Prop() heading: string;

    /**
     * The icon in the header.
     * @order 3
     */
    @Prop() icon: string;

    /**
     * A HTML string for message to show in the dialog.
     * @order 4
     */
    @Prop() message: string;

    /**
     * Add a button to give the ability to dismiss changes.
     * @order 5
     */
    @Prop() hasCancel: boolean;

    /**
     * `true` if the cancel button should be disabled.
     * @order 5
     */
    @Prop() disableCancelButton: boolean;

    /**
     * Add a button to give the ability to commit changes.
     * @order 6
     */
    @Prop() hasOk: boolean;

    /**
     * `true` if the OK button should be disabled.
     * @order 7
     */
    @Prop() disableOKButton: boolean;

    /**
     * option to have additional buttons position between the standard cancel and ok buttons.  If provided, this should be a
     * delimited string using comma, semi-colon, or the pipe character, of text to display in each custom button.
     * @order 8
     */
    @Prop() customButtons: string;

    /**
     * `true` if the custom button(s) should be disabled.
     * @order 9
     */
    @Prop() disableCustomButtons: boolean;

    /**
     * Set type to show a progressbar in the dialog.
     * @order 10
     */
    @Prop() hasProgress: boolean;

    /**
     * The min value for the progress bar.
     *
     * @order 11
     */
    @Prop() minValue: number;

    /**
     * The max value for the progress bar.
     *
     * @order 12
     */
    @Prop() maxValue: number;


    @State() progressValue: number;
    @State() progressMessage: string;

    /**
     * Open the dialog.
     */
    @Method()
    async open() {
        if (!this.opened) {
            if (this.dialog) {
                await this.dialog.open();
                this.opened = true;
            }
        }
    }

    /**
     * Close the dialog with `confirm` reason.
     *
     * @param reason reason to close the dialog
     */
    @Method()
    async close(reason: CloseReason) {
        if (this.opened) {
            await this.dialog.close(reason);
        }
        this.opened = false;
    }

    /**
     * For progressbar type, sets value of the progressbar.
     * @param value new number value
     */
    @Method()
    async setProgressValue(value: number) {
        if (this.opened) {
            this.progressValue = value;
        }
    }

    /**
     * Set or update the progress message.
     *
     * @param message progress message string
     */
    @Method()
    async setProgressMessage(message: string) {
        if (this.opened) {
            this.progressMessage = message;
        }
    }

    private onCancelHdlr = () => {
        this.close('dismiss');
    };

    private onOKHdlr = () => {
        this.close('confirm');
    };

    private onCustomButtonHdlr = (e: MouseEvent) => {
        this.close((e.currentTarget as unknown as WidgetButton).label.toLowerCase());
    };

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
