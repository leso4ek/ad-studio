// Ad style "Voxel Stage" (ad-voxel-3d, 体素舞台): blocky voxel-toy people and things on a dark indigo stage, in three.js.
// Characters are built here from boxes (cube head with a flat decal face, hoodie torso, box limbs, block hair) from the
// bible's cast colours; products and props are stacks of bevelled boxes; places become a minimal block set floating in
// a navy void with out-of-focus light dots. A warm key, a cool rim, soft contact shadows. The directed camera (R.cam)
// becomes a real dolly + lens move framed on the subject's depth plane. Overlays: bible.overlay.steps (a STEP bar) and
// bible.captionMode 'words' (1-3 big words at a time). Original; see styles/ad-voxel-3d/STYLE.md.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { captionLines, transition } from './style2d.js';
import { clamp, lerp, seg, back, eo } from '/core/lib.js';

// ---------- palette ----------
// the stage (2D backdrop + set) per time of day; the cast/product/prop colours come from the bible
const STAGE = {
  day:   { bg0: '#070A22', bg1: '#141A4A', bg2: '#0B0E2C', glow: '#3B47A8', floor: '#2A3170', floorHi: '#4D5AB0', set: '#3E4C96', set2: '#2C3778', setTop: '#C9D0F2', trim: '#8C98D8',
           glass: '#A8DCFF', glassGlow: 1.1, bokeh: ['#FFC46B', '#FF8FB1', '#7FE0FF', '#FFFFFF', '#B49CFF', '#FFE08A'] },
  dusk:  { bg0: '#0B0820', bg1: '#2A1A4C', bg2: '#120B2A', glow: '#7A3F86', floor: '#35295E', floorHi: '#6A4A8E', set: '#4E3F86', set2: '#3A2F6C', setTop: '#E8CFE0', trim: '#B08AC8',
           glass: '#FFB070', glassGlow: 1.3, bokeh: ['#FFB25E', '#FF7FA0', '#FFD38A', '#FFFFFF', '#C79CFF', '#FF9A6B'] },
  night: { bg0: '#04061A', bg1: '#0C1238', bg2: '#060920', glow: '#22307A', floor: '#1E2558', floorHi: '#36428A', set: '#2E3A78', set2: '#222B60', setTop: '#9EA8DA', trim: '#6874B8',
           glass: '#4A63C8', glassGlow: .9, bokeh: ['#FFD27A', '#7FA8FF', '#7FE0FF', '#FFFFFF', '#9C8CFF', '#FF9EC7'] },
};
const COMMON = {
  skin: '#F2B48C', hair: '#3A2A22', hairInk: '#2A1C16', top: '#5B8CF0', bottom: '#2F3B66', shoe: '#F4F1EA', ink: '#0E1030', white: '#FFFFFF', cheek: '#FF8FA0',
  propA: '#FFB347', propB: '#63B8F2', plant: '#5CC46A', plant2: '#3B9A50', accent: '#FF5E6C', accent2: '#FFD23F', screen: '#8FE3FF', metal: '#B4BCD8', wood: '#B98358',
  sun: '#FFC34A', moon: '#FFF2C6', cloud: '#DDE3FF', glass: '#A8DCFF', building: '#2E3A78', building2: '#3A4790', windowLit: '#FFD670', ground: '#24305E', path: '#3A4680',
  wall: '#141A4A', wall2: '#2C3778', floor: '#2A3170', floor2: '#4D5AB0', sky: '#141A4A', sky2: '#2C3778',
  label: '#FFFFFF', labelInk: '#0E1030', custom: '#FF5E6C', textInk: '#FFFFFF', textBg: '#0E1030',
};
const YELLOW = '#FFD23F', INK = '#0A0B24';

// ---------- the world ----------
// frame height = U world units on the back plane (z = 0); the base camera sits at z = DIST looking straight down -z,
// so a layer's 2D pixel position maps to a 3D point that projects to the same pixel (toW), and the floor line of the
// 2D place is the back edge of a real floor
const U = 10, FOV = 30, DIST = U / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
const DOLLY = .5;
const PERSON_LOOK = { MS: .64, MCU: .72, CU: .78, ECU: .82 };
const HEAD_W = .38, HEAD_FILL = { EWS: .2, WS: .4, MS: .58, MCU: .66, CU: .76, ECU: 1.15 };  // share of the directed zoom done by moving the camera (the rest is lens)
let renderer, scene, cam, glc, root, key, rim, rim2, hemi, floorMesh, floorTex, floorAlpha, blobTex;
const GEO = new Map(), MAT = new Map(), TEX = new Map();

const style = {
  id: 'ad-voxel-3d', onTwos: false,
  fontFaces: ['400 40px "Archivo Black"', '800 40px "Inter"', '700 40px "Inter"'],
  defaultCast: { hairStyle: 'short' },
  palette: (time, over) => ({ ...COMMON, ...over }),
  font: role => role === 'sub' || role === 'small' ? { family: '"Inter"', weight: 800, lh: 1.08 } : { family: '"Archivo Black"', weight: 400, lh: 1.0 },

  setup(R) {
    glc = document.createElement('canvas'); glc.width = R.W; glc.height = R.H;
    renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(R.W, R.H, false); renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(FOV, R.W / R.H, .1, 300);
    hemi = new THREE.HemisphereLight('#9AA2E8', '#2A2448', 2.1); scene.add(hemi);
    key = new THREE.DirectionalLight('#FFE6C8', 3.1); key.position.set(-7, 11, 17); key.target.position.set(0, -1, 4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 5; key.shadow.bias = -.0008; key.shadow.normalBias = .02;
    Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 }); scene.add(key, key.target);
    rim = new THREE.DirectionalLight('#8FB4FF', 2.4); rim.position.set(8, 7, -9); rim.target.position.set(0, -1, 5); scene.add(rim, rim.target);
    rim2 = new THREE.DirectionalLight('#FF9EC7', .9); rim2.position.set(-9, 4, -6); rim2.target.position.set(0, -1, 5); scene.add(rim2, rim2.target);
    root = new THREE.Group(); scene.add(root);
    floorTex = canvasTex(1024, 1024, (x, w, h) => {
      const gr = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(.25, '#c8c8c8'); gr.addColorStop(.6, '#7a7a7a'); gr.addColorStop(1, '#505050');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,255,255,.10)'; x.lineWidth = 2;   // block tiles, one per 1.5 world units
      for (let i = 0; i <= 40; i++) { const p = i / 40 * w; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, h); x.stroke(); x.beginPath(); x.moveTo(0, p); x.lineTo(w, p); x.stroke(); }
    });
    floorAlpha = canvasTex(512, 512, (x, w, h) => {
      const gr = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, '#fff'); gr.addColorStop(.22, '#fff'); gr.addColorStop(.42, '#666'); gr.addColorStop(.62, '#000'); gr.addColorStop(1, '#000');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
    }, false);
    blobTex = canvasTex(128, 128, (x, w, h) => {
      const gr = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(.45, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
    });
    floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshPhongMaterial({ color: '#2A3170', map: floorTex, alphaMap: floorAlpha, transparent: true, shininess: 8, specular: new THREE.Color('#1a1d40') }));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.receiveShadow = true;
  },

  async scene(R, s) {
    const { g, W, H } = R;
    clear(root);
    const time = R.time || 'day', P = STAGE[time] || STAGE.day;
    const kind = R.bible.places?.[s.shot.place]?.kind || s.shot.place || 'studio';
    const fl = floorLine(kind, H), Yf = -(fl - H / 2) / H * U;
    const world = { W, H, fl, Yf, P, kind, R, LS: R.LANDSCAPE };
    // floor
    floorMesh.material.color.set(P.floor);
    floorMesh.position.set(0, Yf, 3); root.add(floorMesh);
    // set (minimal block pieces at the back)
    if (!s.end) buildSet(world, kind, R.bible.places?.[s.shot.place]);
    // layers → solids
    const placed = [];
    for (const L of s.layers) {
      if (L.layer.type === 'text') continue;
      const p = placeLayer(world, L);
      if (!p) continue;
      placed.push(p);
    }
    if (s.end) for (const p of placed) if (p.L.layer.type === 'product' && p.floating) pedestal(world, p);
    for (const p of placed) buildLayer(world, p, placed);
    // the directed camera
    const T = aimCamera(world, R.cam, s.shot, placed);
    // lights follow the frame a little so close-ups keep a rim
    rim.target.position.set(T.x, Yf, T.z); key.target.position.set(T.x * .5, Yf, Math.max(2, T.z));
    // picture: 2D backdrop (gradient, glow, bokeh), then the stage on top, then a vignette
    backdrop(R, P, T, R.cam);
    renderer.render(scene, cam);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(glc, 0, 0);
    const vg = g.createRadialGradient(W / 2, H * .46, Math.min(W, H) * .35, W / 2, H * .46, Math.hypot(W, H) * .62);
    vg.addColorStop(0, 'rgba(4,5,20,0)'); vg.addColorStop(1, 'rgba(4,5,20,.55)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.restore();
  },

  text(R, lay, lt) {
    const { g } = R, ly = lay.layer;
    const pop = [].concat(ly.anim || []).some(a => String(a).startsWith('pop')) ? back(seg(lt, 0, .32), 2.4) : 1;
    const cx = (lay.box[0] + lay.box[2]) / 2, cy = (lay.box[1] + lay.box[3]) / 2;
    g.save(); g.translate(cx, cy); g.scale(Math.max(.01, pop), Math.max(.01, pop)); g.translate(-cx, -cy);
    g.font = `${lay.font.weight} ${lay.size}px ${lay.font.family}`; g.textAlign = lay.align; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    if (lay.role === 'cta') {   // a yellow block button with a dark extruded side
      const [x0, y0, x1, y1] = lay.box, pad = lay.size * .5, dp = lay.size * .16, r = lay.size * .22;
      g.fillStyle = '#B8860B'; g.beginPath(); g.roundRect(x0 - pad, y0 - pad * .45 + dp, x1 - x0 + pad * 2, y1 - y0 + pad * .9, r); g.fill();
      g.fillStyle = YELLOW; g.beginPath(); g.roundRect(x0 - pad, y0 - pad * .45, x1 - x0 + pad * 2, y1 - y0 + pad * .9, r); g.fill();
      g.fillStyle = INK; for (const ln of lay.lines) g.fillText(ln.text, ln.x, ln.y - lay.size * .04);
      g.restore(); return;
    }
    if (lay.role === 'sub' || lay.role === 'small') {
      g.lineWidth = lay.size * .22; g.strokeStyle = INK;
      for (const ln of lay.lines) { g.strokeText(ln.text, ln.x, ln.y); g.fillStyle = ly.color || '#E9ECFF'; g.fillText(ln.text, ln.x, ln.y); }
      g.restore(); return;
    }
    // heavy block letters: an extruded side going down-right, a dark outline, a white (or chosen) face
    const depth = Math.max(3, Math.round(lay.size * .09)), side = ly.sideColor || '#1B1F5C', face = ly.color || '#FFFFFF';
    const hi = ly.hi ?? (lay.role === 'hook' || lay.role === 'logo' ? lastWordLine(lay) : -1);
    for (const [i, ln] of lay.lines.entries()) {
      g.fillStyle = INK; g.lineWidth = lay.size * .14; g.strokeStyle = INK;
      for (let d = depth; d > 0; d--) { g.fillStyle = d === depth ? INK : side; g.strokeText(ln.text, ln.x + d * .55, ln.y + d); g.fillText(ln.text, ln.x + d * .55, ln.y + d); }
      g.strokeText(ln.text, ln.x, ln.y);
      g.fillStyle = i === hi ? YELLOW : face; g.fillText(ln.text, ln.x, ln.y);
    }
    g.restore();
  },

  caption(R, text, box) {
    if (R.bible.captionMode === 'words') return wordCaption(R, text, box);
    const { g } = R, f = { family: '"Inter"', weight: 800 };
    const lines = captionLines(g, text, f, box.size, box.w), lh = box.size * 1.16, pad = box.size * .5;
    const widest = Math.max(...lines.map(l => g.measureText(l).width)), h = lh * lines.length;
    g.save();
    const x0 = box.cx - widest / 2 - pad, y0 = box.cy - h / 2 - pad * .5, bw = widest + pad * 2, bh = h + pad;
    g.fillStyle = 'rgba(6,7,26,.82)'; g.beginPath(); g.roundRect(x0, y0, bw, bh, box.size * .28); g.fill();
    g.strokeStyle = 'rgba(160,175,255,.35)'; g.lineWidth = Math.max(2, box.size * .06); g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach((l, i) => g.fillText(l, box.cx, box.cy - h / 2 + lh * (i + .55)));
    g.restore();
  },

  transition(R, kind, p) { transition(R, kind === 'wipe' ? 'iris' : kind, p, [STAGE.day.bg0]); },

  post(R) { stepsBar(R); },
};

