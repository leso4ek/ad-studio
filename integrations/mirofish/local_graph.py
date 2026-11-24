# SPDX-License-Identifier: AGPL-3.0-only
# A local, SQLite-backed stand-in for the Zep Cloud client that MiroFish
# (github.com/666ghj/MiroFish, AGPL-3.0) uses. It is copied into
# MiroFish's backend/app/utils/ by apply.sh and is therefore distributed under
# MiroFish's licence. Ad Studio never imports it; it talks to MiroFish over HTTP.
#
# It implements exactly the Zep surface MiroFish calls (measured against the
# MiroFish main branch, Nov 2026):
#   graph.create/get/delete/set_ontology/add/search
#   graph.episode.get, graph.node.get/get_edges
#   graph.node|edge.with_raw_response.get_by_graph_id (paged, zep-next-cursor)
#   batch.create/add/process/get/list/list_items
# Zep's server-side entity/relation extraction is done here with the same
# OpenAI-compatible LLM MiroFish is configured with (one JSON call per chunk,
# constrained to the graph's ontology). Search is BM25 keyword ranking.
from __future__ import annotations

import json
import math
import os
import re
import sqlite3
import threading
import uuid as _uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from types import SimpleNamespace as NS
from typing import Any

try:  # the real SDK type, so MiroFish's `except NotFoundError` catches ours
    from zep_cloud import NotFoundError as _ZepNotFound

    def _not_found(what: str) -> Exception:
        return _ZepNotFound(body={"message": f"{what} not found"})
except Exception:  # pragma: no cover - zep-cloud missing
    class _ZepNotFound(Exception):
        pass

    def _not_found(what: str) -> Exception:
        return _ZepNotFound(f"{what} not found")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    return str(_uuid.uuid4())


_SCHEMA = """
create table if not exists graphs(id text primary key, name text, description text, ontology text, created_at text);
create table if not exists episodes(uuid text primary key, graph_id text, data text, metadata text, created_at text, processed int);
create table if not exists nodes(uuid text primary key, graph_id text, name text, key text, labels text, summary text, attributes text, created_at text);
create index if not exists nodes_g on nodes(graph_id, key);
create table if not exists edges(uuid text primary key, graph_id text, name text, fact text, src text, tgt text, attributes text, created_at text, valid_at text, episodes text);
create index if not exists edges_g on edges(graph_id);
create table if not exists batches(batch_id text primary key, metadata text, status text, created_at text);
create table if not exists batch_items(batch_id text, seq int, episode_uuid text, graph_id text, data text, status text, error text);
create table if not exists usage(at text, prompt_tokens int, completion_tokens int, cost real);
"""


class _Store:
    def __init__(self, path: str):
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.db.execute("pragma journal_mode=wal")
        self.db.executescript(_SCHEMA)
        cols = {r[1] for r in self.db.execute("pragma table_info(usage)")}
        if "cost" not in cols:  # databases made before the cost column
            self.db.execute("alter table usage add column cost real")
        self.lock = threading.RLock()

    def q(self, sql: str, args: tuple = ()) -> list[sqlite3.Row]:
        with self.lock:
            cur = self.db.execute(sql, args)
            return cur.fetchall()

    def x(self, sql: str, args: tuple = ()) -> None:
        with self.lock:
            self.db.execute(sql, args)


# ---------------------------------------------------------------- records
def _node(r) -> NS:
    return NS(uuid_=r[0], uuid=r[0], graph_id=r[1], name=r[2], labels=json.loads(r[4] or "[]"),
              summary=r[5] or "", attributes=json.loads(r[6] or "{}"), created_at=r[7], score=None)


def _edge(r) -> NS:
    return NS(uuid_=r[0], uuid=r[0], graph_id=r[1], name=r[2], fact=r[3], source_node_uuid=r[4],
              target_node_uuid=r[5], attributes=json.loads(r[6] or "{}"), created_at=r[7], valid_at=r[8],
              invalid_at=None, expired_at=None, episodes=json.loads(r[9] or "[]"), fact_type=r[2], score=None)


