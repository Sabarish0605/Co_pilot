import sounddevice as sd
import numpy as np
import queue
import threading
from faster_whisper import WhisperModel
import os
import sys

# --- 🛠️ 1. WINDOWS STORE PYTHON GPU FIX ---
# This fixes the "cublas64_12.dll not found" error by manually adding the DLL paths.
def fix_dll_loading():
    import site
    # Detect both global and user site-packages for NVIDIA libraries
    paths = [site.getusersitepackages()]
    if hasattr(site, 'getsitepackages'):
        paths.extend(site.getsitepackages())
    
    for base in paths:
        nvidia_path = os.path.join(base, "nvidia")
        if os.path.exists(nvidia_path):
            for lib in ['cublas', 'cudnn']:
                p = os.path.join(nvidia_path, lib, 'bin')
                if os.path.exists(p):
                    try:
                        os.add_dll_directory(p)
                        # print(f"Added DLL directory: {p}")
                    except Exception:
                        pass

fix_dll_loading()

# --- ⚙️ 2. SETTINGS ---
samplerate = 16000
block_duration = 0.5  # Capture 0.5s audio blocks
chunk_duration = 5.0  # Total chunk analyzed (includes overlap)
overlap_duration = 1.5 # 1.5s of overlap for better context
channels = 1 

frames_per_block = int(samplerate * block_duration)
frames_per_chunk = int(samplerate * chunk_duration)

audio_queue = queue.Queue()
audio_buffer = []

# --- 🧠 3. ELITE ACCURACY MODEL SETUP ---
try:
    import torch
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
    else:
        gpu_name = "CPU (CUDA not detected)"
except ImportError:
    gpu_name = "CPU (Torch not installed)"
print(f"⏳ Loading ELITE Accuracy Model (large-v3) on {gpu_name}...")

try:
    model = WhisperModel("large-v3", device="cuda", compute_type="float16")
    print(f"🚀 Running on NVIDIA GPU ({gpu_name}) with FULL large-v3")
except Exception as e:
    print(f"⚠️ large-v3 setup failed, trying distil-large-v3: {e}")
    try:
        model = WhisperModel("distil-large-v3", device="cuda", compute_type="float16")
    except:
        model = WhisperModel("medium.en", device="cpu", compute_type="int8")

def audio_callback(indata, frames, time, status):
    if status:
        print(f"⚠️ {status}")
    audio_queue.put(indata.copy())

def recorder():
    try:
        with sd.InputStream(samplerate=samplerate, channels=channels, 
                             callback=audio_callback, blocksize=frames_per_block):
            print("\n🎙️ READY: Listening to your voice...")
            print("Action: Start speaking. Press Ctrl+C to stop.\n")
            while True:
                sd.sleep(100)
    except Exception as e:
        print(f"\n❌ MICROPHONE ERROR: {e}")
        os._exit(1)

# Keep track of last text to prevent repeating hallucinations
last_text = ""

# --- 🔇 SILENCE STRIPPER SETTINGS ---
# Adjust ENERGY_THRESHOLD if it skips your voice (try 0.005 to 0.02)
ENERGY_THRESHOLD = 0.002 

def transcriber():
    global audio_buffer, last_text
    while True:
        try:
            # Wait for audio blocks
            block = audio_queue.get(timeout=1)
            audio_buffer.append(block)
        except queue.Empty:
            continue

        total_frames = sum(len(b) for b in audio_buffer)
        
        # Once we have enough audio for a chunk
        if total_frames >= frames_per_chunk:
            combined = np.concatenate(audio_buffer)
            audio_data = combined[:frames_per_chunk].flatten().astype(np.float32)
            
            # --- 🛋️ SLIDING WINDOW OVERLAP ---
            # We keep the last 1.0s of the current chunk as starting point for next one
            overlap_frames = int(samplerate * overlap_duration)
            leftover = combined[frames_per_chunk - overlap_frames:]
            audio_buffer = [leftover]

            # --- 🔇 STEP 1: PRE-FILTER SILENCE (REMOVED FOR SENSITIVITY) ---
            # We used to calculate RMS here, but it's safer to let Whisper's VAD
            # handle it internally to ensure no words are missed.
            # print(f"Processing... (Level: {np.sqrt(np.mean(audio_data**2)):.4f})")
            # --- 🛠️ STEP 2: MAXIMUM ACCURACY TRANSCRIPTION (SLIDING WINDOW) ---
            print("⏳", end="\r", flush=True) # Thinking indicator
            segments, info = model.transcribe(
                audio_data, 
                language="en", 
                beam_size=5,            
                vad_filter=True,        
                vad_parameters=dict(
                    threshold=0.4,               # Robust voice detection
                    min_silence_duration_ms=1000 # Wait for 1s pause before splitting
                ),
                initial_prompt="A professional telecom conversation by Sabaris. Terms: VoIP, SIP, 5G, LTE, Fiber, Broadband, Prepaid, Postpaid, Madurai, Ayuttham.", 
                condition_on_previous_text=True
            )

            for segment in segments:
                text = segment.text.strip()
                
                # --- 🛑 REPEAT KILLER & HALLUCINATION FILTER ---
                # Check if this text is basically something we've already printed
                if not text or text.lower() in last_text.lower():
                    continue
                
                avg_logprob = segment.avg_logprob
                no_speech_prob = segment.no_speech_prob
                
                # ELITE thresholds - Re-enabled and tuned to stop hallucinations
                if avg_logprob < -1.0 or no_speech_prob > 0.5:
                    continue 

                # Common hallucinations - REFINED
                noise_patterns = [
                    "thank you for watching", "subtitles by", "thanks for watching", 
                    "i'll see you in the next one", "please subscribe",
                    "amara.org", "ok, beep, beep, beep."
                ]
                
                if any(p in text.lower() for p in noise_patterns):
                    continue

                if text:
                    print(f">> {text}", flush=True)
                    last_text = text

# Start the recording thread
threading.Thread(target=recorder, daemon=True).start()

# Run the transcriber in the main thread
try:
    transcriber()
except KeyboardInterrupt:
    print("\n🛑 Stopped by user.")
