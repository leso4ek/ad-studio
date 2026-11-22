// Case 01 — The Echo at Hollin · film page (90s Apocalypse Anime). Shot list: ../TREATMENT.md §4
import { canvas, W, H } from './cel.js';
import { makePost } from './post.js';
import { card, flash } from './cards.js';
import { UI, hexField, stripes, narrow, mono, rolling, votePanel } from './alarm.js';
import { horizon } from './scene.js';
import { insert, monitorWall, vending, topDown, eye, crossLight, CROSS, collapse, scaleReveal } from './scenes2.js';

const qs = new URLSearchParams(location.search);
const [sc, g] = canvas(W, H), [gc, e] = canvas(W, H), [ovc, ov] = canvas(W, H);
const post = makePost(document.getElementById('gl'));
for (const f of ['900 80px "Card Serif"', '600 50px "UI Narrow"', 'italic 600 50px "UI Narrow"', '700 50px "UI Narrow"', '500 30px "UI Mono"']) await document.fonts.load(f);
const CUES = await (await fetch('cues.json')).json();

// 90s broadcast tape: much milder than the 80s pass
const TAPE = { scan: .07, grille: .02, bleed: 3, rshift: 1, glow: .16, corner: .16, noiseA: .02, bloom: .45, halo: .1, flick: .004, power: 1, track: 0,
  sat: 1.0, lift: .02, contrast: .1, fade: .02, tint: [1, .99, .98], shadowTint: [.06, .08, .09] };

export const DUR = 120;
const SHOTS = [
  [0, 3, 'barrage1'], [3, 10.2, 'sunset'], [10.2, 16.6, 'kling'], [16.6, 21, 'insert'], [21, 24.4, 'title'], [24.4, 34.2, 'wall'],
  [34.2, 39.4, 'vendNight'], [39.4, 44, 'vendMorning'], [44, 47.6, 'barrage2'], [47.6, 48.4, 'black'], [48.4, 55, 'topdown'],
  [55, 60.4, 'eye'], [60.4, CROSS.t0, 'vote'], [CROSS.t0, CROSS.end, 'cross'], [CROSS.end, 75.6, 'black'], [75.6, 89.6, 'collapse'],
  [89.6, 97.4, 'reveal'], [97.4, 117.5, 'night'], [117.5, 120.01, 'final'],
];
const B1 = ['AUGUST', '1999', 'IT USED', 'OUR VOICES'], B1T = [0, .25, .5, .9];
const B2 = ['12 DAYS', '3 DAYS', '9 HOURS', '40 MINUTES'];
const ALARM = 69.3;

// shot 3: the Kling control-room clip, 121 frames stretched over the 6.4 s shot, decoded on demand (deterministic)
const kimg = new Image(); let kidx = -1;
async function kling(lt) {
  const i = Math.min(121, 1 + Math.floor(lt / 6.4 * 121));
  if (i !== kidx) { kimg.src = `kling3/f${String(i).padStart(3, '0')}.jpg`; await kimg.decode(); kidx = i; }
  g.drawImage(kimg, 0, 0, W, H);
  e.globalAlpha = .28; e.drawImage(kimg, 0, 0, W, H); e.globalAlpha = 1;     // let the CRT monitors bloom
}

