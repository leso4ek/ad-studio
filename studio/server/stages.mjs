// Ad Studio · the twelve stages. kind: 'decide' (Claude answers a schema), 'auto' (engines run), with gate = the user
// must approve before the run goes on (style, frames, animatic). Prompts point Claude at the ad-studio-director skill.
import fs from 'fs';
import path from 'path';
import { SCHEMAS, STYLES, SHOT_SIZES, CAM_MOVES } from './schemas.mjs';
import os from 'os';
import * as CATALOG from './catalog.mjs';
import { readJSON, writeJSON, run } from './util.mjs';
import * as render from './engines/render.mjs';
import * as audio from './engines/audio.mjs';
import { engines as voiceEngines, castVoices, checkSpeech, buildCues, srt } from './engines/voice.mjs';
import { lintBible, lintObject } from './lint.mjs';
import { emit } from './bus.mjs';
import * as AN from './engines/analyse.mjs';
import * as blender from './engines/blender.mjs';
import { ffmpeg7 } from './util.mjs';

export const STYLE_LINES = {
  'ad-paper-cutout': 'Paper Cut-out: layered card stock, soft shadows, stop-motion on twos. Warm, handmade, homely products, food, family.',
  'ad-riso-print': 'Riso Print: three spot inks, halftone, misregistration, grain. Indie, youthful, design-literate brands, events, zines.',
  'ad-midcentury-toon': 'Mid-century Toon: flat 1950s/60s colour planes, off-register line, atomic shapes, jazzy holds. Nostalgic, witty, everyday objects.',
  'ad-kinetic-type': 'Kinetic Type: words slam in over bold colour fields, pictogram people, the product as a clean hero. Fast, cheap, punchy claims, TikTok.',
  'ad-toy-3d': 'Toy 3D: a soft-toy diorama in three.js, rounded matte shapes, real floor and light. Friendly, premium-playful, gadgets, kids-and-family (adult audience).',
  'ad-manga-panels': 'Manga Panels: black-and-white comic page, screentone, speed and focus lines, sound effects, speech balloons, shots split into panels; the brand colour is the only colour. Energetic, funny, youthful products, gadgets, snacks.',
  'ad-scifi-toon': 'Sitcom Toon: thick boiling ink lines, flat cel shadow, big tired eyes, dirty suburban colour, sparing gadget glow and zaps. Deadpan comedy, everyday products made to feel like gadgets, adult humour.',
  'ad-crayon-book': 'Crayon Picture Book: wax crayon on toothy paper, hatched fills, wobbly same-hue outlines, hand-lettered words. Tender, warm, family, food, gifts, wellbeing (adult audience).',
  'ad-voxel-3d': 'Voxel Stage: blocky box-built characters and props on a dark stage with soft bokeh lights, alternating close-ups, a step bar and 1-3-word captions. The 3D skit format (and the texts of the 3D explainer).',
};

const J = o => JSON.stringify(o, null, 1);

// ---------- formats (round 12) ----------
// story-ad: the code-drawn story ad · 3d-skit: voxel characters on a dark stage (three.js), dialogue in steps, word captions
// 3d-explainer: one continuous Blender camera through a world built layer by layer, "If you… But… So…", word captions
// recreate: an uploaded video, analysed and rebuilt (remake with our tools, Genjutsu motion transfer, or mixed per shot)
export const fmt = ctx => ctx.project?.format || 'story-ad';
export const rc = ctx => ctx.project?.recreate || {};
/** the format the picture is made in (a recreate is remade as one of the other three) */
export const target = ctx => fmt(ctx) === 'recreate' ? (rc(ctx).target || 'story-ad') : fmt(ctx);
export const FIXED_STYLE = { '3d-skit': 'ad-voxel-3d', '3d-explainer': 'ad-voxel-3d' };
export const CUT_RATE = { 'story-ad': [1.8, 6.5], '3d-skit': [1.2, 6.5], '3d-explainer': [.8, 3.5], recreate: null };
export function appliesTo(st, project) {
  const f = project?.format || 'story-ad', t = f === 'recreate' ? (project.recreate?.target || 'story-ad') : f;
  return !st.formats || st.formats.includes(f) || (st.targets || []).includes(t);
}
const FORMAT_RULES = {
  '3d-skit': 'FORMAT 3D skit (voxel stage): two characters built from boxes talk it through on a dark stage with soft bokeh lights; the product is a voxel prop. Dialogue: short lines that alternate between the two (speaker = their cast id), close-ups that alternate between speakers with slow push-ins, a wide for the reveal; about 2-3 cuts per 10 s. When the story is a method, number it: overlay.steps = [{t0, t1, label "STEP 1", title 1-2 words}] at the top. Captions are 1-3 words at a time (captionMode "words").',
  '3d-explainer': 'FORMAT 3D explainer: ONE continuous camera (no cuts) glides through a 3D world that is built layer by layer, dips into a cutaway (a cross-section of the ground or the object) and comes back. Narration is a chain: "If you… But… So…", a new problem every 4-6 s and the part that fixes it appears on that beat; about 2.8 words per second; one recurring small prop for continuity. Every fact must be true and sourced (put the sources in reason). Captions: one word at a time in the centre (captionMode "words"). The shots of the bible are the BEATS of that one camera move: the picture comes from one Blender render, so shot layers are texts only.',
  'story-ad': '',
};
function formatBlock(ctx) {
  const t = target(ctx), r = rc(ctx), out = [];
  if (FORMAT_RULES[t]) out.push(FORMAT_RULES[t]);
  if (fmt(ctx) === 'recreate') {
    const a = ctx.decision('analysis')?.output;
    out.push(`RECREATE (mode ${r.mode || 'remake'}${r.rights ? ', the user owns the source video' : ', no rights to the footage: rebuild the structure only, never reuse it'}): follow the uploaded video's structure, timing, shot sizes, moves and rhythm, with our cast, wardrobe, items and product from the user's prompt.`);
    if (a) out.push(`The analysis: ${J({ summary: a.summary, kind: a.kind, hook: a.hook, beats: a.beats, look: a.look, rhythm: a.rhythm, characters: a.characters, props: a.props, product: a.product, places: a.places })}`);
    if (r.prompt) out.push(`The user's prompt: ${J(r.prompt)}`);
  }
  return out.length ? out.join('\n') + '\n' : '';
}
const promptOf = r => r.prompt ? Object.entries(r.prompt).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('; ') : '';
export const directorDir = cfg => (cfg.directorSkill || '~/.cache/ad-studio-skills/DirectorSKILL').replace(/^~/, os.homedir());
const dec = (ctx, id) => ctx.decision(id)?.output;

