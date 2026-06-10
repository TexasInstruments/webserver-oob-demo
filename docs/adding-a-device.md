# Adding a New Device

## Step 1: Create device directory

```bash
mkdir -p devices/<id>/app/images
mkdir -p devices/<id>/linux_app
```

Where `<id>` is a short lowercase slug, e.g. `am62x`, `am64x`.

## Step 2: Create `devices/<id>/device.json`

```json
{
  "id": "<id>",
  "displayName": "AM62x",
  "boards": [
    {
      "name": "SK-AM62",
      "description": "Starter kit for AM62x processors.",
      "image": "images/sk-am62.png"
    }
  ],
  "soc": "AM625 Cortex-A53 @ 1.4GHz",
  "demos": ["cpu-monitor"],
  "demoConfig": {}
}
```

Add board images to `devices/<id>/app/images/`.

## Step 3: Add device-specific native utilities (if needed)

Create `devices/<id>/linux_app/Makefile`:

```makefile
include ../../../common/linux_app/Makefile.common

TARGETS = my_utils

my_utils: my_utils.c
	$(CC) $(CFLAGS) my_utils.c -o my_utils $(LDFLAGS)

all: $(TARGETS)
clean:
	rm -f $(TARGETS)
```

## Step 4: Add device to Yocto recipe (meta-tisdk)

In `yocto/webserver-oob_git.bb`, add:

```bitbake
COMPATIBLE_MACHINE = "...|am62xx-evm"   # add to regex

DEVICE_ID:am62xx-evm = "am62x"

RDEPENDS:${PN}:am62xx-evm = "nodejs"
```

## Step 5: Test locally

```bash
make dev DEVICE=<id>          # test server logic
make dev DEVICE=<id> MOCK=1   # test with mock data (no native binaries needed)
```

## Step 6: Deploy

```bash
make deploy DEVICE=<id> BOARD_HOST=root@<ip>
```
