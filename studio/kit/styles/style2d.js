// Shared scene drawing for the Canvas 2D ad styles. A style supplies `paintGroup(R, prims, mats, info)`
// (how a group of primitives looks: paper with shadows, riso ink, flat paint…) and the rest is common.
import { placePrims } from '../draw2d.js';
import { seg, eo, lerp } from '/core/lib.js';

export function mat(m, name) { return m[name] || m.ink || '#222'; }

/** Draws the place (two parallax planes), then every resolved layer, with the shot's camera. */
export function drawScene(R, { shot, layers, cam }, paintGroup, opts = {}) {
  const { g, W, H } = R;
  const time = R.time, pm = R.mats('place', null, time);
  const pl = R.place(shot.place && R.bible.places?.[shot.place]?.kind || shot.place || 'studio', W, H, (shot.seed ?? 1));
  const camT = (depth) => {
    g.translate(cam.cx, cam.cy); g.scale(lerp(1, cam.zoom, depth), lerp(1, cam.zoom, depth));
    g.translate(-cam.cx + cam.px * W * depth, -cam.cy + cam.py * H * depth);
  };
  const blur = px => { if (px > .3 && 'filter' in g) g.filter = `blur(${px.toFixed(1)}px)`; };  // rack focus: the back planes go soft
  g.save(); camT(.55); blur(cam.blurFar || 0); paintGroup(R, pl.far, pm, { kind: 'place', plane: 'far', key: 'far:' + shot.place }); g.restore();
  // props attached to the place (sun, clouds) come from the bible's place spec
  const extra = R.bible.places?.[shot.place]?.props || [];
  g.save(); camT(.75); blur(cam.blurMid || 0);
  for (const [i, p] of extra.entries()) {
    const prims = placePrims(R.prop(p.kind, p.color), { x: R.stage.x0 + p.x * R.stage.w, y: R.stage.y0 + p.y * R.stage.h, h: (p.scale || 1) * .12 * R.stage.h, flip: p.flip ? -1 : 1 });
    paintGroup(R, prims, { ...pm, ...(p.color ? { propA: p.color, custom: p.color } : {}) }, { kind: 'prop', key: 'placeprop' + i, depth: .75 });
  }
  g.restore();
  g.save(); camT(.8); blur(cam.blurMid || 0); paintGroup(R, pl.mid, pm, { kind: 'place', plane: 'mid', key: 'mid:' + shot.place }); g.restore();
  g.save(); camT(1);
  for (const p of layers) {
    if (!p.prims) continue;
    const prims = placePrims(p.prims, p.xf);
    g.save(); g.globalAlpha = p.a.alpha;
    if (p.a.glow > 0 && opts.glow) opts.glow(R, p, prims);
    paintGroup(R, prims, p.m, { kind: p.layer.type, key: (p.layer.id || p.layer.kind || p.layer.type) + ':' + shot.id, layer: p.layer, a: p.a, xf: p.xf });
    g.restore();
  }
  g.restore();
}

/** Simple radial burst behind a revealed product (used by several styles). */
export function burst(R, p, prims, color, rays = 14, alpha = .5) {
  const { g } = R, xs = prims.flatMap(q => q.pts ? q.pts.map(v => v[0]) : [q.x ?? q.x1]), ys = prims.flatMap(q => q.pts ? q.pts.map(v => v[1]) : [q.y ?? q.y1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const r = Math.max(R.W, R.H) * .8 * p.a.glow;
  g.save(); g.globalAlpha = alpha * p.a.glow; g.fillStyle = color; g.translate(cx, cy); g.rotate(R.t * .15);
  for (let i = 0; i < rays; i++) { const a = i / rays * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a, a + Math.PI / rays); g.closePath(); g.fill(); }
  g.restore();
}

/** Wraps text lines into a filled block: used by caption painters. */
export function captionLines(g, text, font, size, maxW) {
  g.font = `${font.weight || 700} ${size}px ${font.family}`;
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}

/** Generic transitions; styles pass colours. */
export function transition(R, kind, p, colors) {
  const { g, W, H } = R;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (kind === 'wipe') { const x = lerp(-W * .2, W * 1.2, eo(p)); g.fillStyle = colors[0]; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + W * .25, 0); g.lineTo(x + W * .1, H); g.lineTo(x - W * .15, H); g.fill(); }
  else if (kind === 'slide') { g.fillStyle = colors[0]; g.fillRect(0, 0, W, H * (1 - eo(p)) * .5); g.fillRect(0, H - H * (1 - eo(p)) * .5, W, H); }
  else if (kind === 'iris') { const r = Math.hypot(W, H) * eo(p); g.fillStyle = colors[0]; g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H * .45, Math.max(1, r), 0, Math.PI * 2, true); g.fill(); }
  else if (kind === 'fade') { g.globalAlpha = 1 - p; g.fillStyle = colors[0]; g.fillRect(0, 0, W, H); }
  else if (kind === 'stripes') { const n = 7; g.fillStyle = colors[0]; for (let i = 0; i < n; i++) { const q = 1 - eo(seg(p, i * .06, .6 + i * .06)); g.fillRect(i * W / n, 0, W / n + 1, H * q); } }
  g.restore();
}
