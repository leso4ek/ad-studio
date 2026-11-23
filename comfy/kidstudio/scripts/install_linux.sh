#!/usr/bin/env bash
# Kid Studio installer for Linux + NVIDIA (tested target: 8 GB VRAM).
#   bash scripts/install_linux.sh                 installs ComfyUI into $HOME/ComfyUI (or COMFY_DIR=...)
#   TORCH_INDEX=https://download.pytorch.org/whl/cu126 bash scripts/install_linux.sh   for an older driver
# Safe to run again: it skips what is already there.
set -euo pipefail
PACK=$(cd "$(dirname "$0")/.." && pwd)
COMFY_DIR=${COMFY_DIR:-$HOME/ComfyUI}
TORCH_INDEX=${TORCH_INDEX:-https://download.pytorch.org/whl/cu128}

say() { printf '\n== %s\n' "$*"; }
need() { command -v "$1" >/dev/null || { echo "Missing '$1'. $2"; exit 1; }; }

say "Checking the system"
need git "Install it with your package manager (e.g. sudo apt install git)."
need curl "Install it with your package manager (e.g. sudo apt install curl)."
PY=""
for c in python3.12 python3.13 python3.11 python3; do
  if command -v "$c" >/dev/null && "$c" -c 'import sys; sys.exit(not ((3,10) <= sys.version_info[:2] <= (3,13)))'; then PY=$c; break; fi
done
[ -n "$PY" ] || { echo "Python 3.10-3.13 is needed (e.g. sudo apt install python3.12 python3.12-venv)."; exit 1; }
"$PY" -m venv --help >/dev/null 2>&1 || { echo "The venv module is missing (e.g. sudo apt install python3-venv)."; exit 1; }
if command -v nvidia-smi >/dev/null; then
  nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
else
  echo "WARNING: nvidia-smi not found. ComfyUI will still run (OpenRouter does the heavy work), but local upscaling will be slow on the CPU."
fi
echo "python: $($PY -V)   ComfyUI dir: $COMFY_DIR   torch index: $TORCH_INDEX"

say "ComfyUI"
if [ ! -d "$COMFY_DIR/.git" ]; then git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git "$COMFY_DIR"; else echo "already cloned"; fi
[ -x "$COMFY_DIR/.venv/bin/python" ] || "$PY" -m venv "$COMFY_DIR/.venv"
VPY="$COMFY_DIR/.venv/bin/python"
"$VPY" -m pip install -q --upgrade pip
if ! "$VPY" -c 'import torch, sys; sys.exit(not torch.cuda.is_available())' 2>/dev/null; then
  "$VPY" -m pip install torch torchvision torchaudio --index-url "$TORCH_INDEX"
fi
"$VPY" -m pip install -q -r "$COMFY_DIR/requirements.txt"
"$VPY" -c 'import torch; print("torch", torch.__version__, "CUDA:", torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "")'

say "Custom nodes"
CN="$COMFY_DIR/custom_nodes"
[ -d "$CN/comfyui-manager" ] || git clone --depth 1 https://github.com/Comfy-Org/ComfyUI-Manager.git "$CN/comfyui-manager"
[ -d "$CN/ComfyUI-VideoHelperSuite" ] || git clone --depth 1 https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git "$CN/ComfyUI-VideoHelperSuite"
"$VPY" -m pip install -q -r "$CN/comfyui-manager/requirements.txt" || true
"$VPY" -m pip install -q -r "$CN/ComfyUI-VideoHelperSuite/requirements.txt"
ln -sfn "$PACK/custom_nodes/kidstudio" "$CN/kidstudio"
"$VPY" -m pip install -q -r "$PACK/custom_nodes/kidstudio/requirements.txt"

say "Settings"
if [ ! -f "$PACK/.env" ]; then cp "$PACK/.env.example" "$PACK/.env"; chmod 600 "$PACK/.env"; echo "created $PACK/.env"; fi
grep -q '^OPENROUTER_API_KEY=.\+' "$PACK/.env" && echo "OpenRouter key: set" || echo "OpenRouter key: NOT SET yet -> open $PACK/.env in an editor and paste it after OPENROUTER_API_KEY="

say "Local models"
bash "$PACK/scripts/download_models.sh" "$COMFY_DIR"

say "Launcher"
cat > "$PACK/scripts/start_comfy.sh" <<EOF
#!/usr/bin/env bash
# Starts ComfyUI with Kid Studio on http://127.0.0.1:8188  (KIDSTUDIO_MOCK=1 for free test mode)
cd "$COMFY_DIR" && exec "$VPY" main.py --listen 127.0.0.1 --port \${PORT:-8188} "\$@"
EOF
chmod +x "$PACK/scripts/start_comfy.sh"
echo "start with: bash $PACK/scripts/start_comfy.sh   then open http://127.0.0.1:8188"

say "Done"
echo "Next: README-LOCAL.md, step 3 (the free mock test), then the real 4-second test."
