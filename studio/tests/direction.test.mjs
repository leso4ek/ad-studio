// node --test studio/tests/direction.test.mjs — the directed camera (framing math) and the direction/bible checks
import test from 'node:test';
import assert from 'node:assert/strict';
import { directCamera, frame, subjectBox, keepOnSet } from '../kit/camera.js';
import { checkDirection, checkDirected } from '../server/stages.mjs';
import { validate } from '../server/validate.mjs';
import { SCHEMAS } from '../server/schemas.mjs';

const W = 1080, H = 1920, stage = { x0: 0, y0: 0, w: W, h: H }, ctx = { W, H, stage, L: l => l };
const shot = (camera, extra = {}) => ({ id: 's', t0: 0, t1: 3, camera, layers: [{ type: 'char', id: 'juno', x: .3, y: .9, scale: 1.2 }, { type: 'product', id: 'bottle', x: .8, y: .7, scale: .5 }], ...extra });
const toScreen = (cam, P) => [cam.cx + (P[0] - cam.cx + cam.px * W) * cam.zoom, cam.cy + (P[1] - cam.cy + cam.py * H) * cam.zoom];

test('legacy cameras are untouched', () => {
  assert.deepEqual(directCamera(shot(undefined), 1, ctx), { zoom: 1, px: 0, py: 0, cx: W / 2, cy: H * .55 });
  const c = directCamera(shot({ zoom: [1, 1.2], focus: [.1, .6] }), 3, ctx);
  assert.equal(+c.zoom.toFixed(3), 1.2); assert.equal(c.cx, W / 2 + .1 * W);
});

test('shot sizes frame the subject: tighter sizes zoom in, the look point lands on the target', () => {
  const box = subjectBox(shot({}), 'juno', ctx);
  assert.ok(box && box.kind === 'person');
  const zs = ['WS', 'MS', 'MCU', 'CU', 'ECU'].map(sz => frame(box, sz, { W, H }).zoom);
  for (let i = 1; i < zs.length; i++) assert.ok(zs[i] > zs[i - 1], `zoom grows ${zs}`);
  const f = frame(box, 'CU', { W, H, at: [.5, .42] }), look = [box.x, box.yBase - box.h * .78];
  const [sx, sy] = toScreen(f, look);
  assert.ok(Math.abs(sx - .5 * W) < 1 && Math.abs(sy - .42 * H) < 1);
  assert.equal(subjectBox(shot({}), 'product', ctx).kind, 'thing');
});

test('the frame never leaves the drawn set, even on a pull-out of a wide shot', () => {
  for (const sz of ['EWS', 'WS', 'MS', 'CU', 'ECU']) for (const move of ['static', 'pull', 'pan-l', 'truck-r', 'tilt-up']) for (const t of [0, 1.5, 3]) {
    const c = directCamera(shot({ size: sz, subject: 'juno', move }), t, ctx);
    assert.ok(c.zoom >= 1);
    const [x0, y0] = [(0 - c.cx) / c.zoom + c.cx - c.px * W, (0 - c.cy) / c.zoom + c.cy - c.py * H];
    const [x1, y1] = [(W - c.cx) / c.zoom + c.cx - c.px * W, (H - c.cy) / c.zoom + c.cy - c.py * H];
    assert.ok(x0 >= -1 && y0 >= -1 && x1 <= W + 1 && y1 <= H + 1, `${sz} ${move} t=${t}`);
  }
  assert.deepEqual(keepOnSet({ zoom: 1, px: .3, py: -.2, cx: W / 2, cy: H / 2 }, { W, H }), { zoom: 1, px: 0, py: 0, cx: W / 2, cy: H / 2 });
});

test('moves: push ends on the framing, whip settles, handheld is deterministic, rack blurs the back', () => {
  const s = shot({ size: 'MCU', subject: 'juno', move: 'push' }), still = directCamera(shot({ size: 'MCU', subject: 'juno' }), 0, ctx);
  assert.ok(directCamera(s, 0, ctx).zoom < still.zoom && Math.abs(directCamera(s, 3, ctx).zoom - still.zoom) < 1e-6);
  const w = shot({ size: 'CU', subject: 'product', move: 'whip-r' });
  assert.ok(Math.abs(directCamera(w, 0, ctx).whip) > .9 && directCamera(w, .5, ctx).whip === 0);
  const h = shot({ size: 'MS', subject: 'juno', move: 'handheld' });
  assert.deepEqual(directCamera(h, 1.234, ctx), directCamera(h, 1.234, ctx));
  assert.ok(directCamera(shot({ size: 'MS', subject: 'juno', move: 'rack' }), 2, ctx).blurFar > 1);
});

test('direction: schema and checks (tiling, same size twice, cut rate)', () => {
  const sh = (id, t0, t1, size, subject) => ({ id, t0, t1, function: 'close-up', size, subject, move: 'static', reason: 'r', textZone: 'top' });
  const good = { thesis: 'one capful', beats: [{ id: 'b1', block: 'hook', t0: 0, t1: 3, learns: 'x' }, { id: 'b2', block: 'turn', t0: 3, t1: 8, learns: 'y' }, { id: 'b3', block: 'tag', t0: 8, t1: 12, learns: 'z' }],
    book: { grammar: 'g', light: 'l', palette: 'p', performance: 'p', rhythm: 'r', sound: 's' }, locks: { identity: {}, productSide: 'right', screenDirection: 'l→r', light: 'window left' },
    shots: [sh('a', 0, 2, 'WS', 'juno'), sh('b', 2, 4, 'CU', 'juno'), sh('c', 4, 7, 'ECU', 'product'), sh('d', 7, 10, 'MS', 'juno'), sh('e', 10, 12, 'CU', 'product')], reason: 'r' };
  assert.deepEqual(validate(SCHEMAS.direction, good), []);
  assert.deepEqual(checkDirection(good), []);
  const bad = { ...good, shots: [sh('a', 0, 2, 'CU', 'juno'), sh('b', 2.5, 4, 'CU', 'juno'), sh('c', 4, 20, 'WS', 'product'), sh('d', 20, 30, 'MS', 'juno')] };
  const errs = checkDirection(bad).join(' | ');
  assert.match(errs, /gap or overlap/); assert.match(errs, /same size/); assert.match(errs, /cut rate/);
});

test('directed bible checks: reasons, text over the subject in a close-up, product side', () => {
  const b = { dur: 12, endcard: { t0: 9 }, shots: [
    { id: 's1', t0: 0, t1: 3, reason: 'r', camera: { size: 'WS', subject: 'juno' }, layers: [{ type: 'product', x: .8 }] },
    { id: 's2', t0: 3, t1: 6, camera: { size: 'CU', subject: 'juno' }, layers: [{ type: 'text', role: 'card', text: 'Hello there', y: .45 }] },
    { id: 's3', t0: 6, t1: 9, reason: 'r', camera: { size: 'CU', subject: 'juno' }, layers: [{ type: 'product', x: .2 }] }] };
  const errs = checkDirected(b).join(' | ');
  assert.match(errs, /s2: no reason/); assert.match(errs, /sits on the subject/); assert.match(errs, /same size \(CU\)/); assert.match(errs, /screen side/);
  assert.deepEqual(checkDirected({ shots: [{ id: 'x', t0: 0, t1: 3, layers: [] }] }), []);  // undirected bibles are not checked
});
