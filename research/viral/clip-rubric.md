# Clip rubric: scoring candidate clips (draft for the clip-director skill)

**What it is for:** scoring candidate clips cut from (a) **live-stream VODs** (Twitch, YouTube Live, Kick) and (b) **long talking videos** (podcasts, interviews, talking heads).

**Where the numbers come from:** measured on 14 top TikTok clips from Dec 2025 – Nov 2026: 8 stream clips and 6 podcast clips, ≥ 1.6M views each (`clips-SUMMARY.md`, `clips/`). Published work fills the gaps: LIGHTOR, Fu et al. 2017, MINT, KuaiHL, openclip, ClipsAI. Sources are in the summary.

**Terms used below:**
- **Peak** = the moment the clip is about: the reaction, reveal, punchline or confession.
- **Setup** = time from the clip's start to the peak.
- **Tail** = time from the peak to the clip's end.

## 1. Headline: the measured shape of a winning clip

| | Stream clip | Podcast punchline clip | Podcast story clip |
|---|---|---|---|
| Length | **18 s** median (IQR 15–29) | **30–35 s** | 70–105 s |
| Setup before peak | **9.4 s** median (IQR 5.0–17.8) | **21–24 s** | cold-open on the peak, **or** the peak is the last line |
| Tail after peak | **7.1 s** median (IQR 4.3–11.9) | **7–12 s** | resolution ≤ 7 s, or a punchline-last ending + end card |
| Opening | inside the moment, or a setup line; a headline states the payoff | the host's question at a sentence start | the most intense line, or a shocking number |
| Ending | on the reaction (≤ 6 s after it) or the other party's reaction | a button/zinger line | resolution, or the punchline as the last words |

**The rule in one line:** start ~10 s before the moment (podcasts: at the question, ~22 s before), end ~2–7 s after the reaction, and let a headline carry whatever context the setup can't.

## 2. Scoring: 10 criteria, each 0–5, weights in brackets (total 100)

Score = Σ (score/5 × weight).
- **Publish:** ≥ 70 and no criterion at 0.
- **Rework the boundaries:** 55–69.
- **Drop:** < 55.

### C1. Peak strength (×15)
- **Stream:**
  - **5** = chat rate ≥ 5× the 180 s baseline, plus a clear audio/visual event (a scream, a laugh, a jump, a cut to a face).
  - **4** = 3–5× with an event.
  - **3** = 3× with no clear event, or a clear event with only 2× chat.
  - **1** = < 2× with nothing visible.
  - **0** = no peak.
- **Podcast:** the line has one of these:
  - a laugh from the room;
  - a reversal or confession ("I've never said that before");
  - an insult, conflict or walk-out;
  - a hard number or reveal.
  - **5** = two of them; **3** = one; **1** = an opinion with no turn.

### C2. Setup length before the peak (×12)
- **Stream:**
  - **5** = 5–15 s;
  - **4** = 3–5 s **with** a headline that states the context, or 15–20 s;
  - **3** = 20–30 s (conversation clips only);
  - **1** = 30–40 s;
  - **0** = < 2 s (the peak arrives before anyone knows what is happening) or > 40 s.
- **Podcast punchline:**
  - **5** = 18–26 s, starting at the question that triggers the point;
  - **3** = 12–18 s or 26–35 s;
  - **1** = beyond that.
- **Podcast story:** **5** if it cold-opens on the most intense line, or if the setup is the whole story with the payoff in the last 10 %.

### C3. Self-contained context (×12)
- **5** = a cold viewer knows who, what is at stake and why it matters by **3 s**. That can come from the line itself, or from a headline.
- **3** = by 8 s.
- **1** = needs outside knowledge (an in-joke, a running gag, an earlier stream).
- **0** = can't be understood alone.

openclip's "standalone" rule says the same: include the question or setup that triggered the point.

### C4. First-3-seconds hook (×12)
Each of these counts:
- speech or action within **0.5 s** (all 6 podcast clips have speech at 0.0 s);
- a question, conflict or intense line at the start;
- a headline that states the payoff on frame 1 (5/8 stream clips);
- a visual that raises a question (an object, a person mid-action).

Scores:
- **5** = two of them;
- **3** = one;
- **1** = a silent or slow opening over 2 s with no headline;
- **0** = the first 3 s are dead air or off-topic.

What didn't show up: 0/8 stream clips used a freeze-frame, a rewind or a zoom as the hook. Don't rely on them.

### C5. Payoff / reaction on screen (×10)
- **5** = the reaction face is visible and big. A punch-in close-up or the other party's reaction insert counts.
- **3** = the reaction is audible but the face is small (a facecam overlay at < 25 % width).
- **1** = the payoff is only described.
- **0** = no payoff inside the clip.

