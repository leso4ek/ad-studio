---
name: seedance-styles
description: How to make Seedance 2.5 (and Seedream sheets) hold one visual style across a whole ad — 34+ cartoon and illustration styles (classic 2D, rubber hose, mid-century, sitcom toon, Saturday-morning, anime, manga, chibi, kawaii, 3D animation, claymation, low poly, toy figure, comic book, pop art, ink, vector, flat, sticker, pixel art, watercolour, storybook, pencil, paper cut, vintage, retro-futuristic, poster, surreal, collage, mixed media, doodle). Use when choosing or prompting a style for the Seedance / AI-video route of Ad Studio, writing element-sheet or shot prompts in a named look, or when a style drifts between generations.
---

# Seedance styles

The catalogue lives in `studio/styles/catalog/<slug>.json` (one source of truth). The per-style guides in `styles/<slug>.md` next to this file are generated from it by `node studio/bin/catalog.mjs`. **Load only the guide of the style you are using**, never the whole folder.

## Routing
| You need | Read |
|---|---|
| Pick a style for a brief | the table below (one line each), then one guide |
| Write sheet or shot prompts in a style | `styles/<slug>.md` — its STYLE block, MOTION block, camera habits, avoid list, sheet rules |
| The prompt structure itself (blocks, REFERENCES, CUT POLICY) | `skills/higgsfield-director/SKILL.md` §"Reference-assigned prompts" |
| A style keeps drifting | the guide's "Where Seedance goes wrong", then shorten clips and repeat the MOTION block |

## How a style is held across an ad
1. **One locked STYLE block.** Paste the guide's STYLE paragraph verbatim into every element-sheet prompt and every shot prompt. Never paraphrase it between shots; a reworded style is a new style to the model.
2. **Sheets first, in the style.** Characters, the product and places are generated in the style (Seedream), approved, and then used as references. The references carry most of the look; the STYLE block keeps it from drifting.
3. **Timing is part of the style.** Hand-drawn and stop-motion looks die when the model interpolates smoothly: put the MOTION block (on twos, holds, stepped moves) in every prompt and keep those clips short (4–8 s).
4. **Targeted negatives only.** Use the guide's avoid list as named instances, and only the ones this shot risks.
5. **Never name a studio, show, film, franchise or artist.** Describe the grammar (line, shading, colour, timing, camera). The catalogue check rejects names.
6. **Draft → final.** Flash 480p drafts until the look holds, then the same prompt, references and seed on Seedance 2.5 720p.

## The styles
<!-- one line per style; the full guide is styles/<slug>.md -->
Run `node studio/bin/catalog.mjs` to list them with their families; the app's Shot board shows them as a grid with our own example stills (`studio/styles/catalog/examples/`).

## Sources
The style list follows Kling's "Cartoon Styles for AI" guide (kling.ai/blog/cartoon-styles-for-ai) and, once reachable, characterdesignreferences.com "Art of Animation". Their pictures are copyrighted studio art: we link them, never copy them, and our examples are our own generations.
