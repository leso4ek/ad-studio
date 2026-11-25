// Ad style "Sitcom Toon" (ad-scifi-toon): adult-animation sitcom cartoon grammar. Thick, even, boiling dark outlines
// (constant width on screen, three boil drawings cycled on twos), flat fills with one hard-edged cel shadow, big white
// eyes with tiny pupils and tired lids, slightly dirty suburban colour, and sparing sci-fi gadget accents (a mint glow,
// zaps and glints) that turn an everyday product into a gadget. Original; see styles/ad-scifi-toon/STYLE.md.
import { primText } from '../draw2d.js';
import { drawScene, captionLines, transition } from './style2d.js';
import { hash, lerp, seg, eo, clamp } from '/core/lib.js';

const INK = '#2A1A35', EYE = '#FFFDF2', GLOW = '#62F0D4', GLOW2 = '#C9FFF2';
const PAL = {
  day:  { wall: '#EACB86', wall2: '#93C4B3', floor: '#9277A8', floor2: '#7A6194', wood: '#C0704C', sky: '#7CC6E0', sky2: '#C3E6D6', glass: '#A9D8E3', metal: '#B9B8AC',
          plant: '#86B847', plant2: '#57903A', sun: '#FFD44F', moon: '#F4EBC4', cloud: '#FFFBEC', building: '#E0866A', building2: '#C9A97F', windowLit: '#FFE69A', ground: '#86AE4E', path: '#DCC79C' },
  dusk: { wall: '#E3A774', wall2: '#7FA9A3', floor: '#6F5689', floor2: '#5C4676', wood: '#A2573D', sky: '#F0895C', sky2: '#F6C27A', glass: '#E6AE8A', metal: '#A39C98',
          plant: '#6F9E3E', plant2: '#4A7A33', sun: '#FFC94A', moon: '#F4EBC4', cloud: '#FADBC2', building: '#B05A50', building2: '#97736B', windowLit: '#FFD884', ground: '#6A8A45', path: '#C4A27C' },
  night:{ wall: '#5B6799', wall2: '#46708A', floor: '#3E3560', floor2: '#332B50', wood: '#5B3B48', sky: '#1F2756', sky2: '#33407A', glass: '#3D5687', metal: '#6B7090',
          plant: '#4C7A47', plant2: '#386038', sun: '#FFC94A', moon: '#F6EEC9', cloud: '#5F6E9E', building: '#36406A', building2: '#2D3557', windowLit: '#FFD36E', ground: '#2F4A40', path: '#555A7E' },
};
const COMMON = { skin: '#F2B48C', hair: '#3B2A22', hairInk: INK, top: '#5FA8C9', bottom: '#5B4E7A', shoe: '#3A2A2A', ink: INK, white: EYE, cheek: '#E58B78',
  propA: '#E9824E', propB: '#4F9DB0', accent: '#E8573F', accent2: '#FFD23F', screen: '#2B3350', textInk: INK, textBg: '#FFF4DC', custom: '#E8573F', label: '#FFF6E5', labelInk: INK };

