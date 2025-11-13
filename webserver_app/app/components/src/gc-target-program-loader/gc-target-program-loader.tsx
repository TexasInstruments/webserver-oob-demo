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
import { Prop, Component, Element, Method } from '@stencil/core';
import { GcCodecBaseProps } from '../gc-target-configuration/gc-codec-base-props';
import { TargetProgramLoader } from '../gc-target-program-loader/lib/TargetProgramLoader';
import { GcTargetDeviceConnectionProps } from '../gc-target-device-programmable/gc-target-device-connection-props';
import { GcTargetDeviceProgramLoaderProps } from '../gc-target-device-programmable/gc-target-device-program-loader-props';
import { GcTargetDeviceNameProps } from './../gc-target-device-programmable/gc-target-device-name-props';
import { IConnectionLog } from '../gc-target-configuration/lib/TargetConfiguration';
import { createTargetParamsProxy } from '../gc-target-device-programmable/TargetDeviceParamsProxy';
import { ServicesRegistry } from '../gc-core-services/lib/ServicesRegistry';
import { targetConfigServiceType } from '../gc-service-target-config/lib/TargetConfigService';
import { createPropertyAutoFill, IPropertyAutoFill } from '../gc-core-assets/lib/GcDesigner';
import { ActionRegistry } from '../gc-widget-menu/lib/ActionRegistry';
import { GcMessageDialog } from '../gc-widget-message-dialog/lib/GcMessageDialog';
import { connectionManager } from '../gc-target-connection-manager/lib/ConnectionManager';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';
import { WidgetMenuAction } from '../gc-widget-menu/gc-widget-menuaction';

const targetConfigService = ServicesRegistry.getService(targetConfigServiceType);

/**
 * `gc-target-program-loader` is a non visual component for loading a program or
 * binary image onto a target device.  This component can automatically load
 * the program on connection to the target, or it can wait for specific user action.
 * To this end, the connection manager registers an action named "cmd_open_program_loader_dialog" to
 * load the program of the first gc-target-program-loader.  In addition, Each `gc-target-program-loader` also registers
 * an action, using its id, named "open_program_loader_dialog_<id>" to load this particular program.
 * To make use of this, add a new gc-widget-menuaction to the menu bar to trigger this action.
 *
 * @usage
 * @label Program Loader
 * @group Transports, Models, and Codecs
 * @archetype <gc-target-program-loader auto-program></gc-target-program-loader>
 */
@Component({
    tag: 'gc-target-program-loader',
    shadow: true
})

export class GcTargetProgramLoader implements GcCodecBaseProps, GcTargetDeviceConnectionProps, GcTargetDeviceProgramLoaderProps {
    private impl: TargetProgramLoader | undefined = undefined;
    private propertyAutoFill: IPropertyAutoFill = undefined;

    /**
     * A flag indicating if the program loader should automatically load the program on first connection
     * to the target.  If The program is not loaded automatically, the user must manually load the
     * program from the program loader dialog when required.  Use the sram property to force the program
     * to be loaded on every connection, if necessary, instead of just the first time.
     *
     * @order 35
     */
    @Prop() autoProgram: boolean = false;

    /**
     * Method to load the target program specified byt his program loader.  This method will use message dialogs to confirm
     * the action and provide visual progress information.
     */
    @Method()
    async loadProgram() {
        const programName = this.programOrBinPath;
        if (!programName) {
            return await GcMessageDialog.error(`gc-target-program-loader id=${this.el.id} is missing a program or binary path property`);
        }

        const menuAction = document.querySelector('gc-widget-menuaction[action-id="cmd_open_program_loader_dialog"]') as unknown as WidgetMenuAction;
        const dialogTitle = menuAction?.label.split('...')[0].trim() ?? 'Load Program';
        const actionVerb = dialogTitle.split(' ')[0];

        const lastSlash = programName?.lastIndexOf('/') ?? -1;
        const message = `${actionVerb}ing ${programName.substring(lastSlash + 1)} for ${this.impl.toString()}`;
        if (await GcMessageDialog.prompt(dialogTitle, `${message}?`, 'image:flash_on') === 'confirm') {
            const { progress, result } = await GcMessageDialog.progress(dialogTitle, message, 'image:flash_on', true, 0, 100, true);

            let cancelled = false;
            const logger = new (class LoadProgramLogger implements IConnectionLog {
                assertStillConnecting(): void {
                    if (cancelled) {
                        throw Error('Operation aborted by user');
                    }
                }
                addProgressMessage(message: string): void {
                    connectionManager.addProgressMessage(message);
                }
                addErrorMessage(message: string): void {
                    connectionManager.addProgressMessage(message);
                }
                addWarningMessage(message: string): void {
                    connectionManager.addProgressMessage(message);
                }
                addDebugMessage(message: string): void {
                    connectionManager.addProgressMessage(message);
                    progress.setMessage(message);
                }
            })();

            result.then( reason => {
                cancelled = (reason === 'dismiss');
            });

            try {
                await connectionManager.loadProgram(this.impl, logger, progress.setValue);
                progress.setValue(100);
            } catch (e) {
                progress.cancel();
                if (!cancelled) {
                    GcMessageDialog.error(`${dialogTitle} Failed: ${e.message || e.toString()}`);
                }
            }
        }
    }

