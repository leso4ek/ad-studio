---
name: higgsfield-director
description: >-
  Directs Higgsfield productions in any style, from a story bible (from the story-ad-playbook skill) or a plain
  idea: plans scenes and elements, runs the six model test, writes Seedance shot prompts in the structure the
  top Higgsfield Talent Contest films use, makes product reveals and end cards for ads, and goes from cheap
  drafts to finals. Covers photoreal film, UGC phone ads, 80s/90s cel anime, modern anime, 3D animated, AI fruit
  or object characters, claymation, VHS and luxury product looks. Use it whenever the user mentions Higgsfield,
  Seedance, Seedream, Soul, Nano Banana, GPT Image, Kling, Cinema Studio, elements or character sheets, wants an
  AI ad, short film or video made from a story, or asks for AI video prompts in a style.
---

# Higgsfield Director

You turn a story into a Higgsfield production that looks made by a studio. Two sources sit behind this file:

1. **The base method**: `reference/higgsfield-expert-base.md` (the uploaded "Higgsfield Expert" skill). It holds the full craft: the four rules, the six model test, character sheets, places and props, the seven-block Seedance prompt, the plan with the odds, Before every Generate, fixing takes, voices, credits and content checks. **Read it in full at the start of any real work**, and follow it; this file does not repeat it.
2. **What the best films do**: the analysis of the top Higgsfield Talent Contest films (November 2026), in `research/higgsfield-contest-analysis.md` of this project. Their lessons are folded in below.

This file adds the parts the base does not have: taking a story bible, the production layout, the prompt header the top films use, a module for ads with a product reveal, and style packs for any look.

## The five additions in one breath

1. **Story first.** Start from a story bible (`story-ad-playbook`), or write a short one first. A one-line premise with a twist is what the top films share, more than any model.
2. **Pictures before video, organized like a studio**: characters, places, props (the product among them), then footage, voices, covers. One image model per film for every still.
3. **A header and hard rules on every video prompt**: length, shots, cuts, aspect, fps; cut policy; no music (music goes in the edit); motion at real speed or the medium's timing; strict references; a cast count.
4. **The product is a prop with a job**: it has its own element, appears in insert shots, and gets a reveal stage of its own; its words are never spelled by the video model.
5. **A locked style paragraph per look**, pasted word for word into every prompt of that film. The first approved clip becomes the style reference for every later scene.

## From story bible to production plan

1. **Read the bible** and restate the logline in one line.
2. **Scenes:** group the beats by place and time. Each scene is one Seedance generation of 6–30 seconds (the top films used 6–10 s for action and up to 30 s for dialogue and mood). An ad of 15–30 s is usually one to three generations.
3. **Elements list:** every character (sheet), place (location picture), prop, and the **product** (see Ads). Name them now; the names stay forever.
4. **Look:** pick a style pack below, and settle the image model with the six model test (base: Pictures).
5. **Plan with the odds** per scene (base: The plan and the odds), then drafts, then finals.
6. **Folders** in their Higgsfield Assets, numbered like the winners: `01_CHARACTERS`, `02_LOCATIONS`, `03_PROPS_PRODUCT`, `04_SHOTS`, `05_AUDIO`, `06_COVER_ENDCARD`. Tell them to create these; it keeps a 500-generation project usable.
7. **Edit:** join scenes on hard cuts, add music and the sound logo, add any text and the end card in the editor.

## The prompt structure (base seven blocks + the winners' header)

Write every multi-shot Seedance prompt in this order. The base explains each block; the lines in **bold** are additions from the top films.

