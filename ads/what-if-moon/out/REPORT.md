# What If the Moon Vanished Tonight? (what-if #1): report

**Files:**
- `what-if-moon-vanished.mp4`: 1920×1080, 30 fps, 117.8 s, −14.2 LUFS, peak −1.5 dBTP;
- `what-if-moon-vanished.srt`;
- thumbnail `what-if-moon-thumb.jpg` ("GONE?", different from the title).

**Title:** What If the Moon Vanished Tonight?

**Cost:** $0. The narration used 1,629 ElevenLabs free-tier credits (Brian, multilingual v2); everything else is drawn in code or synthesized.

## Structure (the format asked for)
- **The big question** comes at 0–4 s and is answered only at 103–112 s.
- **On the way,** 3 smaller questions are each asked and answered:
  - flood? → tides ÷ 3;
  - black nights? → no moonlight calendar for corals;
  - shorter days? → the brake is gone, the day stays 24 h.
- **The twist:** "That's… fine? Then why call the Moon a stabiliser?" bridges to the tilt answer.
- **The open loop:** next, "What if Earth stopped spinning?".

## Checks (30 fps re-watch)
- **Cuts:** camera30 found 1.0 cut per 10 s, 77 % static or slow pushes. This is inside the explainer range (0.8–3.5); every shot holds one idea.
- **Chunk seams** (29.5, 58.9, 88.4 s): no visible jump.
- **Speech:** Whisper on the final mix matches the clean narration on 281 of 282 words. The last word under the end sting reads "stops".
- **Fixes after the first stills:**
  - fonts loaded before the cards were drawn;
  - skin grey at night;
  - ocean bulge too big;
  - arrows too thin;
  - the title covered the Moon;
  - sub-lines spilled out of their cards;
  - the tilt axis was hidden;
  - continents poked out of the globe;
  - the night side was not dark;
  - the tilt card overlapped the Earth;
  - the next-question card was too small;
  - the true peak was −0.5 dBTP.

## Rebuild
```bash
node ads/what-if-moon/film/render.mjs --times
```
1. That writes `out/times.json`. Then render 4 chunks in parallel, about 10 min with `--from/--to/--out out/partN.mp4`.
2. Make the mix: `python mix.py --bible audio/bible.json …`.
3. Run `node ads/what-if-moon/film/finish.mjs` for the captions, mux and loudness.
