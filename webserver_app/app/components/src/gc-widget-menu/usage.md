The following are examples of how to register, control its states, and execute an action and action group in Javascript.
Additional menu item or widget can be placed on the right side of the menu bar by setting the slot attribute to have
`tool-list` value.

**_HTML_**
```
<gc-widget-menubar product-name="GUI Composer" product-icon="hardware:memory" open-on-hover layout horizontal>
    <gc-widget-menuitem label="File">
        <gc-widget-menuitem label="Run" action-id="cmd_action_run" hotkey="CtrL+r" />
        <gc-widget-menuseparator />
        <gc-widget-menuitem>
            <gc-widget-menuaction action-id="cmd_font_small" label="Small" toggle />
            <gc-widget-menuaction action-id="cmd_font_medium" label="Medium" toggle />
            <gc-widget-menuaction action-id="cmd_font_large" label="Large" toggle />
            <gc-widget-menuaction action-id="cmd_font_xlarge" label="x-Large" toggle />
        </gc-widget-menuitem>
    <gc-widget-menuitem>

    <gc-widget-menuitem icon="action:settings" slot="tool-list">
        <gc-widget-menuaction action-id="cmd_settings" label="Settings" />
    <gc-widget-menuitem>
<gc-widget-menubar>
```

**_Javascript_**
```
import ( ActionRegistry ) from './components/@ti/gc-widget-menu/lib/ActionRegistry';

// register a single action
ActionRegistry.registerAction('cmd_action_run', {
    run() { alert('Run Action!') }
    isVisible() { return true }
    isEnabled() { return true }
    isChecked() { return false } // called when the toggle attribute is set for this element
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