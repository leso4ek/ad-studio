# Crayon Picture Book / 蜡笔绘本 — Style Prompt

Made from a blank page; follows the rules of crayon-book in Lemo-Opuscar (our own wording and code). An Ad Studio style: it draws any Ad Studio bible (`skills/ad-studio-director`). Default size: 1080×1920 (a 16:9 cut is laid out from the same bible).

## 1. Essence, and what it is not
Each frame is a page from a gentle picture book for grown-ups, coloured in wax crayon on warm cream paper. The kitchen, the person and the product are drawn the way a careful adult copies a child's hand: round heads, tube arms, wobbly lines, colour that runs a little past the edge. Calm, tender, a bit funny, honest.

It is **not** a vector illustration with a crayon filter (the texture comes from how wax sits on paper, not from an overlay), not chalk on a board, not a watercolour painting, not a scribbly kids' doodle (the composition stays clear and adult). It never imitates any particular book, illustrator or character.

## 2. Materials & rendering
- **Paper:** warm off-white (`#F5EFE1`). Its tooth is a tileable field of fine value noise (about 1.7, 3.8 and 11 px cells) plus horizontal fibre streaks, lightly embossed from the top left. A soft blotchy mottle and a warm vignette are multiplied over the finished frame.
- **Wax only reaches the peaks:** after a group is coloured, paper-coloured "pit" tiles are laid over its own shapes, so the tooth breaks the colour. Pressure decides how much: back wall misses about 30 % of the tooth, floor 24 %, props 19 %, people and the product 13 %, lettering 5 %. The pits are anchored to the page plane, not to the screen.
- **Colouring:** every shape gets a thin wax under-layer plus layered hatching from a per-colour tile: pairs of back-and-forth strokes at about −27°, a lighter cross pass, and short skips along the stroke where the crayon jumped. The fill is shifted a few pixels by a seeded amount, so colour overshoots the line on one side and leaves a sliver of paper on the other.
- **Outlines:** a darker stick of the same hue (mixed towards indigo, never black), drawn as a firm pass plus a thin streaky pass, with a low-frequency hand wobble. Closed outlines overlap where they meet. Heaviest on people, about 60 % weight on rooms; tiny pieces (fern leaves) get a single thin line.
- **Occlusion:** a front piece blanks out what is behind it before it is coloured, and people, products and props keep a thin halo of bare paper around them, as if coloured round carefully.
- **Faces and labels** go on last, pressed hard: dot eyes with a white catchlight, a crayon mouth, pink hatched cheeks; label words hand-lettered in the label ink.

## 3. Colour logic
A box of about a dozen crayons per time of day: lemon wall, mint lower wall, terracotta floor, toffee cabinets, sky blue, two leaf greens, marigold, coral. Day, dusk (apricot and mauve) and night (deep blue, never black). The line colour is indigo `#2E2852`. Product colours are used exactly as the bible gives them; value comes from pressure, not from more hues. One accent per frame (coral for swashes, marigold for the reveal rays and the CTA band).

## 4. Type & subtitles
- **Titles and hooks:** Gaegu Bold (OFL), indigo, lettered glyph by glyph: each letter has its own small tilt and baseline drop, boiling slightly on twos, written left to right in up to 0.6 s. They sit on a hand-torn patch of blank paper with a faint pencil edge; the hook gets a coral swash under its last line.
- **Captions** are the book's printed words: Patrick Hand (OFL), about 56 px, indigo, on a ragged patch of blank paper (never a dark box), written on in about 0.3 s from the cue start.
- **Logo:** Gaegu Bold in the product's body colour, hatched, with a darker outline. **CTA:** indigo letters on a marigold crayon band.
- Letters are positioned one by one with no ligatures, so spacing never collapses. The tooth touches lettering only lightly, for legibility.

## 5. Motion quality
On twos (12 drawings a second). Lines boil under a pixel per drawing: people fully, the room at about 60 %, room colouring stays still (it also keeps files small). People's hatching drifts by a few pixels per drawing. Entrances and moves come from the bible's animations; nothing is motion-blurred.

## 6. Camera grammar
Mostly a locked page with slow pushes (zoom ≤ 1.08) and gentle parallax between the back wall, props, floor and people. No dissolves: transitions are a **page turn** (wipe/slide: a blank sheet peels away with a curl and a soft shadow), a **scribbled iris** (iris), or the new page **coloured in** by back-and-forth crayon rows that clear a blank sheet (fade/stripes).

## 7. Sound palette
Small wooden and metal-toothed instruments: ukulele or nylon guitar, clarinet, glockenspiel, toy piano, a music box for the end card. Foley follows the material: crayon swishes for card write-ons, a page turn on wipes, a soft pencil tap for pops. Silence is allowed as a beat. A warm, unhurried narrator a few dB over the bed; mix to −14 LUFS. All music is synthesized by `studio/tools/mix.py`.

## 8. Native moves
- **Colouring is the action:** a page coloured in as the shot arrives; a scribbled swash to underline the hook.
- **The kept-white halo:** people and the product sit in a ring of bare paper, so the product reads instantly.
- **Crayon sun-rays** scribbled in behind the product at the reveal.
- **Child logic:** faces on objects, numbers in the sky, wrong perspective, when the story wants it.

## 9. Pitfalls of the medium
- Too much tooth turns into "snow": keep pits fine (1–4 px) and fractions low on dark colours.
- A whole-frame off-screen compositing pass per group is slow; paint straight onto the page and lay the pit tiles only over the group's own shapes.
- Measuring a string prefix includes ligatures ("ff", "ll") and collapses spaces when glyphs are drawn one by one: sum single-glyph advances instead.
- Re-randomising the hatching offset every drawing makes figures flicker; drift it by a few pixels only.
- Thin strips (counter edges) outlined twice turn into mud: very thin pieces get a solid fill and no outline.

## 10. Engine
`studio/kit/styles/ad-crayon-book.js` (scene via `style2d.js`, shared geometry `shapes.js`, page runtime `page.js`). Textures (tooth, pit masks, paper, per-colour hatch tiles, mottle) are built once in `setup`; a frame draws in about 30 ms of canvas work at 1080×1920. Fonts: Gaegu Bold and Patrick Hand (SIL OFL 1.1, from Fontsource) in `studio/kit/fonts/` with their licences.

## 11. Variation space
Any place, cast and time of day; a softer box (pastels) or a bolder one (primaries). Openings: a blank page coloured in row by row, a hook hand-lettered on an empty page. Endings: the page turns to the product on blank paper, the reveal rays scribbled in, the logo lettered in the product's colour. Story, cast, places, pacing and copy are free in every ad.
