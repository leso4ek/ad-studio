// Ad style "Riso Print" (ad-riso-print): every frame printed in three translucent spot inks on warm paper —
// halftone screens at their own angles, knockouts, misregistration that shifts with each drawing, ink starvation and grain.
// Any hex colour from the bible is translated to the nearest mix of the three inks. Original; see styles/ad-riso-print/STYLE.md.
import { pathPrim, canvas, noiseTile } from '../draw2d.js';
import { drawScene, captionLines, transition } from './style2d.js';
import { hash } from '/core/lib.js';

const INKS = ['#FF48B0', '#0078BF', '#FFE800'];   // fluorescent pink, medium blue, yellow
const PAPER = '#F3EDE0';
const ANG = [.26, .78, 0];                         // screen angles (rad) per ink
const PAL = {
  day:  { wall: [[2, .22]], wall2: [[2, .42]], floor: [[0, .3], [2, .35]], floor2: [[0, .5], [2, .45]], wood: [[0, .55], [2, .6]], sky: [[1, .28]], sky2: [[1, .14]], glass: [[1, .3]], metal: [[1, .45]],
          plant: [[1, .7], [2, .8]], plant2: [[1, .45], [2, .7]], sun: [[2, 1], [0, .3]], moon: [[2, .45]], cloud: [], building: [[0, .6]], building2: [[0, .3], [1, .3]], windowLit: [[2, .9]], ground: [[1, .45], [2, .6]], path: [[2, .3]] },
  dusk: { wall: [[0, .2], [2, .3]], wall2: [[0, .35], [2, .4]], floor: [[0, .45], [1, .2]], floor2: [[0, .6], [1, .3]], wood: [[0, .65], [1, .3]], sky: [[0, .55], [2, .5]], sky2: [[2, .55], [0, .2]], glass: [[0, .35], [2, .3]], metal: [[1, .5]],
          plant: [[1, .7], [2, .6]], plant2: [[1, .5], [2, .5]], sun: [[2, 1], [0, .45]], moon: [[2, .45]], cloud: [[0, .12]], building: [[0, .75], [1, .3]], building2: [[1, .55], [0, .3]], windowLit: [[2, 1]], ground: [[1, .55], [2, .45]], path: [[0, .2], [2, .3]] },
  night:{ wall: [[1, .55]], wall2: [[1, .7]], floor: [[1, .75], [0, .3]], floor2: [[1, .9], [0, .4]], wood: [[1, .8], [0, .5]], sky: [[1, .85]], sky2: [[1, .65], [0, .2]], glass: [[1, .6]], metal: [[1, .7]],
          plant: [[1, .9], [2, .4]], plant2: [[1, .8], [2, .3]], sun: [[2, 1]], moon: [[2, .7]], cloud: [[1, .35]], building: [[1, 1], [0, .4]], building2: [[1, .8], [0, .6]], windowLit: [[2, 1]], ground: [[1, .85], [2, .3]], path: [[1, .5]] },
};
const COMMON = { skin: [[0, .2], [2, .32]], hair: [[1, .9], [0, .6]], hairInk: [[1, 1], [0, .7]], top: [[0, .85]], bottom: [[1, .8]], shoe: [[1, 1], [0, 1]], ink: [[1, 1], [0, .75]], white: [], cheek: [[0, .65]],
  propA: [[0, .7], [2, .5]], propB: [[1, .6]], accent: [[0, 1]], accent2: [[2, 1]], screen: [[1, .3]], textInk: [[1, 1]], textBg: [], custom: [[0, 1]], label: [], labelInk: [[1, 1]] };

