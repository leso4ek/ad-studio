// Ad Studio · production: the shot board. Turns the bible into shots that each have a route, a previz, a prompt,
// references (element sheets), paid takes (estimated first, confirmed by you) and a chosen take.
//   ads/<slug>/production/plan.json      the board
//   ads/<slug>/production/previz/<shot>.mp4, takes/<shot>_tNN.mp4, assets/<id>_N.png, blender/<shot>/...
// Routes: 'seedance' (OpenRouter, previz as motion reference) · 'kit' (code-drawn, free) · 'blender' (3D render, free)
import * as CATALOG from './catalog.mjs';
import fs from 'fs';
import path from 'path';
import { readJSON, writeJSON, run, ffmpeg7, now } from './util.mjs';
import { emit } from './bus.mjs';
import * as orx from './engines/openrouter.mjs';
import * as blender from './engines/blender.mjs';
import * as render from './engines/render.mjs';
import * as comfy from './engines/comfy.mjs';
import { REPO } from './util.mjs';

let CFG = null; const jobs = new Map();
const seedOf = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 2147483647; return h; };
export function initProduction(cfg) { CFG = cfg; }
const dir = (adDir, ...p) => path.join(adDir, 'production', ...p);
const planFile = adDir => dir(adDir, 'plan.json');
export const plan = adDir => readJSON(planFile(adDir));
function save(adDir, slug, p) { p.updated = now(); writeJSON(planFile(adDir), p); emit('production', { slug, kind: 'plan' }); return p; }

// ---------- references and prompts, the way the Higgsfield creators do it ----------
// Every element (character, place, product, prop) has a role line ("STRICT JUNO IDENTITY AND COSTUME") and 1–3 chosen
// views. A shot sends 2–6 reference images in a fixed order, and its prompt carries a REFERENCES block that names the job
// of each one, in the same order. No first/last frames. An optional previz still is a positioning-only reference.
export const ROLE = {
  character: a => `STRICT ${a.name.toUpperCase()} IDENTITY: face, hair, body proportions and costume exactly as shown`,
  place: a => `STRICT ${a.name.toUpperCase()} ENVIRONMENT: architecture, materials, colours and lighting exactly as shown`,
  product: a => `EXACT ${a.name.toUpperCase()} PRODUCT: shape, proportions, colours and label exactly as shown; never redesign it`,
  prop: a => `EXACT ${a.name.toUpperCase()}: design and colours exactly as shown`,
};
export const LAYOUT_ROLE = 'CONTEXTUAL POSITIONING ONLY: a grey blockout sketch; use it for who stands where, spacing, product placement and camera side. NOT a starting frame; take no colours, shapes or style from it';

/** Ordered reference list for a shot: [{file, label}] (max 6). */
export function refList(adDir, p, s) {
  const out = [];
  for (const id of s.refs || []) {
    const a = p.assets.find(x => x.id === id); if (!a) continue;
    const picks = (a.picks?.length ? a.picks : a.chosen ? [a.chosen] : []).slice(0, a.kind === 'place' ? 2 : 2);
    picks.forEach((f, i) => out.push({ id, file: path.join(adDir, f), rel: f, label: `${a.role || (ROLE[a.kind] || ROLE.prop)(a)}${picks.length > 1 ? ` (view ${i + 1} of ${picks.length})` : ''}` }));
  }
  if (s.layoutRef && s.previz) out.push({ id: 'layout', file: dir(adDir, 'previz', `${s.id}_layout.png`), rel: `production/previz/${s.id}_layout.png`, label: LAYOUT_ROLE });
  return out.slice(0, 6);
}

