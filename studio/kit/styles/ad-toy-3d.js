// Ad style "Toy 3D" (ad-toy-3d): a hand-built soft-toy diorama in three.js. The shared 2D primitives become rounded
// matte solids (spheres, rounded boxes, capsules, bevelled extrusions); the place becomes a shallow stage with a real floor,
// soft key light and contact shadows. Clearly made, not photoreal. Original; see styles/ad-toy-3d/STYLE.md.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { captionLines, transition } from './style2d.js';
import { lerp } from '/core/lib.js';

const PAL = {
  day:  { wall: '#F6D9C2', wall2: '#EFC6A6', floor: '#9FD1C7', floor2: '#86BFB4', wood: '#C98F63', sky: '#A8DDF0', sky2: '#CDEBF3', glass: '#BFE3EE', metal: '#B9C3CC',
          plant: '#73B66B', plant2: '#93C97A', sun: '#FFC34A', moon: '#FFF2C6', cloud: '#FFFFFF', building: '#F29C7B', building2: '#F6C98E', windowLit: '#FFE7A3', ground: '#8CCB7A', path: '#F2DDB8' },
  dusk: { wall: '#F0C3A9', wall2: '#E3A98D', floor: '#7FAFA6', floor2: '#6C9C93', wood: '#A9714F', sky: '#F7A479', sky2: '#FBCB98', glass: '#EFB896', metal: '#A9A6AE',
          plant: '#5F9259', plant2: '#7DA868', sun: '#FFC34A', moon: '#FFF2C6', cloud: '#FFE3D2', building: '#C8705F', building2: '#D7A06E', windowLit: '#FFDC8C', ground: '#73A863', path: '#E0C29C' },
  night:{ wall: '#6C7DB0', wall2: '#5A6A9C', floor: '#4B5E86', floor2: '#3F5076', wood: '#5E4A5C', sky: '#2C3F75', sky2: '#3F5590', glass: '#4C67A0', metal: '#7A85A6',
          plant: '#3F6E5E', plant2: '#4F8270', sun: '#FFC34A', moon: '#FFF4CC', cloud: '#7E8DBA', building: '#43507F', building2: '#384370', windowLit: '#FFD670', ground: '#365B57', path: '#5D6690' },
};
const COMMON = { skin: '#F7C2A0', hair: '#5A3A2E', hairInk: '#3A2620', top: '#5BA6E8', bottom: '#F28F6B', shoe: '#3A3340', ink: '#2E2433', white: '#FFFFFF', cheek: '#F7958B',
  propA: '#FFB347', propB: '#7FC8F8', accent: '#FF6F61', accent2: '#FFD23F', screen: '#BDE6FF', textInk: '#2E2433', textBg: '#FFFFFF', custom: '#FF6F61', label: '#FFFFFF', labelInk: '#2E2433' };

