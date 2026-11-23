#!/usr/bin/env bash
# Downloads the local models Kid Studio uses (all fit an 8 GB NVIDIA card; Kokoro runs on the CPU).
#   bash scripts/download_models.sh [COMFY_DIR]          default COMFY_DIR=$HOME/ComfyUI
set -euo pipefail
PACK=$(cd "$(dirname "$0")/.." && pwd)
COMFY_DIR=${1:-${COMFY_DIR:-$HOME/ComfyUI}}
UP="$COMFY_DIR/models/upscale_models"
KOK="$PACK/models/kokoro"
mkdir -p "$UP" "$KOK"

fetch() {  # fetch <dest> <url> [<fallback url>]
  local dest=$1; shift
  if [ -s "$dest" ]; then echo "ok   $(basename "$dest") (already there)"; return 0; fi
  for url in "$@"; do
    echo "get  $(basename "$dest")  <- $url"
    if curl -fL --retry 3 -o "$dest.part" "$url"; then mv "$dest.part" "$dest"; return 0; fi
  done
  rm -f "$dest.part"; echo "FAIL $(basename "$dest")"; return 1
}

# Upscalers (spandrel / ComfyUI 'Load Upscale Model'): 2x for the default 480p -> ~1080p path, 4x as an alternative
fetch "$UP/RealESRGAN_x2plus.pth" \
  https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth \
  https://huggingface.co/ai-forever/Real-ESRGAN/resolve/main/RealESRGAN_x2.pth
fetch "$UP/4x-UltraSharp.pth" https://huggingface.co/lokCX/4x-Ultrasharp/resolve/main/4x-UltraSharp.pth || true

# Kokoro narration voice (about 340 MB, CPU)
fetch "$KOK/kokoro-v1.0.onnx" https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
fetch "$KOK/voices-v1.0.bin"  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

echo "models ready: $UP, $KOK"
