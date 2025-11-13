**_HTML_**
```
<gc-widget-about-dialog></gc-widget-about-dialog>
```

**_Javascript_**
```
import { GcWidget } from './components/@ti/gc-widget-base/lib/GcWidget';
GcWidget.querySelector('gc-widget-about-dialog').then(dialog => {
    dialog.appLicenseLink = 'docs/license.txt';
    dialog.appManifestLink = 'docs/manifest.txt';
    dialog.appInfoTextHeading = 'Custom Heading';
    dialog.appInfoText = 'Detail info text...';
});
```