export const STAGES = [
  // recreate only: the uploaded video read by code (free), then by Claude
  { id: 'source', n: 0, title: 'Source video', kind: 'auto', formats: ['recreate'] },
  { id: 'analysis', n: 0, title: 'Analysis', kind: 'decide', schema: 'analysis', formats: ['recreate'],
    prompt: ctx => { const a = readJSON(path.join(ctx.adDir, 'source', 'analysis', 'analysis.json'), {}), r = rc(ctx);
      return `Recreate · analyse the uploaded video (skill §Recreate).
The code analysis (shots with times, motion score 0-1 and camera shift per shot, words per shot, loudness): ${J({ ...a, shots: (a.shots || []).map(s => ({ id: s.id, t0: s.t0, t1: s.t1, motion: s.motion, voice: s.voice })) })}
Look at the contact sheet(s): ${(a.sheets || []).map(f => `source/${f}`).join(', ')} (each row is one shot: its first, middle and last frame, labelled).
${(r.refs || []).length ? `The user's reference images (look at each): ${(r.refs || []).map(x => `${x.file}${x.label ? ` = ${x.label}` : ''}`).join('; ')}.` : 'No reference images.'}
The user's prompt (what the characters look like, wear and carry, the product, notes): ${promptOf(r) || '(none: keep the roles, invent original people and an original fictional product)'}
The user chose mode "${r.mode || 'remake'}" (remake = rebuild with our tools; transfer = Higgsfield Genjutsu keeps the original motion and swaps the look from the reference images; mixed = per shot)${r.rights ? '' : '; the user has NOT confirmed rights to the footage, so nothing of it may be reused'}.
Keep the code's shot ids and times (merge two only if the code split one shot); fill size, subject, angle, move, action, on-screen text, voice, people, complexity (low: one subject, simple gesture; mid: two subjects or a moving camera; high: crowds, physics, fast action) and physics. Map every character, prop, the product and the places to what they become in our version. Describe the look in neutral words: never name studios, shows, artists, real people or brands. Recommend a mode and a target format (you only advise: the user's mode stands).`; } },
  { id: 'brief', n: 1, title: 'Brief', kind: 'decide', schema: 'brief', lint: true,
    prompt: ctx => `Stage 1 · Brief (skill §1).
${formatBlock(ctx)}
The user's brief (may be empty or partial): ${J(ctx.project.userBrief || {})}
${fmt(ctx) === 'recreate' && rc(ctx).prompt?.product ? `The product is the user's: "${rc(ctx).prompt.product}". Use it as described; invent nothing about it beyond a plausible label and colours from the reference images.` : ctx.project.userBrief?.fictional !== false ? 'This first ad is for a FICTIONAL product: invent an original, plausible, honest product and brand name (no real brands, no real people).' : 'Use the user\'s real product exactly as described; invent nothing about it.'}
Format: ${ctx.project.userBrief?.aspect || '9:16'}, ${fmt(ctx) === 'recreate' ? Math.max(10, Math.min(60, Math.round(readJSON(path.join(ctx.adDir, 'source', 'analysis', 'analysis.json'), {}).duration || 20))) : ctx.project.userBrief?.seconds || 20} seconds. Give 2-5 honest proof points, then only claims those proofs back.` },

  { id: 'premises', n: 2, title: 'Premises', kind: 'decide', schema: 'premises', formats: ['story-ad', '3d-skit', '3d-explainer'],
    prompt: ctx => `Stage 2 · Ten premises → one (skill §2, story-ad-playbook "ten premises").
${formatBlock(ctx)}Brief: ${J(dec(ctx, 'brief'))}
${target(ctx) === '3d-explainer' ? 'For the explainer, a premise is a question the viewer has never asked but wants answered ("Where does the water go when…"), answered by showing how a thing works inside.\n' : ''}Write 10 different premises (different situations, not ten versions of one). In each the product must CAUSE the turn. Pick one by the playbook's test (relatable character, one emotion, a turn only this product causes, shootable in our code-drawn kit: places ${['kitchen', 'bedroom', 'office', 'bathroom', 'cafe', 'street', 'park', 'sky', 'studio'].join(', ')}).` },

  { id: 'hooks', n: 3, title: 'Hooks', kind: 'decide', schema: 'hooks',
    prompt: ctx => `Stage 3 · Three hooks for the first 1-3 seconds (skill §3).
Brief: ${J(dec(ctx, 'brief'))}
${formatBlock(ctx)}${fmt(ctx) === 'recreate' ? `Hook A reproduces the original opening (${J(ctx.decision('analysis')?.output?.hook)}) with our cast and product; B and C are variants of other types.` : `Chosen premise: ${J((dec(ctx, 'premises')?.premises || []).find(p => p.id === dec(ctx, 'premises')?.chosen))}`}
Write hooks A, B, C of different types (odd image / conflict mid-action / question / number / POV). On-screen text max 6 words. Choose the lead hook; the other two become A/B test variants.` },

  { id: 'story', n: 4, title: 'Story', kind: 'decide', schema: 'story',
    prompt: ctx => `Stage 4 · Story Spine and the five acts on the clock (skill §4).
${formatBlock(ctx)}Brief: ${J(dec(ctx, 'brief'))}
${fmt(ctx) === 'recreate' ? 'Follow the original beats from the analysis, act for act; the product causes the turn where the original turns.' : `Premise: ${J((dec(ctx, 'premises')?.premises || []).find(p => p.id === dec(ctx, 'premises')?.chosen))}`}
Lead hook: ${J((dec(ctx, 'hooks')?.hooks || []).find(h => h.id === dec(ctx, 'hooks')?.lead))}
Total ${dec(ctx, 'brief')?.format?.seconds || 20} s.${target(ctx) === '3d-explainer' ? ' The acts group the If/But/So beats (each act 1-3 beats).' : target(ctx) === '3d-skit' ? ' The acts are the steps of the conversation.' : ''} Five acts with t0/t1 covering 0 → end with no gaps; act 1 starts with the hook at 0. The product causes the turn in act 3 or 4. One emotion.` },

  { id: 'brandmap', n: 5, title: 'Brand map', kind: 'decide', schema: 'brandmap', lint: true,
    prompt: ctx => `Stage 5 · Brand map and claims (skill §5): plant early, pulse, reveal at the climax, tag at the end.
Brief: ${J(dec(ctx, 'brief'))}
Story: ${J(dec(ctx, 'story'))}
Every claim must cite which proof in the brief backs it. No absolutes, no health claims, no pressure, no real brands.` },

  { id: 'style', n: 6, title: 'Style', kind: 'decide', schema: 'style', gate: true,
    fixed: ctx => FIXED_STYLE[target(ctx)] && { style: FIXED_STYLE[target(ctx)], reason: `the ${target(ctx)} format is drawn in ${FIXED_STYLE[target(ctx)]}${target(ctx) === '3d-explainer' ? ' (texts and the end card; the picture is the Blender world)' : ''}`, alternatives: [{ style: 'ad-toy-3d', why_not: 'not the voxel look of this format' }], seedanceStyle: rc(ctx).seedanceStyle || (target(ctx) === '3d-explainer' ? '3d-animation' : 'low-poly') },
    prompt: ctx => `Stage 6 · Choose the ad style (skill §6). The original code-drawn styles:
${STYLES.map(s => `- ${s}: ${STYLE_LINES[s]}`).join('\n')}
Brief: ${J(dec(ctx, 'brief'))}
Story emotion: ${dec(ctx, 'story')?.emotion}; audience: ${J(dec(ctx, 'brief')?.audience)}
${rc(ctx).style ? `The user asked for ${rc(ctx).style} in the recreate form; use it unless it clearly hurts the ad.` : ''}${fmt(ctx) === 'recreate' ? `The original's look: ${ctx.decision('analysis')?.output?.look}.\n` : ''}${ctx.project.userBrief?.style ? `The user prefers ${ctx.project.userBrief.style}; follow it unless it clearly hurts the ad (then say why).` : ''}
Pick the style that fits the product and the emotion; give one honest reason and why not for the others you considered.
Also name seedanceStyle: the catalogue look for the AI-video (Seedance) route of the same ad, from: ${CATALOG.load().map(e => `${e.slug} (${e.traits[0]})`).join('; ')}.` },

  { id: 'direction', n: 7, title: 'Direction', kind: 'decide', schema: 'direction', check: 'direction', post: (ctx, o) => routeShots(ctx, o),
    prompt: ctx => `Stage 7 · Direct the ad (skill §Direction; method from the cinematic-director skill).
Read ONLY these files of the director skill (folder ${directorDir(ctx.cfg)}): assets/shot-plan-template.md, references/product-and-macro.md, and in references/genre-playbooks.md only "How to use a playbook" and the commercial section. Read nothing else from it.
${formatBlock(ctx)}${fmt(ctx) === 'recreate' ? `Shot table of the original (follow it: same order, sizes, moves and rhythm; put each original segment in source {t0, t1}${rc(ctx).mode === 'transfer' ? '; MOTION TRANSFER: keep every shot\'s t0/t1 equal to its source times, because the picture is the original motion re-skinned by Genjutsu; route "genjutsu"' : ''}): ${J(ctx.decision('analysis')?.output?.shots)}\n` : ''}Style: ${dec(ctx, 'style')?.style} (${STYLE_LINES[dec(ctx, 'style')?.style] || ''}). Duration ${dec(ctx, 'brief')?.format?.seconds || 20} s, 9:16.
Brief: ${J(dec(ctx, 'brief'))}
Lead hook: ${J((dec(ctx, 'hooks')?.hooks || []).find(h => h.id === dec(ctx, 'hooks')?.lead))}
Story: ${J(dec(ctx, 'story'))}
Brand map: ${J(dec(ctx, 'brandmap'))}
What the kit camera can do: sizes ${SHOT_SIZES.join('/')} framed on a subject (a cast id, "product" or a prop kind); angle eye/low/high; one move per shot (${CAM_MOVES.join(', ')}); ots left/right puts a soft foreground shoulder at the edge. People are big-headed toys: CU shows head and shoulders.
Rules: every shot has a story function and says what the viewer now understands; blocking before framing; one move or none per shot; never two consecutive shots with the same size on the same subject; 2-6 cuts per 10 s (end card excluded), faster in the hook and the turn; the product keeps one screen side (locks.productSide) except a centred reveal; plan where the words go (textZone) so cards never cover a face or the product label; shots tile 0 → the end card. Do not name real films, shots or people in any text the viewer sees.
Routes (how each shot is made; leave route out and the motion router decides): kit (code-drawn), three (the three.js stage: few objects, gestures, simple moves), blender (complex 3D: layered builds, flow, many objects, a long camera path), blender→genjutsu (a Blender motion re-skinned photoreal by Genjutsu, paid), seedance (complex live action from element sheets, paid), genjutsu (an uploaded segment re-skinned, paid, rights needed). Mark complexity low/mid/high and physics when it matters.` },

  { id: 'bible', n: 8, title: 'Bible', kind: 'decide', schema: 'bible', lint: true, check: 'bible',
    prompt: ctx => `Stage 7 · Write the ad bible (skill §7: the bible format, the kit's places, props, poses, anims, layout rules and safe zones).
${formatBlock(ctx)}Slug "${ctx.slug}". Style: ${dec(ctx, 'style')?.style}. Duration ${dec(ctx, 'brief')?.format?.seconds || 20} s, 9:16 (1080×1920; a 16:9 version is laid out from the same bible, use l16 overrides only where needed).
Brief: ${J(dec(ctx, 'brief'))}
Hooks (lead ${dec(ctx, 'hooks')?.lead}; the others go in variants.hooks as replacements for the hook shot): ${J(dec(ctx, 'hooks')?.hooks)}
Story: ${J(dec(ctx, 'story'))}
Brand map: ${J(dec(ctx, 'brandmap'))}
Direction (implement it shot for shot): ${J(dec(ctx, 'direction')?.shots)}
Locks: ${J(dec(ctx, 'direction')?.locks)}
For every direction shot write one bible shot with the same id, t0, t1 and trans, camera = {size, subject, angle, move} (add amount 0.3-0.8 when the move should be gentle or strong, ots when asked), and copy function, reason and textZone; place each card/hook text in its textZone (top: y 0.16-0.30, bottom: y 0.62-0.72) and keep the subject's layer where the framing expects it.
Rules: shots tile 0 → endcard.t0 with no gaps; the end card runs from endcard.t0 to dur (2.5-3.5 s); every on-screen text stays inside the safe zone (x 0.05-0.86, y 0.14-0.80 of the frame) and long enough to read (characters/15 + 1.5 s); voice lines must fit before the next line starts (about 2.9 words per second at speed 0.95) and should end before the end card logo; product colours from the brief.
${target(ctx) !== 'story-ad' ? 'Set captionMode "words".' : ''}${(rc(ctx).mode === 'transfer' || target(ctx) === '3d-explainer') ? ' The picture of every shot comes from a plate (Genjutsu takes or the Blender world), so shot layers are text cards only; places and cast are still listed for the end card and the element sheets.' : ''}
Return the complete bible JSON.`, post: (ctx, o) => ({ ...o, format: fmt(ctx), ...(target(ctx) !== 'story-ad' ? { captionMode: o.captionMode || 'words' } : {}),
      shots: o.shots.map(s => { const d = (ctx.decision('direction')?.output?.shots || []).find(x => x.id === s.id); return d ? { ...s, ...(d.route ? { route: d.route } : {}), ...(d.source ? { source: d.source } : {}) } : s; }) }) },
  // 3D explainer: Claude writes the world as code, checks a still per beat, then the world is rendered into a plate
  { id: 'world', n: 8, title: '3D world', kind: 'auto', formats: ['3d-explainer'], targets: ['3d-explainer'] },

  { id: 'frames', n: 9, title: 'Style frames', kind: 'auto', gate: true },
  { id: 'voice', n: 10, title: 'Voice', kind: 'auto' },
  { id: 'animatic', n: 11, title: 'Animatic', kind: 'auto', gate: true },
  { id: 'final', n: 12, title: 'Final', kind: 'auto' },
  { id: 'scorecard', n: 13, title: 'Scorecard', kind: 'decide', schema: 'scorecard', after: 'report',
    prompt: ctx => `Stage 12 · Score the finished ad (skill §12) against the story-ad-playbook's seven rules, 1-5 each with a one-line note:
1 hook in 1-3 s, 2 all five acts, 3 a character we identify with, 4 the product causes the turn, 5 plant/pulse/reveal/tag, 6 one emotion, 7 kind contrast and honest claims.
Look at out/final-sheet.jpg (frames every 2 s of the 9:16 master) and read bible.json, voice/cues.json and out/checks.json. Total = sum. Say which hook variant you'd test first and what you'd fix in a next cut.` },
  // optional and paid (about $0.10-1 of OpenRouter): runs only when the user starts it (runFrom 'audience')
  { id: 'audience', n: 14, title: 'Audience test', kind: 'auto', optional: true, paid: true },
];

// ---------- checks Claude's bible must pass before the stage counts ----------
export function checkBible(b) {
  const errs = [];
  const shots = [...(b.shots || [])].sort((x, y) => x.t0 - y.t0);
  if (shots[0] && Math.abs(shots[0].t0) > .01) errs.push('the first shot must start at 0');
  for (let i = 0; i < shots.length - 1; i++) if (Math.abs(shots[i].t1 - shots[i + 1].t0) > .01) errs.push(`gap or overlap between ${shots[i].id} and ${shots[i + 1].id}`);
  const last = shots[shots.length - 1];
  if (last && b.endcard && Math.abs(last.t1 - b.endcard.t0) > .01) errs.push(`the last shot must end at endcard.t0 (${b.endcard.t0})`);
  if (b.endcard && (b.dur - b.endcard.t0 < 2 || b.dur - b.endcard.t0 > 4.5)) errs.push('the end card should run 2-4.5 s');
  for (const s of shots) for (const l of s.layers || []) {
    if (l.type === 'char' && !b.cast?.[l.id]) errs.push(`${s.id}: character "${l.id}" is not in cast`);
    if (l.type === 'text' && !l.text) errs.push(`${s.id}: a text layer has no text`);
    if (l.type === 'prop' && !l.kind) errs.push(`${s.id}: a prop has no kind`);
  }
  for (const s of shots) if (s.place && s.place !== 'studio' && !b.places?.[s.place]) errs.push(`${s.id}: place "${s.place}" is not in places`);
  const lines = [...(b.vo?.lines || [])].sort((x, y) => x.at - y.at);
  for (let i = 0; i < lines.length; i++) {
    const words = lines[i].text.split(/\s+/).length, est = words / 2.9 / ((b.vo?.speed || .95) / .95), next = lines[i + 1]?.at ?? b.dur;
    if (lines[i].at + est > next + .3) errs.push(`voice line ${lines[i].id} (~${est.toFixed(1)} s) runs into the next line at ${next}`);
    if (lines[i].speaker && lines[i].speaker !== 'narrator' && !b.cast?.[lines[i].speaker]) errs.push(`voice line ${lines[i].id}: speaker "${lines[i].speaker}" is not in cast`);
  }
  errs.push(...checkDirected(b, b.format));
  return errs;
}

/** The directed-camera checks (only for bibles whose shots carry camera.size). */
export function checkDirected(b, format = 'story-ad') {
  const errs = [], shots = [...(b.shots || [])].sort((x, y) => x.t0 - y.t0);
  if (!shots.some(s => s.camera?.size)) return errs;
  const perTen = (shots.length - 1) / ((b.endcard?.t0 ?? b.dur) || 1) * 10, lim = CUT_RATE[format] === undefined ? CUT_RATE['story-ad'] : CUT_RATE[format];
  if (lim && (perTen < lim[0] || perTen > lim[1])) errs.push(`cut rate ${perTen.toFixed(1)} per 10 s is outside ${lim[0]}-${lim[1]}`);
  const continuous = format === '3d-explainer';
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i], c = s.camera || {};
    if (!c.size) errs.push(`${s.id}: no camera.size`);
    if (!s.reason) errs.push(`${s.id}: no reason (what the viewer now understands)`);
    const prev = shots[i - 1]?.camera;
    if (!continuous && prev && prev.size === c.size && prev.subject === c.subject) errs.push(`${s.id}: same size (${c.size}) on the same subject as the shot before`);
    if (['MCU', 'CU', 'ECU'].includes(c.size)) for (const l of s.layers || []) if (l.type === 'text' && ['card', 'hook'].includes(l.role) && (l.y ?? .4) > .31 && (l.y ?? .4) < .6) errs.push(`${s.id}: the ${l.role} text "${String(l.text).slice(0, 20)}" sits on the subject in a ${c.size} (move it to y ≤ 0.30 or ≥ 0.62)`);
  }
  const sides = shots.flatMap(s => (s.layers || []).filter(l => l.type === 'product' && Math.abs((l.x ?? .5) - .5) > .12).map(l => ((l.x ?? .5) < .5 ? 'left' : 'right')));
  if (new Set(sides).size > 1) errs.push('the product changes screen side between shots (keep one side; centre it only for the reveal)');
  return errs;
}

export function checkDirection(o, dur, format = 'story-ad') {
  const errs = [], shots = [...(o.shots || [])].sort((x, y) => x.t0 - y.t0), lim = CUT_RATE[format] === undefined ? CUT_RATE['story-ad'] : CUT_RATE[format];
  if (shots[0] && Math.abs(shots[0].t0) > .01) errs.push('the first shot must start at 0');
  for (let i = 0; i < shots.length - 1; i++) {
    if (Math.abs(shots[i].t1 - shots[i + 1].t0) > .01) errs.push(`gap or overlap between ${shots[i].id} and ${shots[i + 1].id}`);
    if (format !== '3d-explainer' && shots[i].size === shots[i + 1].size && shots[i].subject === shots[i + 1].subject) errs.push(`${shots[i + 1].id}: same size on the same subject as ${shots[i].id}`);
  }
  const end = shots.at(-1)?.t1 || dur, perTen = (shots.length - 1) / (end || 1) * 10;
  if (lim && (perTen < lim[0] || perTen > lim[1])) errs.push(`cut rate ${perTen.toFixed(1)} per 10 s is outside ${lim[0]}-${lim[1]}`);
  return errs;
}

/** The motion router over the direction: every shot gets a route (Claude's when given, else the rule in analyse.routeFor). */
export function routeShots(ctx, o) {
  const a = fmt(ctx) === 'recreate' ? readJSON(path.join(ctx.adDir, 'source', 'analysis', 'analysis.json'), null) : null, r = rc(ctx);
  const opts = { format: fmt(ctx), target: target(ctx), mode: r.mode || 'remake', rights: !!r.rights, photoreal: !!r.photoreal, allowPaid: ctx.cfg.router?.allowPaid !== false };
  return { ...o, shots: o.shots.map(s => {
    const src = s.source || (a && fmt(ctx) === 'recreate' ? { t0: s.t0, t1: s.t1 } : null);
    const ov = a && src ? a.shots.filter(x => x.t1 > src.t0 && x.t0 < src.t1) : [];
    const motion = ov.length ? { score: Math.max(...ov.map(x => x.motion?.score || 0)), camera: ov[0].motion?.camera } : { score: { static: 0, push: .2, pull: .2, handheld: .3 }[s.move] ?? .3 };
    const an = (ctx.decision('analysis')?.output?.shots || []).filter(x => src && x.t1 > src.t0 && x.t0 < src.t1);
    const shot = { motion, complexity: s.complexity || an[0]?.complexity || 'low', physics: s.physics ?? an.some(x => x.physics), people: an.some(x => x.people > 0) };
    let route = s.route;
    if (route === 'genjutsu' && !(opts.rights && fmt(ctx) === 'recreate')) route = null;   // never without rights to the footage
    if (!route) route = AN.routeFor(shot, opts).route;
    return { ...s, route, ...(src ? { source: src } : {}) };
  }) };
}

// ---------- automatic stages ----------
export const AUTO = {
  /** recreate: read the uploaded video by code (free): shots, stills, contact sheets, motion, words, loudness */
  async source(ctx) {
    const r = rc(ctx), src = r.source ? path.join(ctx.adDir, r.source) : null;
    if (!src || !fs.existsSync(src)) throw new Error('upload the source video first (source/…)');
    const a = await AN.analyse(ctx.cfg, src, path.join(ctx.adDir, 'source', 'analysis'), { slug: ctx.slug, signal: ctx.signal, whisper: ctx.cfg.analyse?.whisper !== false });
    ctx.files('source', [...a.sheets.map(f => `source/${f}`), 'source/analysis/analysis.json']);
    return { summary: `${a.shots.length} shots in ${a.duration.toFixed(1)} s (${a.rhythm.cutsPer10s} cuts per 10 s), ${a.audio.words} words, motion ${a.motion.mean}`, shots: a.shots.length, duration: a.duration };
  },

  /** 3D explainer: Claude writes the world (adlib JSON + optional bpy script), a still per beat is checked (up to 2 fixes), then the plate is rendered */
  async world(ctx) {
    const b = ctx.bible(), wdir = path.join(ctx.adDir, 'production', 'blender'), end = b.endcard?.t0 ?? b.dur, fps = 24;
    fs.mkdirSync(wdir, { recursive: true });
    const beats = b.shots.map(s => ({ id: s.id, t0: s.t0, t1: s.t1, what: s.reason || s.note || s.beat, voice: (b.vo?.lines || []).filter(l => l.at >= s.t0 && l.at < s.t1).map(l => l.text).join(' ') }));
    const base = `3D explainer world (skill §3D explainer; read studio/blender/README.md for the builders and the spec fields, and studio/blender/examples/fern_water.json as a worked example).
The bible: ${J({ title: b.title, product: b.product, places: b.places, dur: end, beats })}
Write the world that ONE continuous camera moves through from 0 to ${end} s at ${fps} fps, vertical 1080×1920: every part appears on its beat (appear keys), the camera path passes one key per beat (glide, dip into the cutaway, return), one recurring small prop for continuity. Keep the upper and lower thirds calm: the word captions sit at the centre-low area. No text objects. Engine "${ctx.cfg.blender?.engine || 'eevee'}" (the cloud falls back to what works).`;
    const write = o => { const spec = { fps, frame_start: 1, frame_end: Math.round(end * fps), resolution: [1080, 1920], ...o.spec }; if (o.script?.trim()) { fs.writeFileSync(path.join(wdir, 'world.py'), o.script); spec.script = path.join(wdir, 'world.py'); } fs.writeFileSync(path.join(wdir, 'world.json'), JSON.stringify(spec, null, 1)); return spec; };
    let out = (await ctx.decide('world', base, SCHEMAS.world)).output, spec = write(out), notes = [];
    const beatFrames = b.shots.map(s => Math.max(1, Math.round(((s.t0 + s.t1) / 2) * fps)));
    for (let round = 0; round < 2; round++) {
      const pre = { ...spec, render: { ...(spec.render || {}), percent: ctx.cfg.blender?.checkPercent || 30 } };
      const r = await blender.renderShot(ctx.cfg, pre, path.join(wdir, 'world-check'), { stills: beatFrames, slug: ctx.slug, stage: 'world', signal: ctx.signal });
      const stills = beatFrames.map(f => `production/blender/world-check/f_${String(f).padStart(4, '0')}.png`).filter(f => fs.existsSync(path.join(ctx.adDir, f)));
      ctx.files('world', stills);
      const rev = (await ctx.decide('world-review', `${base}\nYour world is in production/blender/world.json${out.script?.trim() ? ' + world.py' : ''}. Look at the still of every beat: ${stills.join(', ')} (frame = the middle of each beat, in beat order).
Check each against its beat: is the part that the voice talks about visible and readable at phone size, is the cutaway clear, is the camera close enough, nothing clipping or floating, the centre-low area free for the captions. verdict "approve" when it works; else "revised" with the complete corrected spec (and script), and notes per fix.`, SCHEMAS.world)).output;
      notes.push(...(rev.notes || []));
      if (rev.verdict !== 'revised') break;
      out = rev; spec = write(rev);
      void r;
    }
    // the plate: the whole continuous move, then frames for the page (1080×1920 cover)
    const full = path.join(wdir, 'world'), mp4 = path.join(ctx.adDir, 'production', 'previz', 'world.mp4');
    fs.mkdirSync(path.dirname(mp4), { recursive: true });
    const pct = ctx.cfg.blender?.platePercent || 50;
    await blender.renderShot(ctx.cfg, { ...spec, render: { ...(spec.render || {}), percent: pct } }, full, { mp4, slug: ctx.slug, stage: 'world', signal: ctx.signal });
    const n = await platesFromVideo(ctx.cfg, mp4, path.join(ctx.adDir, 'production', 'plates', 'world'));
    const nb = { ...b, shots: b.shots.map(s => ({ ...s, plate: { dir: 'plates/world', fps, start: +s.t0.toFixed(3) } })) };
    writeJSON(path.join(ctx.adDir, 'bible.json'), nb);
    ctx.files('world', ['production/previz/world.mp4', ...(ctx.files('world') || [])]);
    return { summary: `world rendered: ${n} frames at ${pct}%${notes.length ? `; fixed: ${notes.slice(0, 3).join('; ')}` : ''}`, frames: n, notes };
  },

  async frames(ctx) {
    const b = ctx.bible(), times = [...b.shots.map(s => +(s.t0 + (s.t1 - s.t0) * .6).toFixed(2)), +(b.endcard.t0 + 1.5).toFixed(2)];
    const shoot = async (tag) => {
      const fdir = path.join(ctx.adDir, 'frames'); if (fs.existsSync(fdir)) for (const f of fs.readdirSync(fdir)) if (/^[fw]_.*\.jpg$/.test(f)) fs.rmSync(path.join(fdir, f));
      const files = await render.stills(ctx.cfg, ctx.adDir, times, { aspect: '9:16', q: 'nosub=1', prefix: 'f_', slug: ctx.slug, stage: 'frames', signal: ctx.signal });
      const sheet = path.join(ctx.adDir, 'frames', 'sheet.jpg');
      await run(path.join(ctx.cfg.lib, '.venv', 'bin', 'python'), ['-I', path.join(ctx.cfg.lib, 'core', 'render', 'sheet.py'), sheet, ...files, '--cols', String(Math.min(6, files.length)), '--w', '360']);
      const l16 = await render.stills(ctx.cfg, ctx.adDir, [times[0], times[Math.floor(times.length / 2)], times[times.length - 1]], { aspect: '16:9', q: 'nosub=1', prefix: 'w_', slug: ctx.slug, stage: 'frames', signal: ctx.signal });
      ctx.files('frames', [...files, sheet, ...l16].map(f => path.relative(ctx.adDir, f)));
      emit('file', { slug: ctx.slug, stage: 'frames', files: ctx.files('frames'), tag });
    };
    await shoot('first');
    // Claude looks at the sheet and may edit bible.json once
    const review = await ctx.decide('frames-review', `Stage 9 · Style-frame review (skill §8, with the directed-frame failure checks). Read frames/sheet.jpg (one frame per shot + the end card, 9:16, no captions) and frames/w_*.jpg (16:9).
Check against the bible and the style: is the hook readable at a glance, is the product recognisable, any text over a face or outside the safe zone, empty or crowded frames, poses that tell the beat, contrast; and for directed shots: does each frame show its shot size and subject (a CU that reads as a medium is a failure), does the shot's reason read without sound, does the product keep its screen side, does any move hide the subject. If something is wrong, edit bible.json in this folder (only bible.json) and set changed=true; otherwise approve.`, SCHEMAS.frames);
    if (review.output.changed) {
      const nb = readJSON(path.join(ctx.adDir, 'bible.json'));
      const errs = [...(await ctx.validateBible(nb))];
      if (errs.length) throw new Error(`the revised bible fails: ${errs.slice(0, 5).join('; ')}`);
      await shoot('revised');
    }
    return { summary: review.output.changed ? `revised: ${review.output.notes.map(n => n.issue).join('; ')}` : 'approved as drawn', review: review.output };
  },

  async voice(ctx) {
    const b = ctx.bible(), dir = path.join(ctx.adDir, 'voice', 'lines');
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const lines = castVoices(b);
    let durs = null, used = null;
    for (const name of ctx.cfg.chains.voice) {
      const e = voiceEngines[name]; if (!e) continue;
      const a = await e.available(ctx.cfg);
      if (!a.ok) { ctx.fallback('voice', name, a.why); continue; }
      try { emit('engine', { slug: ctx.slug, stage: 'voice', engine: name, text: `speaking ${lines.length} lines` }); durs = await e.speak(ctx.cfg, lines, dir, { signal: ctx.signal, slug: ctx.slug, stage: 'voice' }); used = name; break; }
      catch (err) { ctx.fallback('voice', name, err.message); }
    }
    if (!durs) throw new Error('no voice engine worked');
    ctx.engine('voice', used);
    const check = await checkSpeech(ctx.cfg, lines, dir, { chain: ctx.cfg.chains.asr, signal: ctx.signal, slug: ctx.slug, stage: 'voice' });
    const words = readJSON(path.join(dir, 'words.json'), null);
    const cues = buildCues(lines, durs, words);
    writeJSON(path.join(ctx.adDir, 'voice', 'cues.json'), cues);
    fs.mkdirSync(path.join(ctx.adDir, 'out'), { recursive: true });
    fs.writeFileSync(path.join(ctx.adDir, 'out', `${ctx.slug}.srt`), srt(cues));
    const warn = [];
    const sorted = [...lines].sort((x, y) => x.at - y.at);
    sorted.forEach((L, i) => { const end = L.at + (durs[L.id] || 0), next = sorted[i + 1]?.at ?? b.dur; if (end > next + .05) warn.push(`${L.id} ends at ${end.toFixed(2)} s, after the next line/end (${next})`); });
    ctx.files('voice', [...lines.map(L => `voice/lines/${L.id}.wav`), 'voice/cues.json', `out/${ctx.slug}.srt`]);
    return { summary: `${lines.length} lines by ${used}; speech check: ${check.pass === null ? 'not run' : check.pass ? 'pass' : 'FAIL'}${warn.length ? `; ${warn.length} timing warning(s)` : ''}`, engine: used, durs, check: { engine: check.engine, pass: check.pass, report: check.report, lines: check.lines }, warnings: warn };
  },

  async animatic(ctx) {
    const o = path.join(ctx.adDir, 'out');
    const vid = await render.video(ctx.cfg, ctx.adDir, { aspect: '9:16', scale: .5, fps: 12, out: path.join(o, 'animatic-video.mp4'), slug: ctx.slug, stage: 'animatic', signal: ctx.signal });
    const ev = await render.events(ctx.cfg, ctx.adDir, { slug: ctx.slug, stage: 'animatic', signal: ctx.signal });
    const wav = await audio.mix(ctx.cfg, ctx.adDir, { events: ev, out: path.join(ctx.adDir, 'audio', 'mix.wav'), slug: ctx.slug, stage: 'animatic', signal: ctx.signal });
    await audio.draftMux(ctx.cfg, vid, wav, path.join(o, 'animatic.mp4'), { signal: ctx.signal });
    const rc = await render.readcheck(ctx.cfg, ctx.adDir, { aspect: '9:16', slug: ctx.slug, stage: 'animatic', signal: ctx.signal });
    const s9 = await render.safecheck(ctx.cfg, ctx.adDir, { aspect: '9:16', slug: ctx.slug, stage: 'animatic', signal: ctx.signal });
    const s16 = await render.safecheck(ctx.cfg, ctx.adDir, { aspect: '16:9', slug: ctx.slug, stage: 'animatic', signal: ctx.signal });
    writeJSON(path.join(o, 'checks.json'), { readcheck: rc, safe9x16: s9, safe16x9: s16 });
    ctx.files('animatic', ['out/animatic.mp4', 'audio/mix.wav', 'out/checks.json']);
    const bad = [!rc.pass && 'reading time', !s9.pass && 'safe zone 9:16', !s16.pass && 'safe zone 16:9'].filter(Boolean);
    return { summary: bad.length ? `checks to look at: ${bad.join(', ')}` : 'reading time and safe zones pass', checks: { readcheck: rc.pass, safe9x16: s9.pass, safe16x9: s16.pass }, details: { readcheck: rc.report, safe9x16: s9.out, safe16x9: s16.out } };
  },

  async final(ctx) {
    const b = ctx.bible(), o = path.join(ctx.adDir, 'out'), out = [], probes = {};
    const ev = await render.events(ctx.cfg, ctx.adDir, { slug: ctx.slug, stage: 'final', signal: ctx.signal });
    const wav = await audio.mix(ctx.cfg, ctx.adDir, { events: ev, out: path.join(ctx.adDir, 'audio', 'mix.wav'), slug: ctx.slug, stage: 'final', signal: ctx.signal });
    for (const [aspect, tag] of [['9:16', '9x16'], ['16:9', '16x9']]) {
      const v = await render.video(ctx.cfg, ctx.adDir, { aspect, fps: 24, out: path.join(o, `video-${tag}.mp4`), slug: ctx.slug, stage: 'final', signal: ctx.signal });
      const m = await audio.master(ctx.cfg, v, wav, path.join(o, `${ctx.slug}-${tag}.mp4`), { slug: ctx.slug, stage: 'final', signal: ctx.signal });
      out.push(path.relative(ctx.adDir, m.out)); probes[tag] = { ...(await audio.probe(m.out)), log: m.log };
      fs.rmSync(v, { force: true });
    }
    // hook variants (9:16 only): same ad, a different first shot
    const lead = ctx.decision('hooks')?.output?.lead;
    for (const h of (ctx.cfg.final?.variants === false ? [] : b.variants?.hooks || [])) {
      if (h.id === lead) continue;
      const q = `hook=${h.id}`;
      const evh = await render.events(ctx.cfg, ctx.adDir, { slug: ctx.slug, stage: 'final', signal: ctx.signal, q });
      const wavh = await audio.mix(ctx.cfg, ctx.adDir, { events: evh, out: path.join(ctx.adDir, 'audio', `mix-hook${h.id}.wav`), slug: ctx.slug, stage: 'final', signal: ctx.signal });
      const v = await render.video(ctx.cfg, ctx.adDir, { aspect: '9:16', fps: 24, q, out: path.join(o, `video-hook${h.id}.mp4`), slug: ctx.slug, stage: 'final', signal: ctx.signal });
      const m = await audio.master(ctx.cfg, v, wavh, path.join(o, `${ctx.slug}-hook${h.id}.mp4`), { slug: ctx.slug, stage: 'final', signal: ctx.signal });
      out.push(path.relative(ctx.adDir, m.out)); probes[`hook${h.id}`] = await audio.probe(m.out); fs.rmSync(v, { force: true });
    }
    const reveal = b.shots.find(s => s.beat === 'reveal') || b.shots[Math.floor(b.shots.length / 2)];
    await audio.poster(ctx.cfg, path.join(o, `${ctx.slug}-9x16.mp4`), reveal.t0 + (reveal.t1 - reveal.t0) * .7, path.join(o, `${ctx.slug}-poster.jpg`));
    // a contact sheet of the master for the scorecard
    const ff = await import('./util.mjs').then(u => u.ffmpeg7(ctx.cfg)), sheetDir = path.join(o, 'sheet'); fs.mkdirSync(sheetDir, { recursive: true });
    await run(ff, ['-y', '-v', 'error', '-i', path.join(o, `${ctx.slug}-9x16.mp4`), '-vf', 'fps=1/2,scale=360:-2', path.join(sheetDir, 's_%02d.jpg')]);
    const shots = fs.readdirSync(sheetDir).filter(f => f.endsWith('.jpg')).sort().map(f => path.join(sheetDir, f));
    await run(path.join(ctx.cfg.lib, '.venv', 'bin', 'python'), ['-I', path.join(ctx.cfg.lib, 'core', 'render', 'sheet.py'), path.join(o, 'final-sheet.jpg'), ...shots, '--cols', '6', '--w', '300']);
    const checks = readJSON(path.join(o, 'checks.json'), {}); writeJSON(path.join(o, 'checks.json'), { ...checks, probes });
    ctx.files('final', [...out, `out/${ctx.slug}-poster.jpg`, `out/${ctx.slug}.srt`, 'out/final-sheet.jpg']);
    return { summary: `${out.length} file(s): ${out.map(f => path.basename(f)).join(', ')}`, probes };
  },
};

// ---------- stage 13: the audience test ----------
// Token economy: the dossier is built by code; Claude is called twice, each time in a fresh one-off session at low
// effort without the skill prompt, with only what it needs (the brief's audience for setup, the report for the read).
AUTO.audience = async function audience(ctx) {
  const MF = await import('./engines/mirofish.mjs');
  const a = await MF.available(ctx.cfg); if (!a.ok) throw new Error(a.why);
  const brief = readJSON(path.join(ctx.adDir, 'brief.json'), {}), b = ctx.bible(), hooks = dec(ctx, 'hooks') || {};
  const lean = { fresh: true, noSkill: true, noTools: true, effort: 'low', maxTurns: 2 };
  // the setup is cached next to the run: a retry (or a second run of the same cut) costs no new Claude call
  const setupFile = path.join(ctx.adDir, 'out', 'audience', 'setup.json'), bibleFile = path.join(ctx.adDir, 'bible.json');
  const cached = fs.existsSync(setupFile) && fs.statSync(setupFile).mtimeMs > fs.statSync(bibleFile).mtimeMs ? readJSON(setupFile) : null;
  const setup = cached || (await ctx.decide('audience-setup', `You set up a simulated-audience test (MiroFish) of a finished ${b.dur}-second vertical video ad. Do not read any files.
Product: ${brief.product?.name}: ${brief.product?.what}
Audience in the brief: ${J(brief.audience || {})}
Openings: ${(hooks.hooks || []).map(h => `${h.id} "${h.onScreen}"`).join(', ')}
Write (1) the requirement paragraph MiroFish will simulate, in plain English, and (2) 3-5 viewer segments that would really see this ad in a TikTok/Reels feed: mostly the target audience, plus one sceptical or indifferent group. No real brands or people. Answer with JSON matching the schema; "reason" is one sentence.`, SCHEMAS.audienceSetup, lean)).output;
  if (!cached) writeJSON(setupFile, setup);
  const dossier = MF.buildDossier(ctx.adDir, { segments: setup.segments, question: setup.requirement });
  const outDir = path.join(ctx.adDir, 'out', 'audience');
  // never name the brand here: the question would hand the viewers the answer to "what do you remember"
  const category = String(brief.product?.what || 'a product').replace(new RegExp(brief.product?.name || '^$', 'gi'), 'it').split(/[,.]/)[0].replace(/^A /, 'a ');
  const interview = `You just saw a ${b.dur}-second ad for ${category} in your feed (described in the material you know). Answer in 2-4 sentences, in your own voice: did you stop or keep scrolling in the first seconds, and why? What do you remember: which brand was it, and what does it do? Do you believe what it says? Would you try it? Which opening would have stopped you: ${(hooks.hooks || []).map(h => `${h.id} "${h.onScreen}"`).join(', ')}?`;
  const res = await MF.runTest(ctx.cfg, { dossier, requirement: setup.requirement, interview, name: `${b.title} · audience`, outDir }, { slug: ctx.slug, signal: ctx.signal });
  const said = (res.interviews || []).slice(0, 16).map(r => `- ${r.agent}: ${r.text.slice(0, 400)}`).join('\n');
  const posts = res.posts.slice().sort((x, y) => (y.likes || 0) - (x.likes || 0)).slice(0, 12).map(p => `- ${p.author}: ${p.text}`).join('\n');
  const verdict = (await ctx.decide('audience', `Read this simulated-audience report about a ${b.dur}-second ad for ${brief.product?.name} and turn it into a verdict. Do not read any files.
Simulated viewers are language-model agents, so treat this as a smoke test: low or medium confidence, never high.\nMiroFish's own config step seeds the first posts and may already guess the winning opening; only pick bestHook if the viewers' reactions (not just the seed posts or the report's framing) favour it.
Scores 1-5: stopScroll (would they stop in the first 2 s), watchThrough, brandRecall (would they remember "${brief.product?.name}"), trust (do they believe the claims), clickIntent. bestHook: A, B or C if the report supports one, else "unclear". comments: 3-8 short representative viewer comments taken or condensed from the posts/report (label who). fixes: concrete changes to the ad. risks: misreadings or complaints.

MIROFISH REPORT (truncated):
${res.report.slice(0, 14000)}

TOP SIMULATED POSTS:
${posts || '(none)'}

INTERVIEWS (every simulated agent was asked the same question after the run; MiroFish also makes agents of the brand, the characters and platforms, so weigh only the viewer groups):
${said || '(none)'}
Answer with JSON matching the schema; "reason" is two sentences.`, SCHEMAS.audience, lean)).output;
  const rec = { stage: 'audience', at: new Date().toISOString(), output: { ...verdict, costUsd: res.costUsd, stats: res.stats, setup, mock: !!res.mock } };
  writeJSON(path.join(ctx.adDir, 'decisions', '14-audience.json'), rec);
  writeJSON(path.join(outDir, 'verdict.json'), rec.output);
  if (ctx.cfg.memory?.enabled !== false) { const P = await import('./pipeline.mjs'), M = await import('./memory.mjs'); await P.learn(ctx.slug, () => M.signalsFromAudience(ctx.slug, verdict), ctx.signal); }
  ctx.files('audience', ['out/audience/setup.json', 'out/audience/dossier.md', 'out/audience/report.md', 'out/audience/verdict.json']);
  const sc = verdict.scores;
  return { summary: `stop ${sc.stopScroll} · watch ${sc.watchThrough} · recall ${sc.brandRecall} · trust ${sc.trust} · click ${sc.clickIntent} · hook ${verdict.bestHook} · $${(res.costUsd || 0).toFixed(2)}`, costUsd: res.costUsd, stats: res.stats };
};

/** After the scorecard: REPORT.md for people. */
export function writeReport(ctx) {
  const d = id => ctx.decision(id)?.output || {}, b = ctx.bible(), sc = d('scorecard'), o = path.join(ctx.adDir, 'out');
  const premise = (d('premises').premises || []).find(p => p.id === d('premises').chosen) || {};
  const checks = readJSON(path.join(o, 'checks.json'), {});
  const md = `# ${b.title || ctx.slug}

${b.product?.name} · ${b.style} · ${b.dur} s · made with Ad Studio (all LLM decisions by Claude)

## The ad
- Premise: ${premise.logline || ''}
- Lead hook ${d('hooks').lead}: ${(d('hooks').hooks || []).find(h => h.id === d('hooks').lead)?.onScreen || ''}
- Turn: ${d('story').turn || ''}
- Emotion: ${d('story').emotion || ''}
- Tag line: ${d('brandmap').tag?.line || ''}

## Files
${fs.readdirSync(o).filter(f => /\.(mp4|srt|jpg)$/.test(f) && !/^video-|animatic-video/.test(f)).map(f => `- out/${f}`).join('\n')}

## Scorecard (${sc.total ?? '?'}/35)
| Rule | Score | Note |
|---|---|---|
${(sc.scores || []).map(s => `| ${s.rule} | ${s.score} | ${s.note} |`).join('\n')}

Verdict: ${sc.verdict || ''}

Test first: hook ${sc.bestHook || ''}. Fixes for a next cut:
${(sc.fixes || []).map(f => `- ${f}`).join('\n')}

## Checks
- Reading time: ${checks.readcheck?.pass ? 'pass' : 'see checks.json'}
- Safe zones: 9:16 ${checks.safe9x16?.pass ? 'pass' : 'see checks.json'}, 16:9 ${checks.safe16x9?.pass ? 'pass' : 'see checks.json'}
${Object.entries(checks.probes || {}).map(([k, p]) => `- ${k}: ${p?.w}×${p?.h}, ${p?.fps} fps, ${p?.dur} s${p?.log ? `; ${String(p.log).split('\n').filter(l => /LUFS/.test(l)).join(' ')}` : ''}`).join('\n')}

## Claims and their basis
${(d('brandmap').claims || []).map(c => `- "${c.text}" (basis: ${c.basis})`).join('\n')}
`;
  fs.writeFileSync(path.join(o, 'REPORT.md'), md);
  return 'out/REPORT.md';
}

export { lintBible, lintObject };

/** A video → JPEG plate frames for the kit page (production/plates/<name>/f_00001.jpg …, 1080×1920 cover, 24 fps). */
export async function platesFromVideo(cfg, video, outDir, { fps = 24, w = 1080, h = 1920 } = {}) {
  fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
  const ff = await ffmpeg7(cfg);
  const r = await run(ff, ['-y', '-v', 'error', '-i', video, '-vf', `fps=${fps},scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}`, '-q:v', '3', path.join(outDir, 'f_%05d.jpg')]);
  if (r.code !== 0) throw new Error(`plate frames failed: ${r.err.slice(-300)}`);
  return fs.readdirSync(outDir).filter(f => f.endsWith('.jpg')).length;
}