### C6. Tail after the peak (×8)
- **Stream:**
  - **5** = 2–7 s;
  - **4** = 7–12 s, if a second reaction or a tag line lands in it;
  - **2** = 12–20 s;
  - **0** = > 20 s.

  3/8 stream clips trailed off with 8.7–19.7 s of tail.
- **Podcast punchline:** **5** = 5–12 s, ending on a button; **2** = 12–20 s; **0** = > 20 s.
- **Story:** **5** = ≤ 7 s after the resolution, or the payoff as the last words.

### C7. Ending (×10)
- **5** = cut within **1 s after the reaction peaks**, or on a button or zinger line, or the punchline as the last words.
- **3** = ends at a sentence end with no button.
- **1** = mid-sentence or mid-conversation.

The two lowest-viewed podcast clips (2.3M and 2.4M) both ended mid-conversation; every podcast clip at 8M+ ended on a button, a resolution or the punchline.

### C8. Length (×8)
- **Stream:**
  - **5** = 12–30 s;
  - **4** = 8–12 s with a headline, or 30–45 s for a conversation;
  - **2** = 45–60 s;
  - **0** = > 60 s or < 6 s.
- **Podcast:**
  - **5** = 25–40 s (punchline), or 60–110 s for a single-arc story with the peak cold-opened or at the end;
  - **3** = 40–60 s;
  - **1** = > 110 s.

### C9. Clean boundaries (×8)
- **5** = starts at a sentence start, or a deliberate mid-thought cold open; ends at a sentence end with a word gap of ≥ 0.25 s at both cuts; no half-words.
- **3** = one boundary clips a word.
- **0** = both do.

### C10. One moment, one emotion (×5)
- **5** = one peak and one feeling (funny, shock, sad, hype, wholesome).
- **3** = two peaks that build on each other (a reveal, then a reaction to it).
- **1** = two unrelated moments in one clip. Split them instead.

## 3. Stream rules (chat-driven, for Twitch, YouTube Live and Kick VODs)

### 3.1 Chat signals (5 s bins, against a rolling 180 s baseline)

| Signal | Why | Use |
|---|---|---|
| **Message rate ratio** (5 s bin ÷ 180 s baseline) | A burst means something just happened (LIGHTOR; open-source clippers use ≥ 3×) | candidate at **≥ 3×**, strong at **≥ 5×** |
| **Unique chatters per bin** | One spammer isn't a moment | require ≥ 2× baseline |
| **Emote share and type** | Emotes carry the emotion (MINT embeds emotes) | laugh: KEKW, OMEGALUL, LUL, ICANT, "LMAO" · hype: Pog, POGGERS, "W" · shock: monkaS, D:, "??", "WHAT" · sad: Sadge, "F" · fail: "L", "-1", "RIP" → sets the clip's emotion and its headline verb |
| **Message length** | Short messages mean a reaction; long ones mean off-topic talk (LIGHTOR) | boost bins where the median length is ≤ 12 characters |
| **Similarity / copypasta** | The same message repeated means a shared reaction | boost bins where the top message is ≥ 20 % of all messages |
| **Viewer clips** (if any exist for the VOD) | Popular clips are ground truth (MINT) | treat each clip's end time as a peak and its range as a window prior |
| **Volume floor** | LIGHTOR needs > 500 messages/hour | below that, fall back to audio + transcript + scene-cut scoring |

- **Merge rule:** peaks less than 30 s apart become one candidate.
- **Cooldown:** 60 s after each one.
- **Ranking:** rank by C1 and keep the top N for full scoring.

### 3.2 Chat delay
- **Chat lags the event by D = video latency + read/typing time.**
  - Latency: Twitch low-latency is about 2–5 s, and normal mode is about 10–15 s (vendor figures, not measured).
  - Read/typing adds about 2–5 s.
  - LIGHTOR learns the same offset as "start = peak − c".
- **Default D = 6 s for Twitch and Kick, 10 s for YouTube Live.** These are assumptions to calibrate.
- **Calibrate per VOD:**
  1. Cross-correlate the chat-rate series with the streamer's audio loudness (or scene-change score) over the whole VOD.
  2. Take the lag (2–20 s) with the highest correlation as D.
  3. Use the default if the correlation is < 0.2.

