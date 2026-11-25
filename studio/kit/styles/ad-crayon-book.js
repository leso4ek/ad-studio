// Ad style "Crayon Picture Book" (ad-crayon-book): every frame is a picture-book page coloured in wax crayon on
// toothy cream paper. Fills are layered hatching that slips past a wobbly outline drawn in a darker crayon of the
// same hue; wax only reaches the peaks of the paper tooth (pits are erased with page-anchored masks); figures keep
// the paper white behind them; words are hand-lettered on blank paper. Drawn on twos with a gentle line boil.
// Original; follows the crayon-book rules of Lemo-Opuscar. See styles/ad-crayon-book/STYLE.md.
import { pathPrim, canvas } from '../draw2d.js';
import { drawScene, captionLines } from './style2d.js';
import { hash, vnoise, clamp, seg, eo, lerp } from '/core/lib.js';

// ---------- the crayon box (about a dozen sticks per time of day) ----------
const PAPER = '#F5EFE1';
const LINE = '#2E2852';                       // indigo: the darkest stick, never black
const PAL = {
  day:  { wall: '#F6D36B', wall2: '#86C3AE', floor: '#D0794A', floor2: '#9A4E31', wood: '#BC7A45', sky: '#6DB4E2', sky2: '#A8D7F0', glass: '#93C6E4', metal: '#8F9BB8',
          plant: '#4C9A4A', plant2: '#7DB85A', sun: '#F5B335', moon: '#F7E7A6', cloud: '#FFFFFF', building: '#E58A6A', building2: '#C9A27E', windowLit: '#F9DA6E', ground: '#82BC5E', path: '#E9C98F' },
  dusk: { wall: '#F2A866', wall2: '#C98DA8', floor: '#A95A3E', floor2: '#7E3E2C', wood: '#9C5A3A', sky: '#EE8A5E', sky2: '#F6C27A', glass: '#E9A98A', metal: '#8E86A8',
          plant: '#4D7F48', plant2: '#6E9A52', sun: '#F7C04A', moon: '#F7E7A6', cloud: '#F9D9C4', building: '#B4655B', building2: '#9E7A6E', windowLit: '#FFD98A', ground: '#6E8F55', path: '#C9A57D' },
  night:{ wall: '#5E6BAA', wall2: '#4A568F', floor: '#45406A', floor2: '#332F52', wood: '#5A4560', sky: '#2E3C7C', sky2: '#4253A0', glass: '#4A63A0', metal: '#6D7598',
          plant: '#3E6E5A', plant2: '#4F8468', sun: '#F7C04A', moon: '#F8EDBE', cloud: '#7D8BC0', building: '#3C4878', building2: '#323B66', windowLit: '#FBD66E', ground: '#2F5A4E', path: '#5C618A' },
};
const COMMON = { skin: '#F2B999', hair: '#4A2E25', top: '#E2604A', bottom: '#3E5C98', shoe: '#3A2C3E', ink: LINE, white: '#FFFDF6', cheek: '#F08A9A',
  propA: '#F0A04B', propB: '#3E8FC0', accent: '#E2604A', accent2: '#F5B335', screen: '#9ED4EA', textInk: LINE, textBg: PAPER, custom: '#E2604A' };

// pressure per kind of group: wax under-layer, hatching, how much tooth it misses, outline weight
const PRESS = {
  far:     { under: .46, hatch: .9, pits: 'far', lw: 3.4, slip: 2.5 },
  mid:     { under: .6, hatch: .95, pits: 'mid', lw: 3.8, slip: 3 },
  prop:    { under: .66, hatch: 1, pits: 'prop', lw: 4.4, slip: 4 },
  product: { under: .86, hatch: 1, pits: 'heavy', lw: 5, slip: 3.5 },
  char:    { under: .76, hatch: 1, pits: 'heavy', lw: 5.4, slip: 4.5 },
};
const PIT_FRAC = { far: .3, mid: .24, prop: .19, heavy: .13, text: .05 };

