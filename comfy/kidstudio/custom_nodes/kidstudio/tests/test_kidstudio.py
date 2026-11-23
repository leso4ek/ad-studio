"""Unit tests for Kid Studio's pure-Python parts. Run: python -m pytest comfy/kidstudio/custom_nodes/kidstudio/tests -q"""
import importlib.util
import json
import os
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
PKG = HERE.parent
PACK = PKG.parent.parent


def _load(name):
    spec = importlib.util.spec_from_file_location(f"kidstudio_{name}", PKG / f"{name}.py")
    m = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = m
    spec.loader.exec_module(m)
    return m


story = _load("story")


def bible():
    return json.loads((PACK / "pilot" / "bible.json").read_text(encoding="utf-8"))


def test_every_shot_builds_in_the_winners_order_and_passes_safety():
    b = bible()
    order = ["[HEADER]", "[CUT POLICY]", "[GOAL]", "[CHARACTER AND REFERENCES]", "[CAST RULE]", "[SCENE]", "[GEOGRAPHY]",
             "[STAGE 1", "[VISUAL STYLE]", "[MOTION]", "[AUDIO]", "[MAINTAIN CONSISTENCY]"]
    for shot in b["shots"]:
        p, refs = story.build_shot_prompt(shot, b)
        pos = [p.index(tag) for tag in order]
        assert pos == sorted(pos), shot["id"]
        assert story.style_pack("soft3d")["style"] in p           # locked style pasted word for word
        assert "No music." in p and "No subtitles" in p
        assert f"{shot['seconds']} seconds" in p
        assert story.safety_lint(p, shot["seconds"]) == [], (shot["id"], story.safety_lint(p, shot["seconds"]))
        assert len(p) < 10000
        # stages add up to the shot length
        assert shot["stages"][-1]["to"] == shot["seconds"] and shot["stages"][0]["from"] == 0


def test_reference_order_matches_the_prompt():
    b = bible()
    p, refs = story.build_shot_prompt(b["shots"][3], b)  # s04: hazel, room, lantern
    assert refs == ["character:hazel", "place:hazel_room", "prop:jar_lantern"]
    assert "Reference image 1 is Hazel" in p and "Reference image 3 is the jar lantern" in p


def test_bible_length_and_narration_fit():
    b = bible()
    total = sum(s["seconds"] for s in b["shots"])
    assert 60 <= total <= 90
    lines = story.narration_lines(b)
    words = sum(len(l["text"].split()) for l in lines)
    assert 60 <= words <= 160
    assert [l["t"] for l in lines] == sorted(l["t"] for l in lines)


def test_safety_lint_blocks_and_allows():
    bad = story.safety_lint("a monster attacks with a knife; ask your parents to buy it now ®")
    kinds = {i.split(":")[0] for i in bad}
    assert {"frightening", "violence", "selling"} <= kinds
    assert story.safety_lint("Hazel explores the garden; a shooting star; moonlight hits the bed") == []
    assert any(i.startswith("pace") for i in story.safety_lint("[STAGE 1 [STAGE 2 [STAGE 3 [STAGE 4", 8))


def test_budget_refuses_over_cap_and_counts_real_cost():
    with tempfile.TemporaryDirectory() as d:
        os.environ["KIDSTUDIO_RUNS"] = d
        os.environ["KIDSTUDIO_BUDGET_USD"] = "5"
        os.environ["KIDSTUDIO_MOCK"] = "0"
        core = _load("core")
        b = core.Budget.default()
        b.log({"kind": "video", "estimate": 3.0, "status": "submitted", "job_id": "j1"})
        b.update("j1", status="completed", cost=2.5)
        assert abs(b.spent() - 2.5) < 1e-9
        b.charge_guard(2.4, "ok")                      # 4.9 <= 5
        try:
            b.charge_guard(2.6, "too much")            # 5.1 > 5
            raise AssertionError("should have refused")
        except core.BudgetError:
            pass
        assert b.entries()[-1]["status"] == "refused"
        assert abs(b.spent() - 2.5) < 1e-9          # refused calls cost nothing


def test_cost_estimates_match_openrouter_prices():
    core = _load("core")
    # Seedance 2.5: $0.1028/s at 480p, $0.2311/s at 720p, $0.5686/s at 1080p; Flash $0.06726/s at 480p
    assert abs(core.estimate_video("bytedance/seedance-2.5", "16:9", "480p", 1) - 0.1028) < 0.001
    assert abs(core.estimate_video("bytedance/seedance-2.5", "16:9", "720p", 1) - 0.2311) < 0.001
    assert abs(core.estimate_video("bytedance/seedance-2.5", "16:9", "1080p", 1) - 0.5686) < 0.001
    assert abs(core.estimate_video("bytedance/seedance-2.5-flash", "16:9", "480p", 1) - 0.0673) < 0.001