// ---------- helpers ----------
const rgb = h => { h = String(h).replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => { if (!/^#/.test(a) || !/^#/.test(b)) return a; const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const shade = c => mix(c, '#2E1A4F', .3);      // the single cel shadow tone: darker and a little purple
const hashStr = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; };
const PH = [[0, 1.3, 2.2], [2.1, 4.2, .4], [4.4, .7, 3.6]];   // three boil drawings

let U = 1080, LW = 7, BOIL = 1.6, F = .07, drawing = 0;

function lwNow(g, w) { const m = g.getTransform(); return w / (Math.hypot(m.a, m.b) || 1); }

// a smooth displacement field in screen space: shared edges boil together; plus a fixed "off-model" wobble
function boil(x, y, amp, ph) {
  const a = Math.sin(x * F + y * F * .71 + ph[0]) + .5 * Math.sin(y * F * 2.3 - x * F * 1.7 + ph[1]);
  const b = Math.sin(y * F * 1.13 - x * F * .53 + ph[1]) + .5 * Math.sin(x * F * 2.1 + y * F * 1.9 + ph[2]);
  const o = .6 * Math.sin(x * F * .6 + 1.7) + .6 * Math.cos(y * F * .55 + .3);
  return [x + amp * (a + o * .5), y + amp * (b - o * .5)];
}

function rawPts(p) {
  const pts = [];
  if (p.s === 'ellipse') {
    const per = Math.PI * (p.rx + p.ry), n = clamp(Math.round(per / (U * .012)), 14, 140), c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, ex = Math.cos(a) * p.rx, ey = Math.sin(a) * p.ry; pts.push([p.x + ex * c - ey * s, p.y + ex * s + ey * c]); }
    return { pts, closed: true, dense: true };
  }
  if (p.s === 'rrect') {
    const r = Math.min(p.r || 0, p.w / 2, p.h / 2), x0 = -p.w / 2, y0 = -p.h / 2, x1 = p.w / 2, y1 = p.h / 2, loc = [];
    const corner = (cx, cy, a0) => { const n = r > 0 ? clamp(Math.round(r / (U * .008)), 2, 10) : 0; for (let i = 0; i <= n; i++) { const a = a0 + i / Math.max(1, n) * Math.PI / 2; loc.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
    corner(x1 - r, y1 - r, 0); corner(x0 + r, y1 - r, Math.PI / 2); corner(x0 + r, y0 + r, Math.PI); corner(x1 - r, y0 + r, Math.PI * 1.5);
    const c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0);
    for (const [px, py] of loc) pts.push([p.x + px * c - py * s, p.y + px * s + py * c]);
    return { pts, closed: true };
  }
  if (p.s === 'cap') {
    const a = Math.atan2(p.y2 - p.y1, p.x2 - p.x1), n = 10;
    for (let i = 0; i <= n; i++) { const b = a + Math.PI / 2 + i / n * Math.PI; pts.push([p.x1 + Math.cos(b) * p.r, p.y1 + Math.sin(b) * p.r]); }
    for (let i = 0; i <= n; i++) { const b = a - Math.PI / 2 + i / n * Math.PI; pts.push([p.x2 + Math.cos(b) * p.r, p.y2 + Math.sin(b) * p.r]); }
    return { pts, closed: true };
  }
  if (p.s === 'poly') return { pts: p.pts.slice(), closed: true };
  if (p.s === 'stroke') return { pts: p.pts.slice(), closed: false };
  return null;
}

// resample every edge to ~step px, then push each point through the boil field
function boiled(p, amp, ph, step = U * .011) {
  const r = rawPts(p); if (!r) return null;
  const src = r.pts, out = [], n = src.length, m = r.closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const [ax, ay] = src[i], [bx, by] = src[(i + 1) % n], k = r.dense ? 1 : Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let j = 0; j < k; j++) out.push(boil(ax + (bx - ax) * j / k, ay + (by - ay) * j / k, amp, ph));
  }
  if (!r.closed) out.push(boil(...src[n - 1], amp, ph));
  return { pts: out, closed: r.closed };
}
function trace(g, b) { g.beginPath(); b.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); if (b.closed) g.closePath(); }
function size(p) {
  if (p.s === 'ellipse') return Math.min(p.rx, p.ry) * 2;
  if (p.s === 'rrect') return Math.min(p.w, p.h);
  if (p.s === 'cap') return p.r * 2;
  if (p.pts) { const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]); return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); }
  return U * .05;
}