// ---------- helpers ----------
function floorLine(kind, H) { return H * (kind === 'street' || kind === 'park' || kind === 'city' ? .74 : kind === 'sky' ? .9 : .7); }
function lastWordLine(lay) { return lay.lines.length > 1 ? lay.lines.length - 1 : -1; }
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function shade(hex, f) { const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, clamp(hsl.l * f, 0, 1)); return '#' + c.getHexString(); }
function mat(color, o = {}) {
  const k = color + (o.emissive ? '|e' + o.emissive + (o.ei || 1) : '') + (o.rough ? '|r' + o.rough : '') + (o.op ? '|o' + o.op : '');
  if (!MAT.has(k)) {
    // Phong, not PBR: matte toy plastic with a soft highlight, and about half the cost of a standard material in software GL
    const m = new THREE.MeshPhongMaterial({ color: new THREE.Color(color), shininess: o.rough ? 60 : 14, specular: new THREE.Color(o.rough ? '#555' : '#262630') });
    if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei || 1; }
    if (o.op) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; }
    MAT.set(k, m);
  }
  return MAT.get(k);
}
function geo(w, h, d) {
  w = Math.max(.002, w); h = Math.max(.002, h); d = Math.max(.002, d);
  const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  if (!GEO.has(k)) { const r = Math.min(w, h, d) * .14; GEO.set(k, r < .004 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, r)); }
  return GEO.get(k);
}
/** a bevelled box centred at (x, y, z) */
function box(parent, w, h, d, x, y, z, color, o = {}) {
  const m = new THREE.Mesh(geo(w, h, d), o.material || mat(color, o));
  m.position.set(x, y, z); if (o.rz) m.rotation.z = o.rz; if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx;
  m.castShadow = o.cast ?? true; m.receiveShadow = !!o.recv; parent.add(m); return m;   // only the floor takes the key's shadow (cheaper; blob shadows do the rest)
}
/** a chain of cubes along 2D points (unit space, y up), in plane z */
function chain(parent, pts, size, color, z = 0, o = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
    box(parent, len + size * .6, size, size, (x0 + x1) / 2, (y0 + y1) / 2, z, color, { ...o, rz: Math.atan2(y1 - y0, x1 - x0) });
  }
}
function clear(gp) { for (const o of [...gp.children]) gp.remove(o); }
const H01 = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };
const LL = (R, l) => R.LANDSCAPE && l.l16 ? { ...l, ...l.l16 } : l;

// pixel (px, py) at depth z → world x, y
function toW(world, px, py, z) { const k = (DIST - z) / DIST; return [((px - world.W / 2) / world.H) * U * k, -((py - world.H / 2) / world.H) * U * k]; }
function depthOf(world, yPx) {
  if (yPx <= world.fl + 1) return 0;
  const rel = (yPx - world.H / 2) / world.H;
  return DIST - (-world.Yf) * DIST / (U * rel);
}

/** where a layer stands: world position, height, depth (from its static y, so a falling drop does not change depth) */
function placeLayer(world, L) {
  const { R, H } = world, ly = LL(R, L.layer), xf = L.xf;
  if (!xf) return null;
  const yStatic = R.stage.y0 + (ly.y ?? .72) * R.stage.h;
  const z = depthOf(world, yStatic), k = (DIST - z) / DIST;
  const [x] = toW(world, xf.x, 0, z), [, y0] = toW(world, 0, yStatic, z);
  const dy = -(L.a?.dy || 0) * R.stage.h / H * U * k;
  const h = xf.h / H * U * k;
  return { L, x, y: y0 + dy, z, h, k, floating: yStatic < world.fl - H * .02, id: L.layer.id, kind: L.layer.type === 'prop' ? L.layer.kind : L.layer.type };
}

function buildLayer(world, p, placed) {
  const { L } = p, t = world.R.t;
  const grp = new THREE.Group();
  grp.position.set(p.x, p.y, p.z); grp.scale.setScalar(Math.max(.001, p.h));
  grp.rotation.z = -(L.xf.rot || 0);
  let footW = .5;
  if (L.layer.type === 'char') footW = buildChar(grp, world, p, placed);
  else if (L.layer.type === 'product') footW = buildProduct(grp, world, L);
  else footW = buildProp(grp, world, L, t);
  if (L.layer.type !== 'char' && L.xf.flip < 0) grp.scale.x *= -1;
  if (L.a && L.a.alpha < 1) grp.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity *= L.a.alpha; } });
  root.add(grp);
  // a soft contact shadow under anything standing on the floor
  if (!p.floating && L.layer.kind !== 'steam' && L.layer.kind !== 'sparkle') {
    const lift = Math.max(0, p.y - world.Yf), fade = clamp(1 - lift / (p.h * .8));
    if (fade > .02) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: .75 * fade * (L.a?.alpha ?? 1) }));
      s.rotation.x = -Math.PI / 2; s.position.set(p.x, world.Yf + .01, p.z + .02); s.scale.set(footW * p.h * 1.5, footW * p.h * .9, 1); root.add(s);
    }
  }
  if (L.a?.glow > 0) { const lt = new THREE.PointLight('#FFE2A8', 60 * L.a.glow, p.h * 6, 1.6); lt.position.set(p.x - p.h * .3, p.y + p.h * .7, p.z + p.h * 1.4); root.add(lt); }
}

