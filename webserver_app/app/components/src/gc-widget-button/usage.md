### Standard button

**_HTML_**
```
<gc-widget-button id="demo-element" label="Primary Button (click me!)"></gc-widget-button>
<gc-widget-button label="Secondary Button" button-type="secondary"></gc-widget-button>
<gc-widget-button label="Text Button" button-type="link"></gc-widget-button>
```

### Icon button

Refer to [gc-widget-icon](#gc-widget-icon) for help on icon references.

**_HTML_**
```
<gc-widget-button label="Primary Button" icon="objects:info-circle"></gc-widget-button>
<gc-widget-button label="Secondary Button" button-type="secondary" icon="objects:info-circle"></gc-widget-button>
<gc-widget-button label="Text Button" button-type="link" icon="objects:info-circle"></gc-widget-button>
```

### Icon only button

**_HTML_**
```
<gc-widget-button button-type="primary" icon="objects:info-circle"></gc-widget-button>
<gc-widget-button button-type="secondary" icon="icons:add"></gc-widget-button>
<gc-widget-button button-type="link" icon="icons:android"></gc-widget-button>
```

### Add a click event listener in Javascript
**_Javascript_**
```
document.querySelector("#demo-element").addEventListener("click", () => {
    alert("Button Clicked!");
});
```