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
import { Component, h, Prop, Method, Event, EventEmitter, Element, Watch, State, JSX } from '@stencil/core';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { IOption } from '../gc-widget-base/gc-widget-base-selector';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { WidgetDialog } from '../gc-widget-dialog/gc-widget-dialog';
import { WidgetSelect } from '../gc-widget-select/gc-widget-select';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { ISelectedUsbPort, UsbTransport, IUsbPort, usbHidPortType } from '../gc-transport-usb/lib/UsbTransport';
import { BAUD_RATES, MAX_BAUD, UsbPortType } from '../gc-service-usb/lib/ServiceUsb';
import { ActionRegistry } from '../gc-widget-menu/lib/ActionRegistry';
import { GcConsole } from '../gc-core-assets/lib/GcConsole';

let selectionDialogExists = false;
const console = new GcConsole('gc-widget-port-selection-dialog');

/**
  * `gc-widget-port-selection-dialog` is a dialog that provides selectors for Serial Port and Baud Rate.
  *
  * @label Serial Port Selection Dialog
  * @group Dialogs
  * @container
  * @demo
  * @usage
  */

@Component({
    tag: 'gc-widget-port-selection-dialog',
    styleUrl: 'gc-widget-port-selection-dialog.scss',
    shadow: true
})
export class WidgetPortSelectionDialog implements WidgetBaseProps {
    private baudSelectEls: WidgetSelect[] = [];

    private base = new (
        class extends WidgetBase {
            get element(): HTMLElement {
                return (this.parent as WidgetPortSelectionDialog).el;
            }
        }
    )(this);

    renderUartContent(): JSX.Element[] {
        this.baudSelectEls = [];

        return this.uarts.map((uart: ISelectedUsbPort, index: number) => {
            const defaultRate = uart.transport?.params?.defaultBaudRate?.toString() ?? '9600';
            const baudLabels = BAUD_RATES.split('|');
            const selectedBaudIndex = baudLabels.findIndex((baudRate) => baudRate === uart.baudRate?.toString());
            const recommendedIndex = baudLabels.findIndex((baudRate) => baudRate === defaultRate);
            if (recommendedIndex > -1) baudLabels[recommendedIndex] = baudLabels[recommendedIndex] + ' (recommended)';
            const baudFilterText = ((selectedBaudIndex > -1) && (selectedBaudIndex === recommendedIndex))
                ? baudLabels[selectedBaudIndex]
                : uart.baudRate?.toString();

            // JSXON
            return <div class='uart-setting'>
                <p class='title'>ID:</p>
                <p class='title-name'><code>{uart.transport.id}</code></p>
                <p class='port'>Port:</p>
                <gc-widget-select
                    id={`port_select_${index}`}
                    class='port-select'
                    labels={uart ? uart.availablePorts?.map((usbPort: IUsbPort) => usbPort?.descriptor.displayName).join('|')+'|' ?? '' : ''}
                    selectedIndex={uart ? this.activePortIndex(uart) : 0}
                    onSelected-index-changed={this.selectPort}
                    disabled={!uart} />
                <p class='baud'>Baud Rate:</p>
                <gc-widget-select
                    id={`baud_select_${index}`}
                    ref={(el: HTMLElement) => this.baudSelectEls.push(el as unknown as WidgetSelect)}
                    class='baud-select'
                    type='filter'
                    placeholder='Input Baud Rate'
                    labels={baudLabels.toString()}
                    values={BAUD_RATES}
                    filterText={baudFilterText}
                    pattern='[0-9]*'
                    onFilter-text-committed={this.selectBaud}
                    disabled={this.isHidPort(this.changedUarts ?
                        this.changedUarts[index].port?.type : this.uarts[index].port?.type)}
                    autoOpen />
            </div>;
        // JSXOFF
        });
    }

    render() {
        const atLeastOne = this.uarts.reduce( (result: boolean, uart) => result || uart.availablePorts.length > 0, false);
        return this.base.render(
            // JSXON
            <gc-widget-dialog heading='Serial Port Configuration' modal
                icon='communication:import_export'
                ref={(el: HTMLElement) => this.dialog = el as unknown as WidgetDialog}>
                {(atLeastOne) ?
                    <div key='uarts'>{this.renderUartContent()}</div>
                    : <div id='busySplash' key='no-uarts'>
                        <p key='message'>Nothing found. Please reconnect and press <code>Refresh</code> to try again.</p>
                    </div>
                }
                <div>
                    <gc-widget-icon hidden={!this.busy} key='busyIcon' icon='action:autorenew' id='busyIcon' />
                </div>

                <gc-widget-button slot='action-bar' class='refresh' icon='navigation:refresh' label='REFRESH' onClick={this.acquireAllPorts} />
                <div slot='action-bar' class='spacer' />
                <gc-widget-button slot='action-bar' class='dialog-dismiss' label='CANCEL' />
                <gc-widget-button slot='action-bar' class='dialog-confirm' label='OK' onClick={this.applyUserPortSelections} disabled={!this.changedUarts} />
            </gc-widget-dialog>
            // JSXOFF
        );
    }

