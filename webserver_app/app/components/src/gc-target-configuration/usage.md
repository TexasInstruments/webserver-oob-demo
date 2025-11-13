```
<gc-target-configuration id="jtag_Config">
    xds+pm
</gc-target-configuration>
<gc-target-configuration id="sensor_config">
    usb+u2b2any[i2c+reg, power]
</gc-target-configuration>

<gc-target-connection-mananger auto-connect active-configuration="sensor_config">
</gc-target-connection-mananger>
```