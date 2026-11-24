#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Patches a MiroFish checkout so it runs with no Zep Cloud account:
#   - copies local_graph.py into backend/app/utils/
#   - makes get_zep_client() return the local SQLite graph when MIROFISH_LOCAL_GRAPH=1
# Idempotent; re-run after `git pull` in the MiroFish checkout.
#   bash integrations/mirofish/apply.sh [~/mirofish]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MF="${1:-$HOME/mirofish}"
Z="$MF/backend/app/utils/zep.py"
[ -f "$Z" ] || { echo "no MiroFish backend at $MF" >&2; exit 1; }
cp "$HERE/local_graph.py" "$MF/backend/app/utils/local_graph.py"
if ! grep -q "MIROFISH_LOCAL_GRAPH" "$Z"; then
  python3 - "$Z" <<'PY'
import sys, re
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
anchor = '    """Return a process-shared, explicitly configured Zep Cloud client."""\n'
if anchor not in s:
    sys.exit("get_zep_client docstring not found; MiroFish changed, update apply.sh")
s = s.replace(anchor, anchor + '\n    if os.environ.get("MIROFISH_LOCAL_GRAPH") == "1":  # Ad Studio local-graph patch\n        from .local_graph import get_local_client\n        return get_local_client()\n', 1)
open(p, "w", encoding="utf-8").write(s)
PY
  echo "patched $Z"
else
  echo "already patched: $Z"
fi
# .env from the template if missing (no secrets in it: the key is a placeholder here,
# and on the PC you put your own OpenRouter key into ~/mirofish/.env yourself)
[ -f "$MF/.env" ] || { cp "$HERE/env.template" "$MF/.env"; echo "wrote $MF/.env (edit LLM_API_KEY on the PC)"; }