let renderer, scene, cam, glc, root, matCache = new Map(), U = 10, DIST = 20;
const style = {
  id: 'ad-toy-3d', onTwos: false,
  fontFaces: ['800 40px "Baloo 2"', '600 40px "Baloo 2"'],
  palette: (time, over) => ({ ...COMMON, ...(PAL[time] || PAL.day), ...over }),
  font: role => ({ family: '"Baloo 2"', weight: role === 'sub' || role === 'small' ? 600 : 800, lh: .98 }),

  setup(R) {
    glc = document.createElement('canvas'); glc.width = R.W; glc.height = R.H;
    renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(R.W, R.H, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .92; renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .45;
    cam = new THREE.PerspectiveCamera(28, R.W / R.H, .1, 200);
    const hemi = new THREE.HemisphereLight('#fff6ea', '#7d8aa8', .7); scene.add(hemi);
    const key = new THREE.DirectionalLight('#fff1dd', 1.7); key.position.set(-6, 12, 10); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -.0005;
    Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: .5, far: 60 }); scene.add(key);
    const rim = new THREE.DirectionalLight('#cfe3ff', .8); rim.position.set(8, 6, -6); scene.add(rim);
    root = new THREE.Group(); scene.add(root);
  },

  async scene(R, s) {
    const { g, W, H } = R;
    clear(root);
    DIST = U / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    const A = W / H, dist = U / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    // world: frame height = U units at z = 0; camera looks slightly down at the floor line
    const time = R.time, pm = R.mats('place', null, time);
    const kind = R.bible.places?.[s.shot.place]?.kind || s.shot.place || 'studio';
    const pl = R.place(kind, W, H, s.shot.seed ?? 1), floorPx = pl.floor;
    const toW = (px, py, z = 0) => { const k = (DIST - z) / DIST; return [((px - W / 2) / H) * U * k, (-(py - H / 2) / H) * U * k]; };
    const floorY = toW(0, floorPx)[1];
    // backdrop: the far plane as a relief of slabs
    pl.far.forEach((p, i) => addPrim(root, p, pm, { pixel: true, toW, z: -6 + i * .004, depth: .25, W, H, z0: -6 }));
    // floor: a real horizontal stage
    const floorMat = mat(pm.floor || '#ccc'), fw = U * A * 1.6;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(fw, .3, 14), floorMat); floor.position.set(0, floorY - .15, 0); floor.receiveShadow = true; root.add(floor);
    for (const p of pl.mid) if (p.m === 'path' || p.m === 'floor2') { const b = bbox(p); const [x0] = toW(b[0], 0), [x1] = toW(b[2], 0); const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.2, x1 - x0), .06, p.m === 'path' ? 3 : .3), mat(pm[p.m])); m.position.set((x0 + x1) / 2, floorY + .02, p.m === 'path' ? 1 : -5.6); m.receiveShadow = true; root.add(m); }
    // place props (sun, clouds)
    for (const p of R.bible.places?.[s.shot.place]?.props || []) {
      const px = R.stage.x0 + p.x * R.stage.w, py = R.stage.y0 + p.y * R.stage.h;
      addGroup(root, R.prop(p.kind, p.color), { ...pm, ...(p.color ? { propA: p.color, custom: p.color } : {}) }, toW, px, py, (p.scale || 1) * .12 * R.stage.h, -4, H, 1, floorPx);
    }
    // layers
    for (const L of s.layers) {
      if (!L.prims) continue;
      const depthZ = L.xf.y > floorPx ? lerp(0, 5, Math.min(1, (L.xf.y - floorPx) / (H - floorPx))) : 0;
      const grp = addGroup(root, L.prims, L.m, toW, L.xf.x, L.xf.y, L.xf.h, depthZ, H, L.xf.flip, floorPx, L.xf);
      grp.traverse(o => { if (o.material) { if (L.a.alpha < 1) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = L.a.alpha; } } });
      if (L.a.glow > 0) { const lt = new THREE.PointLight('#fff2c0', 40 * L.a.glow, 12); lt.position.set(grp.position.x, grp.position.y + 2, grp.position.z + 3); root.add(lt); }
    }
    // camera
    const c = R.cam, look = new THREE.Vector3(c.px * U * A * -.5, c.py * U * .5, 0);
    cam.position.set(look.x, look.y + 2.2, dist); cam.lookAt(look.x, look.y, 0); cam.zoom = c.zoom; cam.aspect = A; cam.updateProjectionMatrix();
    scene.background = new THREE.Color(pm.wall || '#eee');
    renderer.render(scene, cam);
    g.drawImage(glc, 0, 0);
  },

  text(R, lay) {
    const { g, H } = R, m = R.mats('place', null, R.time);
    const face = lay.layer.color || (lay.role === 'cta' ? m.white : '#FFFFFF'), side = lay.role === 'cta' ? '#B6413A' : (lay.layer.sideColor || '#2E2433');
    g.save(); g.font = `${lay.font.weight} ${lay.size}px ${lay.font.family}`; g.textAlign = lay.align; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    if (lay.role === 'cta') { const [x0, y0, x1, y1] = lay.box, pad = lay.size * .45; g.fillStyle = m.accent; g.beginPath(); g.roundRect(x0 - pad, y0 - pad * .5, x1 - x0 + pad * 2, y1 - y0 + pad, (y1 - y0 + pad) / 2); g.fill(); }
    const depth = Math.max(2, Math.round(lay.size * .07));
    for (const ln of lay.lines) {
      g.fillStyle = side; for (let d = depth; d > 0; d--) g.fillText(ln.text, ln.x + d * .5, ln.y + d);
      g.lineWidth = lay.size * .08; g.strokeStyle = side; g.strokeText(ln.text, ln.x, ln.y);
      g.fillStyle = face; g.fillText(ln.text, ln.x, ln.y);
    }
    g.restore();
  },

  caption(R, text, box) {
    const { g } = R, f = { family: '"Baloo 2"', weight: 800 };
    const lines = captionLines(g, text, f, box.size, box.w), lh = box.size * 1.1, pad = box.size * .5;
    const widest = Math.max(...lines.map(l => g.measureText(l).width)), h = lh * lines.length;
    g.save(); g.fillStyle = 'rgba(46,36,51,.88)'; g.beginPath(); g.roundRect(box.cx - widest / 2 - pad, box.cy - h / 2 - pad * .5, widest + pad * 2, h + pad, box.size * .8); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach((l, i) => g.fillText(l, box.cx, box.cy - h / 2 + lh * (i + .55)));
    g.restore();
  },

  transition(R, kind, p) { transition(R, kind === 'wipe' ? 'iris' : kind, p, ['#2E2433']); },
};

function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), roughness: .62, metalness: 0, sheen: .4, sheenRoughness: .8, sheenColor: new THREE.Color('#ffffff'), clearcoat: .15, clearcoatRoughness: .6 }));
  return matCache.get(color);
}
function clear(g) { for (const o of [...g.children]) { g.remove(o); o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material && !matCache.has('#' + x.material.color?.getHexString?.())) { /* cached materials are reused */ } }); } }
function bbox(p) { if (p.s === 'rrect') return [p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2]; if (p.s === 'ellipse') return [p.x - p.rx, p.y - p.ry, p.x + p.rx, p.y + p.ry]; const xs = (p.pts || []).map(q => q[0]), ys = (p.pts || []).map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }

// unit-space primitives → a group of solids standing at pixel (px, py)
function addGroup(parent, prims, m, toW, px, py, hPx, z, H, flip = 1, floorPx, xf = {}) {
  const grp = new THREE.Group();
  const k = (DIST - z) / DIST, s = hPx / H * U * k;
  const [wx, wy] = toW(px, Math.min(py, floorPx ?? py), z);
  grp.position.set(wx, wy, z); grp.scale.set(s * flip * (xf.sx || 1), s * (xf.sy || 1), s); grp.rotation.z = -(xf.rot || 0);
  prims.forEach((p, i) => addPrim(grp, p, m, { z: i * .018, unit: true }));
  parent.add(grp); return grp;
}

function addPrim(parent, p, m, o) {
  const color = m[p.m] || m.ink || '#333';
  let mesh = null;
  if (o.pixel) {
    // backdrop slab in world units
    const b = bbox(p), [x0, y0] = o.toW(b[0], b[1], o.z0), [x1, y1] = o.toW(b[2], b[3], o.z0);
    if (p.s === 'text') return;
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0); if (w < .02 || h < .02) return;
    let geo;
    if (p.s === 'ellipse') { geo = new THREE.SphereGeometry(.5, 32, 16); mesh = new THREE.Mesh(geo, mat(color)); mesh.scale.set(w, h, Math.min(w, h) * .3); }
    else if (p.s === 'poly') { const sh = new THREE.Shape(p.pts.map(([x, y]) => new THREE.Vector2(...o.toW(x, y, o.z0)))); geo = new THREE.ExtrudeGeometry(sh, { depth: o.depth, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 2 }); mesh = new THREE.Mesh(geo, mat(color)); mesh.position.z = o.z; mesh.receiveShadow = true; parent.add(mesh); return; }
    else { geo = new RoundedBoxGeometry(w, h, o.depth, 3, Math.min(.12, w / 2, h / 2, o.depth / 2)); mesh = new THREE.Mesh(geo, mat(color)); }
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, o.z); mesh.receiveShadow = true; parent.add(mesh); return;
  }
  // unit space (y down in 2D → y up in 3D)
  const zf = p.flat ? .2 : 0;
  if (p.s === 'ellipse') {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), mat(color));
    const d = p.flat ? .01 : Math.min(p.rx, p.ry) * .95;
    mesh.scale.set(p.rx, p.ry, p.flat ? .012 : d); mesh.rotation.z = -(p.rot || 0); mesh.position.set(p.x, -p.y, o.z + zf);
  } else if (p.s === 'rrect') {
    const d = Math.min(p.w, p.h) * .7;
    mesh = new THREE.Mesh(new RoundedBoxGeometry(p.w, p.h, d, 3, Math.min(p.r || .01, p.w / 2 - .001, p.h / 2 - .001, d / 2 - .001)), mat(color));
    mesh.rotation.z = -(p.rot || 0); mesh.position.set(p.x, -p.y, o.z);
  } else if (p.s === 'poly') {
    const sh = new THREE.Shape(p.pts.map(([x, y]) => new THREE.Vector2(x, -y))), bb = bbox(p), sz = Math.min(bb[2] - bb[0], bb[3] - bb[1]);
    const d = p.flat ? .005 : Math.max(.03, sz * .45);
    mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: !p.flat, bevelThickness: d * .25, bevelSize: Math.min(.03, sz * .12), bevelSegments: 3, curveSegments: 6 }), mat(color));
    mesh.position.z = o.z - d / 2 + zf;
  } else if (p.s === 'cap') {
    const len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
    mesh = new THREE.Mesh(new THREE.CapsuleGeometry(p.r, Math.max(.001, len), 6, 14), mat(color));
    mesh.position.set((p.x1 + p.x2) / 2, -(p.y1 + p.y2) / 2, o.z); mesh.rotation.z = Math.atan2(p.x2 - p.x1, -(p.y2 - p.y1)) * -1 + Math.PI;
    mesh.rotation.z = -Math.atan2(p.x2 - p.x1, p.y2 - p.y1);
  } else if (p.s === 'stroke') {
    const curve = new THREE.CatmullRomCurve3(p.pts.map(([x, y]) => new THREE.Vector3(x, -y, 0)));
    mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, (p.w || .01) / 2, 8), mat(color)); mesh.position.z = o.z + zf;
  } else if (p.s === 'text') {
    const c = document.createElement('canvas'), px = 256; c.width = px * 4; c.height = px; const x = c.getContext('2d');
    x.font = `800 ${px * .8}px "Baloo 2"`; const tw = x.measureText(p.text).width, sc = Math.min(1, c.width * .95 / tw);
    x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${px * .8 * sc}px "Baloo 2"`; x.fillText(p.text, c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const w = p.w, h = w / 4;
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    mesh.position.set(p.x, -(p.y - p.size * .35), o.z + .25);
  }
  if (mesh) { mesh.castShadow = !p.flat; mesh.receiveShadow = true; parent.add(mesh); }
}

export default style;
