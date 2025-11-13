#include <Serial_Cmd_Monitor.h>

#define LED RED_LED

UARTmon myMonitor;

int blink = 1;
int on = 0;
int last_on = 0;
unsigned long last_blink_time = 0;

void setup() {
  Serial.begin(9600);
  pinMode(LED, OUTPUT);  
  last_blink_time = millis();
}

void loop() {
    unsigned long blink_time = millis();
    int in_byte = 0;
    
    if (blink_time > last_blink_time + 1000) {
        last_blink_time = blink_time;
        
    	if (blink || on != last_on) {
            if (blink) {
                on = (on+1) % 2;
            }
            last_on = on;
            digitalWrite(LED, on);
        }
    }

    /* read and process serial data */
	if (Serial.available() > 0) {
		in_byte = Serial.read();
		myMonitor.receivedDataCommand(in_byte);
	}
}