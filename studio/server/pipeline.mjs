// Ad Studio · the runner. One job per ad; stages run in order until a gate, a review (step mode) or an error.
// Every state change is written to ads/<slug>/project.json and emitted to the app.
import fs from 'fs';
import path from 'path';
import { STAGES, AUTO, checkBible, checkDirection, writeReport, lintBible, lintObject } from './stages.mjs';
import { SCHEMAS } from './schemas.mjs';
import { validate } from './validate.mjs';
import { readJSON, writeJSON, now, slugify } from './util.mjs';
import { emit } from './bus.mjs';
import * as claude from './engines/claude.mjs';
import * as inbox from './engines/inbox.mjs';

const DECIDERS = { claude, inbox };
const jobs = new Map();
let CFG = null;
export function initPipeline(cfg) {
  CFG = cfg; fs.mkdirSync(cfg.adsDir, { recursive: true });
  // a restart ends every job: stages left 'running' go back to 'idle' so the run can resume from them
  for (const d of fs.readdirSync(cfg.adsDir)) {
    const f = path.join(cfg.adsDir, d, 'project.json'), p = readJSON(f); if (!p) continue;
    let hit = false; for (const s of Object.values(p.stages)) if (s.status === 'running') { s.status = 'idle'; s.error = 'interrupted by a server restart: press Continue'; hit = true; }
    if (hit) writeJSON(f, p);
  }
}

// ---------- store ----------
export const adDir = slug => path.join(CFG.adsDir, slug);
const pj = slug => path.join(adDir(slug), 'project.json');
export const project = slug => readJSON(pj(slug));
function saveProject(slug, fn) { const p = project(slug); fn(p); p.updated = now(); writeJSON(pj(slug), p); return p; }
function setStage(slug, id, patch) {
  const p = saveProject(slug, p => { p.stages[id] = { ...(p.stages[id] || {}), ...patch }; });
  emit('stage', { slug, stage: id, state: p.stages[id] });
  return p.stages[id];
}

export function listAds() {
  if (!fs.existsSync(CFG.adsDir)) return [];
  return fs.readdirSync(CFG.adsDir).filter(d => fs.existsSync(pj(d))).map(d => { const p = project(d); return { slug: d, title: p.title, updated: p.updated, style: readJSON(path.join(adDir(d), 'bible.json'))?.style, stages: Object.fromEntries(Object.entries(p.stages).map(([k, v]) => [k, v.status])) }; })
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
}

export function createAd({ name, brief = {}, mode = 'autopilot', autoGates = false, decider }) {
  let slug = slugify(name || brief.product || 'new-ad'), k = 2;
  while (fs.existsSync(adDir(slug))) slug = `${slugify(name || 'new-ad')}-${k++}`;
  fs.mkdirSync(path.join(adDir(slug), 'decisions'), { recursive: true });
  const p = { slug, title: name || 'New ad', created: now(), updated: now(), mode, autoGates, decider: decider || null, userBrief: brief, stages: Object.fromEntries(STAGES.map(s => [s.id, { status: 'idle' }])) };
  writeJSON(pj(slug), p);
  emit('ad', { slug, kind: 'created', title: p.title });
  return p;
}

export function adState(slug) {
  const p = project(slug); if (!p) return null;
  const decisions = {};
  for (const s of STAGES) { const d = readDecision(slug, s.id); if (d) decisions[s.id] = d; }
  const fr = readDecision(slug, 'frames-review'); if (fr) decisions['frames-review'] = fr;
  const pending = fs.existsSync(path.join(adDir(slug), 'decisions', 'pending')) ? fs.readdirSync(path.join(adDir(slug), 'decisions', 'pending')).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')) : [];
  return { project: p, decisions, bible: readJSON(path.join(adDir(slug), 'bible.json')), cues: readJSON(path.join(adDir(slug), 'voice', 'cues.json'), []), checks: readJSON(path.join(adDir(slug), 'out', 'checks.json')), running: jobs.has(slug) ? jobs.get(slug).stage : null, pending };
}

