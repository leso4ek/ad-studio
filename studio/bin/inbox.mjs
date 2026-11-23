#!/usr/bin/env node
// Decision inbox, for a Claude session (or a person) answering Ad Studio when headless Claude Code can't run.
//   node studio/bin/inbox.mjs list                         pending questions of every ad
//   node studio/bin/inbox.mjs show <slug> <stage>          the prompt and the schema
//   node studio/bin/inbox.mjs answer <slug> <stage> <answer.json> [--by name]   validates, then answers
import fs from 'fs'; import path from 'path';
import { loadConfig, readJSON, writeJSON } from '../server/util.mjs';
import { validate } from '../server/validate.mjs';
const cfg = loadConfig(), [cmd, slug, stage, file] = process.argv.slice(2);
const by = process.argv.includes('--by') ? process.argv[process.argv.indexOf('--by') + 1] : 'claude-session';
const pend = (s, st) => path.join(cfg.adsDir, s, 'decisions', 'pending', `${st}.json`);
if (cmd === 'list') {
  for (const s of fs.existsSync(cfg.adsDir) ? fs.readdirSync(cfg.adsDir) : []) { const d = path.join(cfg.adsDir, s, 'decisions', 'pending'); if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) console.log(`${s}  ${f.replace('.json', '')}`); }
} else if (cmd === 'show') {
  const q = readJSON(pend(slug, stage)); if (!q) { console.error('nothing pending'); process.exit(1); }
  console.log(q.prompt); console.log('\n--- schema ---\n' + JSON.stringify(q.schema));
} else if (cmd === 'answer') {
  const q = readJSON(pend(slug, stage)); if (!q) { console.error('nothing pending for', slug, stage); process.exit(1); }
  const a = JSON.parse(fs.readFileSync(file, 'utf8')), errs = validate(q.schema, a);
  if (errs.length) { console.error('does not match the schema:\n- ' + errs.join('\n- ')); process.exit(1); }
  writeJSON(path.join(cfg.adsDir, slug, 'decisions', 'answers', `${stage}.json`), { output: a, by, at: new Date().toISOString() });
  console.log('answered', slug, stage);
} else { console.log('usage: inbox.mjs list | show <slug> <stage> | answer <slug> <stage> <file.json>'); }
