# 面影 (Omokage / Traces)

| Field | Value |
|---|---|
| URL | https://higgsfield.ai/@tambv/projects/omokage |
| Platform / account | higgsfield (Talent Contest 2026, top-listed) |
| Group | higgsfield · ai-short-film |
| Length | 5:57 |
| Views / likes | not shown on the project page |
| Aspect / fps | 16:9 / 24 |
| Made with (as stated) | Higgsfield, Seedance 2.5 video_extension with long style prompts (late-80s OVA cel anime), per the asset JSON |
| Made with (our read) | Late-80s/early-90s OVA cel anime with film grain; Japanese VO, English subtitles burned in |

Method: watched in the cloud with the claude-video watch skill's local engine (keyframes + a 0–15 s hook pass at 2 fps), faster-whisper "small" transcript, ffmpeg scene-change cut count.

## Hook (0–3 s)
- First frame: High-contrast white-and-black close-up of an older man's face, eyes in shadow.
- First words: "時間が癒やすと人は言う。嘘だ。" ("People say time heals. It's a lie.")
- On-screen text: English subtitles burned in at the bottom (yellow)
- Hook type: contrarian statement (a bold claim the viewer wants to argue with)
- Open loop: Why does he think time doesn't heal? Whose story is this?
- First cut: 6.4 s

## Beats
| t (s) | What happens | Retention device |
|---|---|---|
| 0.0 | Old man's face: "People say time heals. It's a lie." | contrarian hook |
| 14 | "This isn't a story for everyone. It's mine and my friend's." | promise of a story |
| 36–64 | 1971: two young friends, a gas station, the beach | flashback world |
| 108–150 | Disco, the heist plan | escalation |
| 228–268 | The job; the sack; shock on the friend's face | turn |
| 290–320 | Blood; betrayal; the friend dies | tragedy |
| 330–346 | Back to the old man: "I knew you were here." | bookend payoff |

## Craft
- Cuts per 10 s: 5.72 (ffmpeg scene > 0.32; 204 cuts in 357 s, average shot 1.74 s, first cut 6.4 s)
- Shot types and camera: Graphic anime framing, ECUs, strong silhouettes; 5.7 cuts per 10 s — the fastest of the five
- Captions: Burned-in subtitles every line
- Voice: Gravelly narrator VO + dialogue
- Music / SFX: City-pop and synth score
- Visual style and consistency: Locked OVA style paragraph repeated in every prompt (see asset JSON); same character outfits throughout

## Payoff and end
- Payoff: Bookend with the old man: the "trace" (omokage) of the friend
- End: Fire, then the end card

## Why it works
- A contrarian first line is the strongest hook of the five.
- The bookend structure (old → young → old) gives a satisfying payoff.
- A locked, very specific style paragraph keeps 200+ shots consistent.

## What we would steal
- Open with a contrarian claim in the narrator's voice.
- Bookend: start and end in the present, the story in between.
- Paste the same detailed style paragraph into every shot prompt.

Key frames: `frames/higgsfield-omokage/t_0.5.jpg`, `frames/higgsfield-omokage/t_8.jpg`, `frames/higgsfield-omokage/t_44.jpg`, `frames/higgsfield-omokage/t_248.jpg`, `frames/higgsfield-omokage/t_300.jpg`, `frames/higgsfield-omokage/t_346.jpg`
