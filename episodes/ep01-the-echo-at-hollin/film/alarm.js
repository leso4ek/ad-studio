// alarm.js — interface layer: hex warning field, hazard stripes, vote panels, rolling numbers
import { W, H, hash } from './cel.js';
export const UI = { red: '#d81f26', org: '#ff7a1a', grn: '#38d26a', dim: '#3a1210', line: '#ff7a1a', bg: '#050505', white: '#f1efe8' };

const hexPath = (cx, cy, r) => { const p = new Path2D(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; k ? p.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : p.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } p.closePath(); return p; };

// hex field in a box; lit cells follow a wave + hash, so it is deterministic in t
export function hexField(g, e, x, y, w, h, t, o = {}) {
  const r = o.r || 34, dx = r * Math.sqrt(3), dy = r * 1.5;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  e.save(); e.beginPath(); e.rect(x, y, w, h); e.clip();
  g.lineWidth = 2;
  for (let j = -1, row = 0; y + j * dy < y + h + r; j++, row++) for (let i = -1; x + i * dx < x + w + r; i++) {
    const cx = x + i * dx + (j & 1 ? dx / 2 : 0), cy = y + j * dy, P = hexPath(cx, cy, r - 3);
    const on = Math.sin(i * .7 - t * 6 + j * .4) + hash(i * 31 + j * 7 + Math.floor(t * 8)) * 1.4 > 1.05;
    g.strokeStyle = UI.dim; g.stroke(P);
    if (on) { g.fillStyle = o.c || UI.red; g.fill(P); e.fillStyle = 'rgba(255,40,20,.55)'; e.fill(P); }
  }
  g.restore(); e.restore();
}

export function stripes(g, x, y, w, h, t, c = UI.org) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = '#000'; g.fillRect(x, y, w, h); g.fillStyle = c;
  const s = h * 1.1, off = (t * 120) % (s * 2);
  for (let k = -2; k * s * 2 < w + s * 4; k++) { const x0 = x + k * s * 2 + off; g.beginPath(); g.moveTo(x0, y + h); g.lineTo(x0 + s, y + h); g.lineTo(x0 + s + h, y); g.lineTo(x0 + h, y); g.fill(); }
  g.restore();
}

export const narrow = (g, size, wt = 700) => g.font = `${wt} ${size}px "UI Narrow"`;
export const mono = (g, size) => g.font = `500 ${size}px "UI Mono"`;

// rolling number: garbage glyphs settle into the value over `dur` seconds
export function rolling(val, lt, dur = .6) {
  if (lt >= dur) return val;
  const G = '0123456789#%/+-';
  return [...val].map((ch, i) => (lt > dur * (i + 1) / val.length || ch === ' ' || ch === '.') ? ch : G[Math.floor(hash(i * 13 + Math.floor(lt * 30)) * G.length)]).join('');
}

// a vote panel: frame, header, verdict stamp
export function votePanel(g, e, x, y, w, h, name, verdict, o = {}) {
  const c = verdict === 'YES' ? UI.grn : verdict === 'NO' ? UI.red : UI.org;
  g.save();
  g.fillStyle = '#0a0a0a'; g.fillRect(x, y, w, h);
  g.strokeStyle = UI.org; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  g.fillStyle = UI.org; g.fillRect(x, y, w, 54);
  narrow(g, 40); g.fillStyle = '#000'; g.textBaseline = 'middle'; g.fillText(name, x + 18, y + 28);
  mono(g, 22); g.fillStyle = UI.org; g.fillText(o.code || 'PROTOCOL 7-A  REPLY REQ.', x + 18, y + 84);
  if (verdict) {
    g.save(); g.translate(x + w / 2, y + h * .62); g.scale(.72, 1); narrow(g, 190);
    g.textAlign = 'center'; g.fillStyle = c; g.fillText(verdict, 0, 0);
    e.save(); e.translate(x + w / 2, y + h * .62); e.scale(.72, 1); e.font = g.font; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillStyle = c; e.globalAlpha = .6; e.fillText(verdict, 0, 0); e.restore();
    g.restore();
  }
  if (o.flip) { g.fillStyle = UI.red; mono(g, 22); g.fillText('OVERRIDE REJECTED', x + 18, y + h - 30); }
  g.restore();
}
