# Viral skits on TikTok — summary (8 videos, Nov 2026)

Sources: the 8 teardowns in `skits/` (all posted Jun – Nov 2026, seen 25 Nov 2026).
Method: `vidget.py` → claude-video watch (balanced) → faster-whisper base word times → `detectCuts` → key frames in `frames/`.

| Video | Account | Type | Views | Like % | Length | First cut | Cuts/10 s | Words/s | Captions | Hook | Ending |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [7655004069190192398](skits/tiktok-7655004069190192398.md) | @zachking | meta monologue, VFX | 68.5M | 20.4 | 27.9 s | 2.8 s | 5.37 | 1.96 | **giant red one-word** | direct address ("a message to all AI") | CTA as punchline |
| [7705166193585376543](skits/tiktok-7705166193585376543.md) | @brookemonk_ | two-person game sketch | 43.6M | 5.3 | 113.7 s | 0.7 s | 0.62 | 1.69 | none | **silent secret to camera** | ironic punchline |
| [7693620969625128214](skits/tiktok-7693620969625128214.md) | @adrianbliss | one actor, all roles, **sponsored** | 13.9M | 0.98 | 58.1 s | 2.0 s | 5.34 | 1.13 | dialogue + top title | odd image + pun title | punchline = product line |
| [7694716128580357398](skits/tiktok-7694716128580357398.md) | @adrianbliss | mockumentary confessional | 6.8M | 17.6 | 95.4 s | 2.7 s | 2.31 | 2.27 | dialogue + top title | known story × mundane | quiet button ("*Sigh*") |
| [7706705302376221965](skits/tiktok-7706705302376221965.md) | @spencewuah | one-person format parody | 5.4M | 10.3 | 124.0 s | 7.8 s | 1.61 | 2.97 | boxed lines | "address the controversy" | punchline sign-off |
| [7705104261855677727](skits/tiktok-7705104261855677727.md) | @kallmekris | one actor, parent + child | 4.0M | 11.7 | 45.2 s | 1.2 s | 2.43 | 3.83 | static premise card | "When your parent…" | reaction punch-in |
| [7670004746517794079](skits/tiktok-7670004746517794079.md) | @braxtoncomer | POV impression, lip-sync | 3.7M | 4.5 | 11.3 s | 5.5 s | 1.77 | (lyrics) | POV card | "POV: [person] doing…" | loop |
| [7648683859164400917](skits/tiktok-7648683859164400917.md) | @nutshellanimations | 2D animated, **sponsored** | 1.6M | 0.9 | 38.4 s | 0.5 s | 7.29 | (cartoon voices) | header + 1–3-word chunks | "Moms be like:" + time card | product CTA + button |

## Counts and medians
- **Length:** median **51.7 s** (11–124 s); two clusters: ≤ 45 s (4) and 95–124 s (3).
- **First cut:** median **2.35 s** (0.5–7.8 s). The two late first cuts are a one-take face (5.5 s) and a monologue that cuts to its evidence (7.8 s).
- **Cuts per 10 s:** median **2.37**; bimodal — **5.3–7.3** for scripted multi-role/animated sketches (3/8) vs **0.6–2.4** for one-camera performances (5/8).
- **Words per second (spoken dialogue, n = 6):** median **2.1** (1.13–3.83) — slower than explainers (3.06) because of pauses and wordless stretches.
- **Wordless stretches:** 3/8 have ≥ 7 s without words (29 s in the milk ad, a 17 s silent cold open in the berry game, 7 s in the AI sketch).
- **Captions:** a text card at the top in the first frame 5/8 (title in a black box ×2, premise/POV card ×2, fixed header ×1) · dialogue captions 3/8 · giant one-word 1/8 · none 1/8.
- **Hook types:** relatable premise card ("When your…", "X be like:", "POV:") 3 · odd image/costume 2 · secret shared with the viewer 1 · format parody 1 · direct address 1.
- **Endings:** **punchline 6/8 (75 %)** · loop 1 · CTA 2 (both are also the last joke). No cliffhangers.
- **Performers:** one person playing 2+ roles 3/8 · two people 1/8 · solo monologue/face 3/8 · animation 1/8.
- **Like rate:** median **7.8 %**; the two sponsored posts sit at 0.9–1.0 % (boosted).

