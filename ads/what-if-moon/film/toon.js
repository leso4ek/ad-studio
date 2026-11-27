// Stick Toon (what-if channel look), three.js: flat 3-step toon shading, thick ink outlines (inverted hulls),
// paper-cream or night backdrops, hand-lettered cards drawn on canvas textures. Original look; no reference
// characters, logos or show assets.
import * as THREE from 'three';

export const INK = '#17171C', PAPER = '#F3EAD7', PAPER2 = '#E7DABD', RED = '#E2453C', YELLOW = '#FFD447';
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => (t = clamp(t), t * t * (3 - 2 * t));
export const eo = t => 1 - Math.pow(1 - clamp(t), 3);
export const back = t => { t = clamp(t); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const seg = (t, a, b) => clamp((t - a) / (b - a));

// 3-tone gradient: shadow, mid, light. Nearest filtering gives hard bands, the hand-painted cel look.
let GRAD;
export function gradient() {
  if (GRAD) return GRAD;
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  GRAD = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  return GRAD;
}
const MATS = new Map();
export function toon(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshToonMaterial({ color, gradientMap: gradient(), ...o }));
  return MATS.get(k);
}
export const flat = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const INKMAT = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

/** An inverted-hull outline: the same geometry, scaled up a little, drawn back-faces only in ink. */
export function outline(mesh, w = .05) {
  const o = new THREE.Mesh(mesh.geometry, INKMAT);
  const g = mesh.geometry; g.computeBoundingSphere();
  const r = g.boundingSphere.radius || 1, s = 1 + w / r;
  o.scale.setScalar(s); o.renderOrder = -1; o.userData.hull = true; mesh.add(o);
  return mesh;
}
export function mesh(geo, mat, w = .05) { const m = new THREE.Mesh(geo, mat); if (w) outline(m, w); return m; }
export const sphere = (r, color, w = .05, seg = 40) => mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * .7)), toon(color), w);
export const box = (x, y, z, color, w = .05) => mesh(new THREE.BoxGeometry(x, y, z), toon(color), w);

/** A tube between two points (stick limbs, strings, axes): one unit cylinder re-posed every frame. */
const UP = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
export function stick(r, color = INK) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 14, 1), flat(color));
  m.userData.set = (a, b) => {
    _a.set(...a); _b.set(...b); _d.subVectors(_b, _a); const L = _d.length() || 1e-4;
    m.position.copy(_a).addScaledVector(_d, .5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(UP, _d.normalize());
  };
  return m;
}

/** Text on a canvas texture: cards, labels, big titles. */
export function textCanvas(lines, { w = 1024, h = 512, font = '"Archivo Black"', size = 120, color = INK, bg = null, pad = 40, align = 'center', lh = 1.05, border = 0, rot = 0, paper = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (paper) { // a little fibre and a darker edge, so cards read as paper
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .035})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 14; g.strokeRect(0, 0, w, h);
    }
  }
  if (border) { g.strokeStyle = INK; g.lineWidth = border; g.strokeRect(border / 2, border / 2, w - border, h - border); }
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  const L = Array.isArray(lines) ? lines : [lines];
  let s = size; g.font = `${s}px ${font}`;
  while (s > 20 && L.some(l => g.measureText(l).width > w - pad * 2)) { s -= 4; g.font = `${s}px ${font}`; }
  const total = L.length * s * lh, y0 = h / 2 - total / 2 + s * lh / 2;
  L.forEach((l, i) => g.fillText(l, align === 'center' ? w / 2 : pad, y0 + i * s * lh));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
export function card(lines, wWorld, hWorld, o = {}) {
  const px = 512 / hWorld * (o.res || 1);
  const tex = textCanvas(lines, { w: Math.round(wWorld * px), h: Math.round(hWorld * px), bg: o.bg ?? '#FFFDF6', paper: o.paper ?? true, ...o });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wWorld, hWorld), new THREE.MeshBasicMaterial({ map: tex, transparent: !o.bg && o.bg !== undefined }));
  if (o.ink !== false) { // an ink frame behind the card
    const f = new THREE.Mesh(new THREE.PlaneGeometry(wWorld + .08, hWorld + .08), flat(INK)); f.position.z = -.01; m.add(f);
  }
  m.userData.retext = (l2, o2 = {}) => { m.material.map.dispose(); m.material.map = textCanvas(l2, { w: Math.round(wWorld * px), h: Math.round(hWorld * px), bg: o.bg ?? '#FFFDF6', paper: o.paper ?? true, ...o, ...o2 }); m.material.needsUpdate = true; };
  return m;
}

/** A vertical gradient backdrop texture (sky, sea, paper) for scene.background. */
export function gradientTex(stops, w = 16, h = 512, grain = 0) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (grain) for (let i = 0; i < w * h * grain; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .05})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function paperTex() {
  const w = 960, h = 540, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
  const r = g.createRadialGradient(w / 2, h / 2, h * .2, w / 2, h / 2, w * .7); r.addColorStop(0, 'rgba(255,255,255,.25)'); r.addColorStop(1, 'rgba(120,90,40,.18)'); g.fillStyle = r; g.fillRect(0, 0, w, h);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(90,70,30,${rnd() * .05})`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