### 3.3 Finding the event inside the chat peak
- **Search window:** [chat_peak − D − 8 s, chat_peak − D + 3 s].
- **Event time t_e** = the strongest of these in that window: a streamer loudness jump (momentary LUFS ≥ 6 dB above the 30 s median), a scene cut, or a laugh/scream detected in the audio.
- **Fallback:** t_e = chat_peak − D.
- **Don't use loudness alone to place the peak.** In the measured clips the loudest moment was within ±6 s of the peak in 6/8, but exact in only 3/8. It is often the setup shout or the celebration after.

### 3.4 The window
- **Default window = [t_e − 10 s, t_e + 7 s]**: X = 10 s before and Y = 7 s after, from the measured medians 9.4 s and 7.1 s. About 17 s in total.

**Start:**
1. Move the start back to where chat first rose above 1.5× baseline before the peak (the build-up), but no further than t_e − 20 s.
2. Snap it to the nearest sentence start or a ≥ 0.4 s pause in [t_e − 20, t_e − 4].
3. For conversation moments (a question then the answer), allow up to t_e − 30 s so the question is in. 2/8 measured clips needed 22–39 s of setup.

**End:**
1. Snap the end to the first ≥ 0.4 s pause after the reaction, in [t_e + 2, t_e + 12].
2. Extend to + 15 s only if a second reaction or a tag line lands there.
3. Never end mid-sentence.

**Other limits:**
- **Hard limits:** 8–45 s for streams; 60 s is the Twitch clip maximum and an outer cap.
- **Context the window can't hold:** write a **headline that states the payoff**. Keep the setup ≤ 15 s rather than stretching it. The 20M-view clip had a 5 s setup and a headline.

### 3.5 Stream packaging (from the measured clips)
- **Layout:**
  - IRL/camera streams: full-frame 9:16 crop on the face or the action (5/8).
  - Gaming: the gameplay centred with the facecam enlarged; or stacked, face on top. The one gaming clip used a small overlay and was the least viewed.
  - Context the picture lacks: stacked, with the stream on top and a still of the subject below (1/8, the 20M clip).
- **Headline:** a white rounded box with black text and CAPS on the verb: "[Who] [VERB] after [what]" plus 1–2 emoji. Hold it for the whole clip (4/8) or at least the first 9 s.
- **Speech captions:** optional for IRL (7/8 had none). Use them for gaming and noisy audio: 1–2 words, white with a black outline, centred.
- **Punch-in:** cut to a tight close-up (about 1.5×) at the reaction; or insert the other party's reaction.
- **Loudness:** normalise to −14 LUFS. Repost accounts master to −2…−10 LUFS, but that clips the audio.

## 4. Podcast/talking-video rules (transcript-driven)
1. **Find candidates** from the transcript: laughs (diarized laughter or "[laughter]"), reversals, confessions, numbers, insults or conflict, and topic shifts (TextTiling-style boundaries, as in ClipsAI). Classify each as **punchline**, **story** or **opinion** (openclip's content types).
2. **Punchline clip:**
   - Start at the **question that triggers it** (3/6 of the measured clips open on the host's question), 18–26 s before the punchline.
   - End 5–12 s after it, on a **button** (a tag line, a laugh or a zinger).
   - Target 25–40 s.
3. **Story clip:**
   - **(a) Cold open** on the most intense line, then the arc and the resolution, 60–110 s.
   - **(b) Build** to a gut-punch final line; end ≤ 1 s after it, then optionally an end card.
4. **Start mid-thought only when** the first line stands on its own (an "And I'm screaming…" emotional line, an insult, a shocking number). Otherwise start at a sentence start.
5. **Packaging** (6/6 did this):
   - Follow-the-speaker 9:16 crops.
   - Cut to the listener's face on reactions.
   - Burned-in captions of 1–4 words at y ≈ .55–.70, ALL CAPS or sentence case, with one emphasis colour (yellow) on the key word. Mask swears.
   - Optional: a 3–7 s stacked opener with a photo or archive footage of the person or event discussed (2/6), and b-roll matched to a claim (3/6).
   - Title: a 3 s black-box title card, or a persistent white box with a one-line summary.

## 5. Quick checklist for the clip-director skill
1. Peak found, and its emotion named (from the emote type or the line type).
2. Window = peak − 10 s … peak + 7 s (podcasts: at the question … punchline + 10 s), snapped to sentence edges.
3. Who, what and the stakes clear by 3 s: by the line itself or by a headline.
4. The reaction face visible, with a punch-in or a reaction insert.
5. Ends ≤ 1 s after the reaction or on a button; never trails > 12 s.
6. Length 12–30 s (stream) / 25–40 s (podcast punchline) / 60–110 s (story).
7. Score ≥ 70/100 on §2, with no zero.
