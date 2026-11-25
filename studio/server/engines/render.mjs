// Ad Studio · engine "lemo": the code-drawn picture. Builds ads/<slug>/page/ (index.html + kit + bible + cues)
// and calls the Lemo-Opuscar tools (core/render/still.mjs, video.mjs, readcheck.mjs, events.mjs) on it.
import fs from 'fs';
import path from 'path';
import { run, STUDIO, which } from '../util.mjs';
import { emit } from '../bus.mjs';

export const id = 'lemo';
export async function available(cfg) {
  if (!fs.existsSync(path.join(cfg.lib, 'core', 'render', 'video.mjs'))) return { ok: false, why: `Lemo-Opuscar library not found at ${cfg.lib} (run scripts/bootstrap.sh)` };
  if (!fs.existsSync(path.join(cfg.lib, 'node_modules', 'playwright-core'))) return { ok: false, why: 'library dependencies missing (setup.sh deps)' };
  return { ok: true, detail: cfg.lib };
}

export function preparePage(adDir) {
  const page = path.join(adDir, 'page');
  fs.mkdirSync(page, { recursive: true });
  fs.copyFileSync(path.join(STUDIO, 'kit', 'index.html'), path.join(page, 'index.html'));
  const kit = path.join(page, 'kit');
  try { fs.unlinkSync(kit); } catch { /* none */ }
  fs.symlinkSync(path.join(STUDIO, 'kit'), kit);
  fs.copyFileSync(path.join(adDir, 'bible.json'), path.join(page, 'bible.json'));
  const cues = path.join(adDir, 'voice', 'cues.json');
  if (fs.existsSync(cues)) fs.copyFileSync(cues, path.join(page, 'cues.json')); else fs.writeFileSync(path.join(page, 'cues.json'), '[]');
  // plates (Genjutsu takes, Blender worlds) are served next to the page
  const plates = path.join(adDir, 'production', 'plates'), pl = path.join(page, 'plates');
  try { fs.unlinkSync(pl); } catch { /* none */ }
  if (fs.existsSync(plates)) fs.symlinkSync(plates, pl);
  const custom = path.join(adDir, 'scenes', 'custom.js');
  if (fs.existsSync(custom)) fs.copyFileSync(custom, path.join(page, 'custom.js'));
  return page;
}

const sizeOf = (aspect, scale = 1) => aspect === '16:9' ? `${Math.round(1920 * scale / 2) * 2}x${Math.round(1080 * scale / 2) * 2}` : `${Math.round(1080 * scale / 2) * 2}x${Math.round(1920 * scale / 2) * 2}`;

async function tool(cfg, script, args, { slug, stage, signal, label }) {
  const t0 = Date.now(); let last = '';
  emit('engine', { slug, stage, engine: 'lemo', text: `${label || script} …` });
  const r = await run('node', [path.join('core', 'render', script), ...args], {
    cwd: cfg.lib, signal,
    onLine: (l) => { if (!l.trim() || /GL Driver Message|SwiftShader|software rendering/.test(l)) return; last = l; if (/frame|\d+\/\d+|%|wrote|done|FAIL|PASS|fail|pass/i.test(l)) emit('engine', { slug, stage, engine: 'lemo', text: l.slice(0, 200) }); },
  });
  if (r.aborted) throw new Error('cancelled');
  return { ...r, ms: Date.now() - t0, last };
}

export async function stills(cfg, adDir, times, { aspect = '9:16', q = '', prefix = 'f_', out, slug, stage, signal } = {}) {
  const page = preparePage(adDir), dir = out || path.join(adDir, 'frames');
  fs.mkdirSync(dir, { recursive: true });
  const args = [page, ...times.map(t => String(+t.toFixed(3))), '--size', sizeOf(aspect), '--out', dir, '--prefix', prefix];
  if (q) args.push('--q', q);
  const r = await tool(cfg, 'still.mjs', args, { slug, stage, signal, label: `still frames at ${times.map(t => t.toFixed(1)).join(', ')} s` });
  if (r.code !== 0) throw new Error(`still.mjs failed: ${(r.err || r.out).slice(-600)}`);
  return times.map(t => path.join(dir, `${prefix}${+t.toFixed(3)}.jpg`));
}

export async function video(cfg, adDir, { aspect = '9:16', scale = 1, fps = 24, q = '', out, workers, slug, stage, signal }) {
  const page = preparePage(adDir);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const args = [page, '--fps', String(fps), '--workers', String(workers || cfg.render?.workers || 4), '--size', sizeOf(aspect, scale), '--out', out];
  if (q) args.push('--q', q);
  const r = await tool(cfg, 'video.mjs', args, { slug, stage, signal, label: `rendering ${path.basename(out)} (${sizeOf(aspect, scale)}, ${fps} fps)` });
  if (r.code !== 0 || !fs.existsSync(out)) throw new Error(`video.mjs failed: ${(r.err || r.out).slice(-600)}`);
  return out;
}

export async function readcheck(cfg, adDir, { aspect = '9:16', q = '', slug, stage, signal }) {
  const page = preparePage(adDir);
  const r = await tool(cfg, 'readcheck.mjs', [page, '--size', sizeOf(aspect), ...(q ? ['--q', q] : [])], { slug, stage, signal, label: 'reading-time check' });
  return { pass: r.code === 0, code: r.code, report: (r.out + r.err).trim().split('\n').slice(-40).join('\n') };
}

export async function events(cfg, adDir, { slug, stage, signal, q = '' }) {
  const page = preparePage(adDir), out = path.join(adDir, 'audio', 'events.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = await tool(cfg, 'events.mjs', [page, '--size', '1080x1920', '--out', out, ...(q ? ['--q', q] : [])], { slug, stage, signal, label: 'sound events' });
  if (r.code !== 0) throw new Error(`events.mjs failed: ${r.err.slice(-400)}`);
  return out;
}

/** Safe zones: every text box from TEXTS(t) must sit inside window.SAFE (the TikTok/Reels UI keeps out of it). */
export async function safecheck(cfg, adDir, { aspect = '9:16', q = '', slug, stage, signal }) {
  const page = preparePage(adDir);
  const r = await run('node', [path.join(STUDIO, 'tools', 'safecheck.mjs'), page, '--size', sizeOf(aspect), ...(q ? ['--q', q] : [])], { cwd: cfg.lib, signal, env: { LIB: cfg.lib } });
  let res; try { res = JSON.parse(r.out); } catch { res = { pass: false, error: (r.err || r.out).slice(-400) }; }
  emit('engine', { slug, stage, engine: 'lemo', text: `safe zones ${aspect}: ${res.pass ? 'all texts inside' : `${(res.out || []).length} text(s) outside`}` });
  return res;
}
export { sizeOf };
export const hasFfprobe = () => which('ffprobe');
