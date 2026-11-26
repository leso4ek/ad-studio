// Ad Studio kit · character rig v2 (round 14). Pure functions, no DOM: rig(spec, opts) → primitives in unit space
// (feet at y = 0, top of the head at y = -1, x centred), the same contract as shapes.js character(), so every 2D style
// paints it unchanged. Curves are sampled into polygons; face details carry flat:true.
//
// spec (bible cast entry): rig:'v2', proportions:'drama'|'toon'|'chibi', build:'slim'|'average'|'broad'|'curvy'|'round'|'petite',
//   height (0.85-1.1), jaw:'oval'|'square'|'heart'|'round', eyes:{shape:'almond'|'round', color}, lashes, brows:'thin'|'medium'|'thick',
//   nose:'small'|'straight'|'broad'|'aquiline', lips:'thin'|'medium'|'full', hairStyle (HAIR below), details:[...DETAILS],
//   outfit:{top, bottom, shoes, accessories:[...]}, name (for the badge), skin/hair/top/top2/bottom/shoe/accent colours (materials).
// opts: pose (POSES), view:'front'|'34'|'profile', dir:+1 (faces viewer's right) | -1, expr (EXPR name), exprFrom, exprMix (0-1),
//   gaze:[x,y] (-1..1), blink, mouthOpen (0-1), viseme:'rest'|'A'|'E'|'O'|'M', walk (seconds, for the walk cycle), breath (seconds),
//   light:'left'|'right'.
const P = Math.PI;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- curve helpers ----------
/** Catmull-Rom through pts (open or closed), n samples per span. */
export function spline(pts, closed = false, n = 6) {
  const out = [], m = pts.length; if (m < 3) return pts.map(p => [...p]);
  const at = i => closed ? pts[(i + m) % m] : pts[clamp(i, 0, m - 1)];
  const spans = closed ? m : m - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  if (!closed) out.push([...pts[m - 1]]);
  return out;
}
const arc = (cx, cy, rx, ry, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
/** A tapered stroke as a filled polygon: centre line pts, width w0 → w1. */
function ribbon(pts, w0, w1 = w0) {
  const L = [], R = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const w = lerp(w0, w1, n > 1 ? i / (n - 1) : 0) / 2, nx = -dy / d * w, ny = dx / d * w;
    L.push([pts[i][0] + nx, pts[i][1] + ny]); R.push([pts[i][0] - nx, pts[i][1] - ny]);
  }
  return [...L, ...R.reverse()];
}

/** A ribbon whose width comes from a function of the point index. */
function ribbonW(pts, wf) {
  const L = [], R = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = wf(i) / 2;
    L.push([pts[i][0] - dy / d * w, pts[i][1] + dx / d * w]); R.push([pts[i][0] + dy / d * w, pts[i][1] - dx / d * w]);
  }
  // round ends
  const end = (p, q, w) => { const a = Math.atan2(q[1] - p[1], q[0] - p[0]); return arc(p[0], p[1], w, w, a + P / 2, a + 3 * P / 2, 6); };
  return [...end(pts[0], pts[1], wf(0) / 2).reverse().slice(0, 0), ...L, ...arc(pts[n - 1][0], pts[n - 1][1], wf(n - 1) / 2, wf(n - 1) / 2, Math.atan2(pts[n - 1][1] - pts[n - 2][1], pts[n - 1][0] - pts[n - 2][0]) - P / 2, Math.atan2(pts[n - 1][1] - pts[n - 2][1], pts[n - 1][0] - pts[n - 2][0]) + P / 2, 6), ...R.reverse()];
}
/** Applies a point map (and an angle for ellipses/rects) to primitives. */
function mapPrims(prims, f, ang = 0, s = 1) {
  return prims.map(p => {
    const q = { ...p };
    if (p.pts) q.pts = p.pts.map(([x, y]) => f(x, y));
    if (p.s === 'ellipse' || p.s === 'rrect' || p.s === 'text') { [q.x, q.y] = f(p.x, p.y); q.rot = (p.rot || 0) + ang; }
    if (p.s === 'ellipse') { q.rx = p.rx * s; q.ry = p.ry * s; }
    if (p.s === 'rrect') { q.w = p.w * s; q.h = p.h * s; q.r = (p.r || 0) * s; }
    if (p.s === 'cap') { [q.x1, q.y1] = f(p.x1, p.y1); [q.x2, q.y2] = f(p.x2, p.y2); q.r = p.r * s; }
    if (p.w && p.s === 'stroke') q.w = p.w * s;
    if (p.s === 'text') q.size = p.size * s;
    return q;
  });
}
const rotAbout = (cx, cy, a) => (x, y) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; };

