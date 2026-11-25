// Ad style "Manga Panels" (ad-manga-panels): a black-and-white manga page that moves. Ink outlines with a heavier
// lower-right edge, paper fills, screentone dots and line tone for every grey, focus / gloom / speed lines that boil
// at 12 fps, onomatopoeia slammed in letter by letter, narration boxes and speech balloons, and shots split into
// 2-3 panels with slanted gutters. One spot colour only: the product's brand colour. Original; see
// styles/ad-manga-panels/STYLE.md.
import { pathPrim, primText, primBounds, placePrims, noiseTile, canvas } from '../draw2d.js';
import { drawScene, captionLines, transition } from './style2d.js';
import { hash, lerp, seg, eo, back, clamp } from '/core/lib.js';

const PAPER = '#F4F1E8', INK = '#141414';
const SFX_FONT = '"Bangers"', LET_FONT = '"Comic Neue"';

// Material → tone token. 'dots:c' = AM dot screen at coverage c; 'hl:c' / 'dl:c' = horizontal / diagonal line tone;
// 'grad:a' = dot gradient from coverage a at the top of the frame to paper; 'hatch' = blush hatching. Hex colours
// (from the bible's cast and props) are turned into the nearest tone by luminance in toneOf().
const PAL = {
  day:  { wall: 'grad:.26', wall2: 'dots:.12', floor: 'hl:.34', floor2: 'dots:.5', wood: 'dl:.42', sky: 'dots:.2', sky2: 'paper', glass: 'dots:.15', metal: 'dots:.5',
          plant: 'dots:.3', plant2: 'paper', sun: 'paper', moon: 'paper', cloud: 'paper', building: 'dots:.35', building2: 'dots:.2', windowLit: 'paper', ground: 'dots:.25', path: 'paper' },
  dusk: { wall: 'grad:.5', wall2: 'dots:.3', floor: 'hl:.55', floor2: 'dots:.62', wood: 'dl:.62', sky: 'dots:.42', sky2: 'dots:.2', glass: 'dots:.35', metal: 'dots:.62',
          plant: 'dots:.5', plant2: 'paper', sun: 'paper', moon: 'paper', cloud: 'dots:.15', building: 'dots:.5', building2: 'dots:.35', windowLit: 'paper', ground: 'dots:.42', path: 'dots:.15' },
  night:{ wall: 'dots:.62', wall2: 'dots:.62', floor: 'hl:.7', floor2: 'ink', wood: 'ink', sky: 'ink', sky2: 'dots:.62', glass: 'dots:.62', metal: 'dots:.62',
          plant: 'dots:.62', plant2: 'dots:.25', sun: 'paper', moon: 'paper', cloud: 'dots:.35', building: 'ink', building2: 'dots:.62', windowLit: 'paper', ground: 'dots:.62', path: 'dots:.35' },
};
const COMMON = { skin: 'paper', hair: 'ink', hairInk: 'ink', top: 'dots:.35', bottom: 'dots:.6', shoe: 'ink', ink: 'ink', white: 'paper', cheek: 'hatch',
  propA: 'dots:.25', propB: 'dots:.5', accent: 'ink', accent2: 'dots:.2', screen: 'dots:.25', textInk: 'ink', textBg: 'paper', custom: 'dots:.4', label: 'paper', labelInk: 'ink' };
const LEVELS = [.15, .25, .35, .5, .62];

function lum(h) { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); return .2126 * r + .7152 * g + .0722 * b; }
const toneCache = new Map();
function toneOf(v) {
  if (toneCache.has(v)) return toneCache.get(v);
  let t = { k: 'paper', c: 0 };
  if (typeof v === 'string' && v[0] === '#') {
    const c = 1 - lum(v);
    t = c < .1 ? { k: 'paper', c: 0 } : c > .8 ? { k: 'ink', c: 1 } : { k: 'dots', c: LEVELS.reduce((a, b) => Math.abs(b - c * .85) < Math.abs(a - c * .85) ? b : a) };
  } else if (typeof v === 'string') { const [k, c] = v.split(':'); t = { k, c: +c || 0 }; }
  toneCache.set(v, t); return t;
}