_NODE_COLS = "uuid, graph_id, name, key, labels, summary, attributes, created_at"
_EDGE_COLS = "uuid, graph_id, name, fact, src, tgt, attributes, created_at, valid_at, episodes"


# ---------------------------------------------------------------- extraction
_EXTRACT_PROMPT = """You turn a text passage into a knowledge graph, like a graph memory service does.
Use ONLY these entity types (pick the best fit; skip things that fit none):
{entities}
Use ONLY these relation types (source -> target type pairs in brackets):
{edges}
Return JSON: {{"entities":[{{"name":"...","type":"<entity type>","summary":"one or two factual sentences from the passage","attributes":{{"<attr>":"<value>"}}}}],
"relations":[{{"source":"<entity name>","target":"<entity name>","type":"<RELATION_TYPE>","fact":"one sentence stating the relation as the passage does"}}]}}
Names: the most specific proper name used in the passage. At most 12 entities and 16 relations. No invented facts.

PASSAGE:
{text}"""


class _Extractor:
    def __init__(self, store: _Store):
        self.store = store
        self._client = None

    def client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=os.environ.get("LLM_API_KEY") or "x",
                                  base_url=os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1"),
                                  timeout=float(os.environ.get("LOCAL_GRAPH_LLM_TIMEOUT", "90")))
        return self._client

    def model(self) -> str:
        return os.environ.get("LOCAL_GRAPH_MODEL") or os.environ.get("LLM_MODEL_NAME", "gpt-4o-mini")

    def __call__(self, ontology: dict, text: str) -> dict:
        ents = ontology.get("entities") or {}
        edges = ontology.get("edges") or {}
        e_txt = "\n".join(f"- {n}: {d.get('description', '')}" + (f" (attributes: {', '.join(d.get('attributes', {}))})" if d.get("attributes") else "")
                          for n, d in ents.items()) or "- Entity: any person, organisation, product or place"
        r_txt = "\n".join(f"- {n}: {d.get('description', '')} [{', '.join(f'{s}->{t}' for s, t in d.get('pairs', []))}]"
                          for n, d in edges.items()) or "- RELATED_TO: any relation"
        prompt = _EXTRACT_PROMPT.format(entities=e_txt, edges=r_txt, text=text[:9000])
        msgs = [{"role": "user", "content": prompt}]
        kw = dict(model=self.model(), messages=msgs, temperature=0.1, max_tokens=1800)
        if "openrouter.ai" in os.environ.get("LLM_BASE_URL", ""):  # extraction needs no thinking; OpenRouter reports cost
            kw["extra_body"] = {"reasoning": {"enabled": False}, "usage": {"include": True}}
        try:
            resp = self.client().chat.completions.create(response_format={"type": "json_object"}, **kw)
        except Exception as e:  # provider without JSON mode
            if getattr(e, "status_code", None) not in (400, 422):
                raise
            resp = self.client().chat.completions.create(**kw)
        u = getattr(resp, "usage", None)
        if u:
            try:  # bookkeeping never fails an extraction that was already paid for
                self.store.x("insert into usage(at, prompt_tokens, completion_tokens, cost) values(?,?,?,?)",
                             (_now(), u.prompt_tokens or 0, u.completion_tokens or 0, float(getattr(u, "cost", 0) or 0)))
            except Exception:
                pass
        out = resp.choices[0].message.content or "{}"
        m = re.search(r"\{.*\}", out, re.S)
        try:
            data = json.loads(m.group(0) if m else out)
        except Exception:
            data = {}
        if not isinstance(data, dict):
            data = {}
        return {"entities": data.get("entities") or [], "relations": data.get("relations") or []}


# ---------------------------------------------------------------- search
_TOK = re.compile(r"[\w一-鿿]+", re.U)


def _tokens(s: str) -> list[str]:
    toks = [t.lower() for t in _TOK.findall(s or "")]
    out = []
    for t in toks:  # CJK runs are split to characters so Chinese queries still match
        if re.match(r"^[一-鿿]+$", t):
            out.extend(t)
        else:
            out.append(t)
    return out