// ---------- characters ----------
// pitch < 0 swings the arm forward, roll > 0 swings it out to the side; head tilt (roll) and nod (pitch, > 0 down)
const RIG = {
  neutral:   { l: [0, .1], r: [0, .1], tilt: 0, nod: 0, eyes: 'dot', mouth: 'smile0', brows: 'flat' },
  happy:     { l: [-.1, .28], r: [-.1, .28], tilt: .08, nod: -.06, eyes: 'arc', mouth: 'smile', brows: 'up' },
  sad:       { l: [.05, .03], r: [.05, .03], tilt: -.1, nod: .2, eyes: 'down', mouth: 'frown', brows: 'sad' },
  tired:     { l: [.08, .02], r: [.08, .02], tilt: -.16, nod: .24, eyes: 'half', mouth: 'flat', brows: 'sad' },
  surprised: { l: [-.35, 2.25], r: [-.35, 2.25], tilt: .03, nod: -.14, eyes: 'wide', mouth: 'o', brows: 'high' },
  point:     { l: [0, .1], r: [-1.35, .55], tilt: .05, nod: 0, eyes: 'dot', mouth: 'smile', brows: 'up' },
  wave:      { l: [0, .1], r: [-.2, 2.55], tilt: .08, nod: -.04, eyes: 'arc', mouth: 'smile', brows: 'up' },
  think:     { l: [-.95, -.6], r: [-2.05, -.12], tilt: .13, nod: -.08, eyes: 'up', mouth: 'flat', brows: 'one' },
  cheer:     { l: [-.15, 2.75], r: [-.15, 2.75], tilt: 0, nod: -.1, eyes: 'arc', mouth: 'grin', brows: 'up' },
  hold:      { l: [-1.15, -.18], r: [-1.15, -.18], tilt: .04, nod: .06, eyes: 'dot', mouth: 'smile', brows: 'flat' },
  annoyed:   { l: [.05, .5], r: [.05, .5], tilt: -.08, nod: .04, eyes: 'half', mouth: 'flat', brows: 'angry' },
};

function buildChar(grp, world, p, placed) {
  const { R } = world, L = p.L, layer = L.layer, spec = { ...(style.defaultCast || {}), ...(R.bible.cast?.[layer.id] || {}) }, m = L.m;
  const rig = { ...RIG.neutral, ...(RIG[layer.pose] || {}) };
  if (spec.kind === 'plant') return buildPlantChar(grp, world, p, placed, spec, rig);
  const t = R.t, ph = H01(layer.id || 'c') * 6.28, anims = [].concat(layer.anim || []).map(a => String(a).split(':')[0]);
  const kid = spec.age === 'kid', build = spec.build || 'regular';
  const bw = build === 'round' ? 1.18 : build === 'slim' ? .9 : 1, tall = build === 'tall' ? 1.05 : 1;
  // speaking? (a voice cue for this cast id) — and whom to look at (another cast member who is speaking)
  const cue = (R.cues || []).find(c => t >= c.t0 && t < c.t1);
  const talking = (L.a?.mouthOpen || 0) > .3 || (cue && cue.speaker === layer.id);
  let lookYaw = 0;
  if (cue && cue.speaker !== layer.id) { const o = placed.find(q => q.L.layer.type === 'char' && q.L.layer.id === cue.speaker); if (o) lookYaw = Math.sign(o.x - p.x) * .55; }
  const flip = L.xf.flip < 0 ? -1 : 1;
  const faceDir = (layer.face === 'right' ? 1 : layer.face === 'left' ? -1 : 0) * flip;
  const body = new THREE.Group(); grp.add(body);
  body.rotation.y = faceDir * .42;
  // idle life: a bob, breathing, a small sway
  const br = anims.includes('breathe') ? 1.6 : 1;
  body.position.y = Math.sin(t * 2.3 + ph) * .004 + (anims.includes('bob') ? Math.abs(Math.sin(t * 4.2 + ph)) * .012 : 0);
  const breathe = 1 + Math.sin(t * 3.4 + ph) * .012 * br;
  const hs = kid ? 1.12 : 1, legH = (kid ? .16 : .2) * tall, torsoH = (kid ? .24 : .27) * tall;
  const yHip = .06 + legH, yShoulder = yHip + torsoH * breathe, top = m.top, top2 = shade(top, .8);
  // shoes, legs
  for (const sd of [-1, 1]) {
    box(body, .12, .06, .17, sd * .07, .03, .02, m.shoe);
    box(body, .115, legH, .13, sd * .065, .06 + legH / 2, 0, m.bottom);
  }
  // hips + hoodie torso, pocket, collar, drawstrings, hood
  box(body, .3 * bw, .06, .19, 0, yHip, 0, m.bottom);
  const torso = box(body, .33 * bw, torsoH, .21, 0, yHip + torsoH / 2, 0, top); torso.scale.y = breathe; torso.position.y = yHip + torsoH * breathe / 2;
  box(body, .34 * bw, .035, .215, 0, yHip + .02, 0, top2);
  box(body, .2 * bw, .07, .02, 0, yHip + .07, .108, top2);
  box(body, .22, .035, .17, 0, yShoulder + .005, -.005, top2);
  box(body, .26, .1, .07, 0, yShoulder - .02, -.12, top2);
  for (const sd of [-1, 1]) box(body, .014, .07, .012, sd * .04, yShoulder - .05, .109, '#F4F1EA', { cast: false });
  // arms on shoulder pivots
  const swing = (L.a?.armSwing || 0), talkArm = talking ? Math.sin(t * 5 + ph) * .12 : 0;
  for (const sd of [-1, 1]) {
    const pr = sd < 0 ? rig.l : rig.r;
    const sh = new THREE.Group(); sh.position.set(sd * (.165 * bw + .045), yShoulder - .025, 0); body.add(sh);
    let pitch = pr[0], roll = pr[1] + (sd > 0 ? swing : 0);
    pitch += Math.sin(t * 2.1 + ph + sd) * .03 + (sd > 0 ? talkArm : 0);
    if (layer.pose === 'wave' && sd > 0) roll += Math.sin(t * 9) * .28;
    sh.rotation.set(pitch, 0, sd * roll);
    box(sh, .095, .2, .105, 0, -.1, 0, top);
    box(sh, .1, .03, .11, 0, -.2, 0, top2);
    box(sh, .085, .075, .09, 0, -.25, 0, m.skin);
  }
  // neck + head on a pivot
  box(body, .11, .04, .1, 0, yShoulder + .02, 0, m.skin);
  const head = new THREE.Group(); head.position.set(0, yShoulder + .035, .005); body.add(head);
  const sway = Math.sin(t * .9 + ph) * .05, nodTalk = talking ? Math.sin(t * 7.3 + ph) * .035 : 0;
  head.rotation.set(rig.nod + nodTalk + Math.sin(t * 1.7 + ph) * .015, lookYaw - faceDir * (lookYaw ? .42 : .08) + sway, -(rig.tilt + Math.sin(t * 1.3 + ph) * .02) * (faceDir || 1));
  head.scale.setScalar(hs);
  const HW = .34, HH = .33, HD = .32;
  box(head, HW, HH, HD, 0, HH / 2, 0, m.skin);
  // face decal
  const blink = !!L.a?.blink;
  let mouth = rig.mouth;
  if (talking) { const q = Math.floor(t * 11 + ph * 3), v = (Math.sin(q * 12.9898) * 43758.5) % 1; const a = Math.abs(v); mouth = a < .28 ? 'talk1' : a < .62 ? 'talk2' : a < .82 ? 'talk3' : 'talkO'; }
  const gaze = clamp(faceDir * .6 + lookYaw * .8, -1, 1);
  const lashes = spec.lashes ?? /\b(she|her|woman|girl|mum|mom|grandma)\b/i.test(spec.role || '');
  const face = new THREE.Mesh(planeGeo(.32, .31), faceMat({ eyes: blink ? 'shut' : rig.eyes, brows: rig.brows, mouth, gaze, skin: m.skin, brow: m.hairInk || m.hair, cheek: m.cheek, lashes }));
  face.position.set(0, HH / 2 - .005, HD / 2 + .0035); head.add(face);
  hair(head, spec.hairStyle || 'short', m.hair, HW, HH, HD, spec);
  return .5 * bw;
}

/** who speaks now: is this cast member talking (mouth shape), and which way should it look (toward another speaker) */
function voiceState(R, p, placed) {
  const layer = p.L.layer, t = R.t, ph = H01(layer.id || 'c') * 6.28;
  const cue = (R.cues || []).find(c => t >= c.t0 && t < c.t1);
  const talking = (p.L.a?.mouthOpen || 0) > .3 || !!(cue && cue.speaker === layer.id);
  let lookYaw = 0;
  if (cue && cue.speaker !== layer.id) { const o = placed.find(q => q.L.layer.type === 'char' && q.L.layer.id === cue.speaker); if (o) lookYaw = Math.sign(o.x - p.x) * .55; }
  let mouth = null;
  if (talking) { const q = Math.floor(t * 11 + ph * 3), a = Math.abs((Math.sin(q * 12.9898) * 43758.5) % 1); mouth = a < .28 ? 'talk1' : a < .62 ? 'talk2' : a < .82 ? 'talk3' : 'talkO'; }
  return { talking, lookYaw, mouth, ph };
}

