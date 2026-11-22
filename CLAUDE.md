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

## Environment notes
- Cloud container, temporary: **commit and push** after each work block.
- Allowed hosts were added to the Default environment for ElevenLabs/Kling/Hugging Face (see SKILL.md §2b). Fonts-in-use / Slant / evamonkey pages were not reachable during the research; REFERENCES.md cites them from search excerpts.
