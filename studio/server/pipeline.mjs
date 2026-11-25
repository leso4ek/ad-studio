// Ad Studio · the runner. One job per ad; stages run in order until a gate, a review (step mode) or an error.
// Every state change is written to ads/<slug>/project.json and emitted to the app.
import fs from 'fs';
import path from 'path';
import { STAGES, AUTO, checkBible, checkDirection, writeReport, lintBible, lintObject, appliesTo } from './stages.mjs';
import { FORMATS, RECREATE_MODES } from './schemas.mjs';
import * as MEM from './memory.mjs';
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
  MEM.initMemory(cfg);
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

export function createAd({ name, brief = {}, mode = 'autopilot', autoGates = false, decider, format = 'story-ad', recreate, parent, episode, slug: wanted }) {
  if (!FORMATS.includes(format)) throw new Error(`unknown format ${format}`);
  if (recreate?.mode && !RECREATE_MODES.includes(recreate.mode)) throw new Error(`unknown recreate mode ${recreate.mode}`);
  let slug = wanted || slugify(name || brief.product || brief.topic || brief.idea || 'new-ad'), k = 2;
  const base = slug; while (fs.existsSync(adDir(slug))) slug = `${base}-${k++}`;
  fs.mkdirSync(path.join(adDir(slug), 'decisions'), { recursive: true });
  const p = { slug, title: name || 'New ad', created: now(), updated: now(), mode, autoGates, decider: decider || null, format, ...(parent ? { parent, episode } : {}), ...(format === 'recreate' ? { recreate: { mode: 'remake', target: 'story-ad', rights: false, refs: [], prompt: {}, ...(recreate || {}) } } : {}), userBrief: brief, stages: Object.fromEntries(STAGES.map(s => [s.id, { status: 'idle' }])) };
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
    // a child project (short-drama episode) that inherits the parent's decider, mode and gates; reused when it exists
    createChild({ suffix, ...o }) {
      const p = project(slug), want = `${slug}-${suffix}`;
      if (fs.existsSync(pj(want))) return project(want);
      return createAd({ ...o, slug: want, parent: slug, mode: p.mode, autoGates: p.autoGates, decider: p.decider });
    },
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
  const ctx = context(slug, signal), schema = SCHEMAS[st.schemaFor?.(ctx.project) || st.schema];
  let prompt = st.prompt(ctx) + `\n\nAnswer with JSON matching the schema. Put your reasoning in the "reason" field${st.id === 'bible' ? '' : ' (two or three sentences)'}.`;
  if (note) prompt += `\n\nThe user asked for a redo with this note: "${note}". Follow it.`;
  // hindsight memory: the best lessons from past ads for this stage (≤ ~600 tokens)
  const memOn = CFG.memory?.enabled !== false, brief = readJSON(path.join(adDir(slug), 'brief.json'), {}), styleNow = readDecision(slug, 'style')?.output?.style;
  const mem = memOn ? MEM.recall(st.id, { style: styleNow, product: brief.product?.what, context: `${brief.audience?.who || ''} ${brief.tone || ''}` }) : { text: '', ids: [] };
  if (mem.text) prompt += `\n\n${mem.text}`;
  const fixed = st.fixed?.(ctx);
  let res = fixed ? { output: fixed, meta: { engine: 'format' } } : await decide(slug, st.id, prompt, schema, signal);
  if (st.post) res.output = st.post(ctx, res.output);
  let problems = issues(st, res.output, ctx.project);
  if (problems.errors.length) {
    if (memOn) MEM.logSignal({ ad: slug, stage: st.id, kind: 'repair', value: problems.errors.length, note: problems.errors.slice(0, 3).join('; ') });
    emit('decision', { slug, stage: st.id, kind: 'repair', text: problems.errors.slice(0, 6).join(' · ') });
    res = await decide(slug, st.id, `Your answer for stage ${st.id} has these problems:\n- ${problems.errors.join('\n- ')}\nReturn the corrected complete answer (same schema).`, schema, signal);
    if (st.post) res.output = st.post(ctx, res.output);
    problems = issues(st, res.output, ctx.project);
    if (problems.errors.length) throw new Error(`still invalid after one repair: ${problems.errors.slice(0, 4).join('; ')}`);
  }
  const rec = { stage: st.id, at: now(), output: res.output, meta: { ...(res.meta || {}), lessons: mem.ids.length ? mem.ids : undefined }, warnings: problems.warnings, note: note || undefined };
  if (memOn) MEM.logEpisode({ ad: slug, stage: st.id, output: res.output, style: styleNow, product: brief.product?.what, attempt: MEM.episodes(slug).filter(e => e.type === 'episode' && e.stage === st.id).length + 1, note, meta: rec.meta });
  writeJSON(decFile(slug, st.id), rec);
  if (st.id === 'brief') writeJSON(path.join(adDir(slug), 'brief.json'), res.output);
  if (st.id === 'bible') writeJSON(path.join(adDir(slug), 'bible.json'), { ...res.output, slug });
  if (st.id === 'style' && fs.existsSync(path.join(adDir(slug), 'bible.json'))) { const b = readJSON(path.join(adDir(slug), 'bible.json')); writeJSON(path.join(adDir(slug), 'bible.json'), { ...b, style: res.output.style }); }
  emit('decision', { slug, stage: st.id, kind: 'made', record: rec });
  return rec;
}

