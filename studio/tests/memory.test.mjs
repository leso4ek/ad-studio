// node --test studio/tests/memory.test.mjs — the hindsight experience memory (episodes → relabel → recall → proposals)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mem-'));
process.env.ADSTUDIO_MEMORY_DIR = dir;
const M = await import('../server/memory.mjs');
M.initMemory();

test('episodes and signals are logged by code, rewards come from the signals', () => {
  M.logEpisode({ ad: 'a1', stage: 'hooks', output: { lead: 'A', hooks: [{ id: 'A', type: 'mood', onScreen: 'Sunday standoff.', visual: 'face-off' }] } });
  M.logSignal({ ad: 'a1', stage: 'hooks', kind: 'override', value: 1, note: 'user chose B' });
  M.signalsFromScorecard('a1', { scores: [{ rule: '1 Hook in 1-3 s', score: 2, note: 'static first half second' }, { rule: '5 Plant/pulse', score: 5, note: 'clean' }] });
  M.signalsFromAudience('a1', { scores: { stopScroll: 3, brandRecall: 2, trust: 3, watchThrough: 4, clickIntent: 2 }, fixes: ['show the pour'] });
  const eps = M.episodes('a1');
  assert.equal(eps.filter(e => e.type === 'episode').length, 1);
  assert.ok(eps.filter(e => e.type === 'signal' && e.stage === 'direction').length >= 2, 'rule 1 and stopScroll also speak about direction');
  const r = M.rewards('a1');
  assert.ok(r.hooks < 0, `hooks reward ${r.hooks}`); assert.ok(r.brandmap !== undefined);
  assert.match(M.episodes('a1')[0].action, /A\* \[mood\] "Sunday standoff\."/);
});

test('the relabel prompt carries goals, attempts and signals; lessons merge by stage and similar text', async () => {
  const prompt = M.relabelPrompt('a1');
  for (const k of ['Hindsight Experience Replay', '[hooks] goal: the first 1-3 s stop the scroll', 'override 1: user chose B', 'hindsight:', 'future:']) assert.ok(prompt.includes(k), k);
  const calls = [];
  const decideFor = async (ad, stage, p, schema, signal, opts) => { calls.push({ stage, opts }); return { output: { lessons: [
    { stage: 'hooks', kind: 'real', goal: 'stop the scroll', lesson: 'Open on motion in the first 0.3 s, not a static face-off.', when: 'any', confidence: 'medium' },
    { stage: 'hooks', kind: 'hindsight', goal: 'a memorable name for the ad', lesson: 'To give the ad a shareable label, title the hook like a showdown.', when: 'any' },
  ], reason: 'r' } }; };
  const r = await M.relabel('a1', decideFor);
  assert.deepEqual(r, { added: 2, total: 2 });
  assert.deepEqual(calls[0].opts, { fresh: true, noSkill: true, noTools: true, effort: 'low', maxTurns: 2 });
  M.storeLessons('a2', [{ stage: 'hooks', kind: 'real', goal: 'g', lesson: 'Open on motion in the first 0.3 seconds, not a static face-off.', when: 'any' }]);
  const l = M.lessons().find(x => x.lesson.startsWith('Open on motion'));
  assert.equal(l.count, 2); assert.deepEqual(l.ads, ['a1', 'a2']);
});

test('recall: only the stage asked for, best first, under the size cap', () => {
  M.storeLessons('a3', [{ stage: 'bible', kind: 'real', goal: 'g', lesson: 'Keep each card on screen for characters/15 + 1.5 s.', when: 'any' }]);
  const r = M.recall('hooks', { style: 'ad-paper-cutout', product: 'houseplant feed' });
  assert.ok(r.text.startsWith('LESSONS FROM PAST ADS')); assert.equal(r.ids.length, 2);
  assert.ok(r.text.indexOf('Open on motion') < r.text.indexOf('shareable label'), 'the lesson seen in two ads ranks first');
  assert.ok(!r.text.includes('characters/15'));
  assert.equal(M.recall('hooks', { maxChars: 40 }).ids.length, 0);
  assert.deepEqual(M.recall('premises'), { text: '', ids: [] });
});

test('a lesson from 3 ads becomes a proposal; only approval writes the skill', () => {
  M.storeLessons('a4', [{ stage: 'hooks', kind: 'real', goal: 'g', lesson: 'Open on motion in the first 0.3 s, never a static face-off.', when: 'any' }]);
  const p = M.proposals().find(x => x.status === 'pending');
  assert.ok(p && p.ads.length === 3 && p.stage === 'hooks');
  const skill = path.join(dir, 'SKILL.md'); fs.writeFileSync(skill, '# skill\n');
  M.decideProposal(p.id, true, skill);
  const s = fs.readFileSync(skill, 'utf8');
  assert.match(s, /## Learned rules \(approved by the user\)/); assert.match(s, /\*\*hooks:\*\* Open on motion/);
  assert.equal(M.proposals().find(x => x.id === p.id).status, 'approved');
  assert.equal(M.lessons().find(x => x.id === p.lessonId).status, 'approved');
  M.decideProposal(p.id, true, skill);  // idempotent
  assert.equal(fs.readFileSync(skill, 'utf8').match(/Open on motion/g).length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});
