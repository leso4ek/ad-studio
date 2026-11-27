#!/usr/bin/env bash
# Hindsight (github.com/vectorize-io/hindsight, MIT) on your own PC: long-term memory for Claude Code in this project.
#   bash scripts/hindsight/install_pc.sh                # LLM = your Claude subscription (claude-code provider, no key)
#   bash scripts/hindsight/install_pc.sh --openrouter   # LLM = OpenRouter (reads OPENROUTER_API_KEY from studio/.env)
# What it does (about 10 min the first time, mostly downloads):
#   1. installs Hindsight into ~/.hindsight/venv (uv; embedded Postgres, local ONNX embeddings, no Docker needed)
#   2. writes ~/.hindsight/env and a start script, and starts the server on http://localhost:8888 (UI: none needed)
#   3. loads this project's memory into the bank "scifi-explainer-studio" (scripts/hindsight/sync_memory.py)
#   4. connects Claude Code to the bank's MCP server (user scope) — tools: retain, recall, reflect, …
# Re-run sync after a work session:  python3 scripts/hindsight/sync_memory.py
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
HS="$HOME/.hindsight"; BANK="scifi-explainer-studio"; PORT=8888
MODE=claude-code; [ "${1:-}" = "--openrouter" ] && MODE=openrouter
mkdir -p "$HS"

command -v uv >/dev/null || { echo "installing uv"; curl -LsSf https://astral.sh/uv/install.sh | sh; export PATH="$HOME/.local/bin:$PATH"; }
[ -x "$HS/venv/bin/hindsight-api" ] || { uv venv -q "$HS/venv" --python 3.12; VIRTUAL_ENV="$HS/venv" uv pip install -q 'hindsight-api-slim[embedded-db,local-onnx]' hindsight-client; }

if [ "$MODE" = claude-code ]; then
  command -v claude >/dev/null || { echo "Claude Code is not installed: npm i -g @anthropic-ai/claude-code, then claude auth login"; exit 1; }
  # Hindsight drives the official Claude Agent SDK with the login you already have (personal machine only).
  VIRTUAL_ENV="$HS/venv" uv pip install -q claude-agent-sdk
  cat > "$HS/env" <<EOF
export HINDSIGHT_API_LLM_PROVIDER=claude-code
export HINDSIGHT_API_LLM_MODEL=claude-haiku-5-5
EOF
else
  KEY="$(grep -E '^OPENROUTER_API_KEY=' "$REPO/studio/.env" 2>/dev/null | cut -d= -f2- || true)"
  [ -n "$KEY" ] || { echo "no OPENROUTER_API_KEY in studio/.env"; exit 1; }
  umask 077; cat > "$HS/env" <<EOF
export HINDSIGHT_API_LLM_PROVIDER=openrouter
export HINDSIGHT_API_LLM_API_KEY=$KEY
export HINDSIGHT_API_LLM_MODEL=deepseek/deepseek-v4.1-flash-1017
EOF
fi
cat >> "$HS/env" <<EOF
export HINDSIGHT_API_EMBEDDINGS_PROVIDER=onnx
export HINDSIGHT_API_RERANKER_PROVIDER=onnx
export HINDSIGHT_API_PORT=$PORT
export HINDSIGHT_API_HOST=127.0.0.1
EOF
cat > "$HS/start.sh" <<EOF
#!/usr/bin/env bash
# starts Hindsight in the background (log: $HS/server.log)
curl -sf http://127.0.0.1:$PORT/health >/dev/null && { echo "Hindsight already running"; exit 0; }
. "$HS/env"; nohup "$HS/venv/bin/hindsight-api" > "$HS/server.log" 2>&1 &
for i in \$(seq 1 120); do curl -sf http://127.0.0.1:$PORT/health >/dev/null && { echo "Hindsight up on :$PORT"; exit 0; }; sleep 2; done
echo "Hindsight did not start: tail $HS/server.log"; exit 1
EOF
chmod +x "$HS/start.sh"; "$HS/start.sh"

python3 "$REPO/scripts/hindsight/sync_memory.py" --url "http://127.0.0.1:$PORT" --bank "$BANK"

if command -v claude >/dev/null; then
  claude mcp remove hindsight -s user >/dev/null 2>&1 || true
  claude mcp add --transport http -s user hindsight "http://127.0.0.1:$PORT/mcp/$BANK/"
fi
echo
echo "Done. Hindsight: http://127.0.0.1:$PORT · MCP: /mcp/$BANK/ · after a reboot run: $HS/start.sh"
echo "In Claude Code, type /mcp to see the hindsight tools."
