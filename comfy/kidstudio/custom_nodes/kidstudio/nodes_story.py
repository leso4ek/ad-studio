"""ComfyUI nodes: story bible -> shot prompt, element prompts, safety lint, element library."""
from __future__ import annotations

from pathlib import Path

from . import core, story

PACKS = list(story.STYLE_PACKS.keys())


def _bible_path(p: str) -> Path:
    path = Path(p.strip())
    return path if path.is_absolute() else core.PACK_DIR / path


class ShotFromBible:
    """Builds one shot's Seedance prompt from the story bible, in the structure the top Higgsfield films use."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "bible_path": ("STRING", {"default": "pilot/bible.json"}),
            "shot_number": ("INT", {"default": 1, "min": 1, "max": 99}),
            "safety": (["block", "warn"], {"default": "block"}),
        }}

    RETURN_TYPES = ("STRING", "INT", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("prompt", "seconds", "elements", "filename_prefix", "shot_id")
    FUNCTION = "run"
    CATEGORY = "Kid Studio"
    OUTPUT_NODE = True

    def run(self, bible_path, shot_number, safety):
        bible = story.load_bible(_bible_path(bible_path))
        shots = bible["shots"]
        if shot_number > len(shots):
            raise ValueError(f"The bible has {len(shots)} shots; shot {shot_number} does not exist.")
        shot = shots[shot_number - 1]
        prompt, elements = story.build_shot_prompt(shot, bible)
        issues = story.safety_lint(prompt, shot["seconds"])
        if issues and safety == "block":
            raise ValueError("Kid Studio safety check blocked this prompt:\n- " + "\n- ".join(issues))
        note = f"{shot['id']}: {shot['seconds']}s, {len(prompt)} chars, refs: {', '.join(elements) or 'none'}"
        if issues:
            note += "\nWarnings: " + "; ".join(issues)
        return {"ui": {"text": [note]},
                "result": (prompt, shot["seconds"], ", ".join(elements), f"kidstudio/shots/{shot['id']}", shot["id"])}


class ManualShotPrompt:
    """The same prompt structure, typed by hand (for one-off shots outside a bible)."""

    @classmethod
    def INPUT_TYPES(cls):
        m = {"multiline": True, "default": ""}
        return {"required": {
            "seconds": ("INT", {"default": 8, "min": 4, "max": 30}),
            "goal": ("STRING", m), "references": ("STRING", m), "cast_rule": ("STRING", m),
            "scene": ("STRING", m), "geography": ("STRING", m), "stages": ("STRING", m),
            "ambience": ("STRING", {"default": "soft natural ambience"}),
            "consistency": ("STRING", m),
            "style_pack": (PACKS, {"default": PACKS[0]}),
            "safety": (["block", "warn"], {"default": "block"}),
        }}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "run"
    CATEGORY = "Kid Studio"

    def run(self, seconds, goal, references, cast_rule, scene, geography, stages, ambience, consistency, style_pack, safety):
        pack = story.style_pack(style_pack)
        n = max(1, stages.count("[STAGE"))
        header = f"{seconds} seconds, {n} shot{'s' if n > 1 else ''}, {n - 1} hard cuts, 16:9, 24 fps."
        prompt = "\n\n".join(s for s in [
            f"[HEADER] {header}",
            "[CUT POLICY] " + ("One single continuous shot; no cuts, no dissolves, no fades." if n == 1
                               else f"Exactly {n} shots joined by hard cuts; no dissolves, no fades, no speed ramps."),
            f"[GOAL] {goal}", f"[CHARACTER AND REFERENCES]\n{references}", f"[CAST RULE] {cast_rule}",
            f"[SCENE] {scene}", f"[GEOGRAPHY] {geography}", stages,
            f"[VISUAL STYLE] {pack['style']}", f"[MOTION] {pack['motion']}",
            f"[AUDIO] {story.NO_MUSIC} No dialogue. Gentle ambience only: {ambience}.",
            f"[MAINTAIN CONSISTENCY] {consistency}"] if s.strip())
        issues = story.safety_lint(prompt, seconds)
        if issues and safety == "block":
            raise ValueError("Kid Studio safety check blocked this prompt:\n- " + "\n- ".join(issues))
        return (prompt,)


class ElementPrompt:
    """Writes the picture prompt for a character sheet, an empty place, or a prop, in the show's locked look."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "kind": (["character", "place", "prop"], {"default": "character"}),
            "description": ("STRING", {"multiline": True, "default": ""}),
            "outfit_or_lights": ("STRING", {"multiline": True, "default": ""}),
            "style_pack": (PACKS, {"default": PACKS[0]}),
        }}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "run"
    CATEGORY = "Kid Studio"

    def run(self, kind, description, outfit_or_lights, style_pack):
        if kind == "character":
            p = story.character_sheet_prompt(description, outfit_or_lights, style_pack)
        elif kind == "place":
            p = story.place_prompt(description, outfit_or_lights or "Soft warm light from a lamp, soft cool fill from a window", style_pack)
        else:
            p = story.prop_prompt(description, style_pack)
        issues = story.safety_lint(p)
        if issues:
            raise ValueError("Kid Studio safety check blocked this prompt:\n- " + "\n- ".join(issues))
        return (p,)


