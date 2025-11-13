### Determinate Progressbar


**_HTML_**
```
<gc-widget-progressbar min-value="0" max-value="100" value="65"></gc-widget-progressbar>

```

> **_NOTE:_**  Both min-value and max-value must be defined properly to use a determinate styled progressbar. Otherwise it will default to an indeterminate style.
### Indeterminate Progressbar

**_HTML_**
```
<gc-widget-progressbar></gc-widget-progressbar>

```


**_CSS_**
```
#demo_element {
    --gc-background-color: grey;
    --gc-progressbar-color: navyblue;
}
```
