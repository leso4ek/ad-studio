// Ad style "Kinetic Type" (ad-kinetic-type): the words are the camera. Big type slams in word by word over bold colour
// fields, flat pictogram people, the product as a clean hero with one gloss highlight. Full 24 fps, hard cuts and panel pushes.
// Original; see styles/ad-kinetic-type/STYLE.md.
import { pathPrim, primText, noiseTile } from '../draw2d.js';
import { drawScene, captionLines } from './style2d.js';
import { seg, eo, back, lerp, clamp } from '/core/lib.js';

const K = { ink: '#141414', paper: '#F5F2EA', red: '#FF4A1C', blue: '#2346FF', lime: '#C8F031', pink: '#FF9BD2', grey: '#D9D4C7' };
const FIELDS = [K.red, K.ink, K.blue, K.lime, K.paper, K.pink];
const lum = h => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
const on = bg => lum(bg) > .5 ? K.ink : K.paper;

let grain, fieldOf = new Map();
const style = {
  id: 'ad-kinetic-type', onTwos: false,
  fontFaces: ['400 40px "Archivo Black"', '800 40px "Inter"', '600 40px "Inter"'],
  palette(time, over) {
    // pictogram look: places collapse into two tones of the field, people into one flat colour
    return { ...over };
  },
  font: role => role === 'sub' || role === 'small' || role === 'cta' ? { family: '"Inter"', weight: 800, lh: 1.12 } : { family: '"Archivo Black"', weight: 400, lh: .98 },
  setup(R) { grain = R.g.createPattern(noiseTile(256, 9, 14), 'repeat'); R.bible.shots.forEach((s, i) => fieldOf.set(s.id, s.bg || FIELDS[i % FIELDS.length])); },

  scene(R, s) {
    const { g, W, H } = R, bg = s.end ? (R.bible.endcard?.bg || K.paper) : (fieldOf.get(s.shot.id) || K.red), fg = on(bg);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    R._field = bg; R._fg = fg;
    // the place as a ghosted two-tone silhouette, so the story world is there but the type leads
    const placeKind = R.bible.places?.[s.shot.place]?.kind || s.shot.place;
    if (placeKind && placeKind !== 'studio' && !s.end) {
      g.save(); g.globalAlpha = .13; const pl = R.place(placeKind, W, H, 1);
      g.fillStyle = fg; for (const p of [...pl.far, ...pl.mid]) if (!/^(wall|sky|sky2)$/.test(p.m)) { pathPrim(g, p); g.fill(); }
      g.restore();
    }
    drawScene(R, { ...s, shot: { ...s.shot, place: '__none' } }, (R2, prims, m, info) => paint(R2, prims, m, info, bg, fg), {
      glow: (R2, p, prims) => rings(R2, p, prims, fg),
    });
  },

  text(R, lay, lt) {
    const { g, H } = R, bg = R._field || K.red, fg = lay.layer.color || R._fg || on(bg);
    const words = lay.lines.flatMap((ln, li) => ln.text.split(' ').map(w => ({ w, li })));
    const per = lay.role === 'sub' || lay.role === 'small' ? .05 : .11;
    g.save(); g.font = `${lay.font.weight} ${lay.size}px ${lay.font.family}`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    let wi = 0;
    for (const [li, ln] of lay.lines.entries()) {
      const space = g.measureText(' ').width;
      let x = lay.align === 'center' ? ln.x - ln.w / 2 : lay.align === 'right' ? ln.x - ln.w : ln.x;
      // a marker bar under the second line of a hook/card
      if ((lay.role === 'hook' || lay.role === 'card') && li === lay.lines.length - 1 && lay.lines.length > 1) {
        const p = eo(seg(lt, per * words.length * .6, per * words.length * .6 + .3));
        g.fillStyle = bg === K.lime ? K.pink : K.lime; g.fillRect(x - lay.size * .1, ln.y - lay.size * .78, (ln.w + lay.size * .2) * p, lay.size * .92);
      }
      for (const w of ln.text.split(' ')) {
        const p = seg(lt, wi * per, wi * per + .22), s = lerp(1.45, 1, back(p, 2)), a = clamp(p * 3);
        const ww = g.measureText(w).width;
        g.save(); g.globalAlpha = a; g.translate(x + ww / 2, ln.y - lay.size * .35); g.scale(s, s); g.translate(-(x + ww / 2), -(ln.y - lay.size * .35));
        const marked = (lay.role === 'hook' || lay.role === 'card') && li === lay.lines.length - 1 && lay.lines.length > 1;
        g.fillStyle = marked ? K.ink : fg; g.fillText(w, x, ln.y); g.restore();
        x += ww + space; wi++;
      }
    }
    g.restore();
  },

  caption(R, text, box) {
    const { g } = R, f = { family: '"Inter"', weight: 800 };
    const lines = captionLines(g, text, f, box.size * .95, box.w), lh = box.size * 1.2;
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; const h = lh * lines.length;
    lines.forEach((l, i) => {
      const w = g.measureText(l).width, y = box.cy - h / 2 + lh * (i + .5);
      g.fillStyle = K.ink; g.fillRect(box.cx - w / 2 - box.size * .3, y - lh / 2, w + box.size * .6, lh);
      g.fillStyle = K.paper; g.fillText(l, box.cx, y + box.size * .04);
    });
    g.restore();
  },

  transition(R, kind, p) {
    const { g, W, H } = R, x = W * (1 - eo(p));
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    if (kind === 'fade') { g.globalAlpha = 1 - p; g.fillStyle = K.ink; g.fillRect(0, 0, W, H); }
    else { g.fillStyle = K.ink; g.fillRect(-W + x - W * .02, 0, W, H); g.fillStyle = K.lime; g.fillRect(-W * .06 + x - W * .02, 0, W * .04, H); }
    g.restore();
  },

  post(R) { const { g, W, H } = R; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'overlay'; g.globalAlpha = .35; g.fillStyle = grain; g.fillRect(0, 0, W, H); g.restore(); },
};

