// node --test studio/tests/catalog.test.mjs — every Seedance catalogue style is complete and names no studio or artist
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, check, guide, BANNED } from '../server/catalog.mjs';

test('catalogue entries pass the schema and the no-names rule; guides render', () => {
  const all = load();
  assert.ok(all.length >= 1);
  assert.deepEqual(all.flatMap(check), []);
  assert.equal(new Set(all.map(e => e.slug)).size, all.length, 'unique slugs');
  for (const e of all) assert.match(guide(e), /## STYLE block/);
});

test('the no-names rule catches studios and artists', () => {
  for (const s of ['like Pixar', 'Ghibli skies', 'in the style of Warhol', 'Rick and Morty portal']) assert.match(s, BANNED);
  assert.doesNotMatch('rubber-hose limbs and pie eyes', BANNED);
});
