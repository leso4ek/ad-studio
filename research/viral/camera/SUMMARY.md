# Camera movement in viral shorts, read at 30 fps (26 Nov 2026)

**Method:**
1. `research/tools/outliers.py` scored 10 TikTok accounts (skits, story and drama creators). 8 could be listed: 499 posts, 474 scored, 25 too young.
2. It ranked posts by **creator lift**: views ÷ the median of the creator's other posts at least 3 days old, with at least 10 posts.
3. The top 16 outliers (lift 4–53×) were downloaded; 9 downloaded cleanly.
4. `research/tools/camera30.py` read them at 30 fps: corner tracking, a similarity fit and cut detection. Long takes were split into 2-second segments, giving 249 segments in total.
5. The videos were deleted afterwards. Per-video results are in `tiktok-*/camera30.json` and `strip30.jpg` (the first 3 s at full frame rate).

**Accuracy:** `research/tools/test_camera30.py` checks the classifier on a synthetic clip with known moves: static, an eased pan, a 12 % push and handheld. It reads all four correctly.

**Limits:** 9 videos is a small sample. "Roll" readings on long static shots are mostly noise. Cut detection was tuned by eye on these videos, not against labelled cuts.

## What the camera does
| Move (2-second segments) | Share | Speed | Easing |
|---|---|---|---|
| static | **62 %** (154) | — | — |
| handheld (drift, no net move) | 11 % (28) | median shake 0.05 % of the frame width per frame (p75 0.12 %) | — |
| pull-out | 10 % (25) | median 3.2 % zoom per second | constant 11, ease-in 8, ease-out 5 |
| push-in | 6 % (14) | median **4.1 % zoom per second** | ease-in 6, ease-out 5, constant 2, in-out 1 |
| tilt / pan / truck | 6 % | 0.05–0.16 frame widths per second | mostly eased |
| snap-zoom | 1 case | — | — |

**Cuts:** median **2.0 per 10 s** (range 1.1–6.9). The fastest is a multi-character skit at 6.9; story and drama pieces sit at 1.1–2.3.

## Rules for our direction (drama and skits)
1. **Hold still by default.** About 6 in 10 moments are static: the acting and the words move, not the camera.
2. **Push in only on the turn,** about 4 % zoom per second, eased (`camera.rate: 4`, `ease: "in"` while tension builds, `"out"` when the shot lands on a reveal). A 3 s shot then gains about 12 %.
3. **Handheld is a texture, not a move.** Use a small drift (`shake` 0.2–0.3) for a tense close-up, never on a wide.
4. **Pulls reveal.** Pull out (3 %/s) when the frame must show who else is in the room.
5. **No decorative pans.** Pans and trucks are rare (6 %) and slow. A whip or snap-zoom is a once-per-video accent.
6. **Cut rhythm:** about 2 cuts per 10 s for drama, rising toward the cliffhanger.

The kit camera takes `ease` and `rate` (`studio/kit/camera.js`), and the drama section of `skills/ad-studio-director/reference/viral-playbook.md` carries these rules.