function issues(st, out, proj = {}) {
  const errors = validate(SCHEMAS[st.schemaFor?.(proj) || st.schema], out), warnings = [];
  if (st.lint) for (const i of (st.id === 'bible' ? lintBible(out) : lintObject(out))) (i.level === 'error' ? errors : warnings).push(`${i.where}: ${i.why} ("${i.match}")`);
  if (st.check === 'bible' && !errors.length) errors.push(...checkBible({ format: proj.format, ...out }));
  if (st.check === 'direction' && !errors.length) errors.push(...checkDirection(out, undefined, proj.format));
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
    let i = startId ? idx(startId) : STAGES.findIndex(s => !['done', 'skipped'].includes(p0.stages[s.id]?.status) && appliesTo(s, p0));
    if (i < 0) { emit('job', { slug, kind: 'idle', text: 'all stages done' }); return; }
    for (; i < STAGES.length; i++) {
      const st = STAGES[i], cur = project(slug).stages[st.id] || { status: 'idle' };
      if (!appliesTo(st, project(slug))) { if (cur.status !== 'skipped') setStage(slug, st.id, { status: 'skipped' }); continue; }
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
          if (st.id === 'scorecard' && CFG.memory?.enabled !== false) await learn(slug, () => MEM.signalsFromScorecard(slug, rec.output), ac.signal);
        } else {
          const r = await AUTO[st.id](context(slug, ac.signal));
          result = r;
          if (CFG.memory?.enabled !== false) autoSignals(slug, st.id, r);
          writeJSON(path.join(adDir(slug), 'decisions', `${String(st.n).padStart(2, '0')}-${st.id}.result.json`), { stage: st.id, at: now(), ...r });
        }
      } catch (e) {
        setStage(slug, st.id, { status: ac.signal.aborted ? 'idle' : 'error', error: e.message, ms: Date.now() - t0 });
        emit('job', { slug, kind: ac.signal.aborted ? 'cancelled' : 'error', stage: st.id, text: e.message });
        return;
      }
      const p = project(slug);
      const stop = st.gate && !p.autoGates && !(st.fixed && st.fixed(context(slug))) ? 'gate' : (p.mode === 'step' && st.kind === 'decide') ? 'review' : 'done';
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
    case 'analysis': return `${o.kind} · ${(o.shots || []).length} shots · recommends ${o.recommend?.mode} as ${o.recommend?.target}`;
    case 'brief': return o.topic ? `${o.topic} · ${o.question}` : `${o.product?.name}: ${o.product?.what}`;
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
/** Outcome signals from the automatic stages (free: no model call). */
function autoSignals(slug, id, r) {
  if (id === 'animatic' && r.checks) for (const [k, v] of Object.entries(r.checks)) MEM.logSignal({ ad: slug, stage: 'bible', kind: 'check', value: !!v, note: `${k} ${v ? 'pass' : 'FAIL'}` });
  if (id === 'frames' && r.review) MEM.logSignal({ ad: slug, stage: 'direction', kind: 'review', value: (r.review.notes || []).length, note: (r.review.notes || []).map(n => n.issue).join('; ') || 'approved as drawn' });
  if (id === 'voice' && r.check) MEM.logSignal({ ad: slug, stage: 'bible', kind: 'check', value: r.check.pass !== false, note: `speech check ${r.check.pass === false ? 'FAIL' : 'pass'}` });
}
/** Turns an ad's outcome into lessons (hindsight relabel). Never fails the stage it follows. */
export async function learn(slug, addSignals, signal) {
  try {
    addSignals?.();
    const r = await MEM.relabel(slug, decideFor, signal);
    emit('engine', { slug, stage: 'memory', engine: 'memory', text: `hindsight memory: ${r.added} new lesson(s), ${r.total} in total` });
    return r;
  } catch (e) { emit('engine', { slug, stage: 'memory', engine: 'memory', text: `hindsight memory skipped: ${e.message.slice(0, 200)}`, level: 'warn' }); return null; }
}

