# WebServer Out-of-Box Demo

Web-based demo application for TI Sitara devices. Features real-time audio classification, CPU performance monitoring, and system information — all driven by a plugin architecture that adapts automatically to each target device.

## Supported Devices

| Device | Boards |
|---|---|
| AM335x | BeagleBone Green Eco, TMDXEVM3358 |
| AM62x  | SK-AM62B, SK-AM62-SIP, AM62x LP EVM |
| AM62Px | SK-AM62P |
| AM62Lx | SK-AM62L |
| AM62Dx | AM62Dx EVM |

## Directory Structure

```
common/
  app/              Generic frontend (index.html, main.js, components submodule)
  linux_app/        Shared C utilities: cpu_stats, audio_utils
  webserver/        Express server + demo plugin loader

demos/
  cpu-monitor/      CPU load/info demo (all devices)
  audio-classification/  YAMNet audio classification (all devices)

devices/<id>/
  device.json       Device metadata, active demos, per-demo config
  app/images/       Board photos
  linux_app/        Device-specific Makefile (builds audio_utils)

tools/
  generate-inc.js   Regenerates webserver-oob-npm.inc from package-lock.json

yocto/
  webserver-oob_git.bb   Single Yocto recipe for all devices
```

## Getting Started

```bash
# Clone with submodules
git clone https://github.com/TexasInstruments/webserver-oob-demo.git
cd webserver-oob-demo
git submodule update --init --recursive   # requires git.ti.com access

# Install Node.js deps
cd common/webserver && npm install && cd ../..

# Run locally (no target board needed)
make dev DEVICE=am335x MOCK=1
# Open http://localhost:3000
```

## Building for Target

```bash
# Cross-compile native utilities
make build DEVICE=am62xx CC=aarch64-linux-gnu-gcc

# Deploy to board
make deploy DEVICE=am62xx BOARD_HOST=root@<ip>
```

## Adding a Demo / Device

See `docs/adding-a-demo.md` and `docs/adding-a-device.md`.

## License

TI Text File License (TI-TFL). See [LICENSE](LICENSE).
