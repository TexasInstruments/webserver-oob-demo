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
import { Component, Prop, Element, Watch, Method } from '@stencil/core';
import { GcCodecBaseProps } from '../gc-target-configuration/gc-codec-base-props';
import { SysConfigModel, ISysConfigModelParams } from './lib/SysConfigModel';
import { createTargetParamsProxy } from '../gc-target-device-programmable/TargetDeviceParamsProxy';
import { GcUtils } from '../gc-core-assets/lib/GcUtils';

/**
 * `gc-model-sysconfig` is a non visual component for binding to configurables in a SysConfig script.
 *
 * @usage
 * @label SysConfig Model
 * @group Transports, Models, and Codecs
 * @archetype <gc-model-sysconfig id="sysconfig"></gc-model-sysconfig>
 */
@Component({
    tag: 'gc-model-sysconfig',
    shadow: true
})

export class GcModelSysconfig implements GcCodecBaseProps, ISysConfigModelParams {
    private impl: SysConfigModel | undefined = undefined;

    /**
     * Relative path to the SDK metadata product.json file required by SysConfig.  This file must be bundled, which means there is a
     * product.json.bundle file located next the product.json file constaining all the rest of the metadata from the SDK.  For infomation on
     * how to create a bundle ... TBD.
     *
     * @order 5
     */
    @Prop() metadataPath: string;

    /**
     * Relative path to the config script to load into the model.
     * @order 7
     */
    @Prop() scriptPath: string;

    /**
     * The path within the metadata for the board metadata to use with the script, if needed.  Typically this starts with "/ti/boards/..."
     * If a board is provided, then the deviceId property is
     * not needed.  If there is no board provided, then a deviceId property is expected to indicate the device that the script applies to.
     * This is used to read device metadata, which also must be provided in a "deviceData" directory at the root of the GC app.
     * @order 9
     */
    @Prop() boardPath: string;

    /**
     * The name of device package, if needed.  If you specified a boardPath, then this property is not required.
     * If there is no package specified, then sysconfig will use device data for the default package.
     * @order 10
     */
    @Prop() package: string;

    /**
     * The name of the device part, if needed.  If you specified a boardPath, then this property is not required.
     * If there is no part specified, then sysconfig will use device data for the default part.
     * @order 11
     */
    @Prop() partName: string;

    /**
     * Method to reload the script provided by the scriptPath property.  Change the scripPath will not force a reload because
     * the metadata, boardPath, or deviceID may need to be adjusted to match the new script.  This method is provided to as a
     * manual way of reloading the script when all property changes required have been made.
     */
    @Method()
    reloadScript() {
        return this.impl.loadConfigScript();
    }

    /**
     * Method to retieve the current configuration script text from this model.  Use this to retrieve the modified script after
     * changing configurables through bindings.
     */
    @Method()
    getConfigScript() {
        return this.impl.getConfigScript();
    }

    /**
     * Method to retieve the generated file from a particular template.
     *
     * @param templateName the name of the template
     */
    @Method()
    getGeneratedFile(templateName: string) {
        return this.impl.getGeneratedFile(templateName);
    }

    componentWillLoad() {
        if (GcUtils.isInDesigner) {
            this.el['getAdditionalProperties'] = (filter: string) => this.impl.lookupSuggestedBindings(filter);
        }
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

    connectedCallback() {
        this.impl = new SysConfigModel(createTargetParamsProxy(this.el));
    }

    disconnectedCallback() {
        this.impl.dispose();
    }
}