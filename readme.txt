# SoundCraft


**SoundCraft** is an interactive web application for audio processing and analysis, leveraging Fourier Transform algorithms to analyze and manipulate audio files in real-time. Built with React, TypeScript, and the Web Audio API, it offers a sleek interface to upload, visualize, and enhance audio with effects like noise reduction, pitch shifting, and volume control. Perfect for audio enthusiasts, developers, or anyone curious about NLP and audio processing, SoundCraft runs entirely in the browser—no external APIs or keys required.



## Table of Contents

- [About the Project](#about-the-project)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## About the Project

SoundCraft is designed to make audio processing accessible and engaging. Upload an audio file, visualize its waveform and frequency spectrum, analyze its properties (pitch, amplitude, clarity), and apply effects to enhance or transform the sound. Whether you’re tweaking speech recordings or experimenting with audio effects, SoundCraft delivers a seamless experience with real-time feedback. Its use of Fourier Transform algorithms enables precise analysis, while the Web Audio API ensures high-quality, non-destructive effects.

The project was developed as an exploration of audio processing and basic NLP, focusing on client-side computation to keep things fast, private, and dependency-free.

## Features

- **Audio Upload**: Supports `.wav`, `.mp3`, `.ogg`, and `.aac` formats.
- **Real-Time Visualizations**:
  - Waveform display in vibrant `#00ffcc`.
  - Frequency spectrum in `#33ccff`.
- **Audio Analysis**:
  - Pitch detection (e.g., 260 Hz).
  - Amplitude measurement (e.g., 5.66%).
  - Speech clarity scoring (e.g., 90%).
  - Phoneme detection (e.g., a, r, g).
  - Sentiment estimation (e.g., angry at 80% confidence).
- **Audio Effects**:
  - Noise reduction with smooth thresholding (0–100%).
  - Pitch shifting (±6 semitones) with phase smoothing.
  - Volume adjustment (0–200%) using Web Audio API’s `GainNode`.
- **Reset Functionality**: Revert to original audio instantly.
- **Export**: Save processed audio as `.wav`.
- **Offline Operation**: No external APIs or keys needed.

## Tech Stack

- **Frontend**:
  - React (`18.x`)
  - TypeScript (`5.x`)
  - Tailwind CSS (`3.x`)
- **Audio Processing**:
  - Web Audio API (native browser API)
  - `fft-js` (Fourier Transform calculations)
- **Visualization**:
  - `wavesurfer.js` (`7.x`) for waveform and spectrum rendering
- **Icons**:
  - `lucide-react` (`0.3.x`) for UI icons
- **Build Tools**:
  - Vite (`5.x`) for fast development and builds
  - PostCSS (`8.x`) and Autoprefixer (`10.x`) for CSS processing
- **Linting & Formatting**:
  - ESLint (`8.x`) for code quality
  - Prettier (`3.x`) for consistent formatting

## Prerequisites

To set up and run SoundCraft, you’ll need:

- **Node.js**: Version 16 or higher ([Download](https://nodejs.org/)).
- **npm**: Comes with Node.js, or use **yarn** if preferred ([Install Yarn](https://yarnpkg.com/)).
- **Git**: For cloning the repository ([Download](https://git-scm.com/)).
- **Browser**: Chrome (recommended) or any modern browser supporting Web Audio API.
- Optional: A code editor like VS Code ([Download](https://code.visualstudio.com/)).

Verify Node.js installation:

```bash
node -v
npm -v
 
Install all dependencies :

npm install


Project Structure

SOUND-CRAFT-USING-NLP-WITH-FOURIER-TRANFORM-ALGORITHM/ Lalana-09
├── public/
│   └── index.html           # HTML entry point
├── src/
│   ├── hooks/
│   │   └── useAudioAnalyzer.ts  # Audio state and logic
│   ├── utils/
│   │   ├── audioProcessor.ts    # Audio processing (FFT, effects)
│   │   └── debug.ts             # Debugging utilities
│   ├── App.tsx                  # Main React component
│   ├── index.css                # Tailwind CSS styles
│   └── main.tsx                 # React app entry
├── .eslintrc.cjs                # ESLint configuration
├── postcss.config.cjs           # PostCSS configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite configuration
├── package.json                 # Dependencies and scripts
└── README.md                    # Project documentation