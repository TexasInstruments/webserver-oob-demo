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
String serial_input = "";
unsigned long last_blink_time = 0;

void writeToSerial(int blink, int state) {
    aJsonObject* root = aJson.createObject();
    if (root == NULL) {
        return;
    }
    
    aJson.addItemToObject(root, "blink", aJson.createItem(blink));
    aJson.addItemToObject(root, "on", aJson.createItem(on));
    char* string = aJson.print(root);
    
    if (string != NULL) {
        Serial.println(string);
        free(string);
    } 
    aJson.deleteItem(root);
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
        char incomingByte = Serial.read();
        
        if (incomingByte == '{') {
            serial_input = "{";
            
        } else if (incomingByte == '}') {
            serial_input = serial_input + "}";
            
            aJsonObject* root = aJson.parse((char*)serial_input.c_str());
            
            aJsonObject* _blink = aJson.getObjectItem(root, "blink");
            if (_blink) {
                blink = _blink->valueint;
            }
            
            aJsonObject* _on = aJson.getObjectItem(root, "on");
            if (_on) {
                on = _on->valueint;
            }
            
        } else {
            serial_input = serial_input + String(incomingByte);
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
