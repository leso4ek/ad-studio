# Mid-century Toon / 中世纪卡通 — Style Prompt

Made from a blank page; techniques from midcentury-toon in Lemo-Opuscar (borrows: rubber-hose). An Ad Studio style: it draws any Ad Studio bible (`skills/ad-studio-director`). Default size: 1080×1920 (a 16:9 cut is laid out from the same bible).

## 1. Essence, and what it is not
An industrial-film / TV-ad cartoon from the late 50s: geometric people, flat paint, a line printed slightly off the fills, decor of starbursts and boomerangs, confident jazzy timing. Witty, nostalgic, optimistic.

It is **not** a copy of any studio or show, not rubber-hose 1930s (no bouncing limbs), not modern flat vector (the off-register line and the decor are the point).

## 2. Materials & rendering
Flat fills only; characters, props and products get a thin dark line offset up-left by 0.28 % of the height; places have no line. Wall decor: seven starbursts, boomerangs and dot pairs seeded per place, at 55 % opacity. Light paper grain multiplied.

## 3. Colour logic
Cream, mustard, teal, coral, olive, brown and charcoal; sky pastel teal; dusk and night palettes keep the same family. One bold panel colour for cards (mustard; coral for the call to action).

## 4. Type & subtitles
Pacifico for hooks and the logo (with a cream offset shadow), Josefin Sans 700 for cards on a rounded mustard panel, Josefin Sans for captions on a charcoal pill.

## 5. Motion quality
On twos, with holds: poses change on the beat rather than in-betweening; pops and slides are snappy.

## 6. Camera grammar
Locked frames, short pushes; transitions are an iris (default for wipes) or a cut.

## 7. Sound palette
Vibraphone-ish blips on cuts and type, a jazzy progression ("jazzy" mood), a ding on the logo. All music is synthesized by `studio/tools/mix.py`; no samples, no licensed tracks.

## 8. Native moves
The starburst that spins up behind the revealed product; the script hook with an offset shadow; off-register line.

## 9. Pitfalls of the medium
Too much decor fights the text; keep cards on panels. The off-register line must stay small or characters look blurred.

## 10. Engine
`studio/kit/styles/ad-midcentury-toon.js`. Rendered by the library's `core/render` tools through Ad Studio's `lemo` engine. Fonts (OFL) in `studio/kit/fonts/`.

## 11. Variation space
Any domestic or street scene; openings on a title panel; endings on the starburst with the logo. Story, cast, places, pacing and copy are free in every ad.