## Rules worth reusing (with evidence)
1. **State the premise in a top text card from frame 1** (title, "When your [person]…:", "POV: …", "[Group] be like:"), held for the whole video or the first 3–4 s. 5/8, incl. 13.9M, 6.8M, 4.0M.
2. **Retell something everyone already knows** — a ritual (wine service), a famous story (the Fall), a familiar format (the influencer apology) — and break it at every step. Evidence: Bliss ×2, spencewuah.
3. **Give the viewer a secret before the characters speak.** A silent 10–17 s cold open with a "shh" to camera = dramatic irony for the rest. Evidence: brookemonk_ (43.6M, the top two-person sketch).
4. **Escalate in threes while the delivery gets calmer.** arson → jail → rock-star affair, each said more casually. Evidence: kallmekris; Bliss's three curses (28, 40, 48 s).
5. **The listener's reaction is the joke.** End on a silent stare or a push-in on the face. Evidence: kallmekris (44 s), Bliss ad (deadpan waiter), braxtoncomer (each cut closer).
6. **Put the strongest line at 55–70 % and end on a short button**, not a big finish: "capital of Canada is Ottawa" (60 %), "both the victim and the perpetrator" (58–68 %), then "*Sigh*" / "Thank you for your time." Evidence: Bliss Adam & Eve, spencewuah.
7. **For product skits, the product's own mechanic causes the turn**, and its claim is spoken in a character's voice. Evidence: nutshell (Block Blast clears the room), Bliss (the waiter's wine-speak sells the milk). Brand named by 7 s (Bliss) or shown at 52 % (nutshell).
8. **Let the product be the only saturated colour** in a desaturated or monochrome world. Evidence: Bliss (white/black set, green label), nutshell (B/W drawing, colour gameplay), brookemonk_ (one red chili).
9. **Make the CTA the final joke**, ideally said by a second character. Evidence: zachking (68.5M: "Please follow him."), nutshell ("go play … for free").
10. **One performer, many roles, locked-off singles**, one prop per character (glasses, wig, ears). Cheap and fast to cut at 5+ cuts/10 s. Evidence: Bliss ×2, kallmekris.
11. **Use a visible shrinking resource or time cards as the clock.** A tray of berries emptying; "7:04 AM → 2:38 PM → 4:45 PM". Evidence: brookemonk_, nutshell.
12. **Topical reversal beats topical opinion.** "I'm going to steal AI's job" flips the common fear; the video copies the look it mocks. Evidence: zachking.

## Recurring phrasing
- **"When your [relation] [does X] out of nowhere:"**, **"[Group] be like:"**, **"POV: [person] doing [thing]"** (premise cards).
- **"This is a message to all [X]."**, **"So there is a [thing] going viral again, and I think it is finally time that I address…"** (declaration opens).
- **"Yeah, so we're being [X], apparently"** (mid-conversation open).
- **"he said… and I said…"** (reported dialogue: one actor, two characters).
- Denial running gag: **"I'm not cheating. I would never cheat."**; pleading repetition: **"please don't be [X]" ×3**.
- Understatement and register clash: "Ooh, scary." / "humiliation ritual" / "cognitive impairment" for trivial things.
- Ritual clichés reused: "Excellent choice, sir", "The lady will taste", "We'll have another bottle".
- Sentences: 3–10 words for dialogue; long run-ons (15–30 words) only for the character who is the joke (the oversharing mum, the mock-apologiser).

## Visual styles that recur
1. **Phone selfie, one room, natural or LED light** — kallmekris, spencewuah, braxtoncomer (4/8 incl. brookemonk_'s tripod wide).
2. **Costume sketch on a real location or simple set** — Bliss (forest heath; white dining room), with a single bright prop (yellow suitcase, green-label bottle).
3. **Rough monochrome 2D** with colour only on the joke object — nutshellanimations.
4. **High-contrast black/white studio + one accent colour in giant serif captions** — zachking.

## For Ad Studio's Direction stage
- `3d-skit` / story-ad skit: offer two pacing presets — **scripted multi-role 5–7 cuts/10 s** and **performance 0.6–2.5 cuts/10 s** (both seen in hits).
- Bible: add `premiseCard` (top text, frame 1, y .14–.22 inside safe zones) and `coldOpen: silent` (≤ 17 s) options.
- Beat planner: three escalations (each calmer), strongest line at 55–70 %, a ≤ 3 s button after it; ending field `punchline` by default, `cta-as-joke` for ads.
- Product rule: the product's mechanic causes the turn, the claim is spoken in-character, and the product is the frame's only saturated colour.
