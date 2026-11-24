# Scifi Explainer Studio — project memory

A YouTube channel that **explains scary sci-fi stories** (mostly original ones) in a **late-90s apocalyptic TV anime** look: squeezed heavy-serif flash cards, red alarm interfaces, power lines and cicadas, unbearably long still holds. Films are made **in code** with the Lemo-Opuscar library (github.com/lemomo-ai/lemo-opuscar), plus external voice (ElevenLabs / Kokoro) and optional AI clips (Kling).

## Start of every session
1. `sh scripts/bootstrap.sh`: installs the lemo-opuscar skill and library (`~/lemo-opuscar`, printed as `LIB=`), registers our style in `~/lemo-my-styles/`, links our skill into `.claude/skills/`, and installs the core + voice packages.
2. For episode work, use the **scary-scifi-explainer** skill (`skills/scary-scifi-explainer/SKILL.md`). It layers the channel rules on top of `$LIB/AGENTS.md` + `$LIB/DIRECTOR.md`.

## Layout
| Path | What |
|---|---|
| `styles/apocalypse-anime-90s/` | **The style**: `STYLE.md` (11 sections, the fixed rules), `CHANGES.md`, `REFERENCES.md` (Evangelion-era analysis + sources), `style.json`, `styleframe.jpg` |
| `skills/scary-scifi-explainer/SKILL.md` | The channel skill: format rules, the episode workflow, tool rules (ElevenLabs / Kokoro / Kling) |
| `episodes/epNN-<slug>/` | One folder per episode: `TREATMENT.md`, `SCRIPT.md`, `cues.json`, `epNN.srt`, `frames/` (the drawing code: `cards.js`, `alarm.js`, `scene.js`, `main.js`, fonts), `stills/`, `voices/`, `kling/` |
| `scripts/bootstrap.sh` | Session setup |

## Decisions (keep them)
- **Style** "90s Apocalypse Anime / 90年代末世动画" (`apocalypse-anime-90s`). Technique base: library `cel-anime-80s`; it borrows from `text-flash-cuts` and `hologram-hud`. All drawn in code; no image generation needed.
- **Never name or copy the reference show** (characters, mecha, logos, card texts, the Matisse font, music) on screen. Grammar only.
- **Fonts (OFL):** cards in Noto Serif Display 900 at horizontal scale 0.55–0.75; UI in Archivo Narrow + IBM Plex Mono.
- **Channel format:** 1920×1080 at 24 fps; English narrator + burned-in captions + `.srt`; a hook within 3 s; a `CASE NN` title card; at least one Long Silence (≥ 20 s) and one Intertitle Barrage; a final 1–3-word card; no LemoLab credit.
- **Stories:** original by default. Public-domain retellings only with credit.
- **Voice:** ElevenLabs **free tier only** (10k chars/month) with premade voices: narrator Brian `nPczCjzI2devNBz1zQrb`, Mara/female Sarah `EXAVITQu4vr4xnSDxMaL`, Dev/male Chris `iP95p4xoKVk53GoZ742B`, model `eleven_multilingual_v2`. Kokoro (local, free) is the fallback.
- **Kling:** paid credits, so ask for a budget each time. 720p/5 s tests: v3.0-turbo image-to-video 40 cr, v2.5 text-to-video 15 cr. Use it for people and interiors; never for cards or interfaces.
- The user's own PC is **not attached** to cloud sessions, so local models run in the cloud container (Kokoro, Whisper).

