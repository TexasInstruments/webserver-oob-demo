/*
THis program required use of newer GCC compiler i.e. same version that is used to compile MSP432

*/

struct MYSTRUCT {
    int _int;
    bool _bool;
} myStruct = {42,true};

enum MYENUM {
    ONE = 1,
    TWO = 2,
    THREE = 3
} myEnum = TWO;

bool _bool = true;
float _float = 3.141592654;
double _double = 3.141592654;

unsigned char _charArray[16] = "Hello World!";
unsigned char* _charPtr = _charArray;

int _2DIntArray[2][4] = {
    {10, 11, 12, 13},
    {14, 15, 16, 17}
};

MYSTRUCT _2DStructArray[2] = {{1, true}, {2, false}};

short _short = -32767;
unsigned short _unsigned_short = 65535;
int _int = -2147483647;
unsigned int _unsigned_int = 4294967295;
long _long = -2147483647;
unsigned long _unsigned_long = 4294967295;

void setup() {
    // workaround for compiler not to opimitize out variables.
    _charArray[0] = 'H';
    _charPtr = _charArray;
    myStruct = {42,true};
    myEnum = TWO;
    _bool = true;
    _float = 3.141592654;
    _double = 3.141592654;
    _2DIntArray[0][0] = 10;
    _2DStructArray[0]._int = 1;
    _short = -32767;
    _unsigned_short = 65535;
    _int = -2147483647;
    _unsigned_int = 4294967295;
    _long = -2147483647;
    _unsigned_long = 4294967295;

}

void loop() {
}
