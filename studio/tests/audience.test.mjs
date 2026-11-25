// node --test studio/tests/audience.test.mjs — the audience-test dossier and the MiroFish cost guard (a fake MiroFish
// and a fake OpenRouter usage endpoint on localhost; no network, no spend)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audience-'));
process.env.ADSTUDIO_LEDGER = path.join(tmp, 'ledger.jsonl');
const MF = await import('../server/engines/mirofish.mjs');
const OR = await import('../server/engines/openrouter.mjs');
const AD = new URL('../../ads/first-story-ad', import.meta.url).pathname;

test('dossier: what a viewer sees and hears, second by second, never the scorecard', () => {
  const d = MF.buildDossier(AD, { segments: [{ name: 'Plant parents', who: 'adults with a few houseplants.', mindset: 'scroll fast' }], question: 'Will they stop?' });
  for (const k of ['# Ad under test: Sprigly', '0.0 s–3.0 s (hook)', 'On-screen words: "Sunday standoff."', 'Narrator: "Every Sunday', 'end card', 'Opening B', '## The viewers in this feed', 'Plant parents', '## The question']) assert.ok(d.includes(k), k);
  assert.ok(!/scorecard|28\/35|\/35/i.test(d), 'no self-scores leak into the dossier');
  assert.ok(d.split(/\s+/).length < 1500, 'small dossier = small swarm');
});

function fakeServers({ step = 0.01 }) {
  const st = { usage: 5, stopped: false, calls: [] };
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      st.calls.push(`${req.method} ${req.url}`);
      const ok = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data })); };
      const u = req.url.split('?')[0];
      if (u === '/key') { st.usage += step; return res.end(JSON.stringify({ data: { usage: st.usage } })); }
      if (u === '/health') return ok({ status: 'ok' });
      if (u === '/api/graph/ontology/generate') { assert.ok(body.includes('dossier.md') && body.includes('simulation_requirement')); return ok({ project_id: 'p1' }); }
      if (u === '/api/graph/build') return ok({ task_id: 't1' });
      if (u === '/api/graph/task/t1') return ok({ status: 'completed', result: { graph_id: 'g1', graph_info: { node_count: 9 } } });
      if (u === '/api/simulation/create') return ok({ simulation_id: 'sim1' });
      if (u === '/api/simulation/prepare') return ok({ task_id: 't2' });
      if (u === '/api/simulation/prepare/status') return ok({ status: 'completed' });
      if (u === '/api/simulation/start') { const b = JSON.parse(body); assert.equal(b.max_rounds, 24); assert.equal(b.enable_graph_memory_update, true); return ok({}); }
      if (u === '/api/simulation/sim1/run-status') { const done = st.calls.filter(c => c.includes('run-status')).length > 2; return ok({ runner_status: 'running', twitter_completed: done, reddit_completed: done, current_round: 24, total_actions_count: 40 }); }
      if (u === '/api/simulation/sim1') return ok({ profiles_count: 7 });
      if (u === '/api/simulation/stop') { st.stopped = true; return ok({}); }
      if (u === '/api/simulation/interview/all') return ok({ result: { results: { twitter_0: { agent_id: 0, response: 'I stopped for the fern.', platform: 'twitter' } } } });
      if (u === '/api/simulation/close-env') { st.closed = true; return ok({}); }
      if (u === '/api/report/generate') { if (!st.closed || st.calls.filter(c => c.includes('report/generate')).length < 2) { res.statusCode = 409; return res.end(JSON.stringify({ success: false, error: 'still active' })); } return ok({ task_id: 't3' }); }
      if (u === '/api/report/generate/status') return ok({ status: 'completed' });
      if (u === '/api/report/by-simulation/sim1') return ok({ markdown_content: '# Report\nViewers liked the cap rule.' });
      if (u === '/api/simulation/sim1/posts') return ok({ posts: [{ user_name: 'v1', content: 'one capful, easy', num_likes: 3 }] });
      res.statusCode = 404; res.end('{}');
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, st, url: `http://127.0.0.1:${srv.address().port}` })));
}

test('MiroFish run: the whole API flow, cost measured from key usage and logged', async () => {
  const { srv, st, url } = await fakeServers({ step: 0.01 });
  const cfg = { budget: { capUsd: 10 }, mirofish: { url, usageUrl: url + '/key', capUsd: 1, pollMs: 5 } };
  const r = await MF.runTest(cfg, { dossier: '# d', requirement: 'q', outDir: path.join(tmp, 'a') });
  assert.match(r.report, /cap rule/); assert.equal(r.posts[0].text, 'one capful, easy');
  assert.equal(r.interviews[0].text, 'I stopped for the fern.'); assert.equal(st.closed, true); assert.equal(r.stats.agents, 7);
  assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, 'a', 'run.json'))).phase, 'reported');
  assert.ok(r.costUsd > 0 && r.costUsd < 1); assert.equal(st.stopped, false);
  assert.ok(fs.existsSync(path.join(tmp, 'a', 'report.md')) && fs.existsSync(path.join(tmp, 'a', 'dossier.md')));
  assert.ok(OR.ledger().some(e => e.kind === 'mirofish' && e.status === 'completed' && e.cost === r.costUsd));
  srv.close();
});