export function buildPrompt(shot, bible, p, refs = []) {
  const chars = (shot.layers || []).filter(l => l.type === 'char').map(l => l.id);
  const product = (shot.layers || []).some(l => l.type === 'product');
  const placeKind = bible.places?.[shot.place]?.kind || shot.place || 'studio', time = shot.time || bible.places?.[shot.place]?.time || 'day';
  const texts = (shot.layers || []).filter(l => l.type === 'text').map(l => l.text.replace(/\n/g, ' '));
  const secs = Math.max(4, Math.round(shot.t1 - shot.t0));
  const cam = shot.camera ? (shot.camera.zoom ? (shot.camera.zoom[1] > shot.camera.zoom[0] ? 'a slow, steady push-in' : 'a slow pull-out') : 'locked off') : 'locked off at eye level';
  return [
    `FORMAT: ${secs} seconds, 1 shot, vertical 9:16, 24 fps.`,
    `STYLE: ${p.settings.stylePara || bible.stylePara || 'clean cinematic look'}`,
    `CAMERA: 35 mm lens, ${cam}.`,
    'MUSIC: FALSE. No music, no score. Diegetic sound only.',
    'CUT POLICY: one single continuous shot; no cuts, no dissolves, no speed ramps.',
    'MOTION SPEED AND QUALITY: real-time speed for every movement, natural weight, smooth and continuous, never jerky; no slow motion.',
    refs.length ? `REFERENCES:\n${refs.map((r, i) => `- reference image ${i + 1}: ${r.label}.`).join('\n')}\nPreserve complete character, product and location consistency with the references.` : '',
    `SETTING AND BLOCKING: ${placeKind}, ${time}. ${describe(shot, bible)}`,
    chars.length ? `CAST RULE: exactly ${chars.length} ${chars.length === 1 ? 'person' : 'people'} (${chars.join(', ')}). Nobody else in frame.` : product ? 'CAST RULE: no people; the product is the subject.' : '',
    `ACTION: ${shot.action || shot.note || describe(shot, bible)}`,
    product ? `PRODUCT: ${bible.product.name}, a ${bible.product.kind}; label "${bible.product.label}". Never change its shape, colours or label.` : '',
    'NO TEXT: no subtitles, no captions, no on-screen words or logos other than the printed product label.',
    texts.length ? `(The words "${texts.join('" / "')}" are added later in the edit; keep the upper third calm.)` : '',
  ].filter(Boolean).join('\n');
}
function describe(shot, bible) {
  const bits = [];
  for (const l of shot.layers || []) {
    if (l.type === 'char') bits.push(`${l.id} stands ${l.x < .4 ? 'left' : l.x > .6 ? 'right' : 'centre'}, ${l.pose || 'neutral'} pose, facing ${l.face || 'camera'}${(l.anim || []).includes('wave') ? ', waving' : ''}`);
    if (l.type === 'product') bits.push(`the ${bible.product.kind} ${(l.anim || []).includes('reveal') ? 'is revealed large in the centre, light blooming behind it' : `is ${l.scale > 1 ? 'large' : 'small'} ${l.x > .6 ? 'on the right' : l.x < .4 ? 'on the left' : 'in the centre'}`}`);
    if (l.type === 'prop') bits.push(`a ${l.kind.replace('-', ' ')} ${l.x > .6 ? 'right' : l.x < .4 ? 'left' : 'centre'}`);
  }
  return bits.join('; ') + '.';
}

