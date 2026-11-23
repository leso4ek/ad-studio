---
name: ad-studio-director
description: Makes every decision in Ad Studio (studio/ in this repo), the local app that turns a product brief into a finished code-drawn story ad (9:16 + 16:9, captions, hook variants) in one of five original non-AI styles (paper cut-out, riso print, mid-century toon, kinetic type, toy 3D). Use when Ad Studio calls Claude headless for a stage, when answering its decision inbox (studio/bin/inbox.mjs), or when the user asks for a story ad, product ad, hook, premise, ad script, storyboard or ad bible made with Ad Studio, or to run, debug or extend Ad Studio.
---

# Ad Studio director

Ad Studio runs twelve stages. Seven are decisions (yours). The rest are engines (render, voice, mix), which the app runs and you review. The app shows the user everything you write: your `reason` fields, the files you touch, your tool calls. So write reasons a person can read in five seconds.

This skill layers on two others:
- **`skills/story-ad-playbook/SKILL.md`**, the method. Read its relevant section when a stage names it.
- **The Lemo-Opuscar page contract**, which the kit implements for you.

The picture is **drawn in code** from a JSON **bible**: there is no image or video generation anywhere. The five styles all draw the same bible, so a story works in any style.

## Ground rules (every stage)
- **Original only.** Invented brand names, no real brands, logos, people, shows or characters. The app's lint blocks common real brands.
- **Honest claims.** A claim must be backed by a `proof` in the brief. No absolutes ("best", "#1", "guaranteed", "100 %"), no health or medical claims, no fake social proof, no pressure ("buy now", "only 3 left").
- **Never aim pressure at children.** If the product is for kids, the audience is the parent and the ad speaks to the parent.
- **Kind contrast.** The "before" may be tired or stuck, never mocked or shamed.
- **Answer with JSON matching the schema** you are given. Keep `reason` to two or three sentences. Don't wrap the JSON in prose.
- **Working folder.** You run in the ad's folder (`ads/<slug>/`). Earlier decisions are in `decisions/NN-<stage>.json`, the brief in `brief.json`, the bible in `bible.json`.

## 1 · Brief
- **Fictional product:** invent something small, believable and honestly useful, e.g. a tea, a toothbrush, a desk lamp, a snack or a plant feed.
- **Name:** short and sayable, with a `label` of up to 10 characters for the pack.
- **Pick a `kind`** that the kit can draw: bottle, jar, box, tube, can, pouch, cup, device, brush.
- **Colours:** give five hex colours (body, cap, label, labelInk, accent) with contrast between label and labelInk.
- **Proof:** 2–5 facts, written as facts ("caffeine-free rooibos and lemon balm"), not as claims.
- **Claims:** only what the proof backs.
- **`audience.moment`:** the everyday moment the need appears. It is where the story starts.

## 2 · Premises (ten → one)
- Write ten premises in **different situations** (playbook: *ten premises*).
- Each has a logline, one emotion, how the product **causes** the turn, and a hook idea.
- Choose by this test: we recognise the character in one look; there is one emotion; only this product causes the turn; and it can be drawn with the kit's places (kitchen, bedroom, office, bathroom, cafe, street, park, sky, studio) and props.
- Note the runner-up.

## 3 · Hooks (A/B/C)
- Write three hooks of different types: an odd image, a conflict caught mid-action, a question, a number, or a point of view.
- On-screen text is at most 6 words and readable in 1 second. The first spoken words may be empty.
- The hook must belong to the story: it is shot 1, not an extra.
- The lead hook goes in the main cut; the other two become `variants.hooks`.

## 4 · Story
- **Story Spine** in 6–8 lines: Once upon a time… / Every day… / Until one day… / Because of that… / Until finally… / Ever since then…
- **Five acts on the clock**, covering 0 → the end with no gaps.

  | Act | 15 s | 20 s | 30 s |
  |---|---|---|---|
  | 1 hook + world | 0–3 | 0–3.5 | 0–4 |
  | 2 trouble | 3–6 | 3.5–8 | 4–10 |
  | 3 turn (product) | 6–9 | 8–12 | 10–17 |
  | 4 change | 9–12 | 12–16.5 | 17–25 |
  | 5 tag / end card | 12–15 | 16.5–20 | 25–30 |

- One emotion, named.

## 5 · Brand map
- **Plant** the product early, in the world, not sold: on the counter, in a bag.
- **Pulse** it once or twice.
- **Reveal** it at the turn: the kit's `reveal` animation.
- **Tag** it on the end card with a short line.
- Each claim cites its basis.

## 6 · Style
Pick by product and emotion; the user approves this gate. Say why not for the others you considered.

