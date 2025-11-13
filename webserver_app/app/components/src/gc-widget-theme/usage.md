### `gc-widget-theme` is in every GUI Composer project _index.gui_
```
<gc-widget-theme></gc-widget-theme>
```

### GUI Composer built in themes aliases

GUI Composer has two built in themes to choose from, light and dark. They are by default added to the list of selectable themes, in the `themeFilePaths` property. Their aliases are `$gc-theme-light`, and `$gc-theme-dark`.

### Custom css file format
```
:root{
    --theme-primary-color: #1661b8;
    --theme-secondary-color: #d36913;
    --theme-tertiary-color: #132b6d;
    --theme-background-color: #d1e0e6;
    --theme-background-color-disabled: #eaebec;
    --theme-font-color: #132b6d;
    --theme-header-font-color: #c26f03;
    --theme-scroll-track-color: rgba(#eeeeee, 0.1);
    --theme-scroll-thumb-color: rgba(#eeeeee, 0.5);
    --theme-scroll-thumb-color-hover: rgba(#eeeeee, 0.8);
}

/* INCLUDE IN EVERY THEME FILE */
:root .no-theme {
    --theme-primary-color: initial;
    --theme-secondary-color: initial;
    --theme-tertiary-color: initial;
    --theme-background-color: initial;
    --theme-background-color-disabled: initial;
    --theme-font-color: initial;
    --theme-header-font-color: initial;
    --theme-scroll-track-color: initial;
    --theme-scroll-thumb-color: initial;
    --theme-scroll-thumb-color-hover: initial;
}
```

### Excluding Elements from being Themed

To exclude elements, add the `no-theme` class to revert the element to use default styling.
To exclude **all** elements within a div, add the `.no-theme` class to the encompassing div.

### Using Themes Outside of GUI Composer on GC Components

Change the attribute `selected-theme-index` to change the theme.
The index given should have a corresponding a path/alias to the theme file and must be described in the `themeFilePaths` property.

Example:
```
<head>
    <meta charset="utf-8">
    <title>gc-widget-button Demo</title>
    <script type="module" src="@ti/build/gc-components.esm.js"></script>

    <style>
        #themedDiv{
            background: var(--theme-primary-color, #f7f7f7);
            color: var(--theme-font-color, black);
        }
    </style>

</head>

<body>
    <!-- Set to blue theme -->
    <gc-widget-theme
        theme-file-paths="$gc-theme-light|$gc-theme-dark|.\demo\custom-theme-blue.css"
        selected-theme-index="2">
    </gc-widget-theme>

```

GC components are theme compliant
```
    <gc-widget-button label="Click Here"></gc-widget-button>
    <gc-widget-label label="this is a label"></gc-widget-label>
```

Other elements in the same page can also use theme variables
```
    <div id="themedDiv">
        Lorem Ipsum
    </div>
</body>
```