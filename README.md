# WiFi Link & Latency Monitor

A lightweight Linux desktop app that graphs Wi‑Fi link quality and network latency over time.

Built with Electron, React, and TypeScript. It continuously samples Wi‑Fi metrics from `iw` and runs background pings to one or more hosts so you can correlate signal / link rate changes with latency spikes and packet loss.

## What it shows

- **Signal strength** (dBm)
- **RX / TX bitrate** (MBit/s)
- **Channel width / bandwidth** (MHz, when available from `iw`)
- **Ping latency per host** (ms), including failure periods
- **Channel congestion heatmap** (networks per channel over time)

## Features

- Multi-plot dashboard (Signal, Ping, RX/TX, Bandwidth)
- Channel congestion heatmap with historical data (7/14/30 days)
- Auto-detection of 2.4GHz and 5GHz bands
- Automatic network scanning on launch and hourly
- Time window presets: 10m / 30m / 60m / 4h / 1D / ∞
- Adjustable refresh interval (500ms - 5s)
- Pause/Resume updates
- Add/remove ping targets (IP or domain)
- Auto-detection of default gateway
- 90-day scan data retention with automatic cleanup

## Requirements

### System

- Linux
- Node.js 18+

### System tools

- `iw`
- `ip` (iproute2)
- `ping` (iputils)
- `nmcli` (NetworkManager, for channel scanning)

## Installation

```bash
# Clone the repository
git clone git@github.com:vdpopov/Wireless-Link-Quality-Dashboard-Electron.git
cd Wireless-Link-Quality-Dashboard-Electron

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package the app
npm run package
```

## Run

After installation, run:

```bash
npm run dev
```

On startup, you'll be prompted to choose a wireless interface.

## How it works (high level)

1. **Wi‑Fi metrics** are parsed from:
   ```
   iw dev <iface> link
   ```

2. **Default gateway** is detected from:
   ```
   ip route
   ```

3. **Ping latency** is collected by spawning:
   ```
   ping -c 1 -W 1 <host>
   ```

4. **Channel scanning** uses:
   ```
   nmcli device wifi rescan
   iw dev <iface> scan dump
   ```

## Tech Stack

- **Electron** - Desktop application framework
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool with HMR
- **uPlot** - Lightweight charting
- **Zustand** - State management
- **TailwindCSS** - Styling

## Notes / limitations

- This tool is intended for local diagnostics on a machine you control.
- Linux only (relies on `iw`, `nmcli`, and other Linux-specific tools).
- Some Wi‑Fi drivers/APs may not report all fields (e.g., bandwidth), in which case those points will appear as gaps.
- Channel scanning requires NetworkManager to be running.