// ---------- the style ----------
const style = {
  id: 'ad-scifi-toon', onTwos: true,
  fontFaces: ['400 40px "Archivo Black"', '800 40px "Baloo 2"', '700 40px "Space Mono"'],
  defaultCast: {},
  palette: (time, over) => ({ ...COMMON, ...(PAL[time] || PAL.day), ...over }),
  font: role => role === 'hook' || role === 'card' || role === 'logo' || role === 'price'
    ? { family: '"Archivo Black"', weight: 400, lh: 1.04 }
    : { family: '"Baloo 2"', weight: 800, lh: 1.0 },
  setup(R) { U = Math.min(R.W, R.H); LW = U * .0068; BOIL = U * .0013; F = Math.PI * 2 / (U * .11); },

  scene(R, s) {
    drawing = Math.floor(R.tq * 12 + 1e-6) % 3;
    drawScene(R, s, paint, { glow: (R2, p, prims) => gadgetGlow(R2, p, prims) });
  },

  text(R, lay, lt) {
    const { g } = R, m = R.mats('place', null, R.time), role = lay.role;
    const ph = PH[drawing], k = hashStr(lay.layer.id || lay.lines[0]?.text);
    const [x0, y0, x1, y1] = lay.box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const tilt = lay.layer.rot ?? (role === 'hook' ? -.035 : role === 'card' ? (hash(k) - .5) * .05 : role === 'logo' ? -.03 : 0);
    // pop-in on twos with a little overshoot, then hold dead still (only the panel line boils)
    const pin = role === 'hook' || role === 'card' || role === 'cta' ? clamp(lt / .25, 0, 1) : 1, sc = pin < 1 ? lerp(.7, 1.06, eo(pin)) : 1;
    g.save(); g.translate(cx, cy); g.rotate(tilt); g.scale(sc, sc); g.translate(-cx, -cy);
    g.font = `${lay.font.weight} ${lay.size}px ${lay.font.family}`; g.textAlign = lay.align; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    const panel = lay.layer.bg ?? (role === 'card' || role === 'cta');
    if (panel) {
      const padX = lay.size * .42, padY = lay.size * .3;
      const P = { s: 'rrect', x: cx, y: cy + lay.size * .02, w: x1 - x0 + padX * 2, h: y1 - y0 + padY * 2, r: role === 'cta' ? (y1 - y0 + padY * 2) / 2 : lay.size * .32 };
      const b = boiled(P, BOIL * .8, ph);
      const fill = lay.layer.bgColor || (role === 'cta' ? m.accent2 : m.textBg);
      g.save(); g.translate(U * .009, U * .011); trace(g, b); g.fillStyle = INK; g.fill(); g.restore();   // hard offset shadow
      trace(g, b); g.fillStyle = fill; g.fill(); g.lineWidth = LW * 1.15; g.strokeStyle = INK; g.stroke();
      if (role === 'card') led(g, P.x + P.w / 2 - lay.size * .28, P.y - P.h / 2 + lay.size * .28, lay.size * .08);
    }
    for (const ln of lay.lines) {
      if (role === 'hook' || role === 'logo') {
        const face = lay.layer.color || (role === 'logo' ? (R.bible.product?.colors?.body || m.accent) : m.accent2);
        const sh = role === 'logo' ? m.accent2 : m.accent, o = lay.size * .075;
        g.lineWidth = lay.size * .2; g.strokeStyle = INK; g.strokeText(ln.text, ln.x + o, ln.y + o);
        g.fillStyle = sh; g.fillText(ln.text, ln.x + o, ln.y + o);
        g.strokeText(ln.text, ln.x, ln.y); g.fillStyle = face; g.fillText(ln.text, ln.x, ln.y);
        // a single hard highlight sliver inside the top of the letters
        g.save(); g.beginPath(); g.rect(ln.x - lay.size * 20, ln.y - lay.size * .78, lay.size * 40, lay.size * .12); g.clip();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(ln.text, ln.x, ln.y); g.restore();
      } else if (panel) {
        g.fillStyle = lay.layer.color || INK; g.fillText(ln.text, ln.x, ln.y);
      } else {
        g.lineWidth = lay.size * .24; g.strokeStyle = INK; g.strokeText(ln.text, ln.x, ln.y);
        g.fillStyle = lay.layer.color || EYE; g.fillText(ln.text, ln.x, ln.y);
      }
    }
    g.restore();
  },

  // cartoon-style captions: heavy rounded sans, white with a thick ink outline, no box
  caption(R, text, box) {
    const { g } = R, f = { family: '"Baloo 2"', weight: 800 }, sz = box.size * 1.08;
    const lines = captionLines(g, text, f, sz, box.w), lh = sz * 1.08, h = lh * lines.length;
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    lines.forEach((l, i) => {
      const y = box.cy - h / 2 + lh * (i + .5) + sz * .06;
      g.lineWidth = sz * .3; g.strokeStyle = INK; g.strokeText(l, box.cx + sz * .04, y + sz * .06);
      g.strokeText(l, box.cx, y); g.fillStyle = EYE; g.fillText(l, box.cx, y);
    });
    g.restore();
  },

  transition(R, kind, p) {
    if (kind === 'wipe') return zapWipe(R, p);
    if (kind === 'iris') return iris(R, p);
    if (kind === 'fade') return tvFlash(R, p);
    transition(R, kind, p, [INK]);
  },
};

function led(g, x, y, r) {
  g.save(); g.fillStyle = GLOW; g.globalAlpha = .35; g.beginPath(); g.arc(x, y, r * 2, 0, 7); g.fill();
  g.globalAlpha = 1; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.lineWidth = r * .5; g.strokeStyle = INK; g.stroke(); g.restore();
}

