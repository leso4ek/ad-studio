// Ad Studio kit · the ad page. Reads bible.json (+ cues.json for captions) and draws frame t in the bible's style.
// Page contract (Lemo-Opuscar core/render): window.render(t), DUR, EV, TEXTS, READY, plus SAFE for the safe-zone check.
// Query: ?hook=B (hook variant) &nosub=1 (no captions) &guides=1 (draw safe zones) &layout=16x9|9x16 (default: from the viewport)
import { clamp, lerp, seg, eo, eio, back, ss } from '/core/lib.js';
import { character, product, prop, place } from './shapes.js';
import { rig, rigMats, visemeOf } from './rig.js';
import { directCamera } from './camera.js';

const qs = new URLSearchParams(location.search);
const W = innerWidth, H = innerHeight;
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const g = cv.getContext('2d');

const bible = await (await fetch('bible.json')).json();
let cues = [];
try { const r = await fetch('cues.json'); if (r.ok) cues = await r.json(); } catch { /* no voice yet */ }
const style = (await import(`./styles/${bible.style || 'ad-paper-cutout'}.js`)).default;
const custom = bible.custom ? await import('./custom.js') : {};

const LANDSCAPE = (qs.get('layout') || (W > H ? '16x9' : '9x16')) === '16x9';
// the stage box: the full frame in 9:16; a centred portrait-ish column in 16:9 (the place still fills the frame)
const stage = LANDSCAPE ? { x0: (W - H * .78) / 2, y0: 0, w: H * .78, h: H } : { x0: 0, y0: 0, w: W, h: H };
const SAFE = LANDSCAPE ? { x0: W * .05, y0: H * .06, x1: W * .95, y1: H * .9 } : { x0: W * .05, y0: H * .14, x1: W * .86, y1: H * .8 };

// ---------- timeline ----------
const DUR = bible.dur || 20;
let shots = (bible.shots || []).map(s => ({ ...s }));
const hook = qs.get('hook');
if (hook && bible.variants?.hooks) {
  const v = bible.variants.hooks.find(h => h.id === hook);
  if (v) for (const rep of v.shots) { const i = shots.findIndex(s => s.id === rep.id); if (i >= 0) shots[i] = { ...shots[i], ...rep }; }
}
const ec = bible.endcard;
if (ec && !shots.some(s => s.end)) shots.push({ id: 'end', t0: ec.t0, t1: DUR + .01, end: true, place: ec.place || 'studio', trans: ec.trans || 'wipe' });
shots.sort((a, b) => a.t0 - b.t0);
const shotAt = t => { let s = shots[0]; for (const x of shots) if (t >= x.t0) s = x; return s; };
// a card with carry:true repeated (same id and text) over consecutive shots is ONE card: it keeps its clock across
// the cuts (no re-pop) and the reading check times it as one piece — a title held over quick cuts
const CARRY = {};
for (let i = 0; i < shots.length; i++) for (const l of shots[i].layers || []) if (l.type === 'text' && l.carry && l.id) {
  const prev = shots[i - 1]?.layers?.some(m => m.type === 'text' && m.carry && m.id === l.id && m.text === l.text);
  if (!prev) CARRY[`${shots[i].id}:${l.id}`] = shots[i].t0 + (l.t0 ?? 0);
  else CARRY[`${shots[i].id}:${l.id}`] = CARRY[`${shots[i - 1].id}:${l.id}`];
}
const carryLt = (shot, l, lt) => l.carry && l.id && CARRY[`${shot.id}:${l.id}`] != null ? shot.t0 + lt - CARRY[`${shot.id}:${l.id}`] : null;
const L = (layer) => LANDSCAPE && layer.l16 ? { ...layer, ...layer.l16 } : layer;

