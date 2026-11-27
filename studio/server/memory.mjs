// Ad Studio · hindsight experience memory: Claude gets better from ad to ad.
// The idea is Hindsight Experience Replay (Andrychowicz et al. 2017; reference implementation mfornet/hindsight-experience-replay):
// an attempt that misses its goal is replayed a second time with a goal it DID reach, so failures still teach.
// Claude has no weights to train, so the "replay buffer" here is text that is retrieved into later prompts:
//   1. EPISODES (by code, free): every stage decision with its goal, a digest of the action and outcome SIGNALS that
//      the app already produces (repairs, failed checks, redo notes, overrides, approvals, frame-review notes,
//      scorecard rules, audience scores, shot-board picks).
//   2. RELABEL (one lean Claude call per ad, after the scorecard or an audience test): each episode becomes
//      transitions — real goal ("aimed at G, got r: do/avoid X"), hindsight goal ("this action reliably gives G′:
//      use it when G′ is wanted") and future goal (a later redo in the same ad is the positive example for the
//      earlier attempt) — stored as LESSONS with counts and provenance.
//   3. REPLAY: before each decision the top lessons for that stage (≤ ~600 tokens) go into the prompt.
//   4. RULES: a lesson seen in 3+ different ads becomes a PROPOSAL; only the user's approval writes it into the skill.
// Files (committed, so the PC and the cloud share one memory): studio/memory/{episodes,lessons}.jsonl, proposals.json
import fs from 'fs';
import os from 'os';
import path from 'path';
import { STUDIO, REPO, readJSON, writeJSON, now } from './util.mjs';

let DIR = null;
const defaultDir = (cfg = {}) => process.env.ADSTUDIO_MEMORY_DIR || (process.env.NODE_TEST_CONTEXT && path.join(os.tmpdir(), `adstudio-memory-test-${process.pid}`)) || (cfg.memory?.dir ? path.resolve(STUDIO, cfg.memory.dir) : path.join(STUDIO, 'memory'));
export function initMemory(cfg = {}) { DIR = defaultDir(cfg); fs.mkdirSync(DIR, { recursive: true }); return DIR; }
export const memDir = () => (DIR ||= defaultDir());
const F = n => path.join(memDir(), n);
const readLines = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
const append = (f, o) => { fs.mkdirSync(memDir(), { recursive: true }); fs.appendFileSync(f, JSON.stringify(o) + '\n'); };

// ---------------------------------------------------------------- goals per stage (what "success" means)
export const GOALS = {
  brief: 'honest, provable claims a viewer believes (scorecard rule 7 ≥ 4; audience trust ≥ 4)',
  premises: 'a premise where the product causes the turn and viewers identify with the character (rules 3-4 ≥ 4)',
  hooks: 'the first 1-3 s stop the scroll (rule 1 ≥ 4; audience stopScroll ≥ 4)',
  story: 'all five acts, one emotion, a character we identify with (rules 2, 3, 6 ≥ 4; audience watchThrough ≥ 4)',
  brandmap: 'planted, pulsed, revealed and tagged so the name is remembered (rule 5 ≥ 4; audience brandRecall ≥ 4)',
  style: 'a style that fits the product and emotion, approved without override',
  direction: 'every shot reads without sound, varied coverage, motion in the first 0.3 s (frame review clean; rules 1, 4 ≥ 4)',
  bible: 'a bible that passes every check first time and implements the direction (no repairs; readcheck and safe zones pass)',
  scorecard: 'an honest score that matches what viewers do',
  production: 'Seedance takes consistent with the elements (character, product, place) on the first draft, at the lowest spend',
};
// which scorecard rules / audience scores speak about which stage
const RULE_STAGE = { 1: ['hooks', 'direction'], 2: ['story'], 3: ['story', 'premises'], 4: ['story', 'direction', 'premises'], 5: ['brandmap'], 6: ['story'], 7: ['brief'] };
const AUD_STAGE = { stopScroll: ['hooks', 'direction'], watchThrough: ['story', 'direction'], brandRecall: ['brandmap'], trust: ['brief'], clickIntent: ['brandmap', 'brief'] };