// ---------- tables ----------
// body landmarks in heads from the top of the head, and the figure's height in heads
export const PROPORTIONS = {
  drama: { heads: 6.75, chin: 1, sh: 1.19, chest: 1.95, waist: 2.6, hip: 3.1, crotch: 3.38, knee: 4.85, ankle: 6.45, upper: 1.42, fore: 1.22, hand: .62, thigh: .62, w: 1, neck: .3 },
  toon:  { heads: 4.6, chin: 1, sh: 1.24, chest: 1.65, waist: 2.05, hip: 2.4, crotch: 2.56, knee: 3.55, ankle: 4.38, upper: .98, fore: .86, hand: .46, thigh: .5, w: .92, neck: .2 },
  chibi: { heads: 3.1, chin: 1, sh: 1.1, chest: 1.35, waist: 1.6, hip: 1.82, crotch: 1.92, knee: 2.5, ankle: 2.95, upper: .62, fore: .55, hand: .34, thigh: .42, w: .8, neck: .1 },
};
// half widths in heads: shoulder, chest, waist, hip
const BUILDS = { slim: [.88, .72, .5, .6], average: [.95, .8, .6, .66], broad: [1.1, .95, .72, .72], curvy: [.86, .8, .52, .82], round: [1.0, .98, .9, .9], petite: [.8, .68, .48, .62] };
export const HAIR = ['buzz', 'crew', 'side-part', 'slick-back', 'curly-top', 'afro', 'pixie', 'bob', 'lob', 'long-straight', 'long-wavy', 'ponytail', 'bun', 'braids', 'headscarf', 'bald', 'short', 'long', 'curly'];
export const TOPS = ['tee', 'shirt', 'blouse', 'blazer', 'suit', 'hoodie', 'knit', 'scrubs', 'dress', 'coat'];
export const BOTTOMS = ['trousers', 'jeans', 'skirt'];
export const ACCESSORIES = ['badge', 'watch', 'phone', 'bag', 'necklace', 'tie'];
export const DETAILS = ['glasses', 'stubble', 'beard', 'moustache', 'freckles', 'mole', 'earrings', 'age-lines', 'scar'];
// each expression: upper lid (0 open … 1 shut; < 0 shows white above the iris), lower lid raise, brow inner/outer lift (+up),
// brow knit (inner ends pulled together), pupil size, mouth curve (-1 frown … 1 smile), open (0-1), width, teeth, asym (smirk side),
// shape, head tilt (+ = chin down), lean back, tears, sweat, cheeks raised
export const EXPR = {
  neutral:     { lidU: .22, lidL: .05, bIn: 0, bOut: 0, knit: 0, pupil: 1, curve: .04, open: 0, width: 1, tilt: 0 },
  smile:       { lidU: .3, lidL: .32, bIn: .06, bOut: .02, knit: 0, pupil: 1, curve: .7, open: .12, width: 1.12, teeth: true, tilt: -.02, cheeks: 1 },
  warm:        { lidU: .34, lidL: .3, bIn: .14, bOut: 0, knit: 0, pupil: 1.05, curve: .45, open: 0, width: 1.04, tilt: .06, cheeks: .6 },
  smirk:       { lidU: .42, lidL: .18, bIn: -.02, bOut: .02, browR: .14, knit: 0, pupil: 1, curve: .25, open: 0, width: .95, asym: .8, tilt: -.03 },
  laugh:       { lidU: .9, lidL: .55, bIn: .14, bOut: .06, knit: 0, pupil: 1, curve: .85, open: .8, width: 1.2, teeth: true, tilt: -.1, cheeks: 1 },
  sad:         { lidU: .45, lidL: .08, bIn: .3, bOut: -.1, knit: .3, pupil: 1, curve: -.42, open: 0, width: .9, tilt: .1, gaze: [0, .6] },
  crying:      { lidU: .55, lidL: .25, bIn: .38, bOut: -.12, knit: .45, pupil: 1, curve: -.6, open: .3, width: 1.05, wobble: true, tilt: .12, tears: 2 },
  angry:       { lidU: .32, lidL: .28, bIn: -.3, bOut: .06, knit: .7, pupil: .9, curve: -.25, open: 0, width: .88, tilt: .06 },
  furious:     { lidU: .12, lidL: .32, bIn: -.38, bOut: .1, knit: .9, pupil: .8, curve: -.35, open: .6, width: 1.18, teeth: true, tilt: .04 },
  afraid:      { lidU: -.05, lidL: 0, bIn: .32, bOut: .02, knit: .55, pupil: .62, curve: -.3, open: .35, width: 1.1, teeth: true, tilt: -.06, back: .03, sweat: 1 },
  shocked:     { lidU: -.12, lidL: 0, bIn: .36, bOut: .3, knit: 0, pupil: .66, curve: 0, open: .72, width: .8, shape: 'o', tilt: -.08, back: .04 },
  disgusted:   { lidU: .45, lidL: .45, bIn: -.18, bOut: -.04, knit: .5, pupil: 1, curve: -.4, open: .1, width: 1, asym: -.6, tilt: .02, nose: 1 },
  contempt:    { lidU: .5, lidL: .12, bIn: 0, bOut: .04, knit: 0, pupil: 1, curve: .12, open: 0, width: .92, asym: .9, tilt: -.1 },
  suspicious:  { lidU: .55, lidL: .38, bIn: -.16, bOut: .04, browR: .16, knit: .3, pupil: 1, curve: -.06, open: 0, width: .82, tilt: .04, gaze: [.7, 0] },
  determined:  { lidU: .36, lidL: .22, bIn: -.16, bOut: 0, knit: .4, pupil: 1, curve: -.06, open: 0, width: .9, tilt: .07 },
  heartbroken: { lidU: .5, lidL: .12, bIn: .42, bOut: -.14, knit: .55, pupil: 1.05, curve: -.55, open: .14, width: .95, wobble: true, tilt: .1, tears: 1, gaze: [0, .5] },
};
const NUMERIC = ['lidU', 'lidL', 'bIn', 'bOut', 'browR', 'knit', 'pupil', 'curve', 'open', 'width', 'asym', 'tilt', 'back', 'tears', 'sweat', 'cheeks', 'nose'];
/** Blends two expressions (a → b by t). Pure. */
export function blendExpr(a, b, t) {
  const A = EXPR[a] || EXPR.neutral, B = EXPR[b] || EXPR.neutral, o = { ...(t < .5 ? A : B) };
  for (const k of NUMERIC) o[k] = lerp(A[k] ?? (k === 'pupil' || k === 'width' ? 1 : 0), B[k] ?? (k === 'pupil' || k === 'width' ? 1 : 0), t);
  o.gaze = [lerp(A.gaze?.[0] || 0, B.gaze?.[0] || 0, t), lerp(A.gaze?.[1] || 0, B.gaze?.[1] || 0, t)];
  return o;
}
/** The mouth shape for a letter of the line being spoken. Pure. */
export function visemeOf(ch) {
  ch = String(ch || '').toLowerCase();
  if ('mbp'.includes(ch) && ch) return 'M';
  if ('ouwq'.includes(ch) && ch) return 'O';
  if ('aiy'.includes(ch) && ch) return 'A';
  if (/[a-z]/.test(ch)) return 'E';
  return 'rest';
}
const VISEME = { rest: { open: 0, width: 1 }, A: { open: .7, width: 1.05 }, E: { open: .32, width: 1.18, teeth: true }, O: { open: .55, width: .66, shape: 'o' }, M: { open: 0, width: .95, press: true } };
// hand targets in heads relative to the shoulder joint (x + = away from the body, y + = down); front: forearm drawn over the torso
export const POSES = {
  idle:       { R: [.22, 2.6], L: [.22, 2.6], hR: 'open', hL: 'open', bendOut: .05 },
  talk:       { R: [.55, 1.75], L: [.22, 2.6], hR: 'open', hL: 'open', frontR: true, bendOut: 0 },
  point:      { R: [2.45, .45], L: [.3, 2.5], hR: 'point', hL: 'open' },
  'arms-crossed': { R: [-1.05, 1.05], L: [-1.0, 1.2], hR: 'fist', hL: 'fist', frontR: true, frontL: true, bendOut: .3 },
  'hands-on-hips': { R: [-.12, 1.5], L: [-.12, 1.5], hR: 'fist', hL: 'fist', bendOut: 2.5 },
  'hand-to-mouth': { R: [-.62, -.42], L: [.3, 2.5], hR: 'fist', hL: 'open', frontR: true, overR: true },
  'phone-to-ear': { R: [-.08, -.62], L: [.3, 2.5], hR: 'phone', hL: 'open', overR: true },
  'reading-phone': { R: [-.45, 1.35], L: [-.35, 1.45], hR: 'phone-flat', hL: 'open', frontR: true, frontL: true, look: [0, .9], bendOut: 0 },
  sit:        { R: [.05, 1.85], L: [.05, 1.85], hR: 'open', hL: 'open', sit: true, frontR: true, frontL: true },
  lean:       { R: [.22, 2.6], L: [.22, 2.6], hR: 'open', hL: 'open', lean: .07, bendOut: .05 },
  walk:       { R: [.22, 2.6], L: [.22, 2.6], hR: 'open', hL: 'open', walk: true, bendOut: .05 },
  cuffed:     { R: [-.38, 1.85], L: [-.38, 1.85], hR: 'cuffed', hL: 'cuffed', frontR: true, frontL: true, bendOut: 0, look: [0, .5] },
  recoil:     { R: [.45, .35], L: [.45, .35], hR: 'open', hL: 'open', frontR: true, frontL: true, lean: -.08 },
  // the v1 pose names, mapped
  neutral: 'idle', happy: 'idle', sad: 'idle', tired: 'idle', surprised: 'recoil', wave: 'talk', think: 'hand-to-mouth', cheer: 'recoil', hold: 'reading-phone', annoyed: 'arms-crossed',
};
const V1_EXPR = { happy: 'smile', sad: 'sad', tired: 'sad', surprised: 'shocked', think: 'suspicious', cheer: 'laugh', annoyed: 'angry', point: 'neutral', wave: 'smile' };

/** Two-bone IK: from shoulder s to target t with bone lengths a, b; bend side sgn. Returns the elbow. Pure. */
export function ik(s, t, a, b, sgn = 1) {
  let dx = t[0] - s[0], dy = t[1] - s[1], d = Math.hypot(dx, dy);
  const dm = Math.min(d, (a + b) * .999); if (d > dm) { dx *= dm / d; dy *= dm / d; d = dm; }
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * Math.max(d, 1e-6)), -1, 1), base = Math.atan2(dy, dx), ang = base - sgn * Math.acos(cosA);
  return { elbow: [s[0] + Math.cos(ang) * a, s[1] + Math.sin(ang) * a], hand: [s[0] + dx, s[1] + dy] };
}