// ---------- materials ----------
const castColors = id => ({ ...(style.defaultCast || {}), ...(bible.cast?.[id] || {}) });
// rig v2 (round 14): a cast entry with rig:'v2', or every human when the bible sets rig:'v2' (plants and v1 casts keep the old figure)
const isV2 = id => { const c = bible.cast?.[id] || {}; return c.kind !== 'plant' && (c.rig === 'v2' || (bible.rig === 'v2' && c.rig !== 'v1')); };
/** The expression at shot time lt: layer.expression is a name or [[t, name], …]; changes blend over 0.2 s. */
function exprAt(layer, lt) {
  const e = layer.expressionAt ? [[0, layer.expression || 'neutral'], ...layer.expressionAt.map(x => [x.t, x.e])] : layer.expression; if (!Array.isArray(e)) return { expr: e || null };
  let cur = null, prev = null, at = 0;
  for (const [t, n] of e) if (lt >= t) { prev = cur; cur = n; at = t; }
  return { expr: cur || e[0]?.[1], exprFrom: prev || undefined, exprMix: prev ? Math.min(1, (lt - at) / .2) : 1 };
}
/** The mouth shape: the letter of the speaker's current cue at the voice's position. */
function visemeAt(id, t) {
  const c = cues.find(q => q.speaker === id && t >= q.t0 && t < q.t1); if (!c) return null;
  const i = Math.floor((t - c.t0) / Math.max(.05, c.t1 - c.t0) * c.text.length); return visemeOf(c.text[Math.min(c.text.length - 1, i)]);
}
const viewOf = layer => { const f = layer.face; return { view: layer.view || (f === 'left' || f === 'right' ? '34' : 'front'), dir: (layer.dir ?? (f === 'left' ? -1 : 1)) * (L(layer).flip ? -1 : 1) }; };   // flip turns the figure (text on it stays readable)
function mats(kind, ref, time) {
  const base = style.palette(time || 'day', bible.palette || {});
  if (kind === 'char' && isV2(ref)) { const c = castColors(ref); return { ...base, ...rigMats(base, c), ...(c.mats || {}) }; }
  if (kind === 'char') { const c = castColors(ref); return { ...base, skin: c.skin || base.skin, hair: c.hair || base.hair, hairInk: c.hairInk || c.hair || base.ink, top: c.top || base.top, bottom: c.bottom || base.bottom, shoe: c.shoe || base.shoe }; }
  if (kind === 'product') { const c = bible.product?.colors || {}; return { ...base, body: c.body || base.accent, cap: c.cap || base.ink, label: c.label || base.white, labelInk: c.labelInk || base.ink, accent: c.accent || base.accent2 || base.accent }; }
  return base;
}

