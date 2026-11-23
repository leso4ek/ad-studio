// Ad Studio · sound: mix (studio/tools/mix.py, synthesized score + foley + voice) and master (library mux.sh:
// −14 LUFS, true peak ≤ −1 dBTP, grain), with ffmpeg ≥ 7 from imageio-ffmpeg when the system one is older.
import path from 'path';
import fs from 'fs';
import { run, STUDIO, ffmpeg7 } from '../util.mjs';
import { emit } from '../bus.mjs';

export async function mix(cfg, adDir, { events, out, noMusic, slug, stage, signal }) {
  const args = ['-I', path.join(STUDIO, 'tools', 'mix.py'), '--bible', path.join(adDir, 'bible.json'), '--voice', path.join(adDir, 'voice', 'lines'), '--events', events, '--out', out, '--lib', cfg.lib];
  if (noMusic) args.push('--no-music');
  const r = await run(path.join(cfg.lib, '.venv', 'bin', 'python'), args, { cwd: STUDIO, signal });
  if (r.code !== 0) throw new Error(`mix failed: ${(r.err || r.out).slice(-500)}`);
  emit('engine', { slug, stage, engine: 'mix', text: r.out.trim().split('\n').pop() });
  return out;
}

export async function master(cfg, video, wav, out, { slug, stage, signal, grain = 1 }) {
  const ff = await ffmpeg7(cfg);
  const r = await run('sh', [path.join(cfg.lib, 'core', 'render', 'mux.sh'), video, wav, out, '24', String(grain)], {
    cwd: cfg.lib, signal, env: { PATH: `${path.dirname(ff)}:${process.env.PATH}` },
    onLine: l => /LUFS|peak|wrote|warn/i.test(l) && emit('engine', { slug, stage, engine: 'mux', text: l.trim().slice(0, 200) }),
  });
  if (r.code !== 0 || !fs.existsSync(out)) throw new Error(`mux failed: ${(r.err || r.out).slice(-500)}`);
  return { out, log: (r.out + r.err).trim().split('\n').slice(-6).join('\n') };
}

/** Quick draft mux for the animatic (no loudness pass): ffmpeg -shortest. */
export async function draftMux(cfg, video, wav, out, { signal }) {
  const ff = await ffmpeg7(cfg);
  const r = await run(ff, ['-y', '-v', 'error', '-i', video, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', out], { signal });
  if (r.code !== 0) throw new Error(`draft mux failed: ${r.err.slice(-300)}`);
  return out;
}

export async function probe(file) {
  const r = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'json', file]);
  try { const j = JSON.parse(r.out); const v = j.streams.find(s => s.codec_type === 'video') || {}; return { w: v.width, h: v.height, fps: v.r_frame_rate, dur: +(+j.format.duration).toFixed(2), audio: j.streams.some(s => s.codec_type === 'audio') }; }
  catch { return null; }
}

export async function poster(cfg, mp4, t, out) {
  const ff = await ffmpeg7(cfg);
  await run(ff, ['-y', '-v', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', '-q:v', '3', out]);
  return out;
}
