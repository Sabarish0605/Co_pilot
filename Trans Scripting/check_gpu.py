import torch
import sys

print("--- GPU DIAGNOSTICS ---")
print(f"Python Version: {sys.version}")
try:
    available = torch.cuda.is_available()
    print(f"GPU Available: {available}")
    if available:
        print(f"Device Name: {torch.cuda.get_device_name(0)}")
        print(f"CUDA Version: {torch.version.cuda}")
    else:
        print("\n[!] TO FIX: Your environment is running on CPU.")
        print("Run this command to enable your NVIDIA GPU:")
        print("pip install torch --index-url https://download.pytorch.org/whl/cu121")
except Exception as e:
    print(f"Torch Error: {e}")
