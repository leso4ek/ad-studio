// Ad Studio kit · the directed camera. Pure functions (no DOM), so node tests can check the framing math.
// A bible shot can carry, besides the old {zoom:[a,b], pan:[[x,y],[x,y]], focus:[x,y]}:
//   camera: { size: 'EWS'|'WS'|'MS'|'MCU'|'CU'|'ECU', subject: '<cast id>'|'product'|'<prop kind>'|'<layer id>',
//             angle: 'eye'|'low'|'high', move: 'static'|'push'|'pull'|'pan-l'|'pan-r'|'tilt-up'|'tilt-down'|
//             'truck-l'|'truck-r'|'whip-l'|'whip-r'|'handheld'|'rack', amount: 0..1, at: [x, y] (screen target, 0..1),
//             ots: 'left'|'right' (over-the-shoulder silhouette) }
// The output keeps the contract every style already uses — {zoom, px, py, cx, cy} — plus optional extras that
// the page and style2d handle: shake {x, y}, whip (0..1 smear strength, sign = direction), blurFar/blurMid (px), ots.
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const vnoise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };

export const SIZES = ['EWS', 'WS', 'MS', 'MCU', 'CU', 'ECU'];
export const MOVES = ['static', 'push', 'pull', 'pan-l', 'pan-r', 'tilt-up', 'tilt-down', 'truck-l', 'truck-r', 'whip-l', 'whip-r', 'handheld', 'rack'];
// visible frame height as a multiple of the subject's height, and where on the subject the camera looks (0 = feet/base, 1 = top)
const FRAME = {
  person: { EWS: [5, .5], WS: [1.55, .5], MS: [1.15, .64], MCU: [.85, .72], CU: [.62, .78], ECU: [.4, .82] },  // kit people have big heads
  // rig v2 people (round 14): smaller heads, so close sizes frame higher and tighter on the body
  'person-drama': { EWS: [5, .5], WS: [1.3, .5], MS: [.62, .73], MCU: [.42, .8], CU: [.27, .88], ECU: [.15, .9] },
  'person-toon':  { EWS: [5, .5], WS: [1.35, .5], MS: [.78, .68], MCU: [.56, .76], CU: [.4, .84], ECU: [.24, .87] },
  'person-chibi': { EWS: [5, .5], WS: [1.45, .5], MS: [1.0, .64], MCU: [.78, .72], CU: [.56, .8], ECU: [.36, .84] },
  thing:  { EWS: [6, .5], WS: [3.2, .5], MS: [2.1, .5], MCU: [1.6, .5], CU: [1.25, .48], ECU: [.85, .42] },
};
const BASE_H = { char: .42, product: .3, prop: .12 };

/** The subject's box in pixels {x (centre), yBase, h, kind} from the shot's layers, or null. */
export function subjectBox(shot, subject, { stage, L = l => l, personOf }) {
  if (!subject) return null;
  const layers = shot.layers || [];
  const lay = layers.find(l => l.id === subject && l.type !== 'text') || (subject === 'product' && layers.find(l => l.type === 'product'))
    || layers.find(l => l.type === 'prop' && l.kind === subject) || layers.find(l => l.type === 'char' && subject === 'character');
  if (!lay) return null;
  const ly = L(lay), h = (ly.scale ?? 1) * (BASE_H[lay.type] || .12) * stage.h;
  return { x: stage.x0 + (ly.x ?? .5) * stage.w, yBase: stage.y0 + (ly.y ?? .72) * stage.h, h, kind: lay.type === 'char' ? (personOf ? personOf(lay.id) : 'person') : 'thing' };
}

/** The framing (zoom + offsets) that puts `size` of the subject at screen point `at`. */
export function frame(box, size, { W, H, at }) {
  const [mult, look] = FRAME[box.kind][size] || FRAME[box.kind].MS;
  const zoom = clamp(H / (box.h * mult), 1, 7);  // never zoom out past the drawn set
  const fx = box.x, fy = box.yBase - box.h * look;
  const sx = (at?.[0] ?? .5) * W, sy = (at?.[1] ?? (box.kind.startsWith('person') ? .42 : .48)) * H;
  // the style transform maps world P to cx + (P.x - cx + px*W) * zoom: with cx = sx, px = (sx - fx)/W, P = F lands on sx
  return { zoom, cx: sx, cy: sy, px: (sx - fx) / W, py: (sy - fy) / H };
}

