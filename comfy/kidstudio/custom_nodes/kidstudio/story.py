"""Prompt building for Kid Studio: the locked style pack, element prompts and shot prompts, plus the kids' safety lint.

Pure Python (no ComfyUI imports) so it can be unit-tested and used from scripts.
Shot prompts follow the structure of the top Higgsfield Talent Contest films (header, cut policy, references,
cast rule, scene + geography, timed stages, locked style, motion, audio, consistency), tuned for young children.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

# ── the style pack (locked: pasted word for word into every prompt of the show) ─────────────────────────────
STYLE_PACKS = {
    "soft3d": {
        "name": "Soft 3D family film",
        "style": ("A modern 3D animated family film for young children. Soft, rounded shapes and friendly proportions, "
                  "big gentle eyes, fur and fabric with fine soft detail and a little subsurface glow. Warm, saturated "
                  "but gentle colors: honey, moss green, sky blue, soft rose. Soft global illumination with one warm key "
                  "light and a soft cool fill, no harsh shadows. Shallow depth of field with round, soft bokeh. Clean, "
                  "uncluttered frames with one clear subject. Cozy, safe and calm; nothing scary, sharp or loud."),
        "motion": ("Calm, gentle pace for young children. Every movement is smooth, soft and easy to follow, with clear "
                   "key poses and gentle squash and stretch. Nothing sudden: no fast camera moves and no quick cuts. "
                   "The camera glides slowly or holds still. Real-time speed, never sped up, never jerky."),
        "sheet_look": ("Rendered like a modern 3D animated family film character model sheet: soft rounded shapes, fine soft "
                       "fur or fabric, gentle subsurface glow, flat even studio light."),
    },
}

NO_MUSIC = "No music. No subtitles or captions."


def style_pack(name: str = "soft3d") -> dict:
    return STYLE_PACKS[name]


# ── element prompts (pictures before video) ──────────────────────────────────────────────────────────────────
def character_sheet_prompt(description: str, outfit: str = "", pack: str = "soft3d") -> str:
    p = style_pack(pack)
    return (f"Character model sheet of {description.strip().rstrip('.')}"
            + (f", wearing {outfit.strip().rstrip('.')}" if outfit.strip() else "") +
            ". Four views side by side on a flat mid gray background: a large close-up of the face, then the full body "
            "from the front, from the side and from the back. The same character in all four views, standing relaxed "
            "with a gentle, friendly expression. Flat, even light from the front, with no shadow side and no shadow on "
            "the background. Plain clothes with no logos or writing. Nothing else in the frame. " + p["sheet_look"])


def place_prompt(description: str, lights: str, pack: str = "soft3d") -> str:
    p = style_pack(pack)
    return (f"A wide picture of {description.strip().rstrip('.')}, empty, from eye height at about a three quarter angle. "
            f"{lights.strip().rstrip('.')}. Every surface looks built and lived in: real materials, small worn details, "
            f"soft corners falling off a little darker. No people or animals in the frame, and no writing anywhere. "
            + p["style"])


def prop_prompt(description: str, pack: str = "soft3d") -> str:
    p = style_pack(pack)
    return (f"{description.strip().rstrip('.')}, alone, straight on, centered on a plain soft gray background, in soft even "
            f"light. One small easy detail makes it recognizable. No writing or logos. " + p["sheet_look"])


# ── shot prompts ─────────────────────────────────────────────────────────────────────────────────────────────
def _ref_lines(refs: list[dict]) -> str:
    lines = []
    for i, r in enumerate(refs, 1):
        keep = r.get("keep", "match the design, colors and proportions exactly")
        lines.append(f"Reference image {i} is {r['name']} ({r['kind']}): {keep}. {r.get('ignore', 'Ignore the gray backdrop.')}")
    return "\n".join(lines)


def build_shot_prompt(shot: dict, bible: dict) -> tuple[str, list[str]]:
    """Return (prompt, element_ids in reference order) for one shot of the bible."""
    pack = style_pack(bible.get("style_pack", "soft3d"))
    style = bible.get("style", pack["style"])
    motion = bible.get("motion", pack["motion"])
    chars = {c["id"]: c for c in bible.get("characters", [])}
    places = {p["id"]: p for p in bible.get("places", [])}
    props = {p["id"]: p for p in bible.get("props", [])}

    refs, element_ids = [], []
    for cid in shot.get("cast", []):
        c = chars[cid]
        refs.append({"name": c["name"], "kind": "character sheet, all views show the same character",
                     "keep": f"match {c['name']}'s face, colors, proportions and clothes exactly in every shot"})
        element_ids.append(c["element"])
    if shot.get("place") and places.get(shot["place"], {}).get("element"):
        pl = places[shot["place"]]
        refs.append({"name": pl["name"], "kind": "location", "keep": "use this picture for the layout and the light, the same in every shot",
                     "ignore": ""})
        element_ids.append(pl["element"])
    for pid in shot.get("props", []):
        pr = props[pid]
        if pr.get("element"):
            refs.append({"name": pr["name"], "kind": "prop", "keep": "match its shape, size and colors exactly", "ignore": "Ignore the backdrop."})
            element_ids.append(pr["element"])

    stages = shot["stages"]
    seconds = shot["seconds"]
    n = len(stages)
    cuts = n - 1
    header = f"{seconds} seconds, {n} shot{'s' if n > 1 else ''}, {cuts} hard cut{'s' if cuts != 1 else ''}, {bible.get('aspect', '16:9')}, 24 fps."
    cut_policy = ("One single continuous shot; no cuts, no dissolves, no fades, no speed ramps." if n == 1 else
                  f"Exactly {n} shots joined by {cuts} hard cut{'s' if cuts != 1 else ''}; no dissolves, no fades, no speed ramps.")
    cast_names = [chars[c]["name"] for c in shot.get("cast", [])]
    cast_rule = (f"Exactly {len(cast_names)} character{'s' if len(cast_names) != 1 else ''} in this scene: "
                 f"{', '.join(cast_names)}. Never duplicated, never swapped, no other characters." if cast_names
                 else "No characters appear in this scene.")
    character_lines = "\n".join(f"{chars[c]['name']}: {chars[c]['description']} {chars[c].get('states', '')}".strip()
                                for c in shot.get("cast", []))
    stage_txt = []
    for i, st in enumerate(stages, 1):
        stage_txt.append(f"[STAGE {i} | {st['from']}-{st['to']} SECONDS | {st['name'].upper()}]\n"
                         f"Camera: {st['camera']}\nAction: {st['action']}\n"
                         + (f"End transition: {st['end']}" if st.get("end") else "End: hold gently on this moment."))
    ambience = shot.get("ambience", bible.get("ambience", "soft natural ambience"))
    parts = [
        f"[HEADER] {header}",
        f"[CUT POLICY] {cut_policy}",
        f"[GOAL] {shot['goal']}",
        f"[CHARACTER AND REFERENCES]\n{_ref_lines(refs)}" + (f"\n{character_lines}" if character_lines else ""),
        f"[CAST RULE] {cast_rule}",
        f"[SCENE] {shot['scene']}",
        f"[GEOGRAPHY] {shot['geography']}",
        "\n\n".join(stage_txt),
        f"[VISUAL STYLE] {style}",
        f"[MOTION] {motion}",
        f"[AUDIO] {NO_MUSIC} No dialogue. Gentle ambience only: {ambience}.",
        f"[MAINTAIN CONSISTENCY] {shot.get('consistency', '')} Keep every character's face, colors and clothes, every prop and the "
        f"layout of the place the same in every shot. {'One unbroken shot from the first frame to the last.' if n == 1 else f'{n} shots, with a hard cut between each.'}",
    ]
    return "\n\n".join(p.strip() for p in parts), element_ids


def load_bible(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def narration_lines(bible: dict) -> list[dict]:
    """All narration lines with absolute times (shot start + offset), in order."""
    out, t = [], 0.0
    for shot in bible["shots"]:
        for ln in shot.get("narration", []):
            out.append({"shot": shot["id"], "t": round(t + ln["at"], 2), "text": ln["text"]})
        t += shot["seconds"]
    return out


# ── kids' safety lint ────────────────────────────────────────────────────────────────────────────────────────
SAFETY_RULES = {
    "frightening": r"\b(scream\w*|terrif\w*|horror|monster\w*|ghost\w*|nightmare\w*|creepy|blood\w*|dead|death|die[sd]?|"
                   r"kill\w*|zombie\w*|jump ?scare\w*|demon\w*|skull\w*)\b",
    "violence": r"\b(guns?|knife|knives|swords?|weapons?|punch\w*|fights?|fighting|explod\w*|explosion\w*|gunshot\w*|attack\w*|stab\w*|bomb\w*)\b",
    "selling": r"(ask your (mom|mum|dad|parents)|buy (it|now|this)|in stores|order now|limited offer|price|\$\d|"
               r"subscribe now|®|™|\bbrand\b|\bsponsor\w*)",
    "unsafe_imitation": r"\b(climb\w* (on|up) the (stove|window|balcony)|lighter|matches|medicine|pills?|plastic bag over)\b",
}


def safety_lint(text: str, seconds: int | None = None) -> list[str]:
    issues = []
    low = text.lower()
    for kind, pat in SAFETY_RULES.items():
        for m in sorted(set(re.findall(pat, low))):
            word = m if isinstance(m, str) else m[0]
            issues.append(f"{kind}: '{word}'")
    if seconds:
        stages = len(re.findall(r"\[STAGE \d+", text))
        if stages and seconds / stages < 3:
            issues.append(f"pace: {stages} shots in {seconds}s is faster than one cut per 3 s; slow it down for young children")
    return issues
