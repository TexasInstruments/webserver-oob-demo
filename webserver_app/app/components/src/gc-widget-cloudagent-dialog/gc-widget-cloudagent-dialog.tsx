/**
 *  Copyright (c) 2021 Texas Instruments Incorporated
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
import { h, Component, Prop, Event, EventEmitter, Element, Method, State } from '@stencil/core';
import { WidgetBase } from '../gc-widget-base/gc-widget-base';
import { WidgetBaseProps } from '../gc-widget-base/gc-widget-base-props';
import { WidgetDialog } from '../gc-widget-dialog/gc-widget-dialog';
import { IBackplaneService, backplaneServiceType, errorEventType, IErrorEvent } from '../gc-service-backplane/lib/BackplaneService';
import { ServicesRegistry } from '../gc-core-services/lib/ServicesRegistry';

type Step = {
    handler: () => {};
    actionText: string;
    preActionText: string;
    postActionText: string;
    description: string;
};

/**
 * `gc-widget-cloudagent-dialog` is a dialog that provide steps to install the TI Cloudagent browser
 * extension and host OS binaries. It depends on the `BackplaneService` to fire a `ErrorEvent` event
 * and the dialog will automatically open.
 *
 * @label TI CloudAgent Dialog
 * @group Dialogs
 * @demo
 * @usage
 */
@Component({
    tag: 'gc-widget-cloudagent-dialog',
    styleUrl: 'gc-widget-cloudagent-dialog.scss',
    shadow: true
})
export class WidgetCloudAgentDialog implements WidgetBaseProps {
    private dialog: WidgetDialog;

    private base = new (
        class extends WidgetBase {
            get element() {
                return (this.parent as WidgetCloudAgentDialog).el;
            }
        })(this);

    constructor() {
        const backplane = ServicesRegistry.getService<IBackplaneService>(backplaneServiceType);
        backplane.addEventListener(errorEventType, (detail: IErrorEvent) => this.open(detail.errors));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @State() cloudAgentWizard: any;

    render() {
        const steps = this.getSteps();
        return this.base.render(
            <gc-widget-dialog
                ref={ (el: HTMLElement) => this.dialog = el as unknown as WidgetDialog }
                class='height-fit-content'
                heading={ this.cloudAgentWizard?.title }
                icon='action:assignment_late'
                modal
            >
                <div id='description-container'>
                    { this.cloudAgentWizard?.description }
                    {
                        this.cloudAgentWizard?.detailsLink ?
                            <gc-widget-button button-type='link'
                                label={ this.cloudAgentWizard?.detailsLink.text}
                                onClick={ () => window.open(this.cloudAgentWizard?.detailsLink.url, '_default') } />
                            : undefined
                    }
                </div>
                {
                    steps.length <= 0 ? undefined :
                        <div id='steps-container'>
                            {
                                steps.map((step: Step, index: number) =>
                                    <div class='step'>
                                        <span class='step-label'>{`Step ${index+1}: `}</span>
                                        { step.preActionText ? step.preActionText : undefined }
                                        <gc-widget-button button-type='link' label={ step.actionText } on-click={ () => step.handler() } />
                                        { step.postActionText ? step.postActionText : undefined}
                                    </div>
                                )
                            }
                        </div>
                }

                <div id='helplink-container'>
                    {
                        this.cloudAgentWizard?.helpLink ?
                            <gc-widget-button button-type='link'
                                label={ this.cloudAgentWizard?.helpLink.text }
                                onClick={ () => window.open(this.cloudAgentWizard?.helpLink.url, '_default') } />
                            : undefined
                    }
                </div>

                <gc-widget-button slot='action-bar' button-type='custom' label='CANCEL' onClick={ () => this.dialog.close() }></gc-widget-button>
                <gc-widget-button slot='action-bar' button-type='custom' label='RELOAD' onClick={ () => window.location.reload() }></gc-widget-button>
            </gc-widget-dialog>
        );
    }

    /**
     * Opens the dialog with the given errors.
     *
     * @param errors the CloudAgent errors
     * @param connectionId the connection ID can be use to pre download the required driver when the user click on the ```Download``` link
     * installation step.
     */
    @Method()
    async open(errors: Error[], connectionId?: string) {
        if (window.TICloudAgent?.Install?.getInstallWizard) {
            this.cloudAgentWizard = await window.TICloudAgent.Install.getInstallWizard({ errors: errors, connectionID: connectionId });
            this.dialog.open();
        }
    }

    private getSteps(): Step[] {
        const steps = [];
        if (this.cloudAgentWizard) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.cloudAgentWizard.steps.forEach((step: any) => {
                const actionTextList = step.action.text.split('$');
                if (actionTextList.length === 3 && step.action.handler) {
                    steps.push({
                        preActionText: actionTextList[0] !== '' ? actionTextList[0] : undefined,
                        actionText: actionTextList[1] !== '' ? actionTextList[1] : undefined,
                        postActionText: actionTextList[2] !== '' ? actionTextList[2] : undefined,
                        handler: step.action.handler,
                        description: step.description
                    });
                }
            });
        }
        return steps;
    }

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
