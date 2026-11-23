// node --test studio/tests/*.test.mjs — the shot board, estimates, the hard cap and mock takes (no network, no spend)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { estimateVideo, estimateImage } from '../server/engines/openrouter.mjs';
import { buildPrompt } from '../server/production.mjs';

const bible = JSON.parse(fs.readFileSync(new URL('../kit/test/bible.json', import.meta.url)));

test('estimates follow the token pricing', () => {
  // 480x854 × 24 × 5 / 1024 tokens × $7e-6 (Flash)
  assert.equal(estimateVideo('bytedance/seedance-2.5-flash', '480p', '9:16', 5), +(480 * 854 * 24 * 5 / 1024 * 7e-6).toFixed(3));
  assert.ok(estimateVideo('bytedance/seedance-2.5', '720p', '9:16', 5) > estimateVideo('bytedance/seedance-2.5-flash', '480p', '9:16', 5));
  assert.equal(estimateImage('bytedance-seed/seedream-5-5', 2), 0.036);
});

test('shot prompts carry the winners\' blocks and the locked style', () => {
  const p = { settings: { stylePara: 'LOCKED STYLE', motionMode: 'video' }, assets: [{ id: 'char-ava', desc: 'Ava sheet' }] };
  const s = buildPrompt({ ...bible.shots[0], refs: ['char-ava'] }, bible, p);
  for (const k of ['one continuous take', 'STYLE: LOCKED STYLE', 'REFERENCES: image 1 is Ava sheet', 'MOTION:', 'CAST: exactly 1 person', 'PLACE:', 'ACTION:']) assert.ok(s.includes(k), k);
  assert.ok(!/3 pm\.\nAgain/.test(s.split('(The words')[0]), 'on-screen words are kept out of the picture prompt');
  const k = buildPrompt(bible.shots[0], bible, { settings: { motionMode: 'keyframes' }, assets: [] });
  assert.ok(k.includes('start exactly on the first frame'));
});

test('board: init from a bible, confirm-before-pay, mock take, the hard cap refuses', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adboard-')), ad = path.join(tmp, 'ad');
  fs.mkdirSync(path.join(ad, 'production', 'previz'), { recursive: true });
  fs.writeFileSync(path.join(ad, 'bible.json'), JSON.stringify(bible));
  const { loadConfig, STUDIO } = await import('../server/util.mjs');
  const cfg = loadConfig(); cfg.openrouter = { mock: true }; cfg.budget = { capUsd: 10 };
  const PR = await import('../server/production.mjs'); PR.initProduction(cfg);
  const plan = PR.init(ad, 'ad', {});
  assert.equal(plan.shots.length, bible.shots.length);
  assert.ok(plan.assets.some(a => a.id === 'product') && plan.assets.some(a => a.id === 'char-ava'));
  await assert.rejects(PR.take(ad, 'ad', 's1', {}), /confirm/);
  // a fake previz so the take has its motion reference
  const ff = await (await import('../server/util.mjs')).ffmpeg7(cfg), prev = path.join(ad, 'production', 'previz', 's1.mp4');
  const { run } = await import('../server/util.mjs');
  await run(ff, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=240x426:d=1', '-pix_fmt', 'yuv420p', prev]);
  PR.patchShot(ad, 'ad', 's1', {}); const p1 = PR.plan(ad); p1.shots[0].previz = { kind: 'kit', file: 'production/previz/s1.mp4' }; fs.writeFileSync(path.join(ad, 'production', 'plan.json'), JSON.stringify(p1));
  const t = await PR.take(ad, 'ad', 's1', { confirm: true });
  assert.equal(t.mock, true); assert.ok(fs.existsSync(path.join(ad, t.file)));
  assert.equal(PR.plan(ad).shots[0].status, 'review');
  // the cap: with mock off and a $0 cap, a real call is refused before any request
  const orx = await import('../server/engines/openrouter.mjs');
  await assert.rejects(orx.video({ budget: { capUsd: 0 }, openrouter: { mock: false } }, { prompt: 'x', seconds: 4, out: path.join(tmp, 'x.mp4') }), /budget/);
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.ok(fs.existsSync(STUDIO));
});