// ---------- painting a group ----------
function paint(R, prims, m, info) {
  const { g } = R, place = info.kind === 'place', char = info.kind === 'char';
  const ph = PH[(drawing + hashStr(info.key) % 3) % 3];
  for (const [i, p] of prims.entries()) {
    if (char && p.flat) continue;                 // faces are redrawn below in the toon way
    const col = m[p.m] || m.ink;
    if (p.s === 'text') { primText(g, p, col, '"Archivo Black"', 400); continue; }
    const sz = size(p), big = place && sz > R.H * .3;
    const lw = lwNow(g, place ? (big ? LW * .8 : LW * .7) : Math.min(LW, Math.max(LW * .4, sz * .22)));
    const amp = place ? BOIL * .7 : Math.min(BOIL, sz * .05 + BOIL * .2);
    const b = boiled(p, amp, ph);
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (p.s === 'stroke') {
      const w = p.w || 3;
      trace(g, b); g.strokeStyle = INK; g.lineWidth = w + lw * 1.6; g.stroke();
      g.strokeStyle = col; g.lineWidth = w; g.stroke();
      continue;
    }
    trace(g, b); g.fillStyle = col; g.fill();
    // one hard-edged cel shadow, away from a light up-left
    const cel = !p.flat && !(place && (big || p.m === 'sky' || p.m === 'sky2' || p.m === 'wall')) && sz > U * .012;
    if (cel) {
      const d = clamp(sz * .16, U * .003, U * .03);
      g.save(); g.clip(); g.fillStyle = shade(col); g.fill();
      g.translate(-d, -d * 1.15); trace(g, b); g.fillStyle = col; g.fill(); g.restore();
    }
    if (info.kind === 'product' && i === 0) productShine(g, p, b);
    trace(g, b); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
  }
  if (char) face(R, prims, m, info);
  if (info.kind === 'product') productFx(R, prims, info);
  if (place) decorate(R, m, info);
}

