// Ad Studio · engine "edit": Claude edits real footage the way the @viralex.aii workflow does (research/teardowns/TOOLS.md):
//   reference reels → style (exact values) · faster-whisper word times · silence + slip detection · Claude's edit decision
//   list (keep ranges, emphasis words, title, music) · ffmpeg render: kept ranges concatenated, 9:16 reframe (blurred fill
//   or centre crop), word-by-word ASS captions burned with libass, a synthesized music bed ducked under the voice,
//   −14 LUFS · draft-vN.mp4 + edit-notes.md, revised from plain-language notes.
// The pure parts (cut proposal, time mapping, ASS) are unit-tested.
import fs from 'fs';
import path from 'path';
import { run, ffmpeg7, STUDIO, readJSON, writeJSON } from '../util.mjs';
import { emit } from '../bus.mjs';
import * as AN from './analyse.mjs';

export const FONTS = path.join(STUDIO, 'kit', 'fonts');
/** the default look: word captions from the viral research (1-3 words, centre-low, one emphasis colour) */
export const DEFAULT_STYLE = {
  caption: { font: 'Archivo Black', sizePct: 6.2, yPct: 66, color: '#FFFFFF', outline: '#000000', outlinePx: 6, highlight: '#FFD400', wordsPerCaption: 2, uppercase: true },
  title: { font: 'Archivo Black', sizePct: 5.2, yPct: 18, color: '#FFFFFF', box: '#000000AA' },
  pace: { maxPause: 0.45, keepPauseAfterQuestion: 0.6, pad: 0.06 },
  music: { mood: 'lofi', levelDb: -22, duck: true },
  reframe: 'blur',
};

/** Silences from ffmpeg silencedetect: [{t0, t1}] */
export async function silences(cfg, file, { noiseDb = -34, minDur = 0.3 } = {}) {
  const ff = await ffmpeg7(cfg);
  const r = await run(ff, ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', `silencedetect=noise=${noiseDb}dB:d=${minDur}`, '-f', 'null', '-']);
  const out = [], txt = r.err || ''; let start = null;
  for (const line of txt.split('\n')) {
    const a = /silence_start: (-?[\d.]+)/.exec(line); if (a) start = Math.max(0, +a[1]);
    const b = /silence_end: ([\d.]+)/.exec(line); if (b && start !== null) { out.push({ t0: +start.toFixed(3), t1: +(+b[1]).toFixed(3) }); start = null; }
  }
  return out;
}

/**
 * Proposed keep ranges: cut every pause longer than maxPause (from word gaps, confirmed by silence where available),
 * never inside a word, keep a little breath (pad), keep a longer pause after a question. Pure.
 */
export function proposeCuts(words, dur, { maxPause = .45, pad = .06, keepPauseAfterQuestion = .6, silences: sil = [] } = {}) {
  if (!words.length) return [{ t0: 0, t1: +dur.toFixed(3) }];
  const keep = []; let cur = { t0: Math.max(0, words[0].t0 - pad) };
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i], n = words[i + 1], gap = n.t0 - w.t1, allowed = /\?$/.test(w.w) ? keepPauseAfterQuestion : maxPause;
    const silent = !sil.length || sil.some(s => s.t0 <= w.t1 + .1 && s.t1 >= n.t0 - .1);
    if (gap > allowed && silent) { cur.t1 = w.t1 + pad; keep.push(cur); cur = { t0: n.t0 - pad }; }
  }
  cur.t1 = Math.min(dur, words.at(-1).t1 + pad); keep.push(cur);
  return keep.map(k => ({ t0: +Math.max(0, k.t0).toFixed(3), t1: +Math.min(dur, k.t1).toFixed(3) })).filter(k => k.t1 - k.t0 > .05);
}

/** Checks Claude's keep ranges: ordered, no overlap, no boundary inside a word. Returns problems. */
export function checkKeep(keep, words) {
  const errs = [];
  keep.forEach((k, i) => {
    if (!(k.t1 > k.t0)) errs.push(`range ${i + 1} is empty or reversed`);
    if (i && k.t0 < keep[i - 1].t1 - 1e-3) errs.push(`range ${i + 1} overlaps the one before`);
    for (const t of [k.t0, k.t1]) { const w = words.find(w => t > w.t0 + .04 && t < w.t1 - .04); if (w) errs.push(`range ${i + 1} cuts inside the word "${w.w}" at ${t.toFixed(2)} s`); }
  });
  return errs;
}

/** source time → output time through the kept ranges (null when the moment was cut) */
export function mapTime(t, keep) {
  let acc = 0;
  for (const k of keep) { if (t >= k.t0 - 1e-6 && t <= k.t1 + 1e-6) return acc + (t - k.t0); acc += k.t1 - k.t0; }
  return null;
}

