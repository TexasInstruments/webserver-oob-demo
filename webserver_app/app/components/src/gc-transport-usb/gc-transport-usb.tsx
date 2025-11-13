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
import { Component, Prop, Element } from '@stencil/core';
import { GcCodecBaseProps } from '../gc-target-configuration/gc-codec-base-props';
import { UsbTransport } from '../gc-transport-usb/lib/UsbTransport';
import { BaudRate } from '../gc-service-usb/lib/ServiceUsb';
import { GcTargetDeviceNameProps } from '../gc-target-device-programmable/gc-target-device-name-props';
import { createTargetParamsProxy } from '../gc-target-device-programmable/TargetDeviceParamsProxy';
import { ServicesRegistry } from '../gc-core-services/lib/ServicesRegistry';
import { targetConfigServiceType } from '../gc-service-target-config/lib/TargetConfigService';
import { createPropertyAutoFill, IPropertyAutoFill } from '../gc-core-assets/lib/GcDesigner';

const targetConfigService = ServicesRegistry.getService(targetConfigServiceType);

/**
 * `gc-transport-usb` is a non visual component for sending and receiving data over a USB port.
 * This transport supports both USB-HID and USB serial port operation.  This transport is generally
 * used with a codec for encoding/decoding data sent and received over the port.
 *
 * @usage
 * @label USB Transport
 * @group Transports, Models, and Codecs
 * @archetype <gc-transport-usb id="usb"></gc-transport-usb>
 */
@Component({
    tag: 'gc-transport-usb',
    shadow: true
})

export class GcTransportUsb implements GcCodecBaseProps, GcTargetDeviceNameProps {
    private impl: UsbTransport | undefined = undefined;
    private propertyAutoFill: IPropertyAutoFill = undefined;

    connectedCallback() {
        this.impl = new UsbTransport(createTargetParamsProxy(this.el));

        this.propertyAutoFill = createPropertyAutoFill(this.el);
        this.propertyAutoFill.register('deviceName', async () => (await targetConfigService.getDevices()).map(device => device.id));
    }

    disconnectedCallback() {
        this.propertyAutoFill.unregister('deviceName');
        this.impl.dispose();
    }

    /**
     * Indicates regular USB serial port support mode only.  Add this attribute for to use regular usb ports only and not usb-hid ports.
     *
     * @order 55
     */
    @Prop() usb: boolean = false;

    /**
     * Indicates regular USB-HID support mode only.  Add this attribute to use usb-hid ports only and not regular usb serial ports.
     *
     * @order 56
     */
    @Prop() hid: boolean = false;

    /**
     * Specifies the default baud rate to suggest to the user regular USB support mode only.  Add this attribute to use regular usb ports only and not usb-hid ports.

     * @order 57
     */
    @Prop() defaultBaudRate: BaudRate = 9600;

    /**
     * Indicated that program model will be used to communicate with the target using a monitor compiled into the target program.
     * Set this flag true if you are using the program model over a serial port instead of JTag emulation.
     *
     * @order 67
     */
    @Prop() pm: boolean;

    /**
     * Specifies the vendor ID used for filtering available serial ports to pick from.
     *
     * @order 70
     */
    @Prop() vendorId: number;

    /**
     * Specifies the product ID used for filtering available serial ports to pick from.
     *
     * @order 71
     */
    @Prop() productId: number;

    /**
     * Specifies the usb interface number to filter available serial ports to pick from.
     * Usb devices can enumerate a number of CDC (com ports), HID, or Bulk interfaces.  Filtering on the particular
     * interface number helps distinguish different ports provided by the same physical device.
     *
     * @order 72
     */
    @Prop() interfaceNumber: number;

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

}