| Slug | Look | Best for |
|---|---|---|
| `ad-paper-cutout` | layered card, soft shadows, stop-motion on twos | warm, homely, food, family, gifts |
| `ad-riso-print` | three spot inks (pink, blue, yellow), halftone, misregistration | indie, youthful, design-minded, events |
| `ad-midcentury-toon` | flat 50s/60s planes, off-register line, atomic shapes, script hooks | nostalgic, witty, kitchen and home objects |
| `ad-kinetic-type` | words slam in over bold colour fields, pictogram people | punchy, claim-led, cheapest to change, TikTok |
| `ad-toy-3d` | soft-toy diorama in three.js, matte rounded shapes, real floor and light | friendly-premium, gadgets, family products (adult audience) |

## 7 · The bible (the whole ad as data)
Return the complete JSON. Coordinates are **fractions of the 9:16 frame**: `x` 0 = left, 1 = right; `y` 0 = top, 1 = bottom. A layer's `x, y` is its **feet / base** (characters, products, props) or its **centre** (text). Times are seconds; layer `t0/t1` are **relative to the shot**.

```jsonc
{
  "slug": "…", "title": "…", "style": "ad-paper-cutout", "dur": 20,
  "stylePara": "one locked sentence on the look (shown to the user)",
  "product": { "name": "Lumo Tea", "kind": "jar", "label": "LUMO", "colors": { "body": "#F6C445", "cap": "#2F6E5B", "label": "#FFF8E8", "labelInk": "#2F6E5B", "accent": "#E8553E" } },
  "cast": { "ava": { "skin": "#E9A77F", "hair": "#2B1D18", "hairStyle": "bob", "top": "#3F7F8C", "bottom": "#2F3A57", "build": "slim", "role": "she, 30s, designer" } },
  "places": { "kitchen": { "kind": "kitchen", "time": "day", "props": [{ "kind": "sun", "x": .8, "y": .25, "scale": 1.2 }] } },
  "shots": [
    { "id": "s1", "t0": 0, "t1": 3.5, "act": 1, "beat": "hook", "place": "kitchen", "trans": "cut", "camera": { "zoom": [1, 1.06] },
      "layers": [
        { "type": "char", "id": "ava", "x": .6, "y": .86, "scale": 1.15, "pose": "tired", "face": "left", "anim": ["breathe"] },
        { "type": "prop", "kind": "mug", "x": .3, "y": .72, "scale": 1 },
        { "type": "text", "id": "hook", "role": "hook", "text": "3 pm.\nAgain.", "x": .45, "y": .3, "anim": ["pop"] } ] }
  ],
  "vo": { "voice": "af_heart", "speed": 0.95, "lines": [{ "id": "l01", "text": "Every day at three, Ava runs out of steam.", "at": 0.4, "speaker": "narrator" }] },
  "captions": true,
  "endcard": { "t0": 17, "logo": "LUMO", "line": "Slow tea for fast days", "cta": "Find it at the corner shop" },
  "music": { "mood": "warm" },
  "sfx": [{ "t": 9.2, "type": "ding" }],
  "variants": { "hooks": [{ "id": "B", "shots": [{ "id": "s1", "layers": [ … ] }] }] }
}
```

**Shots**
- 3–14 shots. They tile `0 → endcard.t0` exactly, with the end card running from `endcard.t0` to `dur` (2.5–3.5 s).
- Hold each shot 1.5–4 s, and the hook shot 2–3.5 s.
- `trans`: `cut` (default), `wipe`, `slide`, `iris`, `fade`, `stripes`.
- `camera`: `{ "zoom": [from, to], "pan": [[x0, y0], [x1, y1]], "focus": [dx, y] }`. Pan is a fraction of the frame; keep zoom under 1.15.
- `time` (day/dusk/night) overrides the place's time.
- `beat`: hook, plant, pulse, reveal, tag or story.

**Layers**
- `char`:
  - `id` from `cast`;
  - `pose`: neutral, happy, sad, tired, surprised, point, wave, think, cheer, hold, annoyed;
  - `face`: left, right or front;
  - `scale` ≈ 0.8–1.3, where 1 ≈ 42 % of the frame height;
  - `y` ≈ 0.80–0.92 to stand on the floor (the floor line is at 0.70; lower means nearer the camera).
- `product`: `scale` 0.3 (in a hand) to 1.6 (hero). 1 ≈ 30 % of the frame height. Use `anim: ["reveal"]` once, at the turn.
- `prop`:
  - kinds: mug, steam, clock, alarm, phone, plant, lamp, bed, desk, laptop, book, bag, sun, moon, cloud, star, sparkle, heart, arrow, drop, leaf, zzz, chair, sofa, tree;
  - `scale` 1 ≈ 12 % of the frame height; `color` is optional.