// ---------- screentone patterns (fixed to the screen, never scaled by the camera) ----------
let U = 4, CELL = 14, pats = new Map(), grads = new Map(), grain, SPOT = '#E8613C';
function tilePattern(g, key) {
  if (pats.has(key)) return pats.get(key);
  const [k, cs] = key.split(':'), c = +cs;
  let pat;
  if (k === 'dots') {
    const [cv, x] = canvas(CELL, CELL), r = CELL * Math.sqrt(c / (2 * Math.PI));
    x.fillStyle = INK; for (const [ox, oy] of [[0, 0], [CELL, 0], [0, CELL], [CELL, CELL], [CELL / 2, CELL / 2]]) { x.beginPath(); x.arc(ox, oy, r, 0, Math.PI * 2); x.fill(); }
    pat = { p: g.createPattern(cv, 'repeat'), rot: 0 };
  } else { // line tone
    const s = Math.round(CELL * .62), [cv, x] = canvas(s, s); x.fillStyle = INK; x.fillRect(0, 0, s, Math.max(1, c * s));
    pat = { p: g.createPattern(cv, 'repeat'), rot: k === 'dl' ? -Math.PI / 3.2 : 0 };
  }
  pats.set(key, pat); return pat;
}
function gradPattern(g, W, H, top) {
  const key = top.toFixed(2); if (grads.has(key)) return grads.get(key);
  const [cv, x] = canvas(W, H), s = CELL / Math.SQRT2; x.fillStyle = INK;
  for (let j = 0; j * s < H + s; j++) for (let i = 0; i * s < W + s; i++) {
    if ((i + j) % 2) continue;
    const px = i * s, py = j * s, cov = top * Math.pow(clamp(1 - py / (H * .62)), 1.3);
    if (cov < .015) continue;
    x.beginPath(); x.arc(px, py, CELL * Math.sqrt(cov / (2 * Math.PI)), 0, Math.PI * 2); x.fill();
  }
  const pat = { p: g.createPattern(cv, 'no-repeat'), rot: 0 }; grads.set(key, pat); return pat;
}
function screenFix(g, pat) {
  const inv = g.getTransform().invertSelf();
  pat.p.setTransform(pat.rot ? inv.multiply(new DOMMatrix().rotateSelf(pat.rot * 57.2958)) : inv);
  return pat.p;
}
function toneStyle(R, t) {
  if (t.k === 'ink') return INK;
  if (t.k === 'spot') return SPOT;
  if (t.k === 'grad') return screenFix(R.g, gradPattern(R.g, R.W, R.H, t.c));
  if (t.k === 'dots' || t.k === 'hl' || t.k === 'dl') return screenFix(R.g, tilePattern(R.g, `${t.k}:${t.c}`));
  return null;
}
function fillTone(R, path, t) {
  const g = R.g;
  if (t.k === 'ink') { g.fillStyle = INK; g.fill(path); return; }
  if (t.k === 'spot') { g.fillStyle = SPOT; g.fill(path); return; }
  g.fillStyle = PAPER; g.fill(path);
  const st = toneStyle(R, t); if (st) { g.fillStyle = st; g.fill(path); }
}

function toPath(p, jit) {
  const P = new Path2D();
  pathPrim({ beginPath() {}, moveTo: (x, y) => P.moveTo(x, y), lineTo: (x, y) => P.lineTo(x, y), closePath: () => P.closePath() }, p, jit);
  return P;
}
const ctmScale = g => { const m = g.getTransform(); return Math.hypot(m.a, m.b) || 1; };

// ---------- the ink painter for one group of primitives ----------
function paint(R, prims, m, info) {
  const { g } = R, sc = ctmScale(g), place = info.kind === 'place' || String(info.key).startsWith('placeprop');
  const isProduct = info.kind === 'product';
  const kw = (place ? .55 : isProduct ? 1.15 : 1) / Math.sqrt(sc);
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const p of prims) {
    const raw = m[p.m] ?? m.ink;
    let t = isProduct && p.m === 'body' ? { k: 'spot', c: 1 } : toneOf(raw);
    if (p.m === 'skin') t = { k: 'paper', c: 0 };
    if (p.s === 'text') { primText(g, p, INK, p.font === 'head' ? SFX_FONT : SFX_FONT, 400); continue; }
    const b = primBounds(p), size = Math.max(b[2] - b[0], b[3] - b[1]);
    const leaf = p.m === 'plant' || p.m === 'plant2', small = leaf || size < U * 14 / sc, lw = (place ? U * .9 : clamp(size * (leaf ? .025 : .035), U * (small ? .32 : .5), U * 1.3)) * kw;
    if (p.flat) { flatDetail(R, p, t, lw, sc); continue; }
    if (p.s === 'stroke') {
      const path = toPath(p), w = p.w || 3;
      if (p.m === 'plant' || p.m === 'plant2') { g.strokeStyle = INK; g.lineWidth = Math.max(lw * .8, w * .3); g.stroke(path); continue; }
      if (t.k === 'ink' || w < U * 1.4 / sc) { g.strokeStyle = INK; g.lineWidth = Math.max(w, lw * .8); g.stroke(path); continue; }
      g.strokeStyle = INK; g.lineWidth = w + lw * 2; g.stroke(path);
      g.strokeStyle = PAPER; g.lineWidth = w; g.stroke(path);
      const st = toneStyle(R, t); if (st) { g.strokeStyle = st; g.stroke(path); }
      continue;
    }
    const path = toPath(p);
    const big = place && size > R.H * .5;
    if (!big && !small) { // the brush swells on the shadow side: a heavier lower-right contour
      g.save(); g.translate(lw * .45, lw * .6); g.fillStyle = INK; g.fill(path); g.restore();
    }
    fillTone(R, path, t);
    if (t.k === 'spot') shadeSpot(R, p, path, b);
    else if (info.kind === 'char' && t.k === 'dots' && !small) shadeSide(R, path, b, t);
    if ((p.m === 'hair' || p.m === 'hairInk') && t.k === 'ink' && p.s === 'ellipse') { // a paper highlight ring on black hair
      g.save(); g.clip(path); g.strokeStyle = PAPER; g.lineWidth = lw * 1.1; g.beginPath(); g.ellipse(p.x, p.y, p.rx * .62, p.ry * .62, 0, Math.PI * 1.1, Math.PI * 1.45); g.stroke(); g.restore();
    }
    g.strokeStyle = INK; g.lineWidth = lw; g.stroke(path);
  }
}

