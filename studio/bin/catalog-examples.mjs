#!/usr/bin/env node
// Ad Studio · our own example still for each Seedance catalogue style (one shared test scene, Seedream 5.5).
//   node studio/bin/catalog-examples.mjs                 → lists what is missing and the estimate; spends nothing
//   node studio/bin/catalog-examples.mjs --yes [slugs…]  → generates the missing ones (or only the slugs given)
// Paid (about $0.02 each), guarded by the budget cap and logged in the ledger. Existing examples are kept.
import fs from 'fs';
import path from 'path';
import { loadConfig } from '../server/util.mjs';
import * as OR from '../server/engines/openrouter.mjs';
import { load, CATALOG } from '../server/catalog.mjs';

const args = process.argv.slice(2), yes = args.includes('--yes'), only = args.filter(a => !a.startsWith('--'));
const cfg = loadConfig(), dir = path.join(CATALOG, 'examples');
fs.mkdirSync(dir, { recursive: true });
const todo = load().filter(e => (!only.length || only.includes(e.slug)) && !fs.existsSync(path.join(dir, `${e.slug}.jpg`)));
const est = +(todo.length * OR.estimateImage('bytedance-seed/seedream-5-5', 0)).toFixed(2);
console.log(`${todo.length} example(s) to make, about $${est} (spent so far $${OR.spent().toFixed(2)} of $${(cfg.budget?.capUsd ?? 10).toFixed(2)})`);
if (!yes) { console.log(todo.map(e => e.slug).join(' ') || 'nothing to do'); process.exit(0); }
const ff = await (await import('../server/util.mjs')).ffmpeg7(cfg), { run } = await import('../server/util.mjs');
let spent = 0;
for (const e of todo) {
  try {
    const r = await OR.image(cfg, { model: 'bytedance-seed/seedream-5-5', prompt: `${e.example.prompt}\nSTYLE: ${e.stylePara}`, aspect: '9:16', seed: 11, out: path.join(dir, `_${e.slug}`) }, { what: `catalogue example ${e.slug}` });
    const src = r.files[0], out = path.join(dir, `${e.slug}.jpg`);
    // small JPEG for the repo and the picker grid (540 px wide)
    await run(ff, ['-y', '-v', 'error', '-i', src, '-vf', 'scale=540:-2', '-q:v', '4', out]);
    for (const f of r.files) fs.rmSync(f, { force: true });
    const p = path.join(CATALOG, `${e.slug}.json`), j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.example.file = `studio/styles/catalog/examples/${e.slug}.jpg`; fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
    spent += r.cost; console.log(`${e.slug}: ok ($${r.cost.toFixed(3)})`);
  } catch (err) { console.log(`${e.slug}: FAILED ${String(err.message).slice(0, 160)}`); if (/budget/.test(err.message)) break; }
}
console.log(`done: $${spent.toFixed(3)}`);
