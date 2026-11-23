#!/usr/bin/env bash
# Starts Ad Studio on http://127.0.0.1:${PORT:-5170} (install_linux.sh rewrites this with absolute paths)
# NODE_USE_ENV_PROXY: Node's fetch then honours HTTPS_PROXY when one is set (corporate networks, cloud sandboxes)
cd "$(dirname "$0")/.." && NODE_USE_ENV_PROXY=1 exec node server/main.mjs
