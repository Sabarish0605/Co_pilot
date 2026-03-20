import os
import site

print("--- SEARCHING FOR NVIDIA LIBRARIES ---")
# Check both global and user site-packages
paths = [site.getusersitepackages()]
if hasattr(site, 'getsitepackages'):
    paths.extend(site.getsitepackages())

found = False
for base in paths:
    # Look for the 'nvidia' folder
    nvidia_path = os.path.join(base, "nvidia")
    if os.path.exists(nvidia_path):
        print(f"\n[FOUND] NVIDIA folder at: {nvidia_path}")
        found = True
        # Check for cublas and cudnn specifically
        for lib in ['cublas', 'cudnn']:
            lib_path = os.path.join(nvidia_path, lib, 'bin')
            if os.path.exists(lib_path):
                print(f"  -> Path for {lib} found: {lib_path}")
                dlls = [f for f in os.listdir(lib_path) if f.endswith('.dll')]
                if dlls:
                    print(f"     DLLs inside: {', '.join(dlls[:2])}...")
            else:
                print(f"  -> [MISSING] {lib} bin folder not found in this nvidia directory.")

if not found:
    print("\n[ERROR] Could not find any 'nvidia' folder in your Python site-packages.")
    print("Please try running: pip install nvidia-cublas-cu12 nvidia-cudnn-cu12")
