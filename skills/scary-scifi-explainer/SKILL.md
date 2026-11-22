---
name: scary-scifi-explainer
description: Plan, script and produce YouTube episodes that explain scary or creepy sci-fi stories (cosmic horror, eerie signals, AI dread, space disasters, paradoxes) in the "90s Apocalypse Anime" style — late-90s apocalyptic cel anime with squeezed heavy-serif flash cards, red alarm interfaces, power lines, cicadas and long still holds. Use when the user asks for a new episode, story idea, script, treatment, style frames, thumbnail or full video for their scary sci-fi channel, or says "make an episode", "next case", "write a script in my retro anime style". Builds on the lemo-opuscar skill.
---

# Scary Sci-Fi Explainer (channel skill)

Episodes are films made in code with the Lemo-Opuscar library, always in the user's own style **90s Apocalypse Anime** (`apocalypse-anime-90s`).

## 0. Setup
1. Run the lemo-opuscar skill's setup: `sh "<lemo-opuscar skill dir>/scripts/setup.sh"`, which prints `LIB=`. Start `… setup.sh deps` in the background (add `voice music` before producing a film).
2. Style: read `styles/apocalypse-anime-90s/STYLE.md` (repo root; also linked from `~/lemo-my-styles/`) in full (fallback: find the row in `~/lemo-my-styles/README.md`). It replaces a library `STYLE.md`. Its rules are fixed; everything else is directed from the story.
3. Follow `$LIB/AGENTS.md` (Workflow) and `$LIB/DIRECTOR.md`, with the channel rules below layered on top.