/** The camera for frame lt (seconds into the shot). Old {zoom, pan, focus} shots keep their exact behaviour. */
export function directCamera(shot, lt, { W, H, stage, L }) {
  const c = shot.camera || {}, d = Math.max(.01, shot.t1 - shot.t0), p = eio(seg(lt, 0, d));
  if (!c.size) {
    const z = c.zoom ? lerp(c.zoom[0], c.zoom[1], p) : 1;
    const px = c.pan ? lerp(c.pan[0][0], c.pan[1][0], p) : 0, py = c.pan ? lerp(c.pan[0][1], c.pan[1][1], p) : 0;
    return { zoom: z, px, py, cx: W / 2 + (c.focus?.[0] ?? 0) * W, cy: H * (c.focus?.[1] ?? .55) };
  }
  const box = subjectBox(shot, c.subject, { stage, L, personOf: arguments[2].personOf }) || { x: stage.x0 + stage.w / 2, yBase: stage.y0 + stage.h * .72, h: stage.h * .42, kind: 'person' };
  let at = c.at ? [...c.at] : null;
  // angle: a low camera puts the subject higher in frame and drops the horizon; a high camera does the opposite
  const tiltY = c.angle === 'low' ? -.07 : c.angle === 'high' ? .07 : 0;
  if (tiltY) at = [at?.[0] ?? .5, (at?.[1] ?? (box.kind.startsWith('person') ? .42 : .48)) + tiltY];
  const f = frame(box, c.size, { W, H, at });
  const k = c.amount ?? .5, cam = { ...f, angle: c.angle || 'eye' };
  switch (c.move || 'static') {
    case 'push': cam.zoom = f.zoom * lerp(1 - .28 * k, 1, p); break;
    case 'pull': cam.zoom = f.zoom * lerp(1, 1 - .28 * k, p); break;
    case 'pan-l': case 'pan-r': { const s = c.move === 'pan-r' ? 1 : -1; cam.px = f.px - s * lerp(-.5, .5, p) * .16 * k * 2 / f.zoom; break; }
    case 'tilt-up': case 'tilt-down': { const s = c.move === 'tilt-up' ? -1 : 1; cam.py = f.py - s * lerp(-.5, .5, p) * .14 * k * 2 / f.zoom; break; }
    case 'truck-l': case 'truck-r': { const s = c.move === 'truck-r' ? 1 : -1; cam.px = f.px - s * lerp(-.5, .5, p) * .3 * k / f.zoom; cam.truck = true; break; }
    case 'whip-l': case 'whip-r': {
      // the shot opens mid-whip: the frame arrives from the side with a smear, settles in about 0.35 s
      const s = c.move === 'whip-r' ? 1 : -1, w = 1 - eio(seg(lt, 0, .35));
      cam.px = f.px + s * w * .9 / f.zoom; cam.whip = s * w; break;
    }
    case 'handheld': break;
    case 'rack': cam.blurFar = lerp(0, 9, eio(seg(lt, 0, Math.min(.8, d * .5)))) * k * 2 * (H / 1920); cam.blurMid = cam.blurFar * .45; break;
  }
  if (c.move === 'handheld' || c.shake) {
    const a = (c.shake ?? (.5 * k + .25)) * .006, t = lt * 1.7 + (shot.seed ?? 3);
    cam.shake = { x: (vnoise(t) - .5) * 2 * a, y: (vnoise(t + 41.3) - .5) * 2 * a };
    cam.px += cam.shake.x / cam.zoom; cam.py += cam.shake.y / cam.zoom;
  }
  if (c.ots) cam.ots = c.ots;
  cam.zoom = Math.max(1, cam.zoom);  // a pull-out on a wide frame never reveals the edge of the set
  return keepOnSet(cam, { W, H }, !!cam.whip);
}

/** Never show past the edge of the drawn set, on any parallax plane. style2d draws the far, mid and front planes with
 * zoom' = 1 + (zoom - 1)·d and offset px·d (d = .55, .75, .8, 1): clamp px/py so every plane still covers the frame. */
export function keepOnSet(cam, { W, H }, loose = false) {
  const slack = loose ? .25 : 0;
  const range = (c, p, size) => {
    let lo = -Infinity, hi = Infinity;
    for (const d of [.55, .75, .8, 1]) {
      const z = 1 + (cam.zoom - 1) * d;
      // world at screen 0 is (0 - c)/z + c - p*d*size >= 0, world at screen size is (size - c)/z + c - p*d*size <= size
      hi = Math.min(hi, ((-c) / z + c) / (d * size) + slack);
      lo = Math.max(lo, ((size - c) / z + c - size) / (d * size) - slack);
    }
    return lo <= hi ? clamp(p, lo, hi) : (lo + hi) / 2;
  };
  return { ...cam, px: range(cam.cx, cam.px, W), py: range(cam.cy, cam.py, H) };
}

/** Shots per 10 s, and other numbers the bible checks use. */
export function cutStats(shots, dur) {
  const n = shots.length;
  return { shots: n, perTen: +(Math.max(0, n - 1) / (dur || 1) * 10).toFixed(2), sizes: shots.map(s => s.camera?.size || null) };
}
