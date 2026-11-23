// Ad Studio · production: the shot board. Turns the bible into shots that each have a route, a previz, a prompt,
// references (element sheets), paid takes (estimated first, confirmed by you) and a chosen take.
//   ads/<slug>/production/plan.json      the board
//   ads/<slug>/production/previz/<shot>.mp4, takes/<shot>_tNN.mp4, assets/<id>_N.png, blender/<shot>/...
// Routes: 'seedance' (OpenRouter, previz as motion reference) · 'kit' (code-drawn, free) · 'blender' (3D render, free)
import fs from 'fs';
import path from 'path';
import { readJSON, writeJSON, run, ffmpeg7, now } from './util.mjs';
import { emit } from './bus.mjs';
import * as orx from './engines/openrouter.mjs';
import * as blender from './engines/blender.mjs';
import * as render from './engines/render.mjs';

let CFG = null; const jobs = new Map();
export function initProduction(cfg) { CFG = cfg; }
const dir = (adDir, ...p) => path.join(adDir, 'production', ...p);
const planFile = adDir => dir(adDir, 'plan.json');
export const plan = adDir => readJSON(planFile(adDir));
function save(adDir, slug, p) { p.updated = now(); writeJSON(planFile(adDir), p); emit('production', { slug, kind: 'plan' }); return p; }

