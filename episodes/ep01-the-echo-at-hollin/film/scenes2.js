// scenes2.js — the shots of Case 01 that the style frames did not cover (90s Apocalypse Anime)
// every drawer: (g, e, t, lt) — g = scene canvas, e = glow (emissive) canvas, t = film time, lt = time in shot
import { W, H, cel, line, rng, hash, vgrad, rgba } from './cel.js';
import { card, CARD_FONT } from './cards.js';
import { UI, narrow, mono, rolling, hexField, stripes } from './alarm.js';
import { horizon } from './scene.js';

export const P = { white: '#ecebe4', teal: '#0e2a30', black: '#060606', sunset: '#e8792b', red: '#d81f26', org: '#ff7a1a', grn: '#38d26a',
  violet: '#5b2a86', acid: '#9be34a', paper: '#e6e0d1', pencil: '#34322e', skin: '#d9b49a', skinS: '#b48a72', hair: '#1c1a22' };
const st12 = t => Math.floor(t * 12) / 12;                 // things on twos
const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const pts1 = a => a.map(p => [p[0], p[1], 1]);             // sharp-cornered polygon for cel()

// a CRT screen with a live waveform (deterministic in t)
export function waveform(g, e, x, y, w, h, t, o = {}) {
  const c = o.c || UI.grn;
  g.save(); g.fillStyle = '#04100a'; g.fillRect(x, y, w, h);
  g.strokeStyle = rgba(c, .18); g.lineWidth = 1.5;
  for (let k = 1; k < 8; k++) { g.beginPath(); g.moveTo(x + w * k / 8, y); g.lineTo(x + w * k / 8, y + h); g.stroke(); }
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x, y + h * k / 4); g.lineTo(x + w, y + h * k / 4); g.stroke(); }
  const amp = o.amp ?? 1, tt = st12(t);
  g.beginPath();
  for (let i = 0; i <= 160; i++) {
    const u = i / 160, burst = Math.exp(-Math.pow((u - .5 - .25 * Math.sin(tt * 1.7)) * 4, 2));
    const v = (Math.sin(u * 70 + tt * 9) * .5 + (hash(i * 3.1 + Math.floor(tt * 12)) - .5)) * burst * amp;
    const px = x + u * w, py = y + h / 2 - v * h * .42;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.strokeStyle = c; g.lineWidth = 3; g.stroke();
  e.fillStyle = rgba(c, .12); e.fillRect(x, y, w, h);
  g.restore();
}

// ── shot 4: headphones on the desk, a monitor reading CREW VOICE MATCH; a 10-frame push ─────────────
export function insert(g, e, t, lt) {
  const k = 1 + .14 * easeOut(lt / (10 / 24));
  g.save(); e.save();
  for (const c of [g, e]) { c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-W / 2, -H / 2); }
  vgrad(g, 0, 0, W, H, [[0, '#0b1c20'], [1, '#081316']]);
  g.fillStyle = '#122a2e'; g.fillRect(0, 640, W, 440);                           // desk top
  g.fillStyle = '#0a1a1d'; g.fillRect(0, 640, W, 14);
  // the monitor, the brightest thing in the room
  cel(g, pts1([[980, 120], [1800, 120], [1800, 640], [980, 640]]), { f: '#1d2b2c', s: '#121c1d', so: [-18, 0], l: '#070c0d', lw: 2.4 });
  waveform(g, e, 1030, 170, 720, 300, t, { amp: 1.2 });
  narrow(g, 34, 700); g.fillStyle = UI.grn; g.textBaseline = 'alphabetic';
  g.fillText('CREW VOICE MATCH', 1040, 530);
  g.save(); g.translate(1040, 610); g.scale(.75, 1); narrow(g, 96, 700); g.fillText(rolling('99.7%', lt, 1.4), 0, 0); g.restore();
  e.fillStyle = rgba(UI.grn, .35); e.fillRect(1030, 480, 720, 140);
  // headphones (cels): band + two cups, a cable to the desk edge
  g.lineCap = 'round';
  g.strokeStyle = '#05090a'; g.lineWidth = 34; g.beginPath(); g.arc(520, 760, 230, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  g.strokeStyle = '#2a3436'; g.lineWidth = 22; g.stroke();
  g.strokeStyle = '#3e4b4d'; g.lineWidth = 6; g.beginPath(); g.arc(520, 760, 236, Math.PI * 1.15, Math.PI * 1.5); g.stroke();
  for (const [cx, rot] of [[300, -.35], [740, .35]]) {
    const pts = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push([cx + Math.cos(a) * 95 * Math.cos(rot) - Math.sin(a) * 125 * Math.sin(rot), 800 + Math.cos(a) * 95 * Math.sin(rot) + Math.sin(a) * 125 * Math.cos(rot)]); }
    cel(g, pts, { f: '#242e30', s: '#11181a', so: [-20, 10], h: '#4b5b5d', ho: [8, -12], l: '#05090a', lw: 2.6 });
  }
  g.strokeStyle = '#05090a'; g.lineWidth = 7; g.beginPath(); g.moveTo(760, 900); g.bezierCurveTo(900, 1010, 1100, 960, 1280, 1090); g.stroke();
  // a faint green spill from the screen on the desk (flat parallelogram)
  g.fillStyle = rgba(UI.grn, .07); g.beginPath(); g.moveTo(980, 654); g.lineTo(1800, 654); g.lineTo(1920, 900); g.lineTo(860, 900); g.fill();
  g.restore(); e.restore();
}