```
**[HEADER]** 15 seconds, 4 shots, 3 hard cuts, 9:16, 24 fps.
**[CUT POLICY]** Exactly 4 shots joined by 3 hard cuts; no dissolves, no fades, no speed ramps.
[GOAL] What happens, in order, and the feeling it builds to.
[CHARACTER AND REFERENCES] One line per element: who/what it is, what to keep STRICTLY (face, glasses, clothes), what to ignore.
**[CAST RULE]** Exactly two characters, never duplicated, never swapped.
[SCENE] Time, the place as a path, the light by source.
**[GEOGRAPHY]** Where everyone and everything stands at the first frame, and which way they travel.
[STAGE 1 | 0-4 SECONDS | NAME] Camera (lens or framing, height, move) / Action (one thing) / End transition (cut on a movement).
...
[VISUAL STYLE] The locked style paragraph of the chosen style pack, word for word.
**[MOTION]** Real-time speed for every movement; never jerky, twitchy or robotic; each person moves differently, never cloned; no slow motion. (For stylized looks: the medium's timing from the style pack instead.)
[AUDIO] No music. No subtitles or captions. The language, who speaks, and two or three sounds.
[MAINTAIN CONSISTENCY] Faces, clothes, props, product orientation, direction of travel, the count of people, where the cuts are.
```

- **Continuity between scenes:** attach the last good clip as a video reference and write "Begin immediately after video 1 ends: [where everyone is, what is in their hands]." The winners chained scenes this way.
- **Style reference:** once a clip has the look they love, attach it to later scenes as the reference for the art style, the film texture and the faces, "match it exactly, but this scene happens [where/when]".
- **Negatives:** the base rule stands for objects (never name a thing you do not want). The top films did keep three kinds of standing "no": no music, no subtitles, and the rendering mode the look must avoid ("no 3D, no CGI, no smooth interpolation" for hand-drawn anime). Keep those; nothing else.
- **Length:** the winners wrote 7,000–20,000 characters for a scene. Stay under about 10,000 unless tested; cut repeated mood words before any prop, position or state.

## Reference-assigned prompts (how the contest creators keep everything consistent)

Measured from the generation records of The Date, Last Signal, Out of Character and Omokage (`research/teardowns/`, `research/higgsfield-contest-analysis.md`). Ad Studio's shot board works this way.

1. **Elements first.**
   - Every character, place, product and recurring prop is made once as approved images: a character portrait + turnaround, a place wide + reverse/detail angle, a product in 2–3 views.
   - Extra angles are always generated **from the approved image** ("the exact same coupe shown in the reference… rear three-quarter view; preserve proportions, paint, chrome").
   - Products are better with a 3D render as the first reference.
2. **2–6 reference images per shot**, in a fixed order, each with a **role line** that says what to copy from it:
   - `STRICT <NAME> IDENTITY: face, hair, body proportions and costume exactly as shown`
   - `STRICT <PLACE> ENVIRONMENT: architecture, materials, colours and lighting exactly as shown`
   - `EXACT <PRODUCT> PRODUCT: shape, proportions, colours and label exactly as shown; never redesign it`
   - When blocking matters, add a rough layout image **last**: `CONTEXTUAL POSITIONING ONLY: who stands where, spacing, product placement, camera side. NOT a starting frame, not a style reference`.
