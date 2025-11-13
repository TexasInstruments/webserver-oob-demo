### Icon Sizes


**_HTML_**
```
<gc-widget-icon icon="filled:action:face" size="xxs" />
<gc-widget-icon icon="outlined:action:face" size="xs" />
<gc-widget-icon icon="round:action:face" size="s" />
<gc-widget-icon icon="sharp:action:face" size="m" />
<gc-widget-icon icon="two-tone:action:face" size="l" />
<gc-widget-icon icon="face" size="xl" />
<gc-widget-icon icon="action:face" size="xl" />
```

### Icon Appearances

**_HTML_**
```
<gc-widget-icon icon="filled:action:face" appearance="primary" />
<gc-widget-icon icon="outlined:action:face" appearance="secondary" />
<gc-widget-icon icon="round:action:face" appearance="tertiary" />
<gc-widget-icon icon="sharp:action:face" appearance="success" />
<gc-widget-icon icon="two-tone:action:face" appearance="warn" />
<gc-widget-icon icon="face:action:face" appearance="error" />
<gc-widget-icon icon="face" appearance="primary" circle />
<gc-widget-icon icon="face" appearance="reversed" />
<gc-widget-icon icon="face" appearance="custom" id="custom-icon" />
```

**_CSS_**
```
#custom-icon {
    --gc-color: deeppink;
}
```