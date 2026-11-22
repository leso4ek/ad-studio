# How the top Higgsfield Talent Contest films were made

Analysed 22 November 2026 from the public project pages (prompts were set to public by their authors) and frames of the finished films. Feeds the `higgsfield-director` skill.

## The contest
Higgsfield Talent Contest, $1,000,000 in prizes. Final films **3 to 7 minutes** (180–420 s), teams up to 4, at least 3 generations, submissions close 26 Nov 2026, results 3 Dec 2026. Entries are "projects": a published folder of every generation with its prompt, plus the cut film.

## The five films looked at

| Film (author) | Likes | Length | Generations | Credits | Main models | Look |
|---|---|---|---|---|---|---|
| **LAST SIGNAL** (pietromalegori) | 356 | 4:14 | 865 | 21,708 | Seedance 2.5 (59%), Seedream 5 Pro stills | Grounded post-epidemic western: desaturated overcast prairie, 21:9, practical lamp light, hand-on-prop inserts |
| **OUT OF CHARACTER** (avaren) | 254 | 7:12 | 525 | 64,094 | Seedance 2.5 (59%), Seedream 5 Pro, Nano Banana, GPT Image | Photoreal fantasy comedy, 2.39:1 "anamorphic", one lead actress kept identical across very different worlds |
| **The Date** (alishaban) | 186 | 4:29 | 135 | **1,703** | Seedance 2.5 (44%), Soul Cinematic, Seedream, Soul v2, Nano Banana | Quiet photoreal romance: overcast greens and stone, extreme close-ups of eyes and hands, a boombox as the thread |
| **OTSUKAI** (allan_ripley) | 181 | 6:36 | 697 | 14,597 | GPT Image 2.6 (65%) for stills, then video | Bright modern anime, dense Japanese street detail, strong costume silhouettes, food inserts |
| **OMOKAGE** (tambv) | 146 | 5:56 | 480 | 18,297 | Seedance 2.5 (79 of 130 logged: 42 scenes, 27 extensions, 10 edits), Soul Location, Soul Cinematic | Late-80s OVA cel anime, 1970s Casablanca, pastel day vs pink neon night, subtitled Japanese VO |

## What they have in common (why they look good)

1. **A one-sentence premise with a twist.** "A ranger radios every night at nine. No one answers, until someone does." "An AI actress goes off-script." "A man waits a long time for her, and she finally arrives." The logline is the hook.
2. **Pictures before video, organized like a studio.** Folders such as 01_CHARACTER_SHEETS, 02_LOCATIONS, 03_PROPS_VEHICLES, 04_VIDEO_CLIPS, 05_AUDIO_VOICES_MUSIC, 06_COVERS_POSTERS (OMOKAGE); OTSUKAI made 206 character and 188 location images before its 186 shots.
3. **One image model per film for the stills**, so every reference shares one finish (Seedream 5 Pro for LAST SIGNAL; Soul Location and Soul Cinematic for OMOKAGE; GPT Image 2.6 for OTSUKAI).
4. **Seedance 2.5 for almost every moving shot**, in 6–30 second multi-shot generations, with extensions and video edits to repair takes instead of rerolling.
5. **Long, structured prompts.** Top Seedance prompts run 7,000–20,000 characters, in labelled blocks:
   - a header: length, number of shots and cuts, aspect, fps ("6 seconds, 3 shots, 2 hard cuts, 16:9, 24 fps");
   - CUT POLICY ("no dissolves, no fades, no speed ramps");
   - **NO MUSIC** (all music added in the edit): "MUSIC: FALSE. DIEGETIC AUDIO ONLY.";
   - MOTION SPEED AND QUALITY ("real-time speed for every movement… never jerky, twitchy or robotic… each one different, never cloned");
   - REFERENCES with one line per element and what to keep ("STRICT identity, glasses, clothing");
   - CAST RULE ("exactly two characters, no duplicates"), COSTUMES, GEOGRAPHY (who stands where), LIGHTING;
   - SHOT ## — 00:00–00:05 | NAME blocks, with lens, framing and one action each;
   - CONTINUITY: the previous clip attached as a reference with "begin immediately after video 1 ends".
6. **A locked style paragraph** pasted into every prompt. OMOKAGE's is a page long and defines line, color, frame rate ("animated on threes and fours, long held drawings"), mouth shapes, film texture (grain, gate weave, halation) and lens behavior. Its first approved clip then became the style reference for every later scene.
7. **Restraint in performance.** "No exaggerated acting… the emotion must emerge through silence, composition, almost imperceptible movements" (The Date). Faces at medium and close sizes, at 45° rather than straight on.
8. **Inserts carry the story.** Hands on a rifle, a glove on a bed, a gold watch, a boombox in the grass: objects in close-up do the emotional work and hide the AI's weak spots (wide action, many people).
9. **Motivated, limited light and a narrow palette per film**: overcast daylight, a single desk lamp, neon. Wide aspect ratios (21:9, 2.39:1) for a film feel.
10. **Words are drawn as stills, not by the video model.** Titles and credits were generated as images with the exact text (Seedream, GPT Image), and stray lettering in locations was edited out ("replace the neon sign… with an abstract neon shape with no letters").
11. **Sound is designed separately**: voices recorded or generated and attached as audio references for lip sync (OMOKAGE's Japanese lines), ambience from Seed Audio, music in the edit.

## Efficiency
The Date reached #3 on **1,703 credits** with 135 generations: few locations, two actors, one prop motif, slow scenes that need few takes. OUT OF CHARACTER spent 64,094 on creatures, many worlds and dialogue. Ambition costs credits; a contained story with strong inserts is the cheap way to look expensive.

## What this means for ads
- The film tricks transfer directly: a premise in one line, references for every person, place and **the product**, one style paragraph, inserts of the product in a hand, music in the edit.
- The product should be one of the "props" with its own element and its own insert shots, the way the boombox and the gold watch are.
