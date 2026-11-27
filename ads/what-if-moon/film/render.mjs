// Renders the film frame by frame in headless Chromium (deterministic time), pipes JPEGs into ffmpeg.
//   node render.mjs --stills 1.5,12,30   → out/stills/t<sec>.jpg
//   node render.mjs [--from 0 --to 20] [--fps 30] → out/picture.mp4 (silent)
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process'; import { fileURLToPath } from 'url';
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..'), AD = path.resolve(HERE, '..');
const LIBNM = path.join(process.env.LIB || path.join(process.env.HOME, 'lemo-opuscar'), 'node_modules');
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const f = u.startsWith('/node_modules/') ? path.join(LIBNM, u.slice(14)) : path.join(REPO, u);
  if (!f.startsWith(REPO) && !f.startsWith(LIBNM)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
}).listen(0, '127.0.0.1');
await new Promise(ok => srv.on('listening', ok));
const base = `http://127.0.0.1:${srv.address().port}/ads/what-if-moon/film/index.html`;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => { if (m.type() === 'error') console.error('page:', m.text()); });
page.on('pageerror', e => console.error('pageerror:', e.message));
await page.goto(base); await page.waitForFunction(() => window.FILM_READY === true, null, { timeout: 120000 });
const dur = await page.evaluate(() => window.FILM.duration);
const shot = async () => page.locator('#wrap').screenshot({ type: 'jpeg', quality: 92 });
if (process.argv.includes('--stills')) {
  const out = path.join(AD, 'out', 'stills'); fs.mkdirSync(out, { recursive: true });
  for (const t of arg('--stills').split(',').map(Number)) { const sc = await page.evaluate(t => window.FILM.seek(t), t); fs.writeFileSync(path.join(out, `t${t.toFixed(2)}.jpg`), await shot()); console.log(t, sc); }
} else {
  const fps = +arg('--fps', 30), from = +arg('--from', 0), to = Math.min(+arg('--to', dur), dur), outF = arg('--out', path.join(AD, 'out', 'picture.mp4'));
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', outF], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((to - from) * fps), t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.FILM.seek(t), from + i / fps);
    const buf = await shot(); if (!ff.stdin.write(buf)) await new Promise(ok => ff.stdin.once('drain', ok));
    if (i % 150 === 0) console.log(`frame ${i}/${n} · ${((Date.now() - t0) / 1000 / (i + 1)).toFixed(2)} s/frame`);
  }
  ff.stdin.end(); await new Promise(ok => ff.on('close', ok)); console.log(`wrote ${outF} (${(n / fps).toFixed(2)} s)`);
}
await browser.close(); srv.close();