// a speaking plant (cast kind "plant"): a box pot in the cast's bottom colour with the face on its front, leaf blocks in
// the top colour; sad/tired/annoyed droop the fronds, happy/cheer/surprised lift and spread them, neutral sits between
const PLANT_LIFT = { sad: -1, tired: -1, annoyed: -.75, happy: 1, cheer: 1.15, surprised: 1.1, wave: .6, point: .4, think: .1, hold: 0, neutral: 0 };
function buildPlantChar(grp, world, p, placed, spec, rig) {
  const { R } = world, L = p.L, layer = L.layer, t = R.t;
  const vs = voiceState(R, p, placed), flip = L.xf.flip < 0 ? -1 : 1;
  const faceDir = (layer.face === 'right' ? 1 : layer.face === 'left' ? -1 : 0) * flip;
  const potC = spec.bottom || '#C8643B', leafC = spec.top || '#3E8E5A', leaf2 = shade(leafC, .78), leaf3 = shade(leafC, 1.18);
  const body = new THREE.Group(); grp.add(body);
  body.rotation.y = faceDir * .3 + vs.lookYaw * .6 + Math.sin(t * .9 + vs.ph) * .04;
  const anims = [].concat(layer.anim || []).map(a => String(a).split(':')[0]);
  body.position.y = anims.includes('bob') ? Math.abs(Math.sin(t * 4.2 + vs.ph)) * .012 : 0;
  // the pot (the face lives on its front), a rim, soil
  const PW = .5, PH = .42, PD = .44;
  box(body, PW, PH, PD, 0, PH / 2, 0, potC);
  box(body, PW + .08, .09, PD + .08, 0, PH + .02, 0, shade(potC, .82));
  box(body, PW - .02, .02, PD - .02, 0, PH + .07, 0, '#4A2E22', { cast: false });
  box(body, PW + .02, .04, PD + .02, 0, .02, 0, shade(potC, .7));
  const face = new THREE.Mesh(planeGeo(.44, .34), faceMat({ eyes: L.a?.blink ? 'shut' : rig.eyes, brows: rig.brows, mouth: vs.mouth || rig.mouth, gaze: clamp(faceDir * .6 + vs.lookYaw * .8, -1, 1), skin: potC, brow: shade(leafC, .55), cheek: '#FF8FA0', lashes: !!spec.lashes }));
  face.position.set(0, PH / 2 - .02, PD / 2 + .0035); body.add(face);
  // fronds: lift -1 (droop) … 1 (up and spread)
  const lift = PLANT_LIFT[layer.pose] ?? 0, bounce = vs.talking ? Math.sin(t * 9 + vs.ph) * .06 : 0;
  const bend = lerp(.55, 2.2, clamp(-lift)) * (lift < 0 ? 1 : 0) + (lift >= 0 ? lerp(.45, -.12, lift) : 0);
  const spread = lerp(1, 1.35, clamp(lift)), n = 6;
  const fronds = [[-.95, .62, -.3], [-.55, .66, .5], [-.1, .7, 2.6], [.15, .74, .1], [.55, .66, -.5], [.95, .62, .3], [.35, .58, 2.4], [-.4, .56, -2.5]];
  for (const [a0, l, yaw] of fronds) {
    const a = a0 * spread, fr = new THREE.Group(); fr.position.y = PH + .07; fr.rotation.y = yaw; body.add(fr);
    const sway = Math.sin(t * 1.7 + a0 * 3 + vs.ph) * .05 + bounce, pts = [[0, 0]];
    for (let i = 1; i <= n; i++) { const u = i / n, ang = a + Math.sign(a || 1) * u * u * bend + sway * u; pts.push([Math.sin(ang) * l * u, Math.cos(ang) * l * u]); }
    chain(fr, pts, .05, leaf2, 0, { cast: false });
    for (let i = 1; i <= n; i++) {
      const [x, y] = pts[i], [px, py] = pts[i - 1], u = i / n, dir = Math.atan2(y - py, x - px);
      for (const sd of [-1, 1]) {
        const lw = .16 * (1 - u * .5), b = dir + sd * lerp(1.0, 1.4, clamp(-lift));
        box(fr, lw, .075, .03, x + Math.cos(b) * lw * .5, y + Math.sin(b) * lw * .5, 0, sd > 0 ? leafC : leaf3, { rz: b, cast: i % 2 === 0 });
      }
    }
    box(fr, .07, .07, .07, pts[n][0], pts[n][1], 0, leaf3);
  }
  return .6;
}

function hair(head, hs, color, HW, HH, HD, spec) {
  const c2 = shade(color, .82);
  if (hs === 'bald') return;
  if (hs === 'cap') {
    const cc = spec.hat || '#E8545A';
    box(head, HW + .03, .1, HD + .03, 0, HH + .03, 0, cc); box(head, HW + .02, .025, .16, 0, HH - .005, HD / 2 + .07, shade(cc, .8));
    box(head, .03, .14, HD * .8, -(HW / 2 + .012), HH - .08, -.02, color); box(head, .03, .14, HD * .8, HW / 2 + .012, HH - .08, -.02, color);
    return;
  }
  if (hs === 'curly') {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) box(head, .13, .1 + ((i + j) % 2) * .03, .13, -HW / 2 + .06 + i * .093, HH + .03, -HD / 2 + .06 + j * .08, (i + j) % 2 ? color : c2);
    box(head, HW + .03, .07, .06, 0, HH - .02, HD / 2 - .005, color);
    box(head, HW + .03, .2, .05, 0, HH - .1, -HD / 2 - .01, color);
    return;
  }
  // a block cap of hair over the top, a fringe over the brow, sides at the temples
  box(head, HW + .016, .06, HD + .016, 0, HH + .022, -.002, color);
  box(head, HW + .014, .06, .04, 0, HH - .02, HD / 2 - .012, color);
  box(head, .12, .04, .03, -.08, HH - .06, HD / 2 - .008, c2);   // a side-swept fringe step
  const sideH = hs === 'long' ? .42 : hs === 'bob' ? .3 : .17;
  for (const sd of [-1, 1]) box(head, .026, sideH, HD * .86, sd * (HW / 2 + .009), HH - sideH / 2 + .01, -.03, sd > 0 ? c2 : color);
  const backH = hs === 'long' ? .55 : hs === 'bob' ? .32 : .22;
  box(head, HW + .016, backH, .04, 0, HH - backH / 2 + .02, -HD / 2 - .012, color);
  if (hs === 'bun') {
    box(head, .16, .13, .16, 0, HH + .11, -.07, color); box(head, .17, .025, .17, 0, HH + .055, -.07, c2);
    for (const sd of [-1, 1]) box(head, .045, .2, .05, sd * (HW / 2 + .005), HH - .19, HD / 2 - .06, color);   // loose locks by the ears
  }
  if (hs === 'ponytail') box(head, .1, .26, .08, 0, HH - .12, -HD / 2 - .07, color);
}

