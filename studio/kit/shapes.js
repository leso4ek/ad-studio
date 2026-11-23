// Ad Studio kit · shared geometry. Every style draws these same primitives with its own treatment
// (paper, riso ink, flat mid-century paint, kinetic type, toy 3D), so one bible renders in any style.
//
// Primitive: { s, m, ...geom }   s = 'ellipse' | 'rrect' | 'poly' | 'cap' | 'stroke' | 'text'
//   ellipse {x,y,rx,ry,rot}   rrect {x,y,w,h,r,rot} (x,y = centre)   poly {pts:[[x,y]…]}
//   cap {x1,y1,x2,y2,r} (capsule)   stroke {pts, w} (open line)   text {x,y,text,size,font,align,w}
//   m = material name, looked up in the style's palette ('skin', 'hair', 'top', 'ink', 'wall', 'sky' …)
//   flat: true marks face details (eyes, mouth) that the 3D style lays on as decals
// Characters, products and props are in unit space: feet/base at y = 0, top at y ≈ -1, centred on x = 0.
// Places are in pixels for a W×H frame.

const P = Math.PI;

// ---------- characters ----------
export const POSES = {
  //            left arm, right arm (radians from straight down; positive swings out), head tilt, lean, eyes, mouth, brows
  neutral:   { la: .18, ra: .18, tilt: 0, lean: 0, eyes: 'dot', mouth: 'smile0', brows: 'flat' },
  happy:     { la: .35, ra: .35, tilt: .05, lean: 0, eyes: 'arc', mouth: 'smile', brows: 'up' },
  sad:       { la: .05, ra: .05, tilt: -.12, lean: .03, eyes: 'down', mouth: 'frown', brows: 'sad' },
  tired:     { la: .03, ra: .03, tilt: -.18, lean: .06, eyes: 'half', mouth: 'flat', brows: 'sad' },
  surprised: { la: 2.2, ra: 2.2, tilt: .04, lean: -.03, eyes: 'wide', mouth: 'o', brows: 'high' },
  point:     { la: .15, ra: 1.55, tilt: .03, lean: 0, eyes: 'dot', mouth: 'smile', brows: 'up' },
  wave:      { la: .15, ra: 2.6, tilt: .06, lean: 0, eyes: 'arc', mouth: 'smile', brows: 'up' },
  think:     { la: .2, ra: 2.9, tilt: .1, lean: 0, eyes: 'up', mouth: 'flat', brows: 'one' },
  cheer:     { la: 2.7, ra: 2.7, tilt: 0, lean: 0, eyes: 'arc', mouth: 'grin', brows: 'up' },
  hold:      { la: -.42, ra: -.42, tilt: .02, lean: 0, eyes: 'dot', mouth: 'smile', brows: 'flat' },
  annoyed:   { la: .5, ra: .5, tilt: -.05, lean: 0, eyes: 'half', mouth: 'flat', brows: 'angry' },
};

function half(cx, cy, rx, ry, a0, a1, n = 18, jag = 0) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, j = jag && i % 2 ? jag : 0; pts.push([cx + Math.cos(a) * (rx + j), cy + Math.sin(a) * (ry + j)]); }
  return pts;
}

