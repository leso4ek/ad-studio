// node --test studio/tests/videos.test.mjs — round 13: videos that are not ads (explainer; short-drama series)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
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
