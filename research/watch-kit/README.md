# Watch kit: teardowns of videos that perform (run on your PC)

Ad Studio's hooks, bibles and styles are being rebuilt from **videos that actually perform**. This cloud container can't reach TikTok or YouTube, so your **local Claude Code session** does the watching with the claude-video "watch" skill, then commits the teardowns here. The cloud session does Higgsfield (reachable from there) and turns everything into `research/what-performs.md`, the hook taxonomy, bible v2 and the style catalogue.

## Paste this into your local Claude Code session

> We're doing research for Ad Studio (repo `~/scifi-explainer-studio`, remote github.com/leso4ek/ad-studio). Pull first.
> 1. **Install the watch skill:** `claude plugin marketplace add bradautomates/claude-video` then `claude plugin install watch@claude-video`. Run its `setup.py --engine local` and `setup.py --backend whisperx --detail balanced` (local transcription, no API key). Make sure yt-dlp is current, plus ffmpeg and Deno for YouTube. If installing anything needs sudo or a third-party install script, ask me first.
> 2. **Read the rules:** `research/watch-kit/README.md` (this file) and `research/watch-kit/TEARDOWN_TEMPLATE.md`.
> 3. **Watch the four must-watch videos first** (list below), then **find and watch 30–40 more** using the groups and search rules below.
> 4. **For each video:**
>    - run `python3 "<watch skill dir>/scripts/watch.py" "<url>" --detail balanced --resolution 1024 --question "<the teardown question below>"`;
>    - view every frame it lists;
>    - fill `TEARDOWN_TEMPLATE.md` into `research/teardowns/<platform>-<id>.md`;
>    - save 4–6 key frames at 360 px wide into `research/teardowns/frames/<platform>-<id>/` (with ffmpeg from the downloaded file, or the watch frames resized);
>    - add a row to `research/teardowns/INDEX.md`.
> 5. **Commit and push** every ~10 teardowns (`research: teardowns <group> N–M`). Don't commit video files, only the .md files and the small JPEGs.
> 6. **When done,** write `research/teardowns/PC-NOTES.md`:
>    - the exact editing tools shown in the @viralex.aii video, with names, repos and what each does;
>    - the exact 3D workflow in the @whatif.sim video;
>    - anything that failed to download.
>
>    Push.

## Must-watch (your links)
1. https://www.tiktok.com/@viralex.aii/video/7703911645583592736: the "Claude video editing setup". **List every tool, repo, MCP server and skill named or shown on screen**, how they connect, and the order of the workflow. This decides Ad Studio's editing stack.
2. https://www.tiktok.com/@whatif.sim/video/7701790220236131597: 3D animations with Claude. Which Blender version, MCP or add-on, prompts, render engine, and how the edit was done.
3. https://www.tiktok.com/@1hidden_by_design/video/7705524583759105310: "the fastest fueling system", the 3D explainer format we want to make. Do a full teardown, then **open the account and tear down its 3 most-viewed videos** too.
4. https://www.tiktok.com/shortdrama: TikTok's short-drama hub. Tear down **5 of the most-viewed episodes**, including the episode-1 cold open and one mid-season episode.

## Groups to find (30–40 videos in total)
Pick **the most-viewed of the last 12 months**: prefer ≥ 1M views on TikTok/YouTube Shorts, or top-placed in a contest. Use each platform's search and sort by popular. For YouTube, yt-dlp can search directly: `yt-dlp "ytsearch20:<query>" --get-id --get-title`.

| Group | How many | Search ideas |
|---|---|---|
| story-ad: AI-made story ads that went viral | 8 | "AI ad" "AI commercial" "made with AI" product story; fruit/object character ads; Higgsfield/Seedance ad; spec ads by AI creators |
| short-drama: vertical micro-dramas | 8 (incl. the 5 above) | TikTok short drama / minidrama, AI short drama, "episode 1", cliffhanger |
| 3d-explainer: how it works / what if in 3D | 8 (incl. the 4 above) | "how it works 3D", "what if" simulation, engineering animation, x-ray/cutaway, @1hidden_by_design-like accounts |
| ai-short-film: AI short films with big numbers | 5 | YouTube "AI short film" Seedance / Kling / Veo, Higgsfield Talent Contest winners |
| editing-setup: Claude/AI editing workflows | 3 | "Claude Code video editing", "video-use", "HyperFrames", "Blender MCP Claude" |

## The teardown question (pass it as --question)
"Give a second-by-second teardown for a short-form video producer. (1) The first 3 seconds: exact first frame, exact first spoken words, exact on-screen text, and what question or tension it creates. (2) Every beat with its timestamp and what keeps the viewer watching at that moment. (3) Count the cuts. Describe the shot types, camera moves, caption style (word-by-word or lines, font look, position, colours, emphasised words), voice pace, music and sound effects that land beats. (4) The payoff: what is resolved and when, how it ends, and whether it loops or has a call to action. Note any brand or product moments with times. (5) How it was made: tools named in the caption or the video, and what the visuals suggest. (6) Three specific reasons it works and up to three reusable rules."

## Rules
- Research only: watch, describe and quote briefly. Never re-upload or re-edit the videos. Keep frames small (360 px) and few (≤ 6 per video).
- Write facts you saw, with timestamps. When you infer something, mark it "our read".
- If a download fails, note it in INDEX.md (status: failed + reason) and move on. Don't use cookies or logins unless I say so.