// ---------- prompts in the winners' block structure (skills/higgsfield-director) ----------
export function buildPrompt(shot, bible, p) {
  const cast = Object.entries(bible.cast || {}), refs = (shot.refs || []).map(id => p.assets.find(a => a.id === id)).filter(Boolean);
  const chars = (shot.layers || []).filter(l => l.type === 'char').map(l => l.id);
  const product = (shot.layers || []).some(l => l.type === 'product');
  const placeKind = bible.places?.[shot.place]?.kind || shot.place || 'studio', time = shot.time || bible.places?.[shot.place]?.time || 'day';
  const texts = (shot.layers || []).filter(l => l.type === 'text').map(l => l.text.replace(/\n/g, ' '));
  const action = shot.action || shot.note || describe(shot, bible);
  return [
    `${shot.t1 - shot.t0 < 4 ? 4 : Math.round(shot.t1 - shot.t0)}-second vertical 9:16 shot, one continuous take, no cuts. No music, no subtitles, no on-screen text, no logos other than the product label. Motion at real-time speed.`,
    `STYLE: ${p.settings.stylePara || bible.stylePara || 'clean cinematic look'}`,
    refs.length ? `REFERENCES: ${refs.map((a, i) => `image ${i + 1} is ${a.desc}`).join('; ')}. Keep every face, outfit, colour and the product exactly as in the references.` : '',
    (p.settings.motionMode || 'video') === 'video' ? 'MOTION: follow the reference video for blocking, positions, timing and camera move; replace its simple shapes with the real characters, product and place.' : (p.settings.motionMode === 'keyframes' ? 'MOTION: start exactly on the first frame and end exactly on the last frame; move naturally between them.' : ''),
    chars.length ? `CAST: exactly ${chars.length} ${chars.length === 1 ? 'person' : 'people'}: ${chars.map(c => `${c} (${bible.cast[c]?.role || ''})`).join(', ')}. No one else in frame.` : product ? 'CAST: no people; the product is the subject.' : '',
    `PLACE: ${placeKind}, ${time}${placeKind === 'kitchen' ? ', a small warm flat kitchen with a window over the counter' : ''}.`,
    `ACTION: ${action}`,
    product ? `PRODUCT: ${bible.product.name}, a ${bible.product.kind} (${Object.entries(bible.product.colors || {}).map(([k, v]) => `${k} ${v}`).join(', ')}), label "${bible.product.label}". Never change its shape or colours.` : '',
    shot.camera ? `CAMERA: ${shot.camera.zoom ? (shot.camera.zoom[1] > shot.camera.zoom[0] ? 'slow push-in' : 'slow pull-out') : 'locked off'}${shot.camera.pan ? ', gentle pan' : ''}.` : 'CAMERA: locked off, eye level.',
    texts.length ? `(The words "${texts.join('" / "')}" are added later in the edit; leave clean space in the upper third.)` : '',
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
  const p = { slug, created: old?.created || now(), settings: { route, model, resolution, aspect: '9:16', imageModel, stylePara: bible.stylePara, motionMode: 'video', ...(old?.settings || {}) }, assets: old?.assets || [], shots: [] };
  if (!p.assets.length) {
    for (const [id, c] of Object.entries(bible.cast || {})) p.assets.push({ id: `char-${id}`, kind: 'character', desc: `${id}: ${c.role || 'character'}, hair ${c.hairStyle} ${c.hair}, top ${c.top}, trousers ${c.bottom}`, files: [], chosen: null, status: 'todo' });
    const pc = bible.product.colors || {};
    p.assets.push({ id: 'product', kind: 'product', desc: `${bible.product.name}: a ${bible.product.kind} with a ${pc.body || ''} body, a ${pc.cap || ''} cap and a ${pc.label || ''} label printed "${bible.product.label}" in ${pc.labelInk || 'dark'} letters`, files: [], chosen: null, status: 'todo' });
    for (const [id, pl] of Object.entries(bible.places || {})) p.assets.push({ id: `place-${id}`, kind: 'place', desc: `${pl.kind} at ${pl.time || 'day'}, empty, wide three-quarter view`, files: [], chosen: null, status: 'todo' });
  }
  for (const s of bible.shots) {
    const prev = old?.shots?.find(x => x.id === s.id);
    const refs = [...(s.layers || []).filter(l => l.type === 'char').map(l => `char-${l.id}`), ...((s.layers || []).some(l => l.type === 'product') ? ['product'] : []), ...(bible.places?.[s.place] ? [`place-${s.place}`] : [])];
    p.shots.push({ id: s.id, t0: s.t0, t1: s.t1, seconds: Math.max(4, Math.round(s.t1 - s.t0)), route: prev?.route || route, refs: prev?.refs || refs,
      prompt: prev?.promptEdited ? prev.prompt : buildPrompt({ ...s, refs }, bible, p), promptEdited: !!prev?.promptEdited,
      firstFrame: prev?.firstFrame ?? (s === bible.shots[0] ? 'previz' : 'none'), previz: prev?.previz || null, takes: prev?.takes || [], chosen: prev?.chosen ?? null, status: prev?.status || 'todo', notes: prev?.notes || '' });
  }
  return save(adDir, slug, p);
}

export function patchShot(adDir, slug, id, patch) {
  const p = plan(adDir), s = p.shots.find(x => x.id === id); if (!s) throw new Error('no such shot');
  for (const k of ['route', 'prompt', 'refs', 'firstFrame', 'notes', 'seconds']) if (k in patch) s[k] = patch[k];
  if ('prompt' in patch) s.promptEdited = true;
  if ('chosen' in patch) { s.chosen = patch.chosen; s.status = 'chosen'; }
  return save(adDir, slug, p);
}
export function patchSettings(adDir, slug, patch) { const p = plan(adDir); Object.assign(p.settings, patch); return save(adDir, slug, p); }

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
    s.status = s.status === 'todo' ? 'previz' : s.status;
    save(adDir, slug, p);
    return s.previz;
  } finally { unlock(slug); }
}

export function estimate(adDir, id) {
  const p = plan(adDir), s = p.shots.find(x => x.id === id);
  return { estimate: orx.estimateVideo(p.settings.model, p.settings.resolution, p.settings.aspect, s.seconds), spent: orx.spent(), cap: CFG.budget?.capUsd ?? 10, mock: orx.mock(CFG) };
}