// ── shot 6: monitor wall, 4 panels pop on 3 frames apart ────────────────────────────────────────────────
export function monitorWall(g, e, t, lt) {
  g.fillStyle = UI.bg; g.fillRect(0, 0, W, H);
  const pw = 860, ph = 430, gx = 40, x0 = (W - 2 * pw - gx) / 2, y0 = 70;
  for (let k = 0; k < 4; k++) {
    if (lt < k * 3 / 24) continue;
    const x = x0 + (k % 2) * (pw + gx), y = y0 + Math.floor(k / 2) * (ph + 40);
    g.fillStyle = '#0a0a0a'; g.fillRect(x, y, pw, ph);
    g.strokeStyle = UI.org; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, pw - 3, ph - 3);
    g.fillStyle = UI.org; g.fillRect(x, y, pw, 50);
    narrow(g, 36, 700); g.fillStyle = '#000'; g.textBaseline = 'middle';
    g.fillText(['FILE 01 · PLAYBACK', 'FILE TIMESTAMP', 'SPECTRUM', 'SOURCE'][k], x + 18, y + 26);
    g.textBaseline = 'alphabetic';
    if (k === 0) waveform(g, e, x + 24, y + 74, pw - 48, ph - 100, t, { amp: lt < 4 ? 1.2 : .25 });
    if (k === 1) {
      mono(g, 26); g.fillStyle = UI.org; g.fillText('RECEIVED   1999-08-14 03:12', x + 30, y + 110);
      g.fillText('STAMPED', x + 30, y + 200);
      g.save(); g.translate(x + 30, y + 320); g.scale(.7, 1); narrow(g, 120, 700);
      const settled = t >= 30.6; g.fillStyle = settled ? UI.red : UI.org;
      g.fillText(t < 30 ? '—' : rolling('1999-08-26 03:12', t - 30, .6), 0, 0); g.restore();
      if (settled) { mono(g, 26); g.fillStyle = UI.red; g.fillText('Δ  +12 DAYS', x + 30, y + 395); e.fillStyle = rgba(UI.red, .3); e.fillRect(x + 20, y + 230, pw - 40, 110); }
    }
    if (k === 2) { for (let i = 0; i < 40; i++) { const hgt = (ph - 140) * (.15 + .85 * hash(i * 7 + Math.floor(st12(t) * 12) * .37) * Math.exp(-Math.pow((i - 14) / 12, 2))); g.fillStyle = UI.grn; g.fillRect(x + 30 + i * 20, y + ph - 40 - hgt, 14, hgt); } }
    if (k === 3) { mono(g, 26); g.fillStyle = UI.org; ['PROBE      PATHLIGHT-2', 'LAUNCHED   1977', 'LAST SIGNAL 1990', 'STATUS     NO POWER'].forEach((s, i) => g.fillText(s, x + 30, y + 110 + i * 70)); g.fillStyle = UI.red; g.fillText('CARRIER    PRESENT', x + 30, y + 390); }
  }
}

