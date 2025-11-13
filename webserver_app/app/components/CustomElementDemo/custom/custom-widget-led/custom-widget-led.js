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
import { GcWebComponentHelper, getModulePath } from '../../components/@ti/gc-core-webcomponent/lib/GcWebComponentHelper';
import { GcConsole } from '../../components/@ti/gc-core-assets/lib/GcConsole';

const console = new GcConsole('CustomWidgetLed');
const MODULE_PATH = getModulePath(import.meta);
const COMPONENT_NAME = 'custom-widget-led';

const template = `
<style>
    :host {
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    gc-widget-toggle-switch,
    gc-widget-led {
        margin: 5px;
    }
</style>

<gc-widget-led id="led" on="[[on]]"></gc-widget-led>
<gc-widget-toggle-switch id="switch" label="[[label]]" checked="{{on}}"></gc-widget-toggle-switch>
`;

/**
 * `CustomWidgetLed` is a custom WebComponent demo.
 */
class CustomWidgetLed extends HTMLElement {

    /* Property definition method #1: define property with static properties getter */
    static get properties() {
        return {
            on: {
                type: 'boolean',
                reflect: true,
                notify: true
            },
            label: {
                type: 'string'
            }
        };
    }

    constructor() {
        super();
        this.helper = new GcWebComponentHelper(this, COMPONENT_NAME, MODULE_PATH);

        /* use template with external files or inline */ {

            /* for easy of use and application only have few custom components */
            this.helper.templateHtmlFile = './custom-widget-led.html';
            this.helper.cssFile = './custom-widget-led.css';

            /* for best performance, use inlined template */
            // this.helper.template = template;

        }

        /* properties and bindings */ {

            /* Property definition method #2: Call defineProperty directly */
            // this.helper.defineProperty({ name: 'on', type: 'boolean', reflect: true, notify: true });
            // this.helper.defineProperty({ name: 'label', type: 'string' });

            /* bind the widget properties to the shadow element properties  {
                this.helper.bindProperty('label', 'switch', 'label');
                this.helper.bindProperty('on', 'switch', 'checked');
                this.helper.bindProperty('on', 'led', 'on');
            } */

        }

        /* event listeners and watchers */ {

            /* watch for property change */
            this.helper.watch('on', (newValue, oldValue) => {
                console.log(`'on' property changed ${newValue}`);
            });

            /* add event listener */
            this.addEventListener('click', () => {
                console.log(`on host clicked event`);
            });
        }

        /* initialize the WebComponent */
        this.helper.init();
    }
}
customElements.define(COMPONENT_NAME, CustomWidgetLed);