def _bm25(query: str, docs: list[str], k1: float = 1.4, b: float = 0.75) -> list[float]:
    q = set(_tokens(query))
    toks = [_tokens(d) for d in docs]
    n = len(docs) or 1
    avg = sum(len(t) for t in toks) / n or 1
    df: dict[str, int] = {}
    for t in toks:
        for w in set(t):
            df[w] = df.get(w, 0) + 1
    scores = []
    for t in toks:
        tf: dict[str, int] = {}
        for w in t:
            tf[w] = tf.get(w, 0) + 1
        s = 0.0
        for w in q:
            if w in tf:
                idf = math.log(1 + (n - df[w] + 0.5) / (df[w] + 0.5))
                s += idf * tf[w] * (k1 + 1) / (tf[w] + k1 * (1 - b + b * len(t) / avg))
        scores.append(s)
    return scores


# ---------------------------------------------------------------- API surface
class _Raw:
    def __init__(self, fn):
        self.get_by_graph_id = fn


class _Nodes:
    def __init__(self, c: "LocalZep"):
        self.c = c
        self.with_raw_response = _Raw(self._page)

    def get(self, uuid_: str, **_):
        r = self.c.s.q(f"select {_NODE_COLS} from nodes where uuid=?", (uuid_,))
        if not r:
            raise _not_found(f"node {uuid_}")
        return _node(r[0])

    def get_edges(self, node_uuid: str, **_):
        return [_edge(r) for r in self.c.s.q(f"select {_EDGE_COLS} from edges where src=? or tgt=?", (node_uuid, node_uuid))]

    def get_by_graph_id(self, graph_id: str, limit: int = 100, cursor: str | None = None, **_):
        return self._page(graph_id, limit=limit, cursor=cursor).data

    def _page(self, graph_id: str, limit: int = 100, cursor: str | None = None, **_):
        off = int(cursor or 0)
        rows = self.c.s.q(f"select {_NODE_COLS} from nodes where graph_id=? order by rowid limit ? offset ?", (graph_id, limit + 1, off))
        more = len(rows) > limit
        return NS(data=[_node(r) for r in rows[:limit]], headers={"zep-next-cursor": str(off + limit)} if more else {})


class _Edges:
    def __init__(self, c: "LocalZep"):
        self.c = c
        self.with_raw_response = _Raw(self._page)

    def get(self, uuid_: str, **_):
        r = self.c.s.q(f"select {_EDGE_COLS} from edges where uuid=?", (uuid_,))
        if not r:
            raise _not_found(f"edge {uuid_}")
        return _edge(r[0])

    def get_by_graph_id(self, graph_id: str, limit: int = 100, cursor: str | None = None, **_):
        return self._page(graph_id, limit=limit, cursor=cursor).data

    def _page(self, graph_id: str, limit: int = 100, cursor: str | None = None, **_):
        off = int(cursor or 0)
        rows = self.c.s.q(f"select {_EDGE_COLS} from edges where graph_id=? order by rowid limit ? offset ?", (graph_id, limit + 1, off))
        more = len(rows) > limit
        return NS(data=[_edge(r) for r in rows[:limit]], headers={"zep-next-cursor": str(off + limit)} if more else {})


class _Episodes:
    def __init__(self, c: "LocalZep"):
        self.c = c

    def get(self, uuid_: str, **_):
        r = self.c.s.q("select uuid, graph_id, data, metadata, created_at, processed from episodes where uuid=?", (uuid_,))
        if not r:
            raise _not_found(f"episode {uuid_}")
        u, g, d, m, at, p = r[0]
        return NS(uuid_=u, uuid=u, graph_id=g, content=d, metadata=json.loads(m or "{}"), created_at=at, processed=bool(p))


