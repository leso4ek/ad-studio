# 90s Apocalypse Anime · 90年代末世动画 — Style Prompt

Made from a blank page; techniques from 80s Cel Anime (cel-anime-80s) in Lemo-Opuscar. Moves borrowed from Text Flash Cuts (text-flash-cuts) and Sci-fi Hologram HUD (hologram-hud).

> Late-90s apocalyptic TV cel animation re-created in code. An ordinary hot afternoon of power lines and cicadas is interrupted by heavy squeezed serif cards, red alarm interfaces and very long silent holds, until a single shape of light breaks the world.
> References (grammar only): mid-90s Japanese apocalyptic mecha TV anime and its tokusatsu lineage (flash title cards in compressed Mincho, long held shots, city furniture drawn as characters, command-post monitor walls, classical music played against horror); late-90s cyber-dread anime (hum, wires, static). Never copy a work's characters, mecha, creatures, organisations, logos, card texts, typefaces or music, and never name them in the film. See `REFERENCES.md`.

## 1. Essence, and what it is not

Four things meet in every film, and the friction between them is the look:
- **The ordinary.** Flat cel suburbs, classrooms, train cars and control rooms under a hard sun or a hospital-white light. Poles, wires, signals and vending machines are cels with outlines, framed as characters.
- **Text as interruption.** Full-frame white-on-black cards in one ultra-heavy, high-contrast serif, squeezed or stretched into right-angle blocks, cut in for frames or held like an inscription.
- **The interface as messenger.** Monitor walls, hex and stripe warning fields and rolling data. The alarm is the only red in the world.
- **Stillness as horror.** Locked frames held far longer than is comfortable, with one thing moving or nothing at all, and a sound bed that does not stop.

It is not 80s neon city-pop (no chrome titles, no saturated night neon: that is cel-anime-80s), not the red-black stair geometry of Text Flash Cuts (our architecture is real and inhabited), not a glossy HUD product demo (the interface reports a disaster and has no product in it), and not gore horror (dread comes from waiting, scale and text).

## 2. Materials & rendering

- **Cels** (people, poles, wires, machines, the threat): flat fill, one hard shadow shape, an optional hard highlight, **coloured** line (a dark of the fill, never pure black) 2–3 px at 1080p. Built with `cel.js` (shape − shifted shape for shadow). No gradients inside cels.
- **Plates**: flat or lightly airbrushed skies (2–3 bands, one soft gradient at most), sun discs, cumulus as flat shapes. Interiors are flat planes with hard light patches from windows (parallelograms of light).
- **Silhouettes**: whole characters or crowds as one dark flat fill against a sunset or a white window, to show scale and isolation.
- **Interface layer**: crisp vector screen-space graphics on black: hairline grids, hex cells, diagonal hazard stripes, condensed sans caps, mono numerals. A faint scanline and glow (CRT pass at ≤ 40 % of the 80s strength).
- **Playback**: late-90s broadcast tape, milder than the 80s pass: slight chroma bleed, mild grain, no heavy tracking noise. Full-frame **negative inversion** for 1–3 frames at shocks.
- **The rupture**: one effect per film may break the medium: cels shown as raw line drawings, hand-sketched frames, or text over the animation.
- All grain and noise is procedural and seeded, so render(t) stays deterministic.

## 3. Colour logic

- **Grounds**: hospital white, night teal and true black. Day exteriors use a high, hard sky (cyan to pale) with hot white light.
- **Sunset orange** is the colour of "the last normal day". Use it for exteriors at the turn, never in the interface.
- **Alarm red / signal orange / nominal green** belong to the interface and to warning light only. When red appears in the world (a light wash, a reflection), the alarm has entered the world.
- **The thing** has one sickly pair (deep violet + acid green, or bone white + blood orange per film), never worn by a person.
- People get muted school or work colours, one accent each. Value order: the interface is the brightest object in a dark room; the sun is the brightest in a day frame.
- Example palette (example only): `#ecebe4` white, `#0e2a30` teal night, `#060606` black, `#e8792b` sunset, `#d81f26` alarm, `#ff7a1a` signal, `#38d26a` nominal, `#5b2a86` violet, `#9be34a` acid.