// decision files are numbered by stage; reading falls back to any number, so inserting a stage never orphans old ads
const decFile = (slug, id) => {
  const n = STAGES.find(s => s.id === id)?.n, dir = path.join(adDir(slug), 'decisions'), want = path.join(dir, `${n ? String(n).padStart(2, '0') + '-' : ''}${id}.json`);
  if (fs.existsSync(want) || !fs.existsSync(dir)) return want;
  const other = fs.readdirSync(dir).find(f => new RegExp(`^\\d+-${id.replace(/[-]/g, '\\-')}\\.json$`).test(f));
  return other ? path.join(dir, other) : want;
};
export const readDecision = (slug, id) => readJSON(decFile(slug, id));

// ---------- the context a stage gets ----------
function context(slug, signal) {
  const dir = adDir(slug);
  const ctx = {
    slug, adDir: dir, cfg: CFG, signal, project: project(slug),
    decision: id => readDecision(slug, id),
    bible: () => readJSON(path.join(dir, 'bible.json')),
    files(stage, list) { if (list) setStage(slug, stage, { outputs: list }); return project(slug).stages[stage]?.outputs || []; },
    fallback(stage, engine, why) { const s = project(slug).stages[stage]; setStage(slug, stage, { fallbacks: [...(s.fallbacks || []), { engine, why, at: now() }] }); emit('engine', { slug, stage, engine, text: `${engine} unavailable: ${why} → next in chain`, level: 'warn' }); },
    engine(stage, name) { setStage(slug, stage, { engine: name }); },
    validateBible: async b => [...validate(SCHEMAS.bible, b), ...checkBible(b), ...lintBible(b).filter(i => i.level === 'error').map(i => `${i.where}: ${i.why} ("${i.match}")`)],
    decide: (sub, prompt, schema, opts) => decide(slug, sub, prompt, schema, signal, opts),
  };
  return ctx;
}

/** Runs the decide chain (claude → inbox, or the ad's own choice) for one question. */
async function decide(slug, stage, prompt, schema, signal, opts) {
  const p = project(slug), chain = p.decider ? [p.decider] : CFG.chains.decide;
  let lastErr = null;
  for (const name of chain) {
    const eng = DECIDERS[name]; if (!eng) continue;
    const a = await eng.available(CFG);
    const owner = STAGES.find(s => s.id === stage) ? stage : stage.replace(/-.*/, ''), known = STAGES.some(s => s.id === owner);
    if (!a.ok) { if (known) context(slug).fallback(owner, name, a.why); else emit('engine', { slug, stage, engine: name, text: `${name} unavailable: ${a.why} → next`, level: 'warn' }); continue; }
    try {
      if (known) context(slug).engine(owner, name);
      return await eng.decide(CFG, { slug, adDir: adDir(slug), stage, prompt, schema, signal, opts });
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e; if (known) context(slug).fallback(owner, name, e.message.slice(0, 300)); else emit('engine', { slug, stage, engine: name, text: e.message.slice(0, 300), level: 'warn' });
    }
  }
  throw lastErr || new Error('no decision engine available');
}

async function runDecision(slug, st, signal, note) {
  const ctx = context(slug, signal), schema = SCHEMAS[st.schema];
  let prompt = st.prompt(ctx) + `\n\nAnswer with JSON matching the schema. Put your reasoning in the "reason" field${st.id === 'bible' ? '' : ' (two or three sentences)'}.`;
  if (note) prompt += `\n\nThe user asked for a redo with this note: "${note}". Follow it.`;
  let res = await decide(slug, st.id, prompt, schema, signal), problems = issues(st, res.output);
  if (problems.errors.length) {
    emit('decision', { slug, stage: st.id, kind: 'repair', text: problems.errors.slice(0, 6).join(' · ') });
    res = await decide(slug, st.id, `Your answer for stage ${st.id} has these problems:\n- ${problems.errors.join('\n- ')}\nReturn the corrected complete answer (same schema).`, schema, signal);
    problems = issues(st, res.output);
    if (problems.errors.length) throw new Error(`still invalid after one repair: ${problems.errors.slice(0, 4).join('; ')}`);
  }
  const rec = { stage: st.id, at: now(), output: res.output, meta: res.meta, warnings: problems.warnings, note: note || undefined };
  writeJSON(decFile(slug, st.id), rec);
  if (st.id === 'brief') writeJSON(path.join(adDir(slug), 'brief.json'), res.output);
  if (st.id === 'bible') writeJSON(path.join(adDir(slug), 'bible.json'), { ...res.output, slug });
  if (st.id === 'style' && fs.existsSync(path.join(adDir(slug), 'bible.json'))) { const b = readJSON(path.join(adDir(slug), 'bible.json')); writeJSON(path.join(adDir(slug), 'bible.json'), { ...b, style: res.output.style }); }
  emit('decision', { slug, stage: st.id, kind: 'made', record: rec });
  return rec;
}

