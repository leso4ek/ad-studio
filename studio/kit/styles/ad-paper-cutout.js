// Ad style "Paper Cut-out" (ad-paper-cutout): layered card stock with soft drop shadows, hand-cut edges,
// animated on twos (12 drawings a second) with a slight stop-motion jitter. Original; see styles/ad-paper-cutout/STYLE.md.
import { pathPrim, primText, noiseTile } from '../draw2d.js';
import { drawScene, burst, captionLines, transition } from './style2d.js';
import { hash } from '/core/lib.js';

const PAL = {
  day:  { wall: '#F2E2C4', wall2: '#E9CFA3', floor: '#C98B5B', floor2: '#B37548', wood: '#A8683F', sky: '#9FD3E0', sky2: '#C7E6E6', glass: '#B9DCE4', metal: '#9BA6AE',
          plant: '#5E9E5A', plant2: '#7DB86A', sun: '#F7B538', moon: '#F4EBC9', cloud: '#FFFDF6', building: '#E58F65', building2: '#D9B48F', windowLit: '#FBE3A1', ground: '#8DBE6E', path: '#E7D2A8' },
  dusk: { wall: '#EBC9A8', wall2: '#DDAF8A', floor: '#9C6446', floor2: '#86533A', wood: '#8A5235', sky: '#F29E6D', sky2: '#F6C68E', glass: '#E7B48D', metal: '#8E8C92',
          plant: '#4F7E50', plant2: '#6A9459', sun: '#F7C04A', moon: '#F4EBC9', cloud: '#FBE2CD', building: '#B4655B', building2: '#9E7A6E', windowLit: '#FFD98A', ground: '#6E8F55', path: '#C9A57D' },
  night:{ wall: '#5B6A8F', wall2: '#4C5A7C', floor: '#3E3A55', floor2: '#332F47', wood: '#4A3A45', sky: '#273A66', sky2: '#3B4F80', glass: '#3F5A86', metal: '#6D7590',
          plant: '#3D6150', plant2: '#4E7560', sun: '#F7C04A', moon: '#F6EEC9', cloud: '#6B7BA3', building: '#3A4569', building2: '#2F3858', windowLit: '#FFD36E', ground: '#2E4A45', path: '#55597A' },
};
const COMMON = { skin: '#F2B999', hair: '#4A2E25', top: '#E2554F', bottom: '#3E5C88', shoe: '#2E2A2A', ink: '#2B2320', white: '#FFFDF6', cheek: '#F08C80',
  propA: '#F0A04B', propB: '#4F8FA8', accent: '#F25C54', accent2: '#FFCB47', screen: '#9ED9E6', textInk: '#2B2320', textBg: '#FFFDF6', custom: '#F25C54' };

