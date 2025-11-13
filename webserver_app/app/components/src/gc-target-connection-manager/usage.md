Target communication code snippets below can be used as a source to copy and paste into your own applications gui file. We recommend switching to source mode by clicking <> toolbar button, copying an appropriate example and pasting it below
```<!-- Add target communication configuration below this line -->``` line that is present in .gui file. You can then switch editor to GUI Mode, by clicking on <> button in main toolbar again. You may then adjust properties of individual target communication elements (e.g. to adjust device name or program) through Outline view by selecting appropriate tag and editing its properties.

**_XDS/JTAG_**
```
<gc-target-connection-manager id="connection_manager" auto-connect active-configuration="xds+pm">
    <gc-transport-xds id="xds" device-name="MSP432P401R" connection-name="Texas Instruments XDS110 USB Debug Probe"></gc-transport-xds>
    <gc-model-program id="pm" program-or-bin-path="./firmware/Blink_msp432_xds.out"></gc-model-program>
</gc-target-connection-manager>
```

**_UART-MONITOR_**
```
<gc-target-connection-manager id="connection_manager" auto-connect active-configuration="usb+pm">
    <gc-target-program-loader id="loader" device-name="MSP432P401R" connection-name="Texas Instruments XDS110 USB Debug Probe" program-or-bin-path="./firmware/Blink_msp432_monitor.out" auto-program></gc-target-program-loader>
    <gc-transport-usb id="usb" device-name="MSP432P401R" usb pm></gc-transport-usb>
    <gc-model-program id="pm" program-or-bin-path="./firmware/Blink_msp432_monitor.out"></gc-model-program>
</gc-target-connection-manager>
<gc-widget-port-selection-dialog id="serial_port_element"></gc-widget-port-selection-dialog>
```

**_USB-UART-JSON_**
```
<gc-target-connection-manager id="connection_manager" auto-connect active-configuration="usb+cr+json+streaming">
    <gc-target-program-loader id="loader" auto-program device-name="Tiva TM4C123GH6PM" connection-name="Stellaris In-Circuit Debug Interface" program-or-bin-path="./firmware/blink_tiva_gc.out"></gc-target-program-loader>
    <gc-transport-usb id="usb" device-name="Tiva TM4C123GH6PM"></gc-transport-usb>
    <gc-codec-json id="json"></gc-codec-json>
    <gc-codec-delimited-text id="cr"></gc-codec-delimited-text>
    <gc-model-streaming id="streaming"></gc-model-streaming>
</gc-target-connection-manager>
<gc-widget-port-selection-dialog id="serial_port_element"></gc-widget-port-selection-dialog>
```

**_UART MessagePack_**
```
<gc-target-connection-manager id="connection_manager" auto-connect active-configuration="usb+msgpack+streaming">
    <gc-transport-usb id="usb" device-name="MSP430FR2355"></gc-transport-usb>
    <gc-codec-message-pack id="msgpack"></gc-codec-message-pack>
    <gc-model-streaming id="streaming"></gc-model-streaming>
    <gc-target-program-loader id="loader" auto-program device-name="MSP430FR2355" connection-name="TI MSP430 USB1" program-or-bin-path="./firmware/app_msgpack.out"></gc-target-program-loader>
</gc-target-connection-manager>
<gc-widget-port-selection-dialog id="serial_port_element"></gc-widget-port-selection-dialog>
```

**_AEVM I2C_**
```
<gc-target-connection-manager id="connection_manager" active-configuration="usb+aevm+i2c+reg">
    <gc-transport-usb id="usb" usb></gc-transport-usb>
    <gc-codec-aevm id="aevm" reset-controller-on-connect></gc-codec-aevm>
    <gc-codec-aevm-i2c id="i2c" unit="2" device-address="0x18" speed="400" read-opcode="16" write-opcode="8" pullup></gc-codec-aevm-i2c>
    <gc-model-register id="reg" register-info="registerdef/registers.json"></gc-model-register>
</gc-target-connection-manager>
<gc-widget-port-selection-dialog id="serial_port_element"></gc-widget-port-selection-dialog>
```
**_USB2ANY I2C_**
```
<gc-target-connection-manager auto-connect active-configuration="usb+usb2any(power,i2c+reg)">
    <gc-transport-usb id="usb" hid></gc-transport-usb>
    <gc-codec-usb2any id="usb2any"></gc-codec-usb2any>
    <gc-codec-usb2any-power id="power" v33></gc-codec-usb2any-power>
    <gc-codec-usb2any-i2c id="i2c" address-bits="7" speed="400" pullup device-address="0x48"></gc-codec-usb2any-i2c>
    <gc-model-register id="reg" register-info="registerdef/registers.json"></gc-model-register>
</gc-target-connection-manager>
<gc-widget-port-selection-dialog id="serial_port_element"></gc-widget-port-selection-dialog>
```
