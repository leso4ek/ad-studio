# MiroFish without Zep Cloud (Ad Studio stage 13)

**Licence: AGPL-3.0.** The files in this folder patch [MiroFish](https://github.com/666ghj/MiroFish), which is AGPL-3.0, so they are AGPL-3.0 as well. Ad Studio itself doesn't import them; it only calls MiroFish's HTTP API.

MiroFish stores its knowledge graph in Zep Cloud, and its build step needs a Zep account. Here, `local_graph.py` takes the Zep client's place with a small SQLite store and does Zep's extraction itself:
- **Extraction:** one JSON call per text chunk, to the same cheap LLM MiroFish is configured with, limited to the graph's ontology.
- **Merging:** nodes with the same name are merged.
- **Search:** BM25 keyword search.

It covers exactly the calls MiroFish makes:
- `graph.create`, `get`, `delete`, `set_ontology`, `add` and `search`;
- `graph.episode.get`;
- `graph.node.get` and `get_edges`;
- paged `get_by_graph_id` for nodes and edges;
- the `batch` API.

| File | What it does |
|---|---|
| `local_graph.py` | The drop-in `LocalZep` client. The database is `~/mirofish/local_graph.db` by default. Extraction cost is logged in its `usage` table. |
| `apply.sh` | Copies the client into `backend/app/utils/`. Adds 4 lines to `get_zep_client()`: with `MIROFISH_LOCAL_GRAPH=1` it returns the local client. Writes `.env` from the template. Safe to run more than once. |
| `env.template` | OpenRouter + a cheap model (DeepSeek v4.1 Flash, $0.03 in / $0.20 out per million tokens), `ZEP_API_KEY=local` (a placeholder, not a key), 5 rounds, low report-agent limits |
| `test_local_graph.py` | Contract test: MiroFish's own `GraphBuilderService`, `ZepEntityReader` and `ZepToolsService` run against the local graph, with no network. |

Install, start and test:

```bash
bash studio/scripts/install_mirofish.sh
```

```bash
bash studio/scripts/start_mirofish.sh
```

```bash
cd ~/mirofish/backend && .venv/bin/python -m pytest -q ~/scifi-explainer-studio/integrations/mirofish/test_local_graph.py
```

What to expect from the tests:
- **With `MIROFISH_LOCAL_GRAPH` unset,** all 129 of MiroFish's own tests pass; the patch does nothing.
- **With it set,** the 3 tests that check the Zep Cloud client's constructor fail, as expected.

**On your PC:** put your OpenRouter key in `~/mirofish/.env` as `LLM_API_KEY=...`. Never commit it.