async function shot(t, lt, name) {
  switch (name) {
    case 'barrage1': { let k = 0; while (k < 3 && t >= B1T[k + 1]) k++;
      if (k === 3) card(g, [{ t: 'OUR', x: 60, y: 470, size: 500, fitW: 900, maxSize: 520, sx: .6 }, { t: 'VOICES', x: 60, y: 1030, size: 500, fitW: W - 120, maxSize: 560, sx: .6 }]);
      else flash(g, B1[k], { sx: k === 1 ? 1.45 : .58 }); return; }
    case 'barrage2': { const k = Math.min(3, Math.floor(lt)); const [n, u] = B2[k].split(' ');
      card(g, [{ t: n, x: 70, y: 820, size: 700, fitW: 900, maxSize: 900, sx: .62 }, { t: u, x: 1650, y: 70, size: 200, fitW: 940, maxSize: 230, sx: .6, rot: Math.PI / 2 }]); return; }
    case 'sunset': return horizon(g, e, t, 'sunset');
    case 'night': return horizon(g, e, t, 'night');
    case 'kling': return kling(lt);
    case 'insert': return insert(g, e, t, lt);
    case 'wall': return monitorWall(g, e, t, lt);
    case 'vendNight': return vending(g, e, t, lt, 'night');
    case 'vendMorning': return vending(g, e, t, lt, 'morning');
    case 'topdown': return topDown(g, e, t, lt);
    case 'eye': return eye(g, e, t, lt);
    case 'cross': return crossLight(g, e, t, lt);
    case 'collapse': return collapse(g, e, t, lt);
    case 'reveal': return scaleReveal(g, e, t, lt);
    case 'black': g.fillStyle = '#000'; g.fillRect(0, 0, W, H); return;
    case 'title': {
      card(g, [{ t: 'CASE', x: 70, y: 450, size: 420, fitW: 1300, maxSize: 520, sx: .6 }, { t: '01', x: 70, y: 1010, size: 600, fitW: 640, maxSize: 560, sx: .62 },
        { t: 'THE ECHO AT HOLLIN', x: 1720, y: 70, size: 140, fitW: 940, maxSize: 150, sx: .62, rot: Math.PI / 2 }]);
      g.fillStyle = '#f1efe8'; g.fillRect(560, 620, 1100, 10); mono(g, 30); g.fillText('AUGUST 1999 — HOLLIN VALLEY ARRAY', 570, 680); return; }
    case 'final': card(g, [{ t: 'DON’T', x: 80, y: 560, size: 500, fitW: 1100, sx: .6, c: '#060606' }, { t: 'ANSWER.', x: 80, y: 1010, size: 500, fitW: 1760, sx: .6, c: '#060606' }], { bg: '#ecebe4' }); return;
    case 'vote': {
      g.fillStyle = UI.bg; g.fillRect(0, 0, W, H);
      const pw = 560, gap = 40, x0 = (W - 3 * pw - 2 * gap) / 2;
      const v3 = t < 67.4 ? '' : t < 69.2 ? 'NO' : 'YES';
      if (lt >= 0) votePanel(g, e, x0, 70, pw, 400, 'SYSTEM 1', t >= 63 ? 'YES' : '');
      if (lt >= 3 / 24) votePanel(g, e, x0 + pw + gap, 70, pw, 400, 'SYSTEM 2', t >= 65 ? 'YES' : '');
      if (lt >= 6 / 24) votePanel(g, e, x0 + 2 * (pw + gap), 70, pw, 400, 'SYSTEM 3 · MANUAL', v3, { flip: t >= 69.2, code: 'OPERATOR  M. ITO' });
      if (t >= ALARM) {
        const lt2 = t - ALARM;
        hexField(g, e, x0, 510, 3 * pw + 2 * gap, 330, t);
        g.fillStyle = 'rgba(0,0,0,.78)'; g.fillRect(x0 + 260, 600, 3 * pw + 2 * gap - 520, 150);
        g.save(); g.translate(W / 2, 712); g.scale(.62, 1); narrow(g, 170); g.textAlign = 'center'; g.fillStyle = UI.red; g.fillText('TRANSMITTING', 0, 0);
        e.save(); e.translate(W / 2, 712); e.scale(.62, 1); e.font = g.font; e.textAlign = 'center'; e.fillStyle = 'rgba(255,40,30,.7)'; e.fillText('TRANSMITTING', 0, 0); e.restore(); g.restore();
        stripes(g, x0, 860, 3 * pw + 2 * gap, 34, t);
        mono(g, 26); g.fillStyle = UI.org; g.textAlign = 'left';
        g.fillText('TARGET  PATHLIGHT-2   RA 17h42m  DEC −28°55′', x0, 930);
        g.textAlign = 'right'; g.fillText('POWER ' + rolling('98.6', lt2, .6) + ' kW   T+' + rolling('00:00:0' + Math.min(9, Math.floor(lt2)), lt2, .6), x0 + 3 * pw + 2 * gap, 930); g.textAlign = 'left';
      }
      return; }
  }
}

const SPEAKER = { 'MARA (playback)': 'MARA — PLAYBACK', 'DEV (playback)': 'DEV — PLAYBACK' };
function captions(t) {
  ov.clearRect(0, 0, W, H);
  const c = CUES.find(c => t >= c.t0 && t < c.t1); if (!c) return;
  const play = SPEAKER[c.who];
  ov.font = `${play ? 'italic ' : ''}600 50px "UI Narrow"`; ov.textAlign = 'center'; ov.textBaseline = 'alphabetic';
  const words = c.text.split(' '), lines = ['']; for (const w of words) { const n = (lines.at(-1) + ' ' + w).trim(); if (ov.measureText(n).width > 1500) lines.push(w); else lines[lines.length - 1] = n; }
  const y0 = H - 90 - (lines.length - 1) * 60;
  ov.lineJoin = 'round'; ov.lineWidth = 8; ov.strokeStyle = '#0b0b0b'; ov.fillStyle = '#ffffff';
  lines.forEach((l, i) => { ov.strokeText(l, W / 2, y0 + i * 60); ov.fillText(l, W / 2, y0 + i * 60); });
  if (play) { ov.font = '500 24px "UI Mono"'; ov.fillStyle = UI.org; ov.lineWidth = 5; ov.strokeText(play, W / 2, y0 - 56); ov.fillText(play, W / 2, y0 - 56); }
}