## Episode log
### Case 01 — "The Echo at Hollin" (`episodes/ep01-the-echo-at-hollin/`) — 120 s
- [x] Treatment (3 structures → a countdown of files), script (168 spoken words), `cues.json`, `ep01.srt` (passes the reading-time check)
- [x] 6 code-drawn style frames (`stills/`, `styleframes-sheet.jpg`)
- [x] VO, ElevenLabs: all 16 lines (`voices/eleven/`; the flow billed ~1.1k credits at 1 per character, while the account counter showed 125/10,000 right after, probably lagging; free tier, $0 overage; lines 08/09 retaken), timed track `voices/voiceover_eleven.mp3`
- [x] VO, Kokoro comparison: `voices/kokoro/`, `voices/voiceover_kokoro.mp3`. Both pass the Whisper small.en check (except the known false alarms)
- [x] Kling tests (95 credits; 812 left): `kling/clip1_sunset.mp4` (from the shot-2 frame), `clip2_night.mp4` (shot 17), `clip3_control_room.mp4` (shot 3, text-to-video). Notes: Kling adds a push-in despite "locked"; extra red lights; clip 3 shows two men (Mara must be a woman: say so next time).
- [x] Chosen by the user: VO = **Kokoro**; Kling = **only the control-room clip** (shot 3); everything else code-drawn
- [x] **Film**: `film/` (page `main.js` + `scenes2.js`, `mix.py`, `build.sh`). One command: `sh film/build.sh` (`VOICE=eleven` for the ElevenLabs take). Output `ep01-the-echo-at-hollin.mp4` + `-poster.jpg`. The timing changes made during the build are listed at the end of TREATMENT.md
- [x] **Rendered** (round 3): `ep01-the-echo-at-hollin.mp4`, 1920×1080, 24 fps, 120.0 s, −14.2 LUFS, peak −1.5 dBFS, 100 MB (master, NOT in git: over GitHub's 100 MB limit; re-run `sh film/build.sh`, 14 min picture render on 4 cores) + `-preview720.mp4` (5 MB, in git) + `-poster.jpg` (thumbnail). readcheck: all held texts pass
- ffmpeg ≥ 7 for `mux.sh`: build.sh uses the static ffmpeg that the pip package **imageio-ffmpeg** ships (9.x), symlinked first on PATH; the system ffprobe 6.1 is fine for probing
- [ ] The MY-STYLES 15–30 s style demo film (`test.mp4`) is still pending

## Ads and Higgsfield (added Nov 2026)
- **`skills/story-ad-playbook/`**: story ads that sell without feeling like ads. Seven rules (hook in 1–3 s, all five acts, a character we identify with, the product causes the turn, plant/pulse/reveal/tag, one emotion, kind contrast and honest claims), ten premises → one, Story Spine, five acts on the clock (15/30/60/90 s, serials), brand map, three hooks, scorecard, and a **story bible** handoff. Research and sources: `research/story-ad-research.md`.
- **`skills/higgsfield-director/`**: turns the story bible into Higgsfield pictures and video in any style. Its full base method is the uploaded "Higgsfield Expert" skill, kept at `skills/higgsfield-director/reference/higgsfield-expert-base.md` (frontmatter removed so it is not a second skill; **one third-party affiliate/pricing link removed**). Adds the prompt header the top contest films use, an ads module (product element, reveal stage, end card as a spelled still, 9:16 safe zones, hook A/B), nine style packs and budget calibration. Analysis of the top Talent Contest films: `research/higgsfield-contest-analysis.md`.
- Higgsfield connector: not connected yet (the user will add it). Allowed hosts added to the Default environment for reading Higgsfield pages: higgsfield.ai, assets/l10n/cdn/fnf-api-gw.higgsfield.ai, images.higgs.ai, d2ol7oe51mr4n9.cloudfront.net.

## Ad Studio: code-drawn story ads (round 7, Nov 2026, the current direction)
The user dropped YouTube kids' videos as too expensive and went back to **story ads**, with **no AI-looking generation**. The stack:
- **`studio/`**, the local web app (Node server + React/Motion/GSAP interface) on http://127.0.0.1:5170. Install with `bash studio/scripts/install_linux.sh` and start with `bash studio/scripts/start_studio.sh`; docs in `studio/README.md`; tests with `cd studio && npm test`.
- **12 stages:** brief → premises → hooks → story → brand map → style (gate) → bible → style frames (gate) → voice → animatic (gate) → final → scorecard.
- **Claude makes every decision.** It runs headless as `claude -p` with `--json-schema`, one resumed session per ad, and the stream shown live in the app. The fallback is the **decision inbox** (`node studio/bin/inbox.mjs list|show|answer`), which a Claude session answers.
- **The skill is `skills/ad-studio-director/`**, the per-stage rules and the **bible format**. It builds on `skills/story-ad-playbook`.
- **Five original styles,** drawn in code from one bible by `studio/kit/` (page.js + shapes.js + styles/*.js), with docs in `styles/ad-*/STYLE.md`:
  - `ad-paper-cutout`, `ad-riso-print`, `ad-midcentury-toon`, `ad-kinetic-type`, `ad-toy-3d` (three.js);
  - all registered in `~/lemo-my-styles/` by `bootstrap.sh`.
- **Fallback chains** (`studio/config.json`): voice VoiceStudio (debpalash, local API :3900, AGPL: call it, never copy it) → Kokoro → ElevenLabs free tier (off by default); speech check VoiceStudio → Whisper; product photo ComfyUI → Pillow.
- **Reference repos:**
  - github.com/higgsfield-ai/higgsfield is an LLM-training/GPU tool, not the video product. Ad Studio's pipeline is rebuilt from `research/higgsfield-contest-analysis.md` instead.
  - The interface follows the MIT freshtechbro/claudedesignskills (modern-web-design, motion-framer, gsap).
- **Checks every ad passes:** schema, claims lint (no absolutes, health claims, pressure or real brands), bible checks (tiling, voice fit at ~2.9 words/s), reading time (`readcheck`), safe zones (9:16 text inside x .05–.86, y .14–.80), speech check (use `asr` per line for Whisper spellings), −14 LUFS.
- **Kid Studio** (`comfy/kidstudio/`, the ComfyUI + OpenRouter Seedance pack for kids' videos) is **parked**. Workflows 01–05 and 09 were mock-tested; 06–08 were not.

### Ad 01: "Sprigly · Sunday standoff" (`ads/first-story-ad/`): a fictional houseplant feed, paper cut-out, 20 s
- Brief by real headless Claude Code (about $0.50 at list price). The other decisions went through the decision inbox, answered by Claude in the cloud session.
- One redo of the bible: the animatic's reading-time check failed, so the shots were re-timed and `asr` fields added. Frames reviewed once (cap hidden at the reveal, the hold pose, the CTA wrap).
- Outputs in `out/`: the 9:16 and 16:9 masters (20.0 s, −14.1 LUFS, peak −1.5 dBFS), hooks B and C, `.srt`, poster, `REPORT.md`. Scorecard 28/35; test hook B first.
- Next cut, from the scorecard: show the capful being poured (needs a watering-can prop), keep the fern's change modest, give Juno one specific detail, add motion in the first 0.3 s, and fill the sides of the 16:9 cut.

## Ad Studio v2 (round 9, in progress): previz → Seedance, real-hit research, three formats
- **Plan:** `/root/.claude/plans/…fluffy-nebula.md`, milestones M0–M5. Budget for OpenRouter tests in the cloud: **$10** total; the ledger is at `studio/.ledger.jsonl` (gitignored) and the cap is `budget.capUsd`.
- **M0 research:**
  - `research/watch-kit/README.md` is the prompt for the user's PC session: claude-video "watch" skill, TikTok/YouTube teardowns.
  - `research/teardowns/` holds 5 Higgsfield contest films, watched in the cloud. Measured cut rates: 1.9–5.7 cuts per 10 s; first cut at 2.7–12 s; openings are a contrarian VO line, a spectacle-then-"Cut!" reversal, or wordless tension inserts.
  - **Waiting on:** the PC teardowns, which unblock the M0 synthesis, M1 (bible v2) and M2 (style catalogue).
- **M3 production (built):**
  - **Blender:** `studio/blender/adlib.py` + `run_shot.py`, the bpy 5.1 library (products, toy characters, ferns, meshes, 3D text, rooms/cyclorama, lenses and camera keys, light rigs, looks clay/toy/clean/xray/blueprint). The cloud uses the pip `bpy` 5.1.2 in `studio/.tools/bpyenv`; the PC uses Blender 5.1+ headless. Workbench and EEVEE need EGL (`apt install libegl1 libgl1 libegl-mesa0`).
  - **OpenRouter:** `engines/openrouter.mjs` (Seedance video, images, estimates, hard cap, mock mode `ADSTUDIO_MOCK=1`).
  - **Shot board:** `production.mjs` + the "Shot board" view: element sheets → previz → styled keyframes → takes → pick, every paid step confirmed.
- **What we learned from the first real test (shot s1 of Sprigly):**
  - Node's fetch needs `NODE_USE_ENV_PROXY=1` behind a proxy; `start_studio.sh` sets it. In the cloud, run with `OPENROUTER_API_KEY=proxy-injected` (the proxy holds the real key).
  - **Seedream 5.5 accepts n = 1 only**, so the engine loops one request per image.
  - **OpenRouter takes video references only as public HTTPS URLs**, never data URLs. The "previz video" motion mode therefore needs `media.publicBase` (a bucket). **"Styled keyframes" mode works now:** the image model repaints the previz's first and last frames using the element sheets, then Seedance interpolates between them.
  - **A Blender render of the product as a reference** fixed wrong product sheets; the image model copied the shape and colours.
  - **Result:** `ads/first-story-ad/production/takes/s1_t01.mp4`, 4 s at 480×854, consistent character, product and place, $0.27. Total spent $0.58.
  - **Finish shot:** `comfy/adstudio` (`AdStudioColorMatch` + kidstudio Real-ESRGAN upscale + `AdStudioSaveTo`, workflow `finish_shot.json`) produced `production/final/s1.mp4` at 1080×1920, free. Without ComfyUI it falls back to an ffmpeg Lanczos upscale.
  - **Third-party skills:** taste-skill (MIT) and unslop (CC BY 4.0, credit Damir Sokolovsky) are cloned by `bootstrap.sh` into `~/.cache/ad-studio-skills` and linked as skills; they are not copied into the repo.

### Round 10: the Higgsfield way (24 Nov 2026)
- **TikTok in the cloud:**
  - `research/tools/vidget.py` (yt-dlp in `research/tools/.venv`, with a page-JSON fallback) downloads TikToks. The hosts `www.tiktok.com` and `v16-webapp-prime.us.tiktok.com` were added to the Default environment.
  - Account listings work; the `/shortdrama` hub does not (it renders in JavaScript from more hosts), so short-drama episode links have to come from the user.
- **Teardowns:**
  - the user's 3 links + @1hidden_by_design's top 3, plus `research/teardowns/TOOLS.md`;
  - **@viralex.aii editing stack = Remotion + HyperFrames + FFmpeg (libass) + faster-whisper + yt-dlp**, with the 3-prompt workflow;
  - **@whatif.sim = Claude writes the code that builds the 3D world** (no AI video), checks its own frames, renders locally;
  - **@1hidden_by_design = one continuous 3D shot, 75–88 s, "If you… But… So…" chain, one-word centre captions.**
- **Seedance, the Higgsfield way:**
  - **Elements** with role lines and 1–3 views; extra views are made *from* the approved view.
  - **Claude writes 300–900-word prompts** in blocks (FORMAT, STYLE, CAMERA, MUSIC: FALSE, CUT POLICY, MOTION, numbered REFERENCES, BLOCKING, timed ACTION, CAST RULE, NO TEXT, CONTINUITY), through `POST /production/prompts` → the decide chain.
  - **Draft (Flash 480p) → final (Seedance 2.5 720p, same prompt, references and seed).** First/last frames and motion video are gone.
- **Lesson:**
  - a **coloured previz still as the layout reference makes Seedance copy its flat look**;
  - the fix is a **grey blockout** (`previz/<id>_layout.png`, from `ffmpeg format=gray,gblur,edgedetect`) with the role "CONTEXTUAL POSITIONING ONLY… take no colours, shapes or style from it". Use it only when blocking matters.
- **Results:** `takes/s4_t01.mp4` (prompt only) and `takes/s1_t03.mp4` (blockout layout) are consistent with the elements; `takes/s1_final04.mp4` is the 720p final ($0.93). Total OpenRouter spend: $2.49.
- **Sheets:** Juno portraits drifted from her turnaround, so we kept only the turnaround. The kitchen "reverse" views come out as wider angles of the same room (still useful as view 2).

## Environment notes
- **Remote:** https://github.com/leso4ek/ad-studio (private, branch `main`; first pushed in round 8). The cloud checkout lives at `/home/user/scifi-explainer-studio`. The user's PC clones it to `~/scifi-explainer-studio` and installs **without** `--voicestudio` unless they choose it.
- Cloud container, temporary: **commit and push** after each work block.
- Allowed hosts were added to the Default environment for ElevenLabs/Kling/Hugging Face (see SKILL.md §2b). Fonts-in-use / Slant / evamonkey pages were not reachable during the research; REFERENCES.md cites them from search excerpts.
