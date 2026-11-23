// Ad Studio · engine "inbox": the fallback when the Claude Code CLI can't run headless. The app writes the request to
//   ads/<slug>/decisions/pending/<stage>.json   {stage, prompt, schema, created}
// and waits for an open Claude session (or a person) to answer it with
//   node studio/bin/inbox.mjs answer <slug> <stage> <answer.json>      (validates against the schema, then writes)
//   ads/<slug>/decisions/answers/<stage>.json
import fs from 'fs';
import path from 'path';
import { writeJSON, readJSON, sleep } from '../util.mjs';
import { emit } from '../bus.mjs';

export const id = 'inbox';
export async function available() { return { ok: true, detail: 'answers are written by a Claude session with studio/bin/inbox.mjs' }; }

export async function decide(cfg, { slug, adDir, stage, prompt, schema, signal }) {
  const pend = path.join(adDir, 'decisions', 'pending', `${stage}.json`), ans = path.join(adDir, 'decisions', 'answers', `${stage}.json`);
  try { fs.unlinkSync(ans); } catch { /* none */ }
  writeJSON(pend, { stage, prompt, schema, created: new Date().toISOString() });
  emit('claude', { slug, stage, kind: 'inbox', text: `waiting in the decision inbox: answer with  node studio/bin/inbox.mjs answer ${slug} ${stage} <file.json>` });
  const t0 = Date.now(), limit = (cfg.inbox?.timeoutMin || 240) * 60e3;
  while (Date.now() - t0 < limit) {
    if (signal?.aborted) throw new Error('cancelled');
    const a = readJSON(ans);
    if (a) { try { fs.unlinkSync(pend); } catch { /* gone */ } return { output: a.output ?? a, meta: { engine: 'inbox', answeredBy: a.by || 'claude-session', ms: Date.now() - t0, notes: a.notes } }; }
    await sleep(1000);
  }
  throw new Error('no answer in the decision inbox');
}