// ---------- the rig ----------
export function rig(spec = {}, opts = {}) {
  const pr = PROPORTIONS[spec.proportions] || PROPORTIONS.drama, u = 1 / pr.heads;      // one head in units
  const Y = h => -1 + h * u;                                                             // heads from the top → unit y
  const bw = (BUILDS[spec.build] || BUILDS.average).map(v => v * u * pr.w);
  const view = opts.view === '34' || opts.view === 'three-quarter' ? '34' : opts.view === 'profile' ? 'profile' : 'front';
  const turn = view === 'front' ? 0 : view === '34' ? .55 : 1, D = 1;                    // built facing right; mirrored at the end for dir -1
  let pose = POSES[opts.pose] || POSES.idle; if (typeof pose === 'string') pose = POSES[pose];
  const exprName = opts.expr || V1_EXPR[opts.pose] || 'neutral';
  const E = opts.exprFrom ? blendExpr(opts.exprFrom, exprName, clamp(opts.exprMix ?? 1)) : blendExpr(exprName, exprName, 1);
  const outfit = { top: 'tee', bottom: 'trousers', shoes: 'shoes', accessories: [], ...(spec.outfit || {}) };
  const acc = new Set([...(outfit.accessories || [])]), det = new Set(spec.details || []);
  const out = [], push = (...p) => out.push(...p);
  const breath = Math.sin((opts.breath || 0) * P * .55) * .004;
  const sitDrop = pose.sit ? (pr.knee - pr.crotch) * u * .92 : 0;
  // ---- landmarks (front-view x; torso narrows with the turn) ----
  const tw = view === 'front' ? 1 : view === '34' ? .8 : .5;
  const shY = Y(pr.sh) + sitDrop + breath, chestY = Y(pr.chest) + sitDrop, waistY = Y(pr.waist) + sitDrop, hipY = Y(pr.hip) + sitDrop, crotchY = Y(pr.crotch) + sitDrop;
  const cx = turn * u * .06;                                                             // chest pushes forward a little when turned
  const [sw, cw, ww, hw] = bw.map(v => v * tw);
  const chinY = Y(pr.chin) + sitDrop + breath, headTop = Y(0) + sitDrop + breath, hh = u, hcx = cx + turn * u * .04;
  const lean = (pose.lean || 0) + (E.back ? -E.back : 0);
  // ---- legs ----
  const legs = [];
  const walkPh = pose.walk ? Math.sin((opts.walk || 0) * P * 2.2) : 0;
  for (const side of [-1, 1]) {
    const hipX = side * hw * .47, top = [hipX, crotchY - u * .3];
    let knee, ankle;
    if (pose.sit) {
      const fwd = turn > 0 ? D * (pr.knee - pr.crotch) * u * .95 * turn : 0;
      knee = [hipX + fwd + side * u * .05 * (1 - turn), crotchY - u * .05]; ankle = [knee[0] + side * u * .02, Y(pr.ankle)];
    } else {
      const swing = walkPh * side * u * .55 * (turn > .3 ? 1 : .35);
      ankle = [side * hw * .5 + swing, Y(pr.ankle)]; knee = [lerp(top[0], ankle[0], .52) + (turn > .3 ? D * u * .04 : 0), Y(pr.knee)];
      if (pose.walk) ankle[1] -= Math.max(0, -walkPh * side) * u * .25;
    }
    legs.push({ side, top, knee, ankle });
  }
  const skirtish = outfit.bottom === 'skirt' || outfit.top === 'dress';
  const legMat = skirtish ? (spec.legwear ? 'legwear' : 'skin') : 'bottom';
  const legPrims = [];
  for (const L of legs) {
    const tw0 = u * .62 * (hw / (u * .66)), tw1 = u * .4, sw1 = u * .26;
    const mid = [lerp(L.top[0], L.knee[0], .5) + L.side * u * .03, lerp(L.top[1], L.knee[1], .5)];
    const line = spline([L.top, mid, L.knee, L.ankle], false, 6), n = line.length;
    // width along the leg: thigh → knee → calf bulge → ankle
    const wAt = i => { const t = i / (n - 1); return t < .55 ? lerp(tw0, tw1, t / .55) : t < .75 ? lerp(tw1, tw1 * 1.05, (t - .55) / .2) : lerp(tw1 * 1.05, sw1, (t - .75) / .25); };
    legPrims.push({ s: 'poly', m: legMat, pts: ribbonW(line, wAt) });
    if (outfit.bottom === 'jeans') legPrims.push({ s: 'stroke', m: 'bottomShade', w: u * .025, flat: true, pts: [[L.top[0] + L.side * u * .16, L.top[1] + u * .2], L.knee.map((v, i) => v + (i ? 0 : L.side * u * .1)), [L.ankle[0] + L.side * u * .08, L.ankle[1]]] });
    // shoe: points the way the figure faces when turned
    const fl = u * (turn > .3 ? .62 : .42), fx = turn > .3 ? D * fl * .55 : L.side * u * .06, fy = Y(pr.heads) - u * .02;
    const shoe = outfit.shoes === 'heels' ? 'shoe' : 'shoe';
    legPrims.push({ s: 'poly', m: shoe, pts: spline([[L.ankle[0] - u * .16 + fx * .2, L.ankle[1] - u * .02], [L.ankle[0] + u * .16 + fx * .3, L.ankle[1] - u * .02], [L.ankle[0] + fx + u * .18, fy - u * .08], [L.ankle[0] + fx + u * .14, fy], [L.ankle[0] - u * .2, fy], [L.ankle[0] - u * .22, fy - u * .1]], true, 4) });
  }
  // ---- arms ----
  const arm = (side, def, hand, inFront) => {
    const s = [side * (sw - u * .1) + cx, shY + u * .16];
    const sgnX = side, tgt = def.slice();
    // targets are relative to the shoulder; x + = outward (for front/back views); turned figures reach forward instead
    let tx = s[0] + sgnX * tgt[0] * u, ty = s[1] + tgt[1] * u;
    if (turn > .3 && tgt[0] > .9) tx = s[0] + D * tgt[0] * u * (side === D ? 1 : .8);   // reaching out (pointing) goes the way the figure faces
    if (pose.walk) tx += -side * walkPh * u * .4 * (turn > .3 ? 1 : .3), ty -= Math.abs(walkPh) * u * .05;
    // of the two elbow solutions take the one that hangs down and points out (bendOut weights "out" — hands on hips)
    const c1 = ik(s, [tx, ty], pr.upper * u, pr.fore * u, 1), c2 = ik(s, [tx, ty], pr.upper * u, pr.fore * u, -1);
    const sc = c => (c.elbow[1] - s[1]) + (pose.bendOut ?? .5) * sgnX * (c.elbow[0] - s[0]);
    const j = sc(c1) >= sc(c2) ? c1 : c2;
    const sleeveMat = ['blazer', 'suit', 'coat'].includes(outfit.top) ? 'top2' : 'top';
    const shortSleeve = ['tee', 'scrubs'].includes(outfit.top) || outfit.top === 'dress' && !outfit.sleeves;
    const line = spline([s, [lerp(s[0], j.elbow[0], .5), lerp(s[1], j.elbow[1], .5)], j.elbow, j.hand], false, 6), n = line.length;
    const wA = i => { const t = i / (n - 1); return (t < .45 ? lerp(.44, .33, t / .45) : lerp(.33, .25, (t - .45) / .55)) * u * pr.w; };
    const whole = ribbonW(line, wA), ps = [];
    const capE = { s: 'ellipse', x: s[0], y: s[1] + u * .04, rx: u * .2 * pr.w, ry: u * .22 * pr.w };
    if (shortSleeve) {
      ps.push({ s: 'poly', m: 'skin', pts: whole });
      const k = Math.round(n * .3);
      ps.push({ ...capE, m: sleeveMat }, { s: 'poly', m: sleeveMat, pts: ribbonW(line.slice(0, k + 1), i => wA(i) * 1.15) });
    } else {
      ps.push({ ...capE, m: sleeveMat }, { s: 'poly', m: sleeveMat, pts: whole });
      const c0 = [lerp(j.elbow[0], j.hand[0], .86), lerp(j.elbow[1], j.hand[1], .86)];
      ps.push({ s: 'stroke', m: sleeveMat === 'top2' ? 'top2Shade' : 'topShade', w: u * .03, flat: true, pts: ribbon([c0, j.hand], u * .26, u * .26).slice(0, 2) });
    }
    ps.push(...handPrims(j.hand, Math.atan2(j.hand[1] - j.elbow[1], j.hand[0] - j.elbow[0]), hand, side, u * pr.hand / .62, acc, spec));
    if (acc.has('watch') && side === -1) ps.push({ s: 'rrect', m: 'metal', x: lerp(j.elbow[0], j.hand[0], .84), y: lerp(j.elbow[1], j.hand[1], .84), w: u * .2, h: u * .12, r: u * .03, rot: Math.atan2(j.hand[1] - j.elbow[1], j.hand[0] - j.elbow[0]) + P / 2 });
    return { ps, inFront };
  };
  const armR = arm(1, pose.R, pose.hR, pose.frontR), armL = arm(-1, pose.L, pose.hL, pose.frontL);
  // which arm is far: the one on the side away from the way the figure faces (when turned)
  const far = turn > .3 ? (D > 0 ? armL : armR) : null;
  // ---- hair (back layer), drawn first ----
  const H = hairPrims(spec.hairStyle || 'short', { hcx, headTop, hh, turn, D, chinY, shY, sw, u });
  push(...H.back);
  // far arm behind the body
  for (const a of [armR, armL]) if ((a === far && !a.inFront) || (!far && false)) push(...a.ps);
  push(...legPrims);
  // ---- torso and clothes ----
  push(...torsoPrims({ outfit, acc, spec, cx, sw, cw, ww, hw, shY, chestY, waistY, hipY, crotchY, u, turn, D, legs, pr, Y, sitDrop }));
  // arms beside the body (front view: both after the torso unless an arm crosses it)
  for (const a of [armR, armL]) if (a !== far && !a.inFront && !(pose.overR && a === armR)) push(...a.ps);
  // ---- neck ----
  const nw = u * .2 * (spec.build === 'broad' ? 1.25 : 1) * (pr.w);
  push({ s: 'poly', m: 'skin', pts: [[hcx - nw, chinY - u * .25], [hcx + nw, chinY - u * .25], [cx + nw * 1.15, shY + u * .1], [cx - nw * 1.15, shY + u * .1]] });
  push({ s: 'poly', m: 'skinShade', flat: true, pts: spline([[hcx - nw, chinY - u * .02], [hcx, chinY + u * .1], [hcx + nw, chinY - u * .02], [hcx + nw * .9, chinY + u * .04], [hcx - nw * .9, chinY + u * .04]], true, 3) });
  push(...collarPrims(outfit, { cx, shY, nw, u, turn, D, acc, spec }));
  // ---- head (rotated together by the tilt) ----
  const head = headPrims(spec, E, opts, { hcx, headTop, hh, turn, D, u, light: opts.light === 'right' ? 1 : -1 });
  const tilt = (E.tilt || 0) * .5 + (pose.look ? .12 : 0);
  push(...mapPrims([...head, ...H.front], rotAbout(hcx, chinY, tilt * (turn > .3 ? D : .25)), 0));
  // arms in front of the body / over the head
  for (const a of [armR, armL]) if (a.inFront || (pose.overR && a === armR)) push(...a.ps);
  if (acc.has('bag')) push({ s: 'stroke', m: 'accent', w: u * .05, pts: [[cx - sw * .7, shY + u * .05], [cx + hw * .9, hipY - u * .1]] }, { s: 'rrect', m: 'accent', x: cx + hw * 1.05, y: hipY + u * .05, w: u * .55, h: u * .45, r: u * .06 });
  // ---- whole-figure transforms: lean, height, mirror ----
  const hs = clamp(spec.height ?? (spec.age === 'kid' ? .78 : 1), .6, 1.15);
  const f = (x, y) => { const [rx, ry] = rotAbout(0, 0, lean)(x, y); return [(opts.dir === -1 ? -rx : rx) * hs, ry * hs]; };
  const res = mapPrims(out, f, lean, hs).map(p => ({ ...(opts.dir === -1 && (p.s === 'ellipse' || p.s === 'rrect') ? { ...p, rot: -(p.rot || 0) } : p), v2: true }));
  return res;
}