// face decals, cached by state: square eyes with pupils, block brows, a 4-shape mouth, blush
function planeGeo(w, h) { const k = `p${w}|${h}`; if (!GEO.has(k)) GEO.set(k, new THREE.PlaneGeometry(w, h)); return GEO.get(k); }
function faceMat(f) {
  const k = `face|${f.eyes}|${f.brows}|${f.mouth}|${f.gaze.toFixed(1)}|${f.skin}|${f.brow}|${f.lashes}`;
  if (TEX.has(k)) return TEX.get(k);
  const tex = canvasTex(256, 248, (x, w, h) => {
    const ink = '#15122A', ex = [w / 2 - 52, w / 2 + 52], ey = 124, gx = f.gaze * 7;
    for (const cx of ex) {
      const e = f.eyes;
      if (e === 'arc') { x.fillStyle = ink; x.fillRect(cx - 17, ey + 2, 9, 9); x.fillRect(cx - 9, ey - 6, 18, 9); x.fillRect(cx + 9, ey + 2, 9, 9); continue; }
      if (e === 'shut') { x.fillStyle = ink; x.fillRect(cx - 17, ey + 4, 34, 7); continue; }
      const sw = e === 'wide' ? 44 : 38, sh = e === 'wide' ? 52 : 46;
      x.fillStyle = '#FFFFFF'; x.fillRect(cx - sw / 2, ey - sh / 2, sw, sh);
      const pw = e === 'wide' ? 16 : 20, phh = e === 'wide' ? 20 : 28, py = e === 'up' ? -9 : e === 'down' ? 8 : 3;
      x.fillStyle = ink; x.fillRect(cx - pw / 2 + gx, ey - phh / 2 + py, pw, phh);
      x.fillStyle = '#FFFFFF'; x.fillRect(cx - pw / 2 + gx + 3, ey - phh / 2 + py + 3, 6, 6);
      if (f.lashes) { const out = cx < w / 2 ? -1 : 1; x.fillStyle = ink; x.fillRect(cx - sw / 2 - 2, ey - sh / 2 - 6, sw + 4, 7); x.fillRect(out > 0 ? cx + sw / 2 - 2 : cx - sw / 2 - 8, ey - sh / 2 - 12, 10, 10); }
      if (e === 'half' || e === 'down') { x.fillStyle = f.skin; const lid = e === 'half' ? sh * .48 : sh * .3; x.fillRect(cx - sw / 2 - 2, ey - sh / 2 - 2, sw + 4, lid + 2); x.fillStyle = ink; x.fillRect(cx - sw / 2 - 2, ey - sh / 2 + lid - 3, sw + 4, 5); }
    }
    // brows
    x.fillStyle = f.brow;
    for (const [i, cx] of ex.entries()) {
      const sd = i ? 1 : -1, b = f.brows;
      const lift = b === 'high' ? -14 : b === 'up' ? -6 : b === 'one' && sd > 0 ? -12 : 0;
      const rot = b === 'sad' ? sd * .28 : b === 'angry' ? -sd * .34 : 0;
      x.save(); x.translate(cx, ey - 42 + lift); x.rotate(rot); x.fillRect(-21, -6, 42, 12); x.restore();
    }
    // blush
    x.fillStyle = f.cheek || '#FF8FA0'; x.globalAlpha = .55; x.fillRect(w / 2 - 92, ey + 30, 26, 12); x.fillRect(w / 2 + 66, ey + 30, 26, 12); x.globalAlpha = 1;
    // mouth
    const mx = w / 2 + gx * .8, my = 196;
    x.fillStyle = ink;
    switch (f.mouth) {
      case 'smile': x.fillRect(mx - 18, my, 36, 8); x.fillRect(mx - 26, my - 8, 10, 10); x.fillRect(mx + 16, my - 8, 10, 10); break;
      case 'smile0': x.fillRect(mx - 16, my, 32, 7); x.fillRect(mx - 22, my - 5, 8, 8); x.fillRect(mx + 14, my - 5, 8, 8); break;
      case 'frown': x.fillRect(mx - 18, my - 4, 36, 8); x.fillRect(mx - 26, my + 3, 10, 10); x.fillRect(mx + 16, my + 3, 10, 10); break;
      case 'flat': x.fillRect(mx - 18, my, 36, 7); break;
      case 'o': x.fillRect(mx - 11, my - 10, 22, 26); x.fillStyle = '#E05A6A'; x.fillRect(mx - 6, my + 6, 12, 7); break;
      case 'grin': x.fillRect(mx - 28, my - 10, 56, 26); x.fillStyle = '#fff'; x.fillRect(mx - 24, my - 10, 48, 7); x.fillStyle = '#E05A6A'; x.fillRect(mx - 12, my + 8, 24, 8); break;
      case 'talk1': x.fillRect(mx - 15, my - 3, 30, 12); break;
      case 'talk2': x.fillRect(mx - 18, my - 8, 36, 22); x.fillStyle = '#fff'; x.fillRect(mx - 14, my - 8, 28, 5); x.fillStyle = '#E05A6A'; x.fillRect(mx - 9, my + 7, 18, 7); break;
      case 'talk3': x.fillRect(mx - 22, my - 10, 44, 28); x.fillStyle = '#fff'; x.fillRect(mx - 18, my - 10, 36, 6); x.fillStyle = '#E05A6A'; x.fillRect(mx - 12, my + 9, 24, 9); break;
      case 'talkO': x.fillRect(mx - 12, my - 10, 24, 26); x.fillStyle = '#E05A6A'; x.fillRect(mx - 7, my + 7, 14, 7); break;
    }
  });
  const m = new THREE.MeshPhongMaterial({ map: tex, transparent: true, shininess: 14, specular: new THREE.Color('#262630'), polygonOffset: true, polygonOffsetFactor: -2 });
  TEX.set(k, m); return m;
}

// ---------- products ----------
function labelMat(text, bg, ink, accent, w, h) {
  const k = `label|${text}|${bg}|${ink}|${accent}|${w}|${h}`;
  if (TEX.has(k)) return TEX.get(k);
  const cw = 512, ch = Math.round(512 * h / w);
  const tex = canvasTex(cw, ch, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, cw, ch);
    x.fillStyle = accent; x.fillRect(0, ch * .08, cw, ch * .07); x.fillRect(0, ch * .85, cw, ch * .07);
    if (text) {
      let size = ch * .34; x.font = `400 ${size}px "Archivo Black"`; const tw = x.measureText(text).width; if (tw > cw * .84) size *= cw * .84 / tw;
      x.font = `400 ${size}px "Archivo Black"`; x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, cw / 2, ch * .5);
    }
  });
  const m = new THREE.MeshPhongMaterial({ map: tex, shininess: 20, specular: new THREE.Color('#303038'), polygonOffset: true, polygonOffsetFactor: -2 });
  TEX.set(k, m); return m;
}
function labelPlane(parent, spec, m, w, h, y, z) {
  const pl = new THREE.Mesh(planeGeo(w, h), labelMat(spec.label || '', m.label, m.labelInk, m.accent, w, h));
  pl.position.set(0, y, z); parent.add(pl);
}
function buildProduct(grp, world, L) {
  const spec = world.R.bible.product || {}, m = L.m, k = spec.kind || 'bottle', body = m.body, cap = m.cap, b2 = shade(body, .78);
  switch (k) {
    case 'jar':
      box(grp, .7, .58, .52, 0, .29, 0, body); box(grp, .74, .14, .56, 0, .65, 0, cap); box(grp, .76, .03, .58, 0, .6, 0, shade(cap, .75));
      labelPlane(grp, spec, m, .62, .3, .3, .261); return .8;
    case 'box':
      box(grp, .7, .86, .36, 0, .43, 0, body); box(grp, .72, .07, .38, 0, .89, 0, cap);
      labelPlane(grp, spec, m, .62, .34, .45, .181); return .8;
    case 'can':
      box(grp, .5, .86, .5, 0, .43, 0, body); box(grp, .46, .05, .46, 0, .885, 0, cap); box(grp, .52, .04, .52, 0, .02, 0, b2);
      labelPlane(grp, spec, m, .46, .4, .45, .251); return .6;
    case 'tube':
      box(grp, .22, .12, .22, 0, .06, 0, cap);
      [[.3, .12], [.42, .3], [.5, .52], [.56, .76]].forEach(([w, y], i) => box(grp, w, .24, .2 - i * .025, 0, y + .06, 0, body));
      box(grp, .6, .05, .1, 0, .98, 0, m.accent); labelPlane(grp, spec, m, .4, .22, .5, .101); return .5;
    case 'cup':
      box(grp, .42, .2, .42, 0, .1, 0, body); box(grp, .48, .4, .48, 0, .4, 0, body); box(grp, .56, .1, .56, 0, .65, 0, body); box(grp, .6, .08, .6, 0, .74, 0, cap);
      labelPlane(grp, spec, m, .44, .24, .4, .241); return .6;
    case 'bottle':
    default:
      if (k !== 'bottle' && k !== undefined && !['bottle'].includes(k)) return voxelize(grp, world.R.product(spec), m);
      box(grp, .45, .035, .31, 0, .018, 0, b2);
      box(grp, .44, .6, .3, 0, .33, 0, body);
      box(grp, .36, .07, .25, 0, .665, 0, body);
      box(grp, .26, .05, .19, 0, .72, 0, b2);
      box(grp, .16, .07, .13, 0, .775, 0, body);
      box(grp, .22, .15, .18, 0, .885, 0, cap);
      for (let i = 0; i < 3; i++) box(grp, .228, .016, .188, 0, .83 + i * .04, 0, shade(cap, .8), { cast: false });
      box(grp, .05, .4, .01, -.15, .38, .151, '#FFFFFF', { op: .22, cast: false });   // a glint stripe
      labelPlane(grp, spec, m, .4, .28, .33, .1515); return .5;
  }
}

