#!/usr/bin/env bash
# Ad Studio installer (Linux). Safe to run again.
#   bash studio/scripts/install_linux.sh                 library + Kokoro + Whisper + the app
#   bash studio/scripts/install_linux.sh --voicestudio   also install VoiceStudio (third-party installer from voicestudio.sh; ask the user first)
#   bash studio/scripts/install_linux.sh --comfy         also install ComfyUI (reuses comfy/kidstudio's installer; optional photo cleanup)
set -euo pipefail
STUDIO=$(cd "$(dirname "$0")/.." && pwd); REPO=$(dirname "$STUDIO")
VS=0; CF=0; for a in "$@"; do case $a in --voicestudio) VS=1;; --comfy) CF=1;; esac; done
say() { printf '\n== %s\n' "$*"; }
need() { command -v "$1" >/dev/null || { echo "Missing '$1'. $2"; exit 1; }; }

say "Checking the system"
need git "sudo apt install git"; need curl "sudo apt install curl"; need python3 "sudo apt install python3 python3-venv"
need node "Install Node 20+ (e.g. from nodesource or nvm)"
node -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)' || { echo "Node 20+ is needed (found $(node -v))."; exit 1; }
command -v ffprobe >/dev/null || echo "WARNING: ffprobe not found (sudo apt install ffmpeg): used to probe the finished files. The master ffmpeg 9 comes from imageio-ffmpeg automatically."
if command -v claude >/dev/null; then echo "Claude Code: $(claude --version)"; else echo "WARNING: the 'claude' CLI is not on PATH: decisions will wait in the decision inbox until a Claude session answers them."; fi
command -v nvidia-smi >/dev/null && nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || echo "No NVIDIA GPU found: the 2D styles are fine; Toy 3D renders slowly on the CPU."

say "Lemo-Opuscar library, skills, styles, Kokoro + Whisper"
sh "$REPO/scripts/bootstrap.sh"

say "Ad Studio app"
cd "$STUDIO" && npm install --no-audit --no-fund && npm run build
[ -f "$STUDIO/.env" ] || { cp "$STUDIO/.env.example" "$STUDIO/.env"; chmod 600 "$STUDIO/.env"; echo "created studio/.env (keys go there, never in a chat)"; }
node --test "$STUDIO"/tests/*.test.mjs >/dev/null && echo "unit tests: pass"

if [ "$VS" = 1 ]; then
  say "VoiceStudio (debpalash/voicestudio, AGPL-3.0: Ad Studio only calls its local API)"
  if curl -fsS --max-time 2 http://127.0.0.1:3900/health >/dev/null 2>&1; then echo "already running on :3900"
  else curl -fsSL https://voicestudio.sh/install | sh; echo "Start VoiceStudio once, download a voice model in its Model Manager, then Ad Studio uses it first."; fi
fi
if [ "$CF" = 1 ]; then say "ComfyUI (optional product-photo cleanup)"; bash "$REPO/comfy/kidstudio/scripts/install_linux.sh"; fi

cat > "$STUDIO/scripts/start_studio.sh" <<EOS
#!/usr/bin/env bash
# Starts Ad Studio on http://127.0.0.1:\${PORT:-5170}
cd "$STUDIO" && exec node server/main.mjs
EOS
chmod +x "$STUDIO/scripts/start_studio.sh"
say "Done"
echo "start:  bash $STUDIO/scripts/start_studio.sh   then open http://127.0.0.1:5170"