class _Graph:
    def __init__(self, c: "LocalZep"):
        self.c = c
        self.node = _Nodes(c)
        self.edge = _Edges(c)
        self.episode = _Episodes(c)

    def create(self, graph_id: str, name: str | None = None, description: str | None = None, **_):
        self.c.s.x("insert or ignore into graphs values(?,?,?,?,?)", (graph_id, name, description, "{}", _now()))
        return self.get(graph_id)

    def get(self, graph_id: str, **_):
        r = self.c.s.q("select id, name, description, created_at from graphs where id=?", (graph_id,))
        if not r:
            raise _not_found(f"graph {graph_id}")
        return NS(graph_id=r[0][0], name=r[0][1], description=r[0][2], created_at=r[0][3])

    def delete(self, graph_id: str, **_):
        self.get(graph_id)
        for t, col in (("graphs", "id"), ("episodes", "graph_id"), ("nodes", "graph_id"), ("edges", "graph_id")):
            self.c.s.x(f"delete from {t} where {col}=?", (graph_id,))

    def set_ontology(self, graph_ids: list[str] | None = None, entities: dict | None = None, edges: dict | None = None, **_):
        ont = {"entities": {}, "edges": {}}
        for name, cls in (entities or {}).items():
            fields = getattr(cls, "model_fields", {}) or {}
            ont["entities"][name] = {"description": (cls.__doc__ or "").strip(),
                                     "attributes": {k: (getattr(v, "description", "") or "") for k, v in fields.items()}}
        for name, spec in (edges or {}).items():
            cls, pairs = spec if isinstance(spec, tuple) else (spec, [])
            ont["edges"][name] = {"description": (cls.__doc__ or "").strip(),
                                  "pairs": [(getattr(p, "source", "Entity"), getattr(p, "target", "Entity")) for p in pairs]}
        for g in graph_ids or []:
            self.get(g)
            self.c.s.x("update graphs set ontology=? where id=?", (json.dumps(ont), g))

    def add(self, graph_id: str, data: str, type: str = "text", created_at: str | None = None, metadata: dict | None = None, **_):
        self.get(graph_id)
        ep = _id()
        self.c.s.x("insert into episodes values(?,?,?,?,?,0)", (ep, graph_id, data, json.dumps(metadata or {}), created_at or _now()))
        if os.environ.get("LOCAL_GRAPH_EXTRACT_ON_ADD", "1") == "1":
            self.c._ingest(graph_id, ep, data)
        self.c.s.x("update episodes set processed=1 where uuid=?", (ep,))
        return self.c.graph.episode.get(ep)

    def search(self, graph_id: str | None = None, query: str = "", limit: int = 10, scope: str = "edges", **_):
        limit = max(1, min(int(limit or 10), 50))
        if scope == "nodes":
            rows = self.c.s.q(f"select {_NODE_COLS} from nodes where graph_id=?", (graph_id,))
            items = [_node(r) for r in rows]
            docs = [f"{n.name} {' '.join(n.labels)} {n.summary} {json.dumps(n.attributes, ensure_ascii=False)}" for n in items]
        else:
            rows = self.c.s.q(f"select {_EDGE_COLS} from edges where graph_id=?", (graph_id,))
            items = [_edge(r) for r in rows]
            docs = [f"{e.name} {e.fact}" for e in items]
        scored = sorted(zip(_bm25(query, docs), range(len(items))), key=lambda x: -x[0])
        picked = []
        for s, i in scored[:limit]:
            if s <= 0 and picked:
                break
            items[i].score = round(s, 4)
            picked.append(items[i])
        return NS(edges=picked if scope != "nodes" else [], nodes=picked if scope == "nodes" else [], episodes=[])


