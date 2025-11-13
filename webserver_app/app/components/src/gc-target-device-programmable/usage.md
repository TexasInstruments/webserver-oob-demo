```
<gc-target-device-programmable id="msp432" device-name="MSP432P401R" program-or-bin-path="./target/my.out">
<gc-target-device-programmable>

<gc-target-program-loader auto-program device-id="msp432"></gc-target-program-loader>
<gc-transport-usb id="usb" pm device-id="msp432"></gc-transport-usb>
<gc-model-program id="pm" device-id="msp432"></gc-model-program>
<gc-target-connection-manager auto-connect active-configuration="usb+pm"></gc-target-connection-manager>
```