test('MiroFish cost guard: past the cap the simulation is stopped and the run fails', async () => {
  const { srv, st, url } = await fakeServers({ step: 0.4 });
  const cfg = { budget: { capUsd: 10 }, mirofish: { url, usageUrl: url + '/key', capUsd: 1, pollMs: 5 } };
  await assert.rejects(MF.runTest(cfg, { dossier: '# d', requirement: 'q', outDir: path.join(tmp, 'b') }), /cost guard/);
  assert.equal(st.stopped, true, '/api/simulation/stop was called');
  srv.close();
});

test('MiroFish: the run is refused when the total budget cannot cover its cap', async () => {
  const cfg = { budget: { capUsd: 0.5 }, mirofish: { url: 'http://127.0.0.1:9', capUsd: 1 } };
  await assert.rejects(MF.runTest(cfg, { dossier: '# d', requirement: 'q', outDir: path.join(tmp, 'c') }), /budget/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('stage 13 in mock mode: setup → dossier → run → verdict card, lean Claude calls, setup cached', async () => {
  const t2 = fs.mkdtempSync(path.join(os.tmpdir(), 'aud-stage-')), ad = path.join(t2, 'ad');
  fs.mkdirSync(path.join(ad, 'decisions'), { recursive: true });
  for (const f of ['bible.json', 'brief.json']) fs.copyFileSync(path.join(AD, f), path.join(ad, f));
  for (const f of ['03-hooks.json', '05-brandmap.json']) fs.copyFileSync(path.join(AD, 'decisions', f), path.join(ad, 'decisions', f));
  const { AUTO } = await import('../server/stages.mjs');
  const calls = [];
  const ctx = {
    adDir: ad, slug: 'ad', cfg: { mirofish: { mock: true } }, signal: null,
    bible: () => JSON.parse(fs.readFileSync(path.join(ad, 'bible.json'))),
    decision: id => { const f = fs.readdirSync(path.join(ad, 'decisions')).find(n => n.endsWith(`-${id}.json`)); return f ? JSON.parse(fs.readFileSync(path.join(ad, 'decisions', f))) : null; },
    files: () => {},
    decide: async (stage, prompt, schema, opts) => {
      calls.push({ stage, opts, len: prompt.length });
      return { output: stage === 'audience-setup'
        ? { requirement: 'Predict reactions.', segments: [{ name: 'Plant parents', who: 'adults', mindset: 'fast' }, { name: 'Hobbyists', who: 'keen', mindset: 'picky' }, { name: 'Scrollers', who: 'anyone', mindset: 'skip ads' }], reason: 'r' }
        : { scores: { stopScroll: 3, watchThrough: 4, brandRecall: 3, trust: 4, clickIntent: 2 }, bestHook: 'B', comments: [{ who: 'a', text: 'x', tone: 'positive' }, { who: 'b', text: 'y', tone: 'neutral' }, { who: 'c', text: 'z', tone: 'negative' }], fixes: ['show the pour'], risks: [], confidence: 'low', reason: 'r' } };
    },
  };
  const r = await AUTO.audience(ctx);
  assert.match(r.summary, /stop 3 · watch 4 · recall 3 · trust 4 · click 2 · hook B · \$0\.00/);
  assert.deepEqual(calls.map(c => c.stage), ['audience-setup', 'audience']);
  for (const c of calls) assert.deepEqual(c.opts, { fresh: true, noSkill: true, noTools: true, effort: 'low', maxTurns: 2 });
  assert.ok(calls.every(c => c.len < 20000), 'small prompts');
  const v = JSON.parse(fs.readFileSync(path.join(ad, 'decisions', '14-audience.json'))).output;
  assert.equal(v.bestHook, 'B'); assert.equal(v.mock, true);
  assert.ok(fs.readFileSync(path.join(ad, 'out', 'audience', 'dossier.md'), 'utf8').includes('Plant parents'));
  await AUTO.audience(ctx);  // a second run reuses the cached setup: one more Claude call, not two
  assert.equal(calls.length, 3); assert.equal(calls[2].stage, 'audience');
  fs.rmSync(t2, { recursive: true, force: true });
});
