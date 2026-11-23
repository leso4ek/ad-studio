// Ad Studio kit · 2D path builders and the shared primitive painter used by the Canvas styles.
export function pathPrim(g, p, jit = null) {
  const J = jit || ((x, y) => [x, y]);
  g.beginPath();
  switch (p.s) {
    case 'ellipse': {
      const n = 40;
      for (let i = 0; i <= n; i++) {
        const a = i / n * Math.PI * 2, c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0);
        const ex = Math.cos(a) * p.rx, ey = Math.sin(a) * p.ry;
        const [x, y] = J(p.x + ex * c - ey * s, p.y + ex * s + ey * c, i);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      break;
    }
    case 'rrect': {
      const r = Math.min(p.r || 0, p.w / 2, p.h / 2), x0 = -p.w / 2, y0 = -p.h / 2, x1 = p.w / 2, y1 = p.h / 2;
      const pts = [];
      const corner = (cx, cy, a0) => { const n = r > 0 ? 6 : 0; for (let i = 0; i <= n; i++) { const a = a0 + i / Math.max(1, n) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
      corner(x1 - r, y1 - r, 0); corner(x0 + r, y1 - r, Math.PI / 2); corner(x0 + r, y0 + r, Math.PI); corner(x1 - r, y0 + r, Math.PI * 1.5);
      const c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0);
      pts.forEach(([px, py], i) => { const [x, y] = J(p.x + px * c - py * s, p.y + px * s + py * c, i); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      break;
    }
    case 'poly':
      p.pts.forEach(([px, py], i) => { const [x, y] = J(px, py, i); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      break;
    case 'cap': {
      const dx = p.x2 - p.x1, dy = p.y2 - p.y1, a = Math.atan2(dy, dx), n = 10, pts = [];
      for (let i = 0; i <= n; i++) { const b = a + Math.PI / 2 + i / n * Math.PI; pts.push([p.x1 + Math.cos(b) * p.r, p.y1 + Math.sin(b) * p.r]); }
      for (let i = 0; i <= n; i++) { const b = a - Math.PI / 2 + i / n * Math.PI; pts.push([p.x2 + Math.cos(b) * p.r, p.y2 + Math.sin(b) * p.r]); }
      pts.forEach(([px, py], i) => { const [x, y] = J(px, py, i); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      break;
    }
    case 'stroke':
      p.pts.forEach(([px, py], i) => { const [x, y] = J(px, py, i); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      return;
  }
  g.closePath();
}

/** Transform unit-space primitives (feet at 0) into pixels: xf = {x, y, h (pixel height of 1 unit), flip, rot, sx, sy} */
export function placePrims(prims, xf) {
  const { x, y, h, flip = 1, rot = 0, sx = 1, sy = 1 } = xf, c = Math.cos(rot), s = Math.sin(rot);
  const T = (px, py) => { px *= h * sx * flip; py *= h * sy; return [x + px * c - py * s, y + px * s + py * c]; };
  return prims.map(p => {
    const q = { ...p };
    if (p.s === 'ellipse') { [q.x, q.y] = T(p.x, p.y); q.rx = p.rx * h * sx; q.ry = p.ry * h * sy; q.rot = (p.rot || 0) * flip + rot; }
    else if (p.s === 'rrect') { [q.x, q.y] = T(p.x, p.y); q.w = p.w * h * sx; q.h = p.h * h * sy; q.r = (p.r || 0) * h * Math.min(sx, sy); q.rot = (p.rot || 0) * flip + rot; }
    else if (p.s === 'poly' || p.s === 'stroke') { q.pts = p.pts.map(([a, b]) => T(a, b)); if (p.w) q.w = p.w * h; }
    else if (p.s === 'cap') { [q.x1, q.y1] = T(p.x1, p.y1); [q.x2, q.y2] = T(p.x2, p.y2); q.r = p.r * h * sx; }
    else if (p.s === 'text') { [q.x, q.y] = T(p.x, p.y); q.size = p.size * h * sy; q.w = (p.w || 10) * h * sx; q.rot = rot; }
    return q;
  });
}

export function primBounds(p) {
  if (p.s === 'ellipse') return [p.x - p.rx, p.y - p.ry, p.x + p.rx, p.y + p.ry];
  if (p.s === 'rrect') return [p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2];
  if (p.s === 'cap') return [Math.min(p.x1, p.x2) - p.r, Math.min(p.y1, p.y2) - p.r, Math.max(p.x1, p.x2) + p.r, Math.max(p.y1, p.y2) + p.r];
  if (p.pts) { const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  return [p.x - p.w / 2, p.y - p.size, p.x + p.w / 2, p.y];
}

/** Draws a text primitive fitted to its width (product labels, prop text). */
export function primText(g, p, color, family, weight = 700) {
  g.save();
  let size = p.size;
  g.font = `${weight} ${size}px ${family}`;
  const tw = g.measureText(p.text).width;
  if (tw > p.w) { size *= p.w / tw; g.font = `${weight} ${size}px ${family}`; }
  g.fillStyle = color; g.textAlign = p.align || 'center'; g.textBaseline = 'alphabetic';
  g.translate(p.x, p.y); if (p.rot) g.rotate(p.rot);
  g.fillText(p.text, 0, 0);
  g.restore();
}

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

/** A deterministic paper/grain texture tile. */
export function noiseTile(size, seed, alpha = 18, mono = true) {
  const [c, g] = canvas(size, size), d = g.createImageData(size, size);
  let s = seed | 0;
  const r = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  for (let i = 0; i < size * size; i++) {
    const v = r() * 255, a = r() * alpha;
    d.data[i * 4] = v; d.data[i * 4 + 1] = mono ? v : r() * 255; d.data[i * 4 + 2] = mono ? v : r() * 255; d.data[i * 4 + 3] = a;
  }
  g.putImageData(d, 0, 0);
  return c;
}