// hex → the nearest overprint of the three inks (tones 0, .25 … 1), cached
const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
const P0 = rgb(PAPER), IK = INKS.map(rgb), cache = new Map();
function toInks(v) {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string' || v[0] !== '#') return [];
  if (cache.has(v)) return cache.get(v);
  const tgt = rgb(v), steps = [0, .25, .5, .75, 1]; let best = null, bd = 1e9;
  for (const a of steps) for (const b of steps) for (const c of steps) {
    const col = P0.map((p, i) => p * (1 - a * (1 - IK[0][i])) * (1 - b * (1 - IK[1][i])) * (1 - c * (1 - IK[2][i])));
    const d = col.reduce((s, x, i) => s + (x - tgt[i]) ** 2, 0);
    if (d < bd) { bd = d; best = [[0, a], [1, b], [2, c]].filter(q => q[1] > 0); }
  }
  cache.set(v, best); return best;
}

let inkCv = [], screens = [], grain, starve, tmpG;
function screen(g, tone, angle, cell) {
  const [c, x] = canvas(cell, cell); x.fillStyle = '#000';
  const r = cell * Math.sqrt(tone / (2 * Math.PI)) * 1.02;   // two dots per cell → area coverage = tone
  for (const [ox, oy] of [[0, 0], [cell, 0], [0, cell], [cell, cell], [cell / 2, cell / 2]]) { x.beginPath(); x.arc(ox, oy, Math.min(r, cell * .72), 0, Math.PI * 2); x.fill(); }
  const p = g.createPattern(c, 'repeat'); p.setTransform(new DOMMatrix().rotateSelf(angle * 57.3)); return p;
}

const style = {
  id: 'ad-riso-print', onTwos: true,
  fontFaces: ['400 40px "Anton"', '700 40px "Space Mono"'],
  palette: (time, over) => ({ ...COMMON, ...(PAL[time] || PAL.day), ...over }),
  font: role => role === 'sub' || role === 'small' || role === 'cta' ? { family: '"Space Mono"', weight: 700, lh: 1.15 } : { family: '"Anton"', weight: 400, lh: 1.0 },
  setup(R) {
    const { W, H, g } = R, cell = Math.max(6, Math.round(Math.min(W, H) * .0085));
    inkCv = INKS.map(() => canvas(W, H));
    screens = INKS.map((_, k) => Array.from({ length: 11 }, (_, i) => i === 10 ? '#000' : screen(g, (i + .5) / 10, ANG[k], cell)));
    grain = g.createPattern(noiseTile(256, 3, 40), 'repeat');
    starve = noiseTile(512, 19, 90);
    tmpG = canvas(W, H);
  },

  scene(R, s) {
    const { g, W, H } = R, real = R.g, k = Math.floor(R.tq * 12);
    for (let i = 0; i < INKS.length; i++) {
      const [c, x] = inkCv[i]; x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H);
      R.g = x;
      drawScene(R, s, (R2, prims, m) => paintInk(R2, prims, m, i), {
        glow: (R2, p, prims) => { if (i === 2 || i === 0) rays(R2, p, prims, i === 2 ? .9 : .25); },
      });
      // ink starvation: the drum misses a little ink in patches
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = .35;
      x.drawImage(starve, -((k * 53 + i * 101) % 256), -((k * 29 + i * 67) % 256), W + 512, H + 512); x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-in'; x.fillStyle = INKS[i]; x.fillRect(0, 0, W, H);
    }
    R.g = real;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'multiply';
    for (let i = 0; i < INKS.length; i++) {
      const ox = (hash(k * 3.1 + i) - .5) * W * .006 + (i - 1) * W * .002, oy = (hash(k * 7.7 + i * 2) - .5) * W * .006;
      g.drawImage(inkCv[i][0], ox, oy);
    }
    g.globalCompositeOperation = 'source-over';
  },

  text(R, lay) {
    const { g, H } = R, k = Math.floor(R.tq * 12);
    const main = toInks(lay.layer.color || '#0078BF'), m0 = main[0]?.[0] ?? 1, second = lay.role === 'hook' || lay.role === 'card' || lay.role === 'logo' ? (m0 === 0 ? 2 : 0) : -1;
    g.save(); g.globalCompositeOperation = 'multiply';
    g.font = `${lay.font.weight} ${lay.size}px ${lay.font.family}`; g.textAlign = lay.align; g.textBaseline = 'alphabetic';
    for (const ln of lay.lines) {
      if (second >= 0) { g.fillStyle = INKS[second]; g.fillText(ln.text, ln.x + H * .004 + (hash(k) - .5) * H * .002, ln.y + H * .003); }
      g.fillStyle = INKS[m0]; g.fillText(ln.text, ln.x + (hash(k + 9) - .5) * H * .002, ln.y);
    }
    g.restore();
  },

  caption(R, text, box) {
    const { g } = R, f = { family: '"Space Mono"', weight: 700 };
    const lines = captionLines(g, text, f, box.size * .9, box.w), lh = box.size * 1.2, pad = box.size * .4;
    const widest = Math.max(...lines.map(l => g.measureText(l).width)), h = lh * lines.length;
    g.save(); g.fillStyle = PAPER; g.fillRect(box.cx - widest / 2 - pad, box.cy - h / 2 - pad * .6, widest + pad * 2, h + pad * 1.2);
    g.globalCompositeOperation = 'multiply'; g.strokeStyle = INKS[0]; g.lineWidth = box.size * .12; g.strokeRect(box.cx - widest / 2 - pad, box.cy - h / 2 - pad * .6, widest + pad * 2, h + pad * 1.2);
    g.fillStyle = INKS[1]; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, box.cx, box.cy - h / 2 + lh * (i + .5)));
    g.restore();
  },

  transition(R, kind, p) { transition(R, kind === 'wipe' ? 'stripes' : kind, p, [INKS[2]]); },

  post(R) {
    const { g, W, H } = R, k = Math.floor(R.tq * 12);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.globalAlpha = .6;
    g.translate((k * 41) % 256, (k * 17) % 256); g.fillStyle = grain; g.fillRect(-256, -256, W + 512, H + 512); g.restore();
  },
};

