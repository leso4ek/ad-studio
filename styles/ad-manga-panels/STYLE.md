# Manga Panels / 漫画分格 — Style Prompt

Made from a blank page; techniques from manga-panels in Lemo-Opuscar (borrows: comic-history). An Ad Studio style: it draws any Ad Studio bible (`skills/ad-studio-director`) from the shared shapes, with no image generation. Default size: 1080×1920 (a 16:9 cut is laid out from the same bible).

## 1. Essence, and what it is not
Each frame is a printed comic page in motion: ink on warm paper, greys made only of dots and lines, and the shot cut into panels when the beat needs it. The product is the hero because it is the only thing in colour. The tone is light and comic: a small domestic drama told with big comic gestures.

It is **not** a colour comic (one spot colour, no process colour), not a pencil sketch (every line is inked and closed), not a grey photo filter (no smooth grey or alpha anywhere), and not a copy of any existing series, artist, character or lettering.

## 2. Materials & rendering
- **Paper** `#F4F1E8` and **ink** `#141414`, with a light paper grain multiplied over the frame.
- **Ink line:** every shape is filled, then outlined; the outline swells on the lower-right (a second ink silhouette offset down-right under the fill), so contours look brushed rather than ruled. Big shapes get heavier lines, small ones (leaves, details) thinner; line width is corrected for camera zoom so close-ups are not crude.
- **Screentone:** five dot coverages (15–62 %) on a 45° lattice, horizontal line tone for floors, diagonal line tone for wood, and a dot gradient that fades the wall from tone at the top to paper. Tones are fixed to the screen, not the camera, so they never grow in a close-up.
- **Faces:** skin is paper; eyes get a paper catch-light; blush is three hatch strokes; black hair gets a paper highlight arc. Clothes in tone get a denser cel shadow on the side away from the upper-left light.
- **Effect lines** (focus lines, gloom lines, speed lines) are tapered ink wedges and redraw with a new seed 12 times a second.

## 3. Colour logic
Paper, ink and dot/line tone only. **One spot colour: the product's brand colour** (`product.colors.body`), printed flat on the product body with a dot shadow and a paper glint, and allowed on the graphics that speak for the product (the logo underline, the CTA tag). Characters, places, props and lettering stay black and white. Any hex colour in the bible (cast, props) becomes the nearest tone by luminance. Dusk deepens the tones; night is mostly dense tone and solid black. Light is shown by leaving paper, never by adding grey.

## 4. Type & subtitles
OFL fonts in `studio/kit/fonts/`: **Bangers** for shouts (hook, logo) and sound effects; **Comic Neue Bold** for narration boxes, captions, lines and the CTA.
- **Hook / logo:** hand-lettered shout, three layers (wide ink, paper, ink fill), letters slam in one after another with overshoot.
- **Cards:** narration boxes — paper box, ink border, solid ink drop shadow offset down-right.
- **CTA:** the same box in the spot colour with paper lettering.
- **Captions:** speech balloons (rounded superellipse, ink outline); the tail points at the speaking character when they are on screen, otherwise down and out of the panel for an off-frame narrator.
- **Sound effects** are drawn from the shot's content (annoyed → GRR + anger mark, a falling drop → PLIP, the reveal → SHING!, a lone drooping plant → DROOP...). They may cross panel borders but always slide clear of text boxes.

## 5. Motion quality
On twos (12 drawings a second). Cards slam from 1.2× with a back-ease; shout letters stagger 0.03 s, sound-effect letters 0.055 s. Effect lines boil; figures and tones do not. A sweat drop slides, sparkles twinkle. No motion blur and no alpha fades: things wipe, slam or dissolve through a halftone.

## 6. Camera grammar
The **panel is the cut**. Layouts are chosen deterministically from the shot:
- most shots: **one panel** with paper margins;
- **hook:** three panels — the wide scene, and a right-hand column of two close-up inserts (the key prop, then the product), split by slanted gutters;
- **pulse with the product at the frame edge:** two panels — the scene and a tall product insert with a small focus burst;
- **reveal:** two panels split by a slanted gutter; the product **breaks out of its panel** (paper rim + ink rim), focus lines converge on it, speed lines fill the upper panel;
- **end card:** a title-page panel with focus lines; the product breaks out of its top border; logo, line and CTA sit on bare paper below.
Insert panels are camera crops of the same scene (zoom 1.35–4.2, a slow push). Later panels start as dashed empty frames and ink in, in reading order, 0.12 s apart. Main panels keep the shot's own camera.

## 7. Sound palette
Ink-brush swish on each panel ink-in, paper slaps for cards, a metallic glint for the reveal, short comic hits under the sound effects; a bright, light score (mood "playful" or "upbeat"). All synthesized by `studio/tools/mix.py`.

## 8. Native moves
- **Empty panel → filled** (dashed border inks in on the beat).
- **Wide + inserts** (the same moment seen whole and in close-up).
- **Break the frame** for the product reveal and the end card.
- **Impact frame:** a reveal shot opens on two inverted frames.
- **Mood marks:** gloom lines over a sulking subject, an anger mark, a sweat drop, sparkles around a happy face.
- **Transitions:** wipe/slide = a slanted paper edge with an ink line and speed lines; fade = a halftone dissolve (paper dots shrink away); others = an ink iris or ink stripes.

## 9. Pitfalls of the medium
Any smooth grey or alpha breaks the print look: tone everything. Too many panels make a 9:16 frame unreadable: two or three at most, and only on hook and reveal beats. Cards and captions sit in fixed bands (top and lower third), so panels and sound effects must leave those bands readable. The spot colour leaking onto clothes, walls or lettering makes it a colour comic. Small leaves with full-weight outlines turn into clutter; keep detail lines thin.

## 10. Engine
`studio/kit/styles/ad-manga-panels.js` (panels, tones, effect lines and lettering; scene drawing through `style2d.js`'s `drawScene`, called once per panel inside a clip; shared geometry `shapes.js`; page runtime `page.js`). Rendered by the library's `core/render` tools through Ad Studio's `lemo` engine. Fonts (OFL, licences beside them): `Bangers-Regular.woff2`, `ComicNeue-Bold.woff2`.

## 11. Variation space
Any place, cast and product; the spot colour always follows the brand. Can run lighter (sparse tone, sunny) or heavier (dense night tone, more black). Openings: a single sound effect on an empty panel, a wide panel that splits into inserts. Endings: the title-page end card, or a last panel left as a dashed empty frame. Story, cast, places, pacing and copy are free in every ad.
