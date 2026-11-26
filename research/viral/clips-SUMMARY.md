# Viral clips on TikTok: stream and podcast clips (14 clips, Nov 2026)

**What this is:** measurements of 14 of the most-viewed TikTok clips posted Dec 2025 – Nov 2026. 8 are **stream clips** (IRL, event and gaming streams, reposted by clip accounts). 6 are **podcast/interview clips**. All have ≥ 1.6M views (median 5.5M). It is the reference data for the clipping tool. The scoring rubric built from it is in `clip-rubric.md`.

**How they were picked:** each account's videos were listed with yt-dlp (`--flat-playlist`), filtered to the last 12 months and sorted by views, and the top posts were taken. Stream clips come from three clip accounts that repost stream highlights (@theclipstudiox, @clipitandreverseit, @speetler_). Podcast clips come from the shows' own clip accounts (@jayshetty, @nojumper, @impaulsive, @fullsendpodcast, @bradleymartyn).

**What was left out:** the streamers' own TikTok accounts. Their top posts in the last 12 months (14–34 s, 11–265M views) turned out to be native dances, cosplay and skits, not stream clips. 5 were downloaded, checked and dropped.

**How each clip was measured:**
1. `vidget.py` downloads the clip.
2. Timestamped contact sheets every 0.5–3.3 s show the picture (claude-video watch on the first clip).
3. faster-whisper base gives word times.
4. `detectCuts` gives the cut times.
5. ffmpeg ebur128 gives momentary loudness in 0.5 s bins.
6. 3–5 key frames per clip are saved at 360 px.

All videos were deleted after the frames were saved. Each clip's full teardown is in `clips/tiktok-<id>.md`, with frames in `frames/tiktok-<id>/`.

**"Peak" means** the moment the clip is about: the reaction, the reveal, the punchline or the confession. It was set from the picture and the transcript, then checked against the loudness curve. **Setup** = peak time. **Tail** = length − peak.

## The 14 clips

| # | Clip | Type | Views | Like % | Length | Peak | Setup | Tail | Cuts/10 s | Hook | Layout | Ending |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | [7687367485661760782](clips/tiktok-7687367485661760782.md) | IRL breakdown | 20.0M | 4.3 | 9.7 | 5.0 | 5.0 | 4.7 | 3.1 | headline box (payoff stated) | stacked: stream + context still | mid-cry close-up |
| S2 | [7642201810010131726](clips/tiktok-7642201810010131726.md) | IRL reveal | 5.4M | 10.3 | 42.0 | 38.9 | 38.9 | 3.1 | 4.3 | headline 0–9.5 s + question | full-frame multicam | right after the reaction |
| S3 | [7690830906940001550](clips/tiktok-7690830906940001550.md) | IRL story montage | 6.5M | 6.4 | 18.1 | 16.2 | 16.2 | 1.9 | 6.6 | headline + *stage directions* | full-frame montage | right after the panic |
| S4 | [7663920417970670861](clips/tiktok-7663920417970670861.md) | IRL event mishap | 6.9M | 8.6 | 11.7 | 3.0 | 3.0 | 8.7 | 1.7 | quote caption 😭 + cold start in the action | full-frame event cam | trails off |
| S5 | [7606193124213378317](clips/tiktok-7606193124213378317.md) | IRL conversation | 5.5M | 17.7 | 37.9 | 22.4 | 22.4 | 15.5 | 4.5 | top takeaway caption + question | full-frame car multicam | mid-line |
| S6 | [7582383913339768078](clips/tiktok-7582383913339768078.md) | phone-stream news rant | 1.8M | 9.4 | 25.9 | 6.2 | 6.2 | 19.7 | 1.2 | headline box (+ sponsor logo) | full facecam | trails off |
| S7 | [7659213881373412630](clips/tiktok-7659213881373412630.md) | gaming discovery | 1.6M | 10.2 | 18.1 | 12.6 | 12.6 | 5.5 | 0.6 | spoken setup line + visual | gameplay letterbox + cam overlay | joke + laugh |
| S8 | [7669630946680835342](clips/tiktok-7669630946680835342.md) | streamer sports event | 3.0M | 20.3 | 15.7 | 5.0 | 5.0 | 10.7 | 1.3 | reaction caption 😭 + action in the first 2 s | full-frame broadcast | opponent's reaction insert |
| P1 | [7693200516439985439](clips/tiktok-7693200516439985439.md) | interview story | 12.0M | 9.2 | 70.3 | 23.7 | 23.7 | 46.6 | 2.6 | cold open on the most intense line ("And I'm screaming…") | speaker crops + listener inserts | resolution line |
| P2 | [7611008573849554190](clips/tiktok-7611008573849554190.md) | interview conflict | 11.7M | 6.5 | 30.8 | 23.6 | 23.6 | 7.2 | 3.6 | title card 0–3 s + mid-argument start | crops + wide for the walk-out | zinger (button) |
| P3 | [7706289196016717070](clips/tiktok-7706289196016717070.md) | comedy story | 3.8M | 8.6 | 29.9 | 21.3 | 21.3 | 8.6 | 4.7 | host question + stacked opener with a photo | stacked → crops → b-roll | tag + laugh |
| P4 | [7585669585202990366](clips/tiktok-7585669585202990366.md) | sports anecdote | 2.4M | 7.2 | 34.6 | 22.7 | 22.7 | 11.9 | 2.0 | host question + stacked opener with archive footage | stacked → crops → archive | mid-conversation |
| P5 | [7602711386493390110](clips/tiktok-7602711386493390110.md) | banter | 2.3M | 10.0 | 62.6 | 19.0 | 19.0 | 43.6 | 2.7 | host question (trending place) | crops + lifting b-roll | reflective, no button |
| P6 | [7696196302576684318](clips/tiktok-7696196302576684318.md) | interview story | 8.2M | 7.0 | 104.9 | 100.6 | 100.6 | 4.3 | 0.5 | shocking number in the first line | static crop + listener inserts | **punchline is the last line** + end card |