// ── shots 7–8: the vending machine outside the station, night and the next morning (same frame) ────────
export function vending(g, e, t, lt, mode) {
  const night = mode === 'night';
  vgrad(g, 0, 0, W, 700, night ? [[0, '#050b12'], [1, '#0c1a24']] : [[0, '#9cc9d6'], [1, '#e2ecde']]);
  g.fillStyle = night ? '#101a20' : '#b7b0a2'; g.fillRect(0, 300, W, 560);           // concrete wall
  g.fillStyle = night ? '#0b1318' : '#9d9587'; for (let x = 0; x < W; x += 320) g.fillRect(x, 300, 6, 560);
  g.fillStyle = night ? '#070d11' : '#7e786c'; g.fillRect(0, 860, W, 220);           // ground
  // a pole and wires behind the wall, cut by the frame
  g.fillStyle = night ? '#04080b' : '#3b3631'; g.fillRect(330, 0, 26, 300);
  g.strokeStyle = night ? '#04080b' : '#3b3631'; g.lineWidth = 3;
  for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-20, 40 + k * 26); g.quadraticCurveTo(700, 120 + k * 30, W + 20, 30 + k * 34); g.stroke(); }
  // the machine (cel), front panel glowing at night
  const mx = 1020, my = 230, mw = 520, mh = 650;
  cel(g, pts1([[mx, my], [mx + mw, my], [mx + mw, my + mh], [mx, my + mh]]), { f: night ? '#1d3440' : '#c94a3a', s: night ? '#13232b' : '#9c3528', so: [-26, 0], l: night ? '#08121a' : '#5c1c14', lw: 2.6 });
  const gx = mx + 40, gy = my + 50, gw = mw - 80, gh = 360;
  g.fillStyle = night ? '#e9f2ee' : '#2b3236'; g.fillRect(gx, gy, gw, gh);
  if (night) { e.fillStyle = 'rgba(220,255,240,.75)'; e.fillRect(gx - 10, gy - 10, gw + 20, gh + 20); }
  const cols = ['#d23c34', '#2f6bc0', '#e6b23a', '#3c9a5a', '#e9e3d4', '#7a4fb0'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    g.fillStyle = night ? cols[(r * 2 + c) % 6] : '#3c4346';
    g.fillRect(gx + 22 + c * 72, gy + 40 + r * 110, 44, 80);
  }
  g.fillStyle = night ? '#0c1a20' : '#7b2a20'; g.fillRect(gx, my + 470, gw, 90); g.fillRect(gx + 120, my + 580, gw - 240, 40);
  if (!night) {   // cracked glass: hard white lines from an impact point
    g.strokeStyle = 'rgba(235,240,240,.85)'; g.lineWidth = 2.4; const R = rng(41), cx = gx + gw * .62, cy = gy + gh * .38;
    for (let k = 0; k < 11; k++) { const a = R() * Math.PI * 2, len = 60 + R() * 220; g.beginPath(); g.moveTo(cx, cy); let x = cx, y = cy; for (let s = 0; s < 4; s++) { x += Math.cos(a + (R() - .5) * .5) * len / 4; y += Math.sin(a + (R() - .5) * .5) * len / 4; g.lineTo(x, y); } g.stroke(); }
    // hard morning light: a flat parallelogram across the wall
    g.fillStyle = 'rgba(255,248,220,.22)'; g.beginPath(); g.moveTo(0, 300); g.lineTo(700, 300); g.lineTo(1100, 860); g.lineTo(0, 860); g.fill();
  } else {        // light pool on the ground + moths on twos
    g.fillStyle = 'rgba(200,240,230,.10)'; g.beginPath(); g.moveTo(mx - 60, my + mh); g.lineTo(mx + mw + 60, my + mh); g.lineTo(mx + mw + 260, H); g.lineTo(mx - 260, H); g.fill();
    const tt = st12(t);
    for (let k = 0; k < 7; k++) { const a = tt * (1.3 + k * .21) + k * 2.1, r = 60 + 40 * Math.sin(tt * .9 + k); const x = gx + gw / 2 + Math.cos(a) * (gw / 2 + r * .3), y = gy + gh * .45 + Math.sin(a * 1.4) * (gh / 2 + 20);
      g.fillStyle = '#f6f2e0'; g.beginPath(); g.ellipse(x, y, 7, 4, a, 0, 7); g.fill(); e.fillStyle = 'rgba(255,255,240,.6)'; e.fillRect(x - 6, y - 6, 12, 12); }
  }
}

