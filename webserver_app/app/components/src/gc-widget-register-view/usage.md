**_HTML_**
```
<gc-widget-register-view id="register_map" hide-device-name></gc-widget-register-view>

<gc-target-connection-manager auto-connect active-configuration="usb+usb2any(power,i2c+reg)">
    <gc-transport-usb id="usb" hid></gc-transport-usb>
    <gc-codec-usb2any id="usb2any"></gc-codec-usb2any>
    <gc-codec-usb2any-power id="power" v33></gc-codec-usb2any-power>
    <gc-codec-usb2any-i2c id="i2c" address-bits="7" speed="400" pullup device-address="0x48"></gc-codec-usb2any-i2c>
    <gc-model-register id="reg" register-info="systeminfo/TMP117Registers.json"></gc-model-register>
</gc-target-connection-manager>
```