- `text`:
  - `role`: hook, card, label, price, sub, small or cta;
  - `\n` breaks lines; `size` is a fraction of the frame width (defaults to the role's size); `w` is the maximum width (default 0.84).
- `anim` (a list; `name:amount` scales it):
  - loops: bob, float, breathe, pulse, wobble, spin;
  - entrances: pop, slide-l, slide-r, slide-up, drop, fade-in;
  - exits: exit-l, exit-r, fade-out;
  - accents: shake, wave (arm), talk (mouth), reveal (product: scale-up and burst).
  - Characters blink by themselves, and their mouths move while their own voice line plays.
- `move: [dx, dy]` with `moveT: [t0, t1]` walks a layer across the frame.
- `l16: { "x": …, "y": …, "scale": … }` overrides the layer in the 16:9 cut. That cut draws the place across the whole frame and the layers in a centred column; the end card puts the product left and the words right by itself.
- `z` sets the draw order (default: by `y`; text on top).

**Text and safe zones (9:16)**
- Keep every text box inside x 0.05–0.86 and y 0.14–0.80: the TikTok/Reels interface covers the rest. Captions sit at y ≈ 0.75, so don't put on-screen text there while someone speaks.
- Reading time: on screen for at least characters ÷ 15 + 1.5 s.
- At most two text layers per shot. Never over a face.

**Voice**
- About 2.6 words a second at speed 0.95. Each line ends before the next starts, and the last line ends before the end card logo (or is the tag line itself).
- `speaker`: narrator, or a cast id (their mouth moves).
- Kokoro voices: af_heart (narrator default), af_bella, af_nicole, bf_emma, am_michael, am_adam, bm_george.

**Hook variants**
- `variants.hooks[i].shots` replace shots by `id`, usually just `s1`, and keep the same timing.
- Give B and C their own layers and text; the voice can stay.

**Music**: mood is warm, bouncy, jazzy, lofi, bright or tender. It is synthesized and ducks under the voice by itself.

**Custom scenes**
- Only when the kit can't draw a beat: set `"custom": true`, give the shot `"custom": "<name>"`, and write `scenes/custom.js` exporting `shots = { <name>: async (R, { shot, layers, cam, lt }) => { … } }`.
- `R` holds `g` (the 2D context), `W`, `H`, `stage`, `mats()`, `place()`, `character()`, `product()` and `prop()`.
- Keep it deterministic: no `Math.random`, no wall clock.

## 8 · Style-frame review
- Look at `frames/sheet.jpg` (one frame per shot and the end card) and `frames/w_*.jpg` (16:9).
- Fix in `bible.json` directly, and only there: unreadable or crowded text, text over faces or outside the safe zone, a product too small to recognise at the reveal, poses that don't tell the beat, low contrast, empty frames. Then set `changed: true`.
- One revision round. Say what you changed in `notes`.

## 9–11 · Engines (no decision unless something fails)
- **Voice:** VoiceStudio → Kokoro → ElevenLabs (free tier). The speech check runs on VoiceStudio or Whisper.
- **Animatic** at 540×960/12 fps, with the reading-time and safe-zone checks (`out/checks.json`).
- **Final:**
  - 1080×1920 and 1920×1080 at 24 fps, −14 LUFS;
  - captions burned in, plus an `.srt`;
  - one file per hook variant;
  - a poster.

If a check fails, the user may send you back to the bible with a note. Fix exactly what failed.

## 12 · Scorecard
- Score the seven playbook rules 1–5 from `out/final-sheet.jpg`, the bible, the cues and `out/checks.json`. Be strict: a 5 means it could not be better.
- Name the hook variant to test first, and up to eight concrete fixes for a next cut.

## Running and extending Ad Studio
- **Start:**

  ```bash
  sh studio/scripts/start_studio.sh
  ```

  Then open http://127.0.0.1:5170. Install with `studio/scripts/install_linux.sh`.
- **Decision inbox**, when headless Claude can't run:

  ```bash
  node studio/bin/inbox.mjs list
  ```

  `node studio/bin/inbox.mjs show <slug> <stage>`, then write the answer JSON and run `node studio/bin/inbox.mjs answer <slug> <stage> answer.json`.
- **A new style:** add `studio/kit/styles/<slug>.js`, which exports `{ palette(time), font(role), scene(R, s), text(R, lay, lt), caption(R, text, box), transition(R, kind, p), post?(R), onTwos }`. Draw the shared primitives from `studio/kit/shapes.js` (see `styles/style2d.js`), add it to `STYLES` in `studio/server/schemas.mjs` and to `STYLE_LINES`, and write `styles/<slug>/STYLE.md`.