// ── shot 10: top-down, Mara alone at the console ─────────────────────────────────────────────────────────
export function topDown(g, e, t, lt) {
  g.fillStyle = '#0f2226'; g.fillRect(0, 0, W, H);                                   // desk seen from above
  g.fillStyle = 'rgba(120,255,170,.06)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, 380); g.lineTo(0, 520); g.fill();
  // console edge with screens (top of frame)
  g.fillStyle = '#081416'; g.fillRect(0, 0, W, 150); for (let k = 0; k < 6; k++) { g.fillStyle = '#0d2a1f'; g.fillRect(70 + k * 310, 30, 250, 90); e.fillStyle = 'rgba(56,210,106,.35)'; e.fillRect(70 + k * 310, 30, 250, 90); }
  // keyboard
  cel(g, pts1([[640, 330], [1280, 330], [1280, 520], [640, 520]]), { f: '#26363a', s: '#18252a', so: [0, -10], l: '#071012', lw: 2 });
  g.fillStyle = '#3a4c50'; for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) g.fillRect(660 + c * 44, 345 + r * 42, 36, 32);
  // printout log (the red line arrives on "tonight")
  g.save(); g.translate(1380, 260); g.rotate(.08);
  cel(g, pts1([[0, 0], [420, 0], [420, 620], [0, 620]]), { f: '#e7e3d6', s: '#c9c3b2', sh: [pts1([[0, 560], [420, 560], [420, 620], [0, 620]])], l: '#8d8676', lw: 1.6 });
  for (let i = 0; i < 14; i++) { const red = i === 12 && t >= 53.5; g.fillStyle = red ? UI.red : '#6b675d'; g.fillRect(30, 40 + i * 38, red ? 360 : 180 + hash(i) * 180, red ? 12 : 8); }
  g.restore();
  // coffee cup
  g.fillStyle = '#d9d3c4'; g.beginPath(); g.arc(470, 640, 70, 0, 7); g.fill(); g.fillStyle = '#2a1a12'; g.beginPath(); g.arc(470, 640, 54, 0, 7); g.fill();
  g.strokeStyle = '#d9d3c4'; g.lineWidth = 16; g.beginPath(); g.arc(560, 640, 30, -1.2, 1.2); g.stroke();
  // Mara from above: shoulders, arms to the keyboard, dark hair (cels)
  const b = st12(t) * .0;   // she does not move: the stillness is the point
  cel(g, [[560, 1120], [600, 880], [760, 800], [1160, 800], [1320, 880], [1360, 1120]], { f: '#2b3a52', s: '#1b2638', so: [26, 10], l: '#0c121c', lw: 2.6 });
  cel(g, [[720, 860], [700, 640], [760, 540], [820, 548], [820, 660], [800, 860]], { f: '#2b3a52', s: '#1b2638', so: [10, 0], l: '#0c121c', lw: 2.4 });
  cel(g, [[1200, 860], [1220, 640], [1160, 540], [1100, 548], [1100, 660], [1120, 860]], { f: '#2b3a52', s: '#1b2638', so: [10, 0], l: '#0c121c', lw: 2.4 });
  for (const hx of [790, 1130]) { g.fillStyle = P.skin; g.beginPath(); g.ellipse(hx, 525, 34, 26, 0, 0, 7); g.fill(); }
  const hair = []; for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; hair.push([960 + Math.cos(a) * (150 + 14 * Math.sin(a * 5)), 830 + Math.sin(a) * (130 + 10 * Math.cos(a * 4))]); }
  cel(g, hair, { f: P.hair, s: '#0d0c12', so: [24, 18], h: '#3a3d55', ho: [-14, -16], l: '#050508', lw: 2.4 });
}