/** one paid take; `confirm` must be true (the app asks you with the estimate first) */
export async function take(adDir, slug, id, { confirm } = {}) {
  if (!confirm) throw new Error('a take costs money: confirm it with the estimate first');
  lock(slug, `take ${id}`);
  try {
    const p = plan(adDir), i = p.shots.findIndex(x => x.id === id), s = p.shots[i];
    const mode = p.settings.motionMode || 'video';
    if (!s.previz && mode !== 'none') throw new Error('make the previz first (it is the motion reference)');
    const n = s.takes.length + 1, out = dir(adDir, 'takes', `${id}_t${String(n).padStart(2, '0')}.mp4`), ff = await ffmpeg7(CFG);
    const refImages = (s.refs || []).map(r => p.assets.find(a => a.id === r)).filter(a => a?.chosen).map(a => path.join(adDir, a.chosen));
    let firstFrame = null, lastFrame = null;
    if (mode === 'keyframes') {
      if (!s.keys?.first) throw new Error('style the keyframes first (and choose them)');
      firstFrame = path.join(adDir, s.keys.first); lastFrame = s.keys.last ? path.join(adDir, s.keys.last) : null;
    }
    if (!firstFrame && s.firstFrame === 'previz' && s.previz) firstFrame = dir(adDir, 'previz', `${id}_first.png`);
    if (s.firstFrame === 'chain' && i > 0) {
      const prev = p.shots[i - 1], src = prev.chosen ? path.join(adDir, prev.chosen) : null;
      if (src && fs.existsSync(src)) { firstFrame = dir(adDir, 'takes', `${prev.id}_last.png`); await run(ff, ['-y', '-v', 'error', '-sseof', '-0.1', '-i', src, '-frames:v', '1', firstFrame]); }
    }
    s.status = 'generating'; save(adDir, slug, p);
    const r = await orx.video(CFG, { model: p.settings.model, prompt: s.prompt, seconds: s.seconds, resolution: p.settings.resolution, aspect: p.settings.aspect,
      refImages, refVideo: mode === 'video' && s.previz ? path.join(adDir, s.previz.file) : null, firstFrame, lastFrame, out }, { slug, stage: 'production', what: `${slug} ${id} take ${n}` });
    const p2 = plan(adDir), s2 = p2.shots.find(x => x.id === id);
    s2.takes.push({ n, file: path.relative(adDir, out), cost: r.cost, job: r.job, mock: !!r.mock, at: now(), prompt: s.prompt, refs: refImages.map(f => path.relative(adDir, f)), firstFrame: firstFrame && path.relative(adDir, firstFrame), mode });
    s2.status = 'review'; save(adDir, slug, p2);
    return s2.takes.at(-1);
  } catch (e) {
    const p3 = plan(adDir), s3 = p3.shots.find(x => x.id === id); if (s3) { s3.status = 'error'; s3.error = e.message; save(adDir, slug, p3); }
    throw e;
  } finally { unlock(slug); }
}

/** element sheet: image model (paid, confirm) or a Blender turnaround (free; spec at production/blender/asset-<id>.json) */
export async function makeAsset(adDir, slug, id, { prompt, model, n = 2, confirm, source = 'openrouter' } = {}) {
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
      const refImages = [...(a.refs || []), ...a.files.filter(f => /_blender_/.test(f))].map(r => path.join(adDir, r));
      const r = await orx.image(CFG, { model: model || p.settings.imageModel, prompt: prompt || sheetPrompt(a, p), aspect: a.kind === 'place' ? '9:16' : '16:9', n, refImages, out: `${base}_${Date.now()}` }, { slug, stage: 'production', what: `${slug} ${id}` });
      files = r.files;
    }
    const p2 = plan(adDir), a2 = p2.assets.find(x => x.id === id);
    a2.files.push(...files.map(f => path.relative(adDir, f))); a2.status = 'review'; a2.prompt = prompt || sheetPrompt(a, p);
    save(adDir, slug, p2); return a2;
  } finally { unlock(slug); }
}
export function sheetPrompt(a, p) {
  const style = p.settings.stylePara || '';
  if (a.kind === 'character') return `Character reference sheet: ${a.desc}. Four views side by side (front, three-quarter, side, back), full body, neutral pose, flat mid-grey background, even flat light, no text. ${style}`;
  if (a.kind === 'product') return `Product reference sheet: ${a.desc}. ${a.files.some(f => /_blender_/.test(f)) ? 'Copy the exact shape, proportions and colours of the bottle in the reference render. ' : ''}Three views (front, three-quarter, back) of the same single product on a flat mid-grey background, even studio light, nothing else in frame, label text exactly as given, no other text. ${style}`;
  return `Location plate: ${a.desc}. No people. ${style}`;
}
export function chooseAsset(adDir, slug, id, file) { const p = plan(adDir), a = p.assets.find(x => x.id === id); a.chosen = file; a.status = 'approved'; return save(adDir, slug, p); }
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
