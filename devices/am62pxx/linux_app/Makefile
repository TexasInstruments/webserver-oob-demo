include ../../../common/linux_app/Makefile.common

TARGETS = audio_utils

all: $(TARGETS)

audio_utils: ../../../common/linux_app/audio_utils.c
	$(CC) $(CFLAGS) ../../../common/linux_app/audio_utils.c -o audio_utils -pthread $(LDFLAGS)

clean:
	rm -f $(TARGETS)