/** spec: {skin, hair, hairStyle, top, bottom, shoe, build}; opts: {pose, face: 'left'|'right'|'front', blink, armSwing, mouthOpen} */
export function character(spec = {}, opts = {}) {
  const pose = { ...POSES.neutral, ...(POSES[opts.pose] || {}), ...(opts.poseOverride || {}) };
  const b = { slim: [.2, .24], round: [.27, .34], tall: [.2, .25] }[spec.build] || [.23, .28];
  const tall = spec.build === 'tall' ? 1.06 : 1, kid = spec.age === 'kid';
  const fx = opts.face === 'left' ? -1 : opts.face === 'right' ? 1 : 0;
  const hy = (kid ? -.74 : -.8) * tall, hr = kid ? .18 : .155, hry = kid ? .19 : .17;
  const hx = pose.lean * 1.2 + Math.sin(pose.tilt) * .04;
  const sy = -.6 * tall, hip = -.3 * (kid ? .9 : 1) * tall;
  const out = [];
  const arm = (side, ang) => {
    const sx = side * b[0] * .5, len = .27 * tall, a = ang + (opts.armSwing || 0) * side;
    const ex = sx + side * Math.sin(a) * len, ey = sy + .03 + Math.cos(a) * len;
    return [{ s: 'cap', x1: sx, y1: sy + .03, x2: ex, y2: ey, r: .035, m: 'top' }, { s: 'ellipse', x: ex, y: ey, rx: .04, ry: .04, m: 'skin' }];
  };
  // hair behind the head
  const hs = spec.hairStyle || 'short';
  if (hs === 'bob') out.push({ s: 'ellipse', x: hx, y: hy + .01, rx: hr * 1.2, ry: hry * 1.12, m: 'hair' });
  if (hs === 'long') out.push({ s: 'rrect', x: hx, y: hy + .1, w: hr * 2.4, h: .36, r: .09, m: 'hair' });
  if (hs === 'bun') out.push({ s: 'ellipse', x: hx, y: hy - hry - .03, rx: .065, ry: .06, m: 'hair' });
  // legs and shoes
  for (const sd of [-1, 1]) {
    out.push({ s: 'cap', x1: sd * .065, y1: hip, x2: sd * .075, y2: -.04, r: .045, m: 'bottom' });
    out.push({ s: 'ellipse', x: sd * .085 + fx * .02, y: -.025, rx: .065, ry: .035, m: 'shoe' });
  }
  // back arm, torso, front arm
  const back = fx >= 0 ? -1 : 1;
  out.push(...arm(back, back < 0 ? pose.la : pose.ra));
  out.push({ s: 'poly', m: 'top', pts: [[-b[0] / 2 + pose.lean, sy + .05], [-b[0] / 2 + .05 + pose.lean, sy - .005], [b[0] / 2 - .05 + pose.lean, sy - .005], [b[0] / 2 + pose.lean, sy + .05], [b[1] / 2, hip + .02], [-b[1] / 2, hip + .02]] });
  out.push({ s: 'ellipse', x: hx * .5, y: sy - .01, rx: .04, ry: .03, m: 'skin' });
  out.push({ s: 'rrect', x: pose.lean * .5, y: hip + .02, w: b[1] * 1.02, h: .07, r: .03, m: 'bottom' });
  out.push(...arm(-back, -back < 0 ? pose.la : pose.ra));
  // head
  out.push({ s: 'ellipse', x: hx, y: hy, rx: hr, ry: hry, rot: pose.tilt * .5, m: 'skin' });
  // hair in front
  if (hs === 'short' || hs === 'bob' || hs === 'long' || hs === 'bun') out.push({ s: 'poly', m: 'hair', pts: [...half(hx, hy - .015, hr * 1.04, hry * 1.02, P * 1.03, P * 1.97), [hx + hr * .5 + fx * .02, hy - hry * .45], [hx - hr * .2 + fx * .04, hy - hry * .62], [hx - hr * .9, hy - hry * .3]] });
  if (hs === 'curly') for (let i = 0; i < 9; i++) { const a = P * (1.02 + i * .12); out.push({ s: 'ellipse', x: hx + Math.cos(a) * hr * .95, y: hy - .01 + Math.sin(a) * hry * .95, rx: .05, ry: .05, m: 'hair' }); }
  // face
  const ex = .055, ey = hy - .005, fxo = hx + fx * .045;
  const blink = opts.blink;
  for (const sd of [-1, 1]) {
    const x = fxo + sd * ex;
    const e = blink ? 'shut' : pose.eyes;
    if (e === 'dot' || e === 'up' || e === 'down') out.push({ s: 'ellipse', x: x + (e === 'up' ? .004 : 0), y: ey + (e === 'up' ? -.012 : e === 'down' ? .01 : 0), rx: .016, ry: .021, m: 'ink', flat: true });
    else if (e === 'wide') { out.push({ s: 'ellipse', x, y: ey, rx: .03, ry: .034, m: 'white', flat: true }); out.push({ s: 'ellipse', x, y: ey, rx: .015, ry: .017, m: 'ink', flat: true }); }
    else if (e === 'arc') out.push({ s: 'stroke', pts: [[x - .022, ey + .006], [x, ey - .014], [x + .022, ey + .006]], w: .011, m: 'ink', flat: true });
    else if (e === 'half') { out.push({ s: 'ellipse', x, y: ey + .006, rx: .018, ry: .012, m: 'ink', flat: true }); out.push({ s: 'stroke', pts: [[x - .026, ey - .006], [x + .026, ey - .006]], w: .01, m: 'ink', flat: true }); }
    else if (e === 'shut') out.push({ s: 'stroke', pts: [[x - .02, ey + .004], [x + .02, ey + .004]], w: .01, m: 'ink', flat: true });
    // brows
    const by = ey - .045, br = pose.brows;
    const tilt = br === 'sad' ? sd * .012 : br === 'angry' ? sd * -.014 : br === 'one' && sd > 0 ? -.012 : 0;
    const lift = br === 'high' ? -.018 : br === 'up' ? -.006 : 0;
    out.push({ s: 'stroke', pts: [[x - .022, by + lift - tilt], [x + .022, by + lift + tilt]], w: .009, m: 'hairInk', flat: true });
  }
  // cheeks
  for (const sd of [-1, 1]) out.push({ s: 'ellipse', x: fxo + sd * .09, y: ey + .045, rx: .026, ry: .016, m: 'cheek', flat: true });
  // mouth
  const my = hy + .075, mx = fxo, mo = opts.mouthOpen || 0, mth = mo > .35 ? 'o' : pose.mouth;
  if (mth === 'smile' || mth === 'smile0') { const d = mth === 'smile' ? .022 : .012; out.push({ s: 'stroke', pts: [[mx - .04, my - .006], [mx, my + d], [mx + .04, my - .006]], w: .011, m: 'ink', flat: true }); }
  else if (mth === 'grin') out.push({ s: 'poly', m: 'ink', flat: true, pts: [[mx - .05, my - .01], [mx + .05, my - .01], ...half(mx, my - .01, .05, .045, 0, P, 10)] });
  else if (mth === 'frown') out.push({ s: 'stroke', pts: [[mx - .035, my + .014], [mx, my - .006], [mx + .035, my + .014]], w: .011, m: 'ink', flat: true });
  else if (mth === 'flat') out.push({ s: 'stroke', pts: [[mx - .03, my + .004], [mx + .03, my + .004]], w: .011, m: 'ink', flat: true });
  else if (mth === 'o') out.push({ s: 'ellipse', x: mx, y: my + .006, rx: .022 + mo * .006, ry: .026 + mo * .01, m: 'ink', flat: true });
  return out;
}