export async function approve(slug, id, { choice } = {}) {
  const st = STAGES.find(s => s.id === id); if (!st) throw new Error('no such stage');
  if (choice !== undefined && st.kind === 'decide') {
    const rec = readDecision(slug, id); const key = { premises: 'chosen', hooks: 'lead', style: 'style' }[id];
    if (rec && key && rec.output[key] !== choice) {
      rec.output[key] = choice; rec.overriddenBy = 'user'; rec.overriddenAt = now(); writeJSON(decFile(slug, id), rec);
      if (id === 'style' && fs.existsSync(path.join(adDir(slug), 'bible.json'))) { const b = readJSON(path.join(adDir(slug), 'bible.json')); writeJSON(path.join(adDir(slug), 'bible.json'), { ...b, style: choice }); }
      markStale(slug, id, id === 'style' ? ['frames', 'animatic', 'final', 'scorecard'] : null);
      emit('decision', { slug, stage: id, kind: 'override', choice });
      if (CFG.memory?.enabled !== false) MEM.logSignal({ ad: slug, stage: id, kind: 'override', value: 1, note: `user chose ${choice} instead of Claude's pick` });
    }
  }
  if (CFG.memory?.enabled !== false && (st.kind === 'decide' || st.gate)) MEM.logSignal({ ad: slug, stage: id === 'frames' ? 'direction' : id === 'animatic' ? 'bible' : id, kind: 'approved', value: 1 });
  setStage(slug, id, { status: 'done', approvedAt: now() });
  emit('gate', { slug, stage: id, kind: 'approved' });
  if (!jobs.has(slug)) runFrom(slug).catch(e => emit('job', { slug, kind: 'error', text: e.message }));
}

export function markStale(slug, id, only = null) {
  const i = idx(id);
  saveProject(slug, p => { for (const s of STAGES.slice(i + 1)) if ((!only || only.includes(s.id)) && p.stages[s.id] && !['idle', 'skipped'].includes(p.stages[s.id].status)) p.stages[s.id].status = 'stale'; });
  for (const s of STAGES.slice(i + 1)) emit('stage', { slug, stage: s.id, state: project(slug).stages[s.id] });
}

export async function redo(slug, id, { note } = {}) {
  if (jobs.has(slug)) throw new Error('this ad is running: cancel first');
  if (CFG.memory?.enabled !== false) MEM.logSignal({ ad: slug, stage: id, kind: 'redo', value: 1, note: note || 'redo without a note' });
  setStage(slug, id, { status: 'idle', note: note || null });   // automatic stages (the edit plan) read their redo note here
  markStale(slug, id);
  runFrom(slug, id, { note }).catch(e => emit('job', { slug, kind: 'error', text: e.message }));
}

export function cancel(slug) { const j = jobs.get(slug); if (j) j.ac.abort(); return !!j; }
export function setMode(slug, patch) { return saveProject(slug, p => Object.assign(p, patch)); }

/** Ask the decide chain (Claude CLI → inbox) a question outside the 12 stages, e.g. the shot board's prompts. */
export const decideFor = (slug, stage, prompt, schema, signal, opts) => decide(slug, stage, prompt, schema, signal, opts);

