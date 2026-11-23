// node --test studio/tests   (no network, no Claude, no rendering)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { validate } from '../server/validate.mjs';
import { lintText, lintBible } from '../server/lint.mjs';
import { SCHEMAS } from '../server/schemas.mjs';
import { checkBible } from '../server/stages.mjs';
import { buildCues, srt, castVoices } from '../server/engines/voice.mjs';

const kitBible = JSON.parse(fs.readFileSync(new URL('../kit/test/bible.json', import.meta.url)));

test('schema validator: types, enums, required, nested', () => {
  assert.deepEqual(validate(SCHEMAS.style, { style: 'ad-riso-print', reason: 'x', alternatives: [{ style: 'ad-toy-3d', why_not: 'y' }] }), []);
  const e = validate(SCHEMAS.style, { style: 'ad-anime', reason: 1 });
  assert.ok(e.some(x => x.includes('one of')) && e.some(x => x.includes('expected string')) && e.some(x => x.includes('missing "alternatives"')));
  assert.ok(validate(SCHEMAS.hooks, { hooks: [{ id: 'A', type: 't', onScreen: 'o', visual: 'v', vo: '' }], lead: 'A', reason: 'r' }).some(x => x.includes('at least 3')));
});

test('claims lint catches absolutes, health, pressure and real brands; passes honest lines', () => {
  assert.ok(lintText('The best tea in the world, guaranteed').some(i => i.rule === 'absolute'));
  assert.ok(lintText('Cures your headache').some(i => i.rule === 'health'));
  assert.ok(lintText('Ask your mum to buy it').some(i => i.rule === 'pressure'));
  assert.ok(lintText('Better than Starbucks').some(i => i.rule === 'real-brand'));
  assert.deepEqual(lintText('Caffeine-free rooibos for slow afternoons').filter(i => i.level === 'error'), []);
  assert.deepEqual(lintBible(kitBible).filter(i => i.level === 'error'), []);
});

test('bible checks: tiling, end card, cast, voice fit', () => {
  const b = { ...kitBible, vo: { lines: [{ id: 'l1', text: 'one two three', at: 0.5 }] } };
  assert.deepEqual(checkBible(b), []);
  const gap = structuredClone(b); gap.shots[1].t0 = 4.5;
  assert.ok(checkBible(gap).some(e => e.includes('gap')));
  const who = structuredClone(b); who.shots[0].layers.push({ type: 'char', id: 'zed' });
  assert.ok(checkBible(who).some(e => e.includes('"zed"')));
  const long = structuredClone(b); long.vo.lines = [{ id: 'l1', text: 'word '.repeat(30).trim(), at: 0 }, { id: 'l2', text: 'next', at: 3 }];
  assert.ok(checkBible(long).some(e => e.includes('runs into')));
  assert.ok(validate(SCHEMAS.bible, kitBible).length === 0, validate(SCHEMAS.bible, kitBible).join('\n'));
});

test('captions: chunks of ≤ 38 characters, ordered, no overlaps, valid srt', () => {
  const lines = [{ id: 'a', text: 'Every day at three, Ava runs out of steam and the afternoon drags on', at: 0.4 }, { id: 'b', text: 'Then she found a calmer cup.', at: 5 }];
  const cues = buildCues(lines, { a: 4.2, b: 1.8 }, null);
  assert.ok(cues.every(c => c.text.length <= 38));
  for (let i = 0; i < cues.length - 1; i++) assert.ok(cues[i].t1 <= cues[i + 1].t0 + 1e-9);
  assert.match(srt(cues), /^1\n00:00:00,400 --> /);
});

test('voices: narrator default, cast members get distinct voices', () => {
  const v = castVoices({ cast: { ava: { hairStyle: 'bob' }, ben: { hairStyle: 'short' } }, vo: { lines: [{ id: '1', text: 'x', at: 0 }, { id: '2', text: 'y', at: 1, speaker: 'ava' }, { id: '3', text: 'z', at: 2, speaker: 'ben' }] } });
  assert.equal(v[0].kVoice, 'af_heart'); assert.notEqual(v[1].kVoice, v[2].kVoice);
});

test('pipeline: create, stale propagation, override pick, fallback to inbox when claude is missing', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adstudio-'));
  process.env.ADS_DIR = tmp;
  const { loadConfig } = await import('../server/util.mjs');
  const cfg = loadConfig(); cfg.claude.bin = 'definitely-not-claude';
  const P = await import('../server/pipeline.mjs');
  P.initPipeline(cfg);
  const p = P.createAd({ name: 'Test Ad', brief: { fictional: true }, mode: 'step' });
  assert.equal(p.slug, 'test-ad');
  // pretend stages 1-3 are done, then mark stale from 1
  const pj = path.join(tmp, 'test-ad', 'project.json'), proj = JSON.parse(fs.readFileSync(pj));
  for (const s of ['brief', 'premises', 'hooks']) proj.stages[s].status = 'done';
  fs.writeFileSync(pj, JSON.stringify(proj));
  P.markStale('test-ad', 'brief');
  const after = JSON.parse(fs.readFileSync(pj));
  assert.equal(after.stages.premises.status, 'stale'); assert.equal(after.stages.story.status, 'idle');
  // override a hooks pick
  fs.mkdirSync(path.join(tmp, 'test-ad', 'decisions'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'test-ad', 'decisions', '03-hooks.json'), JSON.stringify({ stage: 'hooks', output: { lead: 'A', hooks: [], reason: '' } }));
  after.stages.hooks.status = 'review'; for (const s of ['brief', 'premises']) after.stages[s].status = 'done'; fs.writeFileSync(pj, JSON.stringify(after));
  // the run after approval needs a decider: claude is missing → inbox; answer the brief question there
  const run = P.approve('test-ad', 'hooks', { choice: 'B' });
  await run;
  assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, 'test-ad', 'decisions', '03-hooks.json'))).output.lead, 'B');
  const pend = path.join(tmp, 'test-ad', 'decisions', 'pending', 'story.json');
  for (let i = 0; i < 50 && !fs.existsSync(pend); i++) await new Promise(r => setTimeout(r, 50));
  assert.ok(fs.existsSync(pend), 'the story question went to the inbox');
  const st = JSON.parse(fs.readFileSync(pj)).stages.story;
  assert.ok(st.fallbacks.some(f => f.engine === 'claude'), 'claude fallback recorded');
  P.cancel('test-ad');
});
