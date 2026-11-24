// Ad Studio · engine "mirofish": a simulated-audience test of a finished ad with MiroFish (github.com/666ghj/MiroFish,
// AGPL-3.0; it runs as a separate local service, Ad Studio only calls its HTTP API on :5001).
//   dossier (built by code from the bible, brief and decisions; no frames, no Claude) →
//   ontology/generate → graph/build → simulation/create → prepare → start (max_rounds) → report/generate
// Cost guard: the simulated viewers run on a cheap OpenRouter model. Spend is read from OpenRouter's key usage
// (GET /api/v1/key) before and during the run;
// Rounds are simulated hours from midnight and viewers sleep 00-05h, so fewer than ~10 rounds simulate nobody;
// 24 rounds = one simulated day (idle rounds cost nothing). platform 'parallel' = Twitter + Reddit, MiroFish's own
// default and the only runner that reports completion (its single-platform scripts never write simulation_end).
// past cfg.mirofish.capUsd the simulation is stopped and the run fails.
// The run is logged in studio/.ledger.jsonl with its measured cost. Mock mode (cfg.mirofish.mock / ADSTUDIO_MOCK=1)
// writes a canned report and spends nothing.
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { loadEnv, readJSON, sleep } from '../util.mjs';
import { emit } from '../bus.mjs';
import { record, spent } from './openrouter.mjs';

const DEF = { url: 'http://127.0.0.1:5001', usageUrl: 'https://openrouter.ai/api/v1/key', capUsd: 1, maxRounds: 24, platform: 'parallel', parallelProfiles: 5, pollMs: 5000, timeoutMin: 60 };
export const conf = cfg => ({ ...DEF, ...(cfg.mirofish || {}) });
export const mock = cfg => !!(cfg.mirofish?.mock || process.env.ADSTUDIO_MOCK === '1');
const orKey = () => loadEnv().OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '';

// ---------------------------------------------------------------- the dossier (pure code)
const PROP = { 'fern-droopy': 'a droopy, pale fern', fern: 'a healthy green fern', drop: 'a falling water drop', leaf: 'a leaf', sparkle: 'a small sparkle', mug: 'a mug of tea', steam: 'rising steam', sun: 'sunlight' };
const POSE = { annoyed: 'annoyed', think: 'thinking, unsure', hold: 'holding it up, pleased', happy: 'happy, relaxed', idle: 'standing', point: 'pointing', wave: 'waving', shrug: 'shrugging' };
const clean = t => String(t || '').replace(/\s*\n\s*/g, ' ').trim();
const sec = t => `${(+t).toFixed(1)} s`;

