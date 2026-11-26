# Scifi Explainer Studio — project memory

A YouTube channel that **explains scary sci-fi stories** (mostly original ones) in a **late-90s apocalyptic TV anime** look: squeezed heavy-serif flash cards, red alarm interfaces, power lines and cicadas, unbearably long still holds. Films are made **in code** with the Lemo-Opuscar library (github.com/lemomo-ai/lemo-opuscar), plus external voice (ElevenLabs / Kokoro) and optional AI clips (Kling).

## How to talk to the user (round 13)
The user asked for the **i-have-adhd** skill (MIT, ayghri; linked by `bootstrap.sh`). Write every reply in that mode:
1. Lead with the next action or the result.
2. Numbered steps, one action each.
3. At most 5 items per list.
4. Concrete times ("about 10 min").
5. End with one next step the user can do in under 2 min.

No preamble. The same goes for the app's short texts (stage summaries, live-pane notes).

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
- **Stages** (story ad): brief → premises → hooks → story → brand map → style (gate) → direction → bible → style frames (gate) → voice → animatic (gate) → final → scorecard → audience (optional). Other formats add or skip stages (round 12).
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

### Round 10b: MiroFish audience test (stage 13, optional, paid ≤ $1)
- **What it is:** MiroFish (AGPL) runs as its own service in `~/mirofish`, on :5001, outside the repo.
  - Install with `studio/scripts/install_mirofish.sh`, start with `start_mirofish.sh`.
  - Run with `node studio/bin/audience.mjs <slug>` or the app's stage 13 card.
- **No Zep:** the user declined a Zep key; never ask again. `integrations/mirofish/` (AGPL) holds the local graph:
  - `local_graph.py` is a SQLite `LocalZep` with LLM extraction per chunk and BM25 search;
  - `apply.sh` adds 4 lines to `get_zep_client()` when `MIROFISH_LOCAL_GRAPH=1`;
  - `ZEP_API_KEY=local` is a placeholder.
  - Tests: MiroFish's 129 tests pass with the patch off; with it on, only the 3 Zep-constructor tests fail. Our contract test passes.
- **Model:** `deepseek/deepseek-v4.1-flash-1017` ($0.03 in / $0.20 out per million tokens).
  - Extraction runs with reasoning off and costs about $0.00025 per chunk.
  - The model returns types in any letter case, so types are matched case-insensitively.
- **Settings that matter:**
  - **`maxRounds` 24** (one simulated day): rounds are hours from midnight, and viewers sleep 00–05h, so 5 rounds simulate nobody.
  - **`platform: parallel`** (Twitter + Reddit): the single-platform scripts never write `simulation_end`, so their run-status never completes.
  - **Tokenizer:** the simulation needs tiktoken files from `openaipublic.blob.core.windows.net` (host added to the Default environment). They are cached in `~/mirofish/tiktoken_cache` (`TIKTOKEN_CACHE_DIR`).
  - **Language:** send `Accept-Language: en`, or MiroFish writes Chinese.
- **Token economy:**
  - The dossier is built by code.
  - Claude makes 2 calls with `{fresh, noSkill, noTools, effort: low}`: about 3.5k context tokens and about $0.03 list per call, against about $0.11 for a default call.
  - The setup is cached in `out/audience/setup.json`.
  - With `decider: inbox` (Sprigly), a cloud Claude session answers both calls instead.
- **The flow that works:**
  1. Start with `enable_graph_memory_update: true`, so the posts reach the local graph that the report agent searches.
  2. Wait until `twitter_completed && reddit_completed`; `runner_status` stays "running" because the process is kept alive for interviews.
  3. Run `interview/all` with one question that doesn't name the brand.
  4. Call `close-env`; `report/generate` returns 409 until the run is terminal and the graph writes drain, so the engine retries.
  5. Generate the report.
  - Checkpoints in `out/audience/run.json`: a rerun on the same dossier resumes after the last finished phase.
- **Sprigly v1 result:** stop 3 · watch 4 · recall 2 · trust 3 · click 2 · opening unclear · $0.30 (`out/audience/`, card in `card.png`).
  - The viewers believed the concrete dose, but doubted "every two weeks" without the season and doubted "seaweed extract". They remembered the rule more than the name, and asked "which cap?". With no size, price or stockist, purchase intent stayed low.
  - This agrees with the scorecard's "show the pour" fix.
  - All the MiroFish attempts while debugging cost about $0.60 together. OpenRouter key total: $3.17.
