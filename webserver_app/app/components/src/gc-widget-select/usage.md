**_HTML_**
```
<gc-widget-select labels="Apple,Orange,Peach,Banana" initial-index="0"></gc-widget-select>
<gc-widget-select labels="Apple,Orange,Peach,Banana" initial-index="0" type="filter"></gc-widget-select>
```

**_Javascript_**

The `setFilterFunction` method can be used to override the default filter behavior for the filter type.
```
select.setFilterFunction( options => options.map(o => o.label === 'Apple' || o.label === 'Peach' ));
```