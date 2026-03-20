from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
import os
import pyttsx3
import threading
import queue
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

# Groq Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY and GROQ_API_KEY != "your_groq_key_here" else None

# Conversation Memory (Simple Session Management)
# In a real app, you'd use a more robust store indexed by session ID
conversation_history = [
    {
        "role": "system", 
        "content": "You are a professional telecom customer support agent. Answer clearly, politely, and keep responses concise (under 2 sentences). This is for a real-time voice interface."
    }
]

# TTS Worker Logic
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
                # Re-initialize for every speech to prevent hanging on Windows
                engine = pyttsx3.init()
                engine.setProperty('rate', 175)
                engine.setProperty('volume', 1.0)
                
                engine.say(text)
                engine.runAndWait()
                # Properly stop the engine
                engine.stop()
                del engine
            except Exception as e:
                print(f"TTS Error: {e}")
            self.queue.task_done()

    def speak(self, text):
        self.queue.put(text)

# Global TTS Worker
tts_worker = TTSWorker()

class ChatRequest(BaseModel):
    message: str

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/chat")
async def chat_with_ai(request: ChatRequest):
    global client, conversation_history
    
    # Re-initialize client if API key was added after startup
    if not client:
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")
        if GROQ_API_KEY and GROQ_API_KEY != "your_groq_key_here":
            client = Groq(api_key=GROQ_API_KEY)
        else:
            raise HTTPException(status_code=500, detail="Groq API Key not configured")

    try:
        # Add user message to history
        conversation_history.append({"role": "user", "content": request.message})
        
        # Keep history manageable (last 10 messages)
        if len(conversation_history) > 11: # system + 10
            conversation_history = [conversation_history[0]] + conversation_history[-10:]

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=conversation_history,
            max_tokens=150,
            temperature=0.7
        )
        
        ai_response = completion.choices[0].message.content
        
        # Add assistant message to history
        conversation_history.append({"role": "assistant", "content": ai_response})
        
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
    global conversation_history
    conversation_history = [conversation_history[0]]
    return {"status": "success", "message": "Conversation history cleared"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)