## 4. Type & subtitles

- **Cards**: Noto Serif Display 900 (OFL) for Latin, Shippori Mincho B1 800 (OFL) for Japanese/Chinese, white on black (or black on white once per film). Draw with a horizontal scale of **0.55–0.75** (squeezed) or **1.3–1.6** (stretched), tight leading (0.9). Lines form **right-angle blocks**: a big line plus a perpendicular line, or a stair of 2–4 lines of different sizes justified to one edge. Text may touch the frame edge, but never centre a single line on a plain card.
- **Card classes**: *flash* (2–12 frames, only repeating or fragmenting words the viewer also gets in full in voice or a held card), *held* (an episode or chapter title, a date or a question, held ≥ reading time).
- **Interface type**: Archivo Narrow 700 in caps (headers, warnings: 28–90 px) and IBM Plex Mono 500 (numbers, codes: 18–36 px). Numbers roll from glyph noise into the value.
- **Subtitles**: plain broadcast captions, Archivo Narrow 600, 46–52 px, white with a 4 px dark outline, ~90 px above the bottom, never on the cards. Hold ≥ max(1.8 s, speech + 0.6 s).
- Film language first (DIRECTOR §1). A Japanese line may ride on a card as a second voice only when the film is bilingual.

## 5. Motion quality

- 24 fps output. Characters and the threat on twos (12 fps); held drawings with **one moving element** (blinking signal, swaying wire, hair, a ceiling fan, a cursor).
- **Holds**: 5–15 s is normal; one per film runs ≥ 20 s. Nothing in a hold eases. It is fixed, or it moves at a constant speed.
- **Impacts**: smash cut, 1–3 frames of inversion or white, then a frame shake that decays in 6 frames. No motion blur except speed lines.
- **Interface motion**: snaps (0–2 frame transitions), panels popping on in a grid order, stripes scrolling at constant speed, numbers rolling.
- What never moves: the camera during a hold; the card type once it is cut in (no kinetic type, no letter-by-letter typing).

## 6. Camera grammar

| Move | What it expresses | Can serve |
|---|---|---|
| Locked long hold | time stops; the viewer is made to wait | a confession; the moment after a discovery; an empty room |
| Extreme low angle up poles and wires | the sky as a lid; something above is coming | a premonition; arrival; a countdown |
| Top-down vertical | a figure as a specimen | isolation; a body in a bed; a choice |
| Split monitor wall (2–9 panels) | many viewpoints, no control | a spreading event; a vote; surveillance |
| Fast push-in (8–12 frames) | shock recognition | the wrong detail; a face that understands |
| Slow lateral slide across a plate (constant speed) | the ordinary world going on | a commute; the calm before; an aftermath |
| Foreground-obscured frame (a pole, a door edge) | distance between people | an argument; a secret; being watched |
| Scale reveal: tiny figure, huge shape | the scale of the threat | first sight of the thing; the ending |

Framing rules: the horizon sits low (lower ⅓) in exteriors, so the sky dominates; poles and wires cut the frame diagonally; captions stay in the bottom safe area; interface text stays out of the top 6 %. Transitions: hard cuts and cuts to black only. A card may cut in as a transition. No wipes, no dissolves (except one slow fade-to-white per film at most).

## 7. Sound palette

- **Beds**: cicadas (dense, high, pulsing), electrical hum (50/60 Hz with harmonics), a distant train, room tone, rain on a roof. The bed **continues through disaster** and is cut hard only for a true silence.
- **Interface sounds**: sine chirps (1–2 kHz), alarm whoops with two alternating tones, relay clicks, a dot-matrix chatter, a low warning drone.
- **Impacts**: a sub drop plus a noise burst; a delay tail of the blast; a high ringing after, as after loud noise.
- **Music**: a calm classical idiom set against horror: a choir or string chorale, a solo piano, a harpsichord-like pluck. Synthesize your own melody or use a public-domain composition (performed by our own synthesis). One pounding taiko and brass cue for action at most.
- **Silence**: real digital silence for 0.5–3 s, cut hard on a card or an inversion. Use at least once per film.
- **Voice**: a calm, close narrator, never hyped; character lines dry, interface voices through a band-pass (300–3000 Hz).
- **Mix**: voice ~10 dB over the ducked music; beds stay audible; −14 LUFS master.

