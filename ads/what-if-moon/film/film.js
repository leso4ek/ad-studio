// "What If the Moon Vanished Tonight?" — the film, in three.js (Stick Toon look). window.FILM.seek(t) draws frame t.
// Timing comes from the narration's Whisper word times (../voice/words.json); Pip's mouth from ../voice/env30.json.
import * as THREE from 'three';
import { INK, PAPER, RED, YELLOW, clamp, lerp, ease, eo, back, seg, toon, flat, outline, mesh, sphere, box, stick, card, gradientTex, paperTex } from './toon.js';
import { makePip } from './pip.js';

const W = 1920, H = 1080;
await Promise.all(['80px "Archivo Black"', '80px "Patrick Hand"'].map(f => document.fonts.load(f)));
const words = (await (await fetch('../voice/words.json')).json()).words;
const ENV = await (await fetch('../voice/env30.json')).json();
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** time of the first word matching w at or after `after` */
const Wt = (w, after = 0) => { const x = words.find(k => norm(k.w) === norm(w) && k.t0 >= after - .05); if (!x) throw new Error(`no word ${w} after ${after}`); return x.t0; };
const T = {};
T.gone = Wt('gone'); T.defer = Wt("i'll"); T.q1 = Wt('question'); T.no = Wt('no', T.q1); T.bulge = Wt('bulge'); T.without1 = Wt('without'); T.sun1 = Wt('sun', T.without1);
T.third = Wt('third'); T.q2 = Wt('question', T.third); T.every = Wt('every'); T.animals = Wt('animals'); T.reef = Wt('on', T.animals); T.release = Wt('release');
T.full = Wt('full'); T.nomoon = Wt('no', T.full); T.calendar = Wt('calendar'); T.q3 = Wt('question', T.calendar); T.brake = Wt('break', T.q3); T.drag = Wt('drag');
T.grows = Wt('grows'); T.away = Wt('away'); T.stays = Wt('stays'); T.smaller = Wt('smaller', T.stays); T.darker = Wt('darker'); T.same = Wt('same', T.darker);
T.fine = Wt('fine'); T.why = Wt('why', T.fine); T.stab = Wt('stabilizer'); T.top = Wt('because', T.stab); T.tilted = Wt('tilted'); T.seasons = Wt('seasons'); T.steady = Wt('steady');
T.wobble = Wt('wobbles'); T.without2 = Wt('without', T.wobble); T.famous = Wt('famous'); T.zero = Wt('zero'); T.e85 = Wt('85', T.zero); T.newer = Wt('newer'); T.millions = Wt('millions');
T.atzero = Wt('at', T.millions); T.at85 = Wt('at', T.atzero + .5); T.pole = Wt('pole'); T.endless = Wt('endless'); T.night = Wt('night', T.endless + .5);
T.so = Wt('so', T.night); T.tonight2 = Wt('tonight', T.so + 1.2); T.but = Wt('but', T.tonight2); T.forgets = Wt('forgets'); T.next = Wt('next'); T.endVoice = words.at(-1).t1;
T.END = T.endVoice + 2.6;
window.T = T;

// shots: [start, end, scene]
const SHOTS = [
  [0, T.defer - .45, 'hill'], [T.defer - .45, T.q1 - .3, 'board'], [T.q1 - .3, T.q2 - .3, 'tide'],
  [T.q2 - .3, T.reef - .25, 'town'], [T.reef - .25, T.q3 - .4, 'reef'], [T.q3 - .4, T.smaller - .35, 'spin'],
  [T.smaller - .35, T.top - .3, 'board'], [T.top - .3, T.without2 - .3, 'top'], [T.without2 - .3, T.so - .3, 'drift'],
  [T.so - .3, T.next - .3, 'hill'], [T.next - .3, T.END, 'board'],
];
window.SHOTS = SHOTS;

// ---------- renderer
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
const hud = document.getElementById('hud').getContext('2d');
const cam = new THREE.PerspectiveCamera(24, W / H, .1, 500);