function issues(st, out) {
  const errors = validate(SCHEMAS[st.schema], out), warnings = [];
  if (st.lint) for (const i of (st.id === 'bible' ? lintBible(out) : lintObject(out))) (i.level === 'error' ? errors : warnings).push(`${i.where}: ${i.why} ("${i.match}")`);
  if (st.check === 'bible' && !errors.length) errors.push(...checkBible(out));
  if (st.check === 'direction' && !errors.length) errors.push(...checkDirection(out));
  if (st.id === 'premises' && out.premises && !out.premises.some(p => p.id === out.chosen)) errors.push('chosen is not one of the premise ids');
  return { errors, warnings };
}

// ---------- running ----------
const idx = id => STAGES.findIndex(s => s.id === id);
export const isRunning = slug => jobs.has(slug);

export async function runFrom(slug, startId = null, { note } = {}) {
  if (jobs.has(slug)) throw new Error('this ad is already running');
  const ac = new AbortController(), job = { ac, stage: null };
  jobs.set(slug, job);
  emit('job', { slug, kind: 'start', from: startId });
  try {
    const p0 = project(slug);
    let i = startId ? idx(startId) : STAGES.findIndex(s => p0.stages[s.id]?.status !== 'done');
    if (i < 0) { emit('job', { slug, kind: 'idle', text: 'all stages done' }); return; }
    for (; i < STAGES.length; i++) {
      const st = STAGES[i], cur = project(slug).stages[st.id] || { status: 'idle' };
      if (cur.status === 'done') continue;
      if (st.optional && i !== idx(startId)) { setStage(slug, st.id, { status: 'offer' }); emit('gate', { slug, stage: st.id, kind: 'offer', text: `${st.title} is optional${st.paid ? ' and paid' : ''}: start it from its card` }); break; }
      if (cur.status === 'gate' || cur.status === 'review') break;
      job.stage = st.id;
      const t0 = Date.now();
      setStage(slug, st.id, { status: 'running', started: now(), error: null, fallbacks: [], engine: null });
      let result;
      try {
        if (st.kind === 'decide') {
          const rec = await runDecision(slug, st, ac.signal, i === idx(startId) ? note : undefined);
          result = { summary: summaryOf(st.id, rec.output), warnings: rec.warnings };
          if (st.after === 'report') result.report = writeReport(context(slug));
        } else {
          const r = await AUTO[st.id](context(slug, ac.signal));
          result = r;
          writeJSON(path.join(adDir(slug), 'decisions', `${String(st.n).padStart(2, '0')}-${st.id}.result.json`), { stage: st.id, at: now(), ...r });
        }
      } catch (e) {
        setStage(slug, st.id, { status: ac.signal.aborted ? 'idle' : 'error', error: e.message, ms: Date.now() - t0 });
        emit('job', { slug, kind: ac.signal.aborted ? 'cancelled' : 'error', stage: st.id, text: e.message });
        return;
      }
      const p = project(slug);
      const stop = st.gate && !p.autoGates ? 'gate' : (p.mode === 'step' && st.kind === 'decide') ? 'review' : 'done';
      setStage(slug, st.id, { status: stop, finished: now(), ms: Date.now() - t0, summary: result.summary, warnings: result.warnings || [], result: slim(result) });
      if (st.gate && p.autoGates) emit('gate', { slug, stage: st.id, kind: 'auto-approved' });
      if (stop !== 'done') { emit('gate', { slug, stage: st.id, kind: stop, text: result.summary }); break; }
    }
  } finally {
    jobs.delete(slug);
    emit('job', { slug, kind: 'end' });
  }
}
const slim = r => { const o = { ...r }; delete o.summary; delete o.warnings; return JSON.parse(JSON.stringify(o)); };

