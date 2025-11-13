```
<gc-codec-usb2any-gpio id="gpio">
    <gc-gpio-pin id="pin1" pin="1" mode="output" state="high"></gc-gpio-pin>
    <gc-gpio-pin id="inputPin" pin="6" mode="input"></gc-gpio-pin>
</gc-codec-usb2any-gpio>

<gc-codec-usb2any id="usb2any"></gc-codec-usb2any>
<gc-codec-usb2any-power id="power"></gc-codec-usb2any-power>
<gc-transport-usb id="usb" hid></gc-transport-usb>
<gc-target-connection-manager auto-connect active-configuration="usb+usb2any(power,gpio)"></gc-target-connection-manager>
```