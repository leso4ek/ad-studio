// Ad Studio · the twelve stages. kind: 'decide' (Claude answers a schema), 'auto' (engines run), with gate = the user
// must approve before the run goes on (style, frames, animatic). Prompts point Claude at the ad-studio-director skill.
import fs from 'fs';
import path from 'path';
import { SCHEMAS, STYLES } from './schemas.mjs';
import { readJSON, writeJSON, run } from './util.mjs';
import * as render from './engines/render.mjs';
import * as audio from './engines/audio.mjs';
import { engines as voiceEngines, castVoices, checkSpeech, buildCues, srt } from './engines/voice.mjs';
import { lintBible, lintObject } from './lint.mjs';
import { emit } from './bus.mjs';

export const STYLE_LINES = {
  'ad-paper-cutout': 'Paper Cut-out: layered card stock, soft shadows, stop-motion on twos. Warm, handmade, homely products, food, family.',
  'ad-riso-print': 'Riso Print: three spot inks, halftone, misregistration, grain. Indie, youthful, design-literate brands, events, zines.',
  'ad-midcentury-toon': 'Mid-century Toon: flat 1950s/60s colour planes, off-register line, atomic shapes, jazzy holds. Nostalgic, witty, everyday objects.',
  'ad-kinetic-type': 'Kinetic Type: words slam in over bold colour fields, pictogram people, the product as a clean hero. Fast, cheap, punchy claims, TikTok.',
  'ad-toy-3d': 'Toy 3D: a soft-toy diorama in three.js, rounded matte shapes, real floor and light. Friendly, premium-playful, gadgets, kids-and-family (adult audience).',
};

const J = o => JSON.stringify(o, null, 1);
const dec = (ctx, id) => ctx.decision(id)?.output;