// ---------- animation ----------
const H01 = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };
function animate(layer, lt, ldur) {
  const a = { dx: 0, dy: 0, sc: 1, sx: 1, sy: 1, rot: 0, alpha: 1, armSwing: 0, mouthOpen: 0, blink: false, glow: 0 };
  const list = [].concat(layer.anim || []);
  for (const raw of list) {
    const [name, amt = 1] = String(raw).split(':'), k = +amt;
    switch (name) {
      case 'bob': a.dy += Math.sin(lt * Math.PI * 1.6 + H01(layer.id)) * .006 * k; break;
      case 'float': a.dy += Math.sin(lt * Math.PI * .7 + H01(layer.id) * 6) * .014 * k; break;
      case 'breathe': a.sy *= 1 + Math.sin(lt * Math.PI * 1.1) * .012 * k; break;
      case 'pop': { const p = back(seg(lt, 0, .38), 2.2); a.sc *= Math.max(.001, p); break; }
      case 'pulse': a.sc *= 1 + Math.max(0, Math.sin((lt - .2) * Math.PI * 2 * .9)) * .05 * k; break;
      case 'slide-l': a.dx -= (1 - eo(seg(lt, 0, .5))) * 1.1; break;
      case 'slide-r': a.dx += (1 - eo(seg(lt, 0, .5))) * 1.1; break;
      case 'slide-up': a.dy += (1 - eo(seg(lt, 0, .5))) * .7; break;
      case 'drop': a.dy -= (1 - back(seg(lt, 0, .55), 1.4)) * .7; break;
      case 'exit-l': a.dx -= eio(seg(lt, ldur - .5, ldur)) * 1.1; break;
      case 'exit-r': a.dx += eio(seg(lt, ldur - .5, ldur)) * 1.1; break;
      case 'shake': a.dx += Math.sin(lt * 42) * .006 * k * Math.max(0, 1 - lt / 1.2); a.rot += Math.sin(lt * 37) * .03 * k * Math.max(0, 1 - lt / 1.2); break;
      case 'wobble': a.rot += Math.sin(lt * 9) * .05 * k; break;
      case 'spin': a.rot += lt * 1.4 * k; break;
      case 'wave': a.armSwing = Math.sin(lt * 9) * .35; break;
      case 'talk': a.mouthOpen = Math.max(a.mouthOpen, .5 + .5 * Math.sin(lt * 15)); break;
      case 'reveal': { const p = seg(lt, 0, .8); a.sc *= lerp(.55, 1, back(p, 1.6)); a.glow = ss(seg(lt, .2, 1)); break; }
      case 'fade-in': a.alpha *= eo(seg(lt, 0, .4)); break;
      case 'fade-out': a.alpha *= 1 - seg(lt, ldur - .4, ldur); break;
    }
  }
  if (layer.move) { const p = eio(seg(lt, layer.moveT?.[0] ?? 0, layer.moveT?.[1] ?? ldur)); a.dx += lerp(0, layer.move[0], p); a.dy += lerp(0, layer.move[1] || 0, p); if (layer.type === 'char' && p > 0 && p < 1) a.dy -= Math.abs(Math.sin(lt * 9)) * .008; }
  if (layer.type === 'char') {
    const ph = H01(layer.id) * 3, cyc = (lt + ph) % 3.4; a.blink = cyc > 3.25;
    const line = cues.find(c => c.speaker === layer.id && R.t >= c.t0 && R.t < c.t1);
    if (line) a.mouthOpen = Math.max(a.mouthOpen, .35 + .4 * Math.abs(Math.sin(R.t * 13)));
  }
  return a;
}