// ---------- hands ----------
function handPrims(at, ang, kind, side, k, acc, spec) {
  const u = k * .62 / 1, ps = [], [x, y] = at, c = Math.cos(ang), s = Math.sin(ang);
  const T = (a, b) => [x + a * c - b * s, y + a * s + b * c];                        // a along the forearm, b across
  const L = u * .11;
  const cuffed = kind === 'cuffed'; if (cuffed) kind = 'fist';
  if (kind === 'fist') {
    ps.push({ s: 'poly', m: 'skin', pts: spline([T(-L * .2, -L * .9), T(L * 1.6, -L * .95), T(L * 1.9, 0), T(L * 1.6, L * .95), T(-L * .2, L * .9)], true, 3) });
    ps.push({ s: 'stroke', m: 'skinLine', w: L * .25, flat: true, pts: [T(L * 1.2, -L * .6), T(L * 1.25, L * .6)] });
  } else if (kind === 'point') {
    ps.push({ s: 'poly', m: 'skin', pts: spline([T(-L * .2, -L * .85), T(L * 1.5, -L * .85), T(L * 1.7, 0), T(L * 1.5, L * .85), T(-L * .2, L * .85)], true, 3) });
    ps.push({ s: 'poly', m: 'skin', pts: ribbon([T(L * 1.2, -L * .45), T(L * 3.3, -L * .5)], L * .55, L * .45) });
  } else {
    // open hand: palm + fingers together + thumb
    ps.push({ s: 'poly', m: 'skin', pts: spline([T(-L * .2, -L * .9), T(L * 1.4, -L * 1.05), T(L * 2.9, -L * .7), T(L * 3.1, 0), T(L * 2.8, L * .7), T(L * 1.3, L * .95), T(-L * .2, L * .85)], true, 3) });
    ps.push({ s: 'poly', m: 'skin', pts: ribbon([T(L * .6, side * L * .7), T(L * 1.7, side * L * 1.45)], L * .5, L * .38) });
    for (const b of [-.35, .05, .45]) ps.push({ s: 'stroke', m: 'skinLine', w: L * .14, flat: true, pts: [T(L * 1.9, b * L), T(L * 2.85, b * L * 1.1)] });
  }
  if (cuffed) ps.push({ s: 'stroke', m: 'metal', w: L * .3, pts: Array.from({ length: 13 }, (_, i) => T(-L * .35 + Math.cos(i / 12 * 2 * P) * L * .22, Math.sin(i / 12 * 2 * P) * L * 1.1)) });   // a steel cuff on the wrist
  if (kind === 'phone' || kind === 'phone-flat' || (acc.has('phone') && kind === 'phone')) {
    const pw = L * 2.2, ph = L * 4.2;
    ps.push({ s: 'rrect', m: 'ink', x: x + c * L * 1.2, y: y + s * L * 1.2 - (kind === 'phone' ? ph * .35 : 0), w: pw, h: ph, r: L * .4, rot: kind === 'phone' ? 0 : ang - P / 2 });
    if (kind === 'phone-flat') ps.push({ s: 'rrect', m: 'screen', flat: true, x: x + c * L * 1.2, y: y + s * L * 1.2, w: pw * .82, h: ph * .86, r: L * .3, rot: ang - P / 2 });
  }
  return ps;
}