// a sharp white highlight streak on the product's main body: it reads as glossy hardware
function productShine(g, p, b) {
  if (p.s !== 'rrect' && p.s !== 'poly') return;
  const [x0, y0, x1, y1] = bounds(b.pts), w = x1 - x0, h = y1 - y0;
  g.save(); trace(g, b); g.clip(); g.fillStyle = 'rgba(255,255,255,.42)';
  g.beginPath(); g.roundRect(x0 + w * .12, y0 + h * .08, w * .09, h * .84, w * .05); g.fill();
  g.beginPath(); g.roundRect(x0 + w * .26, y0 + h * .08, w * .035, h * .5, w * .02); g.fill();
  g.restore();
}
const bounds = pts => { const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
const groupBounds = prims => bounds(prims.flatMap(q => q.pts ? q.pts : q.s === 'cap' ? [[q.x1, q.y1], [q.x2, q.y2]] : q.s === 'ellipse' ? [[q.x - q.rx, q.y - q.ry], [q.x + q.rx, q.y + q.ry]] : q.s === 'rrect' ? [[q.x - q.w / 2, q.y - q.h / 2], [q.x + q.w / 2, q.y + q.h / 2]] : [[q.x, q.y]]));

// ---------- the sitcom face: big white eyes, tiny pupils, tired lids ----------
const FACE = {
  neutral:   { lid: .4, look: [.25, .05], brows: 'flat', mouth: 'line', bags: 1 },
  happy:     { lid: .2, lower: .55, look: [.2, 0], brows: 'up', mouth: 'smile' },
  sad:       { lid: .45, slant: 1, look: [0, .6], brows: 'sad', mouth: 'frown', bags: 1 },
  tired:     { lid: .62, look: [0, .35], brows: 'sad', mouth: 'line', bags: 1 },
  surprised: { lid: 0, look: [0, 0], pupil: .75, brows: 'high', mouth: 'o' },
  point:     { lid: .32, look: [.7, 0], brows: 'up', mouth: 'smirk' },
  wave:      { lid: .2, lower: .3, look: [.2, 0], brows: 'up', mouth: 'smile' },
  think:     { lid: .38, look: [.45, -.7], brows: 'one', mouth: 'side' },
  cheer:     { lid: .08, lower: .42, look: [0, 0], brows: 'up', mouth: 'grin' },
  hold:      { lid: .34, look: [.6, .1], brows: 'flat', mouth: 'smirk', bags: 1 },
  annoyed:   { lid: .56, look: [.85, .15], brows: 'angry', mouth: 'tight', bags: 1 },
};
function face(R, prims, m, info) {
  const { g } = R, layer = info.layer || {}, a = info.a || {};
  let head = null; for (const p of prims) if (p.s === 'ellipse' && p.m === 'skin' && (!head || p.rx > head.rx)) head = p;
  if (!head) return;
  const F0 = { ...FACE.neutral, ...(FACE[layer.pose] || {}) };
  const flip = info.xf?.flip ?? 1, fx = (layer.face === 'left' ? -1 : layer.face === 'right' ? 1 : 0) * flip;
  const hr = head.rx, lw = lwNow(g, Math.min(LW, hr * .055)), thin = lw * .7;
  // twitch: on a held shot, every ~2 s the lid drops a hair for one drawing (acting, not moving)
  const k = Math.floor(R.tq * 12), twitch = hash(Math.floor(k / 3) + hashStr(layer.id)) > .9 ? .08 : 0;
  const lid = a.blink ? 1 : clamp(F0.lid + twitch, 0, 1);
  g.save(); g.translate(head.x, head.y); g.rotate(head.rot || 0);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK;
  const ecx = fx * hr * .3, ey = -hr * .02, erx = hr * .28, ery = hr * .34, pr = Math.max(U * .0032, hr * .055) * (F0.pupil || 1);
  const ph = PH[drawing];
  const W2 = (x, y) => boil(x, y, hr * .006, ph);
  for (const sd of [-1, 1]) {
    const far = fx !== 0 && sd === -fx, rx = erx * (far ? .84 : 1), ry = ery * (far ? .95 : 1);
    const ex = ecx + sd * erx * (far ? .9 : 1);
    const eyeP = () => { g.beginPath(); for (let i = 0; i < 28; i++) { const t = i / 28 * Math.PI * 2, [x, y] = W2(ex + Math.cos(t) * rx, ey + Math.sin(t) * ry); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
    eyeP(); g.fillStyle = EYE; g.fill();
    if (lid < 1) { g.fillStyle = INK; g.beginPath(); g.arc(ex + F0.look[0] * fx * rx * .5 + (fx ? 0 : F0.look[0] * 0), ey + F0.look[1] * ry * .5 + lid * ry * .3, pr, 0, 7); g.fill(); }
    g.save(); eyeP(); g.clip();
    // upper lid (skin) with a slant for sad/angry, and the lid line on its edge
    const ly = ey - ry + lid * ry * 2.02, sl = F0.brows === 'angry' ? sd * ry * .22 : F0.slant ? -sd * ry * .25 : 0;   // angry: inner corners down; sad: outer corners down
    g.fillStyle = m.skin; g.beginPath(); g.moveTo(ex - rx * 1.3, ey - ry * 1.4); g.lineTo(ex + rx * 1.3, ey - ry * 1.4); g.lineTo(ex + rx * 1.3, ly - sl); g.lineTo(ex - rx * 1.3, ly + sl); g.closePath(); g.fill();
    if (lid > .02) { g.lineWidth = lw; g.beginPath(); g.moveTo(ex - rx * 1.3, ly + sl); g.lineTo(ex + rx * 1.3, ly - sl); g.stroke(); }
    if (F0.lower && !a.blink) { g.fillStyle = m.skin; g.beginPath(); g.ellipse(ex, ey + ry * (1.9 - F0.lower * 1.6), rx * 1.4, ry, 0, 0, 7); g.fill(); g.lineWidth = lw; g.stroke(); }
    g.restore();
    eyeP(); g.lineWidth = lw; g.stroke();
    if (F0.bags) { g.lineWidth = thin; g.beginPath(); g.arc(ex, ey + ry * .55, rx * .85, Math.PI * .32, Math.PI * .68); g.stroke(); }
    // brows: short heavy strokes
    const by = ey - ry * 1.32, br = F0.brows;
    const tl = br === 'sad' ? sd * ry * .22 : br === 'angry' ? -sd * ry * .3 : br === 'one' && sd === (fx || 1) ? -ry * .25 : 0;
    const lift = br === 'high' ? -ry * .35 : br === 'up' ? -ry * .12 : 0;
    g.lineWidth = Math.max(lw * 1.5, hr * .075); g.strokeStyle = m.hairInk === INK ? mix(m.hair, INK, .4) : m.hairInk;
    g.beginPath(); g.moveTo(...W2(ex - rx * .7, by + lift - tl)); g.quadraticCurveTo(...W2(ex, by + lift - ry * .1), ...W2(ex + rx * .7, by + lift + tl)); g.stroke();
    g.strokeStyle = INK;
  }
  // nose: a small hooked line in 3/4, a tiny cup front-on
  g.lineWidth = thin;
  const nx = ecx + fx * hr * .12, ny = ey + ery * 1.22;
  g.beginPath();
  if (fx) { g.moveTo(nx - fx * hr * .05, ny - hr * .1); g.quadraticCurveTo(nx + fx * hr * .14, ny, nx - fx * hr * .02, ny + hr * .07); }
  else { g.moveTo(nx - hr * .06, ny); g.quadraticCurveTo(nx, ny + hr * .07, nx + hr * .06, ny); }
  g.stroke();
  // mouth
  const mx = fx * hr * .3, my = hr * .6, mw = hr * .26, mo = a.mouthOpen || 0;
  g.lineWidth = lw;
  const mm = F0.mouth;
  if (mo > .2 || mm === 'o' || mm === 'grin') {
    const oh = mm === 'grin' ? hr * .22 : hr * (.07 + .2 * Math.max(mo, mm === 'o' ? .6 : 0)), ow = mm === 'o' ? mw * .6 : mw;
    const shape = () => { g.beginPath(); if (mm === 'grin') { g.moveTo(mx - ow, my - oh * .2); g.quadraticCurveTo(mx, my - oh * .45, mx + ow, my - oh * .2); g.quadraticCurveTo(mx + ow * .7, my + oh, mx, my + oh); g.quadraticCurveTo(mx - ow * .7, my + oh, mx - ow, my - oh * .2); } else g.ellipse(mx, my + oh * .2, ow, oh, 0, 0, 7); g.closePath(); };
    shape(); g.fillStyle = '#4A1E33'; g.fill();
    g.save(); shape(); g.clip(); g.fillStyle = '#E07A86'; g.beginPath(); g.ellipse(mx + fx * ow * .2, my + oh * 1.05, ow * .7, oh * .55, 0, 0, 7); g.fill();
    if (mm === 'grin') { g.fillStyle = EYE; g.fillRect(mx - ow, my - oh * .5, ow * 2, oh * .42); }
    g.restore(); shape(); g.stroke();
  } else {
    g.beginPath();
    const L = [mx - mw, my], Rr = [mx + mw, my];
    if (mm === 'smile') { g.moveTo(L[0], L[1] - hr * .04); g.quadraticCurveTo(mx, my + hr * .16, Rr[0], Rr[1] - hr * .05); }
    else if (mm === 'frown') { g.moveTo(L[0] + mw * .2, L[1] + hr * .06); g.quadraticCurveTo(mx, my - hr * .08, Rr[0] - mw * .2, Rr[1] + hr * .06); }
    else if (mm === 'smirk') { g.moveTo(L[0] + mw * .15, L[1] + hr * .01); g.quadraticCurveTo(mx, my + hr * .04, Rr[0] + fx * mw * .05, Rr[1] - hr * .07); }
    else if (mm === 'side') { g.moveTo(mx + fx * mw * .1, my + hr * .02); g.quadraticCurveTo(mx + fx * mw * .6, my - hr * .02, mx + fx * mw * 1.1, my - hr * .05); }
    else if (mm === 'tight') { g.moveTo(L[0] + mw * .15, L[1] + hr * .03); g.lineTo(Rr[0] - mw * .15, Rr[1] + hr * .01); }
    else { g.moveTo(L[0] + mw * .1, L[1]); g.quadraticCurveTo(mx, my + hr * .02, Rr[0] - mw * .1, Rr[1] - hr * .01); }
    g.stroke();
    // a little corner tick sells the deadpan
    if (mm === 'tight') { g.lineWidth = thin; g.beginPath(); g.moveTo(mx + fx * mw * .85 - (fx ? 0 : mw * .85), my - hr * .03); g.lineTo(mx + fx * mw * 1.0 - (fx ? 0 : mw), my + hr * .03); g.stroke(); }
  }
  g.restore();
}

// ---------- product as a gadget ----------
function productFx(R, prims, info) {
  const { g } = R, [x0, y0, x1, y1] = groupBounds(prims), w = x1 - x0, k = Math.floor(R.tq * 12);
  // a glint "ting" on the cap every ~1.6 s, three drawings long
  const cyc = (k + hashStr(info.key)) % 19;
  if (cyc < 3) sparkle(g, x1 - w * .2, y0 + w * .12, w * (.22 + (cyc === 1 ? .1 : 0)), EYE, lwNow(g, LW * .55));
  const an = [].concat(info.layer?.anim || []).map(s => String(s).split(':')[0]);
  if (an.includes('pulse')) {
    const pz = Math.max(0, Math.sin(((info.a ? 0 : 0) + R.tq - .2) * Math.PI * 2 * .9));
    if (pz > .4) zaps(g, (x0 + x1) / 2, (y0 + y1) / 2, w * .75, (y1 - y0) * .62, 4, k, lwNow(g, LW * .6));
  }
}
function gadgetGlow(R, p, prims) {
  const { g } = R, [x0, y0, x1, y1] = groupBounds(prims), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = Math.floor(R.tq * 12);
  const s = p.a.glow, r = Math.max(x1 - x0, y1 - y0) * .62;
  g.save();
  // a jagged comic "ta-da" burst, two flat layers (no gradients, no portal), each with a boiling ink edge
  const wall = R.mats('place', null, R.time).wall, ph = PH[drawing], grow = .5 + .5 * eo(s);
  for (const [f, col, n] of [[1.5, mix(wall, '#FFF3A0', .75), 13], [1.12, mix(wall, GLOW, .62), 11]]) {
    const pts = [], rot = (k % 2) * .05 + f;
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2 + rot, rr = r * f * grow * (i % 2 ? .72 : 1) * (1 + .08 * (hash(i * 1.7 + f) - .5)); pts.push([cx + Math.cos(a) * rr * .86, cy + Math.sin(a) * rr]); }
    const b = boiled({ s: 'poly', pts }, BOIL, ph);
    g.globalAlpha = Math.min(1, s * 1.6); trace(g, b); g.fillStyle = col; g.fill();
    g.lineWidth = lwNow(g, LW * .6); g.strokeStyle = INK; g.stroke();
  }
  g.restore();
  g.save(); g.globalAlpha = s;
  zaps(g, cx, cy, r * 1.25, r * 1.3, 6, k, lwNow(g, LW * .7));
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + Math.floor(k / 2) * .35, rr = r * (1.35 + .15 * hash(i + k * .1));
    if ((k + i) % 4 !== 0) sparkle(g, cx + Math.cos(a) * rr * .8, cy + Math.sin(a) * rr, r * (.12 + .06 * hash(i * 3.3)), i % 2 ? GLOW2 : EYE, lwNow(g, LW * .55));
  }
  g.restore();
}
// four-point star with an ink outline
function sparkle(g, x, y, r, col, lw) {
  g.save(); g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .22 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); g.restore();
}
// little lightning zaps around something, redrawn each drawing
function zaps(g, cx, cy, rx, ry, n, k, lw) {
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = (i + .5) / n * Math.PI * 2 + hash(i + Math.floor(k / 2) * 7.7) * .5, len = Math.max(rx, ry) * .28;
    const sx = cx + Math.cos(a) * rx, sy = cy + Math.sin(a) * ry, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    const pts = [[sx, sy], [sx + dx * len * .4 + nx * len * .22, sy + dy * len * .4 + ny * len * .22], [sx + dx * len * .55 - nx * len * .18, sy + dy * len * .55 - ny * len * .18], [sx + dx * len, sy + dy * len]];
    g.beginPath(); pts.forEach(([x, y], j) => j ? g.lineTo(x, y) : g.moveTo(x, y));
    g.strokeStyle = INK; g.lineWidth = lw * 2.6; g.stroke(); g.strokeStyle = i % 2 ? GLOW : '#FFF08A'; g.lineWidth = lw * 1.1; g.stroke();
  }
  g.restore();
}

