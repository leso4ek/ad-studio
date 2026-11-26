// 24601 · pilot "The Candlesticks": the edit, in two passes.
//   pass 1 (this file): the cut — cold open (clip 3's opening + a held push-in), clips 1–3 trimmed, the tag; the
//           sound — MAGI-2's native dialogue and ambience, Jonah's cold-open V.O., clip 2's "You should" re-voiced
//           (MAGI gave it Myles's voice), room tone under the patch, a low sting on the tag; comic caption boxes and
//           SFX lettering burned from cards.ass.
//   pass 2: the app's edit engine (studio/server/engines/edit.mjs render): word captions + −14 LUFS.
// usage: node ads/24601/production/edit/build.mjs [--pass1-only]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, ffmpeg7, run } from '../../../../studio/server/util.mjs';
import * as ED from '../../../../studio/server/engines/edit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = path.join(HERE, '..'), M = path.join(P, 'magi'), V = path.join(P, 'voices'), OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const cfg = loadConfig(), ff = await ffmpeg7(cfg);
const W = 1080, H = 1920, FPS = 25;

// ---- the timeline (seconds). Sources are 25 fps; every boundary sits on a frame.
const CO = 4.8;                                   // cold open: clip 3 0–2.6 s, then a held push-in on 2.6 s
const C1 = { src: 'clip1.mp4', t0: 0.5, t1: 12.0 };  // rain street
const C2 = { src: 'clip2.mp4', t0: 0.0, t1: 12.0 };  // soup kitchen
const C3 = { src: 'clip3.mp4', t0: 1.6, t1: 12.2 };  // el platform (the cold open already showed 0–1.6)
const TAG = 2.5;
const at = {}; let t = CO;
for (const [k, c] of Object.entries({ C1, C2, C3 })) { at[k] = t; t += c.t1 - c.t0; }
at.TAG = t; const TOTAL = +(t + TAG).toFixed(3);
// clip 2: MAGI spoke "You should" (3.25–4.70 s) in Myles's voice → mute it, lay room tone, place Jonah's take
const PATCH = { mute0: 3.22, mute1: 4.72, line: 3.20, tone0: 5.2 };