// ---------- colour helpers ----------
const rgb = h => { h = String(h).replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const hex = a => '#' + a.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const darkC = new Map();
function dark(c) {   // the outline stick: the same hue, much darker, leaning to indigo
  if (!darkC.has(c)) { const [r, g2, b] = rgb(c), l = (r * .3 + g2 * .59 + b * .11) / 255; darkC.set(c, mix(mix(c, LINE, .5), '#1E1830', l > .75 ? .28 : .12)); }
  return darkC.get(c);
}

// ---------- precomputed textures ----------
let U = 1, S = 320, tmp, tx, paperPat, mottle, pits = {}, pitsPaper = {}, hatchC = new Map(), G0;
const isColor = c => typeof c === 'string' && c[0] === '#';

function tileNoise(size, gx, gy, seed) {          // tileable value noise, gx×gy lattice over the tile
  const v = new Float32Array(gx * gy); let s = seed;
  for (let i = 0; i < v.length; i++) { s = (s * 16807) % 2147483647; v[i] = s / 2147483647; }
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = y / size * gy, iy = Math.floor(fy), uy = fy - iy, sy = uy * uy * (3 - 2 * uy), y0 = iy % gy, y1 = (iy + 1) % gy;
    for (let x = 0; x < size; x++) {
      const fx = x / size * gx, ix = Math.floor(fx), ux = fx - ix, sx = ux * ux * (3 - 2 * ux), x0 = ix % gx, x1 = (ix + 1) % gx;
      const a = v[y0 * gx + x0], b = v[y0 * gx + x1], c = v[y1 * gx + x0], d = v[y1 * gx + x1];
      out[y * size + x] = a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy;
    }
  }
  return out;
}

function buildTooth(T) {
  const n = T * T, oct = [[Math.round(T / (1.7 * U)), .4], [Math.round(T / (3.8 * U)), .3], [Math.round(T / (11 * U)), .1]];
  const tooth = new Float32Array(n);
  oct.forEach(([gcount, w], j) => { const a = tileNoise(T, gcount, gcount, 1234 + j * 777); for (let i = 0; i < n; i++) tooth[i] += a[i] * w; });
  const fib = tileNoise(T, Math.round(T / (32 * U)), Math.round(T / (1.8 * U)), 9091);  // horizontal paper fibres
  for (let i = 0; i < n; i++) tooth[i] += fib[i] * .2;
  return tooth;
}

let SORTED = null;
function maskTile(tooth, T, frac, paper) {        // alpha = 1 in the pits the wax cannot reach (with paper colour when given)
  SORTED = SORTED || Float32Array.from(tooth).sort();
  const q = f => SORTED[Math.floor(clamp(f, 0, .999) * SORTED.length)];
  const hi = q(frac), lo = q(frac * .55), [c, x] = canvas(T, T), d = paper ? paper.getContext('2d').getImageData(0, 0, T, T) : x.createImageData(T, T);
  for (let i = 0; i < T * T; i++) { const a = clamp((hi - tooth[i]) / Math.max(1e-6, hi - lo)); d.data[i * 4 + 3] = a * 255; }
  x.putImageData(d, 0, 0); return c;
}

function paperTile(tooth, T) {
  const [c, x] = canvas(T, T), d = x.createImageData(T, T), base = rgb(PAPER);
  for (let y = 0; y < T; y++) for (let xx = 0; xx < T; xx++) {
    const i = y * T + xx, j = ((y + 1) % T) * T + (xx + 1) % T;
    const emb = (tooth[i] - tooth[j]) * 1.1, f = 1 + (tooth[i] - .5) * .05 + emb * .5;
    d.data[i * 4] = base[0] * f + emb * 30; d.data[i * 4 + 1] = base[1] * f + emb * 30; d.data[i * 4 + 2] = base[2] * f + emb * 22; d.data[i * 4 + 3] = 255;
  }
  x.putImageData(d, 0, 0); return c;
}