class _Batch:
    def __init__(self, c: "LocalZep"):
        self.c = c

    def create(self, metadata: dict | None = None, **_):
        b = _id()
        self.c.s.x("insert into batches values(?,?,?,?)", (b, json.dumps(metadata or {}), "draft", _now()))
        return self._summary(b)

    def add(self, batch_id: str, items: list, **_):
        self._summary(batch_id)
        start = self.c.s.q("select count(*) from batch_items where batch_id=?", (batch_id,))[0][0]
        out = []
        for i, it in enumerate(items):
            ep = _id()
            self.c.s.x("insert into batch_items values(?,?,?,?,?,?,?)",
                       (batch_id, start + i, ep, getattr(it, "graph_id", None), getattr(it, "data", ""), "pending", None))
            out.append(NS(episode_uuid=ep, source_uuid=ep, sequence_index=start + i, status="pending"))
        return out

    def process(self, batch_id: str, **_):
        """Runs extraction now (MiroFish calls this from a background task, then polls batch.get)."""
        self._summary(batch_id)
        self.c.s.x("update batches set status='processing' where batch_id=?", (batch_id,))
        rows = self.c.s.q("select seq, episode_uuid, graph_id, data from batch_items where batch_id=? and status='pending' order by seq", (batch_id,))
        for _seq, ep, g, d in rows:
            self.c.s.x("insert or ignore into episodes values(?,?,?,?,?,0)", (ep, g, d, "{}", _now()))

        def one(row):
            seq, ep, g, d = row
            try:
                self.c._ingest(g, ep, d)
                self.c.s.x("update batch_items set status='succeeded' where batch_id=? and seq=?", (batch_id, seq))
                self.c.s.x("update episodes set processed=1 where uuid=?", (ep,))
            except Exception as e:  # keep going; MiroFish reports the first error
                self.c.s.x("update batch_items set status='failed', error=? where batch_id=? and seq=?", (str(e)[:500], batch_id, seq))

        with ThreadPoolExecutor(max_workers=int(os.environ.get("LOCAL_GRAPH_WORKERS", "4"))) as pool:
            list(pool.map(one, rows))
        failed = self.c.s.q("select count(*) from batch_items where batch_id=? and status='failed'", (batch_id,))[0][0]
        status = "succeeded" if not failed else ("failed" if failed == len(rows) else "partial")
        self.c.s.x("update batches set status=? where batch_id=?", (status, batch_id))
        return self._summary(batch_id)

    def get(self, batch_id: str, **_):
        return self._summary(batch_id)

    def list(self, limit: int = 100, cursor: int | None = None, **_):
        off = int(cursor or 0)
        ids = [r[0] for r in self.c.s.q("select batch_id from batches order by rowid limit ? offset ?", (limit + 1, off))]
        return NS(batches=[self._summary(b) for b in ids[:limit]], next_cursor=off + limit if len(ids) > limit else None)

    def list_items(self, batch_id: str, limit: int = 100, cursor: int | None = None, **_):
        off = int(cursor or 0)
        rows = self.c.s.q("select seq, episode_uuid, status, error from batch_items where batch_id=? order by seq limit ? offset ?", (batch_id, limit + 1, off))
        items = [NS(sequence_index=s, episode_uuid=e, source_uuid=e, status=st, error=err) for s, e, st, err in rows[:limit]]
        return NS(items=items, next_cursor=off + limit if len(rows) > limit else None)

    def _summary(self, batch_id: str):
        r = self.c.s.q("select batch_id, metadata, status, created_at from batches where batch_id=?", (batch_id,))
        if not r:
            raise _not_found(f"batch {batch_id}")
        counts = dict(self.c.s.q("select status, count(*) from batch_items where batch_id=? group by status", (batch_id,)))
        total = sum(counts.values()) or 1
        ok = counts.get("succeeded", 0)
        return NS(batch_id=r[0][0], metadata=json.loads(r[0][1] or "{}"), status=r[0][2], created_at=r[0][3],
                  progress=NS(percent_complete=100.0 * (ok + counts.get("failed", 0)) / total, succeeded_items=ok,
                              failed_items=counts.get("failed", 0), total_items=sum(counts.values())))