// ---------- torso & clothes ----------
function torsoPrims(o) {
  const { outfit, acc, spec, cx, sw, cw, ww, hw, shY, chestY, waistY, hipY, crotchY, u, turn, D } = o;
  const ps = [], jacket = ['blazer', 'suit', 'coat'].includes(outfit.top), long = outfit.top === 'coat';
  const hemY = outfit.top === 'dress' ? o.Y(o.pr.knee) - u * .35 + o.sitDrop * .6 : long ? o.Y(o.pr.knee) - u * .6 + o.sitDrop * .5 : jacket ? hipY + u * .25 : hipY - u * .05;
  const fwd = turn * D * u * .1;
  const body = (h, w = 1) => spline([[cx - sw * w, shY + u * .12], [cx - sw * .55 * w, shY - u * .02], [cx + sw * .55 * w, shY - u * .02], [cx + sw * w, shY + u * .12],
    [cx + cw * w + fwd, chestY], [cx + ww * w + fwd * .5, waistY], [cx + hw * w * (outfit.top === 'dress' || long ? 1.25 : 1), h], [cx - hw * w * (outfit.top === 'dress' || long ? 1.25 : 1), h], [cx - ww * w, waistY], [cx - cw * w, chestY]], true, 5);
  // the bottom: a hip band joining the legs (trousers / jeans / skirt)
  if (outfit.bottom === 'skirt') { const ky = o.Y(o.pr.knee) - u * .15 + o.sitDrop * .5; ps.push({ s: 'poly', m: 'bottom', pts: [[cx - ww * 1.02, waistY], [cx + ww * 1.02, waistY], [cx + hw * 1.08, hipY], [cx + hw * 1.22, ky - u * .04], [cx, ky + u * .02], [cx - hw * 1.22, ky - u * .04], [cx - hw * 1.08, hipY]] }); }
  else if (outfit.top !== 'dress') ps.push({ s: 'poly', m: 'bottom', pts: [[cx - hw * 1.02, hipY - u * .15], [cx + hw * 1.02, hipY - u * .15], [cx + hw * 1.05, crotchY + u * .05], [cx - hw * 1.05, crotchY + u * .05]] });
  if (jacket) {
    // shirt underneath, then the jacket open at the front
    ps.push({ s: 'poly', m: 'top', pts: body(hipY - u * .05, .96) });
    const L = spline([[cx - sw, shY + u * .12], [cx - sw * .55, shY - u * .02], [cx - u * .12, shY + u * .05], [cx - u * .02 + fwd, waistY - u * .1], [cx - u * .05, hemY], [cx - hw * 1.08, hemY], [cx - ww - u * .02, waistY], [cx - cw, chestY]], true, 5);
    const R = L.map(([x, y]) => [2 * cx - x + fwd * 2, y]);
    ps.push({ s: 'poly', m: 'top2', pts: L }, { s: 'poly', m: 'top2', pts: R });
    for (const sd of [-1, 1]) ps.push({ s: 'poly', m: 'top2Shade', flat: true, pts: [[cx + sd * u * .1 + fwd, shY + u * .06], [cx + sd * u * .38 + fwd, shY + u * .1], [cx + sd * u * .08 + fwd, chestY + u * .1]] });
    if (long || outfit.top === 'suit') for (let i = 0; i < 2; i++) ps.push({ s: 'ellipse', m: 'ink', flat: true, x: cx + u * .06 + fwd, y: waistY + i * u * .35, rx: u * .035, ry: u * .035 });
  } else {
    ps.push({ s: 'poly', m: 'top', pts: body(hemY) });
    if (outfit.top === 'hoodie') {
      ps.push({ s: 'poly', m: 'topShade', flat: true, pts: spline([[cx - ww * .8, hemY - u * .55], [cx + ww * .8, hemY - u * .55], [cx + ww * .9, hemY - u * .12], [cx - ww * .9, hemY - u * .12]], true, 2) });
      for (const sd of [-1, 1]) ps.push({ s: 'stroke', m: 'white', w: u * .025, flat: true, pts: [[cx + sd * u * .1, shY + u * .15], [cx + sd * u * .12, chestY - u * .05]] });
    }
    if (outfit.top === 'knit') for (const y of [hemY - u * .08]) ps.push({ s: 'stroke', m: 'topShade', w: u * .05, flat: true, pts: [[cx - hw * .95, y], [cx + hw * .95, y]] });
    if (outfit.top === 'scrubs') ps.push({ s: 'rrect', m: 'topShade', flat: true, x: cx - cw * .45, y: chestY - u * .05, w: u * .38, h: u * .3, r: u * .03 });
    if (outfit.top === 'shirt' || outfit.top === 'blouse') ps.push({ s: 'stroke', m: 'topShade', w: u * .025, flat: true, pts: [[cx + fwd, shY + u * .2], [cx + fwd * .5, hemY]] });
    if (outfit.top === 'dress') ps.push({ s: 'stroke', m: 'topShade', w: u * .05, flat: true, pts: [[cx - ww, waistY], [cx + ww + fwd * .5, waistY]] });
  }
  // cel shadow on the side away from the light
  const sh = -1;
  ps.push({ s: 'poly', m: jacket ? 'top2Shade' : 'topShade', flat: true, pts: spline([[cx + sh * sw * .95, shY + u * .2], [cx + sh * cw * .98, chestY], [cx + sh * ww * .98, waistY], [cx + sh * hw * .9, Math.min(hemY, hipY + u * .2)], [cx + sh * hw * .62, Math.min(hemY, hipY + u * .2) - u * .1], [cx + sh * ww * .72, waistY], [cx + sh * cw * .75, chestY]], true, 3) });
  if (acc.has('tie') || outfit.top === 'suit') ps.push({ s: 'poly', m: 'accent', pts: [[cx - u * .06 + fwd, shY + u * .14], [cx + u * .06 + fwd, shY + u * .14], [cx + u * .1 + fwd, waistY - u * .1], [cx + fwd, waistY + u * .05], [cx - u * .1 + fwd, waistY - u * .1]] });
  if (acc.has('necklace')) ps.push({ s: 'stroke', m: 'metal', w: u * .02, flat: true, pts: arc(cx, shY + u * .02, u * .22, u * .3, .15 * P, .85 * P, 10) });
  if (acc.has('badge')) {
    ps.push({ s: 'stroke', m: 'accent', w: u * .03, flat: true, pts: [[cx - u * .18, shY + u * .02], [cx - cw * .45 + fwd, chestY + u * .02], [cx - u * .02 + fwd, chestY + u * .08]] });
    ps.push({ s: 'rrect', m: 'white', x: cx - cw * .5 + fwd, y: chestY + u * .22, w: u * .5, h: u * .32, r: u * .04 });
    ps.push({ s: 'rrect', m: 'accent', flat: true, x: cx - cw * .5 + fwd, y: chestY + u * .1, w: u * .5, h: u * .08, r: u * .02 });
    if (spec.name) ps.push({ s: 'text', m: 'ink', x: cx - cw * .5 + fwd, y: chestY + u * .3, text: String(spec.name).toUpperCase().slice(0, 10), size: u * .11, w: u * .46, align: 'center', font: 'label', flat: true });
  }
  return ps;
}
function collarPrims(outfit, { cx, shY, nw, u, turn, D, acc }) {
  const ps = [], fwd = turn * D * u * .1;
  if (['shirt', 'blazer', 'suit', 'coat'].includes(outfit.top)) for (const sd of [-1, 1]) ps.push({ s: 'poly', m: outfit.top === 'shirt' ? 'top' : 'collar', pts: [[cx + sd * nw * 1.1 + fwd, shY - u * .06], [cx + sd * nw * .1 + fwd, shY + u * .16], [cx + sd * nw * 1.9 + fwd, shY + u * .14]] });
  else if (outfit.top === 'hoodie') ps.push({ s: 'poly', m: 'top', pts: spline([[cx - nw * 2.4, shY + u * .1], [cx - nw * 1.5, shY - u * .12], [cx + nw * 1.5, shY - u * .12], [cx + nw * 2.4, shY + u * .1], [cx + nw * 1.2, shY + u * .14], [cx - nw * 1.2, shY + u * .14]], true, 3) });
  else if (outfit.top === 'scrubs' || outfit.top === 'blouse') ps.push({ s: 'poly', m: 'skin', pts: [[cx - nw * 1.1 + fwd, shY - u * .02], [cx + nw * 1.1 + fwd, shY - u * .02], [cx + fwd, shY + u * .38]] });
  else ps.push({ s: 'stroke', m: 'topShade', w: u * .035, flat: true, pts: arc(cx + fwd, shY - u * .02, nw * 1.2, u * .12, .05 * P, .95 * P, 8) });
  return ps;
}

