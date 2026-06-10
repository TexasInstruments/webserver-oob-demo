# Root Makefile — webserver-oob-demo multi-device build
#
# Usage:
#   make                           Build for default device (am335x) on native host
#   make DEVICE=am62x              Build for am62x
#   make CC=arm-linux-gnueabihf-gcc Cross-compile for ARM target
#   make dev                       Run server locally (no cross-compile)
#   make dev MOCK=1                Run server with mock data (no target binaries needed)
#   make deploy BOARD_HOST=root@192.168.7.2  Deploy to board via SSH
#   make clean                     Remove build artifacts

DEVICE     ?= am335x
CC         ?= gcc
BOARD_HOST ?= root@192.168.7.2
INSTALL_DIR = /usr/share/webserver-oob

export CC CFLAGS LDFLAGS

.PHONY: all build deps build-native clean dev deploy \
        deploy-bins deploy-server deploy-app deploy-restart

all: build

build: deps build-native

deps:
	cd common/webserver && npm install

build-native:
	$(MAKE) -C common/linux_app
	@if [ -d devices/$(DEVICE)/linux_app ]; then \
	    $(MAKE) -C devices/$(DEVICE)/linux_app; \
	fi

clean:
	$(MAKE) -C common/linux_app clean
	@if [ -d devices/$(DEVICE)/linux_app ]; then \
	    $(MAKE) -C devices/$(DEVICE)/linux_app clean; \
	fi


# ── Local development ────────────────────────────────────────────────

# Run server locally using device config (no cross-compile needed).
# Set MOCK=1 to use mock data instead of real native binaries.
dev: deps
	DEVICE_CONFIG=$(CURDIR)/devices/$(DEVICE)/device.json \
	MOCK=$(MOCK) \
	    node common/webserver/server.js $(CURDIR)/common/app

# Run with full mock (fake CPU stats + fake audio devices)
dev-mock: MOCK=1
dev-mock: dev

# ── Deploy to board via SSH ──────────────────────────────────────────

deploy: build deploy-bins deploy-server deploy-app
	@echo "Deploy complete. Run 'make deploy-restart' to restart the service."

deploy-bins:
	ssh $(BOARD_HOST) "mkdir -p /usr/bin"
	scp common/linux_app/cpu_stats $(BOARD_HOST):/usr/bin/cpu_stats
	@if [ -f devices/$(DEVICE)/linux_app/audio_utils ]; then \
	    scp devices/$(DEVICE)/linux_app/audio_utils $(BOARD_HOST):/usr/bin/audio_utils; \
	fi

deploy-server:
	ssh $(BOARD_HOST) "rm -rf $(INSTALL_DIR)/server $(INSTALL_DIR)/demos && \
	    mkdir -p $(INSTALL_DIR)/server $(INSTALL_DIR)/demos"
	tar -C common/webserver --exclude node_modules -cf - . | \
	    ssh $(BOARD_HOST) "tar -C $(INSTALL_DIR)/server -xf -"
	ssh $(BOARD_HOST) "cd $(INSTALL_DIR)/server && npm install --production"
	tar -C demos -cf - . | \
	    ssh $(BOARD_HOST) "tar -C $(INSTALL_DIR)/demos -xf -"
	ssh $(BOARD_HOST) "\
	    echo 'DEVICE_CONFIG=$(INSTALL_DIR)/app/device.json' > /etc/webserver-oob.conf && \
	    echo 'APP_DIR=$(INSTALL_DIR)/app' >> /etc/webserver-oob.conf"

deploy-app:
	ssh $(BOARD_HOST) "rm -rf $(INSTALL_DIR)/app && mkdir -p $(INSTALL_DIR)/app"
	tar -C common/app --exclude components/.git -cf - . | \
	    ssh $(BOARD_HOST) "tar -C $(INSTALL_DIR)/app -xf -"
	@if [ -d devices/$(DEVICE)/app ]; then \
	    tar -C devices/$(DEVICE)/app -cf - . | \
	        ssh $(BOARD_HOST) "tar -C $(INSTALL_DIR)/app -xf -"; \
	fi
	scp devices/$(DEVICE)/device.json $(BOARD_HOST):$(INSTALL_DIR)/app/device.json

deploy-restart:
	ssh $(BOARD_HOST) "systemctl restart webserver-oob"

# ── Info ─────────────────────────────────────────────────────────────

info:
	@echo "Device:      $(DEVICE)"
	@echo "CC:          $(CC)"
	@echo "BOARD_HOST:  $(BOARD_HOST)"
	@echo "INSTALL_DIR: $(INSTALL_DIR)"
	@echo "Demos dir:   $(CURDIR)/demos"
	@echo "Device dir:  $(CURDIR)/devices/$(DEVICE)"
