To align the status item in the statusbar, set the `gc-widget-statusbar` child element `slot` attributer to have value `left`, `center`, or `right`.

**_HTML_**
```
<gc-widget-statusbar id="gc_widget_statusbar" status-text="Move mouse here!" status-tooltip="42" show-branding-image show-progress-bar show-progress-string>
    <gc-widget-statusitem-connections slot="left"></gc-widget-statusitem-connections>
    <gc-widget-button slot="right"></gc-widget-button>
</gc-widget-statusbar>
```
