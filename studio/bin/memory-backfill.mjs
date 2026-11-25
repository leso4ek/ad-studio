#!/usr/bin/env node
// Ad Studio · put an ad made before the hindsight memory existed into it, then relabel (learn).
//   node studio/bin/memory-backfill.mjs <slug> [--no-learn] [--force]
// Reads ads/<slug>/decisions/*.json and log.jsonl (repairs, redos, approvals, frame-review notes, animatic checks),
// the scorecard and the audience verdict, writes episodes + signals, then runs one relabel through the decide chain.
import fs from 'fs';
import path from 'path';
import { loadConfig, readJSON } from '../server/util.mjs';
import { initBus, onEvent } from '../server/bus.mjs';
import * as P from '../server/pipeline.mjs';
import * as M from '../server/memory.mjs';

const slug = process.argv[2], flag = f => process.argv.includes(f);
if (!slug) { console.error('usage: node studio/bin/memory-backfill.mjs <slug> [--no-learn] [--force]'); process.exit(2); }
const cfg = loadConfig(); initBus(cfg.adsDir); P.initPipeline(cfg);
const dir = P.adDir(slug), dec = path.join(dir, 'decisions');
if (M.episodes(slug).length && !flag('--force')) console.log(`${slug} is already in the memory (${M.episodes(slug).length} lines); use --force to add it again`);
else {
  const brief = readJSON(path.join(dir, 'brief.json'), {}), style = readJSON(path.join(dir, 'bible.json'), {}).style;
  const log = fs.existsSync(path.join(dir, 'log.jsonl')) ? fs.readFileSync(path.join(dir, 'log.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
  const made = {};
  for (const e of log) {
    if (e.type === 'decision' && e.kind === 'repair') M.logSignal({ ad: slug, stage: e.stage, kind: 'repair', value: 1, note: e.text });
    if (e.type === 'decision' && e.kind === 'made' && e.record?.output && M.GOALS[e.stage]) {
      made[e.stage] = (made[e.stage] || 0) + 1;
      M.logEpisode({ ad: slug, stage: e.stage, output: e.record.output, style, product: brief.product?.what, attempt: made[e.stage], note: e.record.note });
    }
    if (e.type === 'decision' && e.kind === 'override') M.logSignal({ ad: slug, stage: e.stage, kind: 'override', value: 1, note: `user chose ${e.choice}` });
    if (e.type === 'gate' && e.kind === 'approved') M.logSignal({ ad: slug, stage: e.stage === 'frames' ? 'direction' : e.stage === 'animatic' ? 'bible' : e.stage, kind: 'approved', value: 1 });
    if (e.type === 'gate' && e.kind === 'gate' && e.stage === 'frames' && /^revised/.test(e.text || '')) M.logSignal({ ad: slug, stage: 'bible', kind: 'review', value: 1, note: e.text });
    if (e.type === 'gate' && e.kind === 'gate' && e.stage === 'animatic' && /checks to look at/.test(e.text || '')) M.logSignal({ ad: slug, stage: 'bible', kind: 'check', value: false, note: e.text });
  }
  // decisions with no 'made' event in the log (older runs): one episode each
  for (const f of fs.readdirSync(dec).filter(f => /^\d+-[\w-]+\.json$/.test(f))) {
    const id = f.replace(/^\d+-|\.json$/g, ''), rec = readJSON(path.join(dec, f));
    if (!M.GOALS[id] || made[id] || !rec?.output) continue;
    M.logEpisode({ ad: slug, stage: id, output: rec.output, style, product: brief.product?.what });
    if (rec.overriddenBy) M.logSignal({ ad: slug, stage: id, kind: 'override', value: 1, note: 'the user overrode Claude' });
  }
  const sc = P.readDecision(slug, 'scorecard')?.output; if (sc) M.signalsFromScorecard(slug, sc);
  const au = P.readDecision(slug, 'audience')?.output; if (au?.scores) M.signalsFromAudience(slug, au);
  console.log(`${slug}: ${M.episodes(slug).filter(e => e.type === 'episode').length} episodes, ${M.episodes(slug).filter(e => e.type === 'signal').length} signals; rewards ${JSON.stringify(M.rewards(slug))}`);
}
if (!flag('--no-learn')) {
  onEvent(ev => { if (ev.text && ['claude', 'engine'].includes(ev.type)) console.log(`[${ev.type}] ${String(ev.text).slice(0, 160)}`); });
  const r = await P.learn(slug);
  console.log(r ? `lessons: +${r.added}, ${r.total} in total` : 'relabel did not run');
}
process.exit(0);