// ── shot 11: extreme close, Mara's eye in the monitor glow, the level meter jumping ────────────────────
export function eye(g, e, t, lt) {
  g.fillStyle = '#16262a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#8fae9c'; g.fillRect(0, 0, W, H);                                   // skin under green monitor light
  g.fillStyle = '#6f8f80'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, 260); g.quadraticCurveTo(W / 2, 330, 0, 230); g.fill();   // brow shadow
  // eyebrow
  g.fillStyle = '#1c1a22'; g.beginPath(); g.moveTo(420, 230); g.quadraticCurveTo(960, 90, 1540, 210); g.quadraticCurveTo(960, 150, 430, 270); g.fill();
  // almond eye
  const eyeP = new Path2D(); eyeP.moveTo(380, 560); eyeP.quadraticCurveTo(960, 230, 1560, 520); eyeP.quadraticCurveTo(960, 830, 380, 560); eyeP.closePath();
  g.fillStyle = '#e3ece4'; g.fill(eyeP);
  g.save(); g.clip(eyeP);
  g.fillStyle = '#b9c8bd'; g.beginPath(); g.moveTo(380, 560); g.quadraticCurveTo(960, 230, 1560, 520); g.lineTo(1560, 380); g.lineTo(380, 380); g.fill();   // lid shadow
  const dil = 1 + .12 * Math.min(1, lt / 5);                                         // the pupil slowly opens
  g.fillStyle = '#3a2a22'; g.beginPath(); g.arc(950, 540, 240, 0, 7); g.fill();
  g.fillStyle = '#24180f'; g.beginPath(); g.arc(950, 540, 175, 0, 7); g.fill();
  g.fillStyle = '#050505'; g.beginPath(); g.arc(950, 540, 92 * dil, 0, 7); g.fill();
  // the monitor reflected in the iris, flickering
  const fl = .75 + .25 * hash(Math.floor(t * 12));
  g.fillStyle = rgba(UI.grn, .85 * fl); g.fillRect(1010, 420, 120, 70); e.fillStyle = rgba(UI.grn, .6 * fl); e.fillRect(1000, 410, 140, 90);
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(860, 450, 34, 24, -.4, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = '#120f14'; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.moveTo(360, 570); g.quadraticCurveTo(960, 220, 1590, 500); g.stroke();   // upper lash line
  g.lineWidth = 4; g.beginPath(); g.moveTo(420, 590); g.quadraticCurveTo(960, 820, 1520, 545); g.stroke();
  // the playback level meter at the bottom edge (foreground monitor)
  g.fillStyle = '#060a0a'; g.fillRect(0, 790, 560, 170);
  for (let i = 0; i < 32; i++) { const v = t >= 55.2 && t < 58.4 ? hash(i * 13 + Math.floor(t * 24)) * (1 - i / 40) : .04; const n = Math.round(v * 10);
    for (let s = 0; s < n; s++) { g.fillStyle = s > 7 ? UI.red : s > 5 ? UI.org : UI.grn; g.fillRect(30 + i * 16, 940 - s * 14, 12, 10); } }
}

