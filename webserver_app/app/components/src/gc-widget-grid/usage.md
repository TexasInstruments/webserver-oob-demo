**_HTML_**
```
#column2 {
    --gc-column-width: 125px; // fixed size column, default is to auto size to content in column.
}

<gc-widget-grid id="grid" layout horizontal>
    <gc-widget-grid-tree-column id="column1" heading="Category" flex two></gc-widget-grid-tree-column>
    <gc-widget-grid-data-column id="column2" heading="Datum" name="numberData" format="dec"></gc-widget-grid-data-column>
    <gc-widget-grid-data-column id="column3" heading="Datum" name="textData" format="text" flex one></gc-widget-grid-data-column>
    ...
</gc-widget-grid>
```

**_Javascript_**
```
<script>
    GcWidget.querySelector('#grid').then((grid) => {
        grid.setDataProvider({
            rowCount: 40,
            getValue(columnName) {
                if (columnName === 'name') {
                    // tree column data
                } else if (columnName === 'numberData') {
                    ...
                }
                ...
            }
            ...
        });
    });
</script>
```
For each column, add a gc-widget-grid-data-column instance, and set the name, and set the format property for the data to be displayed.
For a tree grid, add a single gc-widget-grid-tree-column instance.