    componentDidRender() {
        this.baudSelectEls.forEach(item => item.setFilterFunction(options => options));
    }

    private dialog: WidgetDialog;
    @State() changedUarts: ISelectedUsbPort[];
    @State() uarts: ISelectedUsbPort[] = [];
    @State() busy = false;

    /**
      * Open the Serial Port Selection Dialog
      */
    @Method()
    async open(): Promise<void> {
        await this.acquireAllPorts();
        await this.dialog.open();
    }

    /**
      * Close the Serial Port Selection Dialog
      */
    @Method()
    async close(): Promise<void> {
        this.changedUarts = undefined;
        await this.dialog.close();
    }

    @Watch('hidden')
    hiddenChanged() {
        if (this.hidden) this.close();
    }

    componentWillLoad() {
        if (!selectionDialogExists) {
            // Register menu-action on the first port dialog loaded.
            ActionRegistry.registerAction('cmd_open_serial_port_dialog', Object.assign({}, {
                run: () => (document.querySelector('gc-widget-port-selection-dialog') as unknown as WidgetPortSelectionDialog).open(),
                isVisible: () => !!document.querySelector('gc-widget-port-selection-dialog')
            }));
            selectionDialogExists = true;
        } else {
            console.log('gc-widget-port-selection-dialog already has an instance in this document.');
        }
    }

    /**
      * Returns the index position in available ports that the currently active port is in.
      */
    private activePortIndex(selection: ISelectedUsbPort) {
        const active: IUsbPort = selection?.port;
        const found = selection.availablePorts.findIndex((port: IUsbPort) => port === active);
        return found ?? 0;
    }

    /**
      * Get all Ports (uarts) information from UsbTransport
      */
    private acquireAllPorts = async (): Promise<void> => {
        this.changedUarts = undefined;
        this.busy = true;
        this.uarts = await UsbTransport.acquireAllPorts(); // returns new array, triggers a refresh
        this.busy = false;
    };

    /**
      * applyUserPortSelections changes, autoConnect set to true.
      */
    private applyUserPortSelections = async () => {
        if (this.changedUarts) {
            console.debug((uarts: ISelectedUsbPort[]) =>
                `Apply uarts: ${uarts.map(uart => `${uart.transport.id} ${uart.port?.descriptor.displayName} ${uart.baudRate}`).join('. ')}`
            , this.changedUarts);
            UsbTransport.applyUserPortSelections(this.changedUarts, true);
        } else {
            console.debug('There is no changed uarts to apply');
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private isHidPort(type: UsbPortType<any>) {
        return type === usbHidPortType;
    }

    private selectPort = (e: CustomEvent) => {
        const uartIndex: number = parseInt((e.target as HTMLElement)?.id?.replace('port_select_', ''));
        if (uartIndex > -1) {
            if (!this.changedUarts) this.changedUarts = this.uarts;
            // testing shows e.detail.value can be -1
            this.changedUarts[uartIndex].port = this.changedUarts[uartIndex].availablePorts[e.detail.value];

            if (this.isHidPort(this.changedUarts[uartIndex].port?.type)) {
                (this.changedUarts[uartIndex].baudRate as number) = undefined;
            }
            console.debug((uart: ISelectedUsbPort) => `Select port ${uart.transport.id} ${uart.port?.descriptor.displayName}`,
                this.changedUarts[uartIndex]);
            this.refresh(); // deep change of this.changedUarts requires a refresh to show selection information accurately.
        }
    };

    private selectBaud = (e: CustomEvent) => {
        const select = (e.target as unknown as WidgetSelect);
        if (select && !select.disabled) {
            const input = select?.filterText;
            const uartIndex: number = parseInt((e.target as HTMLElement)?.id?.replace('baud_select_', ''));
            if (input) {
                const value = GcUtils.string2value(input.replace(' (recommended)', ''));
                if ((MAX_BAUD >= value) && (value >= 0)) {
                    if (!this.changedUarts) this.changedUarts = this.uarts;
                    (this.changedUarts[uartIndex].baudRate as number) = value;
                    console.debug((uart: ISelectedUsbPort) => `Select baud ${uart.transport.id} ${uart.baudRate}`, this.changedUarts[uartIndex]);
                }
            }
        }
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