// ---------- board ----------
export function init(adDir, slug, { route = 'seedance', model = 'bytedance/seedance-2.5-flash', resolution = '480p', imageModel = 'bytedance-seed/seedream-5-5' } = {}) {
  const bible = readJSON(path.join(adDir, 'bible.json')); if (!bible) throw new Error('no bible yet');
  const old = plan(adDir);
  const look = readJSON(path.join(adDir, 'decisions', '06-style.json'))?.output?.seedanceStyle, lookE = look && CATALOG.load().find(e => e.slug === look);
  const p = { slug, created: old?.created || now(), settings: { route, model, resolution, aspect: '9:16', imageModel, finalModel: 'bytedance/seedance-2.5', finalResolution: '720p', stylePara: lookE?.stylePara || bible.stylePara, ...(lookE ? { catalogStyle: look } : {}), ...(old?.settings || {}) }, assets: old?.assets || [], shots: [] };
  if (!p.assets.length) {
    for (const [id, c] of Object.entries(bible.cast || {})) p.assets.push({ id: `char-${id}`, name: id, kind: 'character', desc: `${id}: ${c.role || 'character'}, hair ${c.hairStyle} ${c.hair}, top ${c.top}, trousers ${c.bottom}`, files: [], chosen: null, picks: [], status: 'todo' });
    const pc = bible.product.colors || {};
    p.assets.push({ id: 'product', name: bible.product.name, kind: 'product', picks: [], desc: `${bible.product.name}: a ${bible.product.kind} with a ${pc.body || ''} body, a ${pc.cap || ''} cap and a ${pc.label || ''} label printed "${bible.product.label}" in ${pc.labelInk || 'dark'} letters`, files: [], chosen: null, status: 'todo' });
    for (const [id, pl] of Object.entries(bible.places || {})) p.assets.push({ id: `place-${id}`, name: id, kind: 'place', desc: `${pl.kind} at ${pl.time || 'day'}, empty, wide three-quarter view`, files: [], chosen: null, picks: [], status: 'todo' });
  }
  for (const a of p.assets) { a.name ||= a.id.replace(/^(char|place)-/, ''); a.picks ||= a.chosen ? [a.chosen] : []; a.role ||= (ROLE[a.kind] || ROLE.prop)(a); }
  for (const s of bible.shots) {
    const prev = old?.shots?.find(x => x.id === s.id);
    const refs = [...(s.layers || []).filter(l => l.type === 'char').map(l => `char-${l.id}`), ...((s.layers || []).some(l => l.type === 'product') ? ['product'] : []), ...(bible.places?.[s.place] ? [`place-${s.place}`] : [])];
    const shot = { id: s.id, t0: s.t0, t1: s.t1, seconds: Math.max(4, Math.round(s.t1 - s.t0)), route: prev?.route || route, refs: prev?.refs || refs,
      layoutRef: prev?.layoutRef ?? false, seed: prev?.seed ?? seedOf(`${slug}:${s.id}`), previz: prev?.previz || null, takes: prev?.takes || [], chosen: prev?.chosen ?? null,
      status: prev?.status || 'todo', notes: prev?.notes || '', promptBy: prev?.promptBy || 'template', promptEdited: !!prev?.promptEdited, final: prev?.final || null };
    shot.prompt = prev?.promptEdited || prev?.promptBy === 'claude' ? prev.prompt : buildPrompt(s, bible, p, refList(adDir, p, shot));
    p.shots.push(shot);
  }
  return save(adDir, slug, p);
}

export function patchShot(adDir, slug, id, patch) {
  const p = plan(adDir), s = p.shots.find(x => x.id === id); if (!s) throw new Error('no such shot');
  for (const k of ['route', 'prompt', 'refs', 'layoutRef', 'notes', 'seconds']) if (k in patch) s[k] = patch[k];
  if ('prompt' in patch) s.promptEdited = true;
  if ('chosen' in patch) { s.chosen = patch.chosen; s.status = 'chosen'; }
  return save(adDir, slug, p);
}
export function patchSettings(adDir, slug, patch) {
  const p = plan(adDir);
  if (patch.catalogStyle !== undefined) {
    const e = patch.catalogStyle && CATALOG.load().find(x => x.slug === patch.catalogStyle);
    if (patch.catalogStyle && !e) throw new Error(`no catalogue style "${patch.catalogStyle}"`);
    patch = { ...patch, stylePara: e ? e.stylePara : readJSON(path.join(adDir, 'bible.json'))?.stylePara };
  }
  Object.assign(p.settings, patch); return save(adDir, slug, p);
}

function lock(slug, what) { if (jobs.has(slug)) throw new Error(`busy: ${jobs.get(slug)}`); jobs.set(slug, what); }
const unlock = slug => jobs.delete(slug);
export const busy = slug => jobs.get(slug) || null;

