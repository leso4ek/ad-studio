# Paper Cut-out / 剪纸拼贴 — Style Prompt

Made from a blank page; techniques from paper-popup in Lemo-Opuscar (borrows: papercut-red). An Ad Studio style: it draws any Ad Studio bible (`skills/ad-studio-director`). Default size: 1080×1920 (a 16:9 cut is laid out from the same bible).

## 1. Essence, and what it is not
Every frame is a little set built from coloured card on a tabletop under one warm lamp: people, products and rooms are flat pieces layered a few millimetres apart, and the camera is a phone on a stand. Warm, homely, honest.

It is **not** a pop-up book (no folds, no hinges, no 3D tabs), not papercraft in 3D, not a clean vector flat (every piece has a shadow and a cut edge), not collage (no photo scraps).

## 2. Materials & rendering
Matte card stock in 30+ flat colours; each piece casts a soft drop shadow down-right (offset 0.35 % / 0.5 % of the frame height, blur 0.7 %), smaller for the back plane. Edges are hand-cut: each vertex is nudged by a fixed seeded amount (≤ 0.09 % of the height), and a 1-px lighter rim on the lit side. A paper-fibre texture is multiplied over the frame, plus grain on twos and a warm vignette. Face details (eyes, mouth, cheeks) are printed flat, without shadow.

## 3. Colour logic
Warm creams and sands for walls, one saturated accent per scene (tomato, marigold), product colours exactly as the brief gives them. Day, dusk and night palettes per place; night is blue card, not black. Text cards are off-white paper with near-black ink.

## 4. Type & subtitles
Fredoka 600 for cards and hooks, 500 for small text; every card is a paper strip (slightly skewed quadrilateral) with its own shadow; captions are a white strip with Fredoka 600. Label text on products is printed on the label piece.

## 5. Motion quality
12 drawings a second (on twos); each puppet nudges ≤ 0.16 % of the height per drawing, so still shots breathe. Entrances pop with a back-ease, slides take 0.5 s with ease-out. No motion blur.

## 6. Camera grammar
Mostly locked frames with a slow push (zoom ≤ 1.08 over a shot) and gentle parallax: back plane 55 %, props 75 %, floor 80 %, characters 100 %. Transitions: cut, or a paper-strip wipe in the accent colour.

## 7. Sound palette
Paper rustle on cuts, soft pops for entrances, a shimmer for the reveal, a ding on the logo; warm keys score (mood "warm" or "tender"). All music is synthesized by `studio/tools/mix.py`; no samples, no licensed tracks.

## 8. Native moves
The paper-strip card that lands with a pop; the reveal burst of paper rays behind the product; the stop-motion jitter on holds.

## 9. Pitfalls of the medium
Shadows that are too dark make it look like vector art with a drop shadow; keep them soft and warm. Too many pieces per frame read as clutter: one character, one prop group, one card. Jitter on text cards must stay tiny, or the reading check gets harder.

## 10. Engine
`studio/kit/styles/ad-paper-cutout.js` (scene via `style2d.js`, shared geometry `shapes.js`, page runtime `page.js`). Rendered by the library's `core/render` tools through Ad Studio's `lemo` engine. Fonts (OFL) in `studio/kit/fonts/`.

## 11. Variation space
Any place and cast; it can go darker (night card) or brighter (summer card). Openings: a hand-cut title strip, an empty set that fills piece by piece. Endings: the lamp dims to one lit piece. Story, cast, places, pacing and copy are free in every ad.