// ---------- props ----------
function buildProp(grp, world, L, t) {
  const kind = L.layer.kind, m = L.m, R = world.R, c = L.layer.color;
  const ph = H01(L.layer.id || kind) * 6;
  switch (kind) {
    case 'fern': case 'fern-droopy': {
      const droop = kind === 'fern-droopy', pot = m.propB || '#63B8F2';
      box(grp, .42, .26, .38, 0, .13, 0, pot); box(grp, .5, .07, .45, 0, .29, 0, shade(pot, .82)); box(grp, .4, .02, .36, 0, .33, 0, '#4A2E22');
      const g1 = droop ? '#A3B04E' : m.plant, g2 = droop ? '#7C8A3A' : m.plant2;
      const fronds = droop ? [[-1.0, .62, -.35], [-.7, .6, .45], [1.0, .62, .3], [.72, .58, -.45], [-.35, .5, 2.6], [.4, .52, -2.7], [.08, .5, .1]]
        : [[-.95, .62, .3], [-.48, .72, -.8], [0, .8, .2], [.48, .72, .9], [.95, .62, -.3], [-.25, .55, 2.2], [.3, .55, -2.3]];
      const n = 7;
      for (const [a, l, yaw] of fronds) {
        const fr = new THREE.Group(); fr.position.y = .33; fr.rotation.y = yaw; grp.add(fr);
        const sway = Math.sin(t * 1.6 + a * 3 + ph) * (droop ? .02 : .05), pts = [[0, 0]];
        for (let i = 1; i <= n; i++) {
          const u = i / n, bend = droop ? u * u * 2.1 : u * u * .3, ang = a + Math.sign(a || 1) * bend + sway * u;
          pts.push([Math.sin(ang) * l * u, Math.cos(ang) * l * u]);
        }
        chain(fr, pts, .045, g2, 0, { cast: false });
        for (let i = 1; i <= n; i++) {
          const [x, y] = pts[i], [px, py] = pts[i - 1], u = i / n, dir = Math.atan2(y - py, x - px);
          for (const sd of [-1, 1]) {
            const lw = .15 * (1 - u * .55), b = dir + sd * (droop ? 1.35 : 1.0);
            box(fr, lw, .07, .028, x + Math.cos(b) * lw * .5, y + Math.sin(b) * lw * .5 - (droop ? .015 : 0), 0, sd > 0 ? g1 : shade(g1, .85), { rz: b, cast: i % 2 === 0 });
          }
        }
        box(fr, .06, .06, .07, pts[n][0], pts[n][1], 0, g1);
      }
      return .6;
    }
    case 'watering-can': {
      const col = c || m.propB, c2 = shade(col, .8);
      box(grp, .66, .52, .4, -.05, .27, 0, col); box(grp, .68, .05, .42, -.05, .53, 0, c2); box(grp, .2, .04, .2, -.05, .565, 0, '#20264F', { cast: false });
      chain(grp, [[.24, .3], [.44, .5], [.62, .68], [.76, .82]], .075, col);
      box(grp, .1, .16, .16, .8, .86, 0, c2, { rz: -.7 });
      chain(grp, [[-.36, .44], [-.5, .6], [-.44, .8], [-.18, .82], [.06, .66]], .06, c2);
      return .8;
    }
    case 'capful': {
      const cc = c || m.accent2;
      const cp = new THREE.Group(); cp.position.set(-.08, .7, 0); cp.rotation.z = -.55; grp.add(cp);
      box(cp, .34, .26, .3, 0, 0, 0, cc); for (let i = 0; i < 3; i++) box(cp, .35, .02, .31, 0, -.08 + i * .07, 0, shade(cc, .8), { cast: false });
      box(cp, .28, .03, .24, 0, -.13, 0, '#8FE3FF', { cast: false });
      // the dose: a stream of small cubes flowing down
      const flow = (t * 2.2) % 1;
      for (let i = 0; i < 7; i++) { const u = (i + flow) / 7, y = .62 - u * .62, x = .22 + Math.sin(u * 2.4) * .05; box(grp, .06, .08, .06, x, y, 0, m.screen, { op: .85, cast: false }); }
      box(grp, .26, .02, .18, .24, .01, 0, m.screen, { op: .7, cast: false });
      return .4;
    }
    case 'mug': {
      const col = c || m.propA;
      box(grp, .5, .58, .5, 0, .29, 0, col); box(grp, .44, .02, .44, 0, .585, 0, '#4A2E22', { cast: false });
      chain(grp, [[.25, .45], [.4, .45], [.4, .17], [.25, .17]], .07, shade(col, .85));
      return .55;
    }
    case 'steam': {
      for (let k = 0; k < 3; k++) for (let i = 0; i < 5; i++) {
        const u = ((i / 5) + t * .45 + k * .21) % 1, s = .09 * (1 - u * .4);
        box(grp, s, s, s, (k - 1) * .13 + Math.sin(u * 6 + k + t * 2) * .05, u * .85, 0, '#FFFFFF', { op: .55 * (1 - u), cast: false });
      }
      return .3;
    }
    case 'drop': {
      const col = c || m.propB;
      [[.5, .26, .13], [.56, .16, .3], [.44, .14, .45], [.3, .14, .58], [.16, .14, .7]].forEach(([w, h, y]) => box(grp, w, h, w * .8, 0, y, 0, col, { rough: .25 }));
      box(grp, .08, .12, .02, -.12, .4, .23, '#FFFFFF', { op: .7, cast: false });
      return .4;
    }
    case 'sparkle': case 'star': {
      const col = c || m.accent2, s = new THREE.Group(); s.position.y = .5; s.rotation.z = t * .6; grp.add(s);
      const em = { emissive: col, ei: .9, cast: false };
      box(s, .2, .2, .2, 0, 0, 0, col, em);
      for (const [x, y, l] of [[0, 1, .5], [0, -1, .5], [1, 0, .4], [-1, 0, .4]]) for (let i = 1; i <= 2; i++) { const sz = .15 - i * .035; box(s, sz, sz, sz, x * i * l * .45, y * i * l * .45, 0, col, em); }
      return .3;
    }
    case 'leaf': {
      const col = c || m.plant, l = new THREE.Group(); l.position.y = .5; l.rotation.z = -.5; grp.add(l);
      [[.16, .2, -.3], [.3, .22, -.1], [.34, .22, .1], [.24, .2, .3], [.1, .14, .44]].forEach(([w, h, y]) => box(l, w, h, .05, 0, y, 0, col));
      box(l, .03, .9, .06, 0, 0, .01, m.plant2);
      return .3;
    }
    case 'heart': {
      const col = c || m.accent, s = new THREE.Group(); grp.add(s);
      const rows = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
      rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'X') box(s, .14, .14, .14, (i - 3) * .14, .92 - j * .14, 0, col); }));
      return .5;
    }
    default: return voxelize(grp, R.prop(kind, c), m);
  }
}

/** any 2D kit primitive list as boxes: the fallback for products and props without a voxel build */
function voxelize(grp, prims, m) {
  let i = 0, wMax = .4;
  for (const p of prims) {
    const color = m[p.m] || m.ink || '#888', z = (i++) * .012;
    if (p.s === 'rrect') { box(grp, p.w, p.h, Math.min(p.w, p.h) * .7, p.x, -p.y, z, color, { rz: -(p.rot || 0) }); wMax = Math.max(wMax, p.w); }
    else if (p.s === 'ellipse') box(grp, p.rx * 1.8, p.ry * 1.8, p.flat ? .01 : Math.min(p.rx, p.ry) * 1.5, p.x, -p.y, z + (p.flat ? .2 : 0), color, { rz: -(p.rot || 0) });
    else if (p.s === 'cap') chain(grp, [[p.x1, -p.y1], [p.x2, -p.y2]], p.r * 2, color, z);
    else if (p.s === 'stroke') chain(grp, p.pts.map(([x, y]) => [x, -y]), Math.max(.02, p.w || .03), color, z);
    else if (p.s === 'poly') {
      const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      // stack a few slices that follow the outline's width row by row, so a shape still reads as itself
      const rows = 4, hgt = (y1 - y0) / rows;
      for (let r = 0; r < rows; r++) {
        const yc = y0 + hgt * (r + .5), xsAt = [];
        for (let j = 0; j < p.pts.length; j++) { const [ax, ay] = p.pts[j], [bx, by] = p.pts[(j + 1) % p.pts.length]; if ((ay - yc) * (by - yc) <= 0 && ay !== by) xsAt.push(ax + (yc - ay) / (by - ay) * (bx - ax)); }
        if (xsAt.length < 2) continue;
        const a = Math.min(...xsAt), b = Math.max(...xsAt);
        box(grp, Math.max(.02, b - a), hgt * 1.02, Math.min(.3, Math.max(.05, (x1 - x0) * .5)), (a + b) / 2, -yc, z, color);
      }
      wMax = Math.max(wMax, x1 - x0);
    }
  }
  return wMax;
}

