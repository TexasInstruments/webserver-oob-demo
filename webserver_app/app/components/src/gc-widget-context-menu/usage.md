The following are examples of how to register, control its states, and execute an action and action group in Javascript.
For submenus, menuactions need to be placed in a `menu-item` slot.

**_HTML_**
```
    <ti-widget-contextmenu>
        <gc-widget-menuitem class="sub-menu" icon="objects:list"abel="Font Size">
            <gc-widget-menuaction action-id="cmd_font_small" label="Small" toggle></gc-widget-menuaction>
            <gc-widget-menuaction action-id="cmd_font_medium" label="Medium" toggle></gc-widget-menuaction>
            <gc-widget-menuaction action-id="cmd_font_large" label="Large" toggle></gc-widget-menuaction>
            <gc-widget-menuaction action-id="cmd_font_xlarge" label="x-Large" toggle></gc-widget-menuaction>
        </gc-widget-menuitem>
        <gc-widget-menuseparator></gc-widget-menuseparator>
        <gc-widget-menuaction label="Auto Save" icon="icons:save" action-id="cmd_auto_save" toggle></gc-widget-menuaction>
        <gc-widget-menuseparator></gc-widget-menuseparator>
        <gc-widget-menuaction action-id="cmd_exit"  label="Exit" icon="icons:exit-to-app">
        </gc-widget-menuaction>
    </ti-widget-contextmenu>
```

**_Javascript_**
```
import { ActionRegistry } from './components/@ti/gc-widget-menu/lib/ActionRegistry';

// register a single action
let autoSave = true;
ActionRegistry.registerAction('cmd_auto_save', {
    run(detail) { autoSave = !autoSave; console.log(`Auto Save enabled=${ autoSave }`) },
    isChecked() { return autoSave }
});

ActionRegistry.registerAction('cmd_exit', {
    run() { alert('Exit Clicked!'); }
});

// register an action group
let currentFont = 'cmd_font_normal';
ActionRegistry.registerActionGroup(['cmd_font_small', 'cmd_font_medium', 'cmd_font_large', 'cmd_font_xlarge'], {
    run(detail) { currentFont = detail.id },
    isChecked(id) { return id === currentFont },
    isEnabled(id) { return id != 'cmd_font_medium' },
    isVisible(id) { return id != 'cmd_font_xlarge' }
});
```