// ── shot 14: Cross Light (night horizon, a beam column opening into a cross, inversion, white) ─────────
export const CROSS = { t0: 71.7, hit: 72.4, end: 73.6 };
export function crossLight(g, e, t, lt) {
  const sh = t > CROSS.hit ? Math.max(0, 1 - (t - CROSS.hit) * 4) : 0;            // decaying shake (6 frames)
  const dx = sh * 26 * Math.sin(t * 190), dy = sh * 18 * Math.cos(t * 230);
  g.save(); g.translate(dx, dy); e.save(); e.translate(dx, dy);
  horizon(g, e, t, 'night');
  const bx = 1560, up = Math.min(1, (t - CROSS.t0) / .45), wid = 20 + 140 * Math.max(0, (t - CROSS.t0 - .3) / .4);
  g.fillStyle = '#f4fbff'; g.fillRect(bx - wid / 2, (1 - up) * 700, wid, 700 * up);
  e.fillStyle = 'rgba(220,240,255,1)'; e.fillRect(bx - wid * 1.5, 0, wid * 3, 720);
  if (t > CROSS.t0 + .45) { const arm = Math.min(1, (t - CROSS.t0 - .45) / .2) * 900; g.fillRect(bx - arm, 230, arm * 2, wid * .8); e.fillRect(bx - arm, 200, arm * 2, wid * 1.4); }
  g.restore(); e.restore();
  if (t >= CROSS.hit && t < CROSS.hit + 2 / 24) { g.save(); g.globalCompositeOperation = 'difference'; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.restore(); }
  else if (t >= CROSS.hit + 2 / 24) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); e.fillStyle = '#ffffff'; e.globalAlpha = Math.max(0, 1 - (t - CROSS.hit) / 1.2); e.fillRect(0, 0, W, H); e.globalAlpha = 1; }
}

