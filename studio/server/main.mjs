// Ad Studio · HTTP server (127.0.0.1 only). REST API + Server-Sent Events + the ad files + the built web app.
//   node studio/server/main.mjs        → http://127.0.0.1:5170
import http from 'http';
import fs from 'fs';
import path from 'path';
import { loadConfig, loadEnv, readJSON, STUDIO, REPO, which } from './util.mjs';
import { initBus, subscribe, emit } from './bus.mjs';
import * as P from './pipeline.mjs';
import * as MEM from './memory.mjs';
import * as CAT from './catalog.mjs';
import { STAGES, STYLE_LINES } from './stages.mjs';
import * as claude from './engines/claude.mjs';
import * as inbox from './engines/inbox.mjs';
import * as render from './engines/render.mjs';
import * as comfy from './engines/comfy.mjs';
import { engines as voice } from './engines/voice.mjs';
import * as blender from './engines/blender.mjs';
import * as orx from './engines/openrouter.mjs';
import * as PR from './production.mjs';

const cfg = loadConfig();
initBus(cfg.adsDir); P.initPipeline(cfg); PR.initProduction(cfg);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.srt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.jsonl': 'text/plain; charset=utf-8' };

function send(res, code, body, type = 'application/json; charset=utf-8') { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); }
async function body(req, raw = false) { const chunks = []; for await (const c of req) chunks.push(c); const b = Buffer.concat(chunks); return raw ? b : (b.length ? JSON.parse(b.toString()) : {}); }

function serveFile(req, res, file) {
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) return send(res, 404, { error: 'not found' });
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range), start = m[1] ? +m[1] : 0, end = m[2] ? +m[2] : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store' });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else { res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res); }
  });
}
const inside = (root, p) => { const r = path.resolve(root, p); return r === root || r.startsWith(root + path.sep) ? r : null; };

async function health() {
  const env = loadEnv(), out = {};
  const check = async (k, f) => { try { out[k] = await f(); } catch (e) { out[k] = { ok: false, why: e.message }; } };
  await Promise.all([
    check('claude', () => claude.available(cfg)), check('inbox', () => inbox.available(cfg)), check('lemo', () => render.available(cfg)),
    check('voicestudio', () => voice.voicestudio.available(cfg)), check('kokoro', () => voice.kokoro.available(cfg)), check('elevenlabs', () => voice.elevenlabs.available(cfg)),
    check('comfy', () => comfy.available(cfg)), check('blender', () => blender.available(cfg)), check('openrouter', () => orx.available(cfg)),
    check('whisper', async () => fs.existsSync(path.join(cfg.lib, '.venv', 'bin', 'python')) && fs.readdirSync(path.join(cfg.lib, '.venv', 'lib')).some(v => fs.existsSync(path.join(cfg.lib, '.venv', 'lib', v, 'site-packages', 'faster_whisper'))) ? { ok: true, detail: 'faster-whisper' } : { ok: false, why: 'faster-whisper not installed' }),
    check('ffprobe', async () => (await which('ffprobe')) ? { ok: true } : { ok: false, why: 'install ffmpeg' }),
  ]);
  return { engines: out, chains: cfg.chains, env: Object.fromEntries(['OPENROUTER_API_KEY', 'ELEVENLABS_API_KEY', 'VOICESTUDIO_API_KEY'].map(k => [k, !!env[k]])), claude: { model: cfg.claude.model || '(default)', effort: cfg.claude.effort || '(default)' } };
}