## Stream clips (n = 8)
- **Length:** median **18.1 s**; the middle half is 14.7–28.9 s, and the full range is 9.7–42.0 s. The most-viewed clip (20M) is 9.7 s. **Only 2 of 8 are over 30 s.**
- **Setup before the peak:** median **9.4 s**; the middle half is 5.0–17.8 s, and the full range is 3.0–38.9 s.
  - 5 of 8 have ≤ 12.6 s.
  - Long setups (22–39 s) are conversation clips where the question has to be heard.
- **Tail after the peak:** median **7.1 s**; the middle half is 4.3–11.9 s, and the full range is 1.9–19.7 s.
  - Clips that end on a reaction keep 1.9–5.5 s of tail.
  - The 3 clips that trail off have 8.7–19.7 s of tail.
- **Where the peak sits:** median at **55 %** of the clip (range 24–93 %).
- **How clips start:**
  - 4/8 start inside the moment (mid-action, mid-rant, or a silent stare already under way).
  - 3/8 open on a setup line or question at a sentence start.
  - 1/8 opens on an action run-up.
  - Speech starts at 0.0 s in 5/8. Three clips open with 2.2–3.3 s, or the whole clip, without speech, and the headline carries the opening instead.
- **Hook devices:**
  - **5/8 use a headline that states the payoff** (white rounded box, CAPS on the key verb: "X started CRYING after realizing…"). 4 hold it for the whole clip; 1 holds it for the first 9.5 s.
  - 2/8 use a reaction-quote caption with 😭😭😭.
  - 1/8 uses none (the spoken setup line plus the visual).
  - 1/8 adds narrating *stage-direction* subtitles per beat.
  - **0/8 use a freeze-frame, a rewind or a zoom as the hook.** "Cold start on the peak, then rewind" did not appear.
- **Layout:**
  - **5/8 are full-frame 9:16 from one source.** 4 of these are pro IRL/event multicam and 1 is a phone facecam.
  - 1/8 is a montage.
  - 1/8 is stacked: the stream on top, a still that explains the context below.
  - 1/8 is gameplay letterboxed in the centre with a small facecam overlay.
  - **The classic split (facecam on top, gameplay below) appeared in 0/8.** IRL dominates the top stream clips in 2026.
- **Captions:**
  - **7/8 have no speech captions**, only 1–2 static text lines.
  - 1/8 (gaming) has word-by-word captions: 1–2 words, white with a black outline, centred over the gameplay.
- **Added edits:**
  - punch-in close-up on the reaction (2/8);
  - an insert of the other party's reaction (2/8);
  - a sponsor logo (1/8).
  - No SFX, emoji stickers or zoom effects on these.
  - Cuts per 10 s: median **2.4** (0.6–6.6).
- **Endings:**
  - **5/8 end on a reaction:** cut ≤ 5.5 s after it, or on the other side's reaction insert.
  - 3/8 trail off mid-line.
  - 0/8 loop, and 0/8 add a closing caption.