// ---------- the set ----------
function buildSet(world, kind, def) {
  const { W, H, Yf, P, R } = world;
  const half = U * W / H / 2, sw = half * 2;   // frame width at the back plane
  const set = new THREE.Group(); root.add(set);
  const top = P.setTop, a = P.set, b = P.set2, trim = P.trim;
  const glassMat = new THREE.MeshPhongMaterial({ color: P.glass, emissive: P.glass, emissiveIntensity: P.glassGlow * .8, shininess: 60 });
  const windowAt = (x, y, w, h, z) => {
    const t = .16;
    box(set, w + t, t, .25, x, y + h / 2, z, trim); box(set, w + t, t, .25, x, y - h / 2, z, trim);
    box(set, t, h, .25, x - w / 2, y, z, trim); box(set, t, h, .25, x + w / 2, y, z, trim);
    box(set, t * .6, h, .2, x, y, z + .02, trim); box(set, w, t * .6, .2, x, y, z + .02, trim);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat); gl.position.set(x, y, z - .05); set.add(gl);
    box(set, w + .5, .14, .5, x, y - h / 2 - .14, z + .15, top);
    if (R.time === 'night') box(set, .5, .5, .1, x + w * .22, y + h * .2, z - .1, '#FFF2C6', { emissive: '#FFF2C6', ei: 1 });
  };
  const counter = (x0, x1, z, hgt = 1.55) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    box(set, w, hgt, 1.2, cx, Yf + hgt / 2, z, a);
    box(set, w + .14, .14, 1.36, cx, Yf + hgt + .07, z + .04, top);
    box(set, w, .12, 1.1, cx, Yf + .06, z + .08, b);
    for (let x = x0 + .9; x < x1 - .3; x += 1.1) { box(set, .04, hgt - .4, .04, x, Yf + hgt / 2 + .05, z + .61, b, { cast: false }); box(set, .08, .2, .08, x - .2, Yf + hgt - .35, z + .63, trim, { cast: false }); }
  };
  switch (kind) {
    case 'kitchen':
      counter(-half * 1.6, half * 1.6, -1.4);
      windowAt(0, 1.6, 2.6, 2.1, -3.2);
      box(set, 1.6, .9, .8, -half * .95, 3.7, -2.6, a); box(set, 1.6, .9, .8, half * .95, 3.7, -2.6, a);
      box(set, 1.62, .08, .82, -half * .95, 3.2, -2.55, b); box(set, 1.62, .08, .82, half * .95, 3.2, -2.55, b);
      box(set, .3, .45, .3, half * .55, Yf + 1.55 + .36, -1.6, '#E8E0D0'); box(set, .22, .3, .22, half * .55 + .35, Yf + 1.55 + .29, -1.5, '#F2C14E');
      break;
    case 'bedroom':
      windowAt(half * .45, 1.6, 2.0, 1.8, -3.2);
      box(set, 3.4, .6, 2, -half * .5, Yf + .3, -2.2, a); box(set, 3.2, .3, 1.9, -half * .5, Yf + .75, -2.2, top); box(set, .3, 1.6, 2, -half * .5 - 1.7, Yf + .8, -2.2, b);
      break;
    case 'office':
      for (let i = -1; i <= 1; i++) windowAt(i * 2.6, 1.8, 2.0, 2.2, -3.6);
      box(set, 4, .12, 1.4, half * .3, Yf + 1.3, -1.8, top); box(set, .14, 1.3, 1.2, half * .3 - 1.8, Yf + .65, -1.8, b); box(set, .14, 1.3, 1.2, half * .3 + 1.8, Yf + .65, -1.8, b);
      break;
    case 'bathroom':
      for (let r = 0; r < 5; r++) for (let c = -4; c <= 4; c++) box(set, .9, .5, .1, c * .95 + (r % 2) * .47, Yf + .3 + r * .55, -3, r % 2 ? a : b, { cast: false });
      box(set, 2.4, 1.6, .12, 0, 2.2, -2.9, P.glass, { emissive: P.glass, ei: .35 });
      break;
    case 'cafe':
      counter(-half * 1.6, half * 1.6, -1.6, 1.4);
      windowAt(0, 1.8, 3.8, 2.2, -3.4);
      for (let i = -1; i <= 1; i++) { box(set, .04, 2.2, .04, i * 1.8, 4.2, -1.2, trim, { cast: false }); box(set, .5, .32, .5, i * 1.8, 3.0, -1.2, '#FFD670', { emissive: '#FFD670', ei: .8, cast: false }); }
      break;
    case 'street': case 'city':
      for (let i = -6; i <= 6; i++) {
        const bw = 1.6 + H01('b' + i) * 1.4, bh = 3 + H01('h' + i) * 5, x = i * 2.1, z = -6 - H01('z' + i) * 3;
        box(set, bw, bh, 1.5, x, Yf + bh / 2, z, i % 2 ? a : b);
        for (let r = 0; r < Math.floor(bh / .9) - 1; r++) for (let c = -1; c <= 1; c++) if (H01(`${i}${r}${c}`) > .45) box(set, .3, .36, .06, x + c * bw * .28, Yf + .9 + r * .9, z + .76, '#FFD670', { emissive: '#FFD670', ei: .9, cast: false });
      }
      break;
    case 'park':
      for (let i = -4; i <= 4; i++) {
        const x = i * 2.2 + H01('t' + i) * .8, z = -2.5 - H01('tz' + i) * 4, hgt = 1.4 + H01('th' + i);
        box(set, .3, hgt, .3, x, Yf + hgt / 2, z, '#8A5A3C'); box(set, 1.3, 1.1, 1.3, x, Yf + hgt + .4, z, i % 2 ? '#3E9A50' : '#5CC46A'); box(set, .8, .6, .8, x + .2, Yf + hgt + 1.1, z, '#5CC46A');
      }
      break;
    case 'studio': case 'sky': default:
      // an empty stage: a low round of blocks at the back so the floor has an edge to read against
      for (let i = -5; i <= 5; i++) box(set, 1.1, .3 + (Math.abs(i) % 2) * .15, 1.1, i * 1.15, Yf + .15, -3.5, i % 2 ? a : b, { cast: false });
  }
  // place props (sun, cloud, …) floated at the back as voxel builds
  for (const pp of def?.props || []) {
    const px = R.stage.x0 + pp.x * R.stage.w, py = R.stage.y0 + pp.y * R.stage.h, z = -4, [x, y] = toW(world, px, py, z);
    const g2 = new THREE.Group(); g2.position.set(x, y, z); g2.scale.setScalar((pp.scale || 1) * .12 * R.stage.h / H * U * (DIST - z) / DIST); set.add(g2);
    buildProp(g2, world, { layer: { kind: pp.kind, color: pp.color, id: pp.kind }, m: { ...R.mats('prop', null, R.time), ...(pp.color ? { propA: pp.color, custom: pp.color } : {}) } }, R.t);
  }
}

function pedestal(world, p) {
  const top = p.y, hgt = top - world.Yf;
  if (hgt <= .05) return;
  const w = p.h * .9;
  box(root, w, hgt, w * .8, p.x, world.Yf + hgt / 2, p.z, world.P.set);
  box(root, w * 1.08, .1, w * .88, p.x, top - .05, p.z, world.P.setTop);
  box(root, w * 1.08, .1, w * .88, p.x, world.Yf + .05, p.z, world.P.set2);
}

// ---------- the camera ----------
// R.cam is the 2D framing (screen = cx + (P - cx + px·W)·zoom). Its visible window at zoom 1 is centred on Q; we aim a
// real camera at the 3D point under Q on the subject's depth plane, dolly part of the way in and close the lens for
// the rest, so the subject's plane is framed exactly as the 2D framing says and nearer things grow with perspective.
function aimCamera(world, c, shot, placed) {
  const { W, H } = world;
  let zoom = Math.max(.5, c.zoom || 1);
  const sub = shot.camera?.subject, size = shot.camera?.size;
  let zs = 0, s = null;
  if (sub) {
    s = placed.find(q => q.id === sub && q.L.layer.type !== 'text') || (sub === 'product' && placed.find(q => q.L.layer.type === 'product'))
      || placed.find(q => q.L.layer.type === 'prop' && q.L.layer.kind === sub) || placed.find(q => q.L.layer.type === 'char' && sub === 'character');
    if (s) zs = s.z;
  } else { const ch = placed.find(q => q.L.layer.type === 'char'); if (ch && zoom > 1.15) zs = ch.z; }
  // voxel heads are wider than the kit's round ones: a close framing on a person stops where the head (with its
  // hair) fills a set share of the frame width, so a CU shows the whole face and an MCU keeps the shoulders
  const plant = s && s.L.layer.type === 'char' && world.R.bible.cast?.[s.L.layer.id]?.kind === 'plant';
  if (s && s.L.layer.type === 'char' && size) {
    const cap = HEAD_FILL[size] * W / ((plant ? .78 : HEAD_W) * s.L.xf.h);
    if (zoom > cap) zoom = Math.max(1, cap);
  }
  // keep the subject's look point where the 2D framing put it (screen cx, cy) while the zoom may have changed;
  // a plant's face is on its pot, so its close framings look lower (from the kit's head height to the pot's middle)
  const Fx = c.cx - c.px * W, Fy = c.cy - c.py * H + (plant && size && size !== 'WS' && size !== 'EWS' ? (PERSON_LOOK[size] - .24) * s.L.xf.h : 0);
  const Qx = (W / 2 - c.cx) / zoom + Fx, Qy = (H / 2 - c.cy) / zoom + Fy;
  const ks = (DIST - zs) / DIST;
  const T = new THREE.Vector3(((Qx - W / 2) / H) * U * ks, -((Qy - H / 2) / H) * U * ks, zs);
  const C0 = new THREE.Vector3(0, 0, DIST), dir = C0.clone().sub(T).normalize(), d0 = C0.distanceTo(T);
  const d = d0 * Math.pow(zoom, -DOLLY);
  const pos = T.clone().addScaledVector(dir, d);
  const ang = c.angle || shot.camera?.angle || 'eye';
  pos.y += (ang === 'low' ? -.1 : ang === 'high' ? .16 : .05) * d;
  cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(T);
  const visH = U * ks / zoom;
  cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(visH / (2 * d))); cam.aspect = W / H; cam.zoom = 1; cam.updateProjectionMatrix();
  return T;
}

