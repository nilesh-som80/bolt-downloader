# Bolt Downloader ⚡️

![Downloads](https://img.shields.io/github/downloads/nilesh-som80/bolt-downloader/total?style=for-the-badge&color=blue&label=Total%20Downloads) ![Version](https://img.shields.io/github/v/release/nilesh-som80/bolt-downloader?style=for-the-badge&label=Latest%20Version&color=purple)

[**Download Latest Release**](https://github.com/nilesh-som80/bolt-downloader/releases/latest)

**Bolt Downloader** is a high-performance, cross-platform download manager built with Electron, React, and TypeScript. It features a modern, clean UI and utilizes advanced chunking algorithms to accelerate downloads up to 800% faster (reaching speeds of 30-35 MB/s on standard connections).

## 🚀 Features

*   **⚡️ Blazing Fast Speeds**: Uses multi-threaded chunking (8-32 connections per file) to maximize bandwidth.
*   **💎 Modern UI**: Clean, dark-mode first design inspired by glassmorphism and modern web aesthetics.
*   **🛠 Cross-Platform**: Runs natively on macOS, Windows, and Linux.
*   **📋 Smart Clipboard**: Automatically detects URLs from your clipboard (Cmd+V) and suggests filenames.
*   **📊 Detailed Stats**: Real-time speed graphs, estimated time remaining, and individual chunk visualization.
*   **⏯ Resume Capability**: robustly handles network interruptions and resumes broken downloads.

## 🛠 Tech Stack

*   **Electron**: Main process backend.
*   **React + Vite**: Fast frontend performance.
*   **TypeScript**: Type-safe codebase.
*   **TailwindCSS**: Utilitarian styling.
*   **Better-SQLite3**: Persistent download history.


## 📦 Build & Run

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
# Build for all platforms (macOS, Windows, Linux)
npm run build:all

# Specific platforms
npm run build:mac
npm run build:win
npm run build:linux
```
