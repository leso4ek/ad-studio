// Ad Studio · engine "openclip": OpenClip (linzzzzzz/openclip, MIT) as its own tool in ~/openclip
// (studio/scripts/install_openclip.sh). For normal videos (podcasts, talks) it transcribes, has an LLM score segments
// for content, interaction and entertainment value, ranks them and fixes their boundaries; we read its
// top_engaging_moments.json and render the clips ourselves (the edit engine). Our clip rubric steers it through
// --user-intent (its own prompt files stay untouched). LLM: OpenRouter, a cheap model, spend measured on the key.
import fs from 'fs';
import path from 'path';
import os from 'os';
import { run, loadEnv } from '../util.mjs';
import { emit } from '../bus.mjs';
import * as orx from './openrouter.mjs';
import { usageUsd } from './mirofish.mjs';

const conf = cfg => ({ dir: path.join(os.homedir(), 'openclip'), model: 'deepseek/deepseek-v4.1-flash-1017', clipLength: '30_60', maxClips: 8, ...(cfg.openclip || {}) });
const uvBin = () => [path.join(os.homedir(), '.local', 'bin', 'uv'), 'uv'].find(b => b === 'uv' || fs.existsSync(b));

export async function available(cfg) {
  const c = conf(cfg);
  if (cfg.openclip?.mock || process.env.ADSTUDIO_MOCK === '1') return { ok: true, detail: 'mock mode' };
  if (!fs.existsSync(path.join(c.dir, 'video_orchestrator.py'))) return { ok: false, why: `OpenClip not installed in ${c.dir} (studio/scripts/install_openclip.sh)` };
  if (!fs.existsSync(path.join(c.dir, '.venv', 'bin', 'python'))) return { ok: false, why: 'OpenClip dependencies missing (uv sync in ~/openclip)' };
  if (!(loadEnv().OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY)) return { ok: false, why: 'OPENROUTER_API_KEY not set (studio/.env)' };
  return { ok: true, detail: `${c.dir} · ${c.model}` };
}

const hms = s => String(s).split(':').map(Number).reduce((a, b) => a * 60 + b, 0);
/** OpenClip's top_engaging_moments.json → candidates [{id, t0, t1, title, why, tags, rank, source}] */
export function parseMoments(json) {
  return (json.top_engaging_moments || []).map((m, i) => {
    const t = m.timing || {}, t0 = hms(m.start_time || t.start_time || '0'), t1 = hms(m.end_time || t.end_time || '0');
    return { id: `o${m.rank || i + 1}`, t0, t1, title: m.title || '', why: m.why_engaging || m.summary || '', tags: m.tags || [], rank: m.rank || i + 1, source: 'openclip' };
  }).filter(c => c.t1 > c.t0);
}
const findFile = (dir, name) => { for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) { const p = path.join(dir, e.name); if (e.isFile() && e.name === name) return p; if (e.isDirectory()) { const f = findFile(p, name); if (f) return f; } } return null; };

/** Runs OpenClip's analysis on a local video (no clips, no covers: we render). Returns candidates. */
export async function moments(cfg, src, outDir, { intent = '', maxClips, slug, signal } = {}) {
  const c = conf(cfg); fs.mkdirSync(outDir, { recursive: true });
  if (cfg.openclip?.mock || process.env.ADSTUDIO_MOCK === '1') {
    const mock = { top_engaging_moments: [{ rank: 1, title: 'Mock moment', start_time: '00:00:02', end_time: '00:00:12', why_engaging: 'mock', tags: ['mock'] }] };
    fs.writeFileSync(path.join(outDir, 'top_engaging_moments.json'), JSON.stringify(mock)); return parseMoments(mock);
  }
  const before = await usageUsd({ usageUrl: 'https://openrouter.ai/api/v1/key' }).catch(() => null);
  const args = ['run', 'python', 'video_orchestrator.py', path.resolve(src), '-o', path.resolve(outDir), '--llm-provider', 'openrouter', '--llm-model', c.model, '--language', 'en',
    '--max-clips', String(maxClips || c.maxClips), '--clip-length', c.clipLength, '--skip-clips', '--skip-cover', ...(intent ? ['--user-intent', intent.slice(0, 600)] : [])];
  const env = { OPENROUTER_API_KEY: loadEnv().OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '' };
  const r = await run(uvBin(), args, { cwd: c.dir, env, signal, onLine: l => /phase|clip|moment|transcri|error/i.test(l) && emit('engine', { slug, stage: 'clip-find', engine: 'openclip', text: l.trim().slice(0, 200) }) });
  const after = await usageUsd({ usageUrl: 'https://openrouter.ai/api/v1/key' }).catch(() => null);
  const cost = before !== null && after !== null ? +(after - before).toFixed(4) : null;
  orx.record({ kind: 'openclip', job: `openclip-${Date.now()}`, status: 'completed', cost: cost ?? 0, estimate: cost ?? 0.05, slug, what: `${slug} OpenClip analysis` });
  const f = findFile(outDir, 'top_engaging_moments.json');
  if (r.code !== 0 && !f) throw new Error(`OpenClip failed: ${(r.err || r.out).split('\n').filter(Boolean).slice(-5).join(' | ').slice(0, 500)}`);
  if (!f) throw new Error('OpenClip finished without top_engaging_moments.json');
  emit('engine', { slug, stage: 'clip-find', engine: 'openclip', text: `OpenClip ranked its moments${cost !== null ? ` ($${cost.toFixed(3)})` : ''}` });
  return parseMoments(JSON.parse(fs.readFileSync(f, 'utf8')));
}
