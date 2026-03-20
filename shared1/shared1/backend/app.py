from fastapi import FastAPI, HTTPException, Body, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
import os
import threading
import queue
import pyttsx3
import subprocess
import sys
import asyncio
from typing import List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Offline STT Management ---
stt_process = None
stt_clients: List[WebSocket] = []
stt_thread = None

async def broadcast_stt(text: str):
    global stt_clients
    message = {"text": text, "isFinal": True, "provider": "offline"}
    disconnected = []
    for client in stt_clients:
        try:
            await client.send_json(message)
        except:
            disconnected.append(client)
    for client in disconnected:
        if client in stt_clients: stt_clients.remove(client)

def run_stt_and_broadcast(loop):
    global stt_process
    # app.py is in shared1/shared1/backend/app.py. Rts.py is in root/Trans Scripting/Rts.py
    # From backend to root is 3 levels up: shared1/shared1/backend -> shared1/shared1 -> shared1 -> root
    rts_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "Trans Scripting", "Rts.py"))
    print(f"[STT] Checking for local engine at {rts_path}", flush=True)
    
    if not os.path.exists(rts_path):
        print(f"[STT] Error: Rts.py not found at {rts_path}", flush=True)
        # Try a fallback to 2 levels deep
        fallback_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Trans Scripting", "Rts.py"))
        if os.path.exists(fallback_path):
             print(f"[STT] Found at fallback: {fallback_path}", flush=True)
             rts_path = fallback_path
        else:
             return

    print(f"[STT] Starting local engine process: {sys.executable} {rts_path}", flush=True)
    stt_process = subprocess.Popen(
        [sys.executable, rts_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    try:
        if stt_process and stt_process.stdout:
            for line in iter(stt_process.stdout.readline, ""):
                if line.startswith(">> "):
                    text = line.replace(">> ", "").strip()
                    if text:
                        print(f"[STT Broadcast] {text}")
                        # Broadcast to all connected clients
                        loop.call_soon_threadsafe(lambda: asyncio.create_task(broadcast_stt(text)))
    except Exception as e:
        print(f"[STT Error] {e}")
    finally:
        if stt_process:
            stt_process.terminate()
            stt_process = None

@app.websocket("/ws/stt")
async def websocket_stt(websocket: WebSocket):
    global stt_thread, stt_clients
    await websocket.accept()
    stt_clients.append(websocket)
    print(f"[WS] Client connected. Active clients: {len(stt_clients)}", flush=True)
    
    # Start STT process if not already running
    if stt_process is None or stt_process.poll() is not None:
        try:
            loop = asyncio.get_running_loop()
            stt_thread = threading.Thread(target=run_stt_and_broadcast, args=(loop,), daemon=True)
            stt_thread.start()
        except Exception as e:
            print(f"[WS] Failed to start STT thread: {e}")
        
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in stt_clients: stt_clients.remove(websocket)
        print("[WS] Client disconnected")
    except Exception as e:
        print(f"[WS Error] {e}")
        if websocket in stt_clients: stt_clients.remove(websocket)

@app.get("/stt/status")
async def get_stt_status():
    is_running = stt_process is not None and stt_process.poll() is None
    return {
        "status": "active" if is_running else "idle",
        "provider": "offline",
        "gpu_info": "Detected" if os.environ.get("CUDA_VISIBLE_DEVICES") else "CPU/GPU"
    }

# Groq Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY and GROQ_API_KEY != "your_groq_key_here" else None

# --- TTS Worker with Queue for stability (prevents blocking API) ---
class TTSWorker:
    def __init__(self):
        self.queue = queue.Queue()
        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()

    def _worker(self):
        while True:
            text = self.queue.get()
            if text is None: break
            try:
                # Re-init for every turn to handle Windows SAPI concurrency
                engine = pyttsx3.init()
                engine.setProperty('rate', 185) 
                engine.setProperty('volume', 1.0)
                voices = engine.getProperty('voices')
                if len(voices) > 1:
                    engine.setProperty('voice', voices[1].id) 
                engine.say(text)
                engine.runAndWait()
                engine.stop()
                del engine
            except Exception as e:
                print(f"[TTS Error] {e}")
            self.queue.task_done()

    def speak(self, text):
        if self.queue.qsize() > 3:
            try:
                while not self.queue.empty():
                    self.queue.get_nowait()
                    self.queue.task_done()
            except: pass
        self.queue.put(text)

# Global TTS Worker
tts_worker = TTSWorker()

# Session-based History
session_histories = {}

class ChatRequest(BaseModel):
    message: str
    sessionId: str = "default"
    context: str = ""

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/chat")
async def chat_with_ai(request: ChatRequest):
    global client
    if not client:
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")
        if GROQ_API_KEY and GROQ_API_KEY != "your_groq_key_here":
            client = Groq(api_key=GROQ_API_KEY)
        else:
            raise HTTPException(status_code=500, detail="Groq API Key not configured")

    if request.sessionId not in session_histories:
        session_histories[request.sessionId] = [
            {
                "role": "system", 
                "content": f"You are a professional telecom customer support agent. Ground your answers ONLY in the provided Customer Context. Do not invent any customer facts. If context is missing for a detail, say you don't have that info.\n\n[CONTEXT]\n{request.context}"
            }
        ]
    else:
        if request.context:
            session_histories[request.sessionId][0]["content"] = f"You are a professional telecom customer support agent. Ground your answers ONLY in the provided Customer Context. Do not invent any customer facts. If context is missing for a detail, say you don't have that info.\n\n[CONTEXT]\n{request.context}"

    history = session_histories[request.sessionId]

    try:
        history.append({"role": "user", "content": request.message})
        if len(history) > 11:
            session_histories[request.sessionId] = [history[0]] + history[-10:]
            history = session_histories[request.sessionId]

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=history,
            max_tokens=150,
            temperature=0.7
        )
        ai_response = completion.choices[0].message.content
        history.append({"role": "assistant", "content": ai_response})
        return {"text": ai_response}
    except Exception as e:
        print(f"Groq API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/speak")
async def speak_text(request: ChatRequest):
    try:
        tts_worker.speak(request.message)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reset")
async def reset_conversation():
    global session_histories
    session_histories = {}
    return {"status": "success", "message": "All session histories cleared"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)