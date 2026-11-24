// Ad Studio · engine "openrouter": Seedance 2.5 video and image models through OpenRouter, with a hard-cap ledger.
//   POST /api/v1/videos (async job) → GET /api/v1/videos/{id} (poll) → GET /api/v1/videos/{id}/content
//   POST /api/v1/images (b64_json)
// The key comes from OPENROUTER_API_KEY (studio/.env or the environment; in a cloud session the network proxy injects it).
// Every call is estimated first, refused if it would pass config.budget.capUsd, and logged in studio/.ledger.jsonl.
// Mock mode (config.openrouter.mock or ADSTUDIO_MOCK=1) makes placeholder clips/images and spends nothing.
import fs from 'fs';
import path from 'path';
import { loadEnv, run, sleep, STUDIO, ffmpeg7 } from '../util.mjs';
import { emit } from '../bus.mjs';

const API = 'https://openrouter.ai/api/v1';
// $ per token; tokens = W × H × 24 × seconds / 1024 (OpenRouter's Seedance pricing as of Nov 2026)
const VIDEO_PRICE = { 'bytedance/seedance-2.5': { '480p': 10.7e-6, '720p': 10.7e-6, '1080p': 11.7e-6 }, 'bytedance/seedance-2.5-flash': { '480p': 7e-6, '720p': 7e-6 } };
const SIZES = { '480p': { '9:16': [480, 854], '16:9': [854, 480], '1:1': [640, 640] }, '720p': { '9:16': [720, 1280], '16:9': [1280, 720], '1:1': [960, 960] }, '1080p': { '9:16': [1080, 1920], '16:9': [1920, 1080] } };
const IMAGE_PRICE = { 'bytedance-seed/seedream-5-5': 0.02, 'google/gemini-nano-banana-2.1': 0.05, 'openai/gpt-image-2.6-flare': 0.08, 'black-forest-labs/flux-3-image': 0.048, 'qwen/qwen-image-2': 0.03, 'recraft/recraft-v4': 0.035 };

const LEDGER = path.join(STUDIO, '.ledger.jsonl');
export const mock = cfg => !!(cfg.openrouter?.mock || process.env.ADSTUDIO_MOCK === '1');
const key = () => loadEnv().OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '';

export function estimateVideo(model, resolution, aspect, seconds) {
  const [w, h] = SIZES[resolution]?.[aspect] || SIZES['480p']['9:16'];
  const rate = VIDEO_PRICE[model]?.[resolution] ?? 11.7e-6;
  return +(w * h * 24 * seconds / 1024 * rate).toFixed(3);
}
export function estimateImage(model, refs = 0) { return +((IMAGE_PRICE[model] ?? 0.08) + (model.includes('seedream') ? 0.008 * refs : 0)).toFixed(3); }

export function ledger() {
  if (!fs.existsSync(LEDGER)) return [];
  return fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}
export function spent() {
  const byJob = new Map();
  for (const e of ledger()) byJob.set(e.job || e.id, { ...(byJob.get(e.job || e.id) || {}), ...e });
  return +[...byJob.values()].reduce((s, e) => s + (e.status === 'completed' ? (e.cost ?? e.estimate ?? 0) : e.status === 'submitted' ? (e.estimate ?? 0) : 0), 0).toFixed(3);
}
function log(e) { fs.appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...e }) + '\n'); }
function guard(cfg, est, what) {
  const cap = cfg.budget?.capUsd ?? 10, s = spent();
  if (s + est > cap + 1e-9) throw new Error(`budget: ${what} would cost about $${est.toFixed(2)}; spent $${s.toFixed(2)} of the $${cap.toFixed(2)} cap. Raise budget.capUsd in config.local.json to continue.`);
}

export async function available(cfg) {
  if (mock(cfg)) return { ok: true, detail: 'mock mode (free placeholders)' };
  if (!key()) return { ok: false, why: 'OPENROUTER_API_KEY not set (studio/.env)' };
  return { ok: true, detail: `spent $${spent().toFixed(2)} of $${(cfg.budget?.capUsd ?? 10).toFixed(2)}` };
}