// ---------- head and face ----------
function headPrims(spec, E, opts, g) {
  const { hcx, headTop, hh, turn, D, u, light } = g, ps = [];
  const hy = headTop + hh * .5;                       // head centre
  const H = (x, y) => [hcx + x * hh, hy + y * hh];   // head-local (1 = one head) → units
  const jaw = { oval: [.3, .33, .1], square: [.34, .36, .15], heart: [.26, .3, .06], round: [.34, .31, .15] }[spec.jaw] || [.3, .33, .1];
  const fc = D * turn * .17;                           // the face's centre line moves toward the way it faces
  // ears (behind the head outline)
  if (turn < .3) for (const sd of [-1, 1]) ps.push({ s: 'ellipse', m: 'skin', x: H(sd * .37, .04)[0], y: H(0, .04)[1], rx: .065 * hh, ry: .11 * hh });
  // outline
  let outline;
  if (turn > .8) {
    const f = (x, y) => H(D * x, y);
    outline = spline([f(-.3, -.42), f(.05, -.52), f(.3, -.4), f(.38, -.18), f(.4, -.04), f(.37, .04), f(.5, .15), f(.39, .2), f(.41, .25), f(.37, .29), f(.4, .32), f(.33, .38), f(.36, .45), f(.2, .5), f(0, .42), f(-.25, .2), f(-.4, -.1)], true, 4);
  } else {
    const k = 1 - turn * .35, nr = 1 + turn * .08;     // far side narrows, near side rounds out
    const sx = x => x < 0 ? x * (D > 0 ? nr : k) : x * (D > 0 ? k : nr);   // the side it turns to narrows; the back of the head widens
    const [jx, jy, cw] = jaw;
    outline = spline([[-.37, -.05], [-.34, -.32], [-.18, -.49], [0, -.52], [.18, -.49], [.34, -.32], [.37, -.05], [.36, .14], [(jx + .36) / 2 + .01, (jy + .14) / 2 + .01], [jx, jy], [cw + fc * .6, .47], [fc * .6, .5], [-cw + fc * .6, .47], [-jx, jy], [-.355, .14]].map(([x, y]) => H(sx(x) + (y > .1 ? fc * .35 * (y - .1) / .4 : 0), y)), true, 4);
  }
  ps.push({ s: 'poly', m: 'skin', pts: outline });
  const earX = turn > .8 ? -D * .02 : -D * .3;
  if (turn > .3) { ps.push({ s: 'ellipse', m: 'skin', x: H(earX, .04)[0], y: H(0, .04)[1], rx: .065 * hh, ry: .11 * hh }); ps.push({ s: 'stroke', m: 'skinLine', flat: true, w: .012 * hh, pts: arc(H(earX, 0)[0], H(0, .04)[1], .035 * hh, .07 * hh, -P / 2 - D * .2, P / 2 - D * .2, 8) }); }
  // cel shade on the side away from the light (and under the hairline)
  const sd = turn > .3 ? -D : light < 0 ? 1 : -1;
  ps.push({ s: 'poly', m: 'skinShade', flat: true, pts: spline([H(sd * .36, -.15), H(sd * .37, .05), H(sd * .33, .28), H(sd * .2 + fc * .3, .44), H(sd * .27 + fc * .2, .28), H(sd * .31, .05), H(sd * .31, -.13)], true, 3) });
  // facial hair under the features (the mouth and nose draw over it)
  const det = new Set(spec.details || []);
  if (det.has('stubble') || det.has('beard')) {
    // the jaw part of the outline itself, closed by a curve around the mouth: it can never stick out of the face
    const jawPts = outline.filter(([x, y]) => y > hy + .12 * hh), inner = [H(fc * 1.25 + .2, .3), H(fc * 1.25, .4), H(fc * 1.25 - .2, .3)];
    if (jawPts.length > 3) ps.push({ s: 'poly', m: det.has('beard') ? 'hair' : 'stubble', flat: true, pts: [...jawPts.sort((a, b) => a[0] - b[0]), ...inner] });
  }
  // ---- eyes ----
  const shape = spec.eyes?.shape || 'almond', ey = .02, ew = shape === 'round' ? .12 : .135, ehh = shape === 'round' ? .095 : .075;
  const blink = opts.blink;
  const gz = [clamp((opts.gaze?.[0] ?? E.gaze?.[0] ?? 0) + (turn > .3 ? D * .25 : 0), -1, 1), clamp(opts.gaze?.[1] ?? E.gaze?.[1] ?? 0, -1, 1)];
  const eyes = turn > .8 ? [{ x: D * .27, k: .5, near: true, sd: D }] : [{ x: fc - D * .15, k: 1, near: true, sd: -D }, { x: fc + D * .14 * (1 - .3 * turn), k: 1 - .42 * turn, near: false, sd: D }];   // the far eye is on the side the face turns to
  if (turn < .3) { eyes[0].x = .165; eyes[0].sd = 1; eyes[1].x = -.165; eyes[1].sd = -1; eyes[1].k = 1; }
  for (const e of eyes) {
    const w = ew * e.k, cxE = e.x, open = clamp(1 - (blink ? 1 : E.lidU), 0, 1.15), lowR = clamp(E.lidL || 0);
    const top = y => [cxE, y], up = [], lo = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, x = cxE + (t - .5) * 2 * w, bulge = Math.sin(t * P) * (shape === 'almond' ? Math.pow(Math.sin(t * P), .3) : 1);
      const outer = (t - .5) * e.sd > 0;   // the outer corner lifts a little on almond eyes
      up.push([x, ey - ehh * bulge * (open * 1.05 - .05) + (outer && shape === 'almond' ? -.012 * (t - .5) * e.sd : 0)]);
      lo.push([x, ey + ehh * .75 * bulge * (1 - lowR * .7)]);
    }
    if (open < .08) {
      // shut: one curved lash line (smiling eyes curve up when the lower lid is high)
      const c = (E.lidL || 0) > .4 ? -1 : 1;
      ps.push({ s: 'stroke', m: 'ink', flat: true, w: .022 * hh, pts: Array.from({ length: 9 }, (_, i) => { const t = i / 8; return H(cxE + (t - .5) * 2 * w, ey + c * Math.sin(t * P) * .025); }) });
      continue;
    }
    const opening = [...up, ...lo.slice().reverse()];
    ps.push({ s: 'poly', m: 'white', flat: true, pts: opening.map(([x, y]) => H(x, y)) });
    // iris and pupil, clipped to the opening by clamping y between the lid curves
    const ir = .052 * (shape === 'round' ? 1.1 : 1) * Math.min(1, e.k + .3), ix = cxE + gz[0] * w * .45, iy = ey + gz[1] * ehh * .3;
    const lidAt = (arr, x) => { const i = clamp(Math.round((x - (cxE - w)) / (2 * w) * 10), 0, 10); return arr[i][1]; };
    const clip = pts => pts.map(([x, y]) => { const xc = clamp(x, cxE - w * .98, cxE + w * .98); return [xc, clamp(y, lidAt(up, xc) + .002, lidAt(lo, xc) - .002)]; });
    ps.push({ s: 'poly', m: 'iris', flat: true, pts: clip(arc(ix, iy, ir * e.k * .95 + .004, ir, 0, 2 * P, 20)).map(([x, y]) => H(x, y)) });
    ps.push({ s: 'poly', m: 'ink', flat: true, pts: clip(arc(ix, iy, ir * .48 * E.pupil * e.k, ir * .48 * E.pupil, 0, 2 * P, 14)).map(([x, y]) => H(x, y)) });
    if (open > .3) ps.push({ s: 'ellipse', m: 'white', flat: true, x: H(ix + ir * .35, 0)[0], y: H(0, iy - ir * .4)[1], rx: ir * .28 * hh, ry: ir * .28 * hh });
    // lash line and lid crease
    ps.push({ s: 'poly', m: 'ink', flat: true, pts: ribbon(up.map(([x, y]) => H(x, y)), .016 * hh, spec.lashes ? .03 * hh : .02 * hh) });
    if (spec.lashes) { const o = up[e.sd > 0 ? 10 : 0]; ps.push({ s: 'stroke', m: 'ink', flat: true, w: .016 * hh, pts: [H(o[0], o[1]), H(o[0] + e.sd * .035, o[1] - .025)] }); }
    ps.push({ s: 'stroke', m: 'skinLine', flat: true, w: .01 * hh, pts: up.slice(2, 9).map(([x, y]) => H(x, y - .035 - (1 - open) * .01)) });
    ps.push({ s: 'stroke', m: 'skinLine', flat: true, w: .008 * hh, pts: lo.slice(3, 8).map(([x, y]) => H(x, y + .008)) });
    // brows: inner end near the nose; knit pulls it in and down, the outer end follows bOut
    const bt = { thin: .022, medium: .034, thick: .05 }[spec.brows] || .034;
    const inner = cxE - e.sd * w * .85, outerX = cxE + e.sd * w * 1.15, by = ey - ehh - .06;
    const lift = (e.sd > 0 ? (E.browR || 0) : 0);
    const bi = [inner + e.sd * (E.knit || 0) * .03, by - (E.bIn || 0) * .12 + (E.knit || 0) * .015 - lift], bm = [cxE + e.sd * w * .1, by - .02 - ((E.bIn || 0) + (E.bOut || 0)) * .05 - lift * 1.4], bo = [outerX, by + .015 - (E.bOut || 0) * .12 - lift];
    ps.push({ s: 'poly', m: 'hairInk', flat: true, pts: ribbon(spline([bi, bm, bo], false, 4).map(([x, y]) => H(x, y)), bt * hh * 1.1, bt * hh * .45) });
  }
  // ---- nose ----
  const nk = spec.nose || 'straight', nw = { small: .05, straight: .06, broad: .085, aquiline: .06 }[nk] || .06;
  if (turn > .8) { if (E.nose) ps.push({ s: 'stroke', m: 'skinLine', flat: true, w: .01 * hh, pts: [H(D * .4, .05), H(D * .44, .09)] }); }
  else {
    const nx = fc * 1.35, tip = [nx + D * turn * .05, .2];
    ps.push({ s: 'stroke', m: 'skinLine', flat: true, w: .013 * hh, pts: spline([[nx + D * turn * .02 - (turn < .3 ? .02 : 0), .05], [tip[0] + D * turn * .015, .16], [tip[0] - nw * .2, .215], [tip[0] - nw, .2]], false, 4).map(([x, y]) => H(x, y)) });
    ps.push({ s: 'poly', m: 'skinShade', flat: true, pts: spline([[tip[0] - nw, .21], [tip[0], .235], [tip[0] + nw, .21], [tip[0], .225]], true, 3).map(([x, y]) => H(x, y)) });
    if (turn < .3) ps.push({ s: 'stroke', m: 'skinLine', flat: true, w: .01 * hh, pts: [H(tip[0] + nw * .9, .19), H(tip[0] + nw * .6, .215)] });
    if (E.nose) for (const s2 of [-1, 1]) ps.push({ s: 'stroke', m: 'skinLine', flat: true, w: .009 * hh, pts: [H(nx + s2 * .03, .06), H(nx + s2 * .05, .1)] });
  }
  // ---- mouth ----
  ps.push(...mouthPrims(spec, E, opts, { H, fc, turn, D, hh }));
  // ---- details ----
  if (det.has('moustache') || det.has('beard')) ps.push({ s: 'poly', m: 'hair', pts: ribbon(spline([[fc * 1.2 - .12, .3], [fc * 1.2, .265], [fc * 1.2 + .12, .3]], false, 3).map(([x, y]) => H(x, y)), .04 * hh, .02 * hh) });
  if (det.has('freckles')) for (const [a, b] of [[-.2, .12], [-.15, .16], [-.24, .17], [.2, .12], [.15, .16], [.24, .17]]) if (turn < .8 || a * D > 0) ps.push({ s: 'ellipse', m: 'skinLine', flat: true, x: H(a * (1 - turn * .3) + fc, 0)[0], y: H(0, b)[1], rx: .008 * hh, ry: .008 * hh });
  if (det.has('mole')) ps.push({ s: 'ellipse', m: 'ink', flat: true, x: H(fc + .14, 0)[0], y: H(0, .3)[1], rx: .01 * hh, ry: .01 * hh });
  if (det.has('age-lines')) for (const s2 of [-1, 1]) ps.push({ s: 'stroke', m: 'skinLine', flat: true, w: .008 * hh, pts: [H(fc + s2 * .1, .22), H(fc + s2 * .15, .32)] }, { s: 'stroke', m: 'skinLine', flat: true, w: .007 * hh, pts: [H(fc - .08, -.22), H(fc + .08, -.23)] });
  if (det.has('scar')) ps.push({ s: 'stroke', m: 'skinLine', flat: true, w: .012 * hh, pts: [H(fc + D * .2, -.08), H(fc + D * .25, .12)] });
  if (det.has('earrings')) for (const ex of (turn > .3 ? [earX] : [-.37, .37])) ps.push({ s: 'ellipse', m: 'metal', flat: true, x: H(ex, 0)[0], y: H(0, .17)[1], rx: .025 * hh, ry: .025 * hh });
  if (det.has('glasses')) for (const e of (turn > .8 ? [D * .27] : turn < .3 ? [-.165, .165] : [fc - D * .15, fc + D * .14 * .83])) ps.push({ s: 'stroke', m: 'ink', flat: true, w: .016 * hh, pts: spline([[e - .1, -.04], [e + .1, -.04], [e + .1, .07], [e - .1, .07]], true, 3).map(([x, y]) => H(x, y)).concat([H(e - .1, -.04)]) });
  // ---- feelings drawn on the face ----
  if ((E.cheeks || 0) > .3 || spec.blush) for (const e of (turn < .3 ? [-.2, .2] : [fc - D * .19])) ps.push({ s: 'ellipse', m: 'cheek', flat: true, x: H(e, 0)[0], y: H(0, .17)[1], rx: .07 * hh, ry: .035 * hh });
  if ((E.tears || 0) > .5) for (const e of (turn < .3 ? [-.18, .18].slice(0, Math.round(E.tears)) : [fc - D * .15])) ps.push({ s: 'poly', m: 'tear', flat: true, pts: ribbon(spline([[e, .08], [e - .01, .2], [e + .005, .3]], false, 3).map(([x, y]) => H(x, y)), .02 * hh, .03 * hh) });
  if ((E.sweat || 0) > .5) ps.push({ s: 'poly', m: 'tear', flat: true, pts: spline([H(.36, -.28), H(.39, -.2), H(.36, -.17), H(.33, -.2)], true, 3) });
  return ps;
}

