# Viral explainers on TikTok — summary (9 videos, Nov 2026)

Sources: the 9 teardowns in `explainers/` (all posted Dec 2025 – Oct 2026, seen 25 Nov 2026). Cited earlier work: `research/teardowns/` (@1hidden_by_design ×4, @whatif.sim tutorial).
Method: `vidget.py` → claude-video watch (balanced) → faster-whisper base word times → `detectCuts` → key frames in `frames/`.

| Video | Account | Type | Views | Like % | Length | First change | Cuts/10 s (det. / by eye) | Words/s | Captions | Hook | Ending |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [7645388187266714893](explainers/tiktok-7645388187266714893.md) | @neurofacts.101 | 3D bio micro-clip | 79.1M | 19.7 | 17.4 s | ~3 s | 0 / 1.2 | 0 | static block | odd image + comfort line | loop |
| [7585322044917566751](explainers/tiktok-7585322044917566751.md) | @chemteacherphil | vlog, **brand partner** | 48.5M | 0.43 | 52.8 s | 0.07 s | 4.17 | 3.81 | boxed phrase chunks | demo in motion | tagline + catchphrase |
| [7678816770500660493](explainers/tiktok-7678816770500660493.md) | @astro_alexandra | host + images, **sponsored** | 16.3M | 0.58 | 92.2 s | 11.7 s | 0.98 | 3.54 | none | secret + disagreement | sponsor CTA |
| [7686237105361571086](explainers/tiktok-7686237105361571086.md) | @mindbeneath0 | 2D animated | 10.1M | 12.9 | 60.5 s | ~4 s | 0.17 / 2.5 | 3.06 | **one word, centre** | "What if" about *you* | open question (loop) |
| [7694061135577746701](explainers/tiktok-7694061135577746701.md) | @cloveranimationns | 3D POV what-if | 8.8M | 5.3 | 77.5 s | 7.0 s | 1.03 | 0 | HUD + italic serif line | countdown | back to first frame (loop) |
| [7695148481966640398](explainers/tiktok-7695148481966640398.md) | @cloveranimationns | 3D POV what-if | 6.5M | 6.1 | 61.8 s | ~4 s | 0.32 / 1.6 | 0 | HUD + italic serif line | countdown | payoff (wave) |
| [7696096160829771021](explainers/tiktok-7696096160829771021.md) | @whatif.sim | 3D voxel what-if | 3.6M | 6.6 | 61.4 s | 3.6 s | 0.49 | 0 | HUD + italic serif line | countdown + absurd premise | follow card (CTA) |
| [7702504298537602335](explainers/tiktok-7702504298537602335.md) | @scientificamerican | host + collage | 2.6M | 13.8 | 179.8 s | 2.9 s | 3.17 | 2.94 | serif phrase lines | news stakes | resolution + eerie note |
| [7615669383377030422](explainers/tiktok-7615669383377030422.md) | @primalspace | 3D history build | 0.64M | 4.8 | 108.2 s | 1.4 s | 1.11 | 2.91 | 2–3-word chunks, centre | odd fact | resolution (wrap) |

## Counts and medians
- **Length:** median **61.8 s** (range 17–180 s); 6 of 9 are 50–95 s.
- **First visible change:** median **3.6 s** (0.07–11.7 s). The 3D POV videos hold the first shot until their countdown hits zero (3.6 s, 7.0 s).
- **Cuts per 10 s:** detector median 0.98; counting soft cuts by eye, median **1.2** (0.49–4.17). Only the two live-action/collage pieces exceed 3. Animated and 3D explainers live at **0.5–2.5**.
- **Words per second (narrated, n = 5):** median **3.06** (2.91–3.81). **4 of 9 (44 %) have no voice at all** — on-screen text only.
- **Captions:** HUD + one italic serif sentence 3/9 · phrase/line captions 2/9 · one-word or 2–3-word centre captions 2/9 · static block 1/9 · none 1/9.
- **Hook types:** countdown/"what if" POV 3 · "what if" question to *you* 1 · secret/disagreement 1 · news stakes 1 · odd fact 1 · odd image + comfort 1 · demo in motion 1.
- **Endings:** loop 3 (33 %) · resolved payoff 3 (33 %) · CTA 3 (33 % — 2 of them sponsor CTAs) · cliffhanger 0.
- **Like rate:** median **6.1 %**. The two sponsored posts (0.43 %, 0.58 %) have the highest "views" but the lowest likes → paid reach. Organic hits: 5–20 %.

