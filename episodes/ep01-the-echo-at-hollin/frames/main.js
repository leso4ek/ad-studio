// Case 01 — The Echo at Hollin · style-frame page (90s Apocalypse Anime)
import { canvas, W, H } from './cel.js';
import { makePost } from './post.js';
import { card, flash } from './cards.js';
import { UI, hexField, stripes, narrow, mono, rolling, votePanel } from './alarm.js';
import { horizon } from './scene.js';

const qs = new URLSearchParams(location.search);
const [sc, g] = canvas(W, H), [gc, e] = canvas(W, H), [ovc, ov] = canvas(W, H);
const post = makePost(document.getElementById('gl'));
for (const f of ['900 80px "Card Serif"', '600 50px "UI Narrow"', '700 50px "UI Narrow"', '500 30px "UI Mono"']) await document.fonts.load(f);
const CUES = await (await fetch('cues.json')).json();

// 90s broadcast tape: much milder than the 80s pass
const TAPE = { scan: .07, grille: .02, bleed: 3, rshift: 1, glow: .16, corner: .16, noiseA: .02, bloom: .45, halo: .1, flick: .004, power: 1, track: 0,
  sat: 1.0, lift: .02, contrast: .1, fade: .02, tint: [1, .99, .98], shadowTint: [.06, .08, .09] };