function mouthPrims(spec, E, opts, { H, fc, turn, D, hh }) {
  const ps = [], talk = clamp(opts.mouthOpen || 0), vis = VISEME[opts.viseme || (talk > .05 ? 'A' : 'rest')] || VISEME.rest;
  const mx = turn > .8 ? D * .3 : fc * 1.25, my = .31;
  let open = talk > .05 ? Math.max(vis.open * (.55 + talk * .6), E.open * .5) : E.open;
  let width = (talk > .05 ? lerp(E.width, vis.width, .7) : E.width) * (spec.lips === 'full' ? 1.05 : 1);
  const shape = talk > .05 ? (vis.shape || 'open') : E.shape || (open > .05 ? 'open' : 'line');
  if (vis.press && talk > .05) open = 0;
  const hw = .1 * width * (1 - turn * .38), curve = E.curve, asym = E.asym || 0;
  const pt = (t, lip = 0) => {   // t -1 … 1 across the mouth; corners follow curve (+ up) and asym (one corner up)
    const x = mx + t * hw, corner = Math.pow(Math.abs(t), 2);
    return [x, my - corner * curve * .045 - (t * asym > 0 ? Math.abs(t) * asym * .03 : 0) + lip];
  };
  if (open < .06) {
    const pts = Array.from({ length: 9 }, (_, i) => pt(-1 + i / 4));
    ps.push({ s: 'poly', m: 'lipLine', flat: true, pts: ribbon(pts.map(([x, y]) => H(x, y)), .016 * hh, .016 * hh) });
    // lower lip shape (and the upper lip for full lips)
    const lw = { thin: .018, medium: .028, full: .042 }[spec.lips] || .028;
    ps.push({ s: 'poly', m: 'lip', flat: true, pts: spline([pt(-.7, .008), pt(0, .008 + lw), pt(.7, .008), pt(0, .012)], true, 3).map(([x, y]) => H(x, y)) });
    if (spec.lips === 'full' || spec.lipColor) ps.push({ s: 'poly', m: 'lip', flat: true, pts: spline([pt(-.8, -.004), pt(-.25, -.03), pt(0, -.022), pt(.25, -.03), pt(.8, -.004), pt(0, -.006)], true, 3).map(([x, y]) => H(x, y)) });
    if (E.wobble) ps.push({ s: 'stroke', m: 'skinLine', flat: true, w: .008 * hh, pts: [H(mx - .05, my + .07), H(mx, my + .06), H(mx + .05, my + .07)] });
    return ps;
  }
  const oh = .11 * open, wob = E.wobble ? .012 : 0;
  let cavity;
  if (shape === 'o') cavity = arc(mx, my + oh * .45, hw * .75, oh * .75 + .02, 0, 2 * P, 18);
  else {
    const up = Array.from({ length: 9 }, (_, i) => pt(-1 + i / 4, -.004));
    const lo = Array.from({ length: 9 }, (_, i) => { const t = 1 - i / 4, [x, y] = pt(t, 0); return [x, y + Math.sin((1 - Math.abs(t)) * P / 2) * oh * (1 + (curve < 0 ? -curve * .3 : 0)) + Math.sin(i * 2.3) * wob]; });
    cavity = [...up, ...lo];
  }
  ps.push({ s: 'poly', m: 'mouth', flat: true, pts: cavity.map(([x, y]) => H(x, y)) });
  if ((E.teeth || vis.teeth) && shape !== 'o') ps.push({ s: 'poly', m: 'white', flat: true, pts: spline([pt(-.75, .002), pt(0, -.002), pt(.75, .002), pt(.6, .022 * Math.min(1, open * 2)), pt(0, .026 * Math.min(1, open * 2)), pt(-.6, .022 * Math.min(1, open * 2))], true, 2).map(([x, y]) => H(x, y)) });
  if (open > .35 && shape !== 'o') ps.push({ s: 'ellipse', m: 'tongue', flat: true, x: H(mx, 0)[0], y: H(0, my + oh * .8)[1], rx: hw * .5 * hh, ry: (oh * .25 + .005) * hh });
  ps.push({ s: 'stroke', m: 'lipLine', flat: true, w: .012 * hh, pts: cavity.concat([cavity[0]]).map(([x, y]) => H(x, y)) });
  return ps;
}

