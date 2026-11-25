// Ad Studio · engine "higgsfield": Genjutsu video-to-video (Motion Transfer, Genjutsu Light, Object Swap) through the
// Higgsfield API, with the same estimate → cap → ledger discipline as the OpenRouter engine.
//   1. local files go up by presigned URL:  POST {api}/files/generate-upload-url {content_type, filename}
//        → {upload_url, content_type, upload_headers, public_url}; PUT the bytes to upload_url with upload_headers
//        (no Higgsfield credentials on that request; the content type must match)
//   2. submit:  POST {api}/{model path} {video_url, image_urls[1-8], prompt?, resolution}  → {request_id}
//   3. poll:    GET  {api}/requests/{request_id}/status  until a terminal state, then download the result video
// Auth: "Authorization: Key ID:SECRET" from HIGGSFIELD_KEY=id:secret in studio/.env (or HIGGSFIELD_API_KEY + HIGGSFIELD_SECRET).
// Prices (Nov 2026, per output second): 480p $0.154, 720p $0.34, 1080p $0.83. Source clips 4-30 s (Light: first 15 s).
// Mock mode (higgsfield.mock, or ADSTUDIO_MOCK=1) makes a tinted copy of the source segment and spends nothing.
import fs from 'fs';
import path from 'path';
import { loadEnv, run, sleep, ffmpeg7 } from '../util.mjs';
import { emit } from '../bus.mjs';
import * as orx from './openrouter.mjs';

export const RATE = { '480p': 0.154, '720p': 0.34, '1080p': 0.83 };
export const MODES = {
  'motion-transfer': { path: 'higgsfield/genjutsu/motion-transfer/v1.0', max: 30, label: 'Genjutsu Motion Transfer' },
  light: { path: 'higgsfield/genjutsu-light/motion-transfer/v1.0', max: 15, label: 'Genjutsu Light (keeps the audio, first 15 s)' },
  'object-swap': { path: 'higgsfield/genjutsu/object-swap/v1.0', max: 30, label: 'Genjutsu Object Swap' },
};
export const MIN_S = 4;
const TERMINAL_OK = ['completed', 'succeeded', 'success', 'done'];
const TERMINAL_BAD = ['failed', 'error', 'cancelled', 'canceled', 'nsfw', 'expired', 'rejected'];

const conf = cfg => ({ api: 'https://platform.higgsfield.ai', pollMs: 5000, timeoutMin: 40, ...(cfg.higgsfield || {}) });
export const mock = cfg => !!(cfg.higgsfield?.mock || process.env.ADSTUDIO_MOCK === '1');
export function credentials() {
  const env = { ...loadEnv(), ...process.env };
  if (env.HIGGSFIELD_KEY && env.HIGGSFIELD_KEY.includes(':')) return env.HIGGSFIELD_KEY;
  if (env.HIGGSFIELD_API_KEY && env.HIGGSFIELD_SECRET) return `${env.HIGGSFIELD_API_KEY}:${env.HIGGSFIELD_SECRET}`;
  return '';
}
const cap = cfg => cfg.budget?.higgsfieldCapUsd ?? 5;

/** Output seconds billed for a source clip: clamped to the mode's window. */
export const billedSeconds = (seconds, mode = 'motion-transfer') => Math.max(MIN_S, Math.min(MODES[mode]?.max ?? 30, Math.ceil(seconds)));
export const estimate = (seconds, resolution = '480p', mode = 'motion-transfer') => +(billedSeconds(seconds, mode) * (RATE[resolution] ?? RATE['720p'])).toFixed(3);

/** Money spent through this engine (completed jobs at their cost, in-flight jobs at their estimate). */
export function spent() {
  const byJob = new Map();
  for (const e of orx.ledger()) if (e.engine === 'higgsfield') byJob.set(e.job, { ...(byJob.get(e.job) || {}), ...e });
  return +[...byJob.values()].reduce((s, e) => s + (e.status === 'completed' ? (e.cost ?? e.estimate ?? 0) : e.status === 'submitted' ? (e.estimate ?? 0) : 0), 0).toFixed(3);
}
function guard(cfg, est, what) {
  const s = spent(), c = cap(cfg);
  if (s + est > c + 1e-9) throw new Error(`budget: ${what} would cost about $${est.toFixed(2)}; Higgsfield spend is $${s.toFixed(2)} of the $${c.toFixed(2)} cap. Raise budget.higgsfieldCapUsd in config.local.json to continue.`);
}
const log = e => orx.record({ engine: 'higgsfield', ...e });

