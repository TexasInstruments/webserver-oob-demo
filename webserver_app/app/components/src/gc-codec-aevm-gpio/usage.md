```
<gc-codec-aevm-gpio id="gpio">
    <gc-aevm-gpio-pin id="pin1" pin="1" mode="output" state="high"></gc-aevm-gpio-pin>
    <gc-aevm-gpio-pin id="inputPin" pin="6" mode="input"></gc-aevm-gpio-pin>
</gc-codec-aevm-gpio>

<gc-codec-aevm id="aevm"></gc-codec-aevm>
<gc-transport-usb id="usb" usb></gc-transport-usb>
<gc-target-connection-manager auto-connect active-configuration="usb+aevm+gpio"></gc-target-connection-manager>
```