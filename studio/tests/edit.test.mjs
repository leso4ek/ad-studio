// node --test studio/tests/edit.test.mjs — the edit tool's pure parts (cuts, checks, time mapping, ASS captions) and one real render
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as E from '../server/engines/edit.mjs';

const W = (w, t0, t1) => ({ w, t0, t1 });
const words = [W('So', 0.2, 0.4), W('why', 0.45, 0.7), W('does', 0.75, 1.0), W('it', 1.05, 1.15), W('pop?', 1.2, 1.6), W('Um', 3.0, 3.3), W('Because', 3.4, 3.9), W('air', 3.95, 4.2), W('moves.', 4.25, 4.8)];

test('cuts: long pauses go, a pause after a question is kept, never inside a word', () => {
  const keep = E.proposeCuts(words, 5.5, { maxPause: .45, keepPauseAfterQuestion: .6 });
  assert.deepEqual(keep.map(k => [k.t0, k.t1]), [[0.14, 1.66], [2.94, 4.86]], 'the 1.4 s gap after "pop?" is longer than the kept question pause');
  assert.deepEqual(E.checkKeep(keep, words), []);
  const short = E.proposeCuts([W('Why?', 0, .4), W('Air', .9, 1.2)], 2, { keepPauseAfterQuestion: .6 });
  assert.equal(short.length, 1, 'a 0.5 s pause after a question is kept');
  assert.ok(E.checkKeep([{ t0: 0, t1: 0.6 }], words).some(e => /inside the word "why"/.test(e)));
  assert.ok(E.checkKeep([{ t0: 1, t1: 2 }, { t0: 1.5, t1: 3 }], words).some(e => /overlaps/.test(e)));
  assert.deepEqual(E.proposeCuts([], 3), [{ t0: 0, t1: 3 }]);
});

test('time mapping through kept ranges', () => {
  const keep = [{ t0: 1, t1: 2 }, { t0: 5, t1: 6 }];
  assert.equal(E.mapTime(1.5, keep), .5); assert.equal(E.mapTime(5.5, keep), 1.5); assert.equal(E.mapTime(3, keep), null);
});

test('ASS: word-by-word captions on the output timeline, highlight on the current word, title, colours', () => {
  assert.equal(E.assColor('#FFFFFF'), '&H00FFFFFF'); assert.equal(E.assColor('#FFD400'), '&H0000D4FF'); assert.equal(E.assColor('#000000AA'), '&H55000000');
  const keep = E.proposeCuts(words, 5.5);
  const ass = E.buildAss(words, keep, E.DEFAULT_STYLE, { emphasis: ['air'], title: { text: 'Ears, explained', t0: 0, t1: 1.5 } });
  assert.match(ass, /PlayResX: 1080/); assert.match(ass, /Style: Cap,Archivo Black/);
  const lines = ass.split('\n').filter(l => l.startsWith('Dialogue: 0'));
  assert.equal(lines.length, words.length, 'one event per word');
  assert.match(lines[0], /SO/); assert.match(ass, /Title,,0,0,0,,Ears, explained/);
  const air = lines.find(l => /\}MOVES\.\{/.test(l) && /AIR/.test(l)); assert.ok(air && air.includes('{\\c&H0000D4FF}AIR'), 'the emphasis word stays highlighted while another word is current');
  assert.ok(!lines.some(l => /POP\?.*UM|POP\? UM/.test(l)), 'a chunk never runs across a sentence end');
  assert.ok(!E.buildAss(words, keep, E.DEFAULT_STYLE, { captions: false, title: { text: 'T' } }).includes('Dialogue: 0'), 'captions can be turned off, the title stays');
  const t = l => l.split(',')[1]; assert.ok(t(lines[5]) < '0:00:01.80', 'the cut pause is removed from the timeline');
});

test('render: kept ranges, 9:16, burned captions, audio', async () => {
  const { loadConfig, ffmpeg7, run } = await import('../server/util.mjs');
  const cfg = loadConfig(), ff = await ffmpeg7(cfg), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'edit-')), src = path.join(tmp, 'in.mp4');
  await run(ff, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=6', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', src]);
  const r = await E.render(cfg, src, words, { keep: [{ t0: 0, t1: 1.7 }, { t0: 2.9, t1: 4.9 }], emphasis: ['air'], title: { text: 'Test', t0: 0, t1: 1 }, music: { use: false } }, path.join(tmp, 'draft-v1.mp4'));
  const A = await import('../server/engines/analyse.mjs'), m = await A.probe(r.file);
  assert.equal(m.w, 1080); assert.equal(m.h, 1920); assert.ok(m.audio); assert.ok(Math.abs(m.duration - 3.7) < .2, `duration ${m.duration}`);
  fs.rmSync(tmp, { recursive: true, force: true });
});
