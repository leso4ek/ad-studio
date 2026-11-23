"""Writes the Kid Studio workflows (ComfyUI API format) into comfy/kidstudio/workflows/.

API-format JSON can be queued with scripts/run_workflow.py, or dragged onto the ComfyUI canvas (it loads as a graph).
Run: python comfy/kidstudio/tools/make_workflows.py
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "workflows"
BIBLE = "pilot/bible.json"
SHEET_MODEL = "bytedance-seed/seedream-5-5"      # the six-model test decides; Seedream 5.5 is the cheap default


def wf(nodes: dict, title: str, notes: str) -> dict:
    return {"_meta": {"title": title, "notes": notes}, **nodes}


def node(cls, title, **inputs):
    return {"class_type": cls, "_meta": {"title": title}, "inputs": inputs}


def budget(n="99"):
    return {n: node("KidStudioBudget", "Budget (spent vs cap)", refresh=0)}


workflows = {}

# 01 — the model test: one sheet prompt through four image models, side by side
workflows["01_model_test"] = wf({
    "1": node("KidStudioElementFromBible", "Hazel's sheet prompt", bible_path=BIBLE, element="character:hazel"),
    "2": node("KidStudioOpenRouterImage", "Seedream 5.5", prompt=["1", 0], model="bytedance-seed/seedream-5-5", aspect_ratio="16:9", n=1, resolution="2K", custom_model="", seed=1),
    "3": node("KidStudioOpenRouterImage", "Nano Banana 2.1", prompt=["1", 0], model="google/gemini-nano-banana-2.1", aspect_ratio="16:9", n=1, resolution="2K", custom_model="", seed=1),
    "4": node("KidStudioOpenRouterImage", "GPT Image 2.6 Flare", prompt=["1", 0], model="openai/gpt-image-2.6-flare", aspect_ratio="16:9", n=1, resolution="2K", custom_model="", seed=1),
    "5": node("KidStudioOpenRouterImage", "FLUX 3", prompt=["1", 0], model="black-forest-labs/flux-3-image", aspect_ratio="16:9", n=1, resolution="1K", custom_model="", seed=1),
    "6": node("KidStudioCompareGrid", "Compare: pick the model", labels="Seedream 5.5\nNano Banana 2.1\nGPT Image 2.6 Flare\nFLUX 3",
              image_1=["2", 0], image_2=["3", 0], image_3=["4", 0], image_4=["5", 0]),
    **budget(),
}, "01 · Model test", "One character-sheet prompt through four image models (about $0.25). Pick the look; use that model for every still of the show.")

# 02 — character sheet: 4 takes, then save the pick (take 0 = look first)
workflows["02_character_sheet"] = wf({
    "1": node("KidStudioElementFromBible", "Sheet prompt from bible", bible_path=BIBLE, element="character:hazel"),
    "2": node("KidStudioOpenRouterImage", "4 takes", prompt=["1", 0], model=SHEET_MODEL, aspect_ratio="16:9", n=4, resolution="2K", custom_model="", seed=7),
    "3": node("KidStudioSaveElement", "Save the take you pick (set take, queue again)", images=["2", 0], take=0, kind="character", name="hazel", overwrite=False),
    **budget(),
}, "02 · Character sheet", "Makes 4 takes of Hazel's sheet. Look, set 'take' to the best one, queue again: it saves to library/characters/hazel.png (no new cost).")

# 03 — places and props: one branch each
br = {}
for k, (el, kind, name) in enumerate([("place:oak_exterior", "place", "oak_exterior"), ("place:hazel_room", "place", "hazel_room"),
                                      ("place:night_garden", "place", "night_garden"), ("prop:jar_lantern", "prop", "jar_lantern")]):
    a, b, c = str(10 * k + 1), str(10 * k + 2), str(10 * k + 3)
    br[a] = node("KidStudioElementFromBible", f"{name}: prompt", bible_path=BIBLE, element=el)
    br[b] = node("KidStudioOpenRouterImage", f"{name}: 4 takes", prompt=[a, 0], model=SHEET_MODEL,
                 aspect_ratio="1:1" if kind == "prop" else "16:9", n=4, resolution="2K", custom_model="", seed=11 + k)
    br[c] = node("KidStudioSaveElement", f"{name}: save pick", images=[b, 0], take=0, kind=kind, name=name, overwrite=False)
workflows["03_places_props"] = wf({**br, **budget()}, "03 · Places and props",
                                  "4 takes of each place and the lantern (16 images, about $0.50). Set each 'take', queue again to save.")

# 04 — shot draft: bible -> prompt (safety-checked) -> elements -> Seedance 2.5 Flash 480p
workflows["04_shot_draft"] = wf({
    "1": node("KidStudioShotFromBible", "Shot prompt (change shot_number)", bible_path=BIBLE, shot_number=1, safety="block"),
    "2": node("KidStudioLoadElements", "References for this shot", elements=["1", 2]),
    "3": node("KidStudioOpenRouterVideo", "Seedance draft", prompt=["1", 0], model="bytedance/seedance-2.5-flash", seconds=["1", 1],
              resolution="480p", aspect_ratio="16:9", generate_audio=True, filename_prefix=["1", 3], estimate_only=False,
              reference_images=["2", 0], reference_video_path="", reference_audio_path="", seed=1),
    **budget(),
}, "04 · Shot draft", "One shot of the bible as a cheap draft (Flash, 480p: about $0.07 per second). Judge the action; take 2 often beats a rewrite.")

# 05 — final: pick the approved take -> local upscale to 1080p
workflows["05_shot_final"] = wf({
    "1": node("KidStudioPickClip", "Approved take", shot_id="s01", take=1, folder="shots"),
    "2": node("UpscaleModelLoader", "Upscale model (local)", model_name="RealESRGAN_x2plus.pth"),
    "3": node("KidStudioUpscaleVideo", "Upscale to 1080p (local GPU)", video_path=["1", 0], target_height=1080, chunk_frames=8,
              filename_prefix=["1", 1], upscale_model=["2", 0]),
}, "05 · Shot final", "Upscales the take you approved to 1080p on your GPU (free). For hero shots, run 04 with seedance-2.5 at 720p instead.")

# 06 — continue a shot from the last frame of the previous one
workflows["06_extend"] = wf({
    "1": node("KidStudioPickClip", "Previous shot's approved take", shot_id="s03", take=1, folder="shots"),
    "2": node("KidStudioFrameFromVideo", "Its last frame", video_path=["1", 0], which="last"),
    "3": node("KidStudioShotFromBible", "Next shot", bible_path=BIBLE, shot_number=4, safety="block"),
    "4": node("KidStudioLoadElements", "References", elements=["3", 2]),
    "5": node("KidStudioOpenRouterVideo", "Seedance continues from that frame", prompt=["3", 0], model="bytedance/seedance-2.5-flash",
              seconds=["3", 1], resolution="480p", aspect_ratio="16:9", generate_audio=True, filename_prefix=["3", 3],
              estimate_only=False, reference_images=["4", 0], first_frame=["2", 0], reference_video_path="", reference_audio_path="", seed=1),
    **budget(),
}, "06 · Extend / continue", "Starts the next shot exactly where the previous one ended (its last frame as the first frame).")

# 07 — narration (local)
workflows["07_narration"] = wf({
    "1": node("KidStudioNarration", "Narrator (Kokoro, local)", bible_path=BIBLE, voice="af_heart", speed=0.88),
    "2": node("PreviewAudio", "Listen", audio=["1", 1]),
}, "07 · Narration", "Speaks every narration line of the bible offline, one wav per line, and writes the captions (.srt).")

# 08 — assemble the episode
workflows["08_assemble"] = wf({
    "1": node("KidStudioAssemble", "Assemble episode", bible_path=BIBLE, voice_dir="", music_path="", music_db=-20.0, ambience_db=-12.0,
              width=1920, height=1080, clip_list=""),
}, "08 · Assemble", "Joins the newest final (or draft) of every shot, the narration, optional music, at -14 LUFS. Put a royalty-free track path in music_path.")

# 09 — estimate the whole pilot before spending (no calls)
est = {}
for i in range(1, 9):
    est[str(i)] = node("KidStudioShotFromBible", f"Shot {i}", bible_path=BIBLE, shot_number=i, safety="block")
    est[str(100 + i)] = node("KidStudioOpenRouterVideo", f"Estimate shot {i}", prompt=[str(i), 0], model="bytedance/seedance-2.5-flash",
                             seconds=[str(i), 1], resolution="480p", aspect_ratio="16:9", generate_audio=True,
                             filename_prefix=[str(i), 3], estimate_only=True, reference_video_path="", reference_audio_path="", seed=1)
workflows["09_estimate_pilot"] = wf(est, "09 · Estimate the pilot", "Builds and safety-checks all 8 shot prompts and prints what one draft pass would cost. Spends nothing.")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, w in workflows.items():
        meta = w.pop("_meta")
        (OUT / f"{name}.json").write_text(json.dumps(w, indent=1), encoding="utf-8")
        print(f"{name}.json  {meta['title']}: {meta['notes']}")
    (OUT / "INDEX.md").write_text("# Kid Studio workflows\n\n" + "\n".join(
        f"- **{n}.json**" for n in workflows) + "\n\nRun them in order 01 → 08. 09 spends nothing and prices the pilot.\n", encoding="utf-8")


if __name__ == "__main__":
    main()
