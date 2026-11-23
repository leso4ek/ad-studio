// Ad style "Mid-century Toon" (ad-midcentury-toon): flat 1950s/60s colour planes, a thin ink line printed slightly
// off-register from the fills, atomic-age starbursts and boomerangs on the walls, limited animation on twos, jazzy holds.
// Original; see styles/ad-midcentury-toon/STYLE.md.
import { pathPrim, primText, noiseTile } from '../draw2d.js';
import { drawScene, captionLines, transition } from './style2d.js';
import { hash } from '/core/lib.js';

const C = { cream: '#F3E7CF', mustard: '#E2A62E', teal: '#3E9C97', coral: '#E4664A', olive: '#8F9A45', brown: '#5B3F2C', char: '#2A2724', sky: '#A9D3CF', pink: '#EFA3A0', blue: '#3B6E9E' };
const PAL = {
  day:  { wall: C.cream, wall2: '#E8D6B3', floor: C.teal, floor2: '#2F7F7B', wood: C.brown, sky: C.sky, sky2: '#C9E3D9', glass: '#BFDDD6', metal: '#9AA39B', plant: C.olive, plant2: '#A9B356',
          sun: C.mustard, moon: '#F5EBC8', cloud: '#FBF5E7', building: C.coral, building2: C.mustard, windowLit: '#FBE6A6', ground: C.olive, path: '#E8D6B3' },
  dusk: { wall: '#F1D3B0', wall2: '#E5BD95', floor: '#2F7F7B', floor2: '#246965', wood: C.brown, sky: '#EE9A6B', sky2: '#F3C48B', glass: '#E5B48D', metal: '#9A938B', plant: '#6F7A38', plant2: '#8A9446',
          sun: C.mustard, moon: '#F5EBC8', cloud: '#F7DCC4', building: '#B9573F', building2: '#C88B2A', windowLit: '#FFDD8A', ground: '#6F7A38', path: '#D6B993' },
  night:{ wall: '#3F5C73', wall2: '#334D61', floor: '#1F4B4D', floor2: '#173D3F', wood: '#3F2C21', sky: '#22384F', sky2: '#2E4A63', glass: '#365A75', metal: '#5C6B73', plant: '#475232', plant2: '#56613B',
          sun: C.mustard, moon: '#F5EBC8', cloud: '#4E6A80', building: '#2C4256', building2: '#3A3A4F', windowLit: '#F7C95A', ground: '#26403A', path: '#46607A' },
};
const COMMON = { skin: '#F0B892', hair: C.char, hairInk: C.char, top: C.coral, bottom: C.blue, shoe: C.char, ink: C.char, white: '#FBF5E7', cheek: C.pink,
  propA: C.mustard, propB: C.teal, accent: C.coral, accent2: C.mustard, screen: C.sky, textInk: C.char, textBg: C.cream, custom: C.coral, label: '#FBF5E7', labelInk: C.char };

let grain;
const style = {
  id: 'ad-midcentury-toon', onTwos: true,
  fontFaces: ['700 40px "Josefin Sans"', '600 40px "Josefin Sans"', '400 40px "Pacifico"'],
  palette: (time, over) => ({ ...COMMON, ...(PAL[time] || PAL.day), ...over }),
  font: role => role === 'hook' || role === 'logo' ? { family: '"Pacifico"', weight: 400, lh: 1.25 } : { family: '"Josefin Sans"', weight: role === 'sub' || role === 'small' ? 600 : 700, lh: 1.08 },
  setup(R) { grain = R.g.createPattern(noiseTile(256, 5, 16), 'repeat'); },

  scene(R, s) {
    drawScene(R, s, paint, { glow: (R2, p, prims) => starburst(R2, p, prims) });
  },

  text(R, lay, lt) {
    const { g, H } = R, m = R.mats('place', null, R.time);
    const panel = lay.layer.bg ?? (lay.role === 'card' || lay.role === 'cta');
    g.save(); g.font = `${lay.font.weight} ${lay.size}px ${lay.font.family}`; g.textAlign = lay.align; g.textBaseline = 'alphabetic';
    if (panel) {
      const [x0, y0, x1, y1] = lay.box, pad = lay.size * .35;
      g.fillStyle = lay.layer.bgColor || (lay.role === 'cta' ? m.accent : m.accent2);
      blob(g, x0 - pad, y0 - pad * .7, x1 + pad, y1 + pad * .5, lay.size * .5);
      g.fill();
    }
    for (const ln of lay.lines) {
      if (lay.role === 'hook' || lay.role === 'logo') { g.fillStyle = m.white; g.fillText(ln.text, ln.x + H * .003, ln.y + H * .003); }
      g.fillStyle = lay.layer.color || (lay.role === 'cta' ? m.white : m.textInk); g.fillText(ln.text, ln.x, ln.y);
    }
    g.restore();
  },

  caption(R, text, box) {
    const { g } = R, f = { family: '"Josefin Sans"', weight: 700 };
    const lines = captionLines(g, text, f, box.size, box.w), lh = box.size * 1.2, pad = box.size * .45;
    const widest = Math.max(...lines.map(l => g.measureText(l).width)), h = lh * lines.length;
    g.save(); g.fillStyle = 'rgba(42,39,36,.86)'; blob(g, box.cx - widest / 2 - pad, box.cy - h / 2 - pad * .55, box.cx + widest / 2 + pad, box.cy + h / 2 + pad * .45, box.size * .7); g.fill();
    g.fillStyle = '#FBF5E7'; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, box.cx, box.cy - h / 2 + lh * (i + .55)));
    g.restore();
  },

  transition(R, kind, p) { const m = R.mats('place', null, R.time); transition(R, kind === 'wipe' ? 'iris' : kind, p, [C.char]); },

  post(R) {
    const { g, W, H } = R, k = Math.floor(R.tq * 12);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.globalAlpha = .45;
    g.translate((k * 29) % 256, (k * 13) % 256); g.fillStyle = grain; g.fillRect(-256, -256, W + 512, H + 512); g.restore();
  },
};

