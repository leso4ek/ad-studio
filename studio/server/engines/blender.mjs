// Ad Studio · engine "blender": renders a shot spec (studio/blender/adlib.py) to PNG frames, then to an mp4.
// Uses your Blender (config.blender.bin, else `blender` on PATH; 5.1+) headless; falls back to the pip `bpy` module
// in studio/.tools/bpyenv (cloud development). Claude writes the specs (and optional bpy scripts) per shot.
import fs from 'fs';
import path from 'path';
import { run, which, STUDIO, ffmpeg7 } from '../util.mjs';
import { emit } from '../bus.mjs';

const RUNNER = path.join(STUDIO, 'blender', 'run_shot.py');
async function resolve(cfg) {
  const bin = cfg.blender?.bin || await which('blender');
  if (bin) {
    const v = await run(bin, ['-b', '--factory-startup', '--version']).catch(() => ({ code: 1 }));
    const m = /Blender (\d+)\.(\d+)/.exec(v.out || '');
    if (m) return { kind: 'blender', bin, version: `${m[1]}.${m[2]}`, ok: +m[1] > 5 || (+m[1] === 5 && +m[2] >= 1) || +m[1] === 4 };
  }
  const py = path.join(STUDIO, '.tools', 'bpyenv', 'bin', 'python');
  if (fs.existsSync(py)) return { kind: 'bpy', bin: py, version: 'bpy module', ok: true };
  return null;
}

export async function available(cfg) {
  const r = await resolve(cfg);
  if (!r) return { ok: false, why: 'no Blender found (install Blender 5.1+, or set blender.bin in config.local.json)' };
  return r.ok ? { ok: true, detail: `${r.kind} ${r.version}` } : { ok: false, why: `Blender ${r.version} is older than 5.1` };
}

/** spec: object or path; returns {dir, frames, mp4?} */
export async function renderShot(cfg, spec, outDir, { stills, mp4, slug, stage, signal } = {}) {
  const r = await resolve(cfg); if (!r) throw new Error('Blender not available');
  fs.mkdirSync(outDir, { recursive: true });
  const specPath = typeof spec === 'string' ? spec : path.join(outDir, 'shot.json');
  if (typeof spec !== 'string') fs.writeFileSync(specPath, JSON.stringify(spec, null, 1));
  for (const f of fs.readdirSync(outDir)) if (/^f_\d+\.png$/.test(f)) fs.rmSync(path.join(outDir, f));
  const args = r.kind === 'blender' ? ['-b', '--factory-startup', '-P', RUNNER, '--', specPath, outDir] : [RUNNER, specPath, outDir];
  if (stills?.length) args.push('--stills', stills.join(','));
  let n = 0, result = null;
  const t0 = Date.now();
  const res = await run(r.bin, args, {
    signal, env: { ADSTUDIO_FONT: path.join(STUDIO, 'kit', 'fonts', 'Baloo2.ttf') },
    onLine: l => {
      if (/^Saved: /.test(l) || /^Fra:\d+ .*Rendering done/.test(l)) { n++; if (n % 12 === 0) emit('engine', { slug, stage, engine: 'blender', text: `${n} frames` }); }
      if (l.startsWith('{"frames"')) result = JSON.parse(l);
    },
  });
  if (res.aborted) throw new Error('cancelled');
  if (res.code !== 0 || !result) throw new Error(`Blender failed: ${(res.err || res.out).split('\n').filter(x => /Error|Traceback|line \d+/.test(x)).slice(-8).join('\n') || res.err.slice(-600)}`);
  emit('engine', { slug, stage, engine: 'blender', text: `rendered ${result.frames} frame(s) in ${((Date.now() - t0) / 1000).toFixed(0)} s (${r.kind})` });
  if (mp4 && !stills) {
    const ff = await ffmpeg7(cfg), fps = typeof spec === 'object' ? spec.fps || 24 : JSON.parse(fs.readFileSync(specPath)).fps || 24;
    const e = await run(ff, ['-y', '-v', 'error', '-framerate', String(fps), '-start_number', '1', '-i', path.join(outDir, 'f_%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4]);
    if (e.code !== 0) throw new Error(`ffmpeg: ${e.err.slice(-300)}`);
    result.mp4 = mp4;
  }
  return result;
}
