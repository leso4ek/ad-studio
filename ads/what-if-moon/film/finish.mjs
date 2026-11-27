// Finish: picture (out/part*.mp4 joined) + mix (audio/mix.wav) + word captions (the app's edit engine buildAss,
// 1920×1080) → out/what-if-moon-vanished.mp4 at −14 LUFS, plus the .srt.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { loadConfig, ffmpeg7, run } from '../../../studio/server/util.mjs';
import * as ED from '../../../studio/server/engines/edit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), AD = path.resolve(HERE, '..'), OUT = path.join(AD, 'out');
const cfg = loadConfig(), ff = await ffmpeg7(cfg);
const { T } = JSON.parse(fs.readFileSync(path.join(OUT, 'times.json'), 'utf8'));
// Whisper's spellings → the script's; no captions over the end card (it spells the next question itself)
const FIX = { break: 'brake', 'break.': 'brake.', stabilizer: 'stabiliser', 'stabilizer?': 'stabiliser?' };
const fixW = w => ({ ...w, w: FIX[w.w.toLowerCase()] ? (w.w[0] === w.w[0].toUpperCase() ? FIX[w.w.toLowerCase()][0].toUpperCase() + FIX[w.w.toLowerCase()].slice(1) : FIX[w.w.toLowerCase()]) : w.w });
const allWords = JSON.parse(fs.readFileSync(path.join(AD, 'voice', 'words.json'), 'utf8')).words.map(fixW);
const words = allWords.filter(w => w.t0 < T.next - .05);

// 1. picture: join the chunks
const parts = fs.readdirSync(OUT).filter(f => /^part\d+\.mp4$/.test(f)).sort();
fs.writeFileSync(path.join(OUT, 'parts.txt'), parts.map(p => `file '${path.join(OUT, p)}'`).join('\n'));
const pic = path.join(OUT, 'picture.mp4');
let r = await run(ff, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'parts.txt'), '-c', 'copy', pic]);
if (r.code) throw new Error(r.err);

// 2. captions: 3 words a chunk, low and small (16:9 long-form), yellow on the spoken word
const style = { caption: { font: 'Archivo Black', sizePct: 4.6, yPct: 92, color: '#FFFFFF', outline: '#17171C', outlinePx: 5, highlight: '#FFD447', wordsPerCaption: 3, uppercase: true } };
const ass = path.join(OUT, 'captions.ass');
fs.writeFileSync(ass, ED.buildAss(words, [{ t0: 0, t1: T.END }], style, { W: 1920, H: 1080, emphasis: ['moon', 'third', 'calendar', 'brake', 'stabiliser', 'seasons', 'nothing'] }));
const esc = p => p.replace(/[:\\']/g, m => '\\' + m);

// 3. mux + captions + loudness (measured two-pass)
const tmp = path.join(OUT, 'tmp_mux.mp4'), final = path.join(OUT, 'what-if-moon-vanished.mp4');
r = await run(ff, ['-y', '-v', 'error', '-i', pic, '-i', path.join(AD, 'audio', 'mix.wav'), '-filter_complex', `[0:v]ass=${esc(ass)}:fontsdir=${esc(ED.FONTS)},format=yuv420p[v]`, '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-c:a', 'pcm_s16le', '-shortest', tmp.replace('.mp4', '.mov')]);
if (r.code) throw new Error(r.err);
const m = await run(ff, ['-hide_banner', '-nostats', '-i', tmp.replace('.mp4', '.mov'), '-vn', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
const j = JSON.parse(/\{[^{}]*"input_i"[^{}]*\}/.exec(m.err)[0]);
r = await run(ff, ['-y', '-v', 'error', '-i', tmp.replace('.mp4', '.mov'), '-c:v', 'copy', '-af', `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=48000`, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final]);
if (r.code) throw new Error(r.err);
fs.rmSync(tmp.replace('.mp4', '.mov'));

// 4. .srt (one cue per spoken line)
const lines = []; let cur = [];
for (const w of allWords) { if (cur.length && w.t0 - cur.at(-1).t1 > .35) { lines.push(cur); cur = []; } cur.push(w); } if (cur.length) lines.push(cur);
const ts = t => { const ms = Math.round(t * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
fs.writeFileSync(path.join(OUT, 'what-if-moon-vanished.srt'), lines.map((l, i) => `${i + 1}\n${ts(l[0].t0)} --> ${ts(l.at(-1).t1 + .2)}\n${l.map(w => w.w).join(' ')}\n`).join('\n'));
console.log(`final: ${final} (loudness pass from ${j.input_i} LUFS)`);
