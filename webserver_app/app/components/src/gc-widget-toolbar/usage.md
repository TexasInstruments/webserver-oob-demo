The following are example of how to register, control its states, and execute an action in Javascript.

**_HTML_**
```
<gc-widget-toolbar>
    <gc-widget-toolbar-action tooltip="Cut" icon="icons:content-cut" action-id="cmd_cut"></gc-widget-toolbar-action>
    <gc-widget-toolbar-action tooltip="Copy" icon="icons:content-copy" action-id="cmd_copy"></gc-widget-toolbar-action>
    <gc-widget-toolbar-action tooltip="Paste" icon="icons:content-paste" action-id="cmd_paste"></gc-widget-toolbar-action>
    <gc-widget-toolbar-separator></gc-widget-toolbar-separator>
    <gc-widget-toolbar-action tooltip="Press Me!"></gc-widget-toolbar-action>
</gc-widget-toolbar>
```
**_Javascript_**
```
import { ActionRegistry } from './components/@ti/gc-widget-menu/lib/ActionRegistry';

let hasClipboard = false;
ActionRegistry.registerAction('cmd_cut', {
    run() { hasClipboard = true }
});

ActionRegistry.registerAction('cmd_copy', {
    run() { hasClipboard = true }
});

ActionRegistry.registerAction('cmd_paste', {
    run() { alert('Paste Clicked!'); },
    isEnabled() { return hasClipboard }
});
```