const BAR = ['AUGUST', '1999', 'IT USED', 'OUR VOICES'], BT = [0, .25, .5, .9];
const SHOTS = [
  [0, 3, 'barrage'], [3, 10.2, 'sunset'], [21, 24.4, 'title'], [60.4, 71, 'vote'], [97.4, 118, 'night'], [118, 120, 'final'],
];
function shot(t, lt, name) {
  if (name === 'barrage') { let k = 0; while (k < 3 && t >= BT[k + 1]) k++; const w = BAR[k];
    if (k === 3) card(g, [{ t: 'OUR', x: 60, y: 470, size: 500, fitW: 900, maxSize: 520, sx: .6 }, { t: 'VOICES', x: 60, y: 1030, size: 500, fitW: W - 120, maxSize: 560, sx: .6 }]);
    else flash(g, w, { sx: k === 1 ? 1.45 : .58 }); return; }
  if (name === 'sunset') return horizon(g, e, t, 'sunset');
  if (name === 'night') return horizon(g, e, t, 'night');
  if (name === 'title') { // L-block: CASE 01 big top-left, the title down the right edge
    const it = card(g, [{ t: 'CASE', x: 70, y: 450, size: 420, fitW: 1300, maxSize: 520, sx: .6 }, { t: '01', x: 70, y: 1010, size: 600, fitW: 640, maxSize: 560, sx: .62 },
      { t: 'THE ECHO AT HOLLIN', x: 1720, y: 70, size: 140, fitW: 940, maxSize: 150, sx: .62, rot: Math.PI / 2 }]);
    g.fillStyle = '#f1efe8'; g.fillRect(560, 620, 1100, 10); mono(g, 30); g.fillText('AUGUST 1999 — HOLLIN VALLEY ARRAY', 570, 680); return; }
  if (name === 'final') { card(g, [{ t: 'DON\u2019T', x: 80, y: 560, size: 500, fitW: 1100, sx: .6, c: '#060606' }, { t: 'ANSWER.', x: 80, y: 1010, size: 500, fitW: 1760, sx: .6, c: '#060606' }], { bg: '#ecebe4' }); return; }
  if (name === 'vote') {
    g.fillStyle = UI.bg; g.fillRect(0, 0, W, H);
    const pw = 560, gap = 40, x0 = (W - 3 * pw - 2 * gap) / 2;
    const v3 = t < 67.4 ? '' : t < 69.2 ? 'NO' : 'YES';
    votePanel(g, e, x0, 70, pw, 400, 'SYSTEM 1', t >= 63 ? 'YES' : '');
    votePanel(g, e, x0 + pw + gap, 70, pw, 400, 'SYSTEM 2', t >= 65 ? 'YES' : '');
    votePanel(g, e, x0 + 2 * (pw + gap), 70, pw, 400, 'SYSTEM 3 · MANUAL', v3, { flip: t >= 69.2, code: 'OPERATOR  M. ITO' });
    if (t >= 69.4) {
      const lt2 = t - 69.4;
      hexField(g, e, x0, 510, 3 * pw + 2 * gap, 330, t);
      g.fillStyle = 'rgba(0,0,0,.78)'; g.fillRect(x0 + 260, 600, 3 * pw + 2 * gap - 520, 150);
      g.save(); g.translate(W / 2, 712); g.scale(.62, 1); narrow(g, 170); g.textAlign = 'center'; g.fillStyle = UI.red; g.fillText('TRANSMITTING', 0, 0);
      e.save(); e.translate(W / 2, 712); e.scale(.62, 1); e.font = g.font; e.textAlign = 'center'; e.fillStyle = 'rgba(255,40,30,.7)'; e.fillText('TRANSMITTING', 0, 0); e.restore(); g.restore();
      stripes(g, x0, 860, 3 * pw + 2 * gap, 34, t);
      mono(g, 26); g.fillStyle = UI.org; g.textAlign = 'left';
      g.fillText('TARGET  PATHLIGHT-2   RA 17h42m  DEC −28°55′', x0, 930);
      g.textAlign = 'right'; g.fillText('POWER ' + rolling('98.6', lt2, .6) + ' kW   T+' + rolling('00:00:01', lt2, .6), x0 + 3 * pw + 2 * gap, 930); g.textAlign = 'left';
    }
    return;
  }
}
const SPEAKER = { 'MARA (playback)': 'MARA — PLAYBACK', 'DEV (playback)': 'DEV — PLAYBACK' };
function captions(t) {
  ov.clearRect(0, 0, W, H);
  const c = CUES.find(c => t >= c.t0 && t < c.t1); if (!c) return [];
  const play = SPEAKER[c.who];
  ov.font = `${play ? 'italic ' : ''}600 50px "UI Narrow"`; ov.textAlign = 'center'; ov.textBaseline = 'alphabetic';
  // wrap to ≤ 1500 px, max two lines
  const words = c.text.split(' '), lines = ['']; for (const w of words) { const n = (lines.at(-1) + ' ' + w).trim(); if (ov.measureText(n).width > 1500) lines.push(w); else lines[lines.length - 1] = n; }
  const y0 = H - 90 - (lines.length - 1) * 60;
  ov.lineJoin = 'round'; ov.lineWidth = 8; ov.strokeStyle = '#0b0b0b'; ov.fillStyle = '#ffffff';
  lines.forEach((l, i) => { ov.strokeText(l, W / 2, y0 + i * 60); ov.fillText(l, W / 2, y0 + i * 60); });
  if (play) { ov.font = '500 24px "UI Mono"'; ov.fillStyle = UI.org; ov.lineWidth = 5; ov.strokeText(play, W / 2, y0 - 56); ov.fillText(play, W / 2, y0 - 56); }
  return [{ id: 'cap', text: c.text, x0: W / 2 - 760, y0: y0 - 50, x1: W / 2 + 760, y1: y0 + (lines.length - 1) * 60 + 12 }];
}
function render(t) {
  for (const x of [g, e]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.textAlign = 'left'; }
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const s = SHOTS.find(s => t >= s[0] && t < s[1]);
  if (s) shot(t, t - s[0], s[2]);
  if (qs.get('nosub')) ov.clearRect(0, 0, W, H); else captions(t);
  post.render(sc, gc, Math.round(t * 24), ovc, qs.get('raw') ? { scan: 0, grille: 0, bleed: 1, rshift: 0, glow: 0, corner: 0, noiseA: 0, bloom: 0, halo: 0 } : TAPE);
}
window.render = render; window.DUR = 120;
render(parseFloat(qs.get('t') ?? '5'));
window.READY = true;
