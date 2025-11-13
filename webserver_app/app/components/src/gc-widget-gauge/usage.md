**_HTML_**
```
<gc-widget-gauge value="42" main-title="Speedometer" sub-title="km" has-detail-value detail-value="P109" />
<gc-widget-gauge value="42" min-value="0" max-value="100" />
<gc-widget-gauge value="42" num-ticks-per-number-label="5" />
<gc-widget-gauge value="42" num-ticks-per-unit="2" />
<gc-widget-gauge value="42" precision="1" />

```

**_CSS_**
```
#demo_element {
    --gc-tick-style: bold;
    --gc-needle-color: orange
    --gc-detail-value-background-color: orangered;
}
```