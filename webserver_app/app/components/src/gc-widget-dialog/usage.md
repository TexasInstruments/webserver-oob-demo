### Basic Dialog Box


```
<gc-widget-dialog close-on-esc>
    <!-- The following is slotted into content -->
    <p>Task successful! Press Esc to Dismiss.</p>
</gc-widget-dialog>
```


### Dialog Box with header and action bar


`gc-widget-dialog` can contain a header section with a main title, description, and an icon. The dialog can be movable by dragging the header section and if set, can be resizable by dragging the resize handler at the bottom right of the dialog. The action bar can contain a set of buttons.


```
<gc-widget-dialog heading="Title Content" desc="Description of dialog" icon="two-tone:action:face">
    <!-- The following is slotted into content -->
    <gc-widget-label label="Value:"></gc-widget-label>
    <gc-widget-input />
    <p>Lorem Ipsum</p>

    <!-- action bar buttons -->
    <gc-widget-button slot="action-bar" class="dialog-dismiss" label="Dismiss" button-type="link"></gc-widget-button>
    <gc-widget-button slot="action-bar" class="dialog-confirm" label="Ok" ></gc-widget-button>
</gc-widget-dialog>
```

### Using a Button close or submit action in a dialog


To bind a button to use the `gc-widget-dialog` default dismiss or confirm, include `dialog-dismiss` or `dialog-confirm` as a class in tag of the button. This must be in an element inside of the targeted dialog element.


```
<body>
<gc-widget-dialog heading="Header Title" desc="Drag me around to move the dialog box" close-on-esc >
    <!-- content -->
    <div>All information in this section is automatically put into the content slot.</div>

    <!-- action bar buttons -->
    <gc-widget-button slot="action-bar" class="dialog-dismiss" label="Dismiss" button-type="link"></gc-widget-button>
    <gc-widget-button slot="action-bar" class="dialog-confirm" label="Ok"></gc-widget-button>
</gc-widget-dialog>
```


### Using a Button to open a dialog
```
<body>
<gc-widget-dialog id="demo_element" close-on-esc>
    <p>I am opened.</p>
</gc-widget-dialog>

<gc-widget-button label="Open Demo Dialog" id="demoBtn"></gc-widget-button>
</body>

<!-- JAVASCRIPT -->
<script>
    window.addEventListener('DOMContentLoaded', () => {
        const demoBtn = document.querySelector('#demoBtn');
        demoBtn.addEventListener('click', () => document.querySelector('#demo_element').open());
    });
</script>
</body>
```