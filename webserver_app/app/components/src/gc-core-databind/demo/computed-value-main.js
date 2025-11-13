/**
 *  Copyright (c) 2021 Texas Instruments Incorporated
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *  *   Redistributions of source code must retain the above copyright
 *  notice, this list of conditions and the following disclaimer.
 *  notice, this list of conditions and the following disclaimer in the
 *  documentation and/or other materials provided with the distribution.
 *  *   Neither the name of Texas Instruments Incorporated nor the names of
 *  its contributors may be used to endorse or promote products derived
 *  from this software without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 *  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 *  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 *  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 *  OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 *  OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 *  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// Example of creating computed bindings.  This code registers a getter and setter between a date widget and day, month, and year widgets.
// And, a getter between a raw value and a rounded value.

document.addEventListener('gc-databind-ready', function(event)
{
    const bindingRegistry = event.detail.registry;
    /*
    *   function bindingRegistry.bind(targetBinding, modelBinding, getter, [setter]);
    */
    bindingRegistry.bind('$.date.value',
        // dependant bindings needed in order to compute the date, in name/value pairs.
        {
            weekday: '$.dayOfWeek.selectedText',
            day: '$.dayOfMonth.value',
            month: '$.month.selectedText',
            year: '$.year.value'
        },
        // getter for date computation
        function(values)
        {
            // compute and return the string value to bind to the widget with id 'date'
            return values.weekday + ', ' + values.month + ' ' + values.day + ', ' + values.year;

        },
        // setter for date calculation (optional - needed for two-way databinding)
        function(value)
        {
            // return an object with name value pairs for all the dependent bindings that need to change
            // based on new value of the widget
            value = value.toString();  // make sure we start with a string.

            var fields = value.split(',');
            if (fields.length != 3)
            {
                return {};  // commit no changes, can't parse input
            }
            var result =
            {
                weekday : fields[0].trim(),
                year : fields[2].trim()
            };
            fields = fields[1].trim().split(' ');
            if (fields.length != 2)
            {
                return {};  // commit no changes, can't parse month and day
            }
            result.day = +(fields[1]);  // convert to number
            result.month = fields[0];

            return result; // commit changes back to dependant bindings.
        }
    );
});