function summaryOf(id, o) {
  switch (id) {
    case 'brief': return `${o.product?.name}: ${o.product?.what}`;
    case 'premises': return (o.premises || []).find(p => p.id === o.chosen)?.logline || '';
    case 'hooks': return `lead ${o.lead}: "${(o.hooks || []).find(h => h.id === o.lead)?.onScreen}"`;
    case 'story': return `${o.emotion} · turn: ${o.turn}`;
    case 'brandmap': return `reveal at ${o.reveal?.t}s · tag "${o.tag?.line}"`;
    case 'style': return o.style;
    case 'direction': return `${(o.shots || []).length} shots · ${o.lens && o.lens !== 'none' ? o.lens + ' lens · ' : ''}${o.thesis}`;
    case 'bible': return `${(o.shots || []).length} shots, ${(o.vo?.lines || []).length} voice lines, ${o.dur}s`;
    case 'scorecard': return `${o.total}/35 · ${o.verdict}`;
    default: return '';
  }
}

/** Approve a gate or a review; `choice` overrides Claude's pick (premise id, hook letter, style slug). */
export async function approve(slug, id, { choice } = {}) {
  const st = STAGES.find(s => s.id === id); if (!st) throw new Error('no such stage');
  if (choice !== undefined && st.kind === 'decide') {
    const rec = readDecision(slug, id); const key = { premises: 'chosen', hooks: 'lead', style: 'style' }[id];
    if (rec && key && rec.output[key] !== choice) {
      rec.output[key] = choice; rec.overriddenBy = 'user'; rec.overriddenAt = now(); writeJSON(decFile(slug, id), rec);
      if (id === 'style' && fs.existsSync(path.join(adDir(slug), 'bible.json'))) { const b = readJSON(path.join(adDir(slug), 'bible.json')); writeJSON(path.join(adDir(slug), 'bible.json'), { ...b, style: choice }); }
      markStale(slug, id, id === 'style' ? ['frames', 'animatic', 'final', 'scorecard'] : null);
      emit('decision', { slug, stage: id, kind: 'override', choice });
    }
  }
  setStage(slug, id, { status: 'done', approvedAt: now() });
  emit('gate', { slug, stage: id, kind: 'approved' });
  if (!jobs.has(slug)) runFrom(slug).catch(e => emit('job', { slug, kind: 'error', text: e.message }));
}

export function markStale(slug, id, only = null) {
  const i = idx(id);
  saveProject(slug, p => { for (const s of STAGES.slice(i + 1)) if ((!only || only.includes(s.id)) && p.stages[s.id].status !== 'idle') p.stages[s.id].status = 'stale'; });
  for (const s of STAGES.slice(i + 1)) emit('stage', { slug, stage: s.id, state: project(slug).stages[s.id] });
}

export async function redo(slug, id, { note } = {}) {
  if (jobs.has(slug)) throw new Error('this ad is running: cancel first');
  setStage(slug, id, { status: 'idle' });
  markStale(slug, id);
  runFrom(slug, id, { note }).catch(e => emit('job', { slug, kind: 'error', text: e.message }));
}

export function cancel(slug) { const j = jobs.get(slug); if (j) j.ac.abort(); return !!j; }
export function setMode(slug, patch) { return saveProject(slug, p => Object.assign(p, patch)); }

/** Ask the decide chain (Claude CLI → inbox) a question outside the 12 stages, e.g. the shot board's prompts. */
export const decideFor = (slug, stage, prompt, schema, signal, opts) => decide(slug, stage, prompt, schema, signal, opts);
