/* -------------------------------------------------------------
   demos/benchmark/demo.js
   -------------------------------------------------------------
   Periodically fetches benchmark data from the server endpoint
   `/benchmark-data` and updates the UI widgets.
   The update loop starts after the WebComponentsReady event.
   ------------------------------------------------------------- */

/**
 * Fetch the latest benchmark data and push the values into the
 * corresponding widget attributes.
 */
function update_benchmark_data() {
    // The server now serves the data at /benchmark-data
    $.getJSON('/benchmark-data', function (json_file) {
        /* ----- Core 0 ------------------------------------------------- */
        $('#gauge1').attr('value', json_file.core0.output.cpu_load.current);
        $('#ti_widget_label34').attr('label', json_file.core0.output.cpu_load.average);
        $('#ti_widget_label36').attr('label', json_file.core0.output.cpu_load.max);
        $('#ti_widget_label39').attr('label', json_file.core0.output.int_latency.average);
        $('#ti_widget_label40').attr('label', json_file.core0.output.int_latency.max);
        $('#ti_widget_label83').attr('label', json_file.core0.output.cycles_per_loop.average);
        $('#ti_widget_label84').attr('label', json_file.core0.output.cycles_per_loop.max);

        /* ----- Core 1 ------------------------------------------------- */
        $('#gauge2').attr('value', json_file.core1.output.cpu_load.current);
        $('#ti_widget_label45').attr('label', json_file.core1.output.cpu_load.average);
        $('#ti_widget_label44').attr('label', json_file.core1.output.cpu_load.max);
        $('#ti_widget_label47').attr('label', json_file.core1.output.int_latency.average);
        $('#ti_widget_label48').attr('label', json_file.core1.output.int_latency.max);
        $('#ti_widget_label87').attr('label', json_file.core1.output.cycles_per_loop.average);
        $('#ti_widget_label88').attr('label', json_file.core1.output.cycles_per_loop.max);

        /* ----- Core 2 ------------------------------------------------- */
        $('#gauge3').attr('value', json_file.core2.output.cpu_load.current);
        $('#ti_widget_label53').attr('label', json_file.core2.output.cpu_load.average);
        $('#ti_widget_label52').attr('label', json_file.core2.output.cpu_load.max);
        $('#ti_widget_label55').attr('label', json_file.core2.output.int_latency.average);
        $('#ti_widget_label56').attr('label', json_file.core2.output.int_latency.max);
        $('#ti_widget_label91').attr('label', json_file.core2.output.cycles_per_loop.average);
        $('#ti_widget_label92').attr('label', json_file.core2.output.cycles_per_loop.max);

        /* ----- Core 3 ------------------------------------------------- */
        $('#gauge4').attr('value', json_file.core3.output.cpu_load.current);
        $('#ti_widget_label61').attr('label', json_file.core3.output.cpu_load.average);
        $('#ti_widget_label60').attr('label', json_file.core3.output.cpu_load.max);
        $('#ti_widget_label63').attr('label', json_file.core3.output.int_latency.average);
        $('#ti_widget_label64').attr('label', json_file.core3.output.int_latency.max);
        $('#ti_widget_label95').attr('label', json_file.core3.output.cycles_per_loop.average);
        $('#ti_widget_label96').attr('label', json_file.core3.output.cycles_per_loop.max);

        /* ----- A53 ---------------------------------------------------- */
        $('#gauge5').attr('value', json_file.a53.output.cpu_load.current);
        $('#ti_widget_label79').attr('label', json_file.a53.output.cpu_load.average);
        $('#ti_widget_label68').attr('label', json_file.a53.output.cpu_load.max);
        $('#ti_widget_label98').attr('label', json_file.a53.output.int_latency.average);
        $('#ti_widget_label99').attr('label', json_file.a53.output.int_latency.max);
        $('#ti_widget_label101').attr('label', json_file.a53.output.cycles_per_loop.average);
        $('#ti_widget_label102').attr('label', json_file.a53.output.cycles_per_loop.max);
    });
}

/* Start the periodic update after WebComponents are ready */
document.addEventListener('WebComponentsReady', function () {

    var benchmarkGauge1 = document.querySelector('#gauge1');
    var benchmarkGauge2 = document.querySelector('#gauge2');
    var benchmarkGauge3 = document.querySelector('#gauge3');
    var benchmarkGauge4 = document.querySelector('#gauge4');
    var benchmarkGauge5 = document.querySelector('#gauge5');

    if (benchmarkGauge1 && benchmarkGauge2 && benchmarkGauge3 && benchmarkGauge4) {
        update_benchmark_data();
        setInterval(update_benchmark_data, 1000);
    }

});