- **Noise:** 7 of the 16 agents weren't viewers: the brand, TikTok, Reels, Shorts, a platform account, the style name and Juno. The dossier wording is now fixed for that.
- **Cost guard:** OpenRouter's `GET /api/v1/key` usage is read before and during the run. Past the cap, `/simulation/stop` is called and the run fails. A SIGINT/SIGTERM closes the ledger entry with the measured cost.

### Round 11: a director, a hindsight memory, new styles, a Seedance catalogue (25 Nov 2026)
- **Direction stage (7)** between Style and Bible. It uses the method of the **cinematic-director** skill (DirectorSKILL, MIT, cloned by bootstrap into `~/.cache/ad-studio-skills/DirectorSKILL`); the prompt names only the shot-plan template, product-and-macro and the commercial playbook.
  - **The schema:** thesis, beats (what the viewer learns), director's book, continuity locks, and a shot list (size, subject, angle, move, reason, `textZone`).
  - **Checks:** tiling, 2–6 cuts per 10 s, never the same size on the same subject twice in a row, the product keeps one screen side, and no card over a face in MCU, CU or ECU.
  - **Decision files** are found by stage id whatever their number, so old ads still load after stages were renumbered (bible is now 8 … audience 14).
- **Kit camera** (`studio/kit/camera.js`, pure and tested):
  - `camera.size` EWS…ECU framed on a subject;
  - angles eye/low/high;
  - moves push/pull/pan/tilt/truck/whip/handheld/rack;
  - `ots` (a soft foreground shoulder).
  - The frame never leaves the drawn set on any parallax plane, and parallax flattens as the frame gets tighter.
  - Old `{zoom, pan, focus}` bibles render pixel-identical.
