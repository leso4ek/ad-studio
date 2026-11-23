# Riso Print / 孔版印刷 — Style Prompt

Made from a blank page; techniques from risograph in Lemo-Opuscar (borrows: silkscreen-poster). An Ad Studio style: it draws any Ad Studio bible (`skills/ad-studio-director`). Default size: 1080×1920 (a 16:9 cut is laid out from the same bible).

## 1. Essence, and what it is not
Each frame looks pulled from a stencil duplicator: three translucent inks (fluorescent pink, medium blue, yellow) overprint on warm paper; tones are halftone dots; colours mix only where inks overlap. Youthful, design-minded, indie.

It is **not** a CMYK print (no black ink, no photo halftone), not a glitch effect, not screen print with opaque inks.

## 2. Materials & rendering
Per frame the scene is drawn three times, once per ink; every primitive either prints in that ink at a tone (a dot screen at the ink's own angle) or knocks it out. Inks multiply onto paper; each ink layer is offset by its own misregistration that changes every drawing; patches of ink starvation and paper grain on top.

## 3. Colour logic
Only the three inks and their overprints. Any hex colour in a bible (cast, product) is translated to the nearest mix of the three at 0/25/50/75/100 %. Skin prints at 60 % of its mix. Night places lean blue, dusk pink+yellow.

## 4. Type & subtitles
Anton for hooks, cards and the logo, printed in blue with a pink (or yellow) double-hit offset; Space Mono Bold for small text and captions on a paper box with a pink rule.

## 5. Motion quality
On twos; registration shifts each drawing (≤ 0.3 % of the width), which is what makes holds alive. Simple eases; pops and slides as in the kit.

## 6. Camera grammar
Flat frontal staging, slow pushes; transitions are a yellow stripe wipe (stripes) or a hard cut.

## 7. Sound palette
Thumpy print-drum chunks on cuts, dry clicks for type, bright plucks ("bouncy" or "bright" moods). All music is synthesized by `studio/tools/mix.py`; no samples, no licensed tracks.

## 8. Native moves
The double-hit headline; the knock-out character against a yellow wall; rays of halftone behind the reveal.

## 9. Pitfalls of the medium
Large flat areas at 100 % get heavy and muddy; keep walls under 45 %. Dark skin needs the tone cap or faces go flat. Product greens are hard with these inks: pick riso for products whose colours sit near pink/blue/yellow, or accept the shift.

## 10. Engine
`studio/kit/styles/ad-riso-print.js`. Rendered by the library's `core/render` tools through Ad Studio's `lemo` engine. Fonts (OFL) in `studio/kit/fonts/`.

## 11. Variation space
Inks could be swapped per brand (teal/orange/yellow) by editing `INKS`; zine-like openings (a title page), endings on a printed ticket or stamp. Story, cast, places, pacing and copy are free in every ad.