// ---------------------------------------------------------------- digests (short, so a whole ad fits in one relabel call)
const clip = (s, n = 400) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export function digest(stage, o = {}) {
  switch (stage) {
    case 'brief': return clip(`${o.product?.name}: ${o.product?.what} | claims: ${(o.claims || []).join('; ')} | tone: ${o.tone}`);
    case 'premises': { const p = (o.premises || []).find(x => x.id === o.chosen) || {}; return clip(`chose: ${p.logline || o.chosen}`); }
    case 'hooks': return clip((o.hooks || []).map(h => `${h.id}${h.id === o.lead ? '*' : ''} [${h.type}] "${h.onScreen}" — ${h.visual}`).join(' | '));
    case 'story': return clip(`emotion ${o.emotion}; turn: ${o.turn}; acts: ${(o.acts || []).map(a => a.name).join(' → ')}`);
    case 'brandmap': return clip(`plant ${o.plant?.t}s, pulses ${(o.pulses || []).map(p => p.t).join('/')}, reveal ${o.reveal?.t}s (${o.reveal?.how}), tag "${o.tag?.line}"`);
    case 'style': return clip(`${o.style}; ${o.reason}`);
    case 'direction': return clip(`thesis: ${o.thesis}; ${o.lens && o.lens !== 'none' ? `lens ${o.lens}; ` : ''}shots: ${(o.shots || []).map(s => `${s.size} ${s.subject}${s.move && s.move !== 'static' ? ' ' + s.move : ''}`).join(', ')}`, 500);
    case 'bible': return clip(`${(o.shots || []).length} shots (${(o.shots || []).map(s => s.camera?.size || s.beat).join(', ')}); cards: ${(o.shots || []).flatMap(s => (s.layers || []).filter(l => l.type === 'text').map(l => `"${String(l.text).replace(/\n/g, ' ')}"`)).join(' ')}; vo lines ${(o.vo?.lines || []).length}`, 500);
    case 'scorecard': return clip(`${o.total}/35; fixes: ${(o.fixes || []).join('; ')}`);
    default: return clip(JSON.stringify(o), 300);
  }
}

// ---------------------------------------------------------------- 1. episodes and signals (by code)
export function logEpisode({ ad, stage, output, style, product, attempt = 1, note, meta }) {
  const e = { type: 'episode', id: `${ad}:${stage}:${Date.now().toString(36)}`, at: now(), ad, stage, goal: GOALS[stage] || '', style: style || null, product: product || null,
    attempt, action: digest(stage, output), note: note || undefined, lessonsUsed: meta?.lessons || undefined };
  append(F('episodes.jsonl'), e);
  return e;
}
/** kind: repair | check | redo | override | approved | review | rule | audience | pick | reject; value: number or bool */
export function logSignal({ ad, stage, kind, value, note }) {
  const s = { type: 'signal', at: now(), ad, stage, kind, value: value ?? null, note: note ? clip(note, 300) : undefined };
  append(F('episodes.jsonl'), s);
  return s;
}
export function signalsFromScorecard(ad, sc) {
  for (const r of sc?.scores || []) {
    const n = +String(r.rule).match(/^\d/)?.[0];
    for (const stage of RULE_STAGE[n] || []) logSignal({ ad, stage, kind: 'rule', value: r.score, note: `${r.rule}: ${r.note}` });
  }
}
export function signalsFromAudience(ad, v) {
  for (const [k, stages] of Object.entries(AUD_STAGE)) if (v?.scores?.[k] != null) for (const stage of stages) logSignal({ ad, stage, kind: 'audience', value: v.scores[k], note: `${k} ${v.scores[k]}/5` });
  if (v?.fixes?.length) logSignal({ ad, stage: 'audience', kind: 'fixes', note: v.fixes.slice(0, 4).join(' | ') });  // once, not on every signal
}
export const episodes = ad => readLines(F('episodes.jsonl')).filter(e => !ad || e.ad === ad);

