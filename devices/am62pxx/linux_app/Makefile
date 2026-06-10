include ../../../common/linux_app/Makefile.common

GST_CFLAGS := $(shell pkg-config --cflags gstreamer-1.0 2>/dev/null)
GST_LIBS   := $(shell pkg-config --libs   gstreamer-1.0 2>/dev/null)

TARGETS = audio_utils speech_utils

all: $(TARGETS)

audio_utils: ../../../common/linux_app/audio_utils.c
	$(CC) $(CFLAGS) ../../../common/linux_app/audio_utils.c -o audio_utils -pthread $(LDFLAGS)

speech_utils: ../../../common/linux_app/speech_utils.c
	$(CC) $(CFLAGS) $(GST_CFLAGS) ../../../common/linux_app/speech_utils.c \
		-o speech_utils -pthread $(GST_LIBS) $(LDFLAGS)

clean:
	rm -f $(TARGETS)