function hatchTile(col) {                         // periodic back-and-forth crayon hatching in one colour
  const key = col; if (hatchC.has(key)) return hatchC.get(key);
  const [c, x] = canvas(S, S), N = Math.max(8, Math.round(S / (7.4 * U) / 4) * 4), hcol = mix(col, dark(col), .2), half = N / 2;
  x.lineCap = 'round'; x.strokeStyle = hcol;
  const line = (cc, slope, j, w, a) => {
    for (let m = -2; m <= 2; m++) {
      x.globalAlpha = a; x.lineWidth = w; x.beginPath();
      for (let px = -S; px <= 2 * S; px += S / 16) {
        const wob = Math.sin(px / S * Math.PI * 2 * 3 + j * 1.7) * .9 * U + Math.sin(px / S * Math.PI * 2 * 7 + j) * .5 * U;
        const py = cc + m * S + slope * px + wob;
        px === -S ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.stroke();
    }
  };
  for (let j = 0; j < N; j++) {   // main pass, pairs of strokes with a gap (the hand going back and forth)
    const r = j % half, cc = j * S / N + (j % 2 ? -S / N * .22 : 0);
    line(cc, -.5, r, (S / N) * (.5 + hash(r * 3.3) * .16), .62 + hash(r * 7.1) * .38);
  }
  for (let j = 0; j < N; j += 2) {   // a lighter cross pass
    const r = j % half; line(j * S / N, .5, r + 40, (S / N) * .34, .22 + hash(r * 2.9) * .16);
  }
  // the wax skips along the stroke: short breaks in the hatching direction
  x.globalCompositeOperation = 'destination-out'; x.globalAlpha = .85;
  for (let i = 0; i < 90; i++) {
    const px = hash(i * 1.9 + 3) * S, py = hash(i * 2.7 + 5) * S, l = (6 + hash(i * 4.1) * 16) * U;
    x.lineWidth = (1 + hash(i * 5.3) * 1.6) * U;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { x.beginPath(); x.moveTo(px + ox, py + oy); x.lineTo(px + ox + l, py + oy - l * .5); x.stroke(); }
  }
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  const p = G0.createPattern(c, 'repeat'); hatchC.set(key, p); return p;
}

// ---------- geometry ----------
const REC = { beginPath() {}, moveTo() {}, lineTo() {}, closePath() {} };
function polyOf(p) { const pts = []; pathPrim(REC, p, (x, y) => { pts.push([x, y]); return [x, y]; }); return pts; }
function resample(pts, step, closed) {
  const out = [], n = pts.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n], d = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(d / step));
    for (let j = 0; j < m; j++) out.push([a[0] + (b[0] - a[0]) * j / m, a[1] + (b[1] - a[1]) * j / m]);
  }
  if (!closed && n) out.push(pts[n - 1]);
  return out;
}
function wobble(pts, amp, seed, wave) {           // low-frequency hand wobble along the arc length
  let s = 0;
  return pts.map((p, i) => { if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); const u = s / wave + seed;
    return [p[0] + (vnoise(u) - .5) * 2 * amp, p[1] + (vnoise(u + 57.3) - .5) * 2 * amp]; });
}
function addPath(x, pts) { pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); }
function trace(x, pts, closed) { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); if (closed) x.closePath(); }
function bboxOf(pts) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of pts) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; }
function hashStr(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; }

// a crayon line: a firm pass and a thinner streaky pass on a slightly different path
function crayonLine(x, pts, col, w, seed, alpha = 1, closed = false) {
  const base = resample(pts, 12 * U, closed);
  let a = wobble(base, .9 * U, seed, 40 * U);
  if (closed && a.length > 3) { const ov = Math.max(2, Math.round(a.length * .07)); a = [...a, ...a.slice(0, ov).map(([p, q]) => [p + (hash(seed) - .5) * 3 * U, q + (hash(seed + 1) - .5) * 3 * U])]; }
  x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = col;
  x.globalAlpha = alpha * .95; x.lineWidth = w; trace(x, a, false); x.stroke();
  const b = wobble(a, .8 * U, seed + 9.1, 23 * U);
  x.globalAlpha = alpha * .45; x.lineWidth = w * .5; trace(x, b.map(([p, q]) => [p + w * .18, q - w * .14]), false); x.stroke();
  x.globalAlpha = 1;
}

// hatched crayon fill of a polygon (under-layer + hatching), pattern anchored to the page with a seeded offset
function crayonFill(x, pts, col, under, hatchA, ox = 0, oy = 0) {
  trace(x, pts, true);
  x.globalAlpha = under; x.fillStyle = col; x.fill();
  const pat = hatchTile(col); pat.setTransform(new DOMMatrix([1, 0, 0, 1, ox, oy]));
  x.globalAlpha = hatchA; x.fillStyle = pat; x.fill(); x.globalAlpha = 1;
}

function paperFill(g, pts, closed = true) {        // knock-out: restore blank paper (screen-aligned tooth)
  const pat = paperPat; pat.setTransform(g.getTransform().inverse());
  g.fillStyle = pat; trace(g, pts, closed); g.fill();
}

function pitsOut(x, level, x0, y0, x1, y1) {       // erase wax from the pits of the tooth
  x.globalCompositeOperation = 'destination-out'; x.globalAlpha = 1; x.fillStyle = pits[level];
  x.fillRect(x0, y0, x1 - x0, y1 - y0); x.globalCompositeOperation = 'source-over';
}