/** A reward in [-1, 1] per stage of one ad, from its signals (shown in the Memory panel and given to the relabel call). */
export function rewards(ad) {
  const out = {};
  for (const s of episodes(ad).filter(e => e.type === 'signal')) {
    const r = out[s.stage] ||= { sum: 0, n: 0 };
    const v = s.kind === 'rule' || s.kind === 'audience' ? (s.value - 3) / 2 : s.kind === 'approved' ? .5 : s.kind === 'check' ? (s.value ? .3 : -.7)
      : s.kind === 'repair' ? -.5 : s.kind === 'redo' || s.kind === 'override' || s.kind === 'reject' ? -1 : s.kind === 'pick' ? .5 : s.kind === 'review' ? -.3 : 0;
    r.sum += v; r.n++;
  }
  return Object.fromEntries(Object.entries(out).map(([k, r]) => [k, +(r.sum / r.n).toFixed(2)]));
}

// ---------------------------------------------------------------- 2. hindsight relabel (one lean Claude call)
export const LESSONS_SCHEMA = {
  type: 'object', required: ['lessons', 'reason'],
  properties: {
    lessons: { type: 'array', minItems: 1, maxItems: 16, items: { type: 'object', required: ['stage', 'kind', 'goal', 'lesson', 'when'],
      properties: {
        stage: { type: 'string', enum: Object.keys(GOALS) },
        kind: { type: 'string', enum: ['real', 'hindsight', 'future'], description: 'real: the stage goal; hindsight: a goal the action DID reach; future: a later redo in the same ad is the positive example' },
        goal: { type: 'string', description: 'for hindsight: the goal this action actually achieved' },
        lesson: { type: 'string', description: 'one imperative sentence, concrete and reusable, under 30 words' },
        when: { type: 'string', description: 'when it applies: "any", or a style / product type / format' },
        evidence: { type: 'string' }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      } } },
    reason: { type: 'string' },
  },
};
export function relabelPrompt(ad) {
  const eps = episodes(ad), rw = rewards(ad);
  const byStage = {};
  for (const e of eps) (byStage[e.stage] ||= []).push(e);
  const lines = Object.entries(byStage).map(([stage, list]) => {
    const tries = list.filter(e => e.type === 'episode').map(e => `  attempt ${e.attempt}${e.note ? ` (redo note: "${e.note}")` : ''}: ${e.action}`);
    const sig = list.filter(e => e.type === 'signal').map(s => `  ${s.kind}${s.value != null ? ` ${s.value}` : ''}${s.note ? `: ${s.note}` : ''}`);
    return `[${stage}] goal: ${GOALS[stage] || '-'} · reward ${rw[stage] ?? 'n/a'}\n${[...tries, ...sig].join('\n')}`;
  }).join('\n');
  return `You keep Ad Studio's hindsight memory (Hindsight Experience Replay for an LLM). Do not read any files.
Below is one finished ad: per stage, its goal, Claude's attempts (digests) and the outcome signals (repairs, checks, user redo notes and overrides, approvals, frame-review notes, scorecard rule scores 1-5, simulated-audience scores 1-5).
Write 4-12 lessons a future ad can use:
- real: for a stage that missed its goal (reward < 0.5), what to do or avoid next time, concretely;
- hindsight: what an attempt DID achieve even if it missed its goal (e.g. "a strong brand label", "a calm pace"), as "to get <that>, <do this>" — relabel the outcome as the goal;
- future: when a later attempt in this ad fixed an earlier one, the later version is the positive example for the earlier goal.
Lessons must be reusable beyond this product (name the product only as an example), one imperative sentence each, and say when they apply. No lesson for a stage without evidence.

AD: ${ad}
${lines}`;
}
const tok = s => String(s || '').toLowerCase().match(/[a-z0-9一-鿿]+/g) || [];
const jacc = (a, b) => { const A = new Set(tok(a)), B = new Set(tok(b)); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };
/** Merge new lessons into lessons.jsonl (same stage + similar text = one lesson with a higher count). */
export function storeLessons(ad, list) {
  const all = lessons(), added = [];
  for (const l of list || []) {
    const hit = all.find(x => x.stage === l.stage && jacc(x.lesson, l.lesson) >= .55);
    if (hit) { hit.count++; if (!hit.ads.includes(ad)) hit.ads.push(ad); hit.updated = now(); if (l.kind === 'real' && hit.kind !== 'real') hit.kinds = [...new Set([...(hit.kinds || [hit.kind]), l.kind])]; }
    else { const n = { id: `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ...l, count: 1, ads: [ad], created: now(), updated: now() }; all.push(n); added.push(n); }
  }
  fs.mkdirSync(memDir(), { recursive: true });
  fs.writeFileSync(F('lessons.jsonl'), all.map(x => JSON.stringify(x)).join('\n') + (all.length ? '\n' : ''));
  propose();
  mirrorToHindsight(ad, list);
  return { added: added.length, total: all.length };
}

/**
 * When a Hindsight server is set (HINDSIGHT_URL, e.g. http://127.0.0.1:8888; bank HINDSIGHT_BANK, default
 * scifi-explainer-studio), new and updated lessons are also retained there, so every Claude session connected to the
 * bank's MCP server recalls them. Fire-and-forget: the app never waits on it or fails because of it.
 */
function mirrorToHindsight(ad, list) {
  const url = process.env.HINDSIGHT_URL; if (!url || !list?.length || process.env.NODE_TEST_CONTEXT) return;
  const bank = process.env.HINDSIGHT_BANK || 'scifi-explainer-studio';
  const items = list.map(l => ({
    content: `Ad Studio lesson (${l.kind}, stage ${l.stage}, confidence ${l.confidence}) from the ad "${ad}": ${l.lesson} When: ${l.when}. Goal: ${l.goal}. Evidence: ${l.evidence}`,
    context: 'learnings', timestamp: now(), tags: ['project:scifi-explainer-studio', 'lesson', `stage:${l.stage}`, `ad:${ad}`],
  }));
  fetch(`${url.replace(/\/$/, '')}/v1/default/banks/${bank}/memories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, async: true }) })
    .catch(() => { /* Hindsight is optional */ });
}
export const lessons = () => readLines(F('lessons.jsonl'));

