
`gc-widget-tooltip` uses `fixed` positioning in relation to its anchored element.

### Tooltip anchored to any div by id
```
    <gc-widget-tooltip text="right by default" anchor-id="a"></gc-widget-tooltip>
    <gc-widget-tooltip text="left" anchor-id="a" position="left"></gc-widget-tooltip>
    <gc-widget-tooltip text="top" anchor-id="a" position="top"></gc-widget-tooltip>
    <gc-widget-tooltip text="bottom" anchor-id="a" position="bottom"></gc-widget-tooltip>
    
    <div id="a" style="width: 80px; height: 50px;border: 1px solid black;"> hover over me! </div>
```

### Tooltip inside a gc-widget
Define a tooltip as an attribute `tooltip`.

```
    <a ref="https://www.example.com/" target="_blank">
        <gc-widget-button id="linkbtn" label="Link Button" icon="image:edit" button-type="link" raised
            tooltip="Opens example.com">
        </gc-widget-button>
    </a>
```

```
    <gc-widget-checkbox label="Off..." label-when-checked="On!"
    tooltip="click this if you dare"></gc-widget-checkbox>

```