// ---------- products ----------
/** spec: {kind, label, colors:{body, cap, label, labelInk, accent}} */
export function product(spec = {}) {
  const k = spec.kind || 'bottle', L = spec.label || '', out = [];
  const lab = (y, w, h, size = .1) => {
    out.push({ s: 'rrect', x: 0, y, w, h, r: .02, m: 'label' });
    if (L) out.push({ s: 'text', x: 0, y: y + size * .35, text: L, size, w: w * .86, align: 'center', m: 'labelInk', font: 'label' });
  };
  switch (k) {
    case 'jar':
      out.push({ s: 'rrect', x: 0, y: -.31, w: .7, h: .62, r: .12, m: 'body' });
      out.push({ s: 'rrect', x: 0, y: -.66, w: .74, h: .16, r: .04, m: 'cap' });
      lab(-.3, .7, .3, .11); break;
    case 'box':
      out.push({ s: 'rrect', x: 0, y: -.45, w: .7, h: .9, r: .025, m: 'body' });
      out.push({ s: 'rrect', x: 0, y: -.86, w: .7, h: .08, r: .01, m: 'cap' });
      lab(-.45, .7, .34, .11); break;
    case 'tube':
      out.push({ s: 'poly', m: 'body', pts: [[-.2, -.12], [.2, -.12], [.28, -.96], [-.28, -.96]] });
      out.push({ s: 'rrect', x: 0, y: -.98, w: .58, h: .06, r: .01, m: 'accent' });
      out.push({ s: 'rrect', x: 0, y: -.06, w: .22, h: .12, r: .02, m: 'cap' });
      lab(-.52, .42, .26, .09); break;
    case 'can':
      out.push({ s: 'rrect', x: 0, y: -.45, w: .5, h: .9, r: .05, m: 'body' });
      out.push({ s: 'ellipse', x: 0, y: -.9, rx: .24, ry: .04, m: 'cap' });
      lab(-.45, .5, .4, .1); break;
    case 'pouch':
      out.push({ s: 'poly', m: 'body', pts: [[-.34, 0], [.34, 0], [.3, -.86], [.2, -.92], [-.2, -.92], [-.3, -.86]] });
      out.push({ s: 'rrect', x: 0, y: -.86, w: .56, h: .04, r: .01, m: 'cap' });
      lab(-.42, .5, .3, .1); break;
    case 'cup':
      out.push({ s: 'poly', m: 'body', pts: [[-.2, 0], [.2, 0], [.27, -.78], [-.27, -.78]] });
      out.push({ s: 'rrect', x: 0, y: -.82, w: .6, h: .08, r: .03, m: 'cap' });
      out.push({ s: 'poly', m: 'label', pts: [[-.225, -.25], [.225, -.25], [.25, -.55], [-.25, -.55]] });
      if (L) out.push({ s: 'text', x: 0, y: -.37, text: L, size: .085, w: .42, align: 'center', m: 'labelInk', font: 'label' });
      break;
    case 'device':
      out.push({ s: 'rrect', x: 0, y: -.42, w: .62, h: .82, r: .26, m: 'body' });
      out.push({ s: 'ellipse', x: 0, y: -.5, rx: .17, ry: .17, m: 'accent' });
      out.push({ s: 'rrect', x: 0, y: -.02, w: .4, h: .05, r: .02, m: 'cap' });
      if (L) out.push({ s: 'text', x: 0, y: -.17, text: L, size: .07, w: .5, align: 'center', m: 'labelInk', font: 'label' });
      break;
    case 'brush':
      out.push({ s: 'rrect', x: 0, y: -.42, w: .12, h: .84, r: .06, m: 'body' });
      out.push({ s: 'rrect', x: 0, y: -.9, w: .1, h: .16, r: .04, m: 'body' });
      for (let i = 0; i < 4; i++) out.push({ s: 'rrect', x: .085, y: -.84 - i * .035, w: .07, h: .022, r: .008, m: 'accent' });
      out.push({ s: 'rrect', x: 0, y: -.3, w: .12, h: .2, r: .05, m: 'cap' });
      break;
    default: // bottle
      out.push({ s: 'rrect', x: 0, y: -.36, w: .42, h: .72, r: .09, m: 'body' });
      out.push({ s: 'ellipse', x: 0, y: -.7, rx: .21, ry: .07, m: 'body' });
      out.push({ s: 'rrect', x: 0, y: -.79, w: .16, h: .12, r: .02, m: 'body' });
      out.push({ s: 'rrect', x: 0, y: -.9, w: .2, h: .14, r: .03, m: 'cap' });
      lab(-.36, .42, .3, .085);
  }
  return out;
}

