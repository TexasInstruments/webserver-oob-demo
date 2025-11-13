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
import { h, Component, Prop, State, Event, EventEmitter, Element, Method } from '@stencil/core';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { WidgetStatusbar } from './gc-widget-statusbar';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { connectionManager } from '../gc-target-connection-manager/lib/ConnectionManager';
import { WidgetBaseTooltipProps } from '../gc-widget-base/gc-widget-base-tooltip-props';
import { codecRegistry, connectionLogEventType, connectedStateChangedEventType, ITransport } from '../gc-target-configuration/lib/TargetConfiguration';

/**
 * `gc-widget-statusitem-connections` is a statusbar item that manage one or more connections to the target.
 *
 * @group Status Indicators
 * @label Status Bar Connections Item
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-statusitem-connections',
    styleUrl: 'gc-widget-statusitem-connections.scss',
    shadow: true
})
export class WidgetStatusItemConnections implements WidgetBaseProps {
    private transportsPopup: HTMLElement;

    private base = new (
        class extends WidgetBase {
            get element() {
                return (this.parent as WidgetStatusItemConnections).el;
            }
        })(this);

    @State() hideTransportsMenu = true;

    private formatTextForTooltip(text?: string) {
        return text?.trim().split('\n').join('<br>');
    }

    renderTransport(transport: ITransport) {
        const optional = codecRegistry.isOptional(transport.id) ? ' (optional)' : '';
        const partially = transport.isPartiallyConnected ? 'partially ' : '';
        let progressMessage = transport.hasErrors || transport.hasWarnings || transport.state === 'connecting' ? transport.progressMessage : '';
        const tooltipMessage = progressMessage ? this.formatTextForTooltip(transport.tooltipMessage) : undefined;
        if (transport.canDisconnect) {
            progressMessage = `${transport.connectionDescription} ${progressMessage}`.trim();
        }
        const status = `${transport.id} - ${partially}${transport.state} (${progressMessage})${optional}`.split(' ()').join('');

        // JSXON
        return <li class={transport.state}>
            <div class={`connectionIndicator ${transport.hasErrors ? 'error' : transport.state}`}></div>
            <gc-widget-icon id={transport.id} icon={this.getConnectionIcon(transport)} onMouseDown={this.toggleTransportHandler}/>
            <gc-widget-tooltip text={this.getConnectionTooltip(transport)} anchorId={transport.id} position="top"/>
            <span id="transportStatusText" class="nowrap">{status}</span>
            { tooltipMessage ? <gc-widget-tooltip text={tooltipMessage} anchorId="transportStatusText" position="top"/> : null }
        </li>;
        // JSXOFF
    }

    private toggleTransportsMenu = () => {
        this.hideTransportsMenu = !this.hideTransportsMenu;
    };

    private closeTransportsMenu = () => {
        this.hideTransportsMenu = true;
    };

    render() {
        const activeTransports = connectionManager.getActiveTransports();
        let left = 34;
        let bottom = 30;
        if (this.transportsPopup) {
            const rect = this.transportsPopup.getBoundingClientRect();
            left = rect.left;
            bottom = window.innerHeight - rect.top + 5;
        }
        const tooltipMessage = this.formatTextForTooltip(connectionManager.tooltipMessage);

        return this.base.render(
            // JSXON
            [
                <gc-widget-icon id="connectionIcon" icon={ this.getConnectionIcon(connectionManager) } appearance="custom" onClick={this.toggleConnectionManagerHandler}/>,
                <gc-widget-tooltip text={this.getConnectionTooltip(connectionManager)} anchorId="connectionIcon" position="top"/>,
                <ul id="transportsMenu" hidden={this.hideTransportsMenu} style={{ bottom: `${bottom}px`, left: `${left}px` }}>
                    { activeTransports.map( transport => this.renderTransport(transport)) }
                </ul>,
                <gc-widget-icon id="transportsPopup" icon="navigation:arrow_drop_up" appearance="custom"
                    onClick={this.toggleTransportsMenu} onBlur={this.closeTransportsMenu} tabIndex={-1}
                    ref={(el: HTMLElement) => this.transportsPopup = el}/>,
                <gc-widget-label id="connectionStatusText" class="nowrap" label={connectionManager.progressMessage}/>,
                tooltipMessage ? <gc-widget-tooltip text={tooltipMessage} anchorId="connectionStatusText" position="top"/> : null
            ],
            // JSXOFF
            {}
        );
    }

    private doRefresh = () => {
        this.refresh();
    };

    connectedCallback() {
        connectionManager.addEventListener(connectedStateChangedEventType, this.doRefresh);
        connectionManager.addEventListener(connectionLogEventType, this.doRefresh);
    }

    disconnectedCallback() {
        connectionManager.removeEventListener(connectedStateChangedEventType, this.doRefresh);
        connectionManager.removeEventListener(connectionLogEventType, this.doRefresh);
    }

    private getConnectionIcon(transport: ITransport) {
        if (transport.isConnected) {
            return 'ti:connected';
        } else if (transport.canDisconnect) {
            return 'ti:connection_pending';
        } else {
            return 'ti:no_connection';
        }
    }

    private getConnectionTooltip(transport: ITransport) {
        if (transport.isConnected) {
            return 'Click to disconnect';
        } else if (transport.canDisconnect) {
            return 'Connecting ...';
        } else {
            return 'Click to connect to hardware';
        }
    }

    private get statusBar() {
        let parent = this.el;
        if (parent) {
            do {
                if (parent.tagName.toLowerCase() === 'gc-widget-statusbar')
                    return parent as unknown as WidgetStatusbar;
                parent = parent.parentElement;
            } while (parent);
        }

        return undefined;
    }

    private doToggleConnection(transport?: ITransport) {
        if (!GcUtils.isInDesigner) {
            if (transport?.canConnect) {
                // avoid uncaught exception messages in console.
                transport.connect().catch( () => {});
            } else if (transport?.canDisconnect) {
                transport.disconnect();
            }
        }
    }

    private toggleConnectionManagerHandler = () => {
        this.doToggleConnection(connectionManager);
    };

    private toggleTransportHandler = (e: MouseEvent) => {
        const id = (e.currentTarget as HTMLElement).id;
        this.doToggleConnection(connectionManager.getActiveTransports().find( transport => transport.id === id));

        e.preventDefault();
        e.stopPropagation();
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
