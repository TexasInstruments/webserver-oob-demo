/**
 -------------------------------------------------------------------------------------------------------------------------------
  This file provides boilerplate templates for interfacing with the GUI Composer framework.
  For further information, select 'Help | Components Help | Components v3' main menu in the Designer.
 -------------------------------------------------------------------------------------------------------------------------------
 */

import { GcConsole } from './components/@ti/gc-core-assets/lib/GcConsole';
import { bindingRegistry } from './components/@ti/gc-core-databind/lib/CoreDatabind';
import { GcWidget } from './components/@ti/gc-widget-base/lib/GcWidget';
import { ActionRegistry } from './components/@ti/gc-widget-menu/lib/ActionRegistry';

let console = new GcConsole('myapp');   // creates a console instance with name 'myapp'
GcConsole.setLevel('myapp', 5);         // enable console output for myapp console instance


/**
 -------------------------------------------------------------------------------------------------------------------------------
  Boilerplate code for databinding
 -------------------------------------------------------------------------------------------------------------------------------
 **/

// Add custom computed value databindings here, using the following method:
//
// bindingRegistry.bind(targetBinding, modelBinding, [getter], [setter]);
//
//  param targetBinding - single binding string or expression, or array of binding strings for multi-way binding.
//  param modelBinding - single binding string or expression, or array of binding strings for multi-way binding.
//  param getter - (optional) - custom getter function for computing the targetBinding value(s) based on modelBinding value(s).
//  param setter - (optional) - custom setter function for computing the modelBinding value(s) based on targetBinding value(s).

// For example:
//
// A simple computed values based on simple expression
// bindingRegistry.bind('widget.id.propertyName', "targetVariable == 1 ? 'binding is one' : 'binding is not one'");
//
// A custom two-way binding with custom getter and setter functions.
// (setter is optional)  (getter only indicates one-way binding)
// bindingRegistry.bind('widget.id.propertyName', 'targetVariable',
//     value => { return value*5/9 + 32; }, /* getter */
//     value => { (return value-32)*9/5; }  /* setter */
// );
//
// Event 1 to n bindings
// bindingRegistry.bind('widget.date.value', {
//     /* dependant bindings needed in order to compute the date, in name/value pairs. */
//         weekday: 'widget.dayOfWeek.selectedText',
//         day: 'widget.dayOfMonth.value',
//         month: 'widget.month.selectedText',
//         year: 'widget.year.value'
//     },
//     /* getter for date computation */
//     function(values) {
//         /* compute and return the string value to bind to the widget with id 'date' */
//         return values.weekday + ', ' + values.month + ' ' + values.day + ', ' + values.year;
//     }
// );


/**
 -------------------------------------------------------------------------------------------------------------------------------
  Boilerplate code for working with webcomponents in the application.
 -------------------------------------------------------------------------------------------------------------------------------
 **/

const init = () => {
    // Add clicked handler event listener
    // GcWidget.querySelector('#<my_widget_id>').then(widget => {
    //     widget.addEventListener('clicked', () => window.open('https://dev.ti.com/gc', 'gc'));
    // });
};
document.readyState === 'complete' ? init() : document.addEventListener('DOMContentLoaded', init);


/**
 -------------------------------------------------------------------------------------------------------------------------------
  Boilerplate code for registering menu and toolbar action callback
 -------------------------------------------------------------------------------------------------------------------------------
 **/

// ActionRegistry.registerAction('<action_id>', {
//     run() { console.log('Action executed!') }
// });