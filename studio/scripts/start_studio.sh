#!/usr/bin/env bash
# Starts Ad Studio on http://127.0.0.1:${PORT:-5170} (install_linux.sh rewrites this with absolute paths)
cd "$(dirname "$0")/.." && exec node server/main.mjs