/** previz: the kit animatic cut to the shot, or a Blender render of production/blender/<id>.json */
export async function previz(adDir, slug, id) {
  lock(slug, `previz ${id}`);
  try {
    const p = plan(adDir), s = p.shots.find(x => x.id === id), out = dir(adDir, 'previz', `${id}.mp4`), ff = await ffmpeg7(CFG);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const bspec = dir(adDir, 'blender', `${id}.json`);
    if (s.route === 'blender' || fs.existsSync(bspec)) {
      if (!fs.existsSync(bspec)) throw new Error(`write production/blender/${id}.json first (Claude writes it from the shot)`);
      await blender.renderShot(CFG, bspec, dir(adDir, 'blender', id), { mp4: out, slug, stage: 'production' });
      s.previz = { kind: 'blender', file: path.relative(adDir, out), at: now() };
    } else {
      // a clean previz: no on-screen text, no captions (words in a motion reference confuse the video model)
      let src = dir(adDir, 'previz', '_full.mp4');
      if (!fs.existsSync(src) || fs.statSync(src).mtimeMs < fs.statSync(path.join(adDir, 'bible.json')).mtimeMs)
        src = await render.video(CFG, adDir, { aspect: '9:16', scale: .5, fps: 12, q: 'nosub=1&notext=1', out: src, slug, stage: 'production' });
      const r = await run(ff, ['-y', '-v', 'error', '-ss', String(s.t0), '-t', String(s.t1 - s.t0), '-i', src, '-vf', 'scale=480:854,fps=24', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', out]);
      if (r.code !== 0) throw new Error(r.err.slice(-300));
      s.previz = { kind: 'kit', file: path.relative(adDir, out), at: now() };
    }
    await run(ff, ['-y', '-v', 'error', '-i', out, '-frames:v', '1', dir(adDir, 'previz', `${id}_first.png`)]);
    await run(ff, ['-y', '-v', 'error', '-sseof', '-0.08', '-i', out, '-frames:v', '1', dir(adDir, 'previz', `${id}_last.png`)]);
    await run(ff, ['-y', '-v', 'error', '-ss', String(((s.t1 - s.t0) / 2).toFixed(2)), '-i', out, '-frames:v', '1', dir(adDir, 'previz', `${id}_mid.png`)]);
    // a grey blockout for the positioning reference: a coloured previz still makes Seedance copy its flat look
    await run(ff, ['-y', '-v', 'error', '-i', dir(adDir, 'previz', `${id}_mid.png`), '-vf', 'format=gray,gblur=sigma=2.2,eq=contrast=0.55:brightness=0.12,edgedetect=mode=colormix:high=0.25,format=gray', '-frames:v', '1', dir(adDir, 'previz', `${id}_layout.png`)]);
    s.status = s.status === 'todo' ? 'previz' : s.status;
    save(adDir, slug, p);
    return s.previz;
  } finally { unlock(slug); }
}

export function estimate(adDir, id, kind = 'draft') {
  const p = plan(adDir), s = p.shots.find(x => x.id === id), m = kind === 'final' ? p.settings.finalModel : p.settings.model, r = kind === 'final' ? p.settings.finalResolution : p.settings.resolution;
  return { kind, model: m, resolution: r, estimate: orx.estimateVideo(m, r, p.settings.aspect, s.seconds), spent: orx.spent(), cap: CFG.budget?.capUsd ?? 10, mock: orx.mock(CFG) };
}

/** One paid generation; `confirm` must be true. kind 'draft' (Flash 480p) or 'final' (the chosen draft's prompt, refs and seed at final quality). */
export async function take(adDir, slug, id, { confirm, kind = 'draft' } = {}) {
  if (!confirm) throw new Error('a take costs money: confirm it with the estimate first');
  lock(slug, `${kind} ${id}`);
  try {
    const p = plan(adDir), s = p.shots.find(x => x.id === id);
    let prompt = s.prompt, refs = refList(adDir, p, s), seed = s.seed;
    if (kind === 'final') {
      const d = s.takes.find(t => t.file === s.chosen); if (!d) throw new Error('choose the draft to finalise first');
      prompt = d.prompt; seed = d.seed ?? s.seed; refs = (d.refs || []).map(r => ({ file: path.join(adDir, r), rel: r }));
    }
    if (s.layoutRef && !s.previz) throw new Error('"blocking matters" is on: make the previz first (its middle still is the positioning reference)');
    for (const r of refs) if (!fs.existsSync(r.file)) throw new Error(`missing reference ${r.rel}`);
    const n = s.takes.length + 1, out = dir(adDir, 'takes', `${id}_${kind === 'final' ? 'final' : 't'}${String(n).padStart(2, '0')}.mp4`);
    s.status = 'generating'; save(adDir, slug, p);
    const r = await orx.video(CFG, { model: kind === 'final' ? p.settings.finalModel : p.settings.model, prompt, seconds: s.seconds, seed,
      resolution: kind === 'final' ? p.settings.finalResolution : p.settings.resolution, aspect: p.settings.aspect, refImages: refs.map(x => x.file), out },
      { slug, stage: 'production', what: `${slug} ${id} ${kind} ${n}` });
    const p2 = plan(adDir), s2 = p2.shots.find(x => x.id === id);
    s2.takes.push({ n, kind, file: path.relative(adDir, out), cost: r.cost, job: r.job, mock: !!r.mock, at: now(), prompt, seed, refs: refs.map(x => x.rel) });
    if (kind === 'final') s2.finalTake = path.relative(adDir, out);
    s2.status = 'review'; save(adDir, slug, p2);
    return s2.takes.at(-1);
  } catch (e) {
    const p3 = plan(adDir), s3 = p3.shots.find(x => x.id === id); if (s3) { s3.status = 'error'; s3.error = e.message; save(adDir, slug, p3); }
    throw e;
  } finally { unlock(slug); }
}

/** Claude writes every shot's prompt in the creators' format (decide chain: Claude CLI → inbox). Free on a Claude plan. */
export const PROMPTS_SCHEMA = { type: 'object', required: ['shots', 'reason'], properties: {
  shots: { type: 'array', minItems: 1, items: { type: 'object', required: ['id', 'prompt', 'refs', 'layoutRef'], properties: {
    id: { type: 'string' }, prompt: { type: 'string', minLength: 300 }, refs: { type: 'array', items: { type: 'string' }, maxItems: 5 }, layoutRef: { type: 'boolean' }, seconds: { type: 'number', minimum: 4, maximum: 15 } } } },
  reason: { type: 'string' } } };
export async function writePrompts(adDir, slug, decideFor) {
  lock(slug, 'Claude writes the shot prompts');
  try {
    const p = plan(adDir), bible = readJSON(path.join(adDir, 'bible.json'));
    const elements = p.assets.map(a => ({ id: a.id, kind: a.kind, name: a.name, role: a.role, desc: a.desc, views: (a.picks || []).length }));
    const q = `Shot board · write the Seedance 2.5 prompt for every shot, the way the Higgsfield contest creators do (skills/higgsfield-director §"Reference-assigned prompts").
Bible (shots, cast, places, product, voice): ${JSON.stringify({ title: bible.title, stylePara: p.settings.stylePara, product: bible.product, cast: bible.cast, places: bible.places, shots: bible.shots.map(s => ({ id: s.id, t0: s.t0, t1: s.t1, beat: s.beat, place: s.place, camera: s.camera, layers: s.layers })), vo: bible.vo?.lines })}
Elements (reference images, chosen by the user; each has a role line and N views): ${JSON.stringify(elements)}
For each shot return: refs = the element ids it needs, most important first (max 5; their views are sent in that order, each view counts as one reference image, max 6 images in total); layoutRef = true only when blocking matters (who stands where, product placement, a precise action) — then the previz middle still is appended as the LAST reference with the role "${LAYOUT_ROLE}"; prompt = 400–900 words in blocks FORMAT, STYLE (the locked paragraph verbatim), CAMERA (lens + one move), MUSIC: FALSE, CUT POLICY, MOTION SPEED AND QUALITY, REFERENCES (one line per reference image in the exact order: "reference image N — <role line>"), SETTING AND BLOCKING, ACTION (timed by second), CAST RULE, NO TEXT, CONTINUITY. No first/last frames exist. Seconds 4–15 (merge neighbouring beats into one generation with 2 shots inside only when they share a place).`;
    const MEM = await import('./memory.mjs'), mem = MEM.recall('production', { style: bible?.style, context: 'seedance prompt references consistency' });
    const guide = p.settings.catalogStyle ? `\nThe look is the catalogue style "${p.settings.catalogStyle}": read skills/seedance-styles/styles/${p.settings.catalogStyle}.md (only that file) and use its STYLE block verbatim, its MOTION block and its camera habits; name only the avoid items this shot risks.` : '';
    const res = await decideFor(slug, 'production-prompts', `${q}${guide}${mem.text ? `\n\n${mem.text}` : ''}`, PROMPTS_SCHEMA);
    const p2 = plan(adDir);
    for (const x of res.output.shots) {
      const s = p2.shots.find(y => y.id === x.id); if (!s) continue;
      Object.assign(s, { prompt: x.prompt, refs: x.refs.filter(id => p2.assets.some(a => a.id === id)), layoutRef: x.layoutRef, promptBy: 'claude', promptEdited: false, ...(x.seconds ? { seconds: Math.round(x.seconds) } : {}) });
    }
    p2.promptsReason = res.output.reason; p2.promptsBy = res.meta?.engine;
    return save(adDir, slug, p2);
  } finally { unlock(slug); }
}

/** element sheet: image model (paid, confirm) or a Blender turnaround (free; spec at production/blender/asset-<id>.json) */
export async function makeAsset(adDir, slug, id, { prompt, model, n = 2, confirm, source = 'openrouter', view } = {}) {
  lock(slug, `asset ${id}`);
  try {
    const p = plan(adDir), a = p.assets.find(x => x.id === id); if (!a) throw new Error('no such asset');
    const base = dir(adDir, 'assets', id);
    let files = [];
    if (source === 'blender') {
      const spec = dir(adDir, 'blender', `asset-${id}.json`); if (!fs.existsSync(spec)) throw new Error(`write production/blender/asset-${id}.json first`);
      const r = await blender.renderShot(CFG, spec, dir(adDir, 'blender', `asset-${id}`), { stills: [1], slug, stage: 'production' });
      const f = `${base}_blender_${a.files.length + 1}.png`; fs.copyFileSync(path.join(r.dir, 'f_0001.png'), f); files = [f];
    } else {
      if (!confirm) throw new Error('element sheets cost money: confirm with the estimate first');
      const base0 = view && a.chosen ? [a.chosen] : [];
      const refImages = [...base0, ...(a.refs || []), ...a.files.filter(f => /_blender_/.test(f))].map(r => path.join(adDir, r));
      if (view && !a.chosen) throw new Error('choose a first view before making more angles');
      if (view) prompt = prompt || viewPrompt(a, view, p);
      const r = await orx.image(CFG, { model: model || p.settings.imageModel, prompt: prompt || sheetPrompt(a, p), aspect: a.kind === 'place' ? '9:16' : '16:9', n, refImages, out: `${base}_${Date.now()}` }, { slug, stage: 'production', what: `${slug} ${id}` });
      files = r.files;
    }
    const p2 = plan(adDir), a2 = p2.assets.find(x => x.id === id);
    a2.files.push(...files.map(f => path.relative(adDir, f))); a2.status = 'review'; a2.prompt = prompt || sheetPrompt(a, p);
    save(adDir, slug, p2); return a2;
  } finally { unlock(slug); }
}
export const VIEWS = { character: ['portrait', 'turnaround'], place: ['reverse', 'detail'], product: ['three-quarter', 'detail'], prop: ['three-quarter'] };
export function viewPrompt(a, view, p) {
  const style = p.settings.stylePara || '';
  const what = { portrait: 'a head-and-shoulders portrait, front, neutral expression, flat mid-grey background', turnaround: 'a full-body turnaround: front, three-quarter, side and back views side by side on flat mid-grey',
    reverse: 'the reverse angle of the same room, as if the camera turned around 180 degrees, same furniture, materials and light', detail: 'a closer detail angle of the same place/product, same materials and light',
    'three-quarter': 'a three-quarter view of the same object on flat mid-grey' }[view] || view;
  return `The exact same ${a.kind} shown in reference image 1 (${a.desc}). Show ${what}. Preserve identity, proportions, colours and every detail exactly; do not redesign anything. ${style}`;
}
export function sheetPrompt(a, p) {
  const style = p.settings.stylePara || '';
  if (a.kind === 'character') return `Character reference sheet: ${a.desc}. Four views side by side (front, three-quarter, side, back), full body, neutral pose, flat mid-grey background, even flat light, no text. ${style}`;
  if (a.kind === 'product') return `Product reference sheet: ${a.desc}. ${a.files.some(f => /_blender_/.test(f)) ? 'Copy the exact shape, proportions and colours of the bottle in the reference render. ' : ''}Three views (front, three-quarter, back) of the same single product on a flat mid-grey background, even studio light, nothing else in frame, label text exactly as given, no other text. ${style}`;
  return `Location plate: ${a.desc}. No people. ${style}`;
}
export function chooseAsset(adDir, slug, id, file, { add } = {}) {
  const p = plan(adDir), a = p.assets.find(x => x.id === id);
  a.picks ||= [];
  if (add) a.picks = a.picks.includes(file) ? a.picks.filter(f => f !== file) : [...a.picks, file].slice(-3);   // toggle an extra view (max 3)
  else a.picks = [file, ...a.picks.filter(f => f !== file)].slice(0, 3);
  a.chosen = a.picks[0] || null; a.status = a.chosen ? 'approved' : 'review';
  return save(adDir, slug, p);
}
export function patchAsset(adDir, slug, id, patch) { const p = plan(adDir), a = p.assets.find(x => x.id === id); for (const k of ['role', 'desc', 'name']) if (k in patch) a[k] = patch[k]; return save(adDir, slug, p); }
export function budget() { return { spent: orx.spent(), cap: CFG.budget?.capUsd ?? 10, mock: orx.mock(CFG), ledger: orx.ledger().slice(-50) }; }

/** Restyle the previz first/last frames into the final look with the image model + element sheets (paid, confirm). */
export async function styleKeys(adDir, slug, id, { confirm, n = 2, which = ['first', 'last'] } = {}) {
  if (!confirm) throw new Error('styled keyframes cost money: confirm with the estimate first');
  lock(slug, `keyframes ${id}`);
  try {
    const p = plan(adDir), s = p.shots.find(x => x.id === id); if (!s.previz) throw new Error('make the previz first');
    const refs = (s.refs || []).map(r => p.assets.find(a => a.id === r)).filter(a => a?.chosen).map(a => path.join(adDir, a.chosen));
    const out = {};
    for (const w of which) {
      const frame = dir(adDir, 'previz', `${id}_${w}.png`);
      const prompt = `Repaint the first image (a rough layout frame) as a finished frame of the film. Keep its exact composition, camera angle, positions and poses. ${p.settings.stylePara || ''} Characters, product and place exactly as in the other reference images. No text, no captions.`;
      const r = await orx.image(CFG, { model: p.settings.imageModel, prompt, aspect: '9:16', n, refImages: [frame, ...refs], out: dir(adDir, 'keys', `${id}_${w}_${Date.now()}`) }, { slug, stage: 'production', what: `${slug} ${id} ${w} keyframe` });
      out[w] = r.files.map(f => path.relative(adDir, f));
    }
    const p2 = plan(adDir), s2 = p2.shots.find(x => x.id === id);
    s2.keyOptions = { first: [...(s2.keyOptions?.first || []), ...(out.first || [])], last: [...(s2.keyOptions?.last || []), ...(out.last || [])] };
    save(adDir, slug, p2); return s2.keyOptions;
  } finally { unlock(slug); }
}
export function chooseKey(adDir, slug, id, which, file) { const p = plan(adDir), s = p.shots.find(x => x.id === id); s.keys = { ...(s.keys || {}), [which]: file }; return save(adDir, slug, p); }

/** Finish the chosen take: ComfyUI (colour match to the reference frame + Real-ESRGAN to 1920 tall) or ffmpeg (Lanczos only). Free. */
export async function finish(adDir, slug, id) {
  lock(slug, `finish ${id}`);
  try {
    const p = plan(adDir), s = p.shots.find(x => x.id === id);
    if (!s.chosen && !s.finalTake) throw new Error('choose a take first');
    const src = path.join(adDir, s.finalTake || s.chosen), out = dir(adDir, 'final', `${id}.mp4`); fs.mkdirSync(path.dirname(out), { recursive: true });
    // the grade reference: the first shot's chosen first keyframe (or this shot's), so every shot moves toward one look
    const ref0 = p.shots.find(x => x.keys?.first)?.keys?.first, ref = ref0 ? path.join(adDir, ref0) : null;
    let engine = 'ffmpeg';
    const a = await comfy.available(CFG);
    if (a.ok && ref) {
      emit('engine', { slug, stage: 'production', engine: 'comfy', text: `finish ${id}: colour match + Real-ESRGAN` });
      await comfy.runWorkflow(CFG, path.join(REPO, 'comfy', 'adstudio', 'workflows', 'finish_shot.json'), { '1.video_path': src, '1.reference_image': ref, '4.dest': out },
        { onText: t => emit('engine', { slug, stage: 'production', engine: 'comfy', text: String(t).slice(0, 200) }) });
      engine = 'comfy';
    } else {
      emit('engine', { slug, stage: 'production', engine: 'ffmpeg', text: `finish ${id}: ${a.ok ? 'no reference frame' : a.why} → ffmpeg Lanczos upscale`, level: 'warn' });
      const ff = await ffmpeg7(CFG);
      const r = await run(ff, ['-y', '-v', 'error', '-i', src, '-vf', 'scale=1080:1920:flags=lanczos,unsharp=5:5:0.4', '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'copy', out]);
      if (r.code !== 0) throw new Error(r.err.slice(-300));
    }
    const p2 = plan(adDir), s2 = p2.shots.find(x => x.id === id);
    s2.final = { file: path.relative(adDir, out), engine, at: now() }; s2.status = 'finished'; save(adDir, slug, p2);
    return s2.final;
  } finally { unlock(slug); }
}
