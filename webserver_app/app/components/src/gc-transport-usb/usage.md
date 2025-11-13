```
<gc-transport-usb id="usb" usb default-baud-rate="9600"></gc-transport-usb>

<gc-codec-json id="json"></gc-codec-json>
<gc-codec-delimited-text id="cr"></gc-codec-delimited-text>
<gc-model-streaming id="streaming"></gc-model-streaming>
<gc-target-connection-manager auto-connect active-configuration="usb+cr+json+streaming"></gc-target-connection-manager>
```