// ---------- hair ----------
function hairPrims(style, g) {
  const { hcx, headTop, hh, turn, D, chinY, shY, sw, u } = g;
  const hy = headTop + hh * .5, H = (x, y) => [hcx + x * hh, hy + y * hh];
  const back = [], front = [];
  const st = { short: 'crew', long: 'long-straight', curly: 'curly-top' }[style] || style;
  // the cap: the hair mass over the skull, with a hairline at the front (y), a volume (v) and a part
  const cap = (v, line, fringe = []) => {
    const ox = turn > .3 ? -D * .03 : 0;
    const pts = [[-.4 - v * .4, .05], [-.4 - v * .6, -.25], [-.22, -.52 - v], [0 + ox, -.57 - v], [.22, -.52 - v], [.4 + v * .6, -.25], [.4 + v * .4, .05], [.36, .02], [.34, line + .1], ...fringe, [-.34, line + .1], [-.36, .02]];
    return { s: 'poly', m: 'hair', pts: spline(pts.map(([x, y]) => H(x + (turn > .3 && y > -.4 ? -D * turn * .05 : 0), y)), true, 4) };
  };
  const hi = (v) => ({ s: 'poly', m: 'hairHi', flat: true, pts: ribbon(spline([[-.2, -.42 - v], [0, -.5 - v], [.18, -.44 - v]], false, 4).map(([x, y]) => H(x, y)), .035 * hh, .01 * hh) });
  switch (st) {
    case 'bald': front.push({ s: 'poly', m: 'hairHi', flat: true, pts: ribbon(spline([[-.15, -.4], [0, -.46], [.15, -.42]], false, 3).map(([x, y]) => H(x, y)), .02 * hh, .005 * hh) }); break;
    case 'buzz': front.push({ ...cap(.01, -.26, [[.1, -.28], [-.1, -.28]]), m: 'hairShade' }); break;
    case 'crew': front.push(cap(.05, -.24, [[.2, -.26], [.05, -.22], [-.1, -.27], [-.25, -.24]]), hi(.05)); break;
    case 'side-part': front.push(cap(.08, -.22, [[.3, -.12], [.15, -.22], [-.05, -.3], [-.2, -.32]]), hi(.08)); break;
    case 'slick-back': back.push({ s: 'poly', m: 'hair', pts: spline([H(-.42, -.1), H(-.45, .15), H(-.3, .2), H(-.2, -.2)], true, 3) }); front.push(cap(.09, -.3, [[.15, -.34], [-.15, -.34]]), hi(.09)); break;
    case 'curly-top': front.push(cap(.04, -.22, [[.2, -.24], [-.2, -.24]])); for (let i = 0; i < 9; i++) { const a = P * (1.1 + i * .1); front.push({ s: 'ellipse', m: 'hair', x: H(Math.cos(a) * .3, 0)[0], y: H(0, -.42 + Math.sin(a) * .12)[1], rx: .1 * hh, ry: .09 * hh }); } break;
    case 'afro': back.push({ s: 'poly', m: 'hair', pts: spline(Array.from({ length: 22 }, (_, i) => { const a = i / 22 * 2 * P, r = .66 + Math.sin(i * 2.7) * .03; return H(Math.cos(a) * r * .92, -.18 + Math.sin(a) * r * .78); }), true, 3) }); front.push(cap(.06, -.24, [[.2, -.24], [-.2, -.24]]), hi(.2)); break;
    case 'pixie': front.push(cap(.07, -.18, [[.32, -.05], [.2, -.14], [.05, -.24], [-.15, -.2], [-.3, -.14]]), hi(.07)); break;
    case 'bob':
      back.push({ s: 'poly', m: 'hair', pts: spline([H(-.45, -.3), H(-.48, .2), H(-.42, .44), H(-.2, .42), H(.2, .42), H(.42, .44), H(.48, .2), H(.45, -.3)], true, 4) });
      front.push(cap(.1, -.14, [[.36, .05], [.2, -.1], [0, -.16], [-.2, -.1], [-.36, .05]]), { s: 'poly', m: 'hair', pts: spline([H(-.42, -.15), H(-.44, .42), H(-.33, .4), H(-.33, .0)], true, 3) }, { s: 'poly', m: 'hair', pts: spline([H(.42, -.15), H(.44, .42), H(.33, .4), H(.33, .0)], true, 3) }, hi(.1));
      break;
    case 'lob': case 'long-straight': case 'long-wavy': case 'braids': {
      const end = st === 'lob' ? .95 : 1.85, wavy = st === 'long-wavy';
      if (st !== 'braids') {
        const side = (s) => Array.from({ length: 7 }, (_, i) => { const t = i / 6; return [s * (.44 + t * .12 + (wavy ? Math.sin(t * 9) * .04 : 0)), -.3 + t * (end + .3)]; });
        back.push({ s: 'poly', m: 'hair', pts: spline([...side(-1), [-.3, end + .05], [.3, end + .05], ...side(1).reverse()].map(([x, y]) => H(x + (turn > .3 ? -D * turn * .12 : 0), y)), true, 3) });
        front.push(cap(.1, -.16, [[.34, -.02], [.12, -.2], [-.08, -.25], [-.3, -.08]]), hi(.1));
        if (turn < .3) for (const s of [-1, 1]) front.push({ s: 'poly', m: 'hair', pts: spline([H(s * .37, -.25), H(s * .47, .4), H(s * .44, Math.min(end, 1.1)), H(s * .39, .35)], true, 3) });
      } else {
        front.push(cap(.06, -.25, [[.1, -.28], [-.1, -.28]]), hi(.06));
        for (const s of [-1, 1]) if (turn < .8 || s === -D) for (let i = 0; i < 9; i++) front.push({ s: 'ellipse', m: i % 2 ? 'hairShade' : 'hair', x: H(s * (.4 + i * .006), 0)[0], y: H(0, .1 + i * .19)[1], rx: .07 * hh, ry: .11 * hh });
      }
      break;
    }
    case 'ponytail':
      front.push(cap(.07, -.26, [[.15, -.3], [-.15, -.3]]), hi(.07));
      back.push({ s: 'poly', m: 'hair', pts: ribbon(spline([[-D * (turn > .3 ? .42 : .3), -.32], [-D * (turn > .3 ? .62 : .42), .1], [-D * (turn > .3 ? .55 : .4), .75]], false, 4).map(([x, y]) => H(x, y)), .22 * hh, .08 * hh) });
      break;
    case 'bun':
      front.push(cap(.07, -.26, [[.15, -.3], [-.15, -.3]]), hi(.07));
      back.push({ s: 'ellipse', m: 'hair', x: H(turn > .3 ? -D * .32 : 0, 0)[0], y: H(0, turn > .3 ? -.45 : -.62)[1], rx: .2 * hh, ry: .17 * hh });
      break;
    case 'headscarf':
      back.push({ s: 'poly', m: 'accent', pts: spline([H(-.5, -.2), H(-.62, .6), H(-.55, 1.2), H(.55, 1.2), H(.62, .6), H(.5, -.2)], true, 4) });
      front.push({ s: 'poly', m: 'accent', pts: spline([H(-.47, .05), H(-.46, -.35), H(0, -.62), H(.46, -.35), H(.47, .05), H(.36, .0), H(.34, -.2), H(0, -.32), H(-.34, -.2), H(-.36, .0)], true, 3) });
      for (const s2 of [-1, 1]) if (turn < .3 || s2 === -D) front.push({ s: 'poly', m: 'accent', pts: spline([H(s2 * .47, 0), H(s2 * .37, .0), H(s2 * .35, .25), H(s2 * .2, .5), H(0, .56), H(0, .66), H(s2 * .3, .58), H(s2 * .45, .35)], true, 3) });
      front.push({ s: 'poly', m: 'accentShade', flat: true, pts: ribbon(spline([[-.36, -.02], [0, -.3], [.36, -.02]], false, 4).map(([x, y]) => H(x, y)), .03 * hh, .03 * hh) });
      break;
    default: front.push(cap(.05, -.24, [[.2, -.26], [-.2, -.26]]));
  }
  return { back, front };
}

/** Material colours a v2 character needs, derived from the cast entry (styles may override any of them). Pure. */
export function rigMats(base, c) {
  const hex = h => { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = [...h].map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0); };
  const toHex = a => '#' + a.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => toHex(hex(a).map((v, i) => lerp(v, hex(b)[i], t)));
  const skin = c.skin || base.skin || '#E2A784', hair = c.hair || base.hair || '#3A2418', top = c.top || base.top || '#5B7FA6', top2 = c.top2 || c.jacket || mix(top, '#1d1d24', .55);
  return {
    skin, skinShade: mix(skin, '#5a2a2a', .2), skinLine: mix(skin, '#3a1a14', .45), hair, hairShade: mix(hair, '#000000', .3), hairHi: mix(hair, '#ffffff', .3), hairInk: c.hairInk || mix(hair, '#000', .35),
    top, topShade: mix(top, '#101018', .22), top2, top2Shade: mix(top2, '#000', .25), collar: c.collar || mix(top2, '#000', .1), bottom: c.bottom || base.bottom || '#2C3E50', bottomShade: mix(c.bottom || base.bottom || '#2C3E50', '#000', .3),
    shoe: c.shoe || base.shoe || '#2a2420', white: base.white || '#FBF8F2', iris: c.eyes?.color || c.eyeColor || '#4a3020', ink: base.ink || '#1d1d1f',
    lip: c.lipColor || mix(skin, '#b03a48', .38), lipLine: mix(skin, '#4a1820', .55), mouth: '#5a1a22', tongue: '#c8606a', cheek: base.cheek || mix(skin, '#ff6070', .3),
    tear: '#bfe3ff', stubble: mix(skin, hair, .35), accent: c.accent || base.accent || '#C0392B', accentShade: mix(c.accent || base.accent || '#C0392B', '#000', .25), metal: '#c9b26a', screen: '#cfe8ff', legwear: c.legwear || mix(skin, '#000', .1),
  };
}