/** Runs the relabel for one ad through the decide chain (lean call). */
export async function relabel(ad, decideFor, signal) {
  const res = await decideFor(ad, 'memory-relabel', relabelPrompt(ad), LESSONS_SCHEMA, signal, { fresh: true, noSkill: true, noTools: true, effort: 'low', maxTurns: 2 });
  return storeLessons(ad, res.output.lessons);
}

// ---------------------------------------------------------------- 3. replay: lessons for a prompt
function bm25(query, docs) {
  const q = new Set(tok(query)), T = docs.map(tok), n = docs.length || 1, avg = T.reduce((s, t) => s + t.length, 0) / n || 1, df = {};
  for (const t of T) for (const w of new Set(t)) df[w] = (df[w] || 0) + 1;
  return T.map(t => { const tf = {}; for (const w of t) tf[w] = (tf[w] || 0) + 1; let s = 0; for (const w of q) if (tf[w]) { const idf = Math.log(1 + (n - df[w] + .5) / (df[w] + .5)); s += idf * tf[w] * 2.4 / (tf[w] + 1.4 * (.25 + .75 * t.length / avg)); } return s; });
}
/** Top lessons for a stage: stage match, `when` match (style / product / any), BM25 on the goal + context, weighted by evidence. */
export function recall(stage, { style, product, context = '', k = 5, maxChars = 2400 } = {}) {
  const pool = lessons().filter(l => l.stage === stage && l.status !== 'rejected');
  if (!pool.length) return { text: '', ids: [] };
  const when = l => { const w = String(l.when || 'any').toLowerCase(); return w === 'any' || (style && w.includes(String(style).toLowerCase().replace(/^ad-/, ''))) || (product && tok(product).some(t => w.includes(t))) ? 1 : .55; };
  const rel = bm25(`${GOALS[stage] || ''} ${style || ''} ${product || ''} ${context}`, pool.map(l => `${l.lesson} ${l.goal || ''} ${l.when || ''}`));
  const conf = { high: 1.2, medium: 1, low: .8 };
  const scored = pool.map((l, i) => ({ l, s: (1 + rel[i]) * when(l) * Math.log(2 + l.count) * (conf[l.confidence] || 1) * (l.status === 'approved' ? 1.3 : 1) })).sort((a, b) => b.s - a.s);
  const out = []; let chars = 0;
  for (const { l } of scored) {
    const line = `- (${l.kind}${l.count > 1 ? `, seen in ${l.ads.length} ad${l.ads.length > 1 ? 's' : ''}` : ''}) ${l.lesson}${l.when && l.when !== 'any' ? ` [when: ${l.when}]` : ''}`;
    if (out.length >= k || chars + line.length > maxChars) break;
    out.push({ id: l.id, line }); chars += line.length;
  }
  return { text: out.length ? `LESSONS FROM PAST ADS (hindsight memory; follow them unless this brief clearly needs otherwise):\n${out.map(o => o.line).join('\n')}` : '', ids: out.map(o => o.id) };
}