async function render(t) {
  for (const x of [g, e]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; }
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const s = SHOTS.find(s => t >= s[0] && t < s[1]);
  if (s) await shot(t, t - s[0], s[2]);
  if (qs.get('nosub')) ov.clearRect(0, 0, W, H); else captions(t);
  post.render(sc, gc, Math.round(t * 24), ovc, qs.get('raw') ? { scan: 0, grille: 0, bleed: 1, rshift: 0, glow: 0, corner: 0, noiseA: 0, bloom: 0, halo: 0 } : TAPE);
}

// every text the viewer must read, for readcheck (captions are checked by their .srt; flash cards are deliberately short)
function TEXTS(t) {
  const s = SHOTS.find(s => t >= s[0] && t < s[1]); if (!s) return [];
  const lt = t - s[0], box = (id, text, x0, y0, x1, y1, pass = false) => ({ id, text, x0, y0, x1, y1, pass });
  switch (s[2]) {
    case 'barrage1': case 'barrage2': return [box('flash', 'card', 0, 0, W, H, true)];
    case 'title': return [box('title', 'CASE 01 THE ECHO AT HOLLIN', 70, 70, 1860, 1010), box('sub', 'AUGUST 1999 — HOLLIN VALLEY ARRAY', 570, 650, 1200, 690, true)];
    case 'final': return [box('final', 'DON’T ANSWER.', 80, 160, 1840, 1010)];
    case 'insert': return [box('match', 'CREW VOICE MATCH', 1040, 500, 1400, 540), box('pct', t >= 18 ? '99.7%' : 'rolling', 1040, 530, 1300, 620, t < 18)];
    case 'wall': return [box('wallfine', 'panel labels', 0, 0, W, H, true), box('date', t >= 30.6 ? '1999-08-26 03:12' : 'rolling', 1000, 520, 1800, 640, t < 30.6)];
    case 'vote': {
      const r = [box('s1', 'SYSTEM 1', 80, 70, 640, 124), box('fine', 'fine print', 0, 840, W, 950, true)];
      if (lt >= 3 / 24) r.push(box('s2', 'SYSTEM 2', 680, 70, 1240, 124));
      if (lt >= 6 / 24) r.push(box('s3', 'SYSTEM 3 · MANUAL', 1280, 70, 1840, 124));
      if (t >= 63) r.push(box('v1', 'YES', 160, 220, 560, 380)); if (t >= 65) r.push(box('v2', 'YES', 760, 220, 1160, 380));
      if (t >= 67.4) r.push(box('v3', t < 69.2 ? 'NO' : 'YES', 1360, 220, 1760, 380));
      if (t >= ALARM) r.push(box('tx', 'TRANSMITTING', 500, 600, 1420, 750));
      return r; }
    case 'collapse': { const q = t >= 84.5 && t < 86.5 ? 'WHERE' : t >= 87.5 && t < 89.5 ? 'CLOSER' : null; return q ? [box('q', q, 1500, 120, 1700, 900)] : []; }
  }
  return [];
}

// sound events for mix.py
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  B1T.forEach(t => add('chirp', t)); add('chirp', 21, { v: .6 }); add('chirp', 117.5, { v: .6 });
  for (let k = 0; k < 4; k++) add('thump', 44 + k);
  for (let k = 0; k < 4; k++) add('pop', 24.4 + k * 3 / 24);
  add('chatter', 16.6, { d: 1.4 }); add('chatter', 30, { d: .6 });
  for (let k = 0; k < 3; k++) add('relay', 60.4 + k * 3 / 24);
  add('stamp', 63); add('stamp', 65); add('stamp', 67.4, { v: .9 }); add('stamp', 69.2, { v: 1.1 });
  add('alarm', ALARM, { d: CROSS.t0 - ALARM });
  add('swell', CROSS.t0, { d: CROSS.hit - CROSS.t0 }); add('impact', CROSS.hit); add('ring', CROSS.hit, { d: CROSS.end - CROSS.hit });
  for (let t = 75.9; t < 89.4; t += .55 + .5 * Math.abs(Math.sin(t * 7.1))) add('pencil', t);
  add('chirp', 84.5, { v: .5 }); add('chirp', 87.5, { v: .5 });
  for (let t = 90; t < 117.5; t += 1.5) add('tick', t);
  add('silence', 47.6, { d: .8 }); add('silence', CROSS.end, { d: 75.6 - CROSS.end });
  return ev.sort((a, b) => a.t - b.t);
}

window.EV = events(); window.TEXTS = TEXTS; window.SHOTS = SHOTS;
window.render = render; window.DUR = DUR;
await render(parseFloat(qs.get('t') ?? '5'));
window.READY = true;
