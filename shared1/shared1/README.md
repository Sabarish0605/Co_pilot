# AI Voice Agent - Shared Implementation 🤖🔊

A professional, real-time conversational AI voice agent powered by **Deepgram**, **Groq**, and **pyttsx3**.

## 🚀 Features
- **Deepgram STT**: Ultra-low latency real-time transcription.
- **Groq AI (Llama-3)**: Sub-second intelligent responses with conversation memory.
- **pyttsx3 TTS**: Instant, offline voice output on your local machine.
- **Premium UI**: Immersive full-screen interface with a dynamic audio visualizer.

## 🛠️ Setup Instructions

### 1. Backend (Python/FastAPI)
1.  **Enter the Backend folder**: `cd backend`
2.  **Create a Virtual Environment**: `python -m venv venv`
3.  **Activate Venv**:
    - Windows: `.\venv\Scripts\activate`
    - Mac/Linux: `source venv/bin/activate`
4.  **Install Dependencies**: `pip install -r requirements.txt`
5.  **Configure `.env`**: Add your `GROQ_API_KEY`.
6.  **Run Server**: `python app.py`

### 2. Frontend (React/Vite)
1.  **Enter the Frontend folder**: `cd frontend`
2.  **Install Dependencies**: `npm install`
3.  **Run App**: `npm run dev`
4.  **Launch**: Open http://localhost:5173.

### 3. Usage
- Enter your **Deepgram API Key** in the UI.
- Click **Start Assistant** and speak!
- The AI will automatically respond and speak its answer aloud.

## 📁 Core Functionality
- `backend/app.py`: Handles Groq API calls, conversation history, and the local `pyttsx3` voice engine.
- `frontend/src/hooks/useDeepgramStream.js`: Manages the WebSocket connection to Deepgram for live STT.
- `frontend/src/App.jsx`: The immersive, conversation-driven user interface.