## Rules worth reusing (with evidence)
1. **Put a visible clock on screen in the first frame.** A HUD countdown to the event (3.6–9 s), cut exactly at zero, then a second countdown to the return. Evidence: @cloveranimationns ×2, @whatif.sim (3 countdowns in 61 s). 6.5–8.8M views each.
2. **Make the premise about the viewer.** "What if some of the people *you* talk to…", POV hands in frame, "Your nose catches it…". Evidence: @mindbeneath0 (10.1M, 26k comments), the 3 POV sims, @neurofacts ("whenever you're sad").
3. **One hard number at ~40 % of the runtime** turns speculation into a "fact": "up to 50 % of people", "8.2 billion farts, 90 mL each", "9 billion times every second". Evidence: mindbeneath0, whatif.sim, sciam.
4. **Re-hook with "But…" every 10–40 s.** Short pieces: a new caption or claim every ~4 s; long pieces (3 min): a "But then…" turn every 25–40 s. Evidence: sciam (75.8, 101, 114.7 s), clover water (46 s), @1hidden_by_design chain (4–6 s).
5. **Close the premise early and open a bigger one at 45–60 %.** "THINGS THE FARTS CHANGED: 0 … why is the sea pulling back?"; "But in five seconds… it all comes back." Evidence: whatif.sim (27 s), clover water (46 s).
6. **Explain with a scale ladder or a layer build, not with cuts.** Zoom one order of magnitude per beat ("SCALE · 1 NANOMETRE") or add one physical layer per problem. Evidence: clover protons (6 scale jumps in 7 s), primalspace (6 problem→fix layers), @1hidden_by_design.
7. **Silent explainers need two text registers:** a small-caps HUD for numbers (top-left, label + big counter + fact line) and one calm italic sentence (centre, ≤ 8 words, every ~4 s). Evidence: 3/9, all 3.6–8.8M.
8. **Start real, then x-ray.** 2–5 s of the familiar real view, then cut to the 3D cross-section underneath. Evidence: primalspace (drone → 3D at 5.4 s), clover protons (park → cells at 23 s).
9. **End on the opening frame, an open question, or a "N seconds later".** 3/9 loop; the 17 s @neurofacts clip (79M) has no ending at all. Evidence: clover protons, mindbeneath0, neurofacts.
10. **Anthropomorphise the mechanism.** "tiny kinesin proteins trying their best for your happiness" got 15.6M likes on 79M views. Evidence: neurofacts.
11. **In a sponsored explainer, the sponsor answers the narrator's confusion.** "I'm not an astrophysicist… But I did learn that [sponsor] has tutors". Plant at ~40 %, CTA at the end. Evidence: astro_alexandra.
12. **Discount boosted posts.** Like rate < 1 % = paid reach (chemteacherphil 0.43 %, astro 0.58 %); don't copy their pacing as proof of organic virality.

## Recurring phrasing
- **"What if [everyone/basic thing] [did/disappeared] [for 5 seconds / at the same time]?"** (4/9 incl. captions)
- **"But [problem]." / "But then, [opposite] happened."** (5/9)
- **"There's a terrifying concept called [term]"**, **"Some scientists think… And some don't"**, **"Something big is happening in [everyday thing]."**
- **"Don't believe me? Pause this video and…"** (interaction dare), **"So the next time…"** (hand-back ending)
- **"[N] seconds later"**, **"It wasn't the X. It never is."**, **"Not enough to [X]. Sorry."**
- Power words: terrifying, literally, absolutely, instantly, even, all at once, for the first time in history, a stroke of genius.
- Sentences: 4–8 words in silent text explainers; 8–14 in narrated animation; 15–30 for talking heads.

## Visual styles that recur
1. **Stylised real-time 3D POV sims** (rounded or voxel people, daylight city/beach), HUD top-left + italic serif line — @cloveranimationns, @whatif.sim. Cheap to make with code (see the @whatif.sim method in `research/teardowns/TOOLS.md`).
2. **Flat 2D vector with glow and grain** on a magenta/purple ground, one-word captions — @mindbeneath0 (16:9 posted as is).
3. **Simple 3D construction cutaways** (clay, wood, brick, untextured) — @primalspace, @1hidden_by_design.
4. **Scientific photoreal 3D micro-worlds** (blue/teal, one warm-coloured actor) — @neurofacts.101, the "inside" of clover protons.
5. **Host + collage** (green screen or selfie, credited images, TV clips, meme inserts) — @astro_alexandra, @scientificamerican.

## For Ad Studio's Direction stage
- `3d-explainer` format: keep 0.8–3.5 cuts/10 s (fits 8/9 here); add an optional `hud` layer (label, counter, fact) and a `countdown` beat type; allow `voice: none` with ≤ 8-word captions every ~4 s.
- Beat planner: one re-hook ("But…", new countdown, scale jump) at least every 10 s for ≤ 90 s pieces; one number around 40 %; a premise reversal between 45 % and 60 %.
- Ending field: `loop` (return to frame 1 / "N seconds later") | `open-question` | `cta-card`.