// ---------- props ----------
export function prop(kind, color) {
  const o = [];
  switch (kind) {
    case 'mug': o.push({ s: 'rrect', x: 0, y: -.3, w: .5, h: .6, r: .08, m: 'propA' }, { s: 'stroke', pts: [[.25, -.45], [.4, -.42], [.4, -.2], [.25, -.17]], w: .07, m: 'propA' }); break;
    case 'steam': for (let i = 0; i < 3; i++) o.push({ s: 'stroke', pts: [[i * .12 - .12, 0], [i * .12 - .08, -.25], [i * .12 - .14, -.5], [i * .12 - .1, -.75]], w: .035, m: 'white' }); break;
    case 'clock': o.push({ s: 'ellipse', x: 0, y: -.5, rx: .48, ry: .48, m: 'propA' }, { s: 'ellipse', x: 0, y: -.5, rx: .4, ry: .4, m: 'white' }, { s: 'stroke', pts: [[0, -.5], [0, -.78]], w: .05, m: 'ink' }, { s: 'stroke', pts: [[0, -.5], [.18, -.42]], w: .05, m: 'ink' }); break;
    case 'alarm': o.push({ s: 'ellipse', x: -.3, y: -.86, rx: .16, ry: .12, m: 'propB' }, { s: 'ellipse', x: .3, y: -.86, rx: .16, ry: .12, m: 'propB' }, ...prop('clock'), { s: 'cap', x1: -.3, y1: -.08, x2: -.38, y2: 0, r: .04, m: 'propB' }, { s: 'cap', x1: .3, y1: -.08, x2: .38, y2: 0, r: .04, m: 'propB' }); break;
    case 'phone': o.push({ s: 'rrect', x: 0, y: -.5, w: .5, h: 1, r: .08, m: 'ink' }, { s: 'rrect', x: 0, y: -.5, w: .42, h: .86, r: .05, m: 'screen' }); break;
    case 'plant': o.push({ s: 'poly', m: 'propB', pts: [[-.22, 0], [.22, 0], [.28, -.35], [-.28, -.35]] }); for (const [a, l] of [[-.6, .55], [-.2, .7], [.25, .65], [.65, .5]]) o.push({ s: 'ellipse', x: Math.sin(a) * l * .55, y: -.35 - Math.cos(a) * l * .55, rx: .1, ry: .26, rot: a, m: 'plant' }); break;
    case 'fern': case 'fern-droopy': {
      const droop = kind === 'fern-droopy';
      o.push({ s: 'poly', m: 'propB', pts: [[-.2, 0], [.2, 0], [.26, -.3], [-.26, -.3]] }, { s: 'rrect', x: 0, y: -.31, w: .58, h: .06, r: .02, m: 'propB' });
      const fronds = droop ? [[-1.9, .5], [-1.4, .58], [1.45, .56], [1.95, .48], [-.6, .44], [.7, .46]] : [[-.95, .62], [-.45, .72], [0, .78], [.45, .72], [.95, .62], [-.2, .55], [.25, .55]];
      for (const [a, l] of fronds) {
        const pts = []; const n = 7;
        for (let i = 0; i <= n; i++) { const u = i / n, bend = droop ? u * u * .9 : u * u * .25, ang = a + Math.sign(a || 1) * bend; pts.push([Math.sin(ang) * l * u, -.33 - Math.cos(ang) * l * u]); }
        o.push({ s: 'stroke', pts, w: .035, m: 'plant2' });
        for (let i = 1; i <= n; i++) {
          const [x0, y0] = pts[i - 1], [x, y] = pts[i], dir = Math.atan2(y - y0, x - x0), sz = .085 * (1 - i / n * .55);
          for (const side of [-1, 1]) { const b = dir + side * (droop ? 1.15 : 1.0); o.push({ s: 'ellipse', x: x + Math.cos(b) * sz * .9, y: y + Math.sin(b) * sz * .9 + (droop ? sz * .35 : 0), rx: sz, ry: sz * .38, rot: b, m: side > 0 ? 'plant' : 'plant2' }); }
        }
      }
      break;
    }
    case 'lamp': o.push({ s: 'poly', m: 'propA', pts: [[-.3, -.95], [.3, -.95], [.4, -.65], [-.4, -.65]] }, { s: 'cap', x1: 0, y1: -.65, x2: 0, y2: -.06, r: .035, m: 'ink' }, { s: 'rrect', x: 0, y: -.04, w: .4, h: .08, r: .03, m: 'ink' }); break;
    case 'bed': o.push({ s: 'rrect', x: 0, y: -.22, w: 2.2, h: .3, r: .06, m: 'wood' }, { s: 'rrect', x: .05, y: -.42, w: 2, h: .2, r: .08, m: 'propA' }, { s: 'rrect', x: -.82, y: -.52, w: .42, h: .18, r: .08, m: 'white' }, { s: 'rrect', x: -1.08, y: -.5, w: .1, h: 1, r: .04, m: 'wood' }); break;
    case 'desk': o.push({ s: 'rrect', x: 0, y: -.62, w: 1.8, h: .08, r: .02, m: 'wood' }, { s: 'rrect', x: -.8, y: -.3, w: .08, h: .6, r: .02, m: 'wood' }, { s: 'rrect', x: .8, y: -.3, w: .08, h: .6, r: .02, m: 'wood' }); break;
    case 'laptop': o.push({ s: 'poly', m: 'metal', pts: [[-.5, 0], [.5, 0], [.42, -.62], [-.42, -.62]] }, { s: 'poly', m: 'screen', pts: [[-.44, -.06], [.44, -.06], [.37, -.56], [-.37, -.56]] }, { s: 'rrect', x: 0, y: 0, w: 1.1, h: .05, r: .02, m: 'metal' }); break;
    case 'book': o.push({ s: 'rrect', x: 0, y: -.08, w: .9, h: .16, r: .02, m: 'propA' }, { s: 'rrect', x: .05, y: -.24, w: .8, h: .16, r: .02, m: 'propB' }); break;
    case 'bag': o.push({ s: 'rrect', x: 0, y: -.35, w: .8, h: .7, r: .06, m: 'propA' }, { s: 'stroke', pts: [[-.2, -.7], [-.15, -.95], [.15, -.95], [.2, -.7]], w: .05, m: 'propA' }); break;
    case 'sun': o.push({ s: 'ellipse', x: 0, y: -.5, rx: .5, ry: .5, m: 'sun' }); break;
    case 'moon': o.push({ s: 'ellipse', x: 0, y: -.5, rx: .45, ry: .45, m: 'moon' }); break;
    case 'cloud': o.push({ s: 'ellipse', x: -.3, y: -.25, rx: .3, ry: .22, m: 'cloud' }, { s: 'ellipse', x: .05, y: -.38, rx: .38, ry: .3, m: 'cloud' }, { s: 'ellipse', x: .4, y: -.22, rx: .28, ry: .2, m: 'cloud' }, { s: 'rrect', x: .05, y: -.12, w: 1.2, h: .24, r: .12, m: 'cloud' }); break;
    case 'star': { const pts = []; for (let i = 0; i < 10; i++) { const a = -P / 2 + i * P / 5, r = i % 2 ? .2 : .5; pts.push([Math.cos(a) * r, -.5 + Math.sin(a) * r]); } o.push({ s: 'poly', pts, m: color ? 'custom' : 'accent' }); break; }
    case 'sparkle': o.push({ s: 'poly', m: 'accent', pts: [[0, -1], [.1, -.6], [.4, -.5], [.1, -.4], [0, 0], [-.1, -.4], [-.4, -.5], [-.1, -.6]] }); break;
    case 'heart': o.push({ s: 'poly', m: 'accent', pts: [...half(-.22, -.68, .24, .24, P * .75, P * 2.05, 12), ...half(.22, -.68, .24, .24, P * .95, P * 2.25, 12), [0, 0]] }); break;
    case 'arrow': o.push({ s: 'poly', m: 'accent', pts: [[-.5, -.38], [.1, -.38], [.1, -.55], [.5, -.3], [.1, -.05], [.1, -.22], [-.5, -.22]] }); break;
    case 'drop': o.push({ s: 'poly', m: 'propB', pts: [[0, -1], ...half(0, -.32, .3, .32, -P * .15, P * 1.15, 16)] }); break;
    case 'leaf': o.push({ s: 'ellipse', x: 0, y: -.5, rx: .2, ry: .48, rot: .5, m: 'plant' }, { s: 'stroke', pts: [[-.18, -.12], [.18, -.88]], w: .03, m: 'plant2' }); break;
    case 'zzz': o.push({ s: 'text', x: 0, y: -.3, text: 'z z z', size: .5, align: 'center', m: 'ink', font: 'head' }); break;
    case 'chair': o.push({ s: 'rrect', x: 0, y: -.45, w: .6, h: .08, r: .02, m: 'wood' }, { s: 'rrect', x: -.26, y: -.75, w: .07, h: .65, r: .02, m: 'wood' }, { s: 'rrect', x: -.26, y: -.22, w: .06, h: .44, r: .02, m: 'wood' }, { s: 'rrect', x: .26, y: -.22, w: .06, h: .44, r: .02, m: 'wood' }); break;
    case 'sofa': o.push({ s: 'rrect', x: 0, y: -.35, w: 2, h: .5, r: .12, m: 'propA' }, { s: 'rrect', x: 0, y: -.7, w: 1.8, h: .4, r: .12, m: 'propA' }, { s: 'rrect', x: -.95, y: -.45, w: .25, h: .6, r: .1, m: 'propB' }, { s: 'rrect', x: .95, y: -.45, w: .25, h: .6, r: .1, m: 'propB' }); break;
    case 'tree': o.push({ s: 'rrect', x: 0, y: -.25, w: .14, h: .5, r: .03, m: 'wood' }, { s: 'ellipse', x: 0, y: -.7, rx: .38, ry: .38, m: 'plant' }, { s: 'ellipse', x: -.2, y: -.55, rx: .25, ry: .22, m: 'plant2' }); break;
    default: o.push({ s: 'rrect', x: 0, y: -.5, w: .8, h: 1, r: .1, m: 'propA' });
  }
  return o;
}

