# SPDX-License-Identifier: AGPL-3.0-only
# Contract test: MiroFish's own services against the local graph, no network.
#   cd ~/mirofish/backend && .venv/bin/python -m pytest -q \
#      ~/scifi-explainer-studio/integrations/mirofish/test_local_graph.py
import os
import sys

import pytest

os.environ["MIROFISH_LOCAL_GRAPH"] = "1"
os.environ.setdefault("ZEP_API_KEY", "local")
os.environ.setdefault("LLM_API_KEY", "x")
sys.path.insert(0, os.path.join(os.path.expanduser(os.environ.get("MIROFISH_DIR", "~/mirofish")), "backend"))

ONTOLOGY = {
    "entity_types": [
        {"name": "Person", "description": "A viewer or character.", "attributes": [{"name": "role", "type": "text", "description": "their role"}]},
        {"name": "Product", "description": "A product in the ad.", "attributes": []},
    ],
    "edge_types": [
        {"name": "USES", "description": "someone uses a product", "source_targets": [{"source": "Person", "target": "Product"}], "attributes": []},
    ],
}


def fake_extract(ont, text):
    assert "Person" in ont["entities"] and [list(p) for p in ont["edges"]["USES"]["pairs"]] == [["Person", "Product"]]
    assert "role" in ont["entities"]["Person"]["attributes"]
    ents = [{"name": "Juno", "type": "Person", "summary": "Juno waters a fern.", "attributes": {"role": "plant owner"}},
            {"name": "Sprigly", "type": "Product", "summary": "A houseplant feed."},
            {"name": "Ignored", "type": "Spaceship"}]
    rel = [{"source": "Juno", "target": "Sprigly", "type": "uses", "fact": "Juno uses Sprigly on her fern."}]
    i = int(text.split("#")[1].split()[0]) if "#" in text else 0
    ents.append({"name": f"Viewer {i}", "type": "Person", "summary": f"viewer number {i}"})
    return {"entities": ents, "relations": rel}


@pytest.fixture()
def svc(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCAL_GRAPH_DB", str(tmp_path / "g.db"))
    from app.utils import local_graph
    local_graph._client = None
    c = local_graph.get_local_client()
    monkeypatch.setattr(c, "extract", fake_extract)
    from app.services.graph_builder import GraphBuilderService
    return GraphBuilderService(), c


def test_build_read_search_delete(svc):
    b, c = svc
    from zep_cloud import NotFoundError
    from app.utils.zep_paging import fetch_all_nodes, fetch_all_edges
    from app.services.zep_entity_reader import ZepEntityReader
    from app.services.zep_tools import ZepToolsService

    gid = b.create_graph("t")
    b.set_ontology(gid, ONTOLOGY)
    chunks = [f"chunk #{i} Juno pours a capful of Sprigly." for i in range(130)]
    sub = b.add_text_batches(gid, chunks, batch_size=50)
    assert len(sub.episode_uuids) == 130
    eps = b._wait_for_batch(sub)
    assert len(eps) == 130
    b._wait_for_episodes(eps[:3])

    nodes = fetch_all_nodes(c, gid)
    edges = fetch_all_edges(c, gid)
    assert len(nodes) == 132  # Juno + Sprigly merged by name, 130 viewers, Spaceship dropped
    assert len(edges) == 1 and edges[0].name == "USES" and len(edges[0].episodes) == 130
    juno = next(n for n in nodes if n.name == "Juno")
    assert juno.labels == ["Entity", "Person"] and juno.attributes["role"] == "plant owner"

    data = b.get_graph_data(gid)
    assert data["edges"][0]["source_node_name"] == "Juno"
    info = b._get_graph_info(gid)
    assert set(info.entity_types) == {"Person", "Product"}

    r = ZepEntityReader()
    f = r.filter_defined_entities(gid, defined_entity_types=["Person"], enrich_with_edges=True)
    assert f.filtered_count == 131
    assert r.get_entity_with_context(gid, juno.uuid_).name == "Juno"

    t = ZepToolsService()
    res = t.search_graph(gid, "Juno Sprigly fern", limit=5, scope="edges")
    assert res.facts == ["Juno uses Sprigly on her fern."]
    res = t.search_graph(gid, "houseplant feed", limit=3, scope="nodes")
    assert res.nodes[0]["name"] == "Sprigly"
    assert t.get_node_detail("missing") is None

    with pytest.raises(NotFoundError):
        c.graph.node.get(uuid_="missing")
    b.delete_graph(gid)
    with pytest.raises(NotFoundError):
        c.graph.get(gid)


def test_graph_add_activity(svc):
    b, c = svc
    gid = b.create_graph("t2")
    b.set_ontology(gid, ONTOLOGY)
    ep = c.graph.add(graph_id=gid, type="text", data="round 1: Viewer #7 liked the post", metadata={"source": "x"})
    assert c.graph.episode.get(uuid_=ep.uuid_).processed is True
    assert any(n.name == "Viewer 7" for n in c.graph.node.get_by_graph_id(gid, limit=50))