/** A viewer-side description of the ad: what is seen and heard, second by second. Never the scorecard. */
export function buildDossier(adDir, { segments = [], question = '' } = {}) {
  const b = readJSON(path.join(adDir, 'bible.json')), brief = readJSON(path.join(adDir, 'brief.json'), {});
  const dec = id => { const f = fs.readdirSync(path.join(adDir, 'decisions')).find(n => n.endsWith(`-${id}.json`)); return f ? readJSON(path.join(adDir, 'decisions', f))?.output : null; };
  if (!b) throw new Error('no bible.json: finish the ad first');
  const hooks = dec('hooks'), pr = brief.product || {}, aud = brief.audience || {};
  const cast = b.cast || {}, lines = [...(b.vo?.lines || [])].sort((x, y) => x.at - y.at);
  const said = (t0, t1) => lines.filter(l => l.at >= t0 - .05 && l.at < t1 - .05).map(l => `"${l.text}"`).join(' ');
  const out = [];
  out.push(`# Ad under test: ${b.title}`, '');
  // no platform names: MiroFish turns every named organisation into an agent, and platforms are not viewers
  out.push(`A ${b.dur}-second vertical video ad (${brief.format?.aspect || '9:16'}) that appears between other videos in the short-video feed on people's phones. Many people watch with the sound off; every spoken line is also burned in as a caption. People can scroll past at any second.`, '');
  const what = String(pr.what || 'a product').replace(/\.$/, ''), lower = what[0].toLowerCase() + what.slice(1);
  out.push(`## The product`, `${pr.name} is ${/^[A-Z](?![A-Z])/.test(what) ? lower : what}, from a new brand. ${brief.benefit || pr.benefit || ''}`.trim());
  for (const p of pr.proof || brief.proof || []) out.push(`- ${p}`);
  out.push('', `The ad only claims: ${(dec('brandmap')?.claims || []).map(c => `"${c.text}"`).join(', ') || 'what the label says'}.`, '');
  out.push(`## Who it is made for`, `${aud.who || ''}. The moment: ${aud.moment || ''}. Their problem: ${aud.pain || ''}.`.trim(), '');
  const look = String(b.stylePara || '').replace(/^([^:]{0,60}):\s*/, (m, g) => `${g.toLowerCase()}, `);  // a style 'name' reads as an entity: keep it as plain description
  out.push(`## Look and sound`, `The picture is drawn like this: ${look} Music: ${b.music?.mood || 'none'}${b.music?.bpm ? `, about ${b.music.bpm} bpm` : ''}. One narrator voice.`, '');
  out.push(`## What the viewer sees and hears, second by second`);
  for (const s of [...b.shots].sort((x, y) => x.t0 - y.t0)) {
    const seen = [], texts = [];
    for (const l of s.layers || []) {
      if (l.type === 'char') seen.push(`${l.id[0].toUpperCase() + l.id.slice(1)} (${cast[l.id]?.role || 'a character'}), ${POSE[l.pose] || l.pose || 'standing'}`);
      else if (l.type === 'prop') seen.push(PROP[l.kind] || String(l.kind).replace(/-/g, ' '));
      else if (l.type === 'product') seen.push(l.id === 'hero' ? `the ${pr.name} ${pr.kind || 'pack'} filling the frame` : l.id === 'inhand' ? `the ${pr.name} ${pr.kind || 'pack'} in her hand` : `the ${pr.name} ${pr.kind || 'pack'} in the background`);
      else if (l.type === 'text') texts.push(`"${clean(l.text)}"`);
    }
    const where = s.place === 'studio' ? 'a plain studio backdrop' : `${b.places?.[s.place]?.kind || s.place}${b.places?.[s.place]?.time ? `, ${b.places[s.place].time}` : ''}`;
    out.push(`- ${sec(s.t0)}–${sec(s.t1)} (${s.beat || 'shot'}): ${where}; ${seen.join('; ')}.${texts.length ? ` On-screen words: ${texts.join(' ')}${/[.!?]"$/.test(texts.at(-1)) ? '' : '.'}` : ''}${said(s.t0, s.t1) ? ` Narrator: ${said(s.t0, s.t1)}` : ''}`);
  }
  const ec = b.endcard || {};
  out.push(`- ${sec(ec.t0)}–${sec(b.dur)} (end card): the ${pr.name} logo, the line "${ec.line || ''}"${ec.cta ? ` and "${ec.cta}"` : ''}.${said(ec.t0, b.dur + 1) ? ` Narrator: ${said(ec.t0, b.dur + 1)}` : ''}`, '');
  if (hooks?.hooks?.length > 1) {
    out.push(`## Three possible openings (the first 3 seconds; the rest of the ad is the same)`);
    for (const h of hooks.hooks) out.push(`- Opening ${h.id}${h.id === hooks.lead ? ' (the one described above)' : ''}: on-screen "${clean(h.onScreen)}"; ${h.visual}`);
    out.push('');
  }
  if (segments.length) {
    out.push(`## The viewers in this feed`, `Only these groups of viewers react and post. The product, its brand, the character${Object.keys(cast).length > 1 ? 's' : ''} in the ad and its drawing style are parts of the ad, not people who post.`);
    for (const g of segments) out.push(`- ${g.name}: ${g.who} ${g.mindset || ''}`.trim());
    out.push('');
  }
  if (question) out.push(`## The question`, question, '');
  return out.join('\n');
}

// ---------------------------------------------------------------- HTTP
async function mf(c, method, p, body, { form } = {}) {
  const headers = { 'Accept-Language': 'en' };
  let payload;
  if (form) payload = form; else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(c.url + p, { method, headers, body: payload, signal: AbortSignal.timeout(600000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(`MiroFish ${method} ${p} ${r.status}: ${String(j.error || j.message || JSON.stringify(j)).slice(0, 400)}`);
  return j.data ?? j;
}
export async function usageUsd(c) {
  const r = await fetch(c.usageUrl, { headers: { Authorization: `Bearer ${orKey() || 'proxy-injected'}` }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`OpenRouter key usage ${r.status}`);
  const j = await r.json();
  return +(j.data?.usage ?? j.data?.effective_budget?.spend_usd ?? 0);
}
export async function available(cfg) {
  if (mock(cfg)) return { ok: true, detail: 'mock mode' };
  const c = conf(cfg);
  try { const r = await fetch(c.url + '/health', { signal: AbortSignal.timeout(4000) }); if (!r.ok) throw new Error(r.status); }
  catch { return { ok: false, why: `MiroFish backend not running at ${c.url} (bash studio/scripts/start_mirofish.sh)` }; }
  return { ok: true, detail: `MiroFish at ${c.url}` };
}

/**
 * Runs one audience test. p = {dossier, requirement, name, outDir}. Returns {report, posts, stats, costUsd, ids}.
 * onStep(text) is called on each phase.
 */
export async function runTest(cfg, p, { slug, signal, onStep = () => {} } = {}) {
  const c = conf(cfg), outDir = p.outDir;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'dossier.md'), p.dossier);
  const step = t => { onStep(t); emit('engine', { slug, stage: 'audience', engine: 'mirofish', text: t }); };
  if (mock(cfg)) {
    const report = `# Audience simulation (mock)\n\nViewers paused on the opening card. Several asked how big a capful is. The tag line was repeated in replies.\n`;
    fs.writeFileSync(path.join(outDir, 'report.md'), report);
    return { report, posts: [{ author: 'mock viewer', text: 'one capful, finally a rule I can follow' }], interviews: [{ agent: 'mock viewer', text: 'I stopped for the plant face-off.' }], stats: { agents: 3, rounds: 1, actions: 3 }, costUsd: 0, ids: {}, mock: true };
  }
  const cap = c.capUsd, total = cfg.budget?.capUsd ?? 10;
  if (spent() + cap > total + 1e-9) throw new Error(`budget: an audience test may cost up to $${cap.toFixed(2)}; spent $${spent().toFixed(2)} of the $${total.toFixed(2)} cap`);
  // checkpoints: a rerun on the same dossier resumes after the last finished phase instead of paying again
  const runFile = path.join(outDir, 'run.json'), hash = crypto.createHash('sha256').update(p.dossier + '\n' + p.requirement).digest('hex').slice(0, 16);
  const prev = readJSON(runFile);
  const resume = prev && prev.hash === hash && prev.phase !== 'reported' && !p.fresh ? prev : null;
  const ids = { ...(resume?.ids || {}) }, PH = ['ontology', 'graph', 'created', 'prepared', 'started', 'simulated', 'interviewed', 'closed', 'reported'];
  let phase = resume?.phase || null;
  const past = ph => phase && PH.indexOf(phase) >= PH.indexOf(ph);
  const mark = ph => { phase = ph; fs.writeFileSync(runFile, JSON.stringify({ hash, phase, ids, at: new Date().toISOString() }, null, 1)); };
  const job = `mirofish-${Date.now()}`, u0 = await usageUsd(c);
  if (resume) step(`resuming after "${phase}" (simulation ${ids.simulation_id || '-'})`);
  record({ job, kind: 'mirofish', slug, status: 'submitted', estimate: cap, what: 'audience test' });
  let cost = 0, stopped = false;
  // if the process is killed mid-run, close the ledger entry with the last measured cost (never leave a $cap 'submitted')
  const onKill = sig => { try { record({ job, kind: 'mirofish', slug, status: 'completed', cost, ids, error: `killed (${sig})` }); } finally { process.exit(130); } };
  process.once('SIGINT', onKill); process.once('SIGTERM', onKill);
  const unhook = () => { process.off('SIGINT', onKill); process.off('SIGTERM', onKill); };
  const check = async () => {
    cost = +((await usageUsd(c)) - u0).toFixed(4);
    if (cost > cap && !stopped) {
      stopped = true;
      if (ids.simulation_id) await mf(c, 'POST', '/api/simulation/stop', { simulation_id: ids.simulation_id }).catch(() => {});
      throw new Error(`cost guard: the audience test reached $${cost.toFixed(3)} (cap $${cap.toFixed(2)}); stopped`);
    }
  };
  const until = async (what, fn) => {
    const end = Date.now() + c.timeoutMin * 60000;
    for (;;) {
      if (signal?.aborted) throw new Error('cancelled');
      await check();
      const r = await fn();
      if (r) return r;
      if (Date.now() > end) throw new Error(`${what} timed out after ${c.timeoutMin} min`);
      await sleep(c.pollMs);
    }
  };
  try {
    if (!past('ontology')) {
      step('ontology: reading the dossier');
      const form = new FormData();
      form.append('files', new Blob([p.dossier], { type: 'text/markdown' }), 'dossier.md');
      form.append('simulation_requirement', p.requirement);
      form.append('project_name', p.name || 'Ad Studio audience test');
      ids.project_id = (await mf(c, 'POST', '/api/graph/ontology/generate', null, { form })).project_id;
      mark('ontology'); await check();
    }
    if (!past('graph')) {
      step('graph: extracting people, products and claims');
      const bt = await mf(c, 'POST', '/api/graph/build', { project_id: ids.project_id });
      const built = await until('graph build', async () => {
        const t = await mf(c, 'GET', `/api/graph/task/${bt.task_id}`);
        if (t.status === 'failed') throw new Error(`graph build failed: ${String(t.error || t.message).slice(0, 300)}`);
        return t.status === 'completed' ? t : null;
      });
      Object.assign(ids, { graph_id: built.result?.graph_id, entities: built.result?.node_count, relations: built.result?.edge_count });
      mark('graph');
    }
    if (!past('created')) {
      step(`simulation: ${ids.entities ?? '?'} entities, ${ids.relations ?? '?'} relations → simulated viewers`);
      ids.simulation_id = (await mf(c, 'POST', '/api/simulation/create', { project_id: ids.project_id, graph_id: ids.graph_id, enable_twitter: c.platform !== 'reddit', enable_reddit: c.platform !== 'twitter' })).simulation_id;
      mark('created');
    }
    if (!past('prepared')) {
      const pt = await mf(c, 'POST', '/api/simulation/prepare', { simulation_id: ids.simulation_id, use_llm_for_profiles: true, parallel_profile_count: c.parallelProfiles });
      await until('simulation prepare', async () => {
        const s = await mf(c, 'POST', '/api/simulation/prepare/status', { task_id: pt.task_id, simulation_id: ids.simulation_id });
        if (s.status === 'failed') throw new Error(`prepare failed: ${String(s.error || s.message).slice(0, 300)}`);
        return s.status === 'completed' || s.status === 'ready' || s.already_prepared ? s : null;
      });
      mark('prepared');
    }
    if (!past('started')) {
      step(`running ${c.maxRounds} rounds on a simulated ${c.platform === 'parallel' ? 'Twitter + Reddit' : c.platform}`);
      // graph memory on: the viewers' posts are extracted into the (local) graph, which is what the report agent searches
      await mf(c, 'POST', '/api/simulation/start', { simulation_id: ids.simulation_id, platform: c.platform, max_rounds: c.maxRounds, enable_graph_memory_update: true, force: !!resume });
      mark('started');
    }
    // MiroFish keeps the simulation process alive afterwards (its report agent interviews the viewers), so
    // runner_status stays "running": done = every enabled platform has written its simulation_end
    const want = c.platform === 'parallel' ? ['twitter', 'reddit'] : [c.platform];
    const rs = await until('simulation', async () => {
      const s = await mf(c, 'GET', `/api/simulation/${ids.simulation_id}/run-status`);
      if (s.runner_status === 'failed') throw new Error(`simulation failed: ${String(s.error || '').slice(0, 300)}`);
      return ['completed', 'stopped'].includes(s.runner_status) || want.every(w => s[`${w}_completed`]) ? s : null;
    });
    if (!past('simulated')) mark('simulated');
    // one fixed question to every viewer while the environment is still alive (first-person answers, cheap)
    if (!past('interviewed')) {
      step('interviews: one question to every simulated viewer');
      const iv = await mf(c, 'POST', '/api/simulation/interview/all', { simulation_id: ids.simulation_id, prompt: p.interview || 'You just saw this ad in your feed. Did you stop or keep scrolling, and why? What do you remember about it? Would you try the product?', platform: c.interviewPlatform || 'twitter', timeout: 300 })
        .catch(e => ({ error: e.message }));
      const res = iv.result?.results || iv.results || {};
      const prof = await mf(c, 'GET', `/api/simulation/${ids.simulation_id}/profiles?platform=${c.interviewPlatform || 'twitter'}`).catch(() => ({}));
      const names = Object.fromEntries((prof.profiles || []).map(x => [String(x.user_id ?? x.agent_id), x.name || x.username]));
      const list = Object.values(res).map(r => ({ agent: r.agent_name || names[String(r.agent_id)] || `viewer ${r.agent_id}`, agent_id: r.agent_id, platform: r.platform, text: String(r.response || r.answer || '').slice(0, 900) })).filter(r => r.text);
      fs.writeFileSync(path.join(outDir, 'interviews.json'), JSON.stringify(iv.error ? { error: iv.error } : list, null, 1));
      mark('interviewed'); await check();
    }
    // closing the environment ends the process, so the run becomes terminal and the graph writes drain
    if (!past('closed')) {
      step('closing the simulation');
      await mf(c, 'POST', '/api/simulation/close-env', { simulation_id: ids.simulation_id, timeout: 60 }).catch(() => {});
      mark('closed');
    }
    step('report: MiroFish writes its prediction');
    // 409 while the run is still finishing or the graph writes are draining: retry until it is accepted
    const rg = await until('report start', () => mf(c, 'POST', '/api/report/generate', { simulation_id: ids.simulation_id }).catch(e => { if (/ 409:/.test(e.message)) return null; throw e; }));
    await until('report', async () => {
      const s = await mf(c, 'POST', '/api/report/generate/status', { task_id: rg.task_id, simulation_id: ids.simulation_id });
      if (s.status === 'failed') throw new Error(`report failed: ${String(s.error || s.message).slice(0, 300)}`);
      return s.status === 'completed' ? s : null;
    });
    const rep = await mf(c, 'GET', `/api/report/by-simulation/${ids.simulation_id}`);
    const report = rep.markdown_content || rep.content || JSON.stringify(rep.outline || rep, null, 1);
    const postsRaw = await mf(c, 'GET', `/api/simulation/${ids.simulation_id}/posts?platform=${c.platform === 'reddit' ? 'reddit' : 'twitter'}&limit=60`).catch(() => ({}));
    const posts = (postsRaw.posts || postsRaw.items || (Array.isArray(postsRaw) ? postsRaw : [])).map(x => ({ author: x.user_name || x.name || x.author || x.user_id, text: String(x.content || x.text || '').slice(0, 280), likes: x.num_likes ?? x.likes })).filter(x => x.text);
    await sleep(3000); await check().catch(() => {});  // usage lags a little
    const sim = await mf(c, 'GET', `/api/simulation/${ids.simulation_id}`).catch(() => ({}));
    const stats = { agents: sim.profiles_count ?? sim.entities_count ?? sim.agent_count ?? ids.entities, rounds: rs.current_round, actions: rs.total_actions_count, twitter: rs.twitter_actions_count, reddit: rs.reddit_actions_count };
    fs.writeFileSync(path.join(outDir, 'report.md'), report);
    fs.writeFileSync(path.join(outDir, 'posts.json'), JSON.stringify(posts, null, 1));
    const interviews = readJSON(path.join(outDir, 'interviews.json'), []);
    mark('reported');
    record({ job, kind: 'mirofish', slug, status: 'completed', cost, ids });
    unhook();
    return { report, posts, interviews: Array.isArray(interviews) ? interviews : [], stats, costUsd: cost, ids };
  } catch (e) {
    await check().catch(() => {});
    record({ job, kind: 'mirofish', slug, status: 'completed', cost, ids, error: e.message.slice(0, 300) });
    unhook();
    throw e;
  }
}
