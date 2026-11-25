# Sitcom Toon / 情景喜剧卡通 — Style Prompt

Made for Ad Studio from the grammar of the scifi-toon style in Lemo-Opuscar (rules followed in code; this text is our own). Inspired by adult-animation sitcom cartoons in general, never by one show. An Ad Studio style: it draws any Ad Studio bible (`skills/ad-studio-director`). Default size: 1080×1920 (a 16:9 cut is laid out from the same bible).

## 1. Essence, and what it is not
A late-night TV cartoon about ordinary people: a tired person in a slightly grubby suburban kitchen, an everyday problem, and a product that turns up like a piece of household sci-fi hardware. The jokes are in the faces and in the holds: a deadpan stare, a beat of nothing, then the turn.

It is **not** a kids' cartoon (no blush, no bouncing, no sparkly eyes), not a clean vector explainer (every line wobbles), not anime. It never copies a real show: no lab-coat genius, no young sidekick, no swirling green portal, no show names, no catchphrases. Cast, props and gadgets are invented for each ad.

## 2. Materials & rendering
- **Line:** one purple-black ink (`#2A1A35`) around everything, ≈ 0.68 % of the short side for characters, props and product, a little thinner for the set. Width is divided by the camera scale, so a push-in never thickens it. Small pieces (fern leaves, knobs) get a thinner line so they don't clog.
- **Boil:** every outline is resampled to ≈ 1.1 % steps and pushed through a smooth displacement field (≈ 0.13 % of the short side); three boil drawings cycle on twos, so a held frame is never dead. A fixed extra wobble keeps shapes slightly off-model.
- **Fill:** flat colour plus exactly one hard-edged cel shadow per piece, on the lower right (light from the upper left). The shadow tone is the fill pushed 30 % toward a deep violet. No gradients anywhere; glows are flat stepped shapes.
- **Faces:** redrawn by the style. Big white eyes that touch, tiny dot pupils that glance sideways, heavy upper lids (40 % shut at rest), eye bags, short heavy brows, a hooked nose line in three-quarter view, small mouths (a flat line, a smirk, a pursed side mouth, an open mouth with a dark interior and a tongue when talking). Every pose maps to lids + gaze + brows + mouth (e.g. annoyed = 56 % lids, side-eye, angry brows, tight mouth). Every ~2 s the lids twitch for one drawing.
- **Product as gadget:** outline, cel shadow, two sharp white highlight streaks, and a four-point glint on the cap every ~1.6 s. On a pulse it throws little lightning zaps.

## 3. Colour logic
Saturated but slightly dirty suburbia: mustard walls, mint tiles, terracotta cupboards, dusty purple lino with a receding checker, sky in flat bands. Day, dusk (orange and plum) and night (indigo) palettes. Ink and eye white never change. The **mint glow** (`#62F0D4`) is reserved for gadget accents — the wall panel's readout, the LED on cards, the reveal burst, zaps, transitions — and nothing else. Product colours are used exactly as the brief gives them.

## 4. Type & subtitles
- **Hooks:** Archivo Black, sunny yellow with a thick ink outline and a hard tomato drop, tilted a few degrees, like a TV title card. The **logo** uses the product's body colour with a yellow drop.
- **Cards:** Archivo Black ink text on a cream panel with a boiling ink outline, a hard ink offset shadow and a small mint LED in the corner (the panel is a gadget screen, not a speech bubble).
- **Captions:** Baloo 2 ExtraBold, white with a heavy ink outline and no box, the way cartoon captions look. Sub, label and small text use the same treatment.
- **CTA:** Baloo 2 in a yellow pill with an ink outline.
- Fonts are all OFL and already in `studio/kit/fonts/` (Archivo Black, Baloo 2, Space Mono loaded for screen work).

## 5. Motion quality
Everything on twos (12 drawings a second): poses, faces, boil, glints, zaps. Cards and hooks pop in over 0.25 s with a small overshoot, then hold dead still while their panel line keeps boiling. Acting over moving: a lid twitch, a glance, a gulp rather than big motion. The reveal burst grows in, its points flick on twos.

## 6. Camera grammar
Mostly locked medium shots with slow pushes; a hard cut to an insert of the absurd detail (the sulking plant, the cap); a reaction shot after every absurd image. Transitions are never dissolves: a **zap wipe** (a zigzag ink band edged in mint) for "wipe", a notched ink iris for "iris", and an **old-TV channel flip** (the frame snaps open from a bright line, stepped) for "fade".

## 7. Sound palette
A small sitcom kit: hard-cut silences for the deadpan beats, a pop for card entrances, a whoosh/cut on the zap wipe, a shimmer on the reveal, a ding on the logo (the page's `pop`, `cut`, `whoosh`, `reveal`, `type`, `logo` events). Score from `studio/tools/mix.py`, moods "bouncy" or "jazzy" for the comedy, "lofi" for a deadpan cut; no samples or licensed tracks. Wishlist for the mixer: an electric zip for the wipe and a "ting" for the cap glint.

## 8. Native moves
- **The deadpan hold:** tired lids, side-eye, nothing moves but the boil — then the line lands.
- **Hardware as junk:** the everyday product gets gadget treatment (glint, zaps, glowing readouts) while everyone acts like it's normal.
- **The ta-da burst:** a jagged two-layer comic burst (pale yellow, then mint) behind the product on the reveal, with sparkles and zaps.
- **The channel flip:** a time jump or mood change done like changing channels on an old set.

## 9. Pitfalls of the medium
- A mint oval behind the product reads as a portal: keep the reveal a jagged burst.
- Thick lines on tiny pieces turn to mud: line width follows piece size below a threshold.
- Too much boil on text panels makes reading harder: panels boil at 80 %, letters never do.
- Glow everywhere kills the gag: one gadget accent per shot, plus the reveal.
- Fronds and leaves at large scale are many pieces: the fern close-up is the busiest frame, so keep cards above it.

## 10. Engine
`studio/kit/styles/ad-scifi-toon.js` (scene via `style2d.js`, shared geometry `shapes.js`, page runtime `page.js`). The style redraws character faces from the head shape and the layer's pose, adds the kitchen tiles, cupboard knobs, lino checker and a wall-mounted gadget panel, and draws its own transitions. Rendered by the library's `core/render` tools through Ad Studio's `lemo` engine.

## 11. Variation space
Any place, cast and product. Night palettes make the gadget accents glow more; a "suspiciously normal" beige set can be its own joke. Openings: mid-sigh (the deadpan stare is already happening), a gadget readout, a channel flip into the scene. Endings: the ta-da burst, a final deadpan reaction, a channel flip to the end card. Story, cast, places, pacing and copy are free in every ad.