## 1. Channel format (fixed for every episode)
- 1920×1080 at 24 fps; English narrator + burned-in captions + `.srt` unless the user says otherwise.
- **Hook within 3 s**: an Intertitle Barrage or one impossible image. No logo first.
- **Narrator explains a "case"**: calm, documentary, past tense, never hyped ("Investigators later found…"). Arc: *the ordinary place → the wrong detail → escalation (clock, countdown or repetition) → the turn (someone acts) → the reveal (the rule behind the horror) → the coda that implicates the viewer.*
- Every episode opens with a held card `CASE NN / <TITLE>` (an L-block, squeezed serif) before 0:25, and ends on a held final card of 1–3 words.
- Each episode uses at least 3 of the style's native moves, always including **The Long Silence** (≥ 20 s in episodes of 2 min or longer) and one **Intertitle Barrage**; at least two real silences.
- **Word budget** at ~140 wpm, leaving room for holds: 2 min ≈ 160–200 words · 5 min ≈ 450–550 · 10 min ≈ 950–1100. Over 3 min: warn about the time and token cost (DIRECTOR §1).
- **Stories**: original by default. Public-domain retellings only with the source and author credited in the description. Never retell copyrighted stories scene by scene; explaining real theories (Fermi paradox, Great Filter, Boltzmann brains) is fine with sources.
- No real brands, logos or existing franchises on screen (DIRECTOR §12). The style's references are never named in a film.
- No LemoLab credit or watermark (the films are the user's).

## 2. Per-episode workflow
1. **Brief**: one round of questions only if the topic or length is unclear; otherwise state the defaults and go.
2. Project folder `episodes/epNN-<slug>/`.
3. `TREATMENT.md` with all 8 items of DIRECTOR §4 (3 structures + choice, logline/arc, benchmark, shot list, beat sheet, cue map on a bar grid, sound table, subtitle/title design). Write it before opening any demo code.
4. `cues_src.json` → `cues.json` with timings (speech ≈ words ÷ 2.35 s; captions hold ≥ max(1.8 s, speech + 0.6 s) and yield to the next line; no speech overlaps) → `epNN.srt` via `$LIB/.venv/bin/python $LIB/core/render/srt.py cues.json epNN.srt`.
5. `SCRIPT.md`: a VO/dialogue table with in/out times, a picture & sound table, the word count, all on-screen text, and the YouTube title, thumbnail frame and description line.
6. **Style frames**: copy `episodes/ep01-the-echo-at-hollin/frames/` (a page plus `cards.js`, `alarm.js`, `scene.js`, fonts) into the new project, redraw 3 frames for the new story, render with `cd $LIB && node core/render/still.mjs <project>/frames <t…>`, tile them with `core/render/sheet.py`, and check them against STYLE.md §1–4.
7. **Production template**: copy `episodes/ep01-the-echo-at-hollin/film/` (shot dispatcher `main.js` with `SHOTS`, `TEXTS`, `EV`; drawers in `scene.js` / `scenes2.js` / `cards.js` / `alarm.js`; `mix.py` with synthesized beds and score; `tools/cues_from_voice.py`; `build.sh`) and replace the shots, cues and score for the new story. `render(t)` may be async (Kling clips are drawn from pre-extracted JPEG frames, decoded per frame). Silences are events of type `silence` that mix.py hard-mutes.
8. **Production, step by step** (only when asked): voice with `core/tts/tts.py` (narrator `am_michael` 0.88; characters band-passed) → `asr_check.py` → score (`$LIB/styles/cel-anime-80s/demo/music/score.py` techniques: chorale, pedal, alarm) → animation page with `render(t)`/`TEXTS(t)` → `readcheck.mjs` → `video.mjs` → mix → `mux.sh` (needs ffmpeg 7+). Then the DIRECTOR §11 self-check.

## 2b. External tools (connectors)

**ElevenLabs (voice-over), free tier only.** The free plan has 10,000 characters a month; 1 character ≈ 1 credit on `eleven_multilingual_v2`.
- Use **premade** voices only (library voices may not work on the free plan). Channel cast: narrator **Brian** `nPczCjzI2devNBz1zQrb` (deep, calm); female character **Sarah** `EXAVITQu4vr4xnSDxMaL`; male character **Chris** `iP95p4xoKVk53GoZ742B`.
- One flow per episode (`creative_create_flow`), one take per line (`generations_count: 1`), estimate first with `estimate_only`. Write numbers as words ("three twelve a.m.").
- The free queue often answers "Free generations are busy". Nothing is charged: do other work and retry the line later, one at a time. Never fire 16 lines in parallel.
- Download right away (signed URLs expire); keep `voices/eleven/sessions.json` (line → session id).
- Check every line with `asr_check.py --model small.en`. Known false alarms: invented names (Hollin → "Holland"), "time stamped" spacing, "-ed" before "to". Retake a real slur with punctuation ("one... dated tonight", "Mara — whatever").

**Kokoro (local, free, offline).** The fallback and comparison: `core/tts/tts.py voices/lines.json voices/kokoro` (narrator `am_michael` 0.88, `af_bella` / `am_adam` for characters). Its pace is slower, so check the slots (the build script reports any OVERRUN).

**Kling AI (video clips), paid credits.** Ask the user for a budget each time.
- Measured costs: `image_to_video` with `kling-video-v3_0_turbo` at 720p/5 s = **40 credits**; `text_to_video` with `kling-video-v2_5` at 720p/5 s = **15 credits**.
- Use it for what code draws badly: interiors with people, crowds, the threat's scale reveal. Keep cards, interfaces and alarms code-drawn (Kling invents text).
- To animate our own frames, render them without captions (`frames/?nosub=1`), `file_upload`, then `curl` the bytes to the ticket URL. Prompt "locked-off static camera" anyway: Kling still adds a slow push-in, and it adds lights or objects you name (say "one red light on the largest dish only").
- Name the characters' genders and looks (Mara is a woman). Download from `v15-kling.klingai.com` within 24 h.
- Network hosts this needs (already allowed in the Default cloud environment): elevenlabsusercontent.com, kling.ai, v15-kling.klingai.com, plus huggingface.co, cas-server.xethub.hf.co, cas-bridge.xethub.hf.co and us.aws.cdn.hf.co for the Whisper model.

## 3. Deliver
Tell the user the folder, the files (TREATMENT, SCRIPT, srt, stills sheet, and the video if made) and any blocked step.
