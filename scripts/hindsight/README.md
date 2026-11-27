# Hindsight: long-term memory for this project

[Hindsight](https://github.com/vectorize-io/hindsight) (MIT) is a memory server. It stores facts, experiences and lessons, and lets any agent recall them. Every Claude Code session reaches it through MCP.

## On your PC (about 10 min, once)
```bash
bash scripts/hindsight/install_pc.sh
```
1. **Installs** Hindsight into `~/.hindsight/` with no Docker: embedded Postgres and local ONNX embeddings.
2. **LLM:** uses your Claude login (`claude-code` provider, Haiku 5.5). `--openrouter` uses the OpenRouter key in `studio/.env` instead.
3. **Starts** the server on `http://127.0.0.1:8888`. After a reboot: `~/.hindsight/start.sh`.
4. **Loads the memory** into the bank `scifi-explainer-studio`:
   - user rules;
   - CLAUDE.md by section;
   - our skills;
   - Ad Studio lessons;
   - every REPORT/SUMMARY.
5. **Connects Claude Code:** `claude mcp add --transport http -s user hindsight http://127.0.0.1:8888/mcp/scifi-explainer-studio/`.

## Keeping it in sync
- `python3 scripts/hindsight/sync_memory.py` re-sends only the documents that changed (hashes in `.synced.json`, gitignored).
- `--dry-run` lists them.
- The studio app mirrors every new lesson automatically when Hindsight answers on :8888 (`start_studio.sh` sets `HINDSIGHT_URL`).

## Tested in the cloud (27 Nov 2026)
- **Setup:** Hindsight 1.3.0 slim with OpenRouter `deepseek/deepseek-v4.1-flash-1017`, ONNX embeddings and the `rrf` reranker.
- **Sync:** all 79 documents went in.
- **Checks:**
  - recall of "how should replies be written?" returned the ADHD reply rules first;
  - the MCP endpoint `initialize` answers.
- **Root:** embedded Postgres refuses to run as root, so a cloud test needs a non-root user. On your PC this does not apply.