function lights(scene, { key = '#FFFFFF', keyPos = [-6, 8, 10], amb = .55, sky = '#FFFFFF', ground = '#BBA98A', k = 2.4 } = {}) {
  scene.add(new THREE.HemisphereLight(sky, ground, amb * 3));
  const d = new THREE.DirectionalLight(key, k); d.position.set(...keyPos); scene.add(d); return d;
}
const talk = t => { const i = Math.floor(t * 30); return clamp(((ENV[i] || 0) + (ENV[i + 1] || 0)) / 2 * 1.5 - .12); };
const blink = t => { const p = (t * .9 + .37) % 3.7; return p < .12 ? 1 - Math.abs(p - .06) / .06 : 0; };
function starField(n, r, seed = 3) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pos = []; for (let i = 0; i < n; i++) { pos.push((rnd() - .5) * r * 2, rnd() * r * .9 - r * .1, -40 - rnd() * 20); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#FFF6D8', size: .18, sizeAttenuation: true }));
}
function moonMesh(r = 1.4) {
  const m = sphere(r, '#F6EBC4', .07);
  m.material = toon('#F6EBC4', { emissive: '#3A3320' });
  for (const [x, y, s] of [[-.4, .35, .28], [.35, -.2, .36], [.1, .55, .16], [-.15, -.45, .2], [.55, .3, .14]]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(r * s, 24), flat('#D9CC9E')); const v = new THREE.Vector3(x * r, y * r, 0); v.z = Math.sqrt(Math.max(0, r * r - v.x * v.x - v.y * v.y)) + .01; c.position.copy(v); c.lookAt(v.clone().multiplyScalar(2)); m.add(c);
  }
  return m;
}
function earthMesh(r = 2) {
  const g = new THREE.Group();
  const ocean = sphere(r, '#3E8FD8', .08, 56); g.add(ocean);
  const land = (lat, lon, s, sx = 1, sy = 1) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r * s, 20, 14), toon('#5DBB63')); outline(b, .025);
    const phi = lat * Math.PI / 180, th = lon * Math.PI / 180; b.position.set(Math.cos(phi) * Math.sin(th) * r * .9, Math.sin(phi) * r * .9, Math.cos(phi) * Math.cos(th) * r * .9);
    b.scale.set(sx, sy, .3); b.lookAt(b.position.clone().multiplyScalar(2)); ocean.add(b);
  };
  land(35, -20, .38, 1.2, 1.4); land(-15, -10, .3, 1, 1.6); land(40, 70, .42, 1.6, 1); land(-25, 130, .28, 1.2, .9); land(20, 170, .25); land(-5, 220, .32, 1, 1.5); land(50, 250, .36, 1.4, 1);
  const capN = new THREE.Mesh(new THREE.SphereGeometry(r * 1.005, 32, 8, 0, Math.PI * 2, 0, .45), toon('#FFFFFF')); ocean.add(capN);
  const capS = new THREE.Mesh(new THREE.SphereGeometry(r * 1.005, 32, 8, 0, Math.PI * 2, Math.PI - .4, .4), toon('#FFFFFF')); ocean.add(capS);
  g.userData.spin = ocean;
  return g;
}
function sunMesh(r = 1.3) {
  const g = new THREE.Group(); const s = sphere(r, '#FFC93C', .07); s.material = new THREE.MeshBasicMaterial({ color: '#FFC93C' }); g.add(s);
  for (let i = 0; i < 12; i++) { const ray = stick(.06, '#FFB020'); const a = i / 12 * Math.PI * 2; ray.userData.set([Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25, 0], [Math.cos(a) * r * 1.65, Math.sin(a) * r * 1.65, 0]); g.add(ray); }
  return g;
}
function puff(n = 14, color = '#FFFFFF') {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.4, 14, 10), new THREE.MeshBasicMaterial({ color, transparent: true })); b.userData.a = i / n * Math.PI * 2 + (i % 3) * .3; b.userData.r = .8 + (i % 4) * .25; g.add(b); }
  g.userData.at = p => { g.visible = p > 0 && p < 1; g.children.forEach(b => { const d = eo(p) * 2.6 * b.userData.r; b.position.set(Math.cos(b.userData.a) * d, Math.sin(b.userData.a) * d, 0); b.scale.setScalar((1 - p) * (1.1 + b.userData.r * .4)); b.material.opacity = 1 - p * p; }); };
  return g;
}

