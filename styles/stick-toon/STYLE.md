# Stick Toon (what-if channel), three.js

An original look for "what if" explainers: a stickman host and simple 3D objects, drawn like a flat cartoon.

## Look
- **Shading:** `MeshToonMaterial` with a 3-step gradient map and nearest filtering, so the bands are hard.
- **Ink:** every solid gets an inverted-hull outline in ink `#17171C`, about 0.05 world units.
- **Backdrops:** paper cream `#F3EAD7` with fibre grain for the board and explainer scenes; deep navy gradients for space and night.
- **Accents:** yellow `#FFD447` cards, red `#E2453C` string and pins, cyan `#CDEBFF` answer cards.
- **Type:** Archivo Black (OFL) for every card; cards are drawn on a 2D overlay canvas or on canvas textures.

## Pip, the host
- **Head:** a big round head with round glasses, a hair curl and an orange scarf.
- **Body:** an ink stick body, a planar 2-bone rig.
- **Poses:** idle, point, pointL, shrug, think, lookUp, shock, cheer, wave, scratch, blended by weight.
- **Face:** the mouth follows the narration's loudness (`voice/env30.json`); the eyes blink.
- **Never copy** another channel's mascot (bow ties, specific faces), logos or real people. The reference image only sets the grammar: thick outlines, round heads, a red-string board.

## Grammar
- **The board:** the big question is pinned in the middle. Each answered sub-question is pinned around it, and a red string draws from it to the big card.
- **Headers:** every sub-question opens with a numbered yellow header card ("1 · …").
- **Answers:** every answer lands as one short card ("TIDES ÷ 3") or a red stamp ("NO").
- **Camera:** 62 % static or slow eased push-ins (about 4 % a second), from `research/viral/camera/SUMMARY.md`. A shot changes every 5–15 s.

## Code
- `ads/what-if-moon/film/`:
  - `toon.js`: materials, outlines, sticks, cards, backdrops;
  - `pip.js`: the host;
  - `film.js`: the scenes and the timeline from Whisper word times;
  - `render.mjs`: headless Chromium, frame by frame, piped to ffmpeg;
  - `finish.mjs`: word captions via the edit engine, mux, −14 LUFS.
- About 0.6–1.5 s per frame on cloud CPU (SwiftShader). Render 4 chunks in parallel.