## 8. Native moves

- **Intertitle Barrage.** 3–9 flash cards cut on a rhythm, then one held card. *Fits content like:* a list of symptoms; a countdown of dates; the moment a narrator realises; chapter breaks in an explainer.
- **The Long Silence.** A locked hold ≥ 20 s with one moving element and only the bed. *Fits content like:* the aftermath; waiting for a reply from space; two people who cannot speak; a body that should not be there.
- **Pattern Alarm.** The screen fills with hex cells and hazard stripes; one condensed word in red caps; data rolls; a two-tone alarm. *Fits content like:* the signal is identified; quarantine; a reactor; a forecast that changes.
- **Tribunal Vote.** Three panels vote in turn, YES/NO stamps snapping on with relay clicks; the last panel decides. *Fits content like:* an AI's judgement; a crew deciding to open a door; a jury; a self-destruct order.
- **Cross Light.** A blast or beam that rises as a cross or column of light, inverted for 2 frames, then plain white, then a hush. *Fits content like:* a launch; an arrival; the end of a city; a revelation.
- **Inner Collapse.** The animation drops to raw line drawings on paper, questions as cards, a voice talking to itself. *Fits content like:* a memory that is not yours; madness in isolation; the final twist; an AI's inner monologue.
- **Power-Line Horizon.** Low-angle exterior with wires dividing a huge sky; the sun or the thing sits between the lines. *Fits content like:* a premonition; the last normal day; a satellite passing; a calm before contact.

## 9. Pitfalls of the medium

- *Cards in a plain centred font look like a slide deck.* Fix: always squeezed or stretched heavy serif, right-angle layout, touching an edge.
- *Holds feel like a frozen render.* Fix: one living element plus a strong sound bed, and a reason (someone waits, something approaches).
- *Red everywhere kills the alarm.* Fix: red only in the interface until the alarm enters the world, once.
- *Too many flash cards make noise.* Fix: a barrage at most every ~30 s; flash only words that are also heard.
- *Mecha cosplay.* Fix: invent your own threat and hardware; no purple-green robots, no "angel" crosses on people, no three-supercomputer names.
- *Interface over-detail at 1080p becomes mush.* Fix: ≤ 3 type sizes per screen, hairlines ≥ 1.5 px, one focal panel.
- *Gradient-shaded cels.* Fix: one hard shadow shape; gradients only in sky plates.

## 10. Engine

Techniques come from `$LIB/styles/cel-anime-80s/demo/` (`cel.js` cel shading and outlines, `pal.js` colour models per lighting, `bg.js` plates, `fx.js` speed lines and flares, `post.js` the WebGL tape pass; set its strength low) and `music/score.py` (numpy synthesis). The first episode's style frames add `cards.js` (squeezed-serif card layouts: `card(ctx, lines, {scaleX, align, invert})`) and `alarm.js` (hex warning field, stripes, rolling numbers, vote panels). They live in the episode's `frames/` folder; copy them into each new film. Minimal new use: a rooftop water tank at noon under wires (cels from `cel.js`), cut to a `card()` reading "DAY 3", then to an `alarm()` panel.

## 11. Variation space

The agent decides structure, cast, settings, the threat's design, the camera path, the palette within §3 and the music. Ranges, all for different films:
- **Structures**: a case file read chapter by chapter; a countdown of intercepted transmissions; one day told three times as it gets worse.
- **Openings**: a 10 s hold of an empty classroom with cicadas; a flash barrage of dates; a monitor wall where one panel goes dark.
- **Endings**: the cicadas return over an empty frame; a held question card; the first shot repeated with one thing missing.

---

No demo film yet: see `CHANGES.md`.