// ---------- scenes
const S = {};
// HILL: a moonlit hill over a small town; the Moon pops out of existence
{
  const sc = new THREE.Scene(); sc.background = gradientTex([[0, '#0E1638'], [.6, '#233466'], [1, '#3B4C84']]);
  lights(sc, { key: '#C9D6FF', keyPos: [6, 6, 8], amb: .5, sky: '#8FA2E0', ground: '#1B2340', k: 1.6 });
  const stars = starField(260, 30); sc.add(stars);
  const hill = mesh(new THREE.SphereGeometry(9, 48, 24), toon('#3E6B52'), .1); hill.scale.set(1.6, .55, .6); hill.position.set(-7, -7.6, -4); sc.add(hill);
  const hill2 = mesh(new THREE.SphereGeometry(9, 48, 24), toon('#2C5240'), .1); hill2.scale.set(2, .5, .5); hill2.position.set(9, -8.4, -10); sc.add(hill2);
  const town = new THREE.Group(); sc.add(town);
  for (let i = 0; i < 9; i++) {
    const h = 1 + (i * 37 % 7) / 5, w = 1.1 + (i % 3) * .3, x = 2 + i * 1.5, z = -9 - (i % 2) * 1.2;
    const b = box(w, h, 1, ['#6C5B8F', '#7F6AA0', '#5D4F7E'][i % 3], .06); b.position.set(x, -3.6 + h / 2, z); town.add(b);
    const roof = mesh(new THREE.ConeGeometry(w * .78, .8, 4), toon('#B5504A'), .05); roof.rotation.y = Math.PI / 4; roof.position.set(x, -3.6 + h + .4, z); town.add(roof);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(.3, .35), flat('#FFD46B')); win.position.set(x - .2, -3.6 + h * .6, z + .51); town.add(win); win.userData.win = true;
    const win2 = win.clone(); win2.position.x = x + .22; win2.material = win.material; town.add(win2);
  }
  const moon = moonMesh(1.5); moon.position.set(9.2, 2.6, -14); sc.add(moon);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), new THREE.MeshBasicMaterial({ color: '#FFF3C4', transparent: true, opacity: .14 })); glow.position.set(9.2, 2.6, -14.5); sc.add(glow);
  const pf = puff(16, '#FFF6DA'); pf.position.copy(moon.position); sc.add(pf);
  const pip = makePip(); pip.group.position.set(-3.4, -3.55, 0); pip.group.scale.setScalar(1.25); sc.add(pip.group);
  S.hill = { scene: sc, update(t) {
    const second = t > T.so - 1; // the ending visit: no Moon, the sky a touch darker
    const p = second ? 2 : seg(t, T.gone - .15, T.gone + .25);
    moon.visible = glow.visible = !second && p < 1; moon.scale.setScalar(p < .5 ? 1 + back(p * 2) * .15 : 1 - eo((p - .5) * 2));
    pf.userData.at(second ? 0 : seg(t, T.gone + .05, T.gone + 1.1));
    stars.rotation.z = t * .004;
    sc.background.offset.y = 0;
    if (!second) {
      const shock = seg(t, T.gone + .25, T.gone + .6);
      pip.update({ pose: 'lookUp', pose2: 'shock', mix: shock, talk: talk(t) * .6, blink: blink(t), lookX: .15 });
      cam.position.set(lerp(0, .8, ease(t / 5)), 0, lerp(24, 21.5, ease(t / 5))); cam.lookAt(1, .5, -4);
    } else {
      const k = seg(t, T.so, T.tonight2), k2 = seg(t, T.but, T.but + 1);
      pip.update({ pose: 'lookUp', pose2: k2 > 0 ? 'idle' : 'think', mix: k2 > 0 ? k2 : k, talk: talk(t), blink: blink(t), lookX: lerp(.2, -.1, k2), lookY: lerp(0, .3, k2) });
      const u = seg(t, T.so - .3, T.next - .3);
      cam.position.set(lerp(-.6, -1.6, ease(u)), lerp(.2, -.6, ease(u)), lerp(23, 18.5, ease(u))); cam.lookAt(lerp(.5, -1.8, ease(u)), lerp(.5, -.8, ease(u)), -4);
    }
  } };
}
// BOARD: the red-string board; the big question in the middle, answers pinned around it
{
  const sc = new THREE.Scene(); sc.background = paperTex(); lights(sc, { amb: .75, k: 1.8 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), new THREE.MeshBasicMaterial({ map: paperTex() })); wall.position.z = -3; sc.add(wall);
  const frame = box(13.4, 8.4, .3, '#8B5A33', .07); frame.position.set(1.2, .6, -1.2); sc.add(frame);
  const cork = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 640; const g = c.getContext('2d'); g.fillStyle = '#C8935C'; g.fillRect(0, 0, 1024, 640);
    let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 9000; i++) { g.fillStyle = rnd() < .5 ? 'rgba(90,50,20,.22)' : 'rgba(255,230,190,.18)'; g.beginPath(); g.arc(rnd() * 1024, rnd() * 640, rnd() * 2.6, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 7.6), new THREE.MeshBasicMaterial({ map: cork })); board.position.set(1.2, .6, -1.02); sc.add(board);
  const pin = (color = RED) => { const g = new THREE.Group(); const h = sphere(.13, color, .025); h.position.z = .14; g.add(h); return g; };
  const mk = (lines, w, h, x, y, rz, o = {}) => { const c = card(lines, w, h, { font: '"Archivo Black"', size: 150, ...o }); c.position.set(x, y, -.9); c.rotation.z = rz; const p = pin(o.pin || RED); p.position.set(0, h / 2 - .2, .02); c.add(p); sc.add(c); return c; };
  const big = mk(['WHAT IF', 'THE MOON', 'VANISHED?'], 3.6, 2.6, 1.2, .7, .02, { bg: '#FFF3B0', size: 170 });
  const slots = [[-3.4, 2.5, -.06], [5.7, 2.6, .05], [-3.2, -1.6, .04], [5.6, -1.5, -.05]];
  const blank = slots.slice(0, 3).map(([x, y, r], i) => mk([`${i + 1}`, '?'], 2.7, 1.8, x, y, r, { size: 150, color: '#9A8F80' }));
  const ans = [mk(['TIDES', '÷ 3'], 2.7, 1.8, ...slots[0], { pin: '#3E8FD8' }), mk(['DARKER', 'NIGHTS'], 2.7, 1.8, ...slots[1], { pin: '#3E8FD8' }), mk(['SAME', '24 H DAY'], 2.7, 1.8, ...slots[2], { pin: '#3E8FD8' }), mk(['STABILISER', '?'], 2.9, 1.8, ...slots[3], { bg: '#FFD9D2', size: 140 })];
  const next = mk(['WHAT IF', 'EARTH STOPPED', 'SPINNING?'], 3.6, 2.6, 1.2, .7, -.02, { bg: '#CDEBFF', size: 170 }); next.visible = false;
  const strings = slots.map(() => { const s = stick(.03, RED); sc.add(s); return s; });
  const pip = makePip(); pip.group.position.set(-6.6, -3.9, .5); pip.group.scale.setScalar(1.35); sc.add(pip.group);
  S.board = { scene: sc, update(t) {
    const visit = t < T.q1 ? 1 : t < T.top ? 2 : 3;
    const pop = (c, a) => { const p = seg(t, a, a + .35); c.visible = p > 0; c.scale.setScalar(back(p)); };
    blank.forEach((c, i) => { c.visible = visit === 1; if (visit === 1) pop(c, T.defer + 1.4 + i * .35); });
    const ansAt = [T.smaller, T.darker, T.same, T.why + .2];
    ans.forEach((c, i) => { if (visit === 1) c.visible = false; else if (visit === 2) pop(c, ansAt[i]); else c.visible = true; });
    big.visible = visit !== 3 || t < T.next + .2; next.visible = visit === 3;
    if (visit === 3) { const f = seg(t, T.next - .1, T.next + .5); big.rotation.y = f * Math.PI / 2; big.visible = f < .5; next.rotation.y = (1 - f) * -Math.PI / 2; next.visible = f >= .5; next.scale.setScalar(1); }
    else { big.rotation.y = 0; }
    strings.forEach((s, i) => {
      const c = visit === 1 ? null : ans[i]; const on = c && c.visible;
      s.visible = !!on; if (!on) return;
      const a = [big.position.x, big.position.y + 1.1, -.7], b = [c.position.x, c.position.y + .7, -.7];
      const p = visit === 2 ? eo(seg(t, ansAt[i] + .15, ansAt[i] + .7)) : 1;
      s.userData.set(a, [lerp(a[0], b[0], p), lerp(a[1], b[1], p), -.7]);
    });
    if (visit === 1) { pip.update({ pose: 'idle', pose2: 'point', mix: seg(t, T.defer + .2, T.defer + .6), talk: talk(t), blink: blink(t), lookX: -.1 }); cam.position.set(0, .2, lerp(30, 28, ease(seg(t, T.defer - .5, T.q1)))); cam.lookAt(0, 0, 0); }
    else if (visit === 2) {
      const sh = seg(t, T.fine - .2, T.fine + .3), sc2 = seg(t, T.why, T.why + .4);
      pip.update({ pose: sc2 > 0 ? 'shrug' : 'point', pose2: sc2 > 0 ? 'scratch' : 'shrug', mix: sc2 > 0 ? sc2 : sh, talk: talk(t), blink: blink(t) });
      const u = seg(t, T.smaller - .4, T.top - .3); cam.position.set(lerp(0, .6, ease(u)), .2, lerp(29, 25.5, ease(u))); cam.lookAt(lerp(0, .4, ease(u)), .2, 0);
    } else { pip.update({ pose: 'idle', pose2: 'wave', mix: seg(t, T.next + .3, T.next + .7), wave: t, talk: talk(t), blink: blink(t) }); cam.position.set(0, .2, lerp(27, 25, ease(seg(t, T.next - .3, T.END)))); cam.lookAt(0, .2, 0); }
  } };
}
// TIDE: the ocean bulge points at the Moon; the Moon goes, the Sun alone raises a bulge a third as tall
{
  const sc = new THREE.Scene(); sc.background = gradientTex([[0, '#101A3A'], [1, '#1F2E5C']]); lights(sc, { keyPos: [-10, 4, 8], amb: .45, sky: '#AFC3FF', ground: '#223', k: 2.6 });
  sc.add(starField(200, 26, 5));
  const earth = earthMesh(2.2); earth.position.set(-1.5, 0, 0); sc.add(earth);
  const bulge = new THREE.Mesh(new THREE.SphereGeometry(2.24, 56, 40), new THREE.MeshBasicMaterial({ color: '#8FD3FF', transparent: true, opacity: .38, depthWrite: false })); outline(bulge, .035); bulge.children[0].material = new THREE.MeshBasicMaterial({ color: '#1C5E9E', side: THREE.BackSide }); earth.add(bulge);
  const moon = moonMesh(.9); moon.position.set(7.4, 0, 0); sc.add(moon); const pf = puff(12, '#FFF6DA'); pf.position.copy(moon.position); sc.add(pf);
  const sun = sunMesh(1.1); sun.position.set(-9.6, 0, -2); sc.add(sun);
  const arrows = [0, 1, 2].map(() => { const a = mesh(new THREE.ConeGeometry(.38, .8, 3), flat('#FFE08A'), .05); sc.add(a); return a; });
  const pip = makePip(); pip.group.position.set(-7.2, -4.6, 1); pip.group.scale.setScalar(.95); sc.add(pip.group);
  S.tide = { scene: sc, update(t) {
    earth.userData.spin.rotation.y = t * .25;
    const mp = seg(t, T.without1 - .1, T.without1 + .3); moon.visible = mp < 1; moon.scale.setScalar(1 - eo(mp)); pf.userData.at(seg(t, T.without1, T.without1 + 1));
    const sunIn = eo(seg(t, T.sun1 - .4, T.sun1 + .3)); sun.visible = sunIn > 0; sun.scale.setScalar(sunIn); sun.rotation.z = t * .2;
    const grow = ease(seg(t, T.no + .3, T.bulge + .6)), shrink = ease(seg(t, T.sun1, T.third + .4));
    const amp = 1 + .28 * grow * (1 - shrink * 2 / 3); // the Sun alone raises a bulge about a third of today's
    bulge.scale.set(amp, 1 / Math.sqrt(amp), 1 / Math.sqrt(amp));
    bulge.rotation.z = 0; // the bulge stays on the Earth–Moon / Earth–Sun line (both on the x axis here)
    arrows.forEach((a, i) => { const y = (i - 1) * .7, on = moon.visible ? grow : sunIn; a.visible = on > .05; const dir = moon.visible ? 1 : -1, x0 = dir > 0 ? 5.6 : -7.6, x1 = dir > 0 ? 2.4 : -4.3; const w = (t * 1.2 + i * .33) % 1; a.position.set(lerp(x1, x0, w), y, 0); a.rotation.z = dir > 0 ? -Math.PI / 2 : Math.PI / 2; a.scale.setScalar(Math.sin(w * Math.PI) * on); });
    pip.update({ pose: 'point', pose2: 'shock', mix: seg(t, T.no - .2, T.no + .2) * (1 - seg(t, T.no + .8, T.no + 1.2)), talk: talk(t), blink: blink(t), lookX: .2 });
    const u = seg(t, T.q1 - .3, T.q2 - .3); cam.position.set(lerp(0, -.4, ease(u)), 0, lerp(30, 26, ease(u))); cam.lookAt(lerp(0, -.6, ease(u)), 0, 0);
  } };
}
// TOWN: night with no Moon; the lights go out and the sky goes deep
{
  const sc = new THREE.Scene(); const bgA = gradientTex([[0, '#0E1638'], [1, '#3B4C84']]), bgB = gradientTex([[0, '#03040C'], [1, '#0B1024']]); sc.background = bgA;
  const hemi = new THREE.HemisphereLight('#8FA2E0', '#1B2340', 1.5); sc.add(hemi); const key = new THREE.DirectionalLight('#C9D6FF', 1.4); key.position.set(6, 6, 8); sc.add(key);
  const stars = starField(360, 30, 9); sc.add(stars);
  const ground = mesh(new THREE.SphereGeometry(30, 40, 20), toon('#2F5A45'), .1); ground.scale.set(1, .12, .4); ground.position.set(0, -6.2, -10); sc.add(ground);
  const houses = [];
  for (let i = 0; i < 7; i++) { const h = 1.6 + (i * 29 % 5) / 4, x = -8 + i * 2.6; const b = box(2, h, 1.5, ['#7F6AA0', '#6C5B8F', '#8E7AB0'][i % 3], .07); b.position.set(x, -3.4 + h / 2, -6); sc.add(b); houses.push(b);
    const roof = mesh(new THREE.ConeGeometry(1.5, 1, 4), toon('#B5504A'), .06); roof.rotation.y = Math.PI / 4; roof.position.set(x, -3.4 + h + .5, -6); sc.add(roof);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(.45, .5), new THREE.MeshBasicMaterial({ color: '#FFD46B', transparent: true })); w.position.set(x, -3.4 + h * .55, -5.24); sc.add(w); houses.push(w); }
  const pip = makePip(); pip.group.position.set(4.6, -5.6, 3); pip.group.scale.setScalar(1.3); sc.add(pip.group);
  const torch = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#FFF4B8', transparent: true, opacity: .0, side: THREE.DoubleSide })); torch.rotation.z = Math.PI / 2 + .3; torch.position.set(3.4, -2.6, .2); sc.add(torch);
  S.town = { scene: sc, update(t) {
    const d = ease(seg(t, T.every - .2, T.every + 1.4));
    hemi.intensity = lerp(1.5, .45, d); key.intensity = lerp(1.4, .25, d); sc.background = d > .5 ? bgB : bgA; stars.material.size = lerp(.18, .24, d);
    houses.forEach(h => { if (h.material.transparent) h.material.opacity = lerp(1, .35, d); });
    torch.visible = false;
    pip.update({ pose: 'lookUp', pose2: 'shrug', mix: seg(t, T.every + .3, T.every + .8), talk: talk(t), blink: blink(t), lookX: -.3 });
    const u = seg(t, T.q2 - .3, T.reef); cam.position.set(lerp(0, .5, ease(u)), 0, lerp(28, 25, ease(u))); cam.lookAt(0, -.6, -4);
  } };
}
// REEF: corals release eggs together under moonlight; then no light, no release
{
  const sc = new THREE.Scene(); sc.background = gradientTex([[0, '#0B3E66'], [.7, '#062A4A'], [1, '#041B30']]); lights(sc, { key: '#BFE6FF', keyPos: [2, 10, 6], amb: .6, sky: '#5FB6E8', ground: '#06243C', k: 1.8 });
  const sand = mesh(new THREE.SphereGeometry(30, 40, 20), toon('#C9B27A'), .1); sand.scale.set(1, .1, .4); sand.position.set(0, -6.3, -8); sc.add(sand);
  const corals = [];
  const cols = ['#FF7A8A', '#FFA14A', '#C77DFF', '#FF6FB5', '#FFD15C'];
  for (let i = 0; i < 9; i++) { const g = new THREE.Group(); const x = -8 + i * 2; g.position.set(x, -3.6, -4 - (i % 3)); const c = cols[i % 5];
    for (let j = 0; j < 5; j++) { const b = sphere(.35 + (j % 2) * .15, c, .04, 20); b.material = toon(c, { emissive: c, emissiveIntensity: .35 }); b.position.set(Math.sin(j * 2.1) * .5, j * .35, Math.cos(j * 1.7) * .3); g.add(b); }
    sc.add(g); corals.push(g); }
  const eggs = []; const egm = toon('#FFC2D6');
  for (let i = 0; i < 140; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), egm); e.userData = { x: -8 + (i % 9) * 2 + Math.sin(i) * .5, z: -4 - (i % 3), d: (i * .137) % 1, s: .6 + (i % 5) * .12 }; sc.add(e); eggs.push(e); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 6, 18, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#E8F6FF', transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false })); beam.position.set(1, 4, -6); beam.rotation.z = -.15; sc.add(beam);
  const moonSmall = moonMesh(.8); moonSmall.position.set(4.5, 6.2, -14); sc.add(moonSmall);
  S.reef = { scene: sc, update(t) {
    const off = ease(seg(t, T.nomoon - .1, T.nomoon + .5));
    beam.material.opacity = .12 * (1 - off); moonSmall.visible = off < .5; moonSmall.scale.setScalar(1 - off);
    const rel = seg(t, T.release - .3, T.release + .4);
    eggs.forEach(e => { const u = e.userData; const life = ((t - T.release + .3) * u.s * .5 + u.d) % 1; const on = rel > 0 && (t < T.nomoon + .2 || life < .4 * (1 - off)); e.visible = on && t > T.release - .3 + u.d * .8; e.position.set(u.x + Math.sin(t * 2 + u.d * 9) * .2, -3 + life * 9, u.z); });
    corals.forEach((c, i) => c.rotation.z = Math.sin(t * 1.3 + i) * .04);
    const u = seg(t, T.reef - .25, T.q3 - .4); cam.position.set(lerp(-1, 1, ease(u)), lerp(-.4, .2, ease(u)), lerp(24, 22, ease(u))); cam.lookAt(0, -.6, -5);
  } };
}
// SPIN: Earth turning, the Moon as a brake on its spin; the brake goes, the day stays 24 h
{
  const sc = new THREE.Scene(); sc.background = gradientTex([[0, '#101A3A'], [1, '#1F2E5C']]); lights(sc, { keyPos: [-8, 6, 10], amb: .5, sky: '#AFC3FF', ground: '#223', k: 2.6 });
  sc.add(starField(220, 26, 13));
  const earth = earthMesh(2.6); earth.position.set(-1.2, -.2, 0); sc.add(earth);
  const moon = moonMesh(.8); moon.position.set(5.6, 1.4, 0); sc.add(moon); const pf = puff(12, '#FFF6DA'); sc.add(pf);
  const pad = box(.5, 1.5, .8, '#E2453C', .05); sc.add(pad); const arm = stick(.07, '#C9CED9'); sc.add(arm);
  const sparks = [0, 1, 2, 3, 4].map(() => { const s = stick(.035, '#FFD447'); sc.add(s); return s; });
  const pip = makePip(); pip.group.position.set(6.6, -4.5, 1); pip.group.scale.setScalar(.95); sc.add(pip.group);
  S.spin = { scene: sc, update(t) {
    const gone = seg(t, T.away + .1, T.away + .45);
    earth.userData.spin.rotation.y = t * (gone > 0 ? .9 : .75);
    moon.visible = gone < 1; moon.scale.setScalar(1 - eo(gone)); pf.position.copy(moon.position); pf.userData.at(seg(t, T.away + .2, T.away + 1.2));
    const pin = ease(seg(t, T.brake - .2, T.brake + .5)) * (1 - gone);
    pad.visible = arm.visible = pin > .01; pad.position.set(-1.2 + 2.6 + .3 + (1 - pin) * 1.5, .9, 1); pad.rotation.z = -.35; pad.scale.setScalar(Math.max(.01, pin));
    arm.userData.set([moon.position.x - .6, moon.position.y - .2, .5], [pad.position.x + .2, pad.position.y, 1]);
    sparks.forEach((s, i) => { const on = pin > .9 && t > T.drag && t < T.away; s.visible = on; const a = (t * 7 + i * 1.3) % 1, ang = -.4 - i * .35; s.userData.set([1.55, .9, 1.2], [1.55 + Math.cos(ang) * (.3 + a * .9), .9 + Math.sin(ang) * (.3 + a * .9), 1.2]); });
    pip.update({ pose: 'point', pose2: 'cheer', mix: seg(t, T.stays, T.stays + .4), talk: talk(t), blink: blink(t), lookX: -.4 });
    const u = seg(t, T.q3 - .4, T.smaller); cam.position.set(lerp(.4, 0, ease(u)), 0, lerp(29, 25, ease(u))); cam.lookAt(0, 0, 0);
  } };
}
// TOP and DRIFT: Earth as a tilted spinning top; then the tilt drifts without the Moon
function tiltRig(sc) {
  const g = new THREE.Group(); sc.add(g);
  const earth = earthMesh(2.3); g.add(earth);
  const axis = stick(.09, RED); axis.userData.set([0, -3.9, 0], [0, 3.9, 0]); g.add(axis);
  for (const y of [-3.9, 3.9]) { const cap = sphere(.16, RED, .03, 16); cap.position.y = y; g.add(cap); }
  const ref = new THREE.Group(); sc.add(ref);
  for (let i = 0; i < 9; i++) { const d = stick(.035, '#C9CED9'); d.userData.set([0, -3.6 + i * .85, 0], [0, -3.6 + i * .85 + .45, 0]); ref.add(d); }
  return { g, earth, ref };
}
{
  const sc = new THREE.Scene(); sc.background = gradientTex([[0, '#101A3A'], [1, '#1F2E5C']]); const key = lights(sc, { keyPos: [-12, 2, 6], amb: .14, sky: '#AFC3FF', ground: '#223', k: 3.4 });
  sc.add(starField(220, 26, 17));
  const rig = tiltRig(sc); rig.g.position.set(-.5, 0, 0); rig.ref.position.copy(rig.g.position);
  const sun = sunMesh(1.1); sun.position.set(-9.5, 0, -2); sc.add(sun);
  const moon = moonMesh(.65); sc.add(moon);
  S.top = { scene: sc, update(t) {
    const tiltIn = ease(seg(t, T.tilted - .2, T.tilted + .8));
    const wob = t > T.steady ? Math.sin(t * 2.2) * 1.3 : 0;
    rig.g.rotation.z = -THREE.MathUtils.degToRad(23.5 * tiltIn + wob * tiltIn);
    rig.earth.userData.spin.rotation.y = t * 1.6;
    const a = t * .7; moon.position.set(-.5 + Math.cos(a) * 5.6, Math.sin(a) * 1.2, Math.sin(a) * 4);
    sun.visible = t > T.seasons - .3; sun.scale.setScalar(eo(seg(t, T.seasons - .3, T.seasons + .2))); sun.rotation.z = t * .2;
    const u = seg(t, T.top - .3, T.without2); cam.position.set(lerp(0, -.8, ease(u)), 0, lerp(26, 22.5, ease(u))); cam.lookAt(lerp(-.4, -1.6, ease(u)), 0, 0);
  } };
}
{
  const sc = new THREE.Scene(); sc.background = gradientTex([[0, '#0B1230'], [1, '#18244E']]); lights(sc, { keyPos: [-14, 1, 4], amb: .12, sky: '#AFC3FF', ground: '#112', k: 3.4 });
  sc.add(starField(220, 26, 19));
  const rig = tiltRig(sc); rig.g.position.set(-.3, -.2, 0); rig.ref.position.copy(rig.g.position);
  const sun = sunMesh(1.2); sun.position.set(-9.8, 0, -2); sc.add(sun);
  const dial = new THREE.Group(); sc.add(dial);
  const pf = puff(10, '#FFF6DA'); pf.position.set(6.5, 2.5, 0); sc.add(pf);
  const pip = makePip(); pip.group.position.set(-6.6, -4.6, 1); pip.group.scale.setScalar(.95); sc.add(pip.group);
  S.drift = { scene: sc, tilt: 23.5, update(t) {
    // the tilt over the beat: 23.5 → wander → 0 → 85 (the 1993 range), then the newer, milder band, then the two extremes
    const k = [
      [T.without2 - .3, 23.5], [T.famous, 23.5], [T.zero - .1, 12], [T.zero + .4, 0], [T.e85 + .3, 85], [T.newer + .2, 60], [T.newer + 1.6, 35], [T.millions + .6, 10], [T.atzero - .2, 0],
      [T.atzero + 1.6, 0], [T.at85 + .2, 85], [T.so, 85],
    ];
    let deg = 23.5; for (let i = 0; i < k.length - 1; i++) if (t >= k[i][0] && t <= k[i + 1][0]) { deg = lerp(k[i][1], k[i + 1][1], ease((t - k[i][0]) / (k[i + 1][0] - k[i][0]))); break; } else if (t > k[i + 1][0]) deg = k[i + 1][1];
    this.tilt = deg;
    rig.g.rotation.z = -THREE.MathUtils.degToRad(deg) - Math.sin(t * 3) * .01;
    rig.earth.userData.spin.rotation.y = t * 1.4;
    pf.userData.at(seg(t, T.without2 - .3, T.without2 + .7));
    // at "endless night" the Earth swings to the far side of the Sun: the lit pole goes dark
    const far = ease(seg(t, T.night - .4, T.night + .5)); sun.position.set(lerp(-9.8, 13, far), 0, lerp(-2, -6, far)); sun.visible = far < .98;
    sc.children.forEach(o => { if (o.isDirectionalLight) o.position.set(lerp(-14, 14, far), 1, lerp(4, -8, far)); });
    pip.update({ pose: 'think', pose2: t > T.at85 ? 'shock' : 'point', mix: seg(t, T.atzero - .3, T.atzero + .2), talk: talk(t), blink: blink(t), lookX: .3 });
    const u = seg(t, T.without2 - .3, T.so); cam.position.set(lerp(0, .4, ease(u)), 0, lerp(27, 24, ease(u))); cam.lookAt(lerp(0, .5, ease(u)), 0, 0);
  } };
}

