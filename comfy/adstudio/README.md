# Ad Studio ComfyUI pack

Finishing passes for Seedance takes, called by Ad Studio's shot board ("Finish shot") through ComfyUI's API:

- **workflows/finish_shot.json**: colour match to a reference frame (one grade across shots) → Real-ESRGAN ×2 → 1920 px tall → saved where the app expects it.
- Nodes: `AdStudioColorMatch` (Lab statistics transfer, one transform per clip so it doesn't flicker), `AdStudioSaveTo`. It uses `KidStudioUpscaleVideo` from `comfy/kidstudio`, so install both packs.

Install: `bash comfy/kidstudio/scripts/install_linux.sh` (ComfyUI + kidstudio + models), then `ln -s "$PWD/comfy/adstudio/custom_nodes/adstudio" ~/ComfyUI/custom_nodes/adstudio` and restart ComfyUI. Without ComfyUI the app falls back to an ffmpeg Lanczos upscale (no colour match).
