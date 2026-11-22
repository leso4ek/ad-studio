// scene.js — Power-Line Horizon plates (sunset / night), dishes and poles as cels
import { W, H, cel, line, rng, vgrad, rgba } from './cel.js';

const HZ = 860;  // horizon in the lower third
export const LOOK = {
  sunset: { sky: [[0, '#26324a'], [.42, '#7a4a5a'], [.72, '#e8792b'], [1, '#f2c46b']], sun: '#ffe9b0', ground: '#2a1f26', groundS: '#1c151b',
    cel: '#1f1a22', celS: '#141017', line: '#0e0b10', rim: '#ff9a3c', wire: '#120e14' },
  night: { sky: [[0, '#050d10'], [.6, '#0e2a30'], [1, '#1f4a50']], sun: null, ground: '#071214', groundS: '#040a0b',
    cel: '#081214', celS: '#040909', line: '#020506', rim: '#2f6a70', wire: '#030708' },
};

// a utility pole seen from an extreme low angle: it leans toward the vanishing point above the frame
function pole(g, L, bx, top, w0, lean, rimSide) {
  const vx = W * .5 + lean, vy = -2600;
  const tx = bx + (vx - bx) * (H + 40 - top) / (H + 40 - vy);
  const w1 = w0 * .55;
  const pts = [[bx - w0 / 2, H + 40], [bx + w0 / 2, H + 40], [tx + w1 / 2, top], [tx - w1 / 2, top]];
  cel(g, pts.map(p => [...p, 1]), { f: L.cel, s: L.celS, so: [rimSide * -w0 * .35, 0], rim: { c: L.rim, d: [rimSide * 3, 0] }, l: L.line, lw: 2.4 });
  // crossarms (cels too): the city furniture is a character
  const arms = [];
  for (const [k, len] of [[0.06, 5.2], [0.17, 4.2]]) {
    const ay = top + (H - top) * k, ax = bx + (tx - bx) * (1 - k * 1.1);
    const a = [[ax - w0 * len, ay], [ax + w0 * len, ay - w0 * .3], [ax + w0 * len, ay + w0 * .35], [ax - w0 * len, ay + w0 * .65]];
    cel(g, a.map(p => [...p, 1]), { f: L.cel, s: L.celS, sh: [[[a[0][0], a[3][1] - 6, 1], [a[1][0], a[2][1] - 6, 1], [a[2][0], a[2][1], 1], [a[3][0], a[3][1], 1]]], l: L.line, lw: 2 });
    for (const s of [-.8, -.3, .3, .8]) { const ix = ax + w0 * len * s; arms.push([ix, ay - 8 + (s > 0 ? -w0 * .15 * s : 0)]); g.fillStyle = L.line; g.fillRect(ix - 5, ay - 22, 10, 20); }
  }
  return arms;
}
// catenary wire between two points, sagging
function wire(g, a, b, sag, col, lw) {
  g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag, b[0], b[1]);
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.stroke();
}
// a parabolic dish on a pedestal; tilt 0 = facing the horizon, 1 = zenith
function dish(g, L, x, y, s, tilt, rimSide = 1) {
  const ped = [[x - 18 * s, y], [x + 18 * s, y], [x + 10 * s, y - 120 * s], [x - 10 * s, y - 120 * s]];
  cel(g, ped.map(p => [...p, 1]), { f: L.cel, s: L.celS, so: [-8 * s * rimSide, 0], l: L.line, lw: 2 });
  const cx = x, cy = y - 150 * s, rx = 120 * s, ry = 120 * s * (0.28 + 0.1 * (1 - tilt));
  const ang = -0.9 + tilt * 0.9;   // rim plane angle
  const pts = []; for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry; pts.push([cx + ex * Math.cos(ang) - ey * Math.sin(ang), cy + ex * Math.sin(ang) + ey * Math.cos(ang)]); }
  cel(g, pts, { f: L.cel, s: L.celS, so: [10 * s * rimSide, 6 * s], rim: { c: L.rim, d: [3 * rimSide, -2] }, l: L.line, lw: 2.2 });
  // feed horn struts
  const fx = cx + Math.sin(-ang) * 95 * s * (0.4 + tilt * .6), fy = cy - Math.cos(ang) * 95 * s;
  for (const k of [0, 14]) line(g, [[pts[k][0], pts[k][1], 1], [fx, fy, 1]], L.line, 2.4 * Math.max(.6, s));
  g.fillStyle = L.cel; g.beginPath(); g.arc(fx, fy, 7 * s, 0, Math.PI * 2); g.fill();
  return [fx, fy];
}

