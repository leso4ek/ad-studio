# Kinetic Type / 动态字体 — Style Prompt

Made from a blank page; techniques from swiss-motion in Lemo-Opuscar (borrows: text-flash-cuts). An Ad Studio style: it draws any Ad Studio bible (`skills/ad-studio-director`). Default size: 1080×1920 (a 16:9 cut is laid out from the same bible).

## 1. Essence, and what it is not
A type-led ad: each shot is a bold colour field, a headline that lands word by word, flat pictogram people and a ghosted place silhouette; the product is the only object in full colour, with one gloss highlight. Fast, punchy, cheapest to re-cut.

It is **not** a slideshow (every word moves), not a lyric video, not a UI demo.

## 2. Materials & rendering
Fields from red, black, blue, lime, paper and pink, one per shot (or `bg`); the place is drawn at 13 % as a two-tone silhouette; people and props are single-colour pictograms with features knocked out in the field colour; the product keeps its brand colours with a soft shadow and a gloss bar. A light overlay grain.

## 3. Colour logic
Field colour, plus black or paper text chosen for contrast; a lime (or pink on lime) marker bar under the last line of a hook or card.

## 4. Type & subtitles
Archivo Black for hooks, cards and the logo; Inter 800 for small text and captions (paper on black boxes).

## 5. Motion quality
Full 24 fps. Each word starts at +0.11 s (0.05 s for small text) and scales from 1.45 to 1 with a back-ease in 0.22 s; the marker bar draws in after the words.

## 6. Camera grammar
Hard cuts on the beat and a black panel push with a lime edge for slides/wipes; little camera motion.

## 7. Sound palette
Dry clicks on cuts and words, a driving "bright" or "bouncy" score. All music is synthesized by `studio/tools/mix.py`; no samples, no licensed tracks.

## 8. Native moves
The word slam; the marker bar; the product ringed by expanding circles at the reveal.

## 9. Pitfalls of the medium
Too many words per shot: keep to 2–6. The reading check counts full text from the first frame, so slams must start early in the shot.

## 10. Engine
`studio/kit/styles/ad-kinetic-type.js`. Rendered by the library's `core/render` tools through Ad Studio's `lemo` engine. Fonts (OFL) in `studio/kit/fonts/`.

## 11. Variation space
Any copy-led story; works without characters at all; endings on a paper field with the logo. Story, cast, places, pacing and copy are free in every ad.