// ---- cards: comic caption boxes (black on yellow), SFX lettering, the tag
const tc = s => { const cs = Math.round(s * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
const cards = [
  ['Box', 0.0, 1.9, 300, 290, '24601', 'fs170'],
  ['Sfx', 0.95, 1.75, 300, 1330, 'CLANG!', 'frz9'],
  ['Box', 3.3, CO, 320, 290, '4 HOURS\\NEARLIER', 'fs92'],
  ['BoxL', at.C2 + 7.8, at.C2 + 9.4, 70, 300, '3 A.M.', 'fs84'],
  ['BoxL', at.C3, at.C3 + 1.5, 70, 300, 'DAWN', 'fs84'],
  ['Tag', at.TAG + 0.05, TOTAL, 540, 860, 'PART 2', 'fs230'],
  ['Credit', at.TAG + 0.25, TOTAL, 540, 1060, 'Inspired by Les Misérables\\Nby Victor Hugo', ''],
];
const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Box,Bangers,96,&H00101010,&H00101010,&H0000D4FF,&H00000000,0,0,0,0,100,100,4,0,3,22,10,5,40,40,0,1
Style: BoxL,Bangers,84,&H00101010,&H00101010,&H0000D4FF,&H00000000,0,0,0,0,100,100,3,0,3,18,8,4,40,40,0,1
Style: Sfx,Bangers,150,&H00FFFFFF,&H00FFFFFF,&H00B400FF,&H00000000,0,0,0,0,100,100,6,0,1,10,8,5,40,40,0,1
Style: Tag,Bangers,230,&H0000D4FF,&H0000D4FF,&H00000000,&H00000000,0,0,0,0,100,100,8,0,1,12,10,5,40,40,0,1
Style: Credit,Archivo Black,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,4,0,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${cards.map(([st, a, b, x, y, text, extra]) => `Dialogue: 1,${tc(a)},${tc(b)},${st},,0,0,0,,{\\pos(${x},${y})${extra ? '\\' + extra : ''}${st === 'Sfx' ? '\\t(0,180,\\fscx118\\fscy118)\\t(180,360,\\fscx100\\fscy100)' : ''}${st === 'Tag' ? '\\fad(120,0)' : ''}}${text}`).join('\n')}
`;
const cardsAss = path.join(OUT, 'cards.ass'); fs.writeFileSync(cardsAss, ass);
const esc = p => p.replace(/[:\\']/g, m => '\\' + m);

// ---- pass 1
const pass1 = path.join(OUT, 'pass1.mp4');
const inputs = ['-i', path.join(M, 'clip3.mp4'), '-i', path.join(M, C1.src), '-i', path.join(M, C2.src), '-i', path.join(M, C3.src),
  '-i', path.join(V, 'jonah.mp3'), '-i', path.join(V, 'jonah_youshould.mp3')];
const norm = `scale=${W}:${H},setsar=1,fps=${FPS},format=yuv420p`;
const v = [
  // cold open: clip 3 0–2.6 s, the last frame held, a slow push-in over all of it
  `[0:v]trim=0:2.6,setpts=PTS-STARTPTS,${norm},tpad=stop_mode=clone:stop_duration=${(CO - 2.6).toFixed(2)},zoompan=z='1+0.0016*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}[v0]`,
  `[1:v]trim=${C1.t0}:${C1.t1},setpts=PTS-STARTPTS,${norm}[v1]`,
  `[2:v]trim=${C2.t0}:${C2.t1},setpts=PTS-STARTPTS,${norm}[v2]`,
  `[3:v]trim=${C3.t0}:${C3.t1},setpts=PTS-STARTPTS,${norm},split[v3][v3t]`,
  // the tag: her last frame, darkened, held
  `[v3t]trim=start=${(C3.t1 - C3.t0 - 0.04).toFixed(2)},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${TAG},trim=0:${TAG},eq=brightness=-0.32:saturation=0.6,gblur=sigma=6[v4]`,
  `[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[vc]`,
  `[vc]ass=${esc(cardsAss)}:fontsdir=${esc(ED.FONTS)}[vout]`,
];
const ms = s => Math.round(s * 1000);
const a = [
  // cold open bed: clip 3's own sound to 2.6 s, then brown-noise wind under the held frame
  `[0:a]atrim=0:2.6,asetpts=N/SR/TB,aresample=48000,volume=-6dB,afade=t=out:st=2.3:d=0.3[a0a]`,
  `anoisesrc=color=brown:amplitude=0.05:d=${(CO - 2.3).toFixed(2)}:r=48000,lowpass=f=500,afade=t=in:d=0.3,afade=t=out:st=${(CO - 2.6).toFixed(2)}:d=0.2[a0b]`,
  `[a0a][a0b]acrossfade=d=0.3[a0bed]`,
  // Jonah's V.O.: "One more mistake and I die in a cell." + "So why am I holding his silver?" with a shorter pause
  `[4:a]atrim=0:2.12,asetpts=N/SR/TB,aresample=48000[voA]`, `[4:a]atrim=2.86:4.78,asetpts=N/SR/TB,aresample=48000,afade=t=in:d=0.02[voB]`,
  `[voA]apad=pad_dur=0.32[voA2]`, `[voA2][voB]concat=n=2:v=0:a=1,adelay=120|120,volume=2dB[vo]`,
  `[a0bed][vo]amix=inputs=2:duration=longest:normalize=0,apad,atrim=0:${CO}[a0]`,
  `[1:a]atrim=${C1.t0}:${C1.t1},asetpts=N/SR/TB,aresample=48000,afade=t=in:d=0.03[a1]`,
  // clip 2 with the patch
  `[2:a]atrim=${C2.t0}:${C2.t1},asetpts=N/SR/TB,aresample=48000,volume='if(between(t,${PATCH.mute0},${PATCH.mute1}),0,1)':eval=frame[a2m]`,
  `[2:a]atrim=${PATCH.tone0}:${PATCH.tone0 + PATCH.mute1 - PATCH.mute0},asetpts=N/SR/TB,aresample=48000,afade=t=in:d=0.04,afade=t=out:st=${(PATCH.mute1 - PATCH.mute0 - 0.04).toFixed(2)}:d=0.04,adelay=${ms(PATCH.mute0)}|${ms(PATCH.mute0)}[a2t]`,
  `[5:a]aresample=48000,volume=1dB,adelay=${ms(PATCH.line)}|${ms(PATCH.line)}[a2l]`,
  `[a2m][a2t][a2l]amix=inputs=3:duration=first:normalize=0[a2]`,
  `[3:a]atrim=${C3.t0}:${C3.t1},asetpts=N/SR/TB,aresample=48000,afade=t=in:d=0.03[a3]`,
  // the tag sting: a low hit that decays
  `sine=f=48:d=${TAG}:r=48000,volume='0.9*exp(-1.6*t)':eval=frame[s1]`, `anoisesrc=color=pink:amplitude=0.25:d=0.5:r=48000,lowpass=f=900,afade=t=out:d=0.5[s2]`,
  `[s1][s2]amix=inputs=2:duration=first:normalize=0,aformat=channel_layouts=stereo[a4]`,
  `[a0]aformat=channel_layouts=stereo[a0s]`, `[a1]aformat=channel_layouts=stereo[a1s]`, `[a2]aformat=channel_layouts=stereo[a2s]`, `[a3]aformat=channel_layouts=stereo[a3s]`,
  `[a0s][a1s][a2s][a3s][a4]concat=n=5:v=0:a=1[aout]`,
];
let r = await run(ff, ['-y', '-v', 'error', ...inputs, '-filter_complex', [...v, ...a].join(';'), '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', pass1]);
if (r.code) { console.error(r.err.slice(-1500)); process.exit(1); }
console.log(`pass 1: ${pass1} (${TOTAL} s) · clip1 @${at.C1.toFixed(2)} clip2 @${at.C2.toFixed(2)} clip3 @${at.C3.toFixed(2)} tag @${at.TAG.toFixed(2)}`);
fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ CO, C1, C2, C3, TAG, at, TOTAL, PATCH }, null, 1));
if (process.argv.includes('--pass1-only')) process.exit(0);