const assTime = t => { const cs = Math.max(0, Math.round(t * 100)); const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60, c = cs % 100; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`; };
// '#RRGGBB' (opaque) or '#RRGGBBAA' (CSS alpha, FF = opaque) → ASS '&HAABBGGRR' (ASS alpha 00 = opaque)
export const assColor = hex => { const h = hex.replace('#', ''), a = h.length === 8 ? 255 - parseInt(h.slice(6, 8), 16) : 0; return `&H${a.toString(16).padStart(2, '0')}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase(); };
const assEsc = s => String(s).replace(/[{}\\]/g, '').replace(/\n/g, '\\N');

/**
 * Word-by-word captions as ASS on the output timeline (1080×1920): chunks of N words, the current word in the
 * highlight colour, emphasis words always highlighted, an optional title card at the top. Pure.
 */
export function buildAss(words, keep, style = DEFAULT_STYLE, { emphasis = [], title = null, W = 1080, H = 1920 } = {}) {
  const c = { ...DEFAULT_STYLE.caption, ...(style.caption || {}) }, tt = { ...DEFAULT_STYLE.title, ...(style.title || {}) };
  const size = Math.round(H * c.sizePct / 100), y = Math.round(H * c.yPct / 100);
  const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
    `Style: Cap,${c.font},${size},${assColor(c.color)},${assColor(c.highlight)},${assColor(c.outline)},&H80000000,0,0,0,0,100,100,0,0,1,${c.outlinePx},2,5,60,60,0,1\n` +
    `Style: Title,${tt.font},${Math.round(H * tt.sizePct / 100)},${assColor(tt.color)},${assColor(tt.color)},${assColor('#000000')},${assColor(tt.box || '#000000AA')},0,0,0,0,100,100,0,0,3,18,0,8,80,80,${Math.round(H * tt.yPct / 100)},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const ev = [], emph = new Set(emphasis.map(e => String(e).toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')));
  const kept = words.map(w => ({ ...w, a: mapTime(w.t0, keep), b: mapTime(w.t1, keep) })).filter(w => w.a !== null && w.b !== null && w.b > w.a);
  const n = Math.max(1, Math.min(4, c.wordsPerCaption | 0 || 2));
  for (let i = 0; i < kept.length; i += n) {
    const chunk = kept.slice(i, i + n), t0 = chunk[0].a, t1 = Math.max(chunk.at(-1).b, t0 + .25), end = kept[i + n]?.a ?? t1 + .3;
    chunk.forEach((w, j) => {
      const a = w.a, b = j < chunk.length - 1 ? chunk[j + 1].a : Math.min(end, t1 + .3);
      const text = chunk.map((x, k) => { const raw = c.uppercase ? x.w.toUpperCase() : x.w, hot = k === j || emph.has(x.w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')); return hot ? `{\\c${assColor(c.highlight)}}${assEsc(raw)}{\\c${assColor(c.color)}}` : assEsc(raw); }).join(' ');
      ev.push(`Dialogue: 0,${assTime(a)},${assTime(Math.max(b, a + .08))},Cap,,0,0,0,,{\\pos(${W / 2},${y})}${text}`);
    });
  }
  if (title?.text) ev.push(`Dialogue: 1,${assTime(title.t0 ?? 0)},${assTime(title.t1 ?? 2)},Title,,0,0,0,,${assEsc(title.text)}`);
  return head + ev.join('\n') + '\n';
}

/** A music bed of `seconds` in a mood, synthesized by tools/mix.py (no samples, no licences to track). */
export async function musicBed(cfg, seconds, mood, out) {
  const tmp = path.join(path.dirname(out), `.bed_${process.pid}`); fs.mkdirSync(path.join(tmp, 'voice'), { recursive: true });
  writeJSON(path.join(tmp, 'bible.json'), { dur: seconds, music: { mood: mood || 'lofi' }, vo: { lines: [] }, shots: [], sfx: [] });
  fs.writeFileSync(path.join(tmp, 'events.json'), '[]');
  const r = await run(path.join(cfg.lib, '.venv', 'bin', 'python'), ['-I', path.join(STUDIO, 'tools', 'mix.py'), '--bible', path.join(tmp, 'bible.json'), '--voice', path.join(tmp, 'voice'), '--events', path.join(tmp, 'events.json'), '--out', out, '--lib', cfg.lib], { cwd: STUDIO });
  fs.rmSync(tmp, { recursive: true, force: true });
  return r.code === 0 && fs.existsSync(out) ? out : null;
}

/**
 * Render an edit. edl = {keep:[{t0,t1}], emphasis:[words], title:{text,t0,t1}, music:{mood, levelDb, use}, reframe:'blur'|'crop'|'none'}
 * Returns {file, seconds, ass}.
 */
export async function render(cfg, src, words, edl, out, { style = DEFAULT_STYLE, slug, stage = 'edit', signal } = {}) {
  const ff = await ffmpeg7(cfg), meta = await AN.probe(src), dir = path.dirname(out); fs.mkdirSync(dir, { recursive: true });
  const keep = edl.keep?.length ? edl.keep : [{ t0: 0, t1: meta.duration }];
  const total = keep.reduce((s, k) => s + (k.t1 - k.t0), 0);
  const ass = path.join(dir, path.basename(out).replace(/\.mp4$/, '.ass'));
  fs.writeFileSync(ass, buildAss(words, keep, style, { emphasis: edl.emphasis || [], title: edl.title }));
  // video + audio per kept range, concatenated
  const parts = keep.map((k, i) => `[0:v]trim=${k.t0}:${k.t1},setpts=PTS-STARTPTS[v${i}];${meta.audio ? `[0:a]atrim=${k.t0}:${k.t1},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, k.t1 - k.t0 - .02)}:d=0.02[a${i}];` : ''}`).join('');
  const cat = keep.map((_, i) => `[v${i}]${meta.audio ? `[a${i}]` : ''}`).join('') + `concat=n=${keep.length}:v=1:a=${meta.audio ? 1 : 0}[vc]${meta.audio ? '[ac]' : ''}`;
  const rf = (edl.reframe || style.reframe || 'blur');
  const frame = rf === 'none' ? '[vc]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[vf]'
    : rf === 'crop' ? '[vc]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[vf]'
    : '[vc]split[bg0][fg0];[bg0]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.08[bg];[fg0]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[vf]';
  const subs = `[vf]ass=${ass.replace(/[:\\']/g, m => '\\' + m)}:fontsdir=${FONTS.replace(/[:\\']/g, m => '\\' + m)},fps=30,format=yuv420p[vout]`;
  const args = ['-y', '-v', 'error', '-i', src];
  let audioGraph = '';
  const mu = { ...DEFAULT_STYLE.music, ...(style.music || {}), ...(edl.music || {}) };
  if (mu.use !== false && meta.audio) {
    const bed = await musicBed(cfg, Math.ceil(total) + 1, mu.mood, path.join(dir, '.bed.wav'));
    if (bed) {
      args.push('-i', bed);
      audioGraph = `;[1:a]atrim=0:${total.toFixed(3)},volume=${mu.levelDb}dB[mus];[ac]asplit[voice][key];[mus][key]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[duck];[voice][duck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`;
    }
  }
  if (!audioGraph && meta.audio) audioGraph = ';[ac]loudnorm=I=-14:TP=-1.5:LRA=11[aout]';
  args.push('-filter_complex', `${parts}${cat};${frame};${subs}${audioGraph}`, '-map', '[vout]');
  if (meta.audio) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
  args.push('-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out);
  emit('engine', { slug, stage, engine: 'edit', text: `rendering ${keep.length} kept range(s), ${total.toFixed(1)} s, reframe ${rf}` });
  const r = await run(ff, args, { signal });
  try { fs.rmSync(path.join(dir, '.bed.wav'), { force: true }); } catch { /* none */ }
  if (r.code !== 0 || !fs.existsSync(out)) throw new Error(`edit render failed: ${(r.err || '').slice(-600)}`);
  return { file: out, seconds: +total.toFixed(2), ass };
}

/** The facts Claude needs to plan an edit: words, pauses, the proposed cuts, the shots. Writes edit/facts.json. */
export async function facts(cfg, src, dir, { slug, signal } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const meta = await AN.probe(src);
  const wj = path.join(dir, 'words.json');
  const tr = fs.existsSync(wj) ? readJSON(wj) : await AN.transcribe(cfg, src, wj, { signal });
  const words = tr?.words || [];
  const sil = meta.audio ? await silences(cfg, src) : [];
  const proposed = proposeCuts(words, meta.duration, { silences: sil });
  const f = { source: path.basename(src), duration: meta.duration, w: meta.w, h: meta.h, words: words.length, text: tr?.text || '', silences: sil, proposed, kept: +proposed.reduce((s, k) => s + k.t1 - k.t0, 0).toFixed(2) };
  writeJSON(path.join(dir, 'facts.json'), f);
  emit('engine', { slug, stage: 'edit', engine: 'edit', text: `${words.length} words, ${sil.length} pauses, proposed cut keeps ${f.kept} of ${meta.duration.toFixed(1)} s` });
  return { ...f, wordList: words };
}