function blob(g, x0, y0, x1, y1, r) { g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); }

function paint(R, prims, m, info) {
  const { g, H } = R, place = info.kind === 'place';
  const off = H * .0028, lw = H * .0016;
  for (const p of prims) {
    const col = m[p.m] || m.ink;
    if (p.s === 'text') { primText(g, p, col, '"Josefin Sans"', 700); continue; }
    if (p.s === 'stroke') { g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = p.w || 3; g.strokeStyle = col; pathPrim(g, p); g.stroke(); continue; }
    g.fillStyle = col; pathPrim(g, p); g.fill();
    if (!place && !p.flat) { g.save(); g.translate(-off, -off * .6); g.strokeStyle = m.ink; g.lineWidth = lw; g.globalAlpha = .9; pathPrim(g, p); g.stroke(); g.restore(); }
  }
  if (place && info.plane === 'far') decorate(R, m, info.key);
}

// atomic-age wall decorations: starbursts, boomerangs and dots, placed by a seed per place
function decorate(R, m, key) {
  const { g, W, H } = R; let s = 0; for (const c of key) s = (s * 31 + c.charCodeAt(0)) % 9973;
  for (let i = 0; i < 7; i++) {
    const x = hash(s + i * 3.1) * W, y = H * (.08 + hash(s + i * 7.3) * .45), r = H * (.012 + hash(s + i) * .02);
    g.save(); g.translate(x, y); g.rotate(hash(i + s) * 3);
    g.strokeStyle = i % 3 ? m.accent2 : m.accent; g.fillStyle = g.strokeStyle; g.lineWidth = H * .0022; g.globalAlpha = .55;
    if (i % 3 === 0) { for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(k * Math.PI / 4) * r * 2, Math.sin(k * Math.PI / 4) * r * 2); g.stroke(); } g.beginPath(); g.arc(0, 0, r * .35, 0, 7); g.fill(); }
    else if (i % 3 === 1) { g.beginPath(); g.moveTo(-r * 2, 0); g.quadraticCurveTo(0, -r * 1.6, r * 2, 0); g.quadraticCurveTo(0, -r * .6, -r * 2, 0); g.fill(); }
    else { g.beginPath(); g.arc(0, 0, r * .5, 0, 7); g.fill(); g.beginPath(); g.arc(r * 1.4, r * .4, r * .3, 0, 7); g.fill(); }
    g.restore();
  }
}

function starburst(R, p, prims) {
  const { g, W, H } = R, xs = prims.flatMap(q => q.pts ? q.pts.map(v => v[0]) : [q.x ?? q.x1]), ys = prims.flatMap(q => q.pts ? q.pts.map(v => v[1]) : [q.y ?? q.y1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, r = Math.max(...xs) - Math.min(...xs);
  const m = R.mats('place', null, R.time);
  g.save(); g.translate(cx, cy); g.globalAlpha = p.a.glow; g.fillStyle = m.accent2; g.beginPath();
  const n = 16; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2 + R.tq * .3, rr = (i % 2 ? .55 : 1.25) * r * (.6 + .4 * p.a.glow); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.fill(); g.restore();
}

export default style;
