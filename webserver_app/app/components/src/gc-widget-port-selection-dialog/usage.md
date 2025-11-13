### Port Selection Dialog
**_HTML_**
```
    <gc-widget-port-selection-dialog id="demo_element" />
```


### Using a menuaction to open a Port Selection Dialog

Make sure the action-id is `open-serial`. It will register to the serial port selection dialog used in the designer.
**_HTML_**
```
<body>
    <gc-target-connection-manager id="gc_target_connection_manager" auto-connect active-configuration="usb+cr">
        <gc-transport-usb id="usb" device-name="CC2640R2"></gc-transport-usb>
        <gc-codec-delimited-text id="cr"></gc-codec-delimited-text>
    </gc-target-connection-manager>


    <gc-widget-menubar id="menubar" open-on-hover layout horizontal>
        <gc-widget-menuitem label="Options" layout vertical>
            <gc-widget-menuaction id="ma_serial_port" label="Serial Port Settings ..." action-id="cmd_open_serial_port_dialog" icon="action:settings_input_component"></gc-widget-menuaction>
        </gc-widget-menuitem>
    </gc-widget-menubar>
</body>
```
