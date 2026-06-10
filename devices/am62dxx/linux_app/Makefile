include ../../../common/linux_app/Makefile.common

TARGETS = audio_utils

audio_utils: ../../../common/linux_app/audio_utils.c
	$(CC) $(CFLAGS) ../../../common/linux_app/audio_utils.c -o audio_utils -pthread $(LDFLAGS)

all: $(TARGETS)

clean:
	rm -f $(TARGETS)
