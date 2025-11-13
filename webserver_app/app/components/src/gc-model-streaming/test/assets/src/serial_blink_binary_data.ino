#include <aJSON.h>

/*
  Blink
  The basic Energia example.
  Turns on an LED on for one second, then off for one second, repeatedly.
  Change the LED define to blink other LEDs.
  
  Hardware Required:
  * LaunchPad with an LED
  
  This example code is in the public domain.
*/

// most launchpads have a red LED
#define LED RED_LED

int blink = 1;
int on = 0;
int last_on = 0;
unsigned long last_blink_time = 0;
enum { Read, Write, Blink, Ping };

void writeToSerial(int blink, int state) {
    Serial.write((unsigned char)0x7c);
    Serial.write((unsigned char)5);
    Serial.write((unsigned char)0);
    Serial.write((unsigned char)blink);
    Serial.write((unsigned char)state);
}

// the setup routine runs once when you press reset:
void setup() {                
    // initialize the digital pin as an output.
    pinMode(LED, OUTPUT);  
    Serial.begin(9600);
    writeToSerial(blink, on);
}

// the loop routine runs over and over again forever:
void loop() {
    unsigned long blink_time = millis();
    
    if (Serial.available()) {
        char startByte = Serial.read();
        if (startByte == 0x7c) {
            // valid start byte
            char len = Serial.read();
            char cmd = Serial.read();
            switch(cmd) {
                case Ping:
                    writeToSerial(blink, on);    
                    break;
                case Blink:
                    blink = Serial.read();
                    break;
                case Write:
                    on = Serial.read();
                    break;
            }
        }
    } else if (blink_time > last_blink_time + 1000) {
        last_blink_time = blink_time;
        
        if (blink || on != last_on) {
            if (blink) {
                on = (on+1) % 2;
            }
            
            last_on = on;
            digitalWrite(LED, on);
            writeToSerial(blink, on);
        }
    }
}