// the spot colour gets ink dots for its shadow side and a paper glint, like a spot plate printed under the key plate
function shadeSpot(R, p, path, b) {
  const { g } = R, w = b[2] - b[0], h = b[3] - b[1];
  if (Math.min(w, h) < U * 3) return;
  g.save(); g.clip(path);
  g.fillStyle = toneStyle(R, { k: 'dots', c: .5 }); g.fillRect(b[0] + w * .66, b[1] - 2, w * .4, h + 4);
  g.fillStyle = PAPER; g.fillRect(b[0] + w * .14, b[1] + h * .12, Math.max(2, w * .07), h * .5);
  g.restore();
}

// cel shadow on clothes: a denser screen on the side away from the upper-left light
function shadeSide(R, path, b, t) {
  const { g } = R, w = b[2] - b[0], h = b[3] - b[1];
  g.save(); g.clip(path); g.fillStyle = toneStyle(R, { k: 'dots', c: Math.min(.62, LEVELS[LEVELS.indexOf(t.c) + 2] ?? .62) });
  g.beginPath(); g.moveTo(b[0] + w * .62, b[1] - 2); g.lineTo(b[2] + 2, b[1] - 2); g.lineTo(b[2] + 2, b[3] + 2); g.lineTo(b[0] + w * .52, b[3] + 2); g.closePath(); g.fill();
  g.restore();
}

function flatDetail(R, p, t, lw, sc) {
  const { g } = R;
  if (p.m === 'cheek') { // blush as hatching
    g.save(); g.strokeStyle = INK; g.lineWidth = Math.max(1.2, U * .32 / Math.sqrt(sc));
    for (let i = -1; i <= 1; i++) { const x = p.x + i * p.rx * .55; g.beginPath(); g.moveTo(x - p.rx * .18, p.y + p.ry * .7); g.lineTo(x + p.rx * .18, p.y - p.ry * .7); g.stroke(); }
    g.restore(); return;
  }
  const path = toPath(p);
  if (p.s === 'stroke') { g.strokeStyle = INK; g.lineWidth = p.w || lw; g.stroke(path); return; }
  if (t.k === 'paper') { g.fillStyle = PAPER; g.fill(path); g.strokeStyle = INK; g.lineWidth = lw * .7; g.stroke(path); return; }
  g.fillStyle = INK; g.fill(path);
  if (p.s === 'ellipse' && p.rx < R.H * .03 && p.ry > p.rx * .9) { // eye: a paper catch-light
    g.fillStyle = PAPER; g.beginPath(); g.ellipse(p.x - p.rx * .32, p.y - p.ry * .34, p.rx * .36, p.ry * .3, 0, 0, Math.PI * 2); g.fill();
  }
}

const placeOnly = (R, prims, m, info) => { if (info.kind === 'place' || String(info.key).startsWith('placeprop')) paint(R, prims, m, info); };
const layersOnly = (R, prims, m, info) => { if (!(info.kind === 'place' || String(info.key).startsWith('placeprop'))) paint(R, prims, m, info); };

// ---------- panels ----------
const has = (l, a) => [].concat(l.anim || []).some(x => String(x).split(':')[0] === a);
const TINY = new Set(['drop', 'steam', 'sparkle', 'star', 'heart', 'zzz', 'arrow', 'leaf']);
function anchor(p, k = .5) { return { x: p.xf.x, y: p.xf.y - p.xf.h * k, h: p.xf.h }; }

function layout(R, s) {
  const { W, H, LANDSCAPE: LS } = R, m = Math.min(W, H) * .035, gt = Math.min(W, H) * .024;
  const shot = s.shot, beat = shot.beat || '', L = s.layers.filter(p => p.prims);
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const prod = L.find(p => p.layer.type === 'product');
  const props = L.filter(p => p.layer.type === 'prop' && !TINY.has(p.layer.kind)).sort((a, b) => b.xf.h - a.xf.h);
  const chars = L.filter(p => p.layer.type === 'char');
  const breakers = L.filter(p => has(p.layer, 'reveal'));
  const main = { kind: 'main' };
  if (s.end) {
    const poly = LS ? [[m, H * .34], [W * .5, H * .29], [W * .5, H - m], [m, H - m]] : [[m, H * .215], [W - m, H * .185], [W - m, H * .47], [m, H * .475]];
    return { panels: [{ ...main, poly, fx: 'focus' }], breakers };
  }
  if (beat === 'reveal' && breakers.length) {
    const yl = LS ? .5 : .5, yr = LS ? .45 : .445;
    return { panels: [
      { ...main, poly: [[m, m], [W - m, m], [W - m, H * yr - gt / 2], [m, H * yl - gt / 2]], fx: 'speed' },
      { ...main, poly: [[m, H * yl + gt / 2], [W - m, H * yr + gt / 2], [W - m, H - m], [m, H - m]], fx: 'focus' },
    ], breakers };
  }
  // right-hand column of close-up inserts: the hook gets two, a pulse with the product at the edge gets one
  const targets = [];
  if (beat === 'hook') { if (props[0]) targets.push(props[0]); if (prod) targets.push(prod); if (!targets.length && chars[0]) targets.push(chars[0]); }
  else if (beat === 'pulse' && prod && (prod.xf.x - R.stage.x0) / R.stage.w > .7) targets.push(prod);
  if (!targets.length) return { panels: [{ ...main, poly: rect(m, m, W - m, H - m) }], breakers: [] };
  const xt = W * (LS ? .64 : .635), xb = W * (LS ? .67 : .665), xg = y => lerp(xt, xb, y / H);
  const panels = [{ ...main, poly: [[m, m], [xt - gt / 2, m], [xb - gt / 2, H - m], [m, H - m]] }];
  const yA = H * (targets.length > 1 ? .485 : 0), yB = H * (targets.length > 1 ? .515 : 0);
  targets.forEach((tg, i) => {
    const one = targets.length === 1;
    const poly = one ? [[xt + gt / 2, m], [W - m, m], [W - m, H - m], [xb + gt / 2, H - m]]
      : i === 0 ? [[xt + gt / 2, m], [W - m, m], [W - m, yA - gt / 2], [xg(yB) + gt / 2, yB - gt / 2]]
        : [[xg(yB) + gt / 2, yB + gt / 2], [W - m, yA + gt / 2], [W - m, H - m], [xb + gt / 2, H - m]];
    panels.push({ kind: 'insert', poly, target: tg });
  });
  return { panels, breakers: [] };
}
function polyPath(poly) { const P = new Path2D(); poly.forEach(([x, y], i) => i ? P.lineTo(x, y) : P.moveTo(x, y)); P.closePath(); return P; }
function bbox(poly) { const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }

// insert camera: centre the target in the panel at a close-up scale
function insertCam(R, panel) {
  const [x0, y0, x1, y1] = bbox(panel.poly), pw = x1 - x0, ph = y1 - y0, tg = panel.target, ty = tg.layer.type;
  const k = ty === 'char' ? .8 : ty === 'product' ? .5 : .5, a = anchor(tg, k);
  let Z = ty === 'product' ? Math.min(pw * .62 / (a.h * .45), ph * .7 / a.h) : ty === 'char' ? pw * .7 / (a.h * .34) : Math.min(pw * 1.1 / (a.h * 1.05), ph * .8 / a.h);
  Z = clamp(Z, 1.35, 4.2) * (1 + .05 * seg(R.lt, 0, R.shot.t1 - R.shot.t0));
  let cy = (y0 + y1) / 2;
  if (ty === 'product' && !R.LANDSCAPE) cy = Math.max(y0 + a.h * Z * .5 + U * 8, Math.min(cy, R.H * .52));   // keep the product clear of the caption band
  const C = { x: (x0 + x1) / 2, y: cy };
  return { C, F: { x: a.x, y: a.y }, cam: { zoom: Z, px: 0, py: 0, cx: a.x, cy: a.y } };
}
// frame point → screen, for a panel's camera
function mapPt(R, panel, x, y) {
  if (panel.ic) { const { C, F, cam } = panel.ic; return [C.x + (x - F.x) * cam.zoom, C.y + (y - F.y) * cam.zoom]; }
  const c = R.cam; return [c.cx + (x - c.cx + c.px * R.W) * c.zoom, c.cy + (y - c.cy + c.py * R.H) * c.zoom];
}

// ---------- effect lines (boil on twos: a new seed 12 times a second) ----------
const boil = R => Math.floor(R.tq * 12);
function focusLines(R, cx, cy, rx, ry, box, n = 150) {
  const { g } = R, k = boil(R), Ro = Math.hypot(box[2] - box[0], box[3] - box[1]);
  g.fillStyle = INK;
  for (let i = 0; i < n; i++) {
    const a = (i + hash(i * 3.1 + k * .37)) / n * Math.PI * 2, f = 1 + hash(i * 7.3 + k * 1.9) * .75;
    const ix = cx + Math.cos(a) * rx * f, iy = cy + Math.sin(a) * ry * f, half = (U * .35 + hash(i * 1.7 + k) * U * 1.3) / Ro;
    g.beginPath(); g.moveTo(ix, iy);
    g.lineTo(cx + Math.cos(a - half) * Ro, cy + Math.sin(a - half) * Ro); g.lineTo(cx + Math.cos(a + half) * Ro, cy + Math.sin(a + half) * Ro); g.closePath(); g.fill();
  }
}
function gloomLines(R, box, depth = .3) {
  const { g } = R, k = boil(R), step = U * 1.9, h = box[3] - box[1];
  g.fillStyle = INK;
  for (let i = 0, x = box[0]; x < box[2]; i++, x += step * (.7 + hash(i * 5.1) * .6)) {
    const len = h * depth * (.35 + hash(i * 2.7 + 1) * .65) * (1 + (hash(i + k * .13) - .5) * .06), w = U * (.25 + hash(i * 9.3) * .35);
    g.beginPath(); g.moveTo(x - w, box[1]); g.lineTo(x + w, box[1]); g.lineTo(x, box[1] + len); g.closePath(); g.fill();
  }
}
function speedLines(R, box, y0, y1) {
  const { g } = R, k = boil(R), w = box[2] - box[0];
  g.fillStyle = INK;
  for (let i = 0; i < 46; i++) {
    const y = lerp(y0, y1, hash(i * 4.7 + k * .29)), len = w * (.25 + hash(i * 3.3 + k) * .5), x = box[0] + hash(i * 8.1 + k * 2.3) * (w - len) , th = U * (.15 + hash(i * 6.6) * .45);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * .5, y - th); g.lineTo(x + len, y); g.lineTo(x + len * .5, y + th); g.closePath(); g.fill();
  }
}
function sparkle(R, x, y, r) {
  const { g } = R, P = new Path2D();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, q = i % 2 ? r * .2 : r; i ? P.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : P.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  P.closePath(); g.fillStyle = PAPER; g.fill(P); g.strokeStyle = INK; g.lineWidth = U * .5; g.lineJoin = 'miter'; g.stroke(P);
}
function sweatDrop(R, x, y, r) {
  const { g } = R, P = new Path2D(); P.moveTo(x, y - r * 1.6); P.quadraticCurveTo(x + r * 1.05, y - r * .2, x + r * .9, y + r * .35); P.arc(x, y + r * .2, r * .92, .15, Math.PI - .15); P.quadraticCurveTo(x - r * 1.05, y - r * .2, x, y - r * 1.6);
  g.fillStyle = PAPER; g.fill(P); g.strokeStyle = INK; g.lineWidth = U * .7; g.stroke(P);
  g.fillStyle = INK; g.beginPath(); g.ellipse(x - r * .35, y + r * .15, r * .14, r * .3, .3, 0, Math.PI * 2); g.fill();
}
function vein(R, x, y, r) { // the cross-shaped anger mark
  const { g } = R; g.strokeStyle = INK; g.lineWidth = U * 2.1; g.lineCap = 'round';
  for (let i = 0; i < 4; i++) { // four rounded corner brackets, corners toward the centre
    const sx = i % 2 ? 1 : -1, sy = i < 2 ? -1 : 1, cx = x + sx * r * .2, cy = y + sy * r * .2;
    g.beginPath(); g.moveTo(cx + sx * r * .75, cy + sy * r * .08); g.quadraticCurveTo(cx, cy, cx + sx * r * .08, cy + sy * r * .75); g.stroke();
  }
}