// ---------- the painter for one group of primitives ----------
function paint(R, prims, m, info) {
  const { g, W, H } = R, T = g.getTransform(), k = Math.floor(R.tq * 12);
  const kind = info.kind, isPlace = kind === 'place', far = isPlace && info.plane === 'far';
  const P = PRESS[isPlace ? (far ? 'far' : 'mid') : kind === 'char' ? 'char' : kind === 'product' ? 'product' : 'prop'];
  const kh = hashStr(info.key), boil = isPlace ? .6 : 1, bk = k * 13.7;
  const items = [], late = [];
  let B = [1e9, 1e9, -1e9, -1e9];
  for (const [i, p] of prims.entries()) {
    const col = m[p.m] || m.ink;
    if (p.s === 'text' || p.flat) { late.push({ p, i, col }); continue; }
    const raw = polyOf(p), bb = bboxOf(raw), pad = (p.w || 0) + 16 * U;
    B = [Math.min(B[0], bb[0] - pad), Math.min(B[1], bb[1] - pad), Math.max(B[2], bb[2] + pad), Math.max(B[3], bb[3] + pad)];
    items.push({ p, i, raw, bb, col });
  }
  // screen rect of the group
  const sx0 = Math.max(0, Math.floor(T.a * B[0] + T.e)), sy0 = Math.max(0, Math.floor(T.d * B[1] + T.f));
  const sx1 = Math.min(W, Math.ceil(T.a * B[2] + T.e)), sy1 = Math.min(H, Math.ceil(T.d * B[3] + T.f));
  if (items.length && sx1 > sx0 && sy1 > sy0) {
    // 1 · keep the paper white under the figure (and a thin halo around it, coloured round by a careful child)
    const shapes = items.map(it => {
      const sz = Math.max(it.bb[2] - it.bb[0], it.bb[3] - it.bb[1]), small = clamp(sz / (60 * U), .25, 1);
      const pts = it.p.s === 'stroke' ? it.raw : sz < 40 * U ? it.raw : wobble(resample(it.raw, 16 * U, true), 1.3 * U * small, kh * .37 + it.i * 3.1, 70 * U);
      return { ...it, sz, small, pts };
    });
    // 1 · keep the paper white round the figure: a thin halo, coloured round by a careful child
    g.save(); paperPat.setTransform(T.inverse());
    if (!isPlace) { g.strokeStyle = paperPat; g.lineJoin = 'round'; g.lineWidth = 7 * U; g.beginPath(); for (const s of shapes) if (s.p.s !== 'stroke' && s.sz > 30 * U) addPath(g, s.pts); g.stroke(); }
    // 2 · colour piece by piece straight onto the page: blank out what is behind, hatch with a slip, outline
    const hox = (kh * 7 % S) + (isPlace ? 0 : hash(k * 1.3 + kh) * 5 * U), hoy = (kh * 13 % S) + (isPlace ? 0 : hash(k * 2.7 + kh) * 5 * U);
    let maxLw = 0;
    for (const s of shapes) {
      const { p, col } = s;
      if (!isColor(col)) continue;
      if (p.s === 'stroke') { crayonLine(g, p.pts, mix(col, dark(col), .45), Math.max(2 * U, (p.w || 3) * .62), kh + s.i * 1.9 + (isPlace ? 0 : bk * .1), 1); maxLw = Math.max(maxLw, p.w || 3); continue; }
      const minDim = Math.min(s.bb[2] - s.bb[0], s.bb[3] - s.bb[1]), lw = P.lw * U * clamp(s.sz / (90 * U), .4, 1);
      if (!far) { paperPat.setTransform(T.inverse()); g.fillStyle = paperPat; trace(g, s.pts, true); g.fill(); }
      const sl = P.slip * U * s.small, ang = hash(s.i * 3.1 + kh) * Math.PI * 2;
      const tiny = s.sz < 40 * U, dx = Math.cos(ang) * sl, dy = Math.sin(ang) * sl;
      const fillPts = tiny ? s.pts.map(([a, b]) => [a + dx, b + dy]) : wobble(s.pts, 1.2 * U * s.small, s.i * 5.7 + kh + (isPlace ? 0 : bk * .02), 50 * U).map(([a, b]) => [a + dx, b + dy]);
      crayonFill(g, fillPts, col, minDim < lw * 3 ? .95 : P.under, P.hatch, hox, hoy);
      if (minDim >= lw * 2.2) {
        maxLw = Math.max(maxLw, lw);
        if (tiny) { g.strokeStyle = dark(col); g.lineWidth = lw * .8; g.lineJoin = 'round'; trace(g, wobble(s.pts, .6 * U, s.i + bk * .03, 14 * U), true); g.stroke(); }
        else crayonLine(g, s.pts, dark(col), lw, kh * .1 + s.i * 2.3 + (isPlace ? (k % 4) * .6 : bk * .03), 1, true);
      }
    }
    // 3 · the wax misses the pits of the tooth: paper shows through them (anchored to the page)
    const pp = pitsPaper[P.pits]; pp.setTransform(new DOMMatrix()); g.globalAlpha = 1;
    if (far) { g.fillStyle = pp; g.fillRect(B[0], B[1], B[2] - B[0], B[3] - B[1]); }
    else {
      g.fillStyle = pp; g.strokeStyle = pp; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); for (const s of shapes) if (s.p.s !== 'stroke') addPath(g, s.pts); g.fill();
      g.lineWidth = maxLw * 1.6 + 12 * U; g.stroke();
      g.beginPath(); for (const s of shapes) if (s.p.s === 'stroke') { s.p.pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); }
      g.lineWidth = maxLw * 1.6 + 4 * U; g.stroke();
    }
    g.restore();
  }
  // 4 · faces and labels go on last, pressed hard
  for (const { p, i, col } of late) {
    if (!isColor(col)) continue;
    g.save();
    if (p.s === 'text') { letterPrim(g, p, col); g.restore(); continue; }
    if (p.s === 'stroke') { crayonLine(g, p.pts, col, Math.max(2 * U, (p.w || 3) * 1.05), kh + i + bk * .05, 1); g.restore(); continue; }
    const pts = wobble(resample(polyOf(p), 5 * U, true), .5 * U, i * 2.1 + bk * .05, 20 * U);
    if (p.m === 'cheek') { crayonFill(g, pts, col, .38, .8, (hash(k + i) * S) | 0, 0); g.restore(); continue; }
    trace(g, pts, true); g.fillStyle = col; g.fill();
    if (p.m === 'white') { g.lineWidth = 2 * U; g.strokeStyle = LINE; g.stroke(); }
    if (p.s === 'ellipse' && p.m === 'ink' && p.rx > 4 * U) { g.fillStyle = '#FFFDF6'; g.beginPath(); g.ellipse(p.x - p.rx * .3, p.y - p.ry * .35, p.rx * .32, p.rx * .32, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
}

function letterPrim(g, p, col) {   // a product label or prop word, lettered by hand
  let size = p.size; g.font = `700 ${size}px "Gaegu"`;
  const tw = g.measureText(p.text).width; if (tw > p.w) { size *= p.w / tw; g.font = `700 ${size}px "Gaegu"`; }
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = size * .05; g.lineJoin = 'round'; g.textAlign = p.align || 'center'; g.textBaseline = 'alphabetic';
  g.translate(p.x, p.y + size * .06); if (p.rot) g.rotate(p.rot);
  g.strokeText(p.text, 0, 0); g.fillText(p.text, 0, 0);
}

// ---------- hand lettering ----------
function ragged(x0, y0, x1, y1, seed, amp) {      // a hand-torn patch of blank paper
  const pts = [], st = 22 * U, r = Math.min(26 * U, (y1 - y0) * .3);
  const edge = (ax, ay, bx, by) => { const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / st)); for (let i = 0; i < n; i++) pts.push([ax + (bx - ax) * i / n, ay + (by - ay) * i / n]); };
  edge(x0 + r, y0, x1 - r, y0); edge(x1 - r, y0, x1, y0 + r); edge(x1, y0 + r, x1, y1 - r); edge(x1, y1 - r, x1 - r, y1);
  edge(x1 - r, y1, x0 + r, y1); edge(x0 + r, y1, x0, y1 - r); edge(x0, y1 - r, x0, y0 + r); edge(x0, y0 + r, x0 + r, y0);
  return pts.map(([a, b], i) => [a + (hash(seed + i * 1.37) - .5) * amp, b + (hash(seed + i * 2.11 + 9) - .5) * amp]);
}