// ── shot 15: Inner Collapse — pencil line drawings on paper, sliding; WHERE / CLOSER in heavy serif ───
function boil(seed, t) { const k = Math.floor(t * 12) % 3; return (x, y, a = 2.2) => [x + (hash(seed + x * .37 + k * 17.3) - .5) * a * 2, y + (hash(seed + y * .53 + k * 29.1) - .5) * a * 2]; }
function pline(g, pts, j, w = 2.6) { g.beginPath(); pts.forEach((p, i) => { const q = j(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.lineWidth = w; g.stroke(); }
export function collapse(g, e, t, lt) {
  g.fillStyle = P.paper; g.fillRect(0, 0, W, H);
  const R = rng(5); g.fillStyle = 'rgba(80,70,50,.06)'; for (let i = 0; i < 1400; i++) g.fillRect(R() * W, R() * H, 2, 2);   // tooth
  const off = -lt * 95;                                                                // constant lateral slide
  g.save(); g.translate(off, 0); g.strokeStyle = P.pencil; g.lineCap = 'round'; g.lineJoin = 'round';
  const j = boil(3, t);
  // A: the station — dishes, poles, wires
  pline(g, [[80, 780], [1300, 780]], j);
  for (const [x, s] of [[300, 1], [620, .7], [900, .55]]) { pline(g, [[x - 20 * s, 780], [x, 620 * s + 780 * (1 - s) - 40], [x + 20 * s, 780]], j);
    const c = []; for (let i = 0; i <= 20; i++) { const a = Math.PI * (1 + i / 20); c.push([x + Math.cos(a) * 150 * s, 600 + (1 - s) * 150 + Math.sin(a) * 70 * s]); } pline(g, c, j); }
  pline(g, [[1150, 780], [1180, 200]], j, 3); pline(g, [[1080, 260], [1260, 250]], j);
  pline(g, [[1180, 255], [1500, 330], [1800, 300]], j, 1.8);
  // B: the probe, far away
  pline(g, [[2000, 440], [2120, 440], [2120, 540], [2000, 540], [2000, 440]], j); pline(g, [[1880, 470], [2000, 480]], j); pline(g, [[2120, 480], [2240, 470]], j);
  pline(g, [[1830, 440], [1880, 440], [1880, 520], [1830, 520], [1830, 440]], j); pline(g, [[2240, 440], [2290, 440], [2290, 520], [2240, 520], [2240, 440]], j);
  pline(g, [[2060, 440], [2060, 360], [2110, 330]], j);
  // C: the dotted distance between the Earth and a scribbled mass, shrinking as the shot goes on
  const ex = 2600, ey = 560; const er = []; for (let i = 0; i <= 36; i++) { const a = i / 36 * Math.PI * 2; er.push([ex + Math.cos(a) * 110, ey + Math.sin(a) * 110]); } pline(g, er, j);
  const far = 3700 - Math.min(1, lt / 13) * 900;                                     // the mass comes closer
  for (let x = ex + 140; x < far - 200; x += 38) pline(g, [[x, ey], [x + 18, ey]], j, 2.2);
  const Rm = rng(9); g.lineWidth = 2; for (let k = 0; k < 70; k++) { const a = Rm() * 6.28, r = Rm() * 190; const q = j(far + Math.cos(a) * r, ey + Math.sin(a) * r * .8); const q2 = j(q[0] + (Rm() - .5) * 120, q[1] + (Rm() - .5) * 120); g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q2[0], q2[1]); g.stroke(); }
  g.restore();
  // the questions, set like the cards but printed on the paper (no full-frame card under a caption)
  const q = t >= 84.5 && t < 86.5 ? 'WHERE' : t >= 87.5 && t < 89.5 ? 'CLOSER' : null;
  if (q) { g.save(); g.translate(1500, 120); g.rotate(Math.PI / 2); g.scale(.6, 1); g.font = `900 220px ${CARD_FONT}`; g.fillStyle = '#0a0a0a'; g.fillText(q, 0, 0); g.restore(); }
}

// ── shot 16: scale reveal — a vast dark shape swallows the stars above the tiny array ───────────────────
export function scaleReveal(g, e, t, lt) {
  vgrad(g, 0, 0, W, H, [[0, '#02070a'], [1, '#0b2228']]);
  const R = rng(77); const stars = []; for (let i = 0; i < 700; i++) stars.push([R() * W, R() * 900, .3 + R() * .7, R() < .08]);
  // the shape: a huge irregular dome rising at constant speed from behind the horizon
  const rise = lt / 7.8, cy = 1700 - rise * 700, rad = 900 + rise * 300;
  const shape = new Path2D(); for (let i = 0; i <= 90; i++) { const a = Math.PI + i / 90 * Math.PI, r = rad * (1 + .06 * Math.sin(a * 7) + .04 * Math.sin(a * 13 + 1)); const x = 900 + Math.cos(a) * r * 1.25, y = cy + Math.sin(a) * r; i ? shape.lineTo(x, y) : shape.moveTo(x, y); } shape.closePath();
  for (const [x, y, a, big] of stars) { if (g.isPointInPath(shape, x, y)) continue; g.fillStyle = rgba('#e4f2f2', a); g.fillRect(x, y, big ? 3 : 2, big ? 3 : 2); }
  g.fillStyle = '#010304'; g.fill(shape);
  g.save(); g.clip(shape); g.strokeStyle = rgba(P.violet, .55); g.lineWidth = 10; g.stroke(shape); g.restore();   // a faint violet rim inside the edge
  if (lt > 5.2) for (const [x, y] of [[760, cy - rad * .78], [1010, cy - rad * .74], [890, cy - rad * .64]]) { g.fillStyle = P.acid; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); e.fillStyle = rgba(P.acid, .9); e.beginPath(); e.arc(x, y, 12, 0, 7); e.fill(); }
  // the tiny array on the horizon and wires across the top
  g.fillStyle = '#030708'; g.fillRect(0, 960, W, 120);
  for (const [x, s] of [[1450, 1], [1520, .7], [1400, .55]]) { g.fillRect(x - 3 * s, 960 - 30 * s, 6 * s, 30 * s); g.beginPath(); g.ellipse(x, 925 - 30 * (1 - s), 22 * s, 7 * s, 0, 0, 7); g.fill(); }
  const on = (t % 1.5) < .35; if (on) { g.fillStyle = '#ff3b2a'; g.fillRect(1448, 902, 4, 4); e.fillStyle = 'rgba(255,60,40,.9)'; e.fillRect(1444, 898, 12, 12); }
  g.strokeStyle = '#020506'; g.lineWidth = 3; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-20, 60 + k * 30); g.quadraticCurveTo(W / 2, 150 + k * 30, W + 20, 80 + k * 30); g.stroke(); }
}