// ---------------------------------------------------------------- 4. rules need the user's approval
export const proposals = () => readJSON(F('proposals.json'), []);
export function propose(minAds = 3) {
  const list = proposals(), known = new Set(list.map(p => p.lessonId));
  for (const l of lessons()) if (l.ads.length >= minAds && !known.has(l.id)) list.push({ id: `P${l.id}`, lessonId: l.id, stage: l.stage, rule: l.lesson, when: l.when, ads: l.ads, status: 'pending', created: now() });
  writeJSON(F('proposals.json'), list);
  return list.filter(p => p.status === 'pending');
}
const SKILL = () => path.join(REPO, 'skills', 'ad-studio-director', 'SKILL.md');
export function decide_(id, approve, skillFile = SKILL()) {
  const list = proposals(), p = list.find(x => x.id === id);
  if (!p) throw new Error('no such proposal');
  if (p.status !== 'pending') return p;
  p.status = approve ? 'approved' : 'rejected'; p.decided = now();
  writeJSON(F('proposals.json'), list);
  const all = lessons(), l = all.find(x => x.id === p.lessonId);
  if (l) { l.status = p.status; fs.writeFileSync(F('lessons.jsonl'), all.map(x => JSON.stringify(x)).join('\n') + '\n'); }
  if (approve) {
    let s = fs.readFileSync(skillFile, 'utf8');
    const head = '## Learned rules (approved by the user)';
    if (!s.includes(head)) s = s.trimEnd() + `\n\n${head}\nRules distilled from past ads by the hindsight memory (studio/memory) and approved in the app. They outrank defaults above when they apply.\n`;
    s = s.trimEnd() + `\n- **${p.stage}:** ${p.rule}${p.when && p.when !== 'any' ? ` (when: ${p.when})` : ''} — from ${p.ads.length} ads, approved ${p.decided.slice(0, 10)}\n`;
    fs.writeFileSync(skillFile, s);
  }
  return p;
}
export { decide_ as decideProposal };

export function summary() {
  const ep = episodes(), ls = lessons();
  return { dir: memDir(), episodes: ep.filter(e => e.type === 'episode').length, signals: ep.filter(e => e.type === 'signal').length, ads: [...new Set(ep.map(e => e.ad))],
    lessons: ls.sort((a, b) => b.count - a.count || (b.updated > a.updated ? 1 : -1)).slice(0, 60), proposals: proposals() };
}