const routes = [
  ['GET', /^\/api\/events$/, (req, res) => subscribe(res)],
  ['GET', /^\/api\/health$/, async (req, res) => send(res, 200, await health())],
  ['GET', /^\/api\/meta$/, (req, res) => send(res, 200, { stages: STAGES.map(({ id, n, title, kind, gate, optional, paid }) => ({ id, n, title, kind, gate: !!gate, optional: !!optional, paid: !!paid })), styles: STYLE_LINES })],
  ['GET', /^\/api\/ads$/, (req, res) => send(res, 200, P.listAds())],
  ['POST', /^\/api\/ads$/, async (req, res) => { const b = await body(req); const p = P.createAd(b); if (b.start !== false) P.runFrom(p.slug).catch(e => emit('job', { slug: p.slug, kind: 'error', text: e.message })); send(res, 201, p); }],
  ['GET', /^\/api\/ads\/([\w-]+)$/, (req, res, [, s]) => { const st = P.adState(s); st ? send(res, 200, st) : send(res, 404, { error: 'no such ad' }); }],
  ['GET', /^\/api\/ads\/([\w-]+)\/log$/, (req, res, [, s]) => { const f = path.join(P.adDir(s), 'log.jsonl'); send(res, 200, fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).slice(-4000).map(l => JSON.parse(l)) : []); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/run$/, async (req, res, [, s]) => { const b = await body(req); if (P.isRunning(s)) return send(res, 409, { error: 'running' }); P.runFrom(s, b.from || null).catch(e => emit('job', { slug: s, kind: 'error', text: e.message })); send(res, 202, { ok: true }); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/stages\/([\w-]+)\/approve$/, async (req, res, [, s, id]) => { await P.approve(s, id, await body(req)); send(res, 200, { ok: true }); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/stages\/([\w-]+)\/redo$/, async (req, res, [, s, id]) => { try { await P.redo(s, id, await body(req)); send(res, 202, { ok: true }); } catch (e) { send(res, 409, { error: e.message }); } }],
  ['GET', /^\/api\/catalog$/, (req, res) => send(res, 200, CAT.load().map(e => ({ slug: e.slug, name: e.name, family: e.family, traits: e.traits, bestFor: e.bestFor, example: e.example?.file ? `/catalog/examples/${e.slug}.jpg` : null })))],
  ['GET', /^\/catalog\/examples\/([\w-]+)\.jpg$/, (req, res, [, s]) => serveFile(req, res, path.join(CAT.CATALOG, 'examples', `${s}.jpg`))],
  ['GET', /^\/api\/memory$/, (req, res) => send(res, 200, MEM.summary())],
  ['POST', /^\/api\/memory\/proposals\/([\w-]+)$/, async (req, res, [, id]) => { const b = await body(req); send(res, 200, MEM.decideProposal(id, !!b.approve)); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/learn$/, async (req, res, [, s]) => { const r = await P.learn(s); send(res, r ? 200 : 500, r || { error: 'the relabel did not run: see the live pane' }); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/cancel$/, (req, res, [, s]) => send(res, 200, { cancelled: P.cancel(s) })],
  ['POST', /^\/api\/ads\/([\w-]+)\/mode$/, async (req, res, [, s]) => { const b = await body(req); const pick = {}; for (const k of ['mode', 'autoGates', 'decider']) if (k in b) pick[k] = b[k]; send(res, 200, P.setMode(s, pick)); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/photo$/, async (req, res, [, s]) => {
    const buf = await body(req, true), dir = path.join(P.adDir(s), 'assets'); fs.mkdirSync(dir, { recursive: true });
    const src = path.join(dir, 'product-original.png'), out = path.join(dir, 'product.png'); fs.writeFileSync(src, buf);
    for (const name of cfg.chains.photo) {
      if (name === 'comfy') { const a = await comfy.available(cfg); if (!a.ok) { emit('engine', { slug: s, stage: 'assets', engine: 'comfy', text: `${a.why} → pillow`, level: 'warn' }); continue; } await comfy.upscale(cfg, src, out); return send(res, 200, { engine: 'comfy', file: 'assets/product.png' }); }
      if (name === 'pillow') { await comfy.pillow(cfg, src, out); return send(res, 200, { engine: 'pillow', file: 'assets/product.png' }); }
    }
    send(res, 500, { error: 'no photo engine' });
  }],
  // production: the shot board (previz → takes → pick), element sheets, budget
  ['GET', /^\/api\/budget$/, (req, res) => send(res, 200, PR.budget())],
  ['GET', /^\/api\/ads\/([\w-]+)\/production$/, (req, res, [, s]) => send(res, 200, { plan: PR.plan(P.adDir(s)), busy: PR.busy(s), budget: PR.budget() })],
  ['POST', /^\/api\/ads\/([\w-]+)\/production\/init$/, async (req, res, [, s]) => send(res, 200, PR.init(P.adDir(s), s, await body(req)))],
  ['POST', /^\/api\/ads\/([\w-]+)\/production\/settings$/, async (req, res, [, s]) => send(res, 200, PR.patchSettings(P.adDir(s), s, await body(req)))],
  ['POST', /^\/api\/ads\/([\w-]+)\/production\/shots\/([\w-]+)$/, async (req, res, [, s, id]) => send(res, 200, PR.patchShot(P.adDir(s), s, id, await body(req)))],
  ['GET', /^\/api\/ads\/([\w-]+)\/production\/shots\/([\w-]+)\/estimate$/, (req, res, [, s, id]) => send(res, 200, PR.estimate(P.adDir(s), id, new URL(req.url, 'http://x').searchParams.get('kind') || 'draft'))],
  ['POST', /^\/api\/ads\/([\w-]+)\/production\/prompts$/, (req, res, [, s]) => { bg(s, () => PR.writePrompts(P.adDir(s), s, P.decideFor)); send(res, 202, { ok: true }); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/production\/assets\/([\w-]+)$/, async (req, res, [, s, id]) => send(res, 200, PR.patchAsset(P.adDir(s), s, id, await body(req)))],
  ['POST', /^\/api\/ads\/([\w-]+)\/production\/shots\/([\w-]+)\/previz$/, (req, res, [, s, id]) => { bg(s, () => PR.previz(P.adDir(s), s, id)); send(res, 202, { ok: true }); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/production\/shots\/([\w-]+)\/take$/, async (req, res, [, s, id]) => { const b = await body(req); if (!b.confirm) return send(res, 400, { error: 'confirm the estimate first', ...PR.estimate(P.adDir(s), id, b.kind || 'draft') }); bg(s, () => PR.take(P.adDir(s), s, id, b)); send(res, 202, { ok: true }); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/production\/shots\/([\w-]+)\/finish$/, (req, res, [, s, id]) => { bg(s, () => PR.finish(P.adDir(s), s, id)); send(res, 202, { ok: true }); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/production\/shots\/([\w-]+)\/keys$/, async (req, res, [, s, id]) => { const b = await body(req); bg(s, () => PR.styleKeys(P.adDir(s), s, id, b)); send(res, 202, { ok: true }); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/production\/shots\/([\w-]+)\/keys\/choose$/, async (req, res, [, s, id]) => { const b = await body(req); send(res, 200, PR.chooseKey(P.adDir(s), s, id, b.which, b.file)); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/production\/assets\/([\w-]+)\/make$/, async (req, res, [, s, id]) => { const b = await body(req); bg(s, () => PR.makeAsset(P.adDir(s), s, id, b)); send(res, 202, { ok: true }); }],
  ['POST', /^\/api\/ads\/([\w-]+)\/production\/assets\/([\w-]+)\/choose$/, async (req, res, [, s, id]) => (async () => { const b = await body(req); send(res, 200, PR.chooseAsset(P.adDir(s), s, id, b.file, { add: b.add })); })()],
  ['GET', /^\/styleframes\/(ad-[\w-]+)\.jpg$/, (req, res, [, s]) => serveFile(req, res, path.join(REPO, 'styles', s, 'styleframe.jpg'))],
  ['GET', /^\/files\/([\w-]+)\/(.+)$/, (req, res, [, s, rel]) => { const f = inside(P.adDir(s), decodeURIComponent(rel)); f ? serveFile(req, res, f) : send(res, 403, { error: 'outside the ad' }); }],
];

// background production jobs report through the event bus
function bg(slug, fn) { fn().then(r => emit('production', { slug, kind: 'done', result: r })).catch(e => emit('production', { slug, kind: 'error', text: e.message })); }

const WEB = path.join(STUDIO, 'web', 'dist');
const server = http.createServer(async (req, res) => {
  try {
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return send(res, 403, { error: 'bad host' });   // no DNS rebinding
    const url = new URL(req.url, 'http://x'), p = url.pathname;
    for (const [m, re, fn] of routes) { const mm = re.exec(p); if (mm && req.method === m) return await fn(req, res, mm); }
    if (req.method !== 'GET') return send(res, 404, { error: 'no route' });
    const f = inside(WEB, p === '/' ? 'index.html' : p.slice(1));
    if (f && fs.existsSync(f) && fs.statSync(f).isFile()) return serveFile(req, res, f);
    if (fs.existsSync(path.join(WEB, 'index.html'))) return serveFile(req, res, path.join(WEB, 'index.html'));
    send(res, 200, '<p>Ad Studio API is running. Build the web app: <code>npm run build</code> in studio/.</p>', 'text/html');
  } catch (e) { send(res, 500, { error: e.message }); }
});
server.listen(cfg.port, '127.0.0.1', () => console.log(`Ad Studio on http://127.0.0.1:${cfg.port}  (ads in ${cfg.adsDir}, library ${cfg.lib})`));
