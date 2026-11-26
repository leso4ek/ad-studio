---
name: clip-director
description: Picks, trims and packages short clips from long videos and live-stream VODs (Twitch, YouTube Live, Kick) the way the most-viewed clips are made: the moment chat exploded plus the right amount of build-up, a headline that states the payoff, clean sentence boundaries, and an ending right after the reaction. Use when Ad Studio's clipper asks for clip-pick, when scoring or trimming candidate clips, or when the user asks to clip a stream, podcast or long video.
---

# Clip director

The clipper (`studio/`, format `clip`) runs in four stages:
1. **Video and chat** come in.
2. **Candidates** are found by code.
3. **You pick and trim** (`clip-pick`).
4. The edit engine renders each clip at 9:16.

The numbers below come from 14 viral TikTok clips (Dec 2025 – Nov 2026, 1.6M–20M views) and the chat-highlight research. The full rubric with every criterion is in `research/viral/clip-rubric.md`; read it when you score.

## The shape of a winning clip

| | Stream clip | Podcast punchline | Podcast story |
|---|---|---|---|
| Length | **about 18 s** (12–30) | **25–40 s** | 60–110 s |
| Before the peak | **about 10 s** (5–15) | **18–26 s**, from the question | cold open on the peak, or the peak as the last line |
| After the peak | **2–7 s** | **5–12 s**, on a button line | resolution ≤ 7 s |
| Hook | a headline box states the payoff | speech at 0.0 s, the question | the most intense line |

## How to pick
1. **One moment, one emotion per clip.** Split two unrelated peaks into two clips.
2. **Standalone by 3 s.** A cold viewer knows who it is about, what is at stake and why it matters. If the setup can't say it in about 15 s, write the **headline** instead of stretching the clip.
3. **Start** at a sentence start, or on a deliberate cold-open line that stands alone. Never cut inside a word: the app checks this against the word times.
4. **End** within 1 s after the reaction peaks, or on a button or zinger line. Never mid-conversation: the weakest hits did that.
5. **Skip** in-jokes, running gags and anything that needs an earlier stream.

## Stream specifics
- **The window:** the code puts the moment at the chat peak minus the chat delay (6 s on Twitch and Kick, 10 s on YouTube Live; calibrated per VOD from the audio). The window keeps 10 s before the moment and 7 s after it, snapped to sentences. You may widen it to about 20 s before when the moment is a question and its answer.
- **Emotion:** the chat sample at the peak tells you which one it is, and that sets the headline's verb. Laughter: KEKW, LUL, ICANT, LMAO. Hype: Pog, W. Shock: "??", WHAT. Sad: F, Sadge. Fail: L, RIP.
- **Headline:** "[Who] [VERB] after [what]", with the verb in caps and 1–2 emoji, held for the whole clip or at least 9 s. Keep it to 6 words or fewer in the app's title field.
- **Captions:** no speech captions on IRL clips (the app's default). Use them for noisy gaming audio.

## Scores in clip-pick (1–5 each)
| Score | What it rates |
|---|---|
| **hook** | the first 3 s |
| **setup** | length and clarity |
| **peak** | strength (chat ratio + a visible event) |
| **payoff** | the reaction on screen |
| **standalone** | context |

Publish clips that would reach 70/100 on the full rubric. Leave out the rest and give the reason in `skipped`.
