# Deepgram Real-Time STT - Shareable Feature

This folder contains everything you need to implement real-time, word-by-word speech-to-text transcription using Deepgram's `nova-3` model.

## 🚀 Quick Start

1.  **Extract** this `share` folder into your project.
2.  **Install Dependencies**:
    ```bash
    npm install lucide-react framer-motion
    ```
3.  **Setup Files**:
    - Copy `useDeepgramStream.js` into your `src/hooks/` folder.
    - Copy `App.jsx` content into your main component.
    - Copy `index.css` styles into your global CSS.

## 🛠️ Usage
1. Get a **Deepgram API Key** from [console.deepgram.com](https://console.deepgram.com).
2. Run your app (`npm run dev`).
3. Enter the API Key in the UI and click **Start Conversation**.

## 📁 File Structure
- `src/hooks/useDeepgramStream.js`: The core logic for WebSocket connection and Audio capture (16kHz PCM).
- `src/App.jsx`: The premium, cinematic UI with visualizer.
- `src/index.css`: Glassmorphism and animation styles.
