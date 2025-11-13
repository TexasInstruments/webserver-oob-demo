# AM335x WebServer Out-of-Box Demo

A modern web-based demonstration application for Texas Instruments AM335x processors, featuring real-time audio classification, CPU performance monitoring, and system documentation.

## Features

- **Real-time Audio Classification**: Live audio analysis using GStreamer and TensorFlow Lite
- **CPU Performance Monitoring**: Real-time CPU usage tracking with historical graphs
- **System Information**: Hardware and software details display
- **Documentation Hub**: Quick access to TI documentation and resources

## Directory Structure

```
webserver-oob-demo/
├── webserver_app/
│   ├── app/                  # Frontend web application
│   │   ├── index.html        # Main HTML file
│   │   ├── main.js          # Application JavaScript
│   │   ├── components/      # TI GUI Composer components
│   │   └── images/          # Board images and assets
│   ├── webserver/           # Node.js backend server
│   │   ├── webserver-oob.js # Express server with WebSocket support
│   │   ├── fifo-reader.js   # FIFO reader for audio classification
│   │   └── package.json     # Node.js dependencies
│   └── linux_app/           # Native C utilities
│       ├── cpu_stats.c      # CPU monitoring utility
│       ├── audio_utils.c    # Audio device management
│       └── Makefile         # Build configuration
└── README.md
```

## Prerequisites

- Node.js (v14 or higher)
- GStreamer 1.0 with NNStreamer plugin
- ALSA audio support
- C compiler (gcc)

## Building

### Native Utilities

```bash
cd webserver_app/linux_app
make
```

### Node.js Server

```bash
cd webserver_app/webserver
npm install
```

## Running the Application

1. Start the web server:
```bash
cd webserver_app
node webserver/webserver-oob.js app
```

2. Open a web browser and navigate to:
```
http://localhost:3000
```

## Deployment

For deployment on AM335x hardware:

1. Install native utilities to `/usr/bin/`:
   - `cpu_stats`
   - `audio_utils`

2. Deploy the web application to `/usr/share/webserver-oob/`

3. Set up systemd service for automatic startup

## Audio Classification Setup

The audio classification demo requires:
- TensorFlow Lite model: `/usr/share/oob-demo-assets/models/yamnet_audio_classification.tflite`
- Label file: `/usr/share/oob-demo-assets/labels/yamnet_label_list.txt`
- GStreamer with NNStreamer plugin support

## License

Copyright (C) 2024 Texas Instruments Incorporated - http://www.ti.com/

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

- Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
- Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
- Neither the name of Texas Instruments Incorporated nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.

## Support

For questions and support, please visit:
- [TI E2E Forums](https://e2e.ti.com/)
- [AM335x Product Page](https://www.ti.com/product/AM3352)