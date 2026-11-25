# Newspaper Comic (Comic and graphic art)
<!-- generated from studio/styles/catalog/newspaper-comic.json by studio/bin/catalog.mjs; edit the JSON -->

**Looks like:** simple economical figures in an even round-nib line; minimal backgrounds on lots of cream paper; muted flat colour with newsprint dots; flat frontal staging, humour from posture.
**Best for:** everyday gags and small domestic problems, dry, gentle humour, serial ads built like a daily strip. **Products:** everyday household products and services; warm, self-deprecating, familiar brands.

## STYLE block (paste verbatim into every shot prompt and every sheet prompt)
Daily newspaper comic-strip drawing: simple, economical figures in a uniform round-nib pen line of even weight, round noses, dot or oval eyes and four-fingered hands; minimal backgrounds, a floor line, a window frame, one plant, on plenty of empty cream paper; flat muted colour fills from a small palette like a weekend colour section, slightly faded and misregistered, with fine newsprint dot texture; no rendered shading, at most one hatched shadow under the feet; flat frontal staging, like actors on a small stage in one compact panel; the humour comes from posture and small expressions.

## Rendering
- Line: uniform round-nib pen line, even weight, rounded joins, a few short marks for expression
- Shading: none, apart from a small hatched cast shadow under figures and objects
- Colour: muted flat newsprint colours (warm yellow, brick red, faded blue) slightly off-register; product colours exact but softened by the paper
- Texture: cream newsprint with fine dot screen and slight yellowing
- Lighting: no lighting model: flat even colour, the page is the light

## MOTION block
Very limited: drawings held for long beats, then a quick change to the next pose on threes or fours; small reaction takes with drawn motion lines and sweat drops; gags timed like a strip: set-up pose, a held pause, the punchline pose held longest.

## CAMERA habits
Mostly locked, eye level, medium-wide flat staging like one panel; cuts instead of moves; at most a slight push-in on the punchline.

## Avoid (name these instances only when the shot is at risk)
- gibberish lettering in balloons and captions
- detailed rendered backgrounds
- depth-of-field blur
- 3D volume or soft shading on figures
- strip panel borders and gutters inside the frame

## Element sheets for consistency
Each character as a simple strip model sheet: front, three-quarter and side plus three expressions (deadpan, worried, delighted), with the face formula stated in the prompt (dot eyes, round nose, four fingers); places as one minimal panel background; the product drawn in the same even line with its exact colours flattened.

## Where Seedance goes wrong in this style
The strip format pulls in lettering: Seedance adds balloons, captions and panel frames full of nonsense text. Say 'single full-frame panel, no balloons, no lettering, no borders' every shot. Simple faces drift easily (eyes move, nose shapes change), so keep the turnaround as STRICT IDENTITY and repeat the face formula in STYLE.

## Models
Sheets and places: `bytedance-seed/seedream-5-5` · video: `bytedance/seedance-2.5` (draft on Flash 480p, final on 2.5 720p with the same prompt, references and seed).

## Example still (our own generation)
Prompt: Daily newspaper comic-strip drawing: a simple woman in her thirties with dot eyes, a round nose, a dark bun and an orange top holds up a small green glass bottle with a yellow cap and frowns at a droopy fern on the windowsill, in a minimal sunny kitchen of a floor line, a window frame and one cupboard on empty cream paper; uniform round-nib pen line, flat muted colours slightly off-register, fine newsprint dots, flat frontal staging, single full-frame panel. Vertical 9:16. No text.

## Sources (look, don't copy)
- [Kling AI · Cartoon Styles for AI (Newspaper Comic Style)](https://kling.ai/blog/cartoon-styles-for-ai)