// ---------- the 2D overlay: header cards, stamps, readouts (hand-lettered in Archivo Black on yellow)
function cardHUD(text, x, y, p, { size = 64, bg = YELLOW, color = INK, rot = -.02, align = 'center', sub = null } = {}) {
  if (p <= 0) return; const s = back(Math.min(1, p * 1.2));
  hud.save(); hud.translate(x, y); hud.rotate(rot); hud.scale(s, s);
  hud.font = `${Math.round(size * .5)}px "Archivo Black"`; const subW = sub ? hud.measureText(sub).width : 0; hud.font = `${size}px "Archivo Black"`; const lines = text.split('\n'); const w = Math.max(subW, ...lines.map(l => hud.measureText(l).width)) + size * .9, h = lines.length * size * 1.08 + size * .55 + (sub ? size * .7 : 0);
  const x0 = align === 'center' ? -w / 2 : 0;
  hud.fillStyle = INK; hud.fillRect(x0 + 8, -h / 2 + 10, w, h); hud.fillStyle = bg; hud.fillRect(x0, -h / 2, w, h); hud.lineWidth = 6; hud.strokeStyle = INK; hud.strokeRect(x0, -h / 2, w, h);
  hud.fillStyle = color; hud.textAlign = 'center'; hud.textBaseline = 'middle';
  lines.forEach((l, i) => hud.fillText(l, x0 + w / 2, -h / 2 + size * .3 + size * 1.08 * (i + .5)));
  if (sub) { hud.font = `${Math.round(size * .5)}px "Archivo Black"`; hud.fillText(sub, x0 + w / 2, h / 2 - size * .45); }
  hud.restore();
}
function stamp(text, x, y, p, color = RED, size = 150) {
  if (p <= 0 || p >= 1) return; const a = p < .15 ? p / .15 : p > .8 ? (1 - p) / .2 : 1, s = 1.6 - .6 * eo(Math.min(1, p * 5));
  hud.save(); hud.globalAlpha = a; hud.translate(x, y); hud.rotate(-.12); hud.scale(s, s); hud.font = `${size}px "Archivo Black"`; hud.textAlign = 'center'; hud.textBaseline = 'middle';
  hud.lineWidth = 14; hud.strokeStyle = color; const w = hud.measureText(text).width + 60; hud.strokeRect(-w / 2, -size * .62, w, size * 1.24); hud.fillStyle = color; hud.fillText(text, 0, 6); hud.restore();
}
const span = (t, a, b) => (t < a || t > b) ? 0 : Math.min(1, (t - a) / .35);
function overlay(t) {
  hud.clearRect(0, 0, W, H);
  cardHUD('WHAT IF THE MOON\nVANISHED?', W / 2, 190, span(t, .25, T.defer - .5), { size: 92 });
  cardHUD('1 · WOULD THE OCEANS FLOOD?', W / 2, 110, span(t, T.q1, T.q2 - .35), { size: 56 });
  stamp('NO', W * .7, H * .32, seg(t, T.no, T.no + 1.6));
  cardHUD('TIDES ÷ 3', W * .66, H * .78, span(t, T.third - .1, T.q2 - .35), { size: 84, bg: '#CDEBFF' });
  cardHUD('2 · WOULD NIGHTS GO BLACK?', W / 2, 110, span(t, T.q2, T.q3 - .45), { size: 56 });
  cardHUD('NO MOON = NO CALENDAR', W / 2, H * .8, span(t, T.nomoon, T.q3 - .45), { size: 66, bg: '#FFD9D2' });
  cardHUD('3 · WOULD OUR DAYS CHANGE?', W / 2, 110, span(t, T.q3, T.smaller - .4), { size: 56 });
  cardHUD('+0.002 s', W * .73, H * .3, span(t, T.grows, T.away + .2), { size: 70, bg: '#FFFDF6', sub: 'PER CENTURY' });
  cardHUD('1 DAY = 24 H', W * .7, H * .32, span(t, T.stays - .1, T.smaller - .4), { size: 76, bg: '#CDEBFF' });
  const tilt = S.drift.tilt;
  cardHUD('23.5°', W * .8, H * .5, span(t, T.tilted + .3, T.without2 - .35), { size: 90, bg: '#FFFDF6', sub: t > T.wobble ? '± 1.3°  STEADY' : 'TILT = SEASONS' });
  cardHUD(`${Math.round(tilt)}°`, W * .8, H * .5, span(t, T.without2 + .2, T.so - .35), { size: 110, bg: '#FFFDF6', sub: t < T.newer ? 'LASKAR 1993: 0–85°' : t < T.atzero - .3 ? 'NEWER: TENS OF °' : t < T.at85 ? 'NO SEASONS' : t < T.endless ? 'POLE FACES THE SUN' : t < T.night ? 'ENDLESS DAY' : 'ENDLESS NIGHT' });
  cardHUD('TONIGHT:\nALMOST NOTHING.', W * .66, H * .3, span(t, T.tonight2, T.but - .1), { size: 80 });
  cardHUD('NEXT: WHAT IF EARTH\nSTOPPED SPINNING?', W * .5, H * .86, span(t, T.next, T.END), { size: 72, rot: -.02, bg: '#CDEBFF' });
  cardHUD('A PLANET THAT\nFORGETS ITS SEASONS', W * .64, H * .3, span(t, T.but + .2, T.next - .35), { size: 70, bg: '#FFD9D2' });
}

// ---------- seek
let current = null;
window.FILM = {
  T, SHOTS, duration: T.END,
  seek(t, o = {}) {
    const shot = SHOTS.find(([a, b]) => t >= a && t < b) || SHOTS.at(-1);
    const sc = S[shot[2]]; sc.update(t); current = shot[2];
    cam.aspect = W / H; cam.updateProjectionMatrix();
    renderer.render(sc.scene, cam); if (o.hud === false) hud.clearRect(0, 0, W, H); else overlay(t);
    return shot[2];
  },
};
await document.fonts.load('80px "Archivo Black"');
window.FILM_READY = true;