function paintInk(R, prims, m, ink) {
  const { g } = R;
  for (const p of prims) {
    let inks = toInks(m[p.m] ?? m.ink);
    if (p.m === 'skin' || p.m === 'cheek') inks = inks.map(([k, v]) => [k, v * .6]);   // faces print light
    const hit = inks.find(q => q[0] === ink);
    if (p.s === 'text') {
      g.save(); g.globalCompositeOperation = hit ? 'source-over' : 'destination-out'; g.fillStyle = '#000';
      let size = p.size; g.font = `400 ${size}px "Anton"`; const tw = g.measureText(p.text).width; if (tw > p.w) { size *= p.w / tw; g.font = `400 ${size}px "Anton"`; }
      g.textAlign = 'center'; g.fillText(p.text, p.x, p.y); g.restore(); continue;
    }
    if (p.s === 'stroke') {
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = p.w || 3;
      g.globalCompositeOperation = hit ? 'source-over' : 'destination-out'; g.strokeStyle = hit ? screens[ink][Math.min(10, Math.round(hit[1] * 10))] : '#000';
      pathPrim(g, p); g.stroke(); g.restore(); continue;
    }
    g.save();
    if (hit) { g.globalCompositeOperation = 'source-over'; g.fillStyle = hit[1] >= .97 ? '#000' : screens[ink][Math.min(9, Math.floor(hit[1] * 10))]; }
    else { g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; }
    pathPrim(g, p); g.fill(); g.restore();
  }
}
function rays(R, p, prims, a) {
  const { g, W, H } = R, xs = prims.flatMap(q => q.pts ? q.pts.map(v => v[0]) : [q.x ?? q.x1]), ys = prims.flatMap(q => q.pts ? q.pts.map(v => v[1]) : [q.y ?? q.y1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, r = Math.max(W, H) * p.a.glow;
  g.save(); g.globalAlpha = a * p.a.glow; g.fillStyle = '#000'; g.translate(cx, cy); g.rotate(R.tq * .2);
  for (let i = 0; i < 12; i++) { const b = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, b, b + Math.PI / 12); g.fill(); }
  g.restore();
}

export default style;