function paint(R, prims, m, info, bg, fg) {
  const { g, H } = R;
  if (info.kind === 'place') return;
  const pict = info.kind === 'char' || info.kind === 'prop';
  // people and props: one flat colour against the field, details knocked out in the field colour
  const body = pict ? (info.layer?.color || fg) : null;
  if (info.kind === 'product') { g.save(); g.shadowColor = 'rgba(0,0,0,.28)'; g.shadowBlur = H * .03; g.shadowOffsetY = H * .015; }
  for (const p of prims) {
    let col = pict ? (p.flat || p.m === 'cheek' ? bg : body) : (m[p.m] || '#111');
    if (pict && p.m === 'cheek') continue;
    if (p.s === 'text') { primText(g, p, pict ? bg : col, '"Archivo Black"', 400); continue; }
    if (p.s === 'stroke') { g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = p.w || 3; g.strokeStyle = col; pathPrim(g, p); g.stroke(); continue; }
    g.fillStyle = col; pathPrim(g, p); g.fill();
  }
  if (info.kind === 'product') {
    g.restore();
    // one gloss highlight down the left side of the body
    const b = prims.find(p => p.m === 'body');
    if (b && b.s === 'rrect') { g.save(); g.globalAlpha = .28; g.fillStyle = '#fff'; g.beginPath(); g.roundRect(b.x - b.w * .36, b.y - b.h * .4, b.w * .09, b.h * .8, b.w * .05); g.fill(); g.restore(); }
  }
}

function rings(R, p, prims, fg) {
  const { g } = R, xs = prims.flatMap(q => q.pts ? q.pts.map(v => v[0]) : [q.x ?? q.x1]), ys = prims.flatMap(q => q.pts ? q.pts.map(v => v[1]) : [q.y ?? q.y1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, r = (Math.max(...ys) - Math.min(...ys)) * .7;
  g.save(); g.strokeStyle = fg; g.lineWidth = R.H * .004;
  for (let i = 0; i < 3; i++) { const k = (p.a.glow + i / 3) % 1; g.globalAlpha = (1 - k) * .6 * p.a.glow; g.beginPath(); g.arc(cx, cy, r * (.8 + k * 1.2), 0, Math.PI * 2); g.stroke(); }
  g.restore();
}

export default style;
