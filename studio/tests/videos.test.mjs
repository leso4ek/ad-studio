// node --test studio/tests/videos.test.mjs — round 13: videos that are not ads (explainer; short-drama series)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SCHEMAS, FORMATS } from '../server/schemas.mjs';
import { validate } from '../server/validate.mjs';
import { STAGES, appliesTo, RUBRIC, checkBible } from '../server/stages.mjs';

const kitBible = JSON.parse(fs.readFileSync(new URL('../kit/test/bible.json', import.meta.url)));
const st = id => STAGES.find(s => s.id === id);

test('explainer: topic brief schema, its own brief schema, no brand map, its own rubric', () => {
  assert.ok(FORMATS.includes('explainer'));
  const tb = { topic: 'why ears pop on planes', question: 'Why do your ears pop?', audience: { who: 'adults who fly', knows: 'swallowing helps' }, angle: 'a tiny tube you never think about',
    facts: [{ fact: 'the Eustachian tube links the middle ear and the throat', source: 'NHS' }, { fact: 'cabin pressure changes on climb and descent', source: 'FAA' }, { fact: 'swallowing opens the tube', source: 'Mayo Clinic' }],
    format: { aspect: '9:16', seconds: 45 }, tone: 'curious', channel: 'Tiny Whys', cta: 'Follow for part 2', reason: 'x' };
  assert.deepEqual(validate(SCHEMAS.topicBrief, tb), []);
  assert.ok(validate(SCHEMAS.topicBrief, { ...tb, facts: tb.facts.slice(0, 2) }).length, 'at least 3 sourced facts');
  assert.equal(st('brief').schemaFor({ format: 'explainer' }), 'topicBrief');
  assert.equal(st('brief').schemaFor({ format: 'story-ad' }), 'brief');
  assert.equal(appliesTo(st('brandmap'), { format: 'explainer' }), false);
  assert.equal(appliesTo(st('premises'), { format: 'explainer' }), false);
  assert.equal(appliesTo(st('brandmap'), { format: 'story-ad' }), true);
  assert.match(RUBRIC.explainer, /sourced/);
});

test('a bible without a product is valid and passes the checks', () => {
  const b = structuredClone(kitBible); delete b.product;
  for (const s of b.shots) s.layers = s.layers.filter(l => l.type !== 'product');
  b.endcard = { ...b.endcard, logo: 'Tiny Whys', line: 'Ears, explained', cta: 'Follow for more' };
  b.vo = { lines: [{ id: 'l1', text: 'one two three', at: .5 }] };
  assert.deepEqual(validate(SCHEMAS.bible, b), []);
  assert.deepEqual(checkBible(b), []);
});

const series = {
  title: 'Night Shift', logline: 'A nurse finds her own name on a patient chart.', genre: 'mystery', tone: 'tense', hookPromise: 'who wrote her name, and why',
  characters: [
    { id: 'mara', name: 'Mara', role: 'she, 30s, night nurse', want: 'the truth', fear: 'being next', look: { skin: '#E2A784', hairStyle: 'bun', hair: '#3A2418', top: '#7FB3D5', bottom: '#2C3E50' }, voice: 'af_heart' },
    { id: 'dev', name: 'Dev', role: 'he, 40s, porter', want: 'to keep a secret', fear: 'Mara finding out', look: { skin: '#B07A55', hairStyle: 'short', hair: '#111111', top: '#556B2F', bottom: '#333333' }, voice: 'am_michael' }],
  places: { ward: { kind: 'office', time: 'night' } }, arc: 'Mara follows the chart to the old wing.',
  episodes: [1, 2, 3].map(n => ({ n, title: `Ep ${n}`, hook: 'a chart slides out', beats: ['a', 'b', 'c'], cliffhanger: { moment: 'the lights die', line: 'It is your handwriting.', question: 'who wrote it?' }, seconds: 40 })),
  reason: 'x' };

test('short drama: series schema, stages per level, cliffhanger checks, continuity locks', async () => {
  const S = await import('../server/stages.mjs');
  assert.deepEqual(validate(SCHEMAS.seriesBible, series), []);
  const ser = { format: 'drama-series' }, ep = { format: 'drama-episode' };
  assert.deepEqual(STAGES.filter(s => appliesTo(s, ser)).map(s => s.id), ['series', 'style', 'episodes']);
  const epStages = STAGES.filter(s => appliesTo(s, ep)).map(s => s.id);
  for (const id of ['story', 'style', 'direction', 'bible', 'frames', 'voice', 'animatic', 'final', 'scorecard']) assert.ok(epStages.includes(id), id);
  for (const id of ['brief', 'premises', 'hooks', 'brandmap', 'episodes', 'audience']) assert.ok(!epStages.includes(id), id);
  // cliffhanger rules
  const b = { dur: 42.5, endcard: { t0: 40, logo: 'Part 2' }, vo: { lines: [{ id: 'l1', text: 'It is your handwriting.', at: 37.8 }] } };
  assert.deepEqual(S.checkDrama(b), []);
  assert.ok(S.checkDrama({ ...b, vo: { lines: [{ id: 'l1', text: 'hello', at: 20 }] } }).some(e => /before the cut/.test(e)), 'resolution after the cliffhanger');
  assert.ok(S.checkDrama({ ...b, endcard: { ...b.endcard, cta: 'Follow' } }).some(e => /only "Part N"/.test(e)));
  assert.ok(S.checkDrama({ ...b, dur: 60, endcard: { t0: 57.5, logo: 'Part 2' } }).some(e => /30-50 s/.test(e)));
});