export const STAGES = [
  { id: 'brief', n: 1, title: 'Brief', kind: 'decide', schema: 'brief', lint: true,
    prompt: ctx => `Stage 1 · Brief (skill §1).
The user's brief (may be empty or partial): ${J(ctx.project.userBrief || {})}
${ctx.project.userBrief?.fictional !== false ? 'This first ad is for a FICTIONAL product: invent an original, plausible, honest product and brand name (no real brands, no real people).' : 'Use the user\'s real product exactly as described; invent nothing about it.'}
Format: ${ctx.project.userBrief?.aspect || '9:16'}, ${ctx.project.userBrief?.seconds || 20} seconds. Give 2-5 honest proof points, then only claims those proofs back.` },

  { id: 'premises', n: 2, title: 'Premises', kind: 'decide', schema: 'premises',
    prompt: ctx => `Stage 2 · Ten premises → one (skill §2, story-ad-playbook "ten premises").
Brief: ${J(dec(ctx, 'brief'))}
Write 10 different premises (different situations, not ten versions of one). In each the product must CAUSE the turn. Pick one by the playbook's test (relatable character, one emotion, a turn only this product causes, shootable in our code-drawn kit: places ${['kitchen', 'bedroom', 'office', 'bathroom', 'cafe', 'street', 'park', 'sky', 'studio'].join(', ')}).` },

  { id: 'hooks', n: 3, title: 'Hooks', kind: 'decide', schema: 'hooks',
    prompt: ctx => `Stage 3 · Three hooks for the first 1-3 seconds (skill §3).
Brief: ${J(dec(ctx, 'brief'))}
Chosen premise: ${J((dec(ctx, 'premises')?.premises || []).find(p => p.id === dec(ctx, 'premises')?.chosen))}
Write hooks A, B, C of different types (odd image / conflict mid-action / question / number / POV). On-screen text max 6 words. Choose the lead hook; the other two become A/B test variants.` },

  { id: 'story', n: 4, title: 'Story', kind: 'decide', schema: 'story',
    prompt: ctx => `Stage 4 · Story Spine and the five acts on the clock (skill §4).
Brief: ${J(dec(ctx, 'brief'))}
Premise: ${J((dec(ctx, 'premises')?.premises || []).find(p => p.id === dec(ctx, 'premises')?.chosen))}
Lead hook: ${J((dec(ctx, 'hooks')?.hooks || []).find(h => h.id === dec(ctx, 'hooks')?.lead))}
Total ${dec(ctx, 'brief')?.format?.seconds || 20} s. Five acts with t0/t1 covering 0 → end with no gaps; act 1 starts with the hook at 0. The product causes the turn in act 3 or 4. One emotion.` },

  { id: 'brandmap', n: 5, title: 'Brand map', kind: 'decide', schema: 'brandmap', lint: true,
    prompt: ctx => `Stage 5 · Brand map and claims (skill §5): plant early, pulse, reveal at the climax, tag at the end.
Brief: ${J(dec(ctx, 'brief'))}
Story: ${J(dec(ctx, 'story'))}
Every claim must cite which proof in the brief backs it. No absolutes, no health claims, no pressure, no real brands.` },

  { id: 'style', n: 6, title: 'Style', kind: 'decide', schema: 'style', gate: true,
    prompt: ctx => `Stage 6 · Choose the ad style (skill §6). The five original code-drawn styles:
${STYLES.map(s => `- ${s}: ${STYLE_LINES[s]}`).join('\n')}
Brief: ${J(dec(ctx, 'brief'))}
Story emotion: ${dec(ctx, 'story')?.emotion}; audience: ${J(dec(ctx, 'brief')?.audience)}
${ctx.project.userBrief?.style ? `The user prefers ${ctx.project.userBrief.style}; follow it unless it clearly hurts the ad (then say why).` : ''}
Pick the style that fits the product and the emotion; give one honest reason and why not for the others you considered.` },

  { id: 'bible', n: 7, title: 'Bible', kind: 'decide', schema: 'bible', lint: true, check: 'bible',
    prompt: ctx => `Stage 7 · Write the ad bible (skill §7: the bible format, the kit's places, props, poses, anims, layout rules and safe zones).
Slug "${ctx.slug}". Style: ${dec(ctx, 'style')?.style}. Duration ${dec(ctx, 'brief')?.format?.seconds || 20} s, 9:16 (1080×1920; a 16:9 version is laid out from the same bible, use l16 overrides only where needed).
Brief: ${J(dec(ctx, 'brief'))}
Hooks (lead ${dec(ctx, 'hooks')?.lead}; the others go in variants.hooks as replacements for the hook shot): ${J(dec(ctx, 'hooks')?.hooks)}
Story: ${J(dec(ctx, 'story'))}
Brand map: ${J(dec(ctx, 'brandmap'))}
Rules: shots tile 0 → endcard.t0 with no gaps; the end card runs from endcard.t0 to dur (2.5-3.5 s); every on-screen text stays inside the safe zone (x 0.05-0.86, y 0.14-0.80 of the frame) and long enough to read (characters/15 + 1.5 s); voice lines must fit before the next line starts (about 2.9 words per second at speed 0.95) and should end before the end card logo; product colours from the brief.
Return the complete bible JSON.` },

  { id: 'frames', n: 8, title: 'Style frames', kind: 'auto', gate: true },
  { id: 'voice', n: 9, title: 'Voice', kind: 'auto' },
  { id: 'animatic', n: 10, title: 'Animatic', kind: 'auto', gate: true },
  { id: 'final', n: 11, title: 'Final', kind: 'auto' },
  { id: 'scorecard', n: 12, title: 'Scorecard', kind: 'decide', schema: 'scorecard', after: 'report',
    prompt: ctx => `Stage 12 · Score the finished ad (skill §12) against the story-ad-playbook's seven rules, 1-5 each with a one-line note:
1 hook in 1-3 s, 2 all five acts, 3 a character we identify with, 4 the product causes the turn, 5 plant/pulse/reveal/tag, 6 one emotion, 7 kind contrast and honest claims.
Look at out/final-sheet.jpg (frames every 2 s of the 9:16 master) and read bible.json, voice/cues.json and out/checks.json. Total = sum. Say which hook variant you'd test first and what you'd fix in a next cut.` },
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
  return errs;
}

// ---------- automatic stages ----------
export const AUTO = {
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
    const review = await ctx.decide('frames-review', `Stage 8 · Style-frame review (skill §8). Read frames/sheet.jpg (one frame per shot + the end card, 9:16, no captions) and frames/w_*.jpg (16:9).
Check against the bible and the style: is the hook readable at a glance, is the product recognisable, any text over a face or outside the safe zone, empty or crowded frames, poses that tell the beat, contrast. If something is wrong, edit bible.json in this folder (only bible.json) and set changed=true; otherwise approve.`, SCHEMAS.frames);
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
