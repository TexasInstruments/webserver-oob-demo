```
<gc-model-program id="pm" program-or-bin-path="./target/my.out"></gc-model-program>

<gc-transport-xds id="jtag" device-name="MSP432P401R" connection-name="Texas Instruments XDS110 USB Debug Probe"></gc-transport-xds>
<gc-target-connection-manager auto-connect active-configuration="jtag+pm"></gc-target-connection-manager>
```