/** recreate: store the upload (video, reference images) under ads/<slug>/source/ and update project.recreate */
export function saveSource(slug, { kind, name, buf, label, role }) {
  const dir = path.join(adDir(slug), 'source', kind === 'video' ? '' : kind === 'refvideo' ? 'refvideos' : 'refs'); fs.mkdirSync(dir, { recursive: true });
  const ext = (path.extname(name || '').toLowerCase() || (kind === 'video' ? '.mp4' : '.png')).replace(/[^.a-z0-9]/g, '');
  if (kind !== 'ref' && !['.mp4', '.mov', '.webm', '.m4v'].includes(ext)) throw new Error('upload an MP4, MOV or WebM video');
  if (kind === 'ref' && !['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) throw new Error('reference images must be PNG, JPEG or WebP');
  const base = kind === 'video' ? `original${ext}` : kind === 'refvideo' ? `ref-${Date.now().toString(36)}${ext}` : `${slugify(path.basename(name || 'ref', path.extname(name || ''))).slice(0, 32) || 'ref'}-${Date.now().toString(36)}${ext}`;
  fs.writeFileSync(path.join(dir, base), buf);
  const rel = path.relative(adDir(slug), path.join(dir, base));
  return saveProject(slug, p => {
    p.recreate ||= { mode: 'remake', target: 'story-ad', rights: false, refs: [], prompt: {} };
    if (kind === 'video') { p.recreate.source = rel; for (const id of ['source', 'analysis', 'edit-plan']) if (p.stages[id]) p.stages[id].status = 'idle'; }
    else if (kind === 'refvideo') p.recreate.refVideos = [...(p.recreate.refVideos || []), rel].slice(-5);
    else p.recreate.refs = [...(p.recreate.refs || []), { file: rel, label: label || '', role: role || 'other' }].slice(-12);
  });
}
export function patchRecreate(slug, patch) {
  return saveProject(slug, p => {
    p.recreate ||= { refs: [], prompt: {} };
    for (const k of ['mode', 'target', 'rights', 'style', 'seedanceStyle', 'photoreal']) if (k in patch) p.recreate[k] = patch[k];
    if (patch.mode && !RECREATE_MODES.includes(patch.mode)) throw new Error('mode must be remake, transfer or mixed');
    if (patch.mode === 'transfer' && !(patch.rights ?? p.recreate.rights)) throw new Error('motion transfer reuses the footage: tick "I own this video or have the rights to it" first');
    if (patch.prompt) p.recreate.prompt = { ...(p.recreate.prompt || {}), ...patch.prompt };
    if (patch.removeRef) { p.recreate.refs = (p.recreate.refs || []).filter(r => r.file !== patch.removeRef); p.recreate.refVideos = (p.recreate.refVideos || []).filter(f => f !== patch.removeRef); }
    if (patch.refLabel) p.recreate.refs = (p.recreate.refs || []).map(r => r.file === patch.refLabel.file ? { ...r, label: patch.refLabel.label ?? r.label, role: patch.refLabel.role ?? r.role } : r);
  });
}

/** short-drama series: its episodes in order, with a status line each */
export function episodesOf(slug) {
  return listAds().map(a => project(a.slug)).filter(p => p?.parent === slug).sort((a, b) => a.episode - b.episode)
    .map(p => ({ slug: p.slug, episode: p.episode, title: p.title, running: jobs.has(p.slug), done: Object.entries(p.stages).filter(([, s]) => ['done', 'skipped'].includes(s.status)).length,
      waiting: Object.entries(p.stages).find(([, s]) => ['gate', 'review', 'error'].includes(s.status))?.[0] || null, final: fs.existsSync(path.join(adDir(p.slug), 'out', `${p.slug}-9x16.mp4`)) ? `out/${p.slug}-9x16.mp4` : null }));
}
/** run the episodes one after another (each stops at its gates like any video); all = keep going after one finishes */
export async function runSeries(slug, { all = true } = {}) {
  for (const e of episodesOf(slug)) {
    const p = project(e.slug), open = Object.values(p.stages).some(s => !['done', 'skipped', 'offer'].includes(s.status));
    if (!open) continue;
    if (jobs.has(e.slug)) return;
    await runFrom(e.slug);
    const after = project(e.slug);
    if (Object.values(after.stages).some(s => ['gate', 'review', 'error'].includes(s.status)) || !all) return;
  }
}