test('short drama: the episodes stage creates child projects that inherit cast, voices, palette and the series style', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'series-')); process.env.ADS_DIR = tmp;
  const { loadConfig, writeJSON } = await import('../server/util.mjs');
  const cfg = loadConfig(), P = await import('../server/pipeline.mjs'), S = await import('../server/stages.mjs');
  P.initPipeline(cfg);
  const par = P.createAd({ name: 'Night Shift', format: 'drama-series', brief: { idea: 'x', episodes: 3, seconds: 40 } });
  writeJSON(path.join(tmp, par.slug, 'decisions', '01-series.json'), { stage: 'series', output: series });
  writeJSON(path.join(tmp, par.slug, 'decisions', '06-style.json'), { stage: 'style', output: { style: 'ad-scifi-toon', reason: 'r', alternatives: [{ style: 'ad-toy-3d', why_not: 'x' }], palette: { accent: '#00FFAA' } } });
  const ctx = { slug: par.slug, adDir: path.join(tmp, par.slug), cfg, project: P.project(par.slug), decision: id => (id === 'series' ? { output: series } : null), files: () => [],
    createChild: o => { const p = P.project(par.slug), want = `${par.slug}-${o.suffix}`; return P.createAd({ ...o, slug: want, parent: par.slug, mode: p.mode, autoGates: p.autoGates, decider: p.decider }); } };
  const r = await S.AUTO.episodes(ctx);
  assert.equal(r.episodes.length, 3);
  const eps = P.episodesOf(par.slug); assert.deepEqual(eps.map(e => e.episode), [1, 2, 3]);
  const e2 = P.project(eps[1].slug); assert.equal(e2.format, 'drama-episode'); assert.equal(e2.parent, par.slug);
  const ectx = { project: e2, cfg, decision: () => null };
  assert.equal(S.secondsOf(ectx), 40);
  assert.equal(S.STAGES.find(s => s.id === 'style').fixed(ectx).style, 'ad-scifi-toon');
  const locked = S.seriesLocks(ectx, { title: 't', cast: { someone: {} }, places: {}, endcard: { t0: 40, logo: 'x', line: 'buy', cta: 'now' }, shots: [] });
  assert.deepEqual(Object.keys(locked.cast), ['mara', 'dev']); assert.equal(locked.cast.dev.voice, 'am_michael');
  assert.equal(locked.palette.accent, '#00FFAA'); assert.equal(locked.endcard.logo, 'Part 3'); assert.equal(locked.endcard.cta, undefined);
  assert.equal(S.seriesLocks({ ...ectx, project: P.project(eps[2].slug) }, { endcard: { t0: 1, logo: 'x' }, shots: [] }).endcard.logo, 'Night Shift', 'the finale shows the series title');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('short drama: an episode board reuses the character sheets approved in another episode', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eps-'));
  const bible = JSON.parse(fs.readFileSync(new URL('../kit/test/bible.json', import.meta.url)));
  for (const e of ['s-ep01', 's-ep02']) { fs.mkdirSync(path.join(tmp, e, 'production', 'assets'), { recursive: true }); fs.writeFileSync(path.join(tmp, e, 'bible.json'), JSON.stringify(bible)); fs.writeFileSync(path.join(tmp, e, 'project.json'), JSON.stringify({ slug: e, parent: 's', format: 'drama-episode', stages: {} })); }
  fs.writeFileSync(path.join(tmp, 's-ep01', 'production', 'assets', 'ava.png'), 'png');
  const { loadConfig } = await import('../server/util.mjs');
  const PR = await import('../server/production.mjs'); PR.initProduction(loadConfig());
  const p1 = PR.init(path.join(tmp, 's-ep01'), 's-ep01');
  const id = p1.assets.find(a => a.kind === 'character').id;
  PR.chooseAsset(path.join(tmp, 's-ep01'), 's-ep01', id, 'production/assets/ava.png');
  const p2 = PR.init(path.join(tmp, 's-ep02'), 's-ep02');
  const a2 = p2.assets.find(a => a.id === id);
  assert.equal(a2.status, 'approved'); assert.equal(a2.from, 's-ep01');
  assert.ok(fs.existsSync(path.join(tmp, 's-ep02', a2.chosen)));
  fs.rmSync(tmp, { recursive: true, force: true });
});
