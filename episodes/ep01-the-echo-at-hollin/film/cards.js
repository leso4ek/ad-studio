// cards.js — squeezed / stretched heavy-serif intertitles (90s Apocalypse Anime)
// card(g, items, {bg, fg}) ; item = {t, x, y, size | fitW, sx, rot, align:'l'|'r'}
import { W, H } from './cel.js';
export const CARD_FONT = '"Card Serif"';

export function textW(g, t, size) { g.font = `900 ${size}px ${CARD_FONT}`; return g.measureText(t).width; }

export function card(g, items, o = {}) {
  const bg = o.bg || '#060606', fg = o.fg || '#f1efe8';
  g.save(); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (const it of items) {
    const sx = it.sx ?? 0.62;
    let size = it.size || 200;
    if (it.fitW) size = size * it.fitW / (textW(g, it.t, size) * sx);   // fill a block width exactly
    if (it.maxSize) size = Math.min(size, it.maxSize);                 // …but never taller than the block allows
    g.save(); g.translate(it.x, it.y); if (it.rot) g.rotate(it.rot); g.scale(sx, 1);
    g.font = `900 ${size}px ${CARD_FONT}`; g.fillStyle = it.c || fg; g.textBaseline = 'alphabetic';
    const w = g.measureText(it.t).width;
    g.fillText(it.t, it.align === 'r' ? -w : 0, 0);
    g.restore();
    it._size = size; it._w = w * sx;
  }
  g.restore();
  return items;
}

// a frame-filling flash card: one word squeezed to the full width, touching the edges
export function flash(g, word, o = {}) {
  return card(g, [{ t: word, x: o.x ?? 40, y: o.y ?? H * 0.78, size: 900, fitW: o.w ?? W - 80, sx: o.sx ?? 0.58 }], o);
}