// ---------- text layout (shared by drawing and TEXTS) ----------
const ROLE_SIZE = { hook: .115, card: .14, label: .06, price: .085, sub: .05, small: .04, cta: .055, logo: .16 };
function layoutText(layer, lt) {
  const ly = L(layer), role = ly.role || 'card', f = style.font(role);
  let size = (ly.size || ROLE_SIZE[role] || .08) * stage.w;
  const maxW = (ly.w || .84) * stage.w;
  g.save(); g.font = `${f.weight || 700} ${size}px ${f.family}`;
  const raw = String(ly.text).split('\n');
  let lines = [];
  for (const para of raw) { let cur = ''; for (const w of para.split(' ')) { const tst = cur ? cur + ' ' + w : w; if (g.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; } lines.push(cur); }
  let widest = Math.max(...lines.map(l => g.measureText(l).width));
  if (widest > maxW) { size *= maxW / widest; g.font = `${f.weight || 700} ${size}px ${f.family}`; widest = maxW; }
  const lh = size * (f.lh || 1.02);
  const cx = stage.x0 + (ly.x ?? .5) * stage.w, cy = stage.y0 + (ly.y ?? .4) * stage.h;
  const align = ly.align || 'center', bh = lh * lines.length;
  const x0 = align === 'left' ? cx : align === 'right' ? cx - widest : cx - widest / 2;
  const out = lines.map((t, i) => ({ text: t, w: g.measureText(t).width, x: align === 'left' ? cx : align === 'right' ? cx : cx, y: cy - bh / 2 + lh * (i + .8) }));
  g.restore();
  return { lines: out, size, lh, align, font: f, box: [x0, cy - bh / 2, x0 + widest, cy + bh / 2], role, layer: ly };
}

// ---------- the renderer handed to styles ----------
const R = { g, W, H, stage, SAFE, LANDSCAPE, bible, style, t: 0, tq: 0, lt: 0, shot: null, mats, place, character, product, prop, layoutText, cues };
window.R = R;

function unitXf(layer, a, baseH) {
  const ly = L(layer);
  const h = (ly.scale ?? 1) * baseH * stage.h * a.sc;
  return { x: stage.x0 + ((ly.x ?? .5) + a.dx) * stage.w, y: stage.y0 + ((ly.y ?? .72) + a.dy) * stage.h, h, flip: ly.flip ? -1 : 1, rot: (ly.rot || 0) + a.rot, sx: a.sx, sy: a.sy };
}

function resolveLayers(shot, lt) {
  const ldur = shot.t1 - shot.t0, out = [];
  for (const layer of shot.layers || []) {
    const t0 = layer.t0 ?? 0, t1 = layer.t1 ?? ldur;
    if (lt < t0 || lt >= t1) continue;
    const llt = lt - t0, a = animate(layer, llt, t1 - t0);
    const time = shot.time || bible.places?.[shot.place]?.time || 'day';
    let prims = null, xf = null, m = null;
    if (layer.type === 'char' && isV2(layer.id)) {
      prims = rig(castColors(layer.id), { pose: layer.pose, ...viewOf(layer), ...exprAt(layer, llt), gaze: layer.gaze, blink: a.blink, mouthOpen: a.mouthOpen, viseme: a.mouthOpen > .05 ? visemeAt(layer.id, R.t) : null, walk: llt, breath: R.t + H01(layer.id) * 3, light: layer.light });
      xf = unitXf(layer, a, .42); if (xf.flip === -1) { xf.flip = 1; } m = mats('char', layer.id, time);
    }
    else if (layer.type === 'char') { prims = character(castColors(layer.id), { pose: layer.pose, face: layer.face, blink: a.blink, armSwing: a.armSwing, mouthOpen: a.mouthOpen }); xf = unitXf(layer, a, .42); m = mats('char', layer.id, time); }
    else if (layer.type === 'product') { prims = product(bible.product || {}); xf = unitXf(layer, a, .3); m = mats('product', null, time); }
    else if (layer.type === 'prop') { prims = prop(layer.kind, layer.color); xf = unitXf(layer, a, .12); m = { ...mats('prop', null, time), ...(layer.color ? { propA: layer.color, custom: layer.color } : {}) }; }
    out.push({ layer, a, llt, prims, xf, m, z: layer.z ?? (layer.type === 'text' ? 100 : (L(layer).y ?? .7)) });
  }
  return out.sort((p, q) => p.z - q.z);
}

function camera(shot, lt) { return directCamera(shot, lt, { W, H, stage, L, personOf: id => isV2(id) ? 'person-' + ((bible.cast?.[id] || {}).proportions || 'drama') : 'person' }); }

// whip-pan smear and over-the-shoulder silhouette: drawn by the page over any style
function cameraPost(cam) {
  if (cam.whip) {
    const a = Math.abs(cam.whip), dir = Math.sign(cam.whip), n = 6, snap = document.createElement('canvas');
    snap.width = W; snap.height = H; snap.getContext('2d').drawImage(cv, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 1; i <= n; i++) { g.globalAlpha = .5 * a / i * 1.6; g.drawImage(snap, -dir * i * W * .025 * a, 0); }
    g.restore();
  }
  if (cam.ots) {
    const m = mats('place', null, R.time), left = cam.ots === 'left';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = .92; g.fillStyle = m.ink || '#1d1d1f';
    if ('filter' in g) g.filter = `blur(${Math.round(W * .006)}px)`;
    const x = left ? 0 : W, s = left ? 1 : -1;   // only the edge of a head and shoulder, out of focus, framing the subject
    g.beginPath(); g.ellipse(x - s * W * .02, H * .5, W * .13, H * .1, 0, 0, Math.PI * 2); g.fill();            // back of the head
    g.beginPath(); g.moveTo(x - s * W * .05, H); g.lineTo(x - s * W * .05, H * .62); g.quadraticCurveTo(x + s * W * .12, H * .6, x + s * W * .2, H * .72);
    g.quadraticCurveTo(x + s * W * .26, H * .8, x + s * W * .27, H); g.closePath(); g.fill();                 // shoulder
    g.restore();
  }
}

// ---------- sound / cue events ----------
function events() {
  const ev = [];
  for (const s of shots) {
    if (s.t0 > 0) ev.push({ t: s.t0, type: 'cut', trans: s.trans || 'cut' });
    for (const l of s.layers || []) {
      const at = s.t0 + (l.t0 ?? 0), an = [].concat(l.anim || []).map(x => String(x).split(':')[0]);
      if (an.includes('pop') || an.includes('drop')) ev.push({ t: at, type: 'pop', what: l.type });
      if (an.includes('reveal')) ev.push({ t: at, type: 'reveal' });
      if (an.some(x => x.startsWith('slide'))) ev.push({ t: at, type: 'whoosh' });
      if (l.type === 'text' && (l.role === 'hook' || l.role === 'card')) ev.push({ t: at, type: 'type', role: l.role });
    }
    if (s.end) ev.push({ t: s.t0, type: 'logo' });
  }
  for (const x of bible.sfx || []) ev.push({ ...x });
  return ev.sort((a, b) => a.t - b.t);
}

// ---------- texts visible at t (readcheck + safe zones) ----------
function TEXTS(t) {
  const shot = shotAt(t), lt = t - shot.t0, out = [];
  const list = shot.end ? endTexts(lt) : (shot.layers || []).filter(l => l.type === 'text');
  for (const l of list) {
    const t0 = l.t0 ?? 0, t1 = l.t1 ?? (shot.t1 - shot.t0);
    if (lt < t0 || lt >= t1) continue;
    const lay = layoutText(l, lt - t0);
    out.push({ id: l.carry && l.id ? `carry:${l.id}` : `${shot.id}:${l.id || l.text.slice(0, 12)}`, text: l.text, x0: lay.box[0], y0: lay.box[1], x1: lay.box[2], y1: lay.box[3], ...(l.pass ? { pass: true } : {}) });
  }
  for (const p of resolveLayers(shot, lt)) if (p.prims) for (const q of p.prims) if (q.s === 'text' && p.layer.type === 'product') out.push({ id: `${shot.id}:label`, text: q.text, x0: 0, y0: 0, x1: 1, y1: 1, pass: true });
  return out;
}
function endTexts() {
  const e = bible.endcard || {}, o = [];
  const noHero = bible.product?.name === undefined;   // a video with no product: the texts take the centre
  const y = LANDSCAPE ? (noHero ? { logo: .4, line: .55, cta: .67 } : { logo: .3, line: .47, cta: .62 }) : noHero ? { logo: .42, line: .5, cta: .565 } : { logo: .54, line: .615, cta: .675 };   // above the caption band (≈ .72-.79)
  const x = LANDSCAPE ? .5 : .46;
  if (e.logo) o.push({ type: 'text', id: 'logo', role: 'logo', text: e.logo, x, y: y.logo, w: .8, t0: .15, ...(LANDSCAPE ? { x: 1.05, w: .9 } : {}) });
  if (e.line) o.push({ type: 'text', id: 'line', role: 'sub', text: e.line, x, y: y.line, w: .78, t0: .45, ...(LANDSCAPE ? { x: 1.05, w: .9 } : {}) });
  if (e.cta) o.push({ type: 'text', id: 'cta', role: 'cta', text: e.cta, x, y: y.cta, w: .7, t0: .75, ...(LANDSCAPE ? { x: 1.05, w: .9 } : {}) });
  return o;
}
R.endTexts = endTexts;

// ---------- plates: a shot whose picture is a rendered or generated clip (Genjutsu take, Blender world) ----------
// shot.plate = { dir: 'plates/<name>', fps: 24, start: seconds into the plate at the shot start, post: false }
// frames are plates/<name>/f_00001.jpg …; the page draws the frame (cover) instead of the style's scene, then the
// words, captions and end card on top as usual.
const PLATES = new Map();
function plateImage(src) {
  if (!PLATES.has(src)) {
    if (PLATES.size > 48) PLATES.delete(PLATES.keys().next().value);
    PLATES.set(src, new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
  }
  return PLATES.get(src);
}
async function drawPlate(pl, lt) {
  const fps = pl.fps || 24, i = Math.max(0, Math.floor(((pl.start || 0) + lt) * fps + 1e-6)), dir = pl.dir.replace(/\/$/, '');
  let im = await plateImage(`${dir}/f_${String(i + 1).padStart(5, '0')}.jpg`);
  for (let k = 1; !im && k < 6 && i - k >= 0; k++) im = await plateImage(`${dir}/f_${String(i + 1 - k).padStart(5, '0')}.jpg`);   // past the end: hold the last frames
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (!im) return;
  const sc = Math.max(W / im.width, H / im.height), w = im.width * sc, h = im.height * sc;
  g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
}

// ---------- frame ----------
async function render(t) {
  t = clamp(t, 0, DUR - 1e-4);
  const shot = shotAt(t), d = shot.t1 - shot.t0;
  const tq = style.onTwos ? Math.floor(t * 12 + 1e-6) / 12 : t;
  const lt = clamp(tq - shot.t0, 0, d);
  Object.assign(R, { t, tq, lt, shot });
  const time = shot.time || bible.places?.[shot.place]?.time || 'day';
  R.time = time;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, W, H);
  const cam = camera(shot, lt);
  R.cam = cam;
  if (shot.end) {
    await style.scene(R, { shot, layers: resolveLayers({ ...shot, layers: bible.product?.name === undefined ? [] : [{ type: 'product', id: 'hero', x: LANDSCAPE ? -.05 : .5, y: LANDSCAPE ? .78 : .46, scale: LANDSCAPE ? 1.9 : 1.05, anim: ['reveal', 'float:.5'], ...(bible.endcard?.product || {}) }] }, lt), cam, end: true });
    if (!qs.get('notext')) for (const l of endTexts()) { const t0 = l.t0 ?? 0; if (lt >= t0) style.text(R, layoutText(l, lt - t0), lt - t0); }
  } else {
    const layers = resolveLayers(shot, lt);
    if (shot.plate && !qs.get('noplate')) await drawPlate(shot.plate, lt);
    else if (custom.shots?.[shot.custom]) await custom.shots[shot.custom](R, { shot, layers, cam, lt });
    else await style.scene(R, { shot, layers, cam });
    if (!shot.plate) cameraPost(cam);  // smear and silhouette belong to the picture, under the words
    if (!qs.get('notext')) for (const p of layers) if (p.layer.type === 'text') { const c = carryLt(shot, p.layer, lt), llt = c ?? p.llt; style.text(R, layoutText(p.layer, llt), llt); }
  }
  // transition into this shot
  const tr = shot.trans || 'cut';
  if (tr !== 'cut' && shot.t0 > 0) { const p = seg(t - shot.t0, 0, .4); if (p < 1) style.transition(R, tr, p); }
  // captions
  if (!qs.get('nosub') && bible.captions !== false) {
    const cue = cues.find(c => t >= c.t0 && t < c.t1);
    if (cue) style.caption(R, cue.text, captionBox());
  }
  if (style.post && !(shot.plate && shot.plate.post === false)) style.post(R);
  if (qs.get('guides')) { g.save(); g.strokeStyle = '#f0f'; g.lineWidth = 3; g.setLineDash([12, 8]); g.strokeRect(SAFE.x0, SAFE.y0, SAFE.x1 - SAFE.x0, SAFE.y1 - SAFE.y0); g.restore(); }
}
function captionBox() {
  return LANDSCAPE ? { cx: W / 2, cy: H * .86, w: W * .7, size: H * .045 } : { cx: (SAFE.x0 + SAFE.x1) / 2, cy: H * .755, w: (SAFE.x1 - SAFE.x0) * .94, size: W * .052 };
}

await style.setup?.(R);
for (const f of style.fontFaces || []) await document.fonts.load(f);
Object.assign(window, { render, DUR, EV: events(), TEXTS, SAFE, SHOTS: shots.map(s => [s.t0, s.t1, s.id]) });
window.READY = true;
