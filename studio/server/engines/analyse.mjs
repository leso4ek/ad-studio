// Ad Studio · engine "analyse": reads an uploaded video by code (free, local) so Claude can recreate it.
//   probe (ffprobe) → shot cuts (ffmpeg scene score, minimum shot length) → first/mid/last stills per shot + contact
//   sheets → motion per shot (frame-difference energy and the global camera shift on 64-px grey frames) → word-timed
//   transcript (faster-whisper) → loudness over time (EBU R128 momentary) → analysis.json
// The pure helpers (shotsFromCuts, motionStats, shotMotion, mergeSpans, routeFor) are unit-tested on synthetic input.
import fs from 'fs';
import path from 'path';
import { run, ffmpeg7, which, STUDIO, writeJSON, readJSON } from '../util.mjs';
import { emit } from '../bus.mjs';

export const MAX_SOURCE_S = 60;
const FONT = path.join(STUDIO, 'kit', 'fonts', 'Inter.ttf');

export async function probe(file) {
  const ffprobe = (await which('ffprobe')) || 'ffprobe';
  const r = await run(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  if (r.code !== 0) throw new Error(`ffprobe could not read the video: ${r.err.slice(-200)}`);
  const j = JSON.parse(r.out), v = j.streams.find(s => s.codec_type === 'video'), a = j.streams.find(s => s.codec_type === 'audio');
  if (!v) throw new Error('the file has no video stream');
  const [n, d] = String(v.avg_frame_rate || v.r_frame_rate || '24/1').split('/').map(Number);
  let w = +v.width, h = +v.height; const rot = Math.abs(+(v.tags?.rotate || v.side_data_list?.find(x => x.rotation !== undefined)?.rotation || 0));
  if (rot === 90 || rot === 270) [w, h] = [h, w];
  return { duration: +(+j.format.duration || +v.duration || 0).toFixed(3), w, h, fps: d ? +(n / d).toFixed(3) : 24, aspect: w / h < .8 ? '9:16' : w / h > 1.25 ? '16:9' : '1:1', audio: !!a, codec: v.codec_name, size: +j.format.size };
}

/** Scene-change times (s): local peaks of ffmpeg's scene score (a hard threshold misses cuts inside one drawn set). */
export async function detectCuts(cfg, file, opts = {}) {
  const ff = await ffmpeg7(cfg);
  const r = await run(ff, ['-hide_banner', '-i', file, '-an', '-vf', "scale=320:-2,select='gt(scene,0.02)',metadata=print", '-f', 'null', '-']);
  const pts = [], txt = r.err || '';
  for (const m of txt.matchAll(/pts_time:([\d.]+)[\s\S]*?scene_score=([\d.]+)/g)) pts.push([+m[1], +m[2]]);
  return pickPeaks(pts, opts);
}
/** [[t, score]] → cut times: score ≥ abs, or score ≥ rel and ratio × the strongest neighbour within ±win seconds. */
export function pickPeaks(pts, { abs = .3, rel = .12, ratio = 2.2, win = .3 } = {}) {
  return pts.filter(([t, s]) => {
    if (t <= 0) return false;
    const nb = pts.filter(([u]) => u !== t && Math.abs(u - t) <= win).reduce((m, [, v]) => Math.max(m, v), 0);
    return (s >= abs && s >= nb) || (s >= rel && s >= ratio * nb);
  }).map(([t]) => t);
}
/** Cut times → shots [{id, t0, t1}] with every shot at least minShot long (short flashes merge into the previous shot). */
export function shotsFromCuts(cuts, dur, { minShot = .5 } = {}) {
  const edges = [0];
  for (const c of [...cuts].sort((a, b) => a - b)) if (c - edges.at(-1) >= minShot && dur - c >= minShot) edges.push(+c.toFixed(3));
  edges.push(+dur.toFixed(3));
  return edges.slice(0, -1).map((t0, i) => ({ id: `s${i + 1}`, t0, t1: edges[i + 1] }));
}

/** Small grey frames for the motion score: {w, h, fps, frames: Uint8Array[]} */
export async function grayFrames(cfg, file, { fps = 8, w = 64 } = {}) {
  const meta = await probe(file), h = Math.max(8, Math.round(w * meta.h / meta.w / 2) * 2);
  const ff = await ffmpeg7(cfg), tmp = path.join(path.dirname(file), `.gray_${process.pid}_${Date.now()}.raw`);
  const r = await run(ff, ['-v', 'error', '-y', '-i', file, '-an', '-vf', `fps=${fps},scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', tmp]);
  if (r.code !== 0) throw new Error(`frame extraction failed: ${r.err.slice(-200)}`);
  const buf = fs.readFileSync(tmp); fs.unlinkSync(tmp);
  const n = Math.floor(buf.length / (w * h)), frames = [];
  for (let i = 0; i < n; i++) frames.push(new Uint8Array(buf.buffer, buf.byteOffset + i * w * h, w * h));
  return { w, h, fps, frames };
}

/** Per consecutive frame pair: raw difference energy, the best global shift (dx, dy in px) and the residual after it. */
export function motionStats(frames, w, h, { search = 4 } = {}) {
  const out = [], m = search;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    const diff = (dx, dy) => { let s = 0, n = 0; for (let y = m; y < h - m; y++) for (let x = m; x < w - m; x++) { s += Math.abs(b[y * w + x] - a[(y - dy) * w + (x - dx)]); n++; } return s / n / 255; };
    const raw = diff(0, 0); let best = { dx: 0, dy: 0, r: raw };
    if (raw > .004) for (let dy = -m; dy <= m; dy++) for (let dx = -m; dx <= m; dx++) { if (!dx && !dy) continue; const r = diff(dx, dy); if (r < best.r - 1e-4) best = { dx, dy, r }; }
    out.push({ raw: +raw.toFixed(4), dx: best.dx, dy: best.dy, residual: +best.r.toFixed(4) });
  }
  return out;
}

/** Aggregates the pairs inside [t0, t1) into a shot's motion: score 0-1, camera move, subject motion. */
export function shotMotion(stats, fps, w, t0, t1) {
  const i0 = Math.ceil(t0 * fps + .01), i1 = Math.max(i0 + 1, Math.floor(t1 * fps - .01));
  const xs = stats.slice(i0, i1); if (!xs.length) return { score: 0, camera: 'static', subject: 'still', pan: [0, 0] };
  const mean = k => xs.reduce((s, x) => s + x[k], 0) / xs.length;
  const dx = mean('dx'), dy = mean('dy'), resid = mean('residual'), raw = mean('raw');
  const jit = Math.sqrt(xs.reduce((s, x) => s + (x.dx - dx) ** 2 + (x.dy - dy) ** 2, 0) / xs.length);
  const panS = Math.hypot(dx, dy) * fps / w;       // frame widths per second
  let camera = 'static';
  if (panS > .06) camera = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'pan-left' : 'pan-right') : (dy > 0 ? 'tilt-up' : 'tilt-down');   // content moves right ⇒ the camera pans left
  else if (jit > .9) camera = 'handheld';
  const subject = resid > .06 ? 'fast' : resid > .025 ? 'moving' : resid > .01 ? 'small' : 'still';
  const score = Math.min(1, +(resid * 9 + panS * 1.5 + jit * .08).toFixed(3));
  return { score, camera, subject, pan: [+(dx * fps / w).toFixed(3), +(dy * fps / w).toFixed(3)], raw: +raw.toFixed(4), residual: +resid.toFixed(4) };
}

/** Joins consecutive shots into spans Genjutsu accepts: each ≥ min and ≤ max seconds (a long shot is split). */
export function mergeSpans(shots, { min = 4, max = 30 } = {}) {
  const spans = []; let cur = null;
  const push = () => { if (cur) spans.push(cur); cur = null; };
  for (const s of shots) {
    let t0 = s.t0;
    while (s.t1 - t0 > max + 1e-6) {           // split a long shot into max-length pieces
      push(); spans.push({ t0, t1: t0 + max, shots: [s.id] }); t0 += max;
    }
    if (!cur) cur = { t0, t1: s.t1, shots: [s.id] };
    else if (s.t1 - cur.t0 <= max + 1e-6) { cur.t1 = s.t1; cur.shots.push(s.id); }
    else { push(); cur = { t0, t1: s.t1, shots: [s.id] }; }
    if (cur.t1 - cur.t0 >= min - 1e-6) push();
  }
  if (cur) {                                  // a short tail joins the previous span when it fits, else stretches to min
    const prev = spans.at(-1);
    if (prev && cur.t1 - prev.t0 <= max + 1e-6) { prev.t1 = cur.t1; prev.shots.push(...cur.shots.filter(id => !prev.shots.includes(id))); }
    else spans.push(cur);
  }
  return spans.map((s, i) => ({ id: `g${i + 1}`, t0: +s.t0.toFixed(3), t1: +s.t1.toFixed(3), seconds: +(s.t1 - s.t0).toFixed(3), shots: s.shots, short: s.t1 - s.t0 < min - 1e-6 }));
}

/**
 * The motion router. shot: {motion: {score, camera}, complexity: low|mid|high, physics?, people?}; ctx: {format, mode, rights, photoreal}
 * → {route, why}. Routes: three · kit · blender · blender→genjutsu · seedance · genjutsu
 */
export function routeFor(shot, ctx = {}) {
  const fmt = ctx.format || 'story-ad', mode = ctx.mode || 'remake', score = shot.motion?.score ?? 0, cx = shot.complexity || 'low';
  if ((mode === 'transfer' || (mode === 'mixed' && (shot.people || score > .35))) && ctx.rights && fmt === 'recreate') return { route: 'genjutsu', why: 'motion transfer of the original segment (rights confirmed)' };
  const complex = cx === 'high' || shot.physics || (cx === 'mid' && score > .45);
  const target = fmt === 'recreate' ? (ctx.target || 'story-ad') : fmt;
  if (target === '3d-explainer') return complex || shot.physics ? { route: ctx.photoreal ? 'blender→genjutsu' : 'blender', why: 'a built 3D world with layers, flow or a long camera path' } : { route: 'blender', why: 'the explainer world is one Blender scene' };
  if (target === '3d-skit') return complex ? { route: 'blender', why: 'too many objects or physics for the three.js stage' } : { route: 'three', why: 'gestures and simple moves: the three.js voxel stage renders it in seconds' };
  if (complex) return ctx.allowPaid !== false ? { route: 'seedance', why: 'complex live motion: Seedance from the element sheets' } : { route: 'blender', why: 'complex motion, no paid route: Blender' };
  return { route: 'kit', why: 'simple motion: the code-drawn kit' };
}

async function still(cfg, src, t, out, label) {
  const ff = await ffmpeg7(cfg), safe = String(label).replace(/[':\\]/g, ' ');
  const vf = `scale=240:-2,drawtext=fontfile=${FONT}:text='${safe}':x=6:y=6:fontsize=15:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4`;
  let r = await run(ff, ['-y', '-v', 'error', '-ss', String(Math.max(0, t).toFixed(3)), '-i', src, '-frames:v', '1', '-vf', vf, '-q:v', '4', out]);
  if (r.code !== 0 || !fs.existsSync(out)) r = await run(ff, ['-y', '-v', 'error', '-ss', String(Math.max(0, t).toFixed(3)), '-i', src, '-frames:v', '1', '-vf', 'scale=240:-2', '-q:v', '4', out]);
  return out;
}

/** Momentary loudness every 0.1 s: [[t, LUFS]] (silence → -70). */
export async function loudness(cfg, file) {
  const ff = await ffmpeg7(cfg);
  const r = await run(ff, ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=peak=none', '-f', 'null', '-']);
  const pts = [...(r.err || '').matchAll(/t:\s*([\d.]+)\s+TARGET.*?M:\s*(-?[\d.]+|-inf)/g)].map(m => [+m[1], m[2] === '-inf' ? -70 : Math.max(-70, +m[2])]);
  const I = /I:\s*(-?[\d.]+) LUFS\s*\n\s*Threshold/.exec(r.err || '') || /Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+)/.exec(r.err || '');
  return { points: pts, integrated: I ? +I[1] : null };
}

export async function transcribe(cfg, file, out, { signal } = {}) {
  const py = path.join(cfg.lib, '.venv', 'bin', 'python');
  if (!fs.existsSync(py)) return null;
  const r = await run(py, ['-I', path.join(STUDIO, 'tools', 'transcribe.py'), file, out, '--model', cfg.whisperModel || 'base', '--lang', 'en'], { signal });
  if (r.code !== 0) { emit('engine', { stage: 'source', engine: 'whisper', text: `no transcript: ${(r.err || '').split('\n').filter(Boolean).at(-1)?.slice(0, 160)}`, level: 'warn' }); return null; }
  return readJSON(out);
}

/**
 * The full analysis of ads/<slug>/source/<video>. Writes source/analysis/{analysis.json, stills/, sheet_N.jpg, words.json}.
 * Returns the analysis object.
 */
export async function analyse(cfg, src, outDir, { slug, signal, whisper = true } = {}) {
  const say = text => emit('engine', { slug, stage: 'source', engine: 'analyse', text });
  fs.mkdirSync(path.join(outDir, 'stills'), { recursive: true });
  const meta = await probe(src); say(`${meta.w}×${meta.h}, ${meta.fps} fps, ${meta.duration.toFixed(1)} s${meta.audio ? ', with audio' : ', silent'}`);
  if (meta.duration > MAX_SOURCE_S + .5) throw new Error(`the video is ${meta.duration.toFixed(0)} s: upload at most ${MAX_SOURCE_S} s (trim it first)`);
  const cuts = await detectCuts(cfg, src), shots = shotsFromCuts(cuts, meta.duration, { minShot: .5 });
  say(`${shots.length} shot(s) found (${cuts.length} scene changes)`);
  const g = await grayFrames(cfg, src), stats = motionStats(g.frames, g.w, g.h);
  for (const s of shots) s.motion = shotMotion(stats, g.fps, g.w, s.t0, s.t1);
  // stills: first, middle, last of every shot (labelled), then contact sheets of 3 × up to 8 rows
  const files = [];
  for (const s of shots) {
    const ts = [s.t0 + .05, (s.t0 + s.t1) / 2, Math.max(s.t0 + .05, s.t1 - .08)];
    s.stills = [];
    for (const [k, t] of ['first', 'mid', 'last'].entries()) {
      const f = path.join(outDir, 'stills', `${s.id}_${t}.jpg`);
      await still(cfg, src, ts[k], f, `${s.id} ${t} ${ts[k].toFixed(1)}s`);
      s.stills.push(path.relative(path.dirname(outDir), f)); files.push(f);
    }
  }
  const ff = await ffmpeg7(cfg), sheets = [];
  for (let i = 0, k = 1; i < files.length; i += 24, k++) {
    const part = files.slice(i, i + 24), tmp = path.join(outDir, `.sheet${k}`); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp);
    part.forEach((f, j) => fs.copyFileSync(f, path.join(tmp, `${String(j).padStart(3, '0')}.jpg`)));
    const out = path.join(outDir, `sheet_${k}.jpg`);
    const r = await run(ff, ['-y', '-v', 'error', '-framerate', '1', '-i', path.join(tmp, '%03d.jpg'), '-vf', `tile=3x${Math.ceil(part.length / 3)}:padding=4:color=0x111111`, '-frames:v', '1', '-q:v', '3', out]);
    fs.rmSync(tmp, { recursive: true, force: true });
    if (r.code === 0) sheets.push(path.relative(path.dirname(outDir), out));
  }
  // words and loudness
  let words = null;
  if (whisper && meta.audio) { say('transcribing (faster-whisper, local)'); words = await transcribe(cfg, src, path.join(outDir, 'words.json'), { signal }); }
  const loud = meta.audio ? await loudness(cfg, src) : { points: [], integrated: null };
  const inWords = t => (words?.words || []).some(w => t >= w.t0 - .15 && t <= w.t1 + .15);
  const gaps = loud.points.filter(([t]) => !inWords(t)).map(p => p[1]), gapMean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : -70;
  for (const s of shots) {
    const ws = (words?.words || []).filter(w => w.t0 >= s.t0 - .05 && w.t0 < s.t1);
    s.voice = ws.map(w => w.w).join(' ').replace(/\s+([,.!?])/g, '$1');
    s.wordsPerSec = +(ws.length / (s.t1 - s.t0)).toFixed(2);
  }
  const spoken = words?.words?.length || 0;
  const res = {
    source: path.basename(src), ...meta, analysedAt: new Date().toISOString(),
    cuts: cuts.length, shots, sheets,
    rhythm: { shots: shots.length, cutsPer10s: +((shots.length - 1) / meta.duration * 10).toFixed(2), firstCut: shots[1]?.t0 ?? null, meanShot: +(meta.duration / shots.length).toFixed(2) },
    audio: { integratedLufs: loud.integrated, speech: spoken > 0, words: spoken, wordsPerSec: +(spoken / meta.duration).toFixed(2), musicLikely: meta.audio && gapMean > -38, gapLufs: +gapMean.toFixed(1), transcript: words?.text || '' },
    motion: { mean: +(shots.reduce((s, x) => s + x.motion.score, 0) / shots.length).toFixed(3), moving: shots.filter(s => s.motion.camera !== 'static').length },
  };
  writeJSON(path.join(outDir, 'analysis.json'), res);
  say(`analysis done: ${shots.length} shots, ${res.rhythm.cutsPer10s} cuts per 10 s, ${spoken} words, motion ${res.motion.mean}`);
  return res;
}