function glyphs(x, lay, shown, k, col, opt = {}) {
  const sz = lay.size; let c = 0;
  x.font = `${lay.font.weight} ${sz}px ${lay.font.family}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  for (const [li, ln] of lay.lines.entries()) {
    // advance glyph by glyph (no ligatures: each letter is its own drawing)
    const adv = [...ln.text].map(ch => x.measureText(ch).width), tw = adv.reduce((a, b) => a + b, 0);
    const x0 = lay.align === 'center' ? ln.x - tw / 2 : lay.align === 'right' ? ln.x - tw : ln.x;
    for (let i = 0, px = x0; i < ln.text.length; px += adv[i], i++, c++) {
      if (c >= shown) return;
      const ch = ln.text[i]; if (ch === ' ') continue;
      const cx = px + adv[i] / 2;
      const rot = (hash(c * 1.31 + li * 7) - .5) * (opt.tilt ?? .09) + (hash(c * 3.7 + k * 1.9) - .5) * .025;
      const dy = (hash(c * 2.13 + li) - .5) * sz * .05 + (hash(c + k * 4.1) - .5) * sz * .012;
      x.save(); x.translate(cx, ln.y + dy); x.rotate(rot);
      if (opt.fill) { x.fillStyle = opt.fill; x.globalAlpha = .9; x.fillText(ch, 0, 0); x.fillStyle = opt.hatch; x.globalAlpha = 1; x.fillText(ch, 0, 0); }
      if (opt.outline) { x.strokeStyle = opt.outline; x.lineWidth = opt.ow; x.lineJoin = 'round'; x.globalAlpha = .95; x.strokeText(ch, 0, 0); }
      if (!opt.fill) {
        x.fillStyle = col; x.strokeStyle = col; x.lineJoin = 'round'; x.lineWidth = sz * (opt.thick ?? .035); x.globalAlpha = 1; x.strokeText(ch, 0, 0); x.fillText(ch, 0, 0);
        x.globalAlpha = .3; x.fillText(ch, sz * .018, sz * .012);
      }
      x.restore();
    }
  }
}

function charCount(lay) { return lay.lines.reduce((s, l) => s + l.text.length, 0); }

// ---------- the style ----------
const style = {
  id: 'ad-crayon-book', onTwos: true,
  fontFaces: ['700 40px "Gaegu"', '400 40px "Patrick Hand"'],
  defaultCast: {},
  palette: (time, over) => ({ ...COMMON, ...(PAL[time] || PAL.day), ...over }),
  font: role => role === 'sub' || role === 'small' || role === 'label'
    ? { family: '"Patrick Hand"', weight: 400, lh: 1.08 }
    : { family: '"Gaegu"', weight: 700, lh: .92 },

  setup(R) {
    const { W, H } = R; U = Math.min(W, H) / 1080; S = 2 * Math.round(160 * U); G0 = R.g;
    [tmp, tx] = canvas(W, H);
    const TT = 768, tooth = buildTooth(TT), pt = paperTile(tooth, TT);
    SORTED = null;
    for (const [k, f] of Object.entries(PIT_FRAC)) { pits[k] = R.g.createPattern(maskTile(tooth, TT, f), 'repeat'); pitsPaper[k] = R.g.createPattern(maskTile(tooth, TT, f, pt), 'repeat'); }
    paperPat = R.g.createPattern(pt, 'repeat');
    // page mottling + a warm lamp-like vignette, multiplied over the finished frame
    const [mc, mx] = canvas(W, H), [lc, lx] = canvas(24, Math.round(24 * H / W)), d = lx.createImageData(lc.width, lc.height);
    for (let i = 0; i < lc.width * lc.height; i++) { const v = 248 + (hash(i * 1.7) - .5) * 10; d.data[i * 4] = v; d.data[i * 4 + 1] = v - 1; d.data[i * 4 + 2] = v - 4; d.data[i * 4 + 3] = 255; }
    lx.putImageData(d, 0, 0); mx.imageSmoothingQuality = 'high'; mx.drawImage(lc, 0, 0, W, H);
    const v = mx.createRadialGradient(W / 2, H * .46, Math.min(W, H) * .42, W / 2, H * .5, Math.hypot(W, H) * .62);
    v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(214,190,160,.55)');
    mx.fillStyle = v; mx.fillRect(0, 0, W, H); mottle = mc;
  },

  scene(R, s) {
    const { g, W, H } = R;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); paperPat.setTransform(new DOMMatrix()); g.fillStyle = paperPat; g.fillRect(0, 0, W, H); g.restore();
    drawScene(R, s, paint, { glow: rays });
  },

  text(R, lay, lt) {
    const { g, W, H } = R, k = Math.floor(R.tq * 12), role = lay.role, m = R.mats('place', null, R.time), L = lay.layer;
    const n = charCount(lay), wd = clamp(n * .03, .2, .6), shown = lt >= wd ? n : Math.floor(n * lt / wd) + 1;
    const [bx0, by0, bx1, by1] = lay.box, sz = lay.size, seed = hashStr(L.id || L.text);
    const ink = L.color || m.textInk;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const padX = sz * (role === 'logo' ? .3 : .34), padY = sz * (role === 'logo' ? .12 : .2);
    const rx0 = bx0 - padX, ry0 = by0 - padY, rx1 = bx1 + padX, ry1 = by1 + padY * 1.1;
    const patch = L.bg ?? role !== 'logo';
    if (patch) {
      const pp = ragged(rx0, ry0, rx1, ry1, seed, 7 * U);
      paperFill(g, pp);
      if (role === 'cta') {
        const band = ragged(rx0 + padX * .3, ry0 + padY * .55, rx1 - padX * .3, ry1 - padY * .5, seed + 3, 9 * U);
        crayonFill(g, band, L.bgColor || m.accent2, .75, 1, 0, 0);
      } else if (role === 'hook' || role === 'card' || role === 'price') {
        crayonLine(g, pp, mix(ink, PAPER, .35), 2.6 * U, seed * .1 + (k % 3) * .4, .8, true);
        if (role === 'hook' && shown >= n) {   // a quick coral swash under the last line
          const ll = lay.lines[lay.lines.length - 1], w = Math.min(ll.w, bx1 - bx0) * .8, cx = lay.align === 'center' ? ll.x : lay.align === 'right' ? ll.x - ll.w / 2 : ll.x + ll.w / 2, y = ll.y + sz * .14, sw = [];
          for (let i = 0; i <= 10; i++) sw.push([cx - w / 2 + w * i / 10, y + Math.sin(i * .9) * sz * .03 + i * sz * -.006]);
          crayonLine(g, sw, L.accent || m.accent, sz * .075, seed + k * .3, .9);
        }
      }
    }
    // the letters, in their own wax sheet so the tooth shows through them lightly
    const sx0 = Math.max(0, Math.floor(rx0 - 20 * U)), sy0 = Math.max(0, Math.floor(ry0 - 20 * U)), sx1 = Math.min(W, Math.ceil(rx1 + 20 * U)), sy1 = Math.min(H, Math.ceil(ry1 + 20 * U));
    tx.setTransform(1, 0, 0, 1, 0, 0); tx.clearRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    if (role === 'logo') {
      const col = L.color || R.bible.product?.colors?.body || m.accent, pat = hatchTile(col); pat.setTransform(new DOMMatrix());
      glyphs(tx, lay, shown, k, col, { fill: col, hatch: pat, outline: dark(col), ow: sz * .045, tilt: .07 });
      pitsOut(tx, 'prop', sx0, sy0, sx1, sy1);
    } else {
      glyphs(tx, lay, shown, k, ink, { thick: role === 'sub' || role === 'small' || role === 'label' ? .02 : .035 });
      pitsOut(tx, 'text', sx0, sy0, sx1, sy1);
    }
    g.drawImage(tmp, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
    g.restore();
  },

  caption(R, text, box) {
    const { g, W, H } = R, k = Math.floor(R.tq * 12), f = { family: '"Patrick Hand"', weight: 400 };
    const size = box.size * 1.04, lines = captionLines(g, text, f, size, box.w), lh = size * 1.1;
    const widest = Math.max(...lines.map(l => g.measureText(l).width)), h = lh * lines.length, padX = size * .5, padY = size * .28;
    const cue = (R.cues || []).find(c => c.text === text && R.t >= c.t0 && R.t < c.t1), lt = cue ? R.tq - cue.t0 : 9;
    const n = text.length, wd = clamp(n * .012, .2, .35), shown = lt >= wd ? n : Math.floor(n * Math.max(0, lt) / wd) + 1;
    const x0 = box.cx - widest / 2 - padX, x1 = box.cx + widest / 2 + padX, y0 = box.cy - h / 2 - padY, y1 = box.cy + h / 2 + padY;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    paperFill(g, ragged(x0, y0, x1, y1, hashStr(text), 6 * U));
    const lay = { size, font: f, align: 'center', lines: lines.map((t, i) => ({ text: t, w: (g.font = `400 ${size}px ${f.family}`, g.measureText(t).width), x: box.cx, y: box.cy - h / 2 + lh * (i + .5) + size * .33 })) };
    const sx0 = Math.max(0, Math.floor(x0)), sy0 = Math.max(0, Math.floor(y0)), sx1 = Math.min(W, Math.ceil(x1)), sy1 = Math.min(H, Math.ceil(y1));
    tx.setTransform(1, 0, 0, 1, 0, 0); tx.clearRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    glyphs(tx, lay, shown, k, LINE, { thick: .022, tilt: .06 });
    pitsOut(tx, 'text', sx0, sy0, sx1, sy1);
    g.drawImage(tmp, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
    g.restore();
  },

  // no dissolves: a page turn, a scribbled iris, or the new page coloured in stroke by stroke
  transition(R, kind, p) {
    const { g, W, H } = R, m = R.mats('place', null, R.time), q = eo(p);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); paperPat.setTransform(new DOMMatrix());
    if (kind === 'wipe' || kind === 'slide') {
      const x = lerp(.12, 1.25, q) * W, cl = W * .08 * (1 - q * .5);
      const sh = g.createLinearGradient(x - W * .06, 0, x, 0); sh.addColorStop(0, 'rgba(60,40,30,0)'); sh.addColorStop(1, 'rgba(60,40,30,.28)');
      g.fillStyle = sh; g.fillRect(x - W * .06, 0, W * .06, H);
      g.fillStyle = paperPat; g.beginPath(); g.moveTo(x, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(x + cl, H); g.closePath(); g.fill();
      const cu = g.createLinearGradient(x, 0, x + cl, 0); cu.addColorStop(0, 'rgba(255,255,255,.5)'); cu.addColorStop(1, 'rgba(120,90,60,.18)');
      g.fillStyle = cu; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + cl * .35, 0); g.lineTo(x + cl, H); g.lineTo(x + cl * .6, H); g.closePath(); g.fill();
    } else if (kind === 'iris') {
      const r = Math.hypot(W, H) * .6 * q, cx = W / 2, cy = H * .45, pts = [];
      for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, rr = r * (1 + (hash(i * 3.3) - .5) * .06); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
      g.fillStyle = paperPat; g.beginPath(); g.rect(0, 0, W, H); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.fill('evenodd');
      if (r > 2) crayonLine(g, pts, m.accent, 6 * U, 3, 1, true);
    } else {
      // a blank sheet over the new page, scribbled away in back-and-forth crayon rows (the page gets coloured in)
      const rows = 6, rh = H / rows, pts = [];
      for (let r = 0; r <= rows; r++) { const y = rh * (r + .1), l2r = r % 2 === 0; for (let i = 0; i <= 8; i++) { const u = l2r ? i / 8 : 1 - i / 8; pts.push([lerp(-.1, 1.1, u) * W, y + rh * .5 * (i / 8) + (hash(r * 9 + i) - .5) * rh * .12]); } }
      const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const tot = L[L.length - 1] * Math.min(1, .1 + p * 1.05), part = [pts[0]];
      for (let i = 1; i < pts.length && L[i - 1] < tot; i++) { const f = Math.min(1, (tot - L[i - 1]) / (L[i] - L[i - 1])); part.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); }
      tx.setTransform(1, 0, 0, 1, 0, 0); tx.clearRect(0, 0, W, H); tx.fillStyle = paperPat; tx.fillRect(0, 0, W, H);
      tx.globalCompositeOperation = 'destination-out'; tx.lineCap = 'round'; tx.lineJoin = 'round'; tx.lineWidth = rh * 1.7;
      trace(tx, wobble(resample(part, 30 * U, false), 10 * U, 4, 120 * U), false); tx.stroke();
      tx.globalCompositeOperation = 'source-over';
      g.drawImage(tmp, 0, 0);
    }
    g.restore();
  },

  post(R) {
    const { g, W, H } = R;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.drawImage(mottle, 0, 0, W, H); g.restore();
  },
};

// the reveal: crayon sun-rays scribbled in behind the product
function rays(R, p, prims) {
  const { g, W, H } = R, m = R.mats('place', null, R.time), xs = [], ys = [];
  for (const q of prims) { if (q.pts) for (const v of q.pts) { xs.push(v[0]); ys.push(v[1]); } else if (q.x !== undefined) { xs.push(q.x); ys.push(q.y); } }
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, r = Math.max(W, H) * .75 * p.a.glow, k = Math.floor(R.tq * 12);
  const col = m.accent2, n = 12;
  g.save(); g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + k * .004, w = Math.PI / n * .62, pts = [[cx, cy]];
    for (let j = 0; j <= 6; j++) { const b = a - w / 2 + w * j / 6, rr = r * (.92 + hash(i * 5 + j) * .08); pts.push([cx + Math.cos(b) * rr, cy + Math.sin(b) * rr]); }
    addPath(g, pts);
  }
  g.globalAlpha = .3 * p.a.glow; g.fillStyle = col; g.fill();
  const pat = hatchTile(col); pat.setTransform(new DOMMatrix()); g.globalAlpha = .75 * p.a.glow; g.fillStyle = pat; g.fill();
  g.restore();
}

export default style;
