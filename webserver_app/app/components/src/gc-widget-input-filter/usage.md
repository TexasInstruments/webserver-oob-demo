**_HTML_**
```
<gc-widget-input-filter id="input" value="Hello World!" placeholder="Type something here..." has-clear-icon></gc-widget-input-filter>
<gc-widget-input-filter value="readonly" readonly></gc-widget-input-filter>
<gc-widget-input-filter value="disabled" disabled></gc-widget-input-filter>
```

**_Javascript_**
```
const input = document.querySelector('#input');
input.addEventListener('value-changed', ({ detail }) => {
   console.log(detail.value);
});
```