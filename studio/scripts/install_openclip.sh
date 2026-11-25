#!/usr/bin/env bash
# Ad Studio · install OpenClip (linzzzzzz/openclip, MIT) as its own tool in ~/openclip, outside this repo.
# The clipper calls its CLI (video_orchestrator.py) for normal videos; stream clips use our chat layer first.
# Needs: git, ffmpeg (libass for burned subtitles), uv (installed here if missing). An LLM key: OPENROUTER_API_KEY.
set -euo pipefail
DIR="${OPENCLIP_DIR:-$HOME/openclip}"
STUDIO="$(cd "$(dirname "$0")/.." && pwd)"
command -v uv >/dev/null 2>&1 || { python3 -m pip install --user -q uv || pipx install uv; }
export PATH="$HOME/.local/bin:$PATH"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull -q --ff-only || true; else git clone -q --depth 1 https://github.com/linzzzzzz/openclip "$DIR"; fi
cd "$DIR"
# uv picks the PyTorch build for this machine (set UV_TORCH_BACKEND=cpu for a smaller CPU-only install when
# download.pytorch.org is reachable)
uv sync || echo "OpenClip: uv sync failed (see above); the clipper falls back to its own transcript ranking"
uv run python video_orchestrator.py --help >/dev/null 2>&1 && echo "OpenClip ready in $DIR" || true
# chat replay (Twitch, YouTube) for the stream clipper: chat-downloader (MIT) in Ad Studio's own tools venv
set +e
python3 -m venv "$STUDIO/.tools/chatenv" && "$STUDIO/.tools/chatenv/bin/pip" install -q -U chat-downloader yt-dlp && echo "chat-downloader ready"
