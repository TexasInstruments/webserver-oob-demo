include ../../../common/linux_app/Makefile.common

TARGETS = rpmsg_json

CFLAGS += -I. -I./ti-rpmsg-char/include

rpmsg_json: rpmsg_json.c ti-rpmsg-char/src/rpmsg_char.c \
            ti-rpmsg-char/src/soc.c ti-rpmsg-char/src/utils.c
	$(CC) $(CFLAGS) $^ -o rpmsg_json

all: $(TARGETS)

clean:
	rm -f $(TARGETS)