let grain, fibre;
const style = {
  id: 'ad-paper-cutout', onTwos: true,
  fontFaces: ['600 40px "Fredoka"', '500 40px "Fredoka"'],
  defaultCast: {},
  palette: (time, over) => ({ ...COMMON, ...(PAL[time] || PAL.day), ...over }),
  font: role => ({ family: '"Fredoka"', weight: role === 'sub' || role === 'small' ? 500 : 600, lh: 1.05 }),
  setup(R) { grain = R.g.createPattern(noiseTile(256, 7, 22), 'repeat'); fibre = R.g.createPattern(noiseTile(512, 11, 10, false), 'repeat'); },

  scene(R, s) { drawScene(R, s, paint, { glow: (R2, p, prims) => burst(R2, p, prims, R2.mats('place', null, R2.time).accent2, 16, .45) }); },

  text(R, lay, lt) {
    const { g } = R, k = Math.floor(R.tq * 12), j = hash(k + lay.box[0]) - .5;
    const bg = lay.layer.bg ?? (lay.role === 'hook' || lay.role === 'card' || lay.role === 'cta');
    const m = R.mats('place', null, R.time);
    g.save();
    g.translate((lay.box[0] + lay.box[2]) / 2, (lay.box[1] + lay.box[3]) / 2); g.rotate((lay.layer.rot || 0) + j * .006); g.translate(-(lay.box[0] + lay.box[2]) / 2, -(lay.box[1] + lay.box[3]) / 2);
    g.font = `${lay.font.weight} ${lay.size}px ${lay.font.family}`; g.textAlign = lay.align; g.textBaseline = 'alphabetic';
    for (const [i, ln] of lay.lines.entries()) {
      const x0 = lay.align === 'center' ? ln.x - ln.w / 2 : lay.align === 'right' ? ln.x - ln.w : ln.x;
      if (bg) {
        const pad = lay.size * .22;
        shadow(g, R.H * .004, R.H * .006, R.H * .007);
        g.fillStyle = lay.layer.bgColor || (lay.role === 'cta' ? m.accent : m.textBg);
        g.beginPath(); const y0 = ln.y - lay.size * .82 - pad * .4, y1 = ln.y + lay.size * .2 + pad * .4, sk = (hash(i * 7 + 3) - .5) * lay.size * .1;
        g.moveTo(x0 - pad, y0 + sk); g.lineTo(x0 + ln.w + pad, y0 - sk); g.lineTo(x0 + ln.w + pad * 1.1, y1); g.lineTo(x0 - pad * .9, y1 + sk); g.closePath(); g.fill();
        noShadow(g);
      } else shadow(g, R.H * .003, R.H * .004, R.H * .004);
      g.fillStyle = lay.layer.color || (lay.role === 'cta' ? m.white : m.textInk);
      g.fillText(ln.text, ln.x, ln.y);
      noShadow(g);
    }
    g.restore();
  },

  caption(R, text, box) {
    const { g } = R, m = R.mats('place', null, R.time), f = { family: '"Fredoka"', weight: 600 };
    const lines = captionLines(g, text, f, box.size, box.w), lh = box.size * 1.18, pad = box.size * .35;
    const widest = Math.max(...lines.map(l => g.measureText(l).width)), h = lh * lines.length;
    g.save(); shadow(g, 0, R.H * .004, R.H * .006); g.fillStyle = m.white;
    g.fillRect(box.cx - widest / 2 - pad, box.cy - h / 2 - pad * .6, widest + pad * 2, h + pad * 1.2); noShadow(g);
    g.fillStyle = m.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, box.cx, box.cy - h / 2 + lh * (i + .5)));
    g.restore();
  },

  transition(R, kind, p) { const m = R.mats('place', null, R.time); transition(R, kind, p, [m.accent2]); },

  post(R) {
    const { g, W, H } = R;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = .55; g.fillStyle = fibre; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = .5; const k = Math.floor(R.tq * 12); g.translate((k * 37) % 256, (k * 71) % 256); g.fillStyle = grain; g.fillRect(-256, -256, W + 512, H + 512);
    g.restore();
    // warm vignette, like a lamp over the table
    const v = g.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .4, W / 2, H * .5, Math.max(W, H) * .8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,10,.28)');
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = v; g.fillRect(0, 0, W, H); g.restore();
  },
};

function shadow(g, dx, dy, blur, a = .32) { g.shadowColor = `rgba(40,22,10,${a})`; g.shadowOffsetX = dx; g.shadowOffsetY = dy; g.shadowBlur = blur; }
function noShadow(g) { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0; }

// every group is a stack of paper pieces: each casts a soft shadow onto what is under it
function paint(R, prims, m, info) {
  const { g, H } = R, k = Math.floor(R.tq * 12);
  const kh = hashStr(info.key), place = info.kind === 'place';
  // stop-motion: each drawing nudges the whole puppet a little
  const jx = place ? 0 : (hash(k * 1.7 + kh) - .5) * H * .0016, jy = place ? 0 : (hash(k * 2.3 + kh) - .5) * H * .0016;
  const depth = place ? (info.plane === 'far' ? .5 : .8) : 1;
  g.save(); g.translate(jx, jy);
  for (const [i, p] of prims.entries()) {
    const col = m[p.m] || m.ink;
    if (p.s === 'text') { primText(g, p, col, '"Fredoka"', 600); continue; }
    const cut = (x, y, vi) => { const n = hash(i * 13.1 + vi * 3.7 + kh) - .5; return [x + n * H * .0009, y + (hash(i * 5.3 + vi * 9.1 + kh) - .5) * H * .0009]; };
    if (p.s === 'stroke') {
      g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = p.w || 3; g.strokeStyle = col;
      if (!p.flat) shadow(g, H * .002, H * .003, H * .003, .25);
      pathPrim(g, p); g.stroke(); noShadow(g); continue;
    }
    if (p.flat) { g.fillStyle = col; pathPrim(g, p); g.fill(); continue; }
    shadow(g, H * .0035 * depth, H * .005 * depth, H * .007 * depth, place ? .22 : .3);
    g.fillStyle = col; pathPrim(g, p, cut); g.fill();
    noShadow(g);
    // a lighter cut edge on the top-left catches the lamp
    g.save(); g.clip(); g.globalAlpha = .18; g.strokeStyle = '#fff'; g.lineWidth = H * .002; g.translate(H * .0012, H * .0012); pathPrim(g, p, cut); g.stroke(); g.restore();
  }
  g.restore();
}
function hashStr(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; }

export default style;