async function api(method, p, body, { binary = false, timeout = 120000 } = {}) {
  const headers = { Authorization: `Bearer ${key()}`, 'HTTP-Referer': 'http://127.0.0.1/ad-studio', 'X-Title': 'Ad Studio' };
  if (body) headers['Content-Type'] = 'application/json';
  for (let i = 0; i < 5; i++) {
    const r = await fetch(API + p, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * 2 ** i); continue; }
    if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 400)}`);
    return binary ? Buffer.from(await r.arrayBuffer()) : r.json();
  }
  throw new Error('OpenRouter kept failing (429/5xx)');
}

export const dataUrl = file => `data:${{ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' }[path.extname(file).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(file).toString('base64')}`;

/**
 * Seedance shot. p = {model, prompt, seconds, resolution, aspect, refImages:[files], refVideo:file, refAudio:file, firstFrame, lastFrame, seed, audio, out}
 * Returns {file, cost, job, estimate}.
 */
export async function video(cfg, p, { slug, stage, signal, what } = {}) {
  const model = p.model || 'bytedance/seedance-2.5-flash', res = p.resolution || '480p', aspect = p.aspect || '9:16', secs = Math.max(4, Math.min(30, Math.round(p.seconds || 5)));
  const est = estimateVideo(model, res, aspect, secs);
  fs.mkdirSync(path.dirname(p.out), { recursive: true });
  if (mock(cfg)) {
    const [w, h] = SIZES[res][aspect], ff = await ffmpeg7(cfg);
    await run(ff, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${w}x${h}:rate=24:duration=${secs}`, '-vf', `drawtext=text='MOCK ${(what || '').replace(/[^\w -]/g, '')}':x=20:y=20:fontsize=28:fontcolor=white`, '-pix_fmt', 'yuv420p', p.out]).catch(() => null);
    if (!fs.existsSync(p.out)) await run(ff, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${w}x${h}:rate=24:duration=${secs}`, '-pix_fmt', 'yuv420p', p.out]);
    log({ kind: 'video', job: `mock-${Date.now()}`, model, estimate: est, cost: 0, status: 'mock', slug, what });
    return { file: p.out, cost: 0, job: 'mock', estimate: est, mock: true };
  }
  guard(cfg, est, what || 'video');
  const body = { model, prompt: p.prompt, duration: secs, resolution: res, aspect_ratio: aspect, generate_audio: !!p.audio, ...(p.seed !== undefined ? { seed: p.seed } : {}) };
  const frames = [];
  if (p.firstFrame) frames.push({ type: 'image_url', image_url: { url: dataUrl(p.firstFrame) }, frame_type: 'first_frame' });
  if (p.lastFrame) frames.push({ type: 'image_url', image_url: { url: dataUrl(p.lastFrame) }, frame_type: 'last_frame' });
  if (frames.length) body.frame_images = frames;
  const refs = (p.refImages || []).slice(0, cfg.openrouter?.maxRefs || 6).map(f => ({ type: 'image_url', image_url: { url: dataUrl(f) } }));
  if (p.refVideo) {
    // OpenRouter takes video references only as public HTTPS URLs (Nov 2026): a local previz must be hosted first
    const url = /^https:\/\//.test(p.refVideo) ? p.refVideo : cfg.media?.publicBase ? `${cfg.media.publicBase.replace(/\/$/, '')}/${path.basename(p.refVideo)}` : null;
    if (!url) throw new Error('a video reference must be a public HTTPS URL: set media.publicBase in config.local.json (a bucket you upload previz clips to), or use the "styled keyframes" motion mode');
    refs.push({ type: 'video_url', video_url: { url } });
  }
  if (p.refAudio) refs.push({ type: 'audio_url', audio_url: { url: dataUrl(p.refAudio) } });
  if (refs.length) body.input_references = refs;
  const job = await api('POST', '/videos', body, { timeout: 300000 });
  log({ kind: 'video', job: job.id, model, estimate: est, status: 'submitted', seconds: secs, resolution: res, slug, what });
  emit('engine', { slug, stage, engine: 'seedance', text: `submitted ${what || ''} (${model}, ${secs}s ${res}, about $${est.toFixed(2)}): job ${job.id}` });
  let st = {}, wait = 5000; const t0 = Date.now();
  for (;;) {
    if (signal?.aborted) throw new Error('cancelled (the job keeps running on OpenRouter and is still billed)');
    await sleep(wait); wait = Math.min(30000, wait + 5000);
    st = await api('GET', `/videos/${job.id}`);
    emit('engine', { slug, stage, engine: 'seedance', text: `${job.id}: ${st.status} · ${((Date.now() - t0) / 1000).toFixed(0)} s` });
    if (['completed', 'failed', 'cancelled', 'expired'].includes(st.status)) break;
    if (Date.now() - t0 > 45 * 60e3) throw new Error(`job ${job.id} still ${st.status} after 45 min`);
  }
  if (st.status !== 'completed') { log({ kind: 'video', job: job.id, status: st.status === 'failed' ? 'failed_free' : st.status, error: st.error }); throw new Error(`Seedance job ${st.status}: ${JSON.stringify(st.error || '').slice(0, 300)}`); }
  fs.writeFileSync(p.out, await api('GET', `/videos/${job.id}/content`, null, { binary: true, timeout: 600000 }));
  const cost = +((st.usage || {}).cost ?? est);
  log({ kind: 'video', job: job.id, status: 'completed', cost, file: p.out });
  fs.writeFileSync(p.out.replace(/\.mp4$/, '.json'), JSON.stringify({ job: job.id, model, seconds: secs, resolution: res, aspect, cost, prompt: p.prompt, refs: { images: p.refImages, video: p.refVideo, first: p.firstFrame, last: p.lastFrame } }, null, 1));
  return { file: p.out, cost, job: job.id, estimate: est };
}

/** Image (element sheets, styled keyframes). p = {model, prompt, aspect, refImages:[files], n, out (base path without extension)} → {files, cost} */
export async function image(cfg, p, { slug, stage, what } = {}) {
  const model = p.model || 'bytedance-seed/seedream-5-5', n = p.n || 1, refs = p.refImages || [];
  const est = +(estimateImage(model, refs.length) * n).toFixed(3);
  fs.mkdirSync(path.dirname(p.out), { recursive: true });
  if (mock(cfg)) {
    const ff = await ffmpeg7(cfg), files = [];
    for (let i = 0; i < n; i++) { const f = `${p.out}_${i + 1}.png`; await run(ff, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=768x1024:rate=1:duration=1', '-frames:v', '1', f]); files.push(f); }
    log({ kind: 'image', job: `mock-${Date.now()}`, model, estimate: est, cost: 0, status: 'mock', slug, what });
    return { files, cost: 0, estimate: est, mock: true };
  }
  guard(cfg, est, what || 'image');
  // one request per image: several providers (Seedream) accept only n = 1
  const files = []; let cost = 0;
  for (let i = 0; i < n; i++) {
    const body = { model, prompt: p.prompt, n: 1, seed: (p.seed ?? 7) + i, ...(p.aspect ? { aspect_ratio: p.aspect } : {}) };
    if (refs.length) body.input_references = refs.slice(0, 6).map(f => ({ type: 'image_url', image_url: { url: dataUrl(f) } }));
    const id = `img-${Date.now()}-${i}`, one = estimateImage(model, refs.length);
    log({ kind: 'image', job: id, model, estimate: one, status: 'submitted', slug, what });
    let r;
    try { r = await api('POST', '/images', body, { timeout: 300000 }); }
    catch (e) { log({ kind: 'image', job: id, status: 'failed_free', error: String(e.message).slice(0, 200) }); throw e; }
    for (const d of r.data || []) { const f = `${p.out}_${files.length + 1}.${(d.media_type || 'image/png').split('/')[1].replace('jpeg', 'jpg')}`; fs.writeFileSync(f, Buffer.from(d.b64_json, 'base64')); files.push(f); }
    const c = +((r.usage || {}).cost ?? one); cost += c;
    log({ kind: 'image', job: id, status: 'completed', cost: c, files: files.slice(-1) });
  }
  emit('engine', { slug, stage, engine: 'openrouter', text: `${files.length} image(s) from ${model}, $${cost.toFixed(3)}` });
  return { files, cost: +cost.toFixed(4), estimate: est };
}
