#!/usr/bin/env node
// Ad Studio · check the Seedance style catalogue and regenerate the per-style guides of skills/seedance-styles.
//   node studio/bin/catalog.mjs            (check + write guides)
import { load, check, writeGuides, FAMILIES } from '../server/catalog.mjs';
const all = load(), errs = all.flatMap(check), slugs = new Set();
for (const e of all) { if (slugs.has(e.slug)) errs.push(`duplicate slug ${e.slug}`); slugs.add(e.slug); }
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
const n = writeGuides();
const by = Object.keys(FAMILIES).map(f => `${f} ${all.filter(e => e.family === f).length}`).join(' · ');
console.log(`${n} styles ok, guides written · ${by}`);