// ---------- places: suburban detail + one gadget ----------
function decorate(R, m, info) {
  const { g, W, H } = R, kind = R.bible.places?.[R.shot.place]?.kind || R.shot.place || 'studio';
  const fl = H * (kind === 'street' || kind === 'park' ? .74 : .7), k = Math.floor(R.tq * 12);
  const lw = lwNow(g, LW * .7), ph = PH[drawing];
  const box = (x, y, w, h, r, fill) => { const b = boiled({ s: 'rrect', x, y, w, h, r }, BOIL * .6, ph); trace(g, b); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); };
  if (info.plane === 'far' && kind !== 'street' && kind !== 'park' && kind !== 'sky') {
    if (kind === 'kitchen') {
      // backsplash tiles, cupboard knobs
      g.save(); g.globalAlpha = .28; g.strokeStyle = INK; g.lineWidth = lwNow(g, LW * .35);
      const y0 = fl - H * .2, ts = H * .033;
      for (let y = y0 + ts; y < fl - H * .01; y += ts) { g.beginPath(); g.moveTo(-W * .2, y); g.lineTo(W * 1.2, y); g.stroke(); }
      for (let x = -W * .2; x < W * 1.2; x += ts) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, fl - H * .01); g.stroke(); }
      g.restore();
      for (let i = -1; i <= 3; i++) { const x = W * (.1 + i * .28); g.fillStyle = m.metal; g.beginPath(); g.arc(x + W * .08, H * .145, U * .009, 0, 7); g.fill(); g.lineWidth = lw * .7; g.strokeStyle = INK; g.stroke(); }
    }
    if (kind === 'studio') {
      // flat colour bands low on the wall, like a TV ident backdrop, and a stepped spotlight pool on the floor
      const bands = [[.6, m.wall2, .55], [.635, m.accent2, .6], [.665, m.accent, .5]];
      for (const [y, c, al] of bands) { g.save(); g.globalAlpha = al; g.fillStyle = c; g.fillRect(-W * .2, H * y, W * 1.4, fl - H * y); g.restore(); }
      g.save(); g.strokeStyle = INK; g.lineWidth = lw * .8; for (const [y] of bands) { g.beginPath(); g.moveTo(-W * .2, H * y); g.lineTo(W * 1.2, H * y); g.stroke(); } g.restore();
      return;
    }
    // the gadget: a wall-mounted home panel with a glowing readout (a wobbling sine and a blinking dot)
    const gx = R.LANDSCAPE ? W * .2 : W * .88, gy = H * (R.LANDSCAPE ? .42 : .35), gw = U * .14, gh = U * .1;
    box(gx, gy, gw, gh, U * .018, m.metal);
    box(gx, gy - gh * .04, gw * .78, gh * .6, U * .01, m.screen);
    g.save(); g.strokeStyle = GLOW; g.lineWidth = lwNow(g, U * .004); g.beginPath();
    for (let i = 0; i <= 20; i++) { const x = gx - gw * .33 + i / 20 * gw * .66, y = gy - gh * .04 + Math.sin(i * .9 + k * .8) * gh * .12; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); g.restore();
    g.fillStyle = k % 6 < 3 ? '#FF6B4A' : '#7A3B3B'; g.beginPath(); g.arc(gx + gw * .34, gy + gh * .36, U * .006, 0, 7); g.fill();
  }
  if (info.plane === 'mid' && kind !== 'street' && kind !== 'park' && kind !== 'sky' && kind !== 'studio') {
    // lino floor: a receding checker in the shadow tone of the floor, flat fills only
    g.save(); g.beginPath(); g.rect(-W, fl + H * .012, W * 3, H); g.clip();
    g.fillStyle = m.floor2; const vx = W / 2, vy = fl - H * .5, rows = [0, .05, .11, .19, .29, .42];
    for (let r = 0; r < rows.length - 1; r++) for (let c = -12; c < 12; c++) {
      if ((r + c) % 2) continue;
      const ya = fl + H * .012 + rows[r] * H, yb = fl + H * .012 + rows[r + 1] * H, xa = t => vx + (c * W * .16) * (t - vy) / (fl - vy), xb = t => vx + ((c + 1) * W * .16) * (t - vy) / (fl - vy);
      g.beginPath(); g.moveTo(xa(ya), ya); g.lineTo(xb(ya), ya); g.lineTo(xb(yb), yb); g.lineTo(xa(yb), yb); g.fill();
    }
    g.restore();
  }
}