// ---------- places (pixels) ----------
// Returns { far: [...], mid: [...], floor: yPixels }; 'far' moves least in a camera pan.
export function place(kind, W, H, seed = 1) {
  const far = [], mid = [];
  const fl = H * (kind === 'street' || kind === 'park' ? .74 : .7);
  const rnd = (i) => { const x = Math.sin((i + 1) * 91.7 + seed * 13.1) * 43758.5; return x - Math.floor(x); };
  const win = (x, y, w, h, frame = 'wood') => {
    far.push({ s: 'rrect', x, y, w: w + H * .02, h: h + H * .02, r: H * .006, m: frame });
    far.push({ s: 'rrect', x, y, w, h, r: H * .004, m: 'sky' });
    far.push({ s: 'rrect', x, y: y + h * .25, w, h: h * .5, r: 0, m: 'sky2' });
    far.push({ s: 'rrect', x, y, w: H * .008, h, r: 0, m: frame });
    far.push({ s: 'rrect', x, y, w, h: H * .008, r: 0, m: frame });
  };
  const floor = () => { mid.push({ s: 'rrect', x: W / 2, y: (fl + H) / 2, w: W * 1.4, h: H - fl, r: 0, m: 'floor' }); mid.push({ s: 'rrect', x: W / 2, y: fl + H * .004, w: W * 1.4, h: H * .008, r: 0, m: 'floor2' }); };
  const wall = () => { far.push({ s: 'rrect', x: W / 2, y: fl / 2, w: W * 1.4, h: fl, r: 0, m: 'wall' }); };
  switch (kind) {
    case 'kitchen':
      wall(); win(W * .5, H * .28, W * .42, H * .2);
      far.push({ s: 'rrect', x: W * .5, y: fl - H * .1, w: W * 1.4, h: H * .2, r: 0, m: 'wall2' });
      for (let i = -1; i <= 3; i++) far.push({ s: 'rrect', x: W * (.1 + i * .28), y: H * .1, w: W * .24, h: H * .12, r: H * .006, m: 'wood' });
      floor(); mid.push({ s: 'rrect', x: W * .5, y: fl - H * .005, w: W * 1.4, h: H * .03, r: 0, m: 'metal' });
      break;
    case 'bedroom':
      wall(); win(W * .72, H * .3, W * .3, H * .18);
      far.push({ s: 'rrect', x: W * .24, y: H * .3, w: W * .2, h: H * .13, r: H * .005, m: 'wall2' });
      floor(); break;
    case 'office':
      wall(); for (let i = 0; i < 3; i++) win(W * (.2 + i * .3), H * .3, W * .22, H * .22, 'metal');
      floor(); break;
    case 'bathroom':
      wall(); for (let r = 0; r < 8; r++) for (let c = -2; c < 10; c++) far.push({ s: 'rrect', x: c * W * .14 + (r % 2) * W * .07, y: fl - H * .03 - r * H * .045, w: W * .13, h: H * .04, r: H * .004, m: 'wall2' });
      far.push({ s: 'rrect', x: W * .5, y: H * .24, w: W * .4, h: H * .2, r: H * .02, m: 'glass' });
      floor(); break;
    case 'cafe':
      wall(); win(W * .5, H * .3, W * .7, H * .26, 'wood');
      for (let i = 0; i < 9; i++) far.push({ s: 'rrect', x: W * (i / 8), y: H * .07, w: W * .1, h: H * .05, r: H * .01, m: i % 2 ? 'accent' : 'wall2' });
      floor(); break;
    case 'street': case 'city':
      far.push({ s: 'rrect', x: W / 2, y: fl / 2, w: W * 1.4, h: fl, r: 0, m: 'sky' });
      far.push({ s: 'rrect', x: W / 2, y: fl * .75, w: W * 1.4, h: fl * .5, r: 0, m: 'sky2' });
      for (let i = -2; i < 9; i++) {
        const bw = W * (.16 + rnd(i) * .14), bh = H * (.22 + rnd(i + 20) * .3), bx = i * W * .17;
        far.push({ s: 'rrect', x: bx, y: fl - bh / 2, w: bw, h: bh, r: H * .004, m: i % 2 ? 'building' : 'building2' });
        for (let r = 0; r < Math.floor(bh / (H * .05)) - 1; r++) for (let c = 0; c < 3; c++) if (rnd(i * 31 + r * 7 + c) > .3)
          far.push({ s: 'rrect', x: bx + (c - 1) * bw * .28, y: fl - bh + H * .045 + r * H * .05, w: bw * .16, h: H * .022, r: 0, m: rnd(i + r + c * 3) > .55 ? 'windowLit' : 'glass' });
      }
      mid.push({ s: 'rrect', x: W / 2, y: (fl + H) / 2, w: W * 1.4, h: H - fl, r: 0, m: 'ground' });
      mid.push({ s: 'rrect', x: W / 2, y: fl + H * .03, w: W * 1.4, h: H * .02, r: 0, m: 'path' });
      break;
    case 'park':
      far.push({ s: 'rrect', x: W / 2, y: fl / 2, w: W * 1.4, h: fl, r: 0, m: 'sky' });
      far.push({ s: 'rrect', x: W / 2, y: fl * .78, w: W * 1.4, h: fl * .44, r: 0, m: 'sky2' });
      far.push({ s: 'ellipse', x: W * .15, y: fl + H * .05, rx: W * .6, ry: H * .14, m: 'plant2' });
      far.push({ s: 'ellipse', x: W * .9, y: fl + H * .06, rx: W * .55, ry: H * .12, m: 'plant' });
      mid.push({ s: 'rrect', x: W / 2, y: (fl + H) / 2, w: W * 1.4, h: H - fl, r: 0, m: 'ground' });
      mid.push({ s: 'poly', m: 'path', pts: [[W * .42, fl], [W * .58, fl], [W * .9, H], [W * .1, H]] });
      break;
    case 'sky':
      far.push({ s: 'rrect', x: W / 2, y: H / 2, w: W * 1.4, h: H, r: 0, m: 'sky' });
      far.push({ s: 'rrect', x: W / 2, y: H * .75, w: W * 1.4, h: H * .5, r: 0, m: 'sky2' });
      return { far, mid, floor: H * .9 };
    case 'studio': default:
      far.push({ s: 'rrect', x: W / 2, y: H / 2, w: W * 1.4, h: H, r: 0, m: 'wall' });
      far.push({ s: 'ellipse', x: W / 2, y: fl + H * .02, rx: W * .9, ry: H * .07, m: 'floor2' });
      mid.push({ s: 'rrect', x: W / 2, y: (fl + H) / 2 + H * .03, w: W * 1.4, h: H - fl, r: 0, m: 'floor' });
  }
  return { far, mid, floor: fl };
}

// bounding height in unit space, for layout
export const UNIT_H = { char: 1, product: 1, prop: 1 };