    connectedCallback() {
        const params = createTargetParamsProxy(this.el);
        this.impl = new TargetProgramLoader(params);

        if (this.el.id) {
            ActionRegistry.registerAction(`open_program_loader_dialog_${this.el.id}`, {
                run: () => {
                    this.loadProgram();
                },
                isEnabled(): boolean {
                    return !GcUtils.isInDesigner;
                }
            });
        }

        this.propertyAutoFill = createPropertyAutoFill(this.el);
        this.propertyAutoFill
            .register('deviceName', async () => (await targetConfigService.getDevices()).map(device => device.id))
            .register('connectionName', async () => (await targetConfigService.getConnections(params['deviceName'])).map(connection => connection.id));
    }

    disconnectedCallback() {
        this.propertyAutoFill.unregister('deviceName').unregister('connectionName');
    }

    // #region gc-target-configuration/gc-codec-base-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * A flag indicating that this model, transport, codec, or device is not necessary for connecting
     * to the target.  Any failure should not prevent the connection from continuing, which may
     * result in a partial connection.
     *
     * @order 77
     */
    @Prop() optional: boolean = false;

    /**
     * An optional identifier of a target device that is associated with this model, transport or codec.
     * Specifying a target device indicates that this component is necessary and/or optional for
     * properly connecting to the target device.  If a required component fails to connect, other components
     * will not be connected that are associated with the same device by id.  This way you can associate
     * a gc-target-program-loader with a gc-transport-usb so that if the program fails to load the transport
     * will not attempt to connect and will fail, unless the gc-target-program-loader has the optional property
     * set.  The absence of a target device indicates this is necessary and/or optional
     * for connecting to any device.  As a result, specifying the deviceId is not necessary if you only have
     * one device in you target configuration, any failure to connect will result in the entire connection
     * being aborted.
     *
     * @order 80
     */
    @Prop() deviceId: string;

    @Element() el: HTMLElement;
    // #endregion
    // #region gc-target-device-programmable/gc-target-device-connection-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The name of the connection to use to connect to the target for the purposes of loading a program or symbols.
     *
     * @order 45
     */
    @Prop() connectionName: string;

    /**
     * The path to a .ccxml file that describes the target configuration to be used to load programs or
     * symbols with.  If this property is omitted, a default .ccxml file will be generated using the deviceName,
     * and connectionName properties provided.
     *
     * @order 46
     */
    @Prop() ccxmlPath: string;
    // #endregion
    // #region gc-target-device-programmable/gc-target-device-name-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The name of the target device.  This should be the part number or name of the device for the
     * purposes of loading program or symbols, or creating a default .ccxml file.
     *
     * @order 44
     */
    @Prop() deviceName: string;
    // #endregion
    // #region gc-target-device-programmable/gc-target-device-program-loader-props.tsx:
    // -----------Autogenerated - do not edit--------------
    /**
     * The name of the core to use.  This is optional and if omitted, the first
     * programmable core in the target configuration will be used.
     *
     * @order 47
     */
    @Prop() coreName: string;

    /**
     * The file path to the target program or binary image to use for the purposes of reading
     * symbols, and loading or flashing the program to the target.
     *
     * @order 48
     */
    @Prop() programOrBinPath: string;

    /**
     * The file path to the target program for the purposes of verifying if the device has the same
     * program before loading a binary file.  This is optional and is only useful when programOrBinPath
     * points to a binary image.
     *
     * @order 49
     */
    @Prop() verifyProgramPath: string;

    /**
     * The address to load a binary image into.  This is optional and is only useful when programOrBinPath
     * points to a binary image.  The address can be provided in hexadecimal notation if preceded by '0x'.
     *
     * @order 50
     */
    @Prop() loadAddress: number;

    /**
     * Timeout in millisecond for flashing/loading image onto the device.  This is optional and if omitted
     * the default is 75 seconds.  If more time is required, then this property should be set to an appropriate
     * higher value.
     *
     * @order 51
     */
    @Prop() timeout: number;

    /**
     * A flag indicating that the target program is stored in volatile static ram instead of flash memory.
     * Use this flag to indicate that the program image will not necessarily be preserved when reconnecting to
     * the same target, so the program must be loaded each time.
     *
     * @order 63
     */
    @Prop() sram: boolean = false;
    // #endregion

}