// ---------- the 2D backdrop: a navy void, a glow behind the stage, out-of-focus light dots ----------
function backdrop(R, P, T, c) {
  const { g, W, H } = R, z = Math.max(1, c.zoom || 1), zb = Math.pow(z, .45);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, P.bg0); gr.addColorStop(.5, P.bg1); gr.addColorStop(1, P.bg2);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const ox = -T.x / U * H * .18 * zb, oy = T.y / U * H * .12 * zb;
  const gl = g.createRadialGradient(W / 2 + ox * .5, H * .42 + oy * .5, 0, W / 2 + ox * .5, H * .42 + oy * .5, Math.max(W, H) * .55);
  gl.addColorStop(0, P.glow); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = .55; g.fillStyle = gl; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  // bokeh: seeded per place, drifting slowly, bigger and softer as the lens closes in
  g.globalCompositeOperation = 'lighter';
  const n = R.LANDSCAPE ? 46 : 30, seed = H01(R.shot?.place || 'stage') * 1000, blur = c.blurFar ? 1.4 : 1;
  for (let i = 0; i < n; i++) {
    const h = k => { const x = Math.sin((i + 1) * 78.233 + k * 12.9898 + seed) * 43758.5453; return x - Math.floor(x); };
    const u = (h(1) - .5) * 1.5, v = h(2) * .62 - .02, depth = .4 + h(3) * .9;
    const x = W / 2 + (u * Math.max(W, H * .75) + ox * depth + Math.sin(R.t * .25 + i) * W * .01) * zb;
    const y = H * .36 + ((v - .36) * H + oy * depth + Math.cos(R.t * .2 + i * 1.7) * H * .005) * zb;
    const r = (H * (.008 + h(4) * .03)) * zb * blur * (1 + depth * .4), col = P.bokeh[Math.floor(h(5) * P.bokeh.length)], a = (.1 + h(6) * .3) / Math.sqrt(blur);
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, hexA(col, a * .9)); rg.addColorStop(.7, hexA(col, a)); rg.addColorStop(.86, hexA(col, a * .55)); rg.addColorStop(1, hexA(col, 0));
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
function hexA(hex, a) { const c = new THREE.Color(hex); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${clamp(a, 0, 1).toFixed(3)})`; }

// ---------- overlay 1: word captions (bible.captionMode === 'words') ----------
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'per', 'her', 'his', 'she', 'he', 'it', 'its', 'is', 'are', 'was', 'with', 'no', 'then', 'they', 'we', 'you', 'i', 'my', 'your', 'our', 'their', 'this', 'that', 'have', 'has', 'had', 'be', 'just', 'so', 'very', 'will', 'can', 'do', 'does', 'did', 'still', 'than', 'from', 'by', 'as', 'if']);
function cueWords(cue) {
  if (Array.isArray(cue.words) && cue.words.length) {
    const rel = cue.words[0].t0 < cue.t0 - .05;   // word times may be absolute or relative to the cue
    return cue.words.map(w => ({ w: String(w.w ?? w.word ?? '').trim(), t0: (rel ? cue.t0 : 0) + w.t0, t1: (rel ? cue.t0 : 0) + (w.t1 ?? w.t0) })).filter(w => w.w);
  }
  const ws = cue.text.split(/\s+/).filter(Boolean), tot = ws.reduce((a, w) => a + w.length + 2, 0), d = cue.t1 - cue.t0;
  let acc = cue.t0;
  return ws.map(w => { const t0 = acc; acc += d * (w.length + 2) / tot; return { w, t0, t1: acc }; });
}
function chunks(words) {
  const out = []; let cur = [];
  for (const [i, w] of words.entries()) {
    cur.push(w);
    const punct = /[.,!?;:]$/.test(w.w), next = words[i + 1];
    if (!next || punct) { out.push(cur); cur = []; continue; }
    const full = cur.length >= 3 || (cur.length === 2 && clean(next.w).length > 7);
    if (!full) continue;
    // never leave "a", "the", "her" hanging at the end of a chunk: it opens the next one instead
    if (STOP.has(clean(w.w)) && cur.length > 1) { out.push(cur.slice(0, -1)); cur = [w]; }
    else { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out.map((c, i) => ({ words: c, t0: c[0].t0, t1: out[i + 1] ? out[i + 1][0].t0 : c[c.length - 1].t1 }));
}
const clean = w => w.toLowerCase().replace(/[^a-z0-9'’]/g, '');
function emphasis(R, ws) {
  const name = clean(R.bible.product?.name || R.bible.product?.label || '');
  let best = -1, score = -1;
  ws.forEach((w, i) => {
    const c = clean(w.w); let s = c.length;
    if (STOP.has(c)) s = 0; if (/\d/.test(c)) s = 80; if (name && c === name) s = 100;
    if (s > score) { score = s; best = i; }
  });
  return score > 0 ? best : -1;
}
function wordCaption(R, text, box) {
  const { g, W, H, SAFE } = R;
  const cue = (R.cues || []).find(c => R.t >= c.t0 && R.t < c.t1 && c.text === text) || { t0: R.t, t1: R.t + 1, text };
  const ch = chunks(cueWords(cue));
  const cur = ch.find(c => R.t >= c.t0 && R.t < c.t1) || (R.t < ch[0]?.t0 ? null : ch[ch.length - 1]);
  if (!cur) return;
  const hi = emphasis(R, cur.words);
  const cx = R.LANDSCAPE ? W / 2 : (SAFE.x0 + SAFE.x1) / 2, cy = R.LANDSCAPE ? H * .82 : R.shot?.end ? H * .765 : H * .69;   // below the end card's lines
  const maxW = (SAFE.x1 - SAFE.x0) * (R.LANDSCAPE ? .8 : .96);
  let size = R.LANDSCAPE ? H * .09 : W * .108;
  const words = cur.words.map(w => w.w.toUpperCase());
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const font = s => `400 ${s}px "Archivo Black"`;
  g.font = font(size);
  const sp = size * .28, widths = () => words.map(w => g.measureText(w).width);
  let ws = widths(), total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  if (total > maxW) { size *= maxW / total; g.font = font(size); ws = widths(); total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1); }
  const pop = back(seg(R.t - cur.t0, 0, .14), 2.6), sc = lerp(1.25, 1, pop);
  g.translate(cx, cy); g.scale(sc, sc);
  g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  let x = -total / 2;
  for (const [i, w] of words.entries()) {
    g.lineWidth = size * .2; g.strokeStyle = INK;
    g.fillStyle = INK; g.strokeText(w, x + size * .04, size * .09); g.fillText(w, x + size * .04, size * .09);   // a hard drop shadow
    g.strokeText(w, x, 0);
    g.fillStyle = i === hi ? YELLOW : '#FFFFFF'; g.fillText(w, x, 0);
    x += ws[i] + sp;
  }
  g.restore();
}

// ---------- overlay 2: the STEP bar (bible.overlay.steps) ----------
function stepsBar(R) {
  const steps = R.bible.overlay?.steps;
  if (!Array.isArray(steps) || !steps.length) return;
  const i = steps.findIndex(s => R.t >= s.t0 && R.t < s.t1);
  if (i < 0) return;
  const st = steps[i], { g, W, H, SAFE } = R;
  const label = String(st.label || `Step ${i + 1}`).toUpperCase(), title = String(st.title || '').toUpperCase();
  const cx = R.LANDSCAPE ? W / 2 : (SAFE.x0 + SAFE.x1) / 2, maxW = (SAFE.x1 - SAFE.x0) * .94;
  const yText = R.LANDSCAPE ? H * .085 : H * .163, yDash = R.LANDSCAPE ? H * .118 : H * .19;
  const inP = eo(seg(R.t - st.t0, 0, .25));
  let size = R.LANDSCAPE ? H * .045 : W * .062;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = inP; g.translate(0, (1 - inP) * -H * .02);
  const f = s => `400 ${s}px "Archivo Black"`, sep = '  ·  ';
  g.font = f(size);
  let wl = g.measureText(label + sep).width, wt = g.measureText(title).width;
  if (wl + wt > maxW) { size *= maxW / (wl + wt); g.font = f(size); wl = g.measureText(label + sep).width; wt = g.measureText(title).width; }
  const x0 = cx - (wl + wt) / 2;
  // a dark plate so the bar reads over anything
  const pad = size * .45;
  g.fillStyle = 'rgba(6,7,26,.62)'; g.beginPath(); g.roundRect(x0 - pad, yText - size * .72, wl + wt + pad * 2, (yDash - yText) + size * 1.12, size * .3); g.fill();
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineJoin = 'round'; g.lineWidth = size * .16; g.strokeStyle = INK;
  g.strokeText(label + sep, x0, yText); g.fillStyle = '#FFFFFF'; g.fillText(label + sep, x0, yText);
  g.strokeText(title, x0 + wl, yText); g.fillStyle = YELLOW; g.fillText(title, x0 + wl, yText);
  // progress: one dash per step; done = yellow, current fills, later = dim
  const n = steps.length, gap = size * .25, dw = Math.min(size * 1.3, (wl + wt - gap * (n - 1)) / n), dh = Math.max(4, size * .16);
  let dx = cx - (dw * n + gap * (n - 1)) / 2;
  for (let k = 0; k < n; k++) {
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(dx, yDash - dh / 2, dw, dh);
    const fill = k < i ? 1 : k === i ? seg(R.t, steps[k].t0, steps[k].t1) : 0;
    if (fill > 0) { g.fillStyle = YELLOW; g.fillRect(dx, yDash - dh / 2, dw * fill, dh); }
    dx += dw + gap;
  }
  g.restore();
}

export default style;
