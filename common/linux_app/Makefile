include Makefile.common

TARGETS = cpu_stats

cpu_stats: cpu_stats.c
	$(CC) $(CFLAGS) cpu_stats.c -o cpu_stats -lm $(LDFLAGS)

all: $(TARGETS)

clean:
	rm -f $(TARGETS)