// onomatopoeia: Bangers, three layers (wide ink, paper, ink fill), letters slam in one after another and boil
function sfx(R, text, x, y, size, rot, lt, seed = 1) {
  const { g } = R, k = boil(R);
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = `400 ${size}px ${SFX_FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineJoin = 'round';
  const total = g.measureText(text).width * 1.08; let cx = -total / 2; const L = [];
  [...text].forEach((ch, i) => {
    const w = g.measureText(ch).width * 1.08, p = seg(lt, i * .055, i * .055 + .22);
    if (p > 0) L.push({ ch, x: cx + w / 2 + (hash(k + i * 1.3) - .5) * U * .5, y: (hash(k * 1.7 + i) - .5) * U * .5 + (hash(i * 5.5 + seed) - .5) * size * .14, r: (hash(i * 3.3 + seed) - .5) * .32, s: lerp(1.8, 1, back(p, 2.4)), w: w / 1.08 });
    cx += w;
  });
  for (const pass of [0, 1, 2]) for (const q of L) {
    g.save(); g.translate(q.x, q.y); g.rotate(q.r); g.scale(q.s, q.s);
    if (pass === 0) { g.strokeStyle = INK; g.lineWidth = size * .3; g.strokeText(q.ch, -q.w / 2, 0); }
    else if (pass === 1) { g.strokeStyle = PAPER; g.lineWidth = size * .2; g.strokeText(q.ch, -q.w / 2, 0); }
    else { g.fillStyle = INK; g.fillText(q.ch, -q.w / 2, 0); }
    g.restore();
  }
  g.restore();
}

// what the panel says without words: mood marks and sound effects, decided from the shot's content
function moods(R, s, panel, box) {
  const { g, H } = R, W = R.stage.w, L = s.layers.filter(p => p.prims), lt = R.lt;
  // a main panel speaks for everything in the shot; an insert only for its own subject (and makes no sounds)
  const inPanel = p => panel.kind === 'main' || (p === panel.target && p.layer.type === 'char');
  const ys = R.LANDSCAPE ? [.4, .7] : [.33, .68], xs = R.LANDSCAPE ? [.1, .9] : [.14, .86], FW = R.W;
  const texts = s.layers.filter(p => p.layer.type === 'text').map(p => R.layoutText(p.layer, p.llt).box);
  const cl0 = (x, y) => [clamp(x, FW * xs[0], FW * xs[1]), clamp(y, Math.max(box[1] + U * 14, H * ys[0]), Math.min(box[3] - U * 14, H * ys[1]))];
  // sound effects never sit on a card: slide below any text box they would touch
  const cl = (x, y, word = 'XXXX', size = W * .1) => {
    let [cx, cy] = cl0(x, y); const hw = word.length * size * .3, hh = size * .6;
    for (const b of texts) if (cx + hw > b[0] && cx - hw < b[2] && cy + hh > b[1] - U * 4 && cy - hh < b[3] + U * 4) cy = b[3] + hh + U * 6;
    return [cx, cy];
  };
  for (const p of L) {
    if (!inPanel(p)) continue;
    const ly = p.layer;
    if (ly.type === 'char') {
      const [hx, hy] = mapPt(R, panel, p.xf.x, p.xf.y - p.xf.h * .8), hr = p.xf.h * .17 * (panel.ic ? panel.ic.cam.zoom : R.cam.zoom);
      if (ly.pose === 'annoyed') { vein(R, hx + hr * .78, hy - hr * .72, hr * .36); if (panel.kind === 'main') { const [sx, sy] = cl(hx + hr * 2.1, hy + hr * .15, 'GRR', W * .1); sfx(R, 'GRR', sx, sy, W * .1, -.18, lt, 3); } }
      if (ly.pose === 'think' || ly.pose === 'tired') sweatDrop(R, hx - hr * 1.05, hy - hr * .45 + seg(lt, 0, 2.5) * hr * .25, hr * .17);
      if (ly.pose === 'happy' || ly.pose === 'cheer' || ly.pose === 'wave') {
        for (let i = 0; i < 6; i++) { const a = -Math.PI * (.15 + i * .14), d = hr * (1.6 + hash(i * 3.1) * .7), tw = .65 + .35 * Math.sin(R.tq * 6 + i * 2), sx = hx + Math.cos(a) * d * 1.15, sy = hy + Math.sin(a) * d, sr = hr * (.14 + hash(i * 7.7) * .14) * tw; if (sx - sr > box[0] && sx + sr < box[2] && sy - sr > box[1]) sparkle(R, sx, sy, sr); }
      }
    }
    if (ly.type === 'prop' && has(ly, 'drop') && lt > (ly.t0 ?? 0) + .3) { const [x, y] = mapPt(R, panel, p.xf.x, p.xf.y - p.xf.h); const [sx, sy] = cl(x - W * .13, y - H * .01, 'PLIP', W * .075); sfx(R, 'PLIP', sx, sy, W * .075, -.25, lt - (ly.t0 ?? 0) - .3, 5); }
    if (ly.type === 'product' && has(ly, 'reveal') && !s.end && panel.fx === 'focus') { const [x, y] = mapPt(R, panel, p.xf.x, p.xf.y - p.xf.h * .55); const [sx, sy] = cl(x + W * .36, y - H * .07, 'SHING!', W * .095); sfx(R, 'SHING!', sx, sy, W * .095, -.5, lt - (ly.t0 ?? 0) - .2, 9); }
  }
  // a gloomy plant alone in its panel sags out loud
  const droop = L.find(p => p.layer.kind === 'fern-droopy' && inPanel(p));
  if (droop && panel.kind === 'main' && !L.some(p => p.layer.type === 'char')) { const [x, y] = mapPt(R, panel, droop.xf.x, droop.xf.y - droop.xf.h); const [sx, sy] = cl(x + W * .22, y - H * .06, 'DROOP...', W * .085); sfx(R, 'DROOP...', sx, sy, W * .085, .12, lt - .2, 4); }
}
function panelFx(R, s, panel, box) {
  const L = s.layers.filter(p => p.prims), inner = panel.target ? [panel.target] : L;
  const gloomy = inner.some(p => p.layer.kind === 'fern-droopy' || ['sad', 'tired'].includes(p.layer.pose)) && !inner.some(p => p.layer.pose === 'annoyed' || p.layer.type === 'product' && panel.target);
  if (gloomy) gloomLines(R, box, panel.kind === 'insert' ? .32 : .3);
  if (panel.fx === 'speed') speedLines(R, box, box[1] + (box[3] - box[1]) * .55, box[3] - U * 4);
  if (panel.fx === 'focus') {
    const tg = (s.breakers && s.breakers[0]) || L.find(p => p.layer.type === 'product');
    if (tg) { const [cx, cy] = mapPt(R, panel, tg.xf.x, tg.xf.y - tg.xf.h * .5); const gl = clamp(tg.a.glow + .25); focusLines(R, cx, cy, tg.xf.h * .42 / gl, tg.xf.h * .58 / gl, box, s.end ? 170 : 150); }
  }
  if (panel.kind === 'insert' && panel.target.layer.type === 'product') { // a small glint on the planted product
    const [cx, cy] = mapPt(R, panel, panel.target.xf.x, panel.target.xf.y - panel.target.xf.h * .5), r = Math.min(box[2] - box[0], box[3] - box[1]);
    focusLines(R, cx, cy, r * .42, r * .62, box, 70);
  }
}

// a figure or product that breaks out of its panel: paper rim + ink rim around the silhouette, then the figure
function breakout(R, s, p) {
  const { g } = R, cam = s.cam;
  g.save();
  g.translate(cam.cx, cam.cy); g.scale(cam.zoom, cam.zoom); g.translate(-cam.cx + cam.px * R.W, -cam.cy + cam.py * R.H);
  const prims = placePrims(p.prims, p.xf).filter(q => q.s !== 'text' && !q.flat), rim = U * 2.6;
  g.lineJoin = 'round';
  for (const q of prims) { g.strokeStyle = INK; g.lineWidth = rim * 2 + U * 1.6; g.stroke(toPath(q)); }
  for (const q of prims) { g.strokeStyle = PAPER; g.lineWidth = rim * 2; const P = toPath(q); g.stroke(P); g.fillStyle = PAPER; g.fill(P); }
  g.globalAlpha = p.a.alpha;
  paint(R, placePrims(p.prims, p.xf), p.m, { kind: p.layer.type, key: 'breakout', layer: p.layer, a: p.a, xf: p.xf });
  g.restore();
}

function balloonPath(cx, cy, rx, ry) {
  const P = new Path2D(), n = 72, e = 2 / 3.4;
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const x = cx + rx * Math.sign(c) * Math.pow(Math.abs(c), e), y = cy + ry * Math.sign(s) * Math.pow(Math.abs(s), e);
    i ? P.lineTo(x, y) : P.moveTo(x, y);
  }
  P.closePath(); return P;
}
function tailPath(bx, by, w, tx, ty) { const P = new Path2D(); P.moveTo(bx - w, by); P.quadraticCurveTo(bx - w * .2, (by + ty) / 2, tx, ty); P.quadraticCurveTo(bx + w * .4, (by + ty) / 2, bx + w, by); P.closePath(); return P; }

// ---------- the style ----------
const style = {
  id: 'ad-manga-panels', onTwos: true,
  fontFaces: ['400 40px "Bangers"', '700 40px "Comic Neue"'],
  defaultCast: {},
  palette: (time, over) => ({ ...COMMON, ...(PAL[time] || PAL.day), ...over }),
  font: role => role === 'hook' || role === 'logo' || role === 'price' || role === 'label' ? { family: SFX_FONT, weight: 400, lh: 1.02 } : { family: LET_FONT, weight: 700, lh: 1.12 },
  setup(R) {
    const mn = Math.min(R.W, R.H); U = mn * .004; CELL = Math.max(8, Math.round(mn * .0125));
    SPOT = R.bible.product?.colors?.body || SPOT;
    pats = new Map(); grads = new Map();
    grain = R.g.createPattern(noiseTile(512, 13, 26), 'repeat');
  },

  scene(R, s) {
    const { g, W, H } = R;
    const L = layout(R, s), breakIds = new Set(L.breakers.map(p => p.layer));
    s = { ...s, breakers: L.breakers };
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = PAPER; g.fillRect(0, 0, W, H); g.restore();
    const n = L.panels.length;
    L.panels.forEach((panel, i) => {
      // panel ink-in: each later panel wipes in, in reading order, on the beat
      const delay = i * .12, p = seg(R.lt, delay, delay + .1);
      if (i > 0 && p <= 0) { borderPath(R, panel.poly, true); return; }
      const box = bbox(panel.poly), path = polyPath(panel.poly);
      if (panel.kind === 'insert') panel.ic = insertCam(R, panel);
      g.save(); g.clip(path);
      if (i > 0 && p < 1) { g.beginPath(); g.rect(box[0], box[1], (box[2] - box[0]) * eo(p), box[3] - box[1]); g.clip(); }
      const sl = (n > 1 && i > 0) ? (1 - eo(seg(R.lt, delay, delay + .25))) * W * .04 : 0;
      g.translate(sl, 0);
      const layers = s.layers.filter(p => !breakIds.has(p.layer));
      const sub = { ...s, layers, cam: panel.ic ? panel.ic.cam : s.cam };
      g.save(); if (panel.ic) g.translate(panel.ic.C.x - panel.ic.F.x, panel.ic.C.y - panel.ic.F.y);
      drawScene(R, { ...sub, layers: [] }, placeOnly);
      g.restore();
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); panelFx(R, s, panel, box); g.restore();
      g.save(); if (panel.ic) g.translate(panel.ic.C.x - panel.ic.F.x, panel.ic.C.y - panel.ic.F.y);
      drawScene(R, sub, layersOnly);
      g.restore();
      g.restore();
      borderPath(R, panel.poly);
      panel.box = box;
    });
    // mood marks and sound effects may break the panel borders
    for (const panel of L.panels) if (panel.box) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); moods(R, s, panel, panel.box); g.restore(); }
    for (const p of L.breakers) breakout(R, s, p);
  },

  text(R, lay, lt) {
    const { g, H, W } = R, role = lay.role, U2 = Math.min(W, H) * .004;
    const [x0, y0, x1, y1] = lay.box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const slam = lerp(1.22, 1, back(seg(lt, 0, .2), 2.2));
    g.save(); g.translate(cx, cy); g.scale(slam, slam); g.translate(-cx, -cy);
    g.font = `${lay.font.weight} ${lay.size}px ${lay.font.family}`; g.textAlign = lay.align; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    if (role === 'hook' || role === 'logo') { // hand-lettered shout: wide ink, paper, ink fill; letters staggered
      g.translate(cx, cy); g.rotate(role === 'hook' ? -.035 : -.02); g.translate(-cx, -cy);
      for (const [li, ln] of lay.lines.entries()) shout(R, ln, lay, lt - li * .12);
      if (role === 'logo') { // the brand underline in the spot colour
        const ln = lay.lines[lay.lines.length - 1], w = ln.w, sx = lay.align === 'center' ? ln.x - w / 2 : ln.x, y = ln.y + lay.size * .14, p = eo(seg(lt, .25, .6));
        const P = new Path2D(); P.moveTo(sx, y); P.lineTo(sx + w * p, y - lay.size * .05); P.lineTo(sx + w * p - lay.size * .04, y + lay.size * .09); P.lineTo(sx + lay.size * .02, y + lay.size * .12); P.closePath();
        g.fillStyle = SPOT; g.fill(P); g.strokeStyle = INK; g.lineWidth = U2 * .9; g.stroke(P);
      }
      g.restore(); return;
    }
    const boxed = lay.layer.bg ?? (role === 'card' || role === 'cta');
    if (boxed) { // narration box (or the CTA tag in the spot colour), offset solid ink shadow, ink border
      const pad = lay.size * .38, bx0 = x0 - pad, by0 = y0 - pad * .55, bx1 = x1 + pad, by1 = y1 + pad * .45, sh = U2 * 2.4;
      g.fillStyle = INK; g.fillRect(bx0 + sh, by0 + sh, bx1 - bx0, by1 - by0);
      g.fillStyle = role === 'cta' ? SPOT : PAPER; g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
      g.strokeStyle = INK; g.lineWidth = U2 * 1.1; g.lineJoin = 'miter'; g.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
      g.fillStyle = role === 'cta' ? PAPER : INK;
      if (role === 'cta') { g.strokeStyle = INK; g.lineWidth = lay.size * .16; g.lineJoin = 'round'; for (const ln of lay.lines) g.strokeText(ln.text, ln.x, ln.y); }
      for (const ln of lay.lines) g.fillText(ln.text, ln.x, ln.y);
    } else { // free lettering gets a paper rim so it reads over any tone
      g.strokeStyle = PAPER; g.lineWidth = lay.size * .22;
      for (const ln of lay.lines) g.strokeText(ln.text, ln.x, ln.y);
      g.fillStyle = INK; for (const ln of lay.lines) g.fillText(ln.text, ln.x, ln.y);
    }
    g.restore();
  },

  caption(R, text, box) {
    const { g, W, H } = R, f = { family: LET_FONT, weight: 700 }, U2 = Math.min(W, H) * .004;
    const lines = captionLines(g, text, f, box.size, box.w * .92), lh = box.size * 1.14;
    const widest = Math.max(...lines.map(l => g.measureText(l).width)), h = lh * lines.length;
    const rx = widest / 2 + box.size * .85, ry = h / 2 + box.size * .55;
    // the tail points at the speaker if they are on screen, otherwise down and out of the panel (a voice from off-frame)
    const cue = (R.cues || []).find(c => R.t >= c.t0 && R.t < c.t1), sp = R.shot?.layers?.find(l => l.type === 'char' && l.id === cue?.speaker);
    const dir = sp ? -1 : 1, side = sp ? ((sp.x ?? .5) < .5 ? -1 : 1) : 1;
    const bx = box.cx + side * rx * .42, by = box.cy + dir * ry * .6, tx = box.cx + side * rx * .62, ty = box.cy + dir * (ry + box.size * .85);
    const B = balloonPath(box.cx, box.cy, rx, ry), T = tailPath(bx, by, box.size * .32, tx, ty);
    g.save(); g.lineJoin = 'round';
    g.strokeStyle = INK; g.lineWidth = U2 * 2.6; g.stroke(B); g.stroke(T);   // outline of the union: stroke both wide, then fill both
    g.fillStyle = PAPER; g.fill(B); g.fill(T);
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, box.cx, box.cy - h / 2 + lh * (i + .5) + box.size * .04));
    g.restore();
  },

  transition(R, kind, p) {
    const { g, W, H } = R;
    if (kind === 'wipe' || kind === 'slide') { // the next panel inks in from the left; a slanted paper edge with an ink line
      const e = lerp(-W * .15, W * 1.2, eo(p)), sl = W * .12;
      const P = new Path2D(); P.moveTo(e + sl, 0); P.lineTo(W * 2, 0); P.lineTo(W * 2, H); P.lineTo(e - sl, H); P.closePath();
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = PAPER; g.fill(P); g.strokeStyle = INK; g.lineWidth = U * 1.8; g.stroke(P);
      g.beginPath(); g.rect(0, 0, W, H); g.clip(P); speedLines(R, [e, 0, W, H], H * .1, H * .9); g.restore();
    } else if (kind === 'fade') { // halftone dissolve: paper dots shrink away, never a grey alpha fade
      const c = Math.round(CELL * 2.2), [cv, x] = canvas(c, c), r = c * .75 * (1 - eo(p));
      if (r < .5) return;
      x.fillStyle = PAPER; for (const [ox, oy] of [[0, 0], [c, 0], [0, c], [c, c], [c / 2, c / 2]]) { x.beginPath(); x.arc(ox, oy, r, 0, Math.PI * 2); x.fill(); }
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = g.createPattern(cv, 'repeat'); g.fillRect(0, 0, W, H); g.restore();
    } else transition(R, kind === 'stripes' ? 'stripes' : 'iris', p, [INK]);
  },

  post(R) {
    const { g, W, H } = R;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = .35; const k = boil(R); g.translate((k * 37) % 512, (k * 71) % 512); g.fillStyle = grain; g.fillRect(-512, -512, W + 1024, H + 1024);
    g.restore();
    // impact frame: the reveal opens with two inverted frames
    if (R.shot?.beat === 'reveal' && R.t - R.shot.t0 < 2 / 24) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'difference'; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.restore(); }
  },
};

function borderPath(R, poly, dashed = false) {
  const { g } = R; g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.strokeStyle = INK; g.lineWidth = U * (dashed ? .8 : 1.7); g.lineJoin = 'miter'; if (dashed) g.setLineDash([U * 4, U * 3]);
  g.stroke(polyPath(poly)); g.restore();
}

function shout(R, ln, lay, lt) {
  const { g } = R, size = lay.size, k = boil(R);
  const x0 = lay.align === 'center' ? ln.x - ln.w / 2 : lay.align === 'right' ? ln.x - ln.w : ln.x;
  g.save(); g.textAlign = 'left';
  let cx = x0; const L = [];
  [...ln.text].forEach((ch, i) => {
    const w = g.measureText(ch).width, p = seg(lt, i * .03, i * .03 + .18);
    if (p > 0) L.push({ ch, w, x: cx + w / 2, y: ln.y - size * .35 + (hash(k + i * 2.1) - .5) * size * .012, r: (hash(i * 4.1 + ln.y) - .5) * .09, s: lerp(1.6, 1, back(p, 2.2)) });
    cx += w;
  });
  for (const pass of [0, 1, 2]) for (const q of L) {
    g.save(); g.translate(q.x, q.y); g.rotate(q.r); g.scale(q.s, q.s);
    if (pass === 0) { g.strokeStyle = INK; g.lineWidth = size * .26; g.strokeText(q.ch, -q.w / 2, size * .35); }
    else if (pass === 1) { g.strokeStyle = PAPER; g.lineWidth = size * .16; g.strokeText(q.ch, -q.w / 2, size * .35); }
    else { g.fillStyle = INK; g.fillText(q.ch, -q.w / 2, size * .35); }
    g.restore();
  }
  g.restore();
}

export default style;
