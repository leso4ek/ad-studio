#!/usr/bin/env bash
# Starts the patched MiroFish backend on 127.0.0.1:5001 (log: <dir>/backend.log). Re-applies the patch first,
# so a `git pull` in the MiroFish folder never silently switches it back to Zep Cloud.
#   bash studio/scripts/start_mirofish.sh [dir]
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
MF="${1:-$HOME/mirofish}"
bash "$REPO/integrations/mirofish/apply.sh" "$MF" >/dev/null
if curl -fs http://127.0.0.1:5001/health >/dev/null 2>&1; then echo "MiroFish already running"; exit 0; fi
# behind the cloud session's proxy the Python clients need its CA bundle
[ -f /root/.ccr/ca-bundle.crt ] && export SSL_CERT_FILE=/root/.ccr/ca-bundle.crt REQUESTS_CA_BUNDLE=/root/.ccr/ca-bundle.crt
# tokenizer files are fetched once from openaipublic.blob.core.windows.net, then read from here
export TIKTOKEN_CACHE_DIR="$MF/tiktoken_cache"; mkdir -p "$TIKTOKEN_CACHE_DIR"
cd "$MF/backend"
FLASK_HOST=127.0.0.1 nohup .venv/bin/python run.py > "$MF/backend.log" 2>&1 &
for _ in $(seq 1 40); do curl -fs http://127.0.0.1:5001/health >/dev/null 2>&1 && { echo "MiroFish up on :5001"; exit 0; }; sleep 1; done
echo "MiroFish did not start; see $MF/backend.log" >&2; exit 1
