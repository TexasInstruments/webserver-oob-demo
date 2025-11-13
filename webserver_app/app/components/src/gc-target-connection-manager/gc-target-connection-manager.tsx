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
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS'
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
import { Prop, Component, Watch } from '@stencil/core';
import { connectionManager } from '../gc-target-connection-manager/lib/ConnectionManager';
import { GcPromise } from '../gc-core-assets/lib/GcPromise';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { ActionRegistry, IActionRunnable } from '../gc-widget-menu/lib/ActionRegistry';
import { GcTargetProgramLoader } from '../gc-target-program-loader/gc-target-program-loader';

async function doAutoConnect(activeConfiguration?: string) {
    try {
        const configs = document.querySelectorAll('gc-target-configuration');
        const promises: Promise<void>[] = [];
        for (let i = 0; i < configs.length; i++) {
            promises.push(connectionManager.whenConfigurationReady(configs[i].id || 'default'));
        }

        if (activeConfiguration) {
            promises.push(connectionManager.whenConfigurationReady(activeConfiguration));
        }
        await GcPromise.timeout(Promise.all(promises), 5000, '');

    // eslint-disable-next-line no-empty
    } catch (e) {
    }
    connectionManager.connect().catch( () => {});
    connectionManager.allowAutoConnectOnDeviceDetection = true;
}

/**
 * `gc-target-connection-manager` is a non visual component for managing the target connection state.
 * This component is used to connect and disconnect to a target based on an active configuration.
 *
 * @usage
 * @label Connection Manager
 * @group Transports, Models, and Codecs
 * @archetype <gc-target-connection-manager auto-connect></gc-target-connection-manager>
 */
@Component({
    tag: 'gc-target-connection-manager',
    shadow: true
})
export class GcTargetConnectionManager {

    /**
     * Indicates if the connection manager should automatically connect to the target on application startup, or
     * if it should wait for the app to call connect().
     *
     * @@order 45
     */
    @Prop() autoConnect: boolean = false;

    /**
     * The active configuration to use the next time the connection manager connects to the target.  This property
     * can be changed while the target is connected, but it will not have any effect until the next time a target
     * is connected.  This property should be set either to the id of `gc-target-configuration' tag you required,
     * or it can simply specify the configuration directly without refererncing any `gc-target-configuration` tags at all.
     *
     * @order 46
     */
    @Prop() activeConfiguration: string;

    @Watch('activeConfiguration')
    activeConfigurationChanged() {
        const id = this.activeConfiguration || 'default';
        GcPromise.timeout(connectionManager.whenConfigurationReady(id), 5000, '').finally(() => {
            connectionManager.setActiveConfiguration(id);
        });
    }

    componentDidLoad() {
        this.activeConfigurationChanged();

        ActionRegistry.registerAction('cmd_open_program_loader_dialog', new (class implements IActionRunnable {
            run() {
                const programLoader = document.querySelector('gc-target-program-loader') as unknown as GcTargetProgramLoader;
                if (programLoader) {
                    programLoader.loadProgram();
                }
            }

            isVisible(): boolean {
                const programLoader = document.querySelector('gc-target-program-loader') as unknown as GcTargetProgramLoader;
                return !!programLoader;
            }

            isEnabled(): boolean {
                return !GcUtils.isInDesigner;
            }
        })());

        if (this.autoConnect && !GcUtils.isInDesigner) {
            if (this.activeConfiguration) {
                doAutoConnect(this.activeConfiguration);
            }
        }
    }
}