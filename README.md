# WebServer Out-of-Box Demo

A modern web-based demonstration application featuring real-time audio classification, CPU performance monitoring, and system documentation.

## Features

- **Real-time Audio Classification**: Live audio analysis using GStreamer and TensorFlow Lite
- **CPU Performance Monitoring**: Real-time CPU usage tracking with historical graphs
- **System Information**: Hardware and software details display
- **Documentation Hub**: Quick access to documentation and resources

## Directory Structure

```
webserver-oob-demo/
├── webserver_app/
│   ├── app/                  # Frontend web application
│   │   ├── index.html        # Main HTML file
│   │   ├── main.js          # Application JavaScript
│   │   ├── components/      # GUI Composer components
│   │   └── images/          # Board images and assets
│   ├── webserver/           # Backend server
│   │   ├── webserver-oob.js # Express server with WebSocket support
│   │   └── fifo-reader.js   # FIFO reader for audio classification
│   └── linux_app/           # Native C utilities
│       ├── cpu_stats.c      # CPU monitoring utility
│       ├── audio_utils.c    # Audio device management
│       └── Makefile         # Build configuration
└── README.md
```

## Prerequisites

- GStreamer 1.0 with NNStreamer plugin
- ALSA audio support
- C compiler (gcc)

## Getting Started

This repository uses Git submodules for some of its components. To properly clone the repository with all its submodules, use the following commands:

```bash
# Clone the main repository
git clone https://github.com/TexasInstruments/webserver-oob-demo.git

# Navigate to the repository directory
cd webserver-oob-demo

# Initialize and fetch the submodules (components)
git submodule update --init --recursive
```

This will ensure that all necessary components, including the GUI Composer components, are properly downloaded and initialized.

## Building

### Native Utilities

The project includes two native C utilities that need to be compiled:
- `cpu_stats`: Utility for monitoring CPU performance
- `audio_utils`: Utility for audio device management

To build these utilities:

```bash
cd webserver_app/linux_app
make
```

This will compile both utilities using the provided Makefile.

Individual utilities can be built separately if needed:

```bash
# To build only audio_utils
make audio_utils

# To build only cpu_stats
make cpu_stats
```

To clean the build (remove compiled binaries):

```bash
make clean
```

## Running the Application

After building the native utilities copy them to `/usr/bin/`. To launch the application and access the demonstration open your web browser and navigate to:

```
http://<IP-ADDRESS OF THE DEVICE>:3000
```

This will load the web-based interface that interacts with the native utilities for real-time audio classification and CPU performance monitoring.

## Audio Classification Setup

The audio classification demo requires:
- TensorFlow Lite model: Models for audio classification
- Label file: List of classes for classification
- GStreamer with NNStreamer plugin support

## License

This repository is licensed under the TI-TFL License. See the [LICENSE](LICENSE) file for more information.
