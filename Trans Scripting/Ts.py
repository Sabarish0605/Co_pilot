import os
import site
from faster_whisper import WhisperModel

# --- 🛠️ DYNAMIC DLL LOADING FIX ---
def fix_dll_loading():
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
                    except Exception:
                        pass

fix_dll_loading()

# --- ⚙️ MODEL SETUP ---
model_size = "large-v3"
print(f"⏳ Loading {model_size} on GPU for maximum accuracy...")
model = WhisperModel(model_size, device="cuda", compute_type="float16")

print("🎙️ Transcribing audio.mp3...")
segments, _ = model.transcribe("audio.mp3", language="en", beam_size=5)

print("\n--- TRANSCRIPTION RESULT ---")
for segment in segments:
    print(f"[{segment.start:5.2f}s -> {segment.end:5.2f}s] {segment.text}")