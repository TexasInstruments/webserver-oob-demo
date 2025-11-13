### Overview
The webserver will connect to the MSP432 device using the gc-server-ds module. It configures device using a ccxml file, loads the blink LED program, and issues the run command. The webserver is listening on port `9999`, it accepts `msp432` route with GET and POST requests.

### Curl Commands
To test the `msp432` route, use the following `curl` commands to send a GET or a POST request.

* ```curl http://127.0.0.1:9999/msp432 -X POST -H "Content-Type: application/json" -d "{\"blink\": 0}"```. Write the `blink` global variable to toggle the LED on/off.
* ```curl http://127.0.0.1:9999/msp432```. Read the global variables from the target.