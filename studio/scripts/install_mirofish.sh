#!/usr/bin/env bash
# Installs MiroFish (github.com/666ghj/MiroFish, AGPL-3.0) as a separate local service for the audience test
# (stage 13), outside this repo, and applies the local-graph patch so it needs no Zep Cloud account.
#   bash studio/scripts/install_mirofish.sh [dir]     (default ~/mirofish; Python 3.11/3.12 + uv; ~7 GB with torch)
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
MF="${1:-$HOME/mirofish}"
command -v uv >/dev/null || { echo "installing uv"; curl -LsSf https://astral.sh/uv/install.sh | sh; export PATH="$HOME/.local/bin:$PATH"; }
[ -d "$MF/.git" ] || git clone --depth 1 https://github.com/666ghj/MiroFish.git "$MF"
PY="$(command -v python3.12 || command -v python3.11 || true)"
(cd "$MF/backend" && uv sync ${PY:+--python "$PY"})
bash "$REPO/integrations/mirofish/apply.sh" "$MF"
echo "MiroFish ready in $MF. On your PC put your OpenRouter key in $MF/.env (LLM_API_KEY=...)."
echo "Start it with: bash studio/scripts/start_mirofish.sh"