class LocalZep:
    """Drop-in for zep_cloud.client.Zep, limited to what MiroFish calls."""

    def __init__(self, path: str | None = None):
        self.s = _Store(path or os.environ.get("LOCAL_GRAPH_DB", os.path.expanduser("~/mirofish/local_graph.db")))
        self.extract = _Extractor(self.s)
        self.graph = _Graph(self)
        self.batch = _Batch(self)
        self._merge = threading.Lock()

    # extraction + merge by (graph, lower-case name)
    def _ingest(self, graph_id: str, episode_uuid: str, text: str) -> None:
        if not (text or "").strip():
            return
        ont = json.loads((self.s.q("select ontology from graphs where id=?", (graph_id,)) or [["{}"]])[0][0] or "{}")
        got = self.extract(ont, text)
        canon = {re.sub(r"[^a-z0-9]", "", k.lower()): k for k in (ont.get("entities") or {})}
        ents = []
        for e in got.get("entities", []):
            if not (isinstance(e, dict) and e.get("name")):
                continue
            t = canon.get(re.sub(r"[^a-z0-9]", "", str(e.get("type") or "").lower())) if canon else (e.get("type") or "Entity")
            if t:  # types outside the ontology are dropped, like Zep does
                ents.append({**e, "type": t})
        got["entities"] = ents
        got["relations"] = [r for r in got.get("relations", []) if isinstance(r, dict) and r.get("source") and r.get("target")]
        with self._merge:
            ids: dict[str, str] = {}
            for e in got["entities"]:
                key = str(e["name"]).strip().lower()
                label = str(e.get("type") or "Entity")
                attrs = {k: v for k, v in (e.get("attributes") or {}).items() if isinstance(k, str)}
                r = self.s.q("select uuid, labels, summary, attributes from nodes where graph_id=? and key=?", (graph_id, key))
                if r:
                    u, labels, summary, old = r[0]
                    labels = json.loads(labels)
                    if label not in labels:
                        labels.append(label)
                    summary = summary or ""
                    add = str(e.get("summary") or "").strip()
                    if add and add not in summary:
                        summary = (summary + " " + add).strip()[:1200]
                    merged = {**json.loads(old or "{}"), **attrs}
                    self.s.x("update nodes set labels=?, summary=?, attributes=? where uuid=?",
                             (json.dumps(labels), summary, json.dumps(merged, ensure_ascii=False), u))
                else:
                    u = _id()
                    self.s.x(f"insert into nodes({_NODE_COLS}) values(?,?,?,?,?,?,?,?)",
                             (u, graph_id, str(e["name"]).strip(), key, json.dumps(["Entity", label]),
                              str(e.get("summary") or ""), json.dumps(attrs, ensure_ascii=False), _now()))
                ids[key] = u
            for rel in got["relations"]:
                s, t = (str(rel["source"]).strip().lower(), str(rel["target"]).strip().lower())
                su = ids.get(s) or (self.s.q("select uuid from nodes where graph_id=? and key=?", (graph_id, s)) or [[None]])[0][0]
                tu = ids.get(t) or (self.s.q("select uuid from nodes where graph_id=? and key=?", (graph_id, t)) or [[None]])[0][0]
                if not su or not tu:
                    continue
                fact = str(rel.get("fact") or f"{rel['source']} {rel.get('type', 'RELATED_TO')} {rel['target']}")
                name = re.sub(r"[^A-Z0-9_]", "_", str(rel.get("type") or "RELATED_TO").upper())
                dup = self.s.q("select uuid, episodes from edges where graph_id=? and src=? and tgt=? and name=? and fact=?", (graph_id, su, tu, name, fact))
                if dup:
                    eps = json.loads(dup[0][1] or "[]") + [episode_uuid]
                    self.s.x("update edges set episodes=? where uuid=?", (json.dumps(eps), dup[0][0]))
                    continue
                self.s.x(f"insert into edges({_EDGE_COLS}) values(?,?,?,?,?,?,?,?,?,?)",
                         (_id(), graph_id, name, fact, su, tu, "{}", _now(), _now(), json.dumps([episode_uuid])))

    def usage(self) -> dict:
        r = self.s.q("select count(*), coalesce(sum(prompt_tokens),0), coalesce(sum(completion_tokens),0), coalesce(sum(cost),0) from usage")[0]
        return {"calls": r[0], "prompt_tokens": r[1], "completion_tokens": r[2], "cost_usd": round(r[3], 6)}


_client: LocalZep | None = None
_client_lock = threading.Lock()


def get_local_client() -> LocalZep:
    global _client
    with _client_lock:
        if _client is None:
            _client = LocalZep()
        return _client