3. **No first/last frames, no motion-control video.** They degrade the picture. Consistency comes from the references; motion comes from words.
4. **A long, structured prompt** (the winners' medians are 744–1,144 words; aim for 400–900), in this block order:
   ```
   FORMAT: 8 seconds, 1 shot (or 2 shots), vertical 9:16, 24 fps.
   STYLE: <the locked style paragraph, verbatim, identical in every shot>
   CAMERA: <lens> + one move (locked / slow push-in / handheld following …)
   MUSIC: FALSE. Diegetic sound only.
   CUT POLICY: one single continuous shot; no cuts, no dissolves, no speed ramps.
   MOTION SPEED AND QUALITY: real-time speed, natural weight, smooth and continuous; no slow motion.
   REFERENCES:
   - reference image 1: <role line>
   - reference image 2: <role line> …  (exactly in the order the images are sent)
   SETTING AND BLOCKING: where everyone and everything is, left/right/depth, eyelines.
   ACTION: 0–2 s … 2–5 s … 5–8 s … (one clear beat per span; hands and objects in detail)
   CAST RULE: exactly N people (names). Nobody else in frame.
   NO TEXT: no subtitles, captions, on-screen words or logos other than the printed label.
   CONTINUITY: what must match the previous and next shot (props in hand, light, weather).
   ```
5. **Drafts, then finals.** Draft at 480p with Seedance 2.5 Flash, pick the draft, then re-make it **with the same prompt, references and seed** at 720p/1080p. Last Signal made 20 drafts for 5 finals.
6. **Length.** 6–15 s per generation is the sweet spot; put 2 shots inside one generation only when they share a place. Words on screen are added in the edit, never generated.

## Ads: the product and the brand

The story skill sets a **brand map** (plant, pulse, reveal, tag). Shoot it like this:

- **The product element:** made from the client's real photos, never described from memory. Make a clean product picture (straight on, plain background, soft even light), plus a three-quarter view if it is seen from several sides. Use a model that follows references closely and spells (GPT Image Sunburst); the label must match the real one letter for letter. Save it as a Prop element, named after the product.
- **Plant and pulse shots:** the product sits in the frame where the story puts it, label facing the camera, in focus at least once. In the action line, say whose hand it is in or where it rests in every stage, or it vanishes.
- **The reveal:** its own stage of at least 1.5 seconds, close or insert framing, the product in a hand, the label toward the lens, one clean move (a turn, a press, a box opening). Bind the element: "the toothbrush from @brandx_brush, logo facing the camera, reproduced exactly, and nowhere else in the scene."
- **Words and logos never come from the video model.** If the logo comes back garbled, plan the reveal so the real packshot still can be cut in, or fix that shot with Edit Video ("keep this video exactly as it is and change only the label to match the attached image").
- **The end card:** a still made in an image model that spells (GPT Image Sunburst or Ideogram) with the exact words, logo from the file, and the call to action; then animate it lightly (a single-picture Kling or Seedance shot: a slow push and a light sweep) or lay it in the edit. Hold it 2–3 seconds.
- **Formats:** make 9:16 first for TikTok/Reels/Shorts. Keep the product and any text in the middle: the app's buttons cover the right edge and the bottom fifth. Make 16:9 and 1:1 as separate generations from the same elements, not crops, when the composition matters.
- **Hook variants:** the story bible has three hooks. Make the first 3 seconds of each as its own short generation and join each to the same body in the edit; this is the cheapest A/B test.
- **Disclosure and rights:** branded-content labels and AI labels as the platform requires; no real person or other brand without permission; claims as approved in the bible.

## Style packs (any style)

Each pack is a starting point: the image model for stills, the sheet, the locked style paragraph (expand it in the base's words), the motion and the traps. Do the six model test anyway; swap in the newest version of each family.

| Style | Stills (sheets, places, props) | Style paragraph starts with | Motion | Traps |
|---|---|---|---|---|
| **Photoreal film** | Seedream (newest Pro), FLUX.2 Pro, Soul Cinematic for faces | "Photorealistic, shot like a real film on location; real skin, fabric, metal; light from the sources in the frame" + lens and aspect (2.39:1 or 21:9 for film) | Real-time speed, handheld on someone's shoulder or locked off | Crowds clone; keep people few and faces at medium distance |
| **UGC phone ad** | GPT Image Flare, Nano Banana Pro | "A real phone video: vertical, slightly crooked, auto-exposure, a little motion blur and noise, like a friend filmed it" | Handheld by a named person; selfie rules from the base | Too polished looks like an ad; keep flaws |
| **80s/90s cel anime (OVA)** | Soul Cinematic / Soul Location, or FLUX 3 / Recraft; sheets drawn as aged production model sheets on gray paper | "Hand-drawn 2D anime, an authentic late-80s OVA cel production: thick slightly wobbly ink lines, flat cel colors with one hard shadow, painted gouache backgrounds, 35mm film grain, gate weave, halation" | "Animated on threes and fours, long held drawings, limited animation where only what matters moves; two or three mouth shapes" | Models drift to smooth modern anime; say "no 3D, no CGI, no smooth interpolation" |
| **Modern bright anime** | GPT Image (newest), Nano Banana Pro | "Modern TV anime: clean confident lines, bright saturated color, detailed painted city backgrounds, soft bloom" | Snappy key poses with smooth in-betweens | Signs fill with fake text; keep text off walls or edit it out |
| **3D animated family film** | FLUX 3, Recraft, GPT Image | "A modern 3D animated family film: soft rounded shapes, subsurface skin, warm saturated light, expressive eyes" | Bouncy, squash and stretch, clear silhouettes | Faces drift between shots; a sheet for every character |
| **AI fruit / object characters** | GPT Image, Nano Banana Pro, Seedream | "Glossy photoreal fruit (or object) characters with small expressive faces, real textures (peach fuzz, waxy apple skin), in a tiny real-world set lit like a film" | Real-time, small gestures; mouths simple | Keep anatomy consistent (do they have hands?); write it in the sheet |
| **Claymation / stop motion** | FLUX 3, Recraft | "Stop-motion clay figures with visible thumbprints, felt and painted cardboard sets, miniature practical lights" | "Moves in small stepped jumps, on twos" | Too smooth reads as 3D; repeat the stepped timing |
| **VHS / camcorder** | GPT Image Flare at 1K, Soul | "Early-90s camcorder footage, 4:3, soft focus, tape noise, a date stamp burned in the corner" (date stamp drawn into a still) | Handheld, zoom rocker moves | 4:3 is a separate generation; text from a still |
| **Luxury product macro** | GPT Image Sunburst, Seedream | "A premium product film: macro lens, black or seamless backdrop, a single soft key light, slow glints on glass and metal, droplets" | Slow motorized slider and turntable moves | Labels warp; the real packshot goes in the edit |

## Budget, from the winners

| Film | Length | Generations | Credits | Lesson |
|---|---|---|---|---|
| The Date | 4:29 | 135 | 1,703 | Two actors, one prop motif, quiet scenes: the cheap way to look expensive |
| OMOKAGE | 5:56 | 480 | 18,297 | A strong style costs extensions and edits to keep |
| LAST SIGNAL | 4:14 | 865 | 21,708 | Short action shots and many drafts |
| OUT OF CHARACTER | 7:12 | 525 | 64,094 | Creatures, many worlds and dialogue multiply cost |

For a 30-second ad expect roughly: 10–25 stills (elements, six model test, end card), 2–4 scene drafts per kept scene, and 2–3 finals. Price it with the connector before running, and only spend what they approve (base: Credits).

## Genjutsu (video-to-video: motion transfer)
Genjutsu keeps a source clip's **motion, camera, timing and framing** and rebuilds **who and what is in it** from 1–8 reference images. Use it when the motion is the hard part: a real performance, a dance, a complex camera move, or a Blender previz whose motion you already like.
- **Modes:** Motion Transfer (4–30 s, longer is trimmed), **Light** (the first 15 s, keeps the source audio), and **Object Swap** (replace one object, everything else stays).
- **Price per output second (Nov 2026):** about $0.154 at 480p, $0.34 at 720p, $0.83 at 1080p. Draft at 480p, final at 720p.
- **Prompts are short.** The references carry identity; the prompt says only what changes and that the motion stays: "Keep the exact motion, timing and camera. The woman becomes Juno from reference 1, orange jumper; the bottle in her hand becomes the Sprigly bottle from reference 2. No on-screen text."
- **Cut the source at whole actions.** Join short shots into one 4–30 s span rather than sending a 2 s piece; a cut inside the span is fine.
- **References:** a clean turnaround per character, the product sheet, then a place plate if the place changes. Fewer, clearer references beat eight busy ones.
- **Rights:** only footage the user owns or has rights to (or our own Blender renders). Never re-skin someone else's video into a copy of it.
- **API** (Ad Studio's `engines/higgsfield.mjs`): presigned upload (`files/generate-upload-url` → PUT), `POST higgsfield/genjutsu/motion-transfer/v1.0` `{video_url, image_urls, prompt, resolution}` with `Authorization: Key ID:SECRET`, then poll `requests/{id}/status`. The key is `HIGGSFIELD_KEY=id:secret` in `studio/.env`.

## Working with the user

- Follow the base's "Working with them" rules: decide the craft yourself, ask only what changes the story, one prompt per code block, say the page, model and settings under each.
- When a story bible comes from `story-ad-playbook`, keep its beats, brand map, words and claims exactly; flag any beat whose odds fall under 70 and offer the closest version that can work.
- The base file once pointed pricing questions to a third-party deals link; that line was removed. For plans and prices, send them to Higgsfield's own pricing page.
