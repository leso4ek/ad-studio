#!/usr/bin/env bash
# Starts Ad Studio on http://127.0.0.1:${PORT:-5170} (install_linux.sh rewrites this with absolute paths)
# NODE_USE_ENV_PROXY: Node's fetch then honours HTTPS_PROXY when one is set (corporate networks, cloud sandboxes)
# Hindsight (scripts/hindsight/install_pc.sh): when it answers on :8888, new lessons are mirrored into its bank
if [ -z "${HINDSIGHT_URL:-}" ] && curl -sf --max-time 2 http://127.0.0.1:8888/health >/dev/null 2>&1; then export HINDSIGHT_URL=http://127.0.0.1:8888; fi
cd "$(dirname "$0")/.." && NODE_USE_ENV_PROXY=1 NO_PROXY="${NO_PROXY:-}${NO_PROXY:+,}127.0.0.1,localhost" exec node server/main.mjs