export async function available(cfg) {
  if (mock(cfg)) return { ok: true, detail: 'mock mode (free placeholders)' };
  if (!credentials()) return { ok: false, why: 'HIGGSFIELD_KEY=id:secret not set (studio/.env)' };
  return { ok: true, detail: `spent $${spent().toFixed(2)} of $${cap(cfg).toFixed(2)}` };
}

async function api(cfg, method, p, body, { timeout = 120000 } = {}) {
  const url = /^https?:\/\//.test(p) ? p : `${conf(cfg).api.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
  const headers = { Authorization: `Key ${credentials()}`, Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
    if (r.status === 429 || r.status >= 500) { await sleep(Math.min(30000, 2000 * 2 ** i)); continue; }
    const text = await r.text();
    if (!r.ok) throw new Error(`Higgsfield ${r.status}: ${text.slice(0, 400)}`);
    try { return JSON.parse(text); } catch { return { raw: text }; }
  }
  throw new Error('Higgsfield kept failing (429/5xx)');
}

const MIME = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
/** Presigned upload of a local file → its public URL. A URL passes straight through. */
export async function upload(cfg, file) {
  if (/^https:\/\//.test(file)) return file;
  const content_type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const u = await api(cfg, 'POST', 'files/generate-upload-url', { content_type, filename: path.basename(file) });
  const target = u.upload_url || u.url; if (!target) throw new Error(`upload URL missing in ${JSON.stringify(u).slice(0, 200)}`);
  const headers = { 'Content-Type': u.content_type || content_type, ...(u.upload_headers || {}) };
  const r = await fetch(target, { method: 'PUT', headers, body: fs.readFileSync(file), signal: AbortSignal.timeout(600000) });
  if (!r.ok) throw new Error(`upload of ${path.basename(file)} failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return u.public_url || u.file_url || target.split('?')[0];
}

/** Finds the result video URL in a status/result payload whatever its exact shape. */
export function resultUrl(o) {
  if (!o || typeof o !== 'object') return null;
  for (const k of ['video', 'output', 'result', 'results', 'videos', 'outputs', 'data']) {
    const v = o[k];
    if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
    const r = Array.isArray(v) ? v.map(resultUrl).find(Boolean) : resultUrl(v); if (r) return r;
  }
  if (typeof o.url === 'string' && /^https?:\/\//.test(o.url)) return o.url;
  for (const v of Object.values(o)) if (typeof v === 'string' && /^https?:\/\/\S+\.(mp4|mov|webm)(\?|$)/i.test(v)) return v;
  return null;
}

/** Cuts [t0, t1) of a source video into a clip Genjutsu accepts (≥ 4 s, ≤ the mode's maximum). */
export async function cutSegment(cfg, src, t0, t1, out, { mode = 'motion-transfer' } = {}) {
  const ff = await ffmpeg7(cfg), len = Math.min(MODES[mode].max, Math.max(MIN_S, t1 - t0));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = await run(ff, ['-y', '-v', 'error', '-ss', String(t0), '-t', String(len), '-i', src, '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', out]);
  if (r.code !== 0) throw new Error(`segment cut failed: ${r.err.slice(-300)}`);
  return { file: out, seconds: len };
}

/**
 * One Genjutsu job. p = {video (file or https URL), images: [1-8 files/URLs], prompt, resolution, mode, seconds, out}
 * Returns {file, cost, job, estimate, mock?}. Never retries a paid submit.
 */
export async function transfer(cfg, p, { slug, stage = 'production', signal, what } = {}) {
  const mode = p.mode || 'motion-transfer', m = MODES[mode]; if (!m) throw new Error(`unknown Genjutsu mode ${mode}`);
  const res = p.resolution || '480p', images = (p.images || []).slice(0, 8);
  if (!images.length) throw new Error('Genjutsu needs 1-8 reference images (the element picks)');
  const secs = billedSeconds(p.seconds || MIN_S, mode), est = estimate(secs, res, mode);
  fs.mkdirSync(path.dirname(p.out), { recursive: true });
  if (mock(cfg)) {
    const ff = await ffmpeg7(cfg), label = `MOCK GENJUTSU ${(what || '').replace(/[^\w -]/g, '')}`;
    const vf = `scale=480:-2,hue=h=40:s=1.3,drawtext=text='${label}':x=16:y=16:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.5`;
    let r = await run(ff, ['-y', '-v', 'error', '-i', p.video, '-t', String(secs), '-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', p.out]);
    if (r.code !== 0) r = await run(ff, ['-y', '-v', 'error', '-i', p.video, '-t', String(secs), '-vf', 'scale=480:-2,hue=h=40:s=1.3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', p.out]);
    if (r.code !== 0) throw new Error(`mock Genjutsu failed: ${r.err.slice(-200)}`);
    log({ kind: 'genjutsu', job: `mock-${Date.now()}`, mode, estimate: est, cost: 0, status: 'mock', slug, what });
    fs.writeFileSync(p.out.replace(/\.mp4$/, '.json'), JSON.stringify({ job: 'mock', mode, seconds: secs, resolution: res, estimate: est, prompt: p.prompt, images: p.images, source: p.video }, null, 1));
    return { file: p.out, cost: 0, job: 'mock', estimate: est, mock: true };
  }
  if (!credentials()) throw new Error('HIGGSFIELD_KEY=id:secret is not set in studio/.env');
  guard(cfg, est, what || 'Genjutsu');
  emit('engine', { slug, stage, engine: 'higgsfield', text: `uploading the source clip and ${images.length} reference image(s)` });
  const video_url = await upload(cfg, p.video), image_urls = [];
  for (const f of images) image_urls.push(await upload(cfg, f));
  const body = { video_url, image_urls, resolution: res, ...(p.prompt ? { prompt: String(p.prompt).slice(0, 10000) } : {}) };
  const sub = await api(cfg, 'POST', m.path, body, { timeout: 300000 });
  const id = sub.request_id || sub.id; if (!id) throw new Error(`no request_id in ${JSON.stringify(sub).slice(0, 200)}`);
  log({ kind: 'genjutsu', job: id, mode, estimate: est, status: 'submitted', seconds: secs, resolution: res, slug, what });
  emit('engine', { slug, stage, engine: 'higgsfield', text: `submitted ${m.label} ${what || ''} (${secs} s ${res}, about $${est.toFixed(2)}): ${id}` });
  const c = conf(cfg), t0 = Date.now(); let st = {}, wait = c.pollMs;
  for (;;) {
    if (signal?.aborted) throw new Error('cancelled (the job keeps running on Higgsfield and is still billed)');
    await sleep(wait); wait = Math.min(30000, Math.round(wait * 1.5));
    st = await api(cfg, 'GET', sub.status_url || `requests/${id}/status`);
    const s = String(st.status || st.state || '').toLowerCase();
    emit('engine', { slug, stage, engine: 'higgsfield', text: `${id}: ${s || '?'} · ${((Date.now() - t0) / 1000).toFixed(0)} s` });
    if (TERMINAL_BAD.includes(s)) { log({ kind: 'genjutsu', job: id, status: 'failed_free', error: JSON.stringify(st.error || st).slice(0, 200) }); throw new Error(`Genjutsu job ${s}: ${JSON.stringify(st.error || st.detail || '').slice(0, 300)}`); }
    if (TERMINAL_OK.includes(s)) break;
    if (Date.now() - t0 > c.timeoutMin * 60e3) throw new Error(`Genjutsu job ${id} still ${s} after ${c.timeoutMin} min`);
  }
  let url = resultUrl(st);
  if (!url) { const full = await api(cfg, 'GET', st.response_url || `requests/${id}`); url = resultUrl(full); }
  if (!url) throw new Error(`job ${id} completed but no video URL was found`);
  const r = await fetch(url, { signal: AbortSignal.timeout(600000) });
  if (!r.ok) throw new Error(`download failed: ${r.status}`);
  fs.writeFileSync(p.out, Buffer.from(await r.arrayBuffer()));
  const cost = +(st.cost ?? st.usage?.cost ?? est);
  log({ kind: 'genjutsu', job: id, status: 'completed', cost, file: p.out });
  fs.writeFileSync(p.out.replace(/\.mp4$/, '.json'), JSON.stringify({ job: id, mode, seconds: secs, resolution: res, cost, prompt: p.prompt, images: p.images, source: p.video }, null, 1));
  return { file: p.out, cost, job: id, estimate: est };
}
