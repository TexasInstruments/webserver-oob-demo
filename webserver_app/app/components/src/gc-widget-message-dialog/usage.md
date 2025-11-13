
**_Javascript_**

The following are examples for opening varies predefined dialog using Javascript.
Each API returns a Promise, async and await can be used to synchronize the dialog
result.

**Alert**
```javascript
(async () => {
    await gc.dialog.alert('alert message');
    // continue after the dialog is closed
})();
```

**Info**
```javascript
(async () => {
    await gc.dialog.info('info message');
    // continue after the dialog is closed
})();
```

**Error**
```javascript
(async () => {
    await gc.dialog.error('error message');
    // continue after the dialog is closed
})();
```

**Warning**
```javascript
(async () => {
    await gc.dialog.warning('warning message');
    // continue after the dialog is closed
})();
```

**Prompt**
```javascript
(async () => {
    const result = await gc.dialog.prompt('Prompt', 'prompt message', 'action:announcement');
    // continue after the dialog is closed, result can be dismiss or confirm
})();
```

**Progress**
```javascript
(async () => {
   const {progress, result} = await gc.dialog.progress('Backup', 'Uploading all files on your hard drive to somewhere in the cloud.');
   result.then(e => console.log(e) /* continue after the dialog is closed */);

   let value = 0;
   const intervalHdlr = setInterval(() => {
      value += 1;
      progress.setValue(value);
      progress.setMessage(`Uploaded: ${value}%`);
      if (value >= 100) clearInterval(intervalHdlr);

      // cancel progress
      // if (value === 40) {
      //     progress.cancel();
      //     clearInterval(intervalHdlr);
      // }
   }, 100);
})();
```