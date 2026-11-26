# 24601 · Part 1 "The Candlesticks": report

**Final:** `24601-ep01-the-candlesticks.mp4`
- 1080×1920, 30 fps, 41.4 s
- −14.4 LUFS, peak −1.0 dBTP
- also: `-preview720.mp4`, `-poster.jpg`, `24601-ep01.srt`

**Spend:** 102 of 110 Higgsfield credits; **8 left**.
- casting: 12 credits (8 images, Nano Banana 2);
- MAGI-2: 3 clips × 12 s × 2.5 credits/s = 90;
- ElevenLabs: free tier only, 1 extra line.
- Every job is in `production/ledger.jsonl`.

## What MAGI-2 did (each clip checked at 30 fps: camera30 + frame strips + Whisper + pitch)
| Clip | Cuts asked → got | Lines (Whisper) | Lips → speaker | Voice vs. reference (median pitch) | Verdict |
|---|---|---|---|---|---|
| 1 rain street | 5.0 / 8.5 → 4.87 / 8.23 | all 3, 0.85–4.29 s | owner, Jonah, owner ✓ | Jonah 95 Hz vs. ref 94 ✓ | kept |
| 2 soup kitchen | 5.0 / 8.0 → 5.03 / 7.77 | all 3 | Myles ✓; Jonah's face down | **"You should" in Myles's voice (155 Hz vs. Jonah 84)** ✗ | fixed in the edit |
| 3 el platform | 4.5 / 8.0 → 4.47 / 7.77 | all 4 | Javier, Myles, Javier ✓ | Javier 180 vs. 200 ✓; Myles 130 vs. 142 ✓ | kept |

- **The look held across all 3 clips:** same faces, clothes, candlesticks and lighter.
- **The 24601 card was readable** in clips 1 and 3.

## The edit
The edit is `production/edit/build.mjs`, which runs pass 1, then the app's edit engine.
- **Cold open:** clip 3's first 2.6 s plus a held push-in, with Jonah's V.O. over it. The "24601" box is on screen while he speaks other words. Then "CLANG!" and "4 HOURS EARLIER".
- **The scenes:** clips 1–3, trimmed. "3 A.M." and "DAWN" boxes. The ending hard-cuts on Javier's stare, into the "PART 2" tag and the Hugo credit.
- **The clip 2 patch:**
  - MAGI's "You should" muted at 3.22–4.72 s;
  - room tone laid under it from the same clip;
  - a new ElevenLabs take of Jonah (Brian, 100 Hz) placed at 3.20 s.
  - Jonah's face is down there, so there are no lips to miss.
- **Word captions:** Bangers in yellow and white, 2 words each, from the app's edit engine.
  - The first word of each line snaps to the measured speech onset; Whisper had started "We're closed" and "Sorry, Father" about 0.37 s late.
  - The number shows as "TWENTY-FOUR SIX-OH-ONE."
- **Re-watch fixes:**
  - CLANG! sat on a caption;
  - the cold-open boxes touched Jonah's face;
  - the captions were too small;
  - the loudness was −15 LUFS, so a measured second pass was added.

## Open
- MAGI-2's loudness sits about 1 LU under the target after the engine's one-pass loudnorm.
- **Part 2** needs about 100 credits: 3 × 12 s of MAGI-2 + 2 new places + Fana's sheet.