// ---- pass 2: the app's edit engine — word captions in the comic look, −14 LUFS, no music (MAGI's sound is the bed)
const wordsFile = path.join(OUT, 'words.json');
if (!fs.existsSync(wordsFile)) {
  r = await run(path.join(cfg.lib, '.venv', 'bin', 'python'), ['-I', path.join(ED.FONTS, '..', '..', 'tools', 'transcribe.py'), pass1, wordsFile, '--model', 'small.en', '--lang', 'en']);
  if (r.code) { console.error(r.err.slice(-800)); process.exit(1); }
}
let words = JSON.parse(fs.readFileSync(wordsFile, 'utf8')).words;
// how the number is said, not how Whisper spells it; and the tag carries no captions
const spoken = [];
for (let i = 0; i < words.length; i++) {
  const w = words[i];
  if (/^24$/.test(w.w) && words[i + 3] && /^-?1/.test(words[i + 3].w)) {
    const e = words[i + 3]; spoken.push({ ...w, w: 'TWENTY-FOUR', t1: words[i + 1].t0 }, { ...words[i + 1], w: 'SIX-OH-ONE.', t1: e.t1 }); i += 3; continue;
  }
  if (w.t0 < at.TAG) spoken.push(w);
}
// Whisper starts a line's first word late after a pause (0.3–0.4 s here): snap it to the measured speech onset
// (silencedetect on the voice band), so no caption trails the mouth by more than a frame or two at 30 fps.
const sd = await run(ff, ['-hide_banner', '-nostats', '-i', pass1, '-vn', '-af', 'highpass=f=150,silencedetect=noise=-32dB:d=0.25', '-f', 'null', '-']);
const onsets = [...(sd.err || '').matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
spoken.forEach((w, i) => {
  if (i && w.t0 - spoken[i - 1].t1 < 0.3) return;
  const o = onsets.filter(o => o <= w.t0 + 0.05 && o >= w.t0 - 0.5 && (!i || o > spoken[i - 1].t1)).pop();
  if (o !== undefined) w.t0 = +o.toFixed(3);
});
fs.writeFileSync(path.join(OUT, 'words.captions.json'), JSON.stringify(spoken, null, 1));
const style = {
  caption: { font: 'Bangers', sizePct: 7.6, yPct: 82, color: '#FFFFFF', outline: '#120A2A', outlinePx: 7, highlight: '#FFD400', wordsPerCaption: 2, uppercase: true },
  music: { use: false },
};
const final = path.join(OUT, '24601-ep01-the-candlesticks.mp4');
const res = await ED.render(cfg, pass1, spoken, { keep: [], emphasis: ['silver', 'father', 'given', 'twenty-four', 'six-oh-one.'], music: { use: false }, reframe: 'none' }, final, { style, slug: '24601', stage: 'edit' });
// the engine's one-pass loudnorm lands about 1 LU low on this mix: a measured second pass brings it to −14 LUFS
const m = await run(ff, ['-hide_banner', '-nostats', '-i', final, '-vn', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
const j = JSON.parse(/\{[^{}]*"input_i"[^{}]*\}/.exec(m.err || '')[0]);
const tmp = final.replace(/\.mp4$/, '.tmp.mp4');
r = await run(ff, ['-y', '-v', 'error', '-i', final, '-c:v', 'copy', '-af', `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=48000`, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp]);
if (r.code) { console.error(r.err.slice(-800)); process.exit(1); }
fs.renameSync(tmp, final);
console.log(`final: ${res.file} (${res.seconds} s), loudness pass from ${j.input_i} LUFS`);