- **Audio:** the reposting accounts master very hot (momentary −2 to −10 LUFS, often saturated). Loudness alone could not place the peak in those clips.
- **The loudness peak vs the content peak:** offsets were 0, −1.4, −5.2, +2.0, −15.4, +3.8, −6.1 and +8.0 s.
  - The loudest moment is within ±6 s of the peak in 6/8 clips, but on the exact moment in only 3/8.
  - The loudest moment is often the setup shout or the celebration after the event.
  - **Use loudness to search near a chat peak, not to place the peak.**

## Podcast/interview clips (n = 6)
- **Length:** median **48.6 s** (29.9–104.9). Two shapes:
  - **Punchline clips** (P2–P4: 3.8–11.7M views): **29.9–34.6 s**, with a setup of **21.3–23.6 s** and a tail of **7.2–11.9 s**. This is the tightest cluster in the data.
  - **Story clips** (P1, P6: 8.2–12M views): **70–105 s**. One cold-opens on the most intense line, then gives the arc and the resolution. The other builds to a final gut-punch line in its last 4 s.
  - **Banter** (P5, 62.6 s, peak at 19 s, 43.6 s of tail, no button) is the weakest of the set.
- **Setup before the peak:** median **23.2 s** (19.0–100.6; 5 of 6 fall in 19–24 s).
- **Tail after the peak:** median **10.2 s** (4.3–46.6). In punchline clips it is 7–12 s.
- **How clips start:** speech starts at 0.0 s in 6/6.
  - **3/6 open on the host's question** at a sentence start.
  - **3/6 cold-open mid-story or mid-argument** (beginning with "And…", a number, or an insult).
- **Hook devices:**
  - persistent title box (2/6);
  - title card for the first 3 s only (1/6);
  - no title, where the question carries the hook (3/6);
  - **a stacked opener** for the first 3–7 s, with the speaker plus a photo or archive footage of the subject being discussed (2/6).
- **Layout:** **6/6 use single-speaker 9:16 crops that follow whoever is talking**, and 6/6 cut to the listener's face at least once.
  - b-roll or archive footage illustrating the claim (3/6);
  - a wide shot for a physical action, such as the walk-out (1/6).
- **Captions:** **6/6 burn in captions** of 1–4 words at a time, centred or lower-middle (y ≈ .55–.70).
  - ALL CAPS (3/6); sentence case (2/6); italic mixed case (1/6).
  - **Yellow emphasis** (2/6): either a keyword or the whole caption.
  - One word at a time (1/6).
  - Swears masked with asterisks (2/6).
- **Cuts per 10 s:** median **2.6** (0.5–4.7). **Speech rate:** median **3.3 words/s** (2.5–4.0).
- **Endings:**
  - a button or zinger line (2/6: 11.7M, 3.8M);
  - the punchline as the last line, then an end card (1/6: 8.2M);
  - a resolution line (1/6: 12M);
  - **mid-conversation with no button (2/6: the two lowest at 2.3M and 2.4M).**

## What published research and tools say
- **Chat bursts follow the moment.** LIGHTOR (Wang et al., ICDE 2020) works as follows:
  - It slides a **25 s window** over chat and takes the peak of the message count.
  - Its features are **message count, message length** (long messages mean off-topic talk) and **message similarity** (copy-pasted reactions).
  - It sets the **highlight start = peak − c**, where c is learned from labelled data; a worked example uses peak − 20 s.
  - It needs **> 500 chat messages per hour** for high precision. A second stage refines the boundaries from how viewers seek in the VOD.
  - Sources: https://arxiv.org/abs/1910.12201 · https://www.cs.sfu.ca/~jnwang/papers/lightor.pdf
- **Fu et al. 2017 (EMNLP, "Video Highlight Prediction Using Audience Chat Reactions"):**
  - Data: League of Legends Twitch broadcasts, with English and Traditional Chinese chat.
  - Labels come from community-made highlight videos.
  - A chat model plus a video CNN-RNN, combined, beats either one alone.
  - Source: https://aclanthology.org/D17-1102/
- **MINT (Song et al., "Finding Epic Moments in Live Content through Learning from Collective Decisions", EPJ Data Science):**
  - It embeds Twitch emotes in a vector space as a measure of audience sentiment.
  - It learns **popular (viewer-clipped) moments vs ordinary ones** from chat plus video, with **accuracy 0.8261**. The multimodal combination is critical.
  - Its suggestions span funny, sad, exciting and nervous moments, and a user study found them comparable to human editors.
  - The repo has no licence file, and the data is available on request.
  - Source: https://github.com/dscig/twitch-highlight-detection