export function horizon(g, e, t, mode = 'sunset') {
  const L = LOOK[mode];
  vgrad(g, 0, 0, W, HZ, L.sky);
  const R = rng(7);
  if (mode === 'night') for (let k = 0; k < 260; k++) { const x = R() * W, y = R() * HZ * .95, a = .25 + R() * .7; g.fillStyle = rgba('#dfeff0', a); g.fillRect(x, y, R() < .1 ? 3 : 2, R() < .1 ? 3 : 2); }
  if (L.sun) {   // flat sun disc + two flat halo rings (no gradient inside cels)
    const sx = 1270, sy = 735;
    g.fillStyle = rgba('#ffd27a', .22); g.beginPath(); g.arc(sx, sy, 190, 0, 7); g.fill();
    g.fillStyle = rgba('#ffe0a0', .3); g.beginPath(); g.arc(sx, sy, 128, 0, 7); g.fill();
    g.fillStyle = L.sun; g.beginPath(); g.arc(sx, sy, 92, 0, 7); g.fill();
    e.fillStyle = rgba('#ffb050', .5); e.beginPath(); e.arc(sx, sy, 110, 0, 7); e.fill();
    // flat cloud bars across the sun
    g.fillStyle = '#c45a3a'; for (const [y, x0, x1] of [[700, 980, 1520], [760, 1110, 1700], [612, 620, 1040]]) { g.beginPath(); g.roundRect(x0, y, x1 - x0, 16, 8); g.fill(); }
  }
  // hills and ground
  g.fillStyle = L.groundS; g.beginPath(); g.moveTo(0, HZ + 10); for (let x = 0; x <= W; x += 60) g.lineTo(x, HZ - 26 - 22 * Math.sin(x * .004) - 12 * Math.sin(x * .013)); g.lineTo(W, H); g.lineTo(0, H); g.fill();
  g.fillStyle = L.ground; g.fillRect(0, HZ + 8, W, H);
  // the array: three dishes, decreasing in scale, raised to the zenith at night
  const tilt = mode === 'night' ? 1 : .15;
  const feeds = [dish(g, L, 1560, HZ + 40, 1.15, tilt), dish(g, L, 1790, HZ + 22, .7, tilt), dish(g, L, 1395, HZ + 14, .5, tilt)];
  // the station hut, its window dark at night
  const hut = [[1660, HZ + 30], [1760, HZ + 30], [1760, HZ - 30], [1660, HZ - 30]];
  cel(g, hut.map(p => [...p, 1]), { f: L.cel, s: L.celS, so: [-12, 0], l: L.line, lw: 2 });
  g.fillStyle = mode === 'night' ? '#0b1416' : '#d8a060'; g.fillRect(1680, HZ - 12, 26, 18);
  // aviation light on the big dish: blinks every 1.5 s
  const on = (t % 1.5) < .35, [lx, ly] = feeds[0];
  if (on) { g.fillStyle = '#ff3b2a'; g.beginPath(); g.arc(lx, ly - 16, 6, 0, 7); g.fill(); e.fillStyle = 'rgba(255,60,40,.9)'; e.beginPath(); e.arc(lx, ly - 16, 16, 0, 7); e.fill(); }
  // foreground poles (extreme low angle) and wires that cut the sky diagonally
  const A = pole(g, L, 300, -80, 74, -900, 1), B = pole(g, L, 930, 250, 34, -500, 1), C = pole(g, L, 1180, 600, 14, -300, 1);
  const sway = Math.sin(t * 1.3) * 6;
  for (let k = 0; k < 4; k++) { wire(g, A[k], B[k], 70 + sway, L.wire, 4); wire(g, B[k], C[k], 26 + sway * .4, L.wire, 2.4); wire(g, A[4 + k] || A[k], [W + 40, 120 + k * 46], 90 + sway, L.wire, 3.4); }
  for (let k = 0; k < 4; k++) wire(g, A[4 + k], [-40, 380 + k * 40], 40 + sway, L.wire, 3.4);
}
