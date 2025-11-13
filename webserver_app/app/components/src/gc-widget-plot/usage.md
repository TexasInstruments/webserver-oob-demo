**_HTML_**
```
#line1 {
    --gc-line-color: rgba(0,0,255,0.8);
    --gc-line-width: 3;
}
#line2 {
    --gc-marker-color: rgb(255,0,0);
    --gc-marker-size: 4;
    --gc-line-width: 2;
}
<gc-widget-plot id="gc_widget_plot1">
    <gc-widget-plot-data-points-2d id="line1"></gc-widget-plot-data-points-2d>
    <gc-widget-plot-data-points-2d id="line2" mode="lines+markers"></gc-widget-plot-data-points-2d>
</gc-widget-plot>
<gc-model-streaming id="stream"></gc-model-streaming>
```
For each line, bind its point property to a streaming model.
For example, assume the streaming model (with id 'stream') emits data { point: [[1, 2], [3, 5], [6, 4]] },
line1.point can be bound to stream.point.

By default, data is expected to contain both x and y values in the form of a 2-d array [x, y][] as shown above.
When the model emits one data point at a time, the data can be a 2-d array, e.g. { point: [[1, 2]] },
or a 1-d arrary [x, y], e.g. { point: [1, 2] },

If data is y values only, set implicit-x attribute as shown below, and make the streaming model
emit data in a 1-d array, e.g. { point: [2, 5, 4] }, or a number, e.g. { point: 2 }
```
    <gc-widget-plot-data-points-2d id="line1" implicit-x></gc-widget-plot-data-points-2d>
```

See streaming model component for information about how the model gets its data from its upstream.