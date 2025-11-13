#define LED RED_LED

int blink = 1;
int on = 0;
int last_on = 0;

void setup() {                
  pinMode(LED, OUTPUT);
}

void loop() {
    if (blink || on != last_on) {
        if (blink) {
            on = (on+1) % 2;
        }
        
        last_on = on;
        digitalWrite(LED, on);
        delay(1000);
    }
}
