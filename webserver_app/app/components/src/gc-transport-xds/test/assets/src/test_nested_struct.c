#include "msp.h"


extern int x = 0xBEAD;
extern signed char str[20] = "this is a test";

enum ENUMS {
    IDLE,
    READ,
    WRITE = 24
};

struct OBJECT {
   enum ENUMS en;
   int si;
   unsigned int ui;
   short ss;
   unsigned short us;
   long sl;
   unsigned long ul;
   signed char sc;
   unsigned char uc;
   unsigned char array[10];
   struct {
       int aa;
       int bb;
   } me;
   double fd;
   float ff;
   char *str;
   struct OBJECT *ptr;
} obj;

/**
 * main.c
 */
void main(void)
{
	WDT_A->CTL = WDT_A_CTL_PW | WDT_A_CTL_HOLD;		// stop watchdog timer

	if (x == 0xBEAD) {
	    obj.en = WRITE;
	    obj.si = 0xFFFFFFFF;
	    obj.ui = 0xFFFFFFFF;
	    obj.ss = 0xFFFE;
	    obj.us = 0xFFFE;
	    obj.sl = 0xFFFFFFFD;
	    obj.ul = 0xFFFFFFFD;
	    obj.sc = 0xFC;
	    obj.uc = 0xFC;
	    obj.fd = 6.283l;
	    obj.ff = 3.1415;
	    obj.me.aa = 46;
	    obj.me.bb = 47;
	    obj.str = str;
	    obj.ptr = &obj;
    }

	int i = 0;
	for(; i < 10; i++) {
	    obj.array[i] = i;
	}

	while(1) {
	}

}
