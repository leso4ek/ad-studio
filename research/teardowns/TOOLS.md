# Tools and methods confirmed from the videos (24 Nov 2026)

## Editing with Claude Code: the @viralex.aii setup (1.2M views)
Source: the video and its caption, [tiktok-7703911645583592736.md](tiktok-7703911645583592736.md).

| Tool | Job | Install (official only) |
|---|---|---|
| **FFmpeg with libass** | cuts, burns subtitles, exports | Homebrew `ffmpeg-full` / winget / distro package; Ad Studio already ships ffmpeg 9 through imageio-ffmpeg. Check `ffmpeg -filters` lists `subtitles` and `ass` |
| **faster-whisper** | word-level timestamps for subtitles | `pip install faster-whisper "av<19"` in a .venv (Python 3.14 or older) |
| **yt-dlp** | downloads reference reels (study only) | pip; Ad Studio: `research/tools/vidget.py` |
| **Remotion** | builds video and graphics in React | npm; **its licence is free only for individuals and small companies; check before commercial use** |
| **HyperFrames** (HeyGen) | HTML → video motion graphics and captions | npm package `hyperframes`, Node 22+ |

**The workflow (3 prompts):**
1. Make the folders `raw/`, `references/` and `done/`.
2. **Prompt 1:** install and test the 5 tools (burn a test subtitle, transcribe 5 s), then show a table of tool, version and works.
3. **Prompt 2 (taste):** take 3–5 reference reels, download them, study them frame by frame and by ear (pacing, shot length, pause cuts, subtitles, colours, graphics, transitions, music, the first 3 s). Write `style.md` with exact values. **"Take inspiration, but don't copy."**
4. **Prompt 3 (edit):**
   1. Whisper word timestamps; ask about doubtful words.
   2. Cut pauses, slips and bad takes, checking cut points by audio level; keep meaningful pauses; never speed up the voice.
   3. Word-by-word subtitles in the style.
   4. Music quietly under the voice.
   5. Graphics only where they help.
   6. Export 1080×1920 to `done/draft-v1.mp4` + `edit-notes.md`, check the file, revise from plain-language notes (draft-v2, draft-v3…).

**Ad Studio uses this as its edit stage (M4)**: references → `style.md` → edit decision list → render (FFmpeg/libass + HyperFrames for graphics; Remotion only if your licence allows) → draft-vN + edit-notes → your notes → revise.

## 3D videos with Claude Code: the @whatif.sim method (1.8M views)
Source: [tiktok-7701790220236131597.md](tiktok-7701790220236131597.md).

1. **One line:** a "what if" premise nobody has posted (it checks first).
2. **A source for every fact.**
3. **No AI video:** Claude writes the code that builds the whole world (e.g. Times Square with 352 cars). You never touch the code.
4. **Claude checks its own frames** and fixes what's weak.
5. **The laptop renders** (3,000 frames in about 18 min), at no extra cost on the Claude plan.

It takes 7 prompts in total (the full tutorial is behind the creator's bio link, not fetched). The look is stylised voxel/blocky 3D characters on a stage, rendered in real time.

**Ad Studio maps this to the Blender route** (`studio/blender/adlib.py`, which you can drive with Blender MCP) and the three.js kit (`ad-toy-3d`), including the self-check of frames before the final render.

## 3D explainers: the @1hidden_by_design format (10.9M / 5.1M / 4.8M views)
Sources: the four teardowns `tiktok-77007…`, `tiktok-77058…`, `tiktok-77055…`.

- **One continuous camera, no cuts, 75–88 s;** a photoreal suburban world with ground cutaways.
- **The narration chain:** "If you [simple action], you have [thing]. But [problem]. So [fix]. But [new problem]. So [fix]…", a new problem every 4–6 s.
- **Captions:** one word at a time, big, white, centre.
- **Continuity:** recurring props (a tennis ball) show it is the same world.

**Ad Studio's M5 3D-explainer format follows this:** a Blender scene built in layers, with the camera path written from the "But/So" beats.

## Not reachable from the cloud
- The TikTok **short-drama hub** (`/shortdrama`): it renders in JavaScript from more hosts.
- **Wanted:** 5 links to short-drama episodes (episode 1 cold opens + one mid-season episode), to tear down with `vidget.py`.