// end card / studio: flat colour bands like a TV station ident


// ---------- transitions (no dissolves) ----------
function zapWipe(R, p) {
  const { g, W, H } = R, x = lerp(-W * .35, W * 1.35, eo(p)), n = 9, k = Math.floor(R.t * 24);
  const edge = (dx) => { const pts = []; for (let i = 0; i <= n; i++) pts.push([x + dx + (i % 2 ? W * .07 : -W * .07) + (hash(i + k) - .5) * W * .02, i / n * H]); return pts; };
  const a = edge(0), b = edge(-W * .5);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.lineJoin = 'round';
  g.beginPath(); a.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); [...b].reverse().forEach(([px, py]) => g.lineTo(px, py)); g.closePath();
  g.fillStyle = INK; g.fill();
  for (const e of [a, b]) { g.beginPath(); e.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.strokeStyle = GLOW; g.lineWidth = U * .012; g.stroke(); g.strokeStyle = GLOW2; g.lineWidth = U * .004; g.stroke(); }
  g.restore();
}
function iris(R, p) {
  const { g, W, H } = R, r = Math.hypot(W, H) * .6 * eo(p);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = INK; g.beginPath(); g.rect(0, 0, W, H);
  const n = 48; for (let i = n; i >= 0; i--) { const a = i / n * Math.PI * 2, rr = Math.max(1, r) + (i % 2 ? U * .012 : 0); i === n ? g.moveTo(W / 2 + Math.cos(a) * rr, H * .45 + Math.sin(a) * rr) : g.lineTo(W / 2 + Math.cos(a) * rr, H * .45 + Math.sin(a) * rr); }
  g.fill('evenodd'); g.restore();
}
// an old-TV channel flip: the frame collapses to a bright line and snaps open (stepped, not a dissolve)
function tvFlash(R, p) {
  const { g, W, H } = R;
  if (p >= .5) return;
  const q = Math.floor(p * 8) / 4;   // 0, .25, .5, .75 — on twos-ish steps
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = INK;
  const open = H * .5 * q; g.fillRect(0, 0, W, H / 2 - open); g.fillRect(0, H / 2 + open, W, H / 2 - open + 1);
  g.fillStyle = GLOW2; g.fillRect(0, H / 2 - open - U * .004, W, U * .008); g.fillRect(0, H / 2 + open - U * .004, W, U * .008);
  g.restore();
}

export default style;
