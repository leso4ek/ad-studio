// Ad Studio · shared helpers: paths, JSON files, child processes with streamed lines.
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

export const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(STUDIO, '..');

const expand = p => p.replace(/^~(?=\/|$)/, os.homedir());
export function loadConfig() {
  const base = JSON.parse(fs.readFileSync(path.join(STUDIO, 'config.json'), 'utf8'));
  const localP = path.join(STUDIO, 'config.local.json');
  const local = fs.existsSync(localP) ? JSON.parse(fs.readFileSync(localP, 'utf8')) : {};
  const c = deepMerge(base, local);
  c.lib = expand(process.env.LIB || c.lib);
  c.adsDir = path.resolve(STUDIO, expand(process.env.ADS_DIR || c.adsDir));
  c.port = +(process.env.PORT || c.port);
  return c;
}
export function deepMerge(a, b) {
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return b === undefined ? a : b;
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = (a && typeof a[k] === 'object' && !Array.isArray(a[k])) ? deepMerge(a[k], v) : v;
  return o;
}

/** .env next to config.json: KEY=VALUE lines. Values are never logged or sent to the browser. */
export function loadEnv() {
  const p = path.join(STUDIO, '.env'), env = {};
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if (m && m[2]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k in env || /^(ELEVENLABS|VOICESTUDIO)_/.test(k))) };
}

export const readJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
export function writeJSON(p, v) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2) + '\n'); fs.renameSync(tmp, p);
}
export const now = () => new Date().toISOString();
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Runs a command; calls onLine(line, stream) for every output line. Resolves {code, out, err}.
 * signal: an AbortSignal that kills the process group.
 */
export function run(cmd, args, { cwd, env, onLine, signal, input } = {}) {
  return new Promise((resolve, reject) => {
    const ch = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'], detached: true });
    let out = '', err = '', bufO = '', bufE = '';
    const feed = (chunk, which) => {
      const s = chunk.toString();
      if (which === 'out') { out += s; bufO += s; } else { err += s; bufE += s; }
      let b = which === 'out' ? bufO : bufE, i;
      while ((i = b.indexOf('\n')) >= 0) { const line = b.slice(0, i); b = b.slice(i + 1); onLine && onLine(line, which); }
      if (which === 'out') bufO = b; else bufE = b;
    };
    ch.stdout.on('data', d => feed(d, 'out')); ch.stderr.on('data', d => feed(d, 'err'));
    if (input) { ch.stdin.write(input); ch.stdin.end(); }
    const kill = () => { try { process.kill(-ch.pid, 'SIGTERM'); } catch { /* gone */ } };
    signal?.addEventListener('abort', kill, { once: true });
    ch.on('error', reject);
    ch.on('close', code => {
      if (bufO && onLine) onLine(bufO, 'out'); if (bufE && onLine) onLine(bufE, 'err');
      signal?.removeEventListener('abort', kill);
      resolve({ code, out, err, aborted: !!signal?.aborted });
    });
  });
}

export async function which(bin) {
  const r = await run('sh', ['-c', `command -v ${JSON.stringify(bin).slice(1, -1)}`]).catch(() => ({ code: 1 }));
  return r.code === 0 ? r.out.trim() : null;
}

export function slugify(s) { return String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'ad'; }

/** ffmpeg ≥ 7 for mux.sh: the static build from the pip package imageio-ffmpeg, kept in studio/.tools */
export async function ffmpeg7(cfg) {
  if (cfg.ffmpeg) return cfg.ffmpeg;
  const venv = path.join(STUDIO, '.tools', 'ffv'), py = path.join(venv, 'bin', 'python');
  if (!fs.existsSync(py)) {
    await run('python3', ['-m', 'venv', venv]);
    await run(path.join(venv, 'bin', 'pip'), ['install', '-q', 'imageio-ffmpeg']);
  }
  const r = await run(py, ['-c', 'import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())']);
  const exe = r.out.trim();
  const bin = path.join(STUDIO, '.tools', 'ffbin'); fs.mkdirSync(bin, { recursive: true });
  // reuse a link that already points at the exe; else swap a new one in atomically (parallel processes call this at once)
  const link = path.join(bin, 'ffmpeg');
  try { if (fs.readlinkSync(link) === exe) return link; } catch { /* none yet */ }
  const tmp = `${link}.${process.pid}.${Date.now()}`;
  fs.symlinkSync(exe, tmp); fs.renameSync(tmp, link);
  return link;
}