- **KuaiHL (arXiv 2407.12002, 2024):**
  - Live highlight prediction from frames, audio, comments and ASR, without future frames.
  - It needs a **temporal alignment module because the modalities are offset in time**.
  - Its target is the view-time ratio per frame, not a yes/no label.
  - Source: https://arxiv.org/abs/2407.12002
- **Latency between video and chat:**
  - Twitch low-latency mode gives about **2–5 s** of video delay; normal mode about **10–15 s** (up to 30 s). These figures come from vendor and forum write-ups, not a measured study.
  - Chat itself arrives in milliseconds. So a chat burst lags the event by the video latency plus the time to read and type.
  - Sources: https://stream-rise.com/blog/twitch-low-latency-video · https://discuss.dev.twitch.com/t/how-to-reduce-broadcast-latency/23644
- **How the Twitch clip button works:**
  - It captures about **85 s before and 5 s after** the press.
  - A clip is **5–60 s long, 30 s by default**.
  - So viewer clips end just after the moment, and their ranges are free labels for good windows.
  - Source: https://dev.twitch.tv/docs/api/clips/
- **Simple open-source chat heuristics** (ideas only; licences not checked):
  - One flags a highlight when a **5 s** window is **≥ 3× a 180 s baseline**, with a 60 s cooldown, and logs laugh emotes (KEKW, OMEGALUL, LUL).
  - Another scores 10 s windows on keywords ("pog", "gg") averaged with audio.
  - Sources: https://github.com/bbyoutubeacc-crypto/twitch-highlight-clipper · https://github.com/ros-dorian/TwitchHack
- **openclip** (linzzzzzz, **MIT**) is an LLM-on-transcript clipper.
  - It first classifies the content type (entertainment, knowledge, speech, opinion, experience, business, review).
  - It scores **emotional impact, information value, interactivity, memorability and relatability**, plus **completeness, pacing, authenticity and uniqueness**.
  - For entertainment it keeps **complete jokes (setup → punchline → reaction)**.
  - It requires **standalone** clips that include the question that triggered the point.
  - It ranks on engagement, quality, viewer appeal, memorability, duration fit and standalone viability.
  - Its length presets run from 30–60 s up to 3–5 min (auto = 30 s–3 min).
  - Source: https://github.com/linzzzzzz/openclip
- **ClipsAI** (**MIT**) finds topic-coherent segments with **TextTiling over BERT embeddings** of the transcript. It reframes to 9:16 by following the active speaker (pyannote diarization). It is built for podcasts and interviews.
  - Sources: https://github.com/ClipsAI/clipsai · https://clipsai.com/references/clip
- **OpusClip's "virality score"** (0–99) is built from **Hook, Flow, Value and Trend**. Its 2026 vendor report says 80.2 % of viral clips burn in captions and 78.6 % animate them. Vendor blogs claim 21–34 s gives the best completion and 31–60 s the most total watch time; treat these as unverified.
  - Sources: https://help.opus.pro/docs/article/virality-score · https://www.opus.pro/blog/anatomy-of-a-viral-tiktok-2026 · https://www.opus.pro/blog/tiktok-length-format-retention-data
- **Clip economy:** paid clipper networks repost the biggest streamers at scale. CreatorDB counted about 1,087 clipper accounts for one top streamer and 759 for another in 30 days. That is why repost accounts, not the streamers themselves, hold the top stream clips.
  - Sources: https://creatordb.app/creator-news/the-rise-of-the-clip-economy/ · https://luminaclippers.com/blog/clipping-streamers
- **Licences:** openclip and ClipsAI are MIT, and dscig has no licence file. Use them as ideas only; no code was copied.

## Takeaways for the clipping tool
1. **Stream window = peak − 10 s … peak + 7 s** (measured medians 9.4 s and 7.1 s), about 17 s in total. Allow 5–20 s of setup when the context needs it.
2. **Let a headline carry the context.** With a headline, setup can be as short as 3–5 s, as in the 20M clip. Generate a headline that states the payoff for every stream clip.
3. **End on the reaction.** Cut 2–6 s after it, or cut to the other person's reaction. Trailing tails (> 12 s) belong to the weaker clips.
4. **Podcast punchline clips run about 30 s:** about 22 s of setup from the host's question, plus 7–12 s of tail ending on a button line. Story clips may run 70–105 s only if they cold-open on the strongest line or end on it.
5. **Use loudness and scene cuts to search near a chat peak, not to define it.** They hit the exact peak in only 3/8 stream clips.

Limits: 14 clips, chosen by views from a handful of clip accounts. The streams are mostly IRL, with only one gaming clip. The peak times are human judgements. Twitch, YouTube and Kick pages could not be reached from the cloud, so no chat logs were measured.
