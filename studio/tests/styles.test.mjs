// node --test studio/tests/styles.test.mjs — every registered kit style is complete
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { STYLES } from '../server/schemas.mjs';
import { STYLE_LINES } from '../server/stages.mjs';

const at = p => new URL(p, import.meta.url);
test('every style in STYLES has a renderer, a description line, a STYLE.md, style.json and a style frame', () => {
  assert.deepEqual(Object.keys(STYLE_LINES).sort(), [...STYLES].sort());
  for (const s of STYLES) {
    assert.ok(fs.existsSync(at(`../kit/styles/${s}.js`)), `${s}: renderer`);
    for (const f of ['STYLE.md', 'style.json', 'styleframe.jpg']) assert.ok(fs.existsSync(at(`../../styles/${s}/${f}`)), `${s}: ${f}`);
    assert.equal(JSON.parse(fs.readFileSync(at(`../../styles/${s}/style.json`))).slug, s);
  }
});
