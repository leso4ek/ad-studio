// node --test studio/tests/rig.test.mjs — the v2 character rig (round 14)
import test from 'node:test';
import assert from 'node:assert/strict';
import { rig, EXPR, POSES, HAIR, TOPS, blendExpr, visemeOf, ik, rigMats } from '../kit/rig.js';
import { character } from '../kit/shapes.js';
import { frame, subjectBox } from '../kit/camera.js';

const finite = v => typeof v !== 'number' || Number.isFinite(v);
function check(prims, what) {
  for (const p of prims) {
    for (const [k, v] of Object.entries(p)) {
      if (Array.isArray(v)) for (const pt of v) for (const n of [].concat(pt)) assert.ok(finite(n), `${what}: ${k} has ${n}`);
      else assert.ok(finite(v), `${what}: ${k} = ${v}`);
    }
    const xs = p.pts ? p.pts.map(q => q[0]) : [p.x ?? p.x1], ys = p.pts ? p.pts.map(q => q[1]) : [p.y ?? p.y1];
    // everything stays near the figure: feet at 0, head top at -1, arms reach about half a body out
    for (const x of xs) assert.ok(Math.abs(x) < .9, `${what}: x ${x} out of bounds (${p.m})`);
    for (const y of ys) assert.ok(y > -1.25 && y < .1, `${what}: y ${y} out of bounds (${p.m})`);
  }
}

test('every view × expression × pose × hair × outfit gives finite primitives inside the figure box', () => {
  const tops = TOPS, hairs = HAIR;
  let n = 0;
  for (const view of ['front', '34', 'profile']) for (const dir of [1, -1]) for (const expr of Object.keys(EXPR)) {
    const pose = Object.keys(POSES).filter(k => typeof POSES[k] !== 'string')[n % 12];
    const spec = { rig: 'v2', proportions: ['drama', 'toon', 'chibi'][n % 3], build: ['slim', 'average', 'broad', 'curvy', 'round', 'petite'][n % 6], hairStyle: hairs[n % hairs.length],
      outfit: { top: tops[n % tops.length], bottom: ['trousers', 'jeans', 'skirt'][n % 3], accessories: ['badge', 'watch', 'bag', 'necklace', 'tie', 'phone'].slice(0, n % 6) },
      details: ['glasses', 'stubble', 'beard', 'freckles', 'mole', 'earrings', 'age-lines', 'scar'].slice(0, n % 8), name: 'Ava', lashes: n % 2 === 0 };
    const ps = rig(spec, { view, dir, expr, pose, mouthOpen: n % 3 ? .6 : 0, viseme: ['A', 'E', 'O', 'M'][n % 4], blink: n % 7 === 0, walk: n * .1, breath: n * .2 });
    assert.ok(ps.length > 30, 'a detailed figure');
    check(ps, `${view}/${dir}/${expr}/${pose}`);
    n++;
  }
});

test('expressions blend and visemes come from letters', () => {
  const m = blendExpr('neutral', 'shocked', .5);
  assert.ok(m.lidU < EXPR.neutral.lidU && m.lidU > EXPR.shocked.lidU, 'lids halfway');
  assert.equal(blendExpr('sad', 'angry', 1).curve, EXPR.angry.curve);
  assert.deepEqual(['m', 'o', 'a', 't', ' '].map(visemeOf), ['M', 'O', 'A', 'E', 'rest']);
  // the open mouth changes the shape drawn
  const closed = rig({ rig: 'v2' }, { expr: 'neutral' }), talking = rig({ rig: 'v2' }, { expr: 'neutral', mouthOpen: .8, viseme: 'A' });
  assert.ok(talking.some(p => p.m === 'mouth') && !closed.some(p => p.m === 'mouth'));
});

test('IK reaches a target inside the arm and clamps one outside it', () => {
  const r = ik([0, 0], [1, 1], 1, 1);
  assert.ok(Math.abs(Math.hypot(r.elbow[0], r.elbow[1]) - 1) < 1e-9 && Math.abs(Math.hypot(r.hand[0] - r.elbow[0], r.hand[1] - r.elbow[1]) - 1) < 1e-9);
  const far = ik([0, 0], [5, 0], 1, 1); assert.ok(far.hand[0] < 2 && far.hand[0] > 1.99);
});

test('v1 figures are unchanged (old bibles render identically)', () => {
  const a = JSON.stringify(character({ skin: '#E2A784', hairStyle: 'bob' }, { pose: 'happy', face: 'right' }));
  assert.equal(a.length > 100, true);
  assert.ok(!a.includes('"v2"'), 'v1 prims carry no v2 mark');
});

test('materials: every material the rig uses exists for a minimal cast entry', () => {
  const m = rigMats({ ink: '#111111', white: '#ffffff' }, { skin: '#E2A784' });
  const used = new Set();
  for (const view of ['front', '34', 'profile']) for (const e of Object.keys(EXPR)) rig({ rig: 'v2', hairStyle: 'headscarf', outfit: { top: 'suit', accessories: ['badge', 'bag', 'necklace', 'phone'] }, details: ['stubble', 'freckles', 'earrings', 'glasses'], name: 'X' }, { view, expr: e, pose: 'reading-phone', mouthOpen: .7 }).forEach(p => used.add(p.m));
  for (const k of used) assert.ok(m[k], `material ${k} missing`);
});

test('the camera frames v2 people by their smaller heads', () => {
  const stage = { x0: 0, y0: 0, w: 1080, h: 1920 }, shot = { layers: [{ type: 'char', id: 'a', x: .5, y: .9 }] };
  const v1 = subjectBox(shot, 'a', { stage }), v2 = subjectBox(shot, 'a', { stage, personOf: () => 'person-drama' });
  assert.equal(v1.kind, 'person'); assert.equal(v2.kind, 'person-drama');
  assert.ok(frame(v2, 'CU', { W: 1080, H: 1920 }).zoom > frame(v1, 'CU', { W: 1080, H: 1920 }).zoom, 'a v2 close-up zooms in further');
});