class ElementFromBible:
    """Reads a character/place/prop description from the bible and writes its picture prompt."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "bible_path": ("STRING", {"default": "pilot/bible.json"}),
            "element": ("STRING", {"default": "character:hazel"}),
        }}

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("prompt", "kind", "name")
    FUNCTION = "run"
    CATEGORY = "Kid Studio"

    def run(self, bible_path, element):
        bible = story.load_bible(_bible_path(bible_path))
        pack = bible.get("style_pack", "soft3d")
        for key, kind in (("characters", "character"), ("places", "place"), ("props", "prop")):
            for e in bible.get(key, []):
                if e.get("element") == element.strip():
                    if kind == "character":
                        p = story.character_sheet_prompt(e["sheet"], e.get("outfit", ""), pack)
                    elif kind == "place":
                        p = story.place_prompt(e["sheet"], e.get("lights", ""), pack)
                    else:
                        p = story.prop_prompt(e["sheet"], pack)
                    return (p, kind, element.split(":", 1)[1])
        raise ValueError(f"No element '{element}' in the bible.")


class SafetyLint:
    """Checks any text for things that do not belong in a video for young children."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"text": ("STRING", {"multiline": True, "forceInput": True}),
                             "seconds": ("INT", {"default": 0, "min": 0, "max": 600}),
                             "mode": (["block", "warn"], {"default": "warn"})}}

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("text", "report")
    FUNCTION = "run"
    CATEGORY = "Kid Studio"
    OUTPUT_NODE = True

    def run(self, text, seconds, mode):
        issues = story.safety_lint(text, seconds or None)
        if issues and mode == "block":
            raise ValueError("Kid Studio safety check blocked this text:\n- " + "\n- ".join(issues))
        report = "OK: nothing flagged" if not issues else "Flagged:\n- " + "\n- ".join(issues)
        return {"ui": {"text": [report]}, "result": (text, report)}


# ── element library ("elements") ─────────────────────────────────────────────────────────────────────────────
def library_path(kind: str, name: str) -> Path:
    folder = {"character": "characters", "place": "places", "prop": "props"}[kind]
    return core.PACK_DIR / "library" / folder / f"{name}.png"


class LoadElements:
    """Loads saved reference pictures by name, in order ('character:hazel, place:bedroom, prop:lantern')."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"elements": ("STRING", {"default": "character:hazel"})}}

    RETURN_TYPES = ("IMAGE", "INT")
    RETURN_NAMES = ("images", "count")
    FUNCTION = "run"
    CATEGORY = "Kid Studio"

    def run(self, elements):
        from PIL import Image
        names = [e.strip() for e in elements.split(",") if e.strip()]
        pils, missing = [], []
        for e in names:
            kind, name = e.split(":", 1)
            p = library_path(kind.strip(), name.strip())
            if p.exists():
                pils.append(Image.open(p).convert("RGB"))
            else:
                missing.append(str(p.relative_to(core.PACK_DIR)))
        if missing:
            raise FileNotFoundError("Kid Studio: these elements are not saved yet (run 01/02 workflows first): " + ", ".join(missing))
        if not pils:  # a shot with no references: a 64x64 placeholder the video node ignores
            return (core.pils_to_tensor([]), 0)
        size = pils[0].size
        if max(size) > 1280:
            s = 1280 / max(size)
            size = (int(size[0] * s), int(size[1] * s))
        return (core.pils_to_tensor(pils, size), len(pils))


class SaveElement:
    """Saves the take you picked (1-based) as a named element in the library."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "images": ("IMAGE",),
            "take": ("INT", {"default": 0, "min": 0, "max": 8}),
            "kind": (["character", "place", "prop"], {"default": "character"}),
            "name": ("STRING", {"default": "hazel"}),
            "overwrite": ("BOOLEAN", {"default": False}),
        }}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("path",)
    FUNCTION = "run"
    CATEGORY = "Kid Studio"
    OUTPUT_NODE = True

    def run(self, images, take, kind, name, overwrite):
        pils = core.tensor_to_pils(images)
        if take == 0:
            msg = f"Not saved yet: look at the {len(pils)} takes, set 'take' to the one you like and queue again (no new cost)."
            return {"ui": {"text": [msg]}, "result": ("",)}
        if take > len(pils):
            raise ValueError(f"Only {len(pils)} takes came back; pick 1 to {len(pils)}.")
        p = library_path(kind, name.strip())
        p.parent.mkdir(parents=True, exist_ok=True)
        if p.exists() and not overwrite:
            raise FileExistsError(f"{p.name} is already saved (locked). Turn on overwrite only if you really mean to replace it.")
        pils[take - 1].save(p)
        return {"ui": {"text": [f"Saved {kind} '{name}' -> {p.relative_to(core.PACK_DIR)}"]}, "result": (str(p),)}