- **Carried cards:** the same text layer (same `id`, text and position, `carry: true`) over consecutive quick shots is one card. It keeps its clock across the cuts, and the reading check times it as one piece. That's how 1.2 s cuts stay readable.
- **New props:** `watering-can`, `capful`.
- **New code-drawn styles** (built by 3 subagents following the library's STYLE.md rules in our own code): `ad-manga-panels`, `ad-scifi-toon`, `ad-crayon-book`. Fonts from `@fontsource` (OFL): Bangers, Comic Neue, Gaegu, Patrick Hand. Render any style's sheet with `node studio/bin/stylesheet.mjs <style> [--bible f]`.
- **Lemo-Opuscar licence:** following the docs to make your own films is allowed, commercial ones included. Putting the docs into a product or service run for commercial advantage needs LemoLab's commercial licence. Never copy STYLE.md text into the repo.
- **Hindsight memory** (`studio/server/memory.mjs`, `studio/memory/`, committed): the HER idea (mfornet/hindsight-experience-replay) for an LLM.
  - **Episodes and signals** are logged by code: repairs, checks, redo notes, overrides, approvals, frame reviews, scorecard rules, audience scores.
  - **Relabel:** after a scorecard or an audience test, one lean Claude call turns them into real, hindsight and future lessons.
  - **Recall:** at most about 600 tokens of lessons go into each decision and into the shot board's prompts.
  - **Rules:** a lesson seen in 3 ads becomes a proposal, and only the user's approval writes it into the skill's "Learned rules". The app's Memory view shows all of this.
  - **Seeded with** Sprigly v1 (`node studio/bin/memory-backfill.mjs <slug>`) and 5 Seedance lessons; 23 lessons from 2 ads after v2.
  - Tests use a temp memory folder (`NODE_TEST_CONTEXT`).
- **Seedance style catalogue:**
  - **34 styles** (Kling's "Cartoon Styles for AI", 8 families), one JSON each in `studio/styles/catalog/`, written by 3 subagents.
  - **Each has** a STYLE block, rendering, motion, camera, avoid, sheets and risk.
  - **Check:** `node studio/bin/catalog.mjs` validates them, rejects studio and artist names, and writes `skills/seedance-styles/styles/<slug>.md`.
  - **In the app:** a look picker on the shot board (locks the STYLE paragraph and points Claude at that one guide), and `seedanceStyle` on the Style stage.
  - **Example stills:** `node studio/bin/catalog-examples.mjs [--yes]` (Seedream, about $0.02 each; not generated yet, waiting for the user's go-ahead).
  - **characterdesignreferences.com** is still blocked: the host request could not be shown on the user's mobile app version. Ask again from claude.ai on a computer, then merge its "Art of Animation" styles.
- **Sprigly v2** (`ads/sprigly-v2/`): v1's decisions up to Style, then Direction → bible → final with the memory on.
  - **Shots:** 10 shots, about 5 cuts per 10 s; the pour as an insert; the name in the reveal frame and the voice; a purchase anchor on the end card.
  - **One bible redo:** the end card was too short and two-line cards sat at y 0.20. That redo produced the memory's first real "future" lesson.
  - **Scorecard 30/35** (v1 28). Character detail is still 3: re-run from Story next.
  - **Audience test v2:** stop 3 · watch 4 · recall 3 (v1: 2) · trust 3 · click 2 · opening C · $0.27. Price is still the purchase blocker.
  - **The reused setup paragraph named the platforms,** so they became agents again. Every text MiroFish reads now goes through `noPlatforms()`.
  - **Simulated recall is a ceiling:** all agents know the product from the graph.

### Round 12: 3D formats and "Recreate a video" (25 Nov 2026)
- **Formats** (`project.format`, chosen in the New ad dialog). Stages that don't apply show as skipped.
  - `story-ad`: as before.
  - `3d-skit`: style fixed to `ad-voxel-3d`, with no style gate.
  - `3d-explainer`: adds the **3D world** stage after the bible.
  - `recreate`: adds **Source** (code) and **Analysis** (Claude) at the start and has no premises.
  - Cut-rate checks depend on the format: explainer 0.8–3.5 per 10 s and same-size shots allowed; recreate follows the original.
- **`ad-voxel-3d`** (three.js, built by a subagent):
  - box-built characters with face decals, blinking and talking mouths, and listeners who turn toward the speaker;
  - `cast.<id>.kind: "plant"` makes a talking potted fern;
  - a dark stage with bokeh lights;
  - `overlay.steps` draws a top bar at y .14–.20 (**cards go at y ≥ .285 under it**);
  - `captionMode: "words"` shows 1–3 words with one yellow emphasis word;
  - about 0.7 s a frame on cloud CPU.
- **Blender explainer builders** in `studio/blender/adlib.py` (subagent), documented in `studio/blender/README.md` with the example `examples/fern_water.json` (+ preview mp4 and contact sheet):
  - parts: cutaway, pot, pipe, tank, grate, roots (drink), plant, liquid (fill/flow/fall);
  - keys on any part: `appear`/`vanish`/`glow`;
  - one continuous `camera.path`.
  - **Cloud EEVEE:** about 12 s a frame at 50 %, about 5 s at 40 % (8 samples). Use a GPU on the PC.
- **The world stage:**
  1. Claude writes the adlib spec (+ an optional script).
  2. One still per beat is rendered, and Claude reviews them (2 rounds at most).
  3. The whole move is rendered, then cut into JPEG **plates** in `production/plates/world/`.
- **Plates** (`shot.plate`, in `kit/page.js`): a rendered or generated clip drawn under the words, captions and end card. "Use picked clips in the edit" on the shot board turns chosen takes into plates.
- **Recreate:**
  - **Upload** a video of 60 s or less, up to 12 reference images with role and label, and a prompt (looks, wardrobe, items, product, notes).
  - **Modes:** remake, transfer or mixed.
  - **Rights:** a tick box gates every Genjutsu route.
  - **`engines/analyse.mjs`:**
    - cuts from **local peaks of the scene score** (a fixed threshold missed cuts inside one drawn set);
    - first/middle/last stills and contact sheets;
    - motion 0–1 with pan/tilt/handheld on 64-px grey frames;
    - a faster-whisper transcript (`studio/tools/transcribe.py`) and loudness.
  - **Router** (`routeFor`): `kit`, `three`, `blender`, `blender→genjutsu`, `seedance` or `genjutsu`. Mixed mode sends a shot to Genjutsu only when people move (> .2) or motion is strong (> .4).
- **Higgsfield Genjutsu** (`engines/higgsfield.mjs`, **mock-tested only**: the hosts are blocked in the cloud and no paid tests ran this round):
  - presigned upload, then `POST higgsfield/genjutsu/motion-transfer/v1.0` with `Authorization: Key id:secret`, then polling `requests/{id}/status`;
  - Light mode is 15 s and Object Swap paths are configurable; API base in `higgsfield.api`;
  - `HIGGSFIELD_KEY=id:secret` goes in `studio/.env`;
  - its own cap `budget.higgsfieldCapUsd` ($5) and its own ledger entries; OpenRouter spend leaves them out;
  - prices about $0.154/s at 480p, $0.34/s at 720p, $0.83/s at 1080p.
  - **Shot board:** consecutive Genjutsu shots merge into **4–30 s spans**. Uploaded references replace the generated element they stand for and go first, in upload order. Prompts stay short.
- **Proofs:**
  - **`ads/sprigly-recreate/`:** v1's video was found by code as exactly 7 shots and remade as a voxel skit, with Juno and a talking fern and steps. **Scorecard 32/35** (v2 had 30); the voice was tuned through 4 redos.
  - **`ads/sprigly-transfer/`:** Genjutsu end to end in mock mode (3 spans, about $0.77–0.92 each at 480p if real).
  - **`ads/fern-water-explainer/`:** the 3D explainer through the app.
  - All of round 12 cost $0.
- **Lessons:**
  - Kokoro voices mishear short rare words ("glug" from bm_lewis, "sulking" from bm_george); use full phrases.
  - The inbox deletes an old answer when a new request opens, so stage answers and feed them in when the pending file appears.
  - A stage marked done is skipped by "run from": use Redo.
  - `ffmpeg7()` now swaps its link atomically, because parallel tests raced on it.

### Round 13: more than ads (26 Nov 2026)
- **"New video"** offers 8 kinds: story ad, short drama, explainer, 3D skit, 3D explainer, clip a stream, edit a video, recreate.
  - `edit` and `clip` are **tool formats** (`TOOL_FORMATS`): they run only the stages that name them.
  - Stages a format skips are hidden in the pipeline map, and stages are numbered per format.
- **Explainer** (`format: explainer`): a topic brief (`topicBrief`, ≥ 3 sourced facts) → hooks → story → style → direction → bible → … → scorecard (explainer rubric). No product: the end card shows the channel name and a CTA.
- **Short drama:**
  - The series project (`drama-series`) runs series bible → style → **episodes**, which creates child projects `<slug>-epNN` (`drama-episode`, `parent` link).
  - `seriesLocks` forces cast, voices, palette and a "Part N" end card (the finale shows the series title). It must **delete** `line`/`cta` keys, never set them to undefined.
  - `checkDrama`: 30–50 s; the last line lands just before the cut; only "Part N" on the end card.
  - `runSeries` / "Run all in order" in the Series view. Episode boards reuse character sheets approved in a sibling.
- **Edit tool** (`engines/edit.mjs`, the @viralex.aii workflow): faster-whisper words → `silencedetect` + `proposeCuts` → Claude's edit plan (`checkKeep`: no cut inside a word) → concat + libass word captions + music bed with ducking + −14 LUFS. Notes in plain words make v2, v3…
- **Clipper** (`engines/chat.mjs`, `engines/openclip.mjs`, skill `clip-director`):
  - Stream mode: chat bursts (z-score) → peaks → delay estimate (6 s Twitch/Kick, 10 s YouTube) → windows of about 10 s build-up + 7 s reaction → snapped to sentences → Claude picks with the rubric (`research/viral/clip-rubric.md`) → 9:16 render with a solid headline box held 9 s and no speech captions.
  - Normal mode: OpenClip (`install_openclip.sh`). **It can't install in the cloud** (download.pytorch.org and the Whisper host are blocked), so the cloud falls back to Claude ranking transcript windows. Real Twitch/YouTube/Kick runs happen on the PC.
- **Viral research** (`research/viral/`, the watch skill on TikTok): 9 explainers, 8 skits, 10 short drama, 8 ads, 14 clips, each with a SUMMARY. The playbook `skills/ad-studio-director/reference/viral-playbook.md` has one section per format; `playbook(format)` puts only that section into the prompts. YouTube Shorts list for the PC: `research/watch-kit/README.md`.
- **Proofs (all $0):** `ads/ear-pop-explainer/` (45 s, 30/35), `ads/night-shift/` + `-ep01…03` (manga panels, 34.5 s each, 31/35 each), `ads/sprigly-edit/` (v1 13.8 s → v2 11.7 s from one note), `ads/stream-clips/` (both chat bursts found, delay 6 s vs. true 5 s, 2 clips).
- **Lessons:**
  - Cards on medium and close character shots go in the lower zone (y ≈ .645); a top card sat on her eyes. On wide shots the character stands low, so the card goes in the sky (y ≈ .26), or it lands on her shirt.
  - Whisper writes numbers either way ("nine"/"9"): the speech check now ignores number spelling. Names still need an `asr` spelling.
  - `render.stills` needs an absolute ad folder path.
  - Restarting the server re-opens the running stage's inbox request: re-stage the answer for the feeder.

### Round 14: real characters, content-principles, book dramas, 30 fps camera research (26 Nov 2026)
- **The user's feedback:** "the design of the character is really poor and the story also".
- **content-principles** (aiwithremy, **no licence: linked by `bootstrap.sh`, never copied**):
  - every writing prompt points to it (`formatBlock`);
  - `checkScript` (stages.mjs) checks voiced bibles for drama, explainer, story-ad and 3d-skit: average sentence ≤ about 9 words, a number, name or date in the first 10 s, no preamble in the first 3 s, and for drama an open or short line in the last 45 %.
- **Character rig v2** (`studio/kit/rig.js`; tests in `tests/rig.test.mjs`; sheets with `node studio/bin/castsheet.mjs <style> --what expressions|views|outfits|poses|hair`; samples in `studio/kit/rig-sheets/`):
  - **Body and views:** proportions drama (6.75 heads), toon and chibi; 5 views (front, ¾ and profile, each direction).
  - **Faces:** 16 expressions, blended over 0.2 s by `expressionAt`; lids, irises, brows, nose, lips; visemes from the cue text.
  - **Hair and clothes:** 19 hair styles; outfits (blazer, suit, hoodie, scrubs, dress…); accessories, and a badge that shows the name.
  - **Poses:** 13 IK poses, `cuffed` included.
  - **Where it applies:** `cast.rig:"v2"` or `bible.rig:"v2"`; drama episodes default to v2 through `seriesLocks`. v1 figures are unchanged.
  - The camera frames v2 people with the `person-drama|toon|chibi` tables.
  - **Lessons:**
    - in ¾ view the far eye is on the side the face turns to;
    - facial hair draws under the mouth;
    - sci-fi toon must skip its own face overlay for v2 (`p.v2`);
    - stills can land on a blink (normal in motion).
- **Outlier research (the user's uploaded guide, rebuilt independently, no Virlo API):**
  - `research/tools/outliers.py` computes creator lift = views ÷ median of the creator's other mature posts (≥ 10, floor 500), plus a robust z, with diversity.
  - `research/tools/camera30.py` reads moves at 30 fps (pan/tilt/push/pull/truck/handheld/whip/snap/roll, speed, easing, shake, 2 s segments), tested by `test_camera30.py`.
  - Study of 9 outliers in `research/viral/camera/SUMMARY.md`: 62 % static, push-ins about 4 % zoom per second and eased, median 2 cuts per 10 s.
  - The kit camera gained `ease` and `rate`.
  - The venv re-exec compares `sys.prefix`, because the venv python links to the system one.
- **Book dramas:**
  - `research/books/` holds Monte Cristo, Hamlet and Anna Karenina: the engine, the reversals and a modern mapping. Public domain only, credited.
  - The series brief takes `source`; the New video dialog has a book field.
  - The series bible's characters get `object`, `habit` and a v2 look; episodes get `evidence`, `openLoop` and `place`.
  - The credit appears on episode 1's tag (`endcard.credit`; the tag may run longer to be readable).
  - New props: usb, cuffs, flute, document, ring, bars. New places: cell, boardroom.
  - **Proof:** `ads/the-countess` + `-ep01…03` (Monte Cristo → a framed fintech analyst; paper cut-out), with my frame reviews and fixes recorded in each episode's frames decision.
- **Speech check:**
  - DIFF lines that differ only in number, US/UK or name spelling are re-judged as OK.
  - Name spellings go in `vo.spellings` (`{"Edie": ["Eddie", "Eddy"]}`).
  - Invented names Kokoro says wrong ("Pharaon" heard as "ferry on") stay on cards, not in speech.

## Environment notes
- **Remote:** https://github.com/leso4ek/ad-studio (private, branch `main`; first pushed in round 8). The cloud checkout lives at `/home/user/scifi-explainer-studio`. The user's PC clones it to `~/scifi-explainer-studio` and installs **without** `--voicestudio` unless they choose it.
- Cloud container, temporary: **commit and push** after each work block.
- Allowed hosts were added to the Default environment for ElevenLabs/Kling/Hugging Face (see SKILL.md §2b). Fonts-in-use / Slant / evamonkey pages were not reachable during the research; REFERENCES.md cites them from search excerpts.
