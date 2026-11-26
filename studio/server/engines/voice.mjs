// Ad Studio · voice engines, tried in the order config.chains.voice gives:
//   voicestudio  local VoiceStudio backend (github.com/debpalash/voicestudio), OpenAI-compatible: POST /v1/audio/speech
//   kokoro       Kokoro on the CPU through the Lemo-Opuscar library (core/tts/tts.py)
//   elevenlabs   ElevenLabs free tier, premade voices only; off unless config.elevenlabs.enabled and ELEVENLABS_API_KEY in studio/.env
// and speech-to-text checks (config.chains.asr): voicestudio (/v1/audio/transcriptions) → whisper (library core/tts/asr_check.py)
import fs from 'fs';
import path from 'path';
import { run, writeJSON, readJSON, loadEnv } from '../util.mjs';
import { emit } from '../bus.mjs';

const KOKORO = { narrator: 'af_heart', f: ['af_bella', 'af_nicole', 'bf_emma'], m: ['am_michael', 'am_adam', 'bm_george'] };

async function http(url, opts = {}, ms = 8000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); } finally { clearTimeout(t); }
}

export const engines = {
  voicestudio: {
    async available(cfg) {
      try { const r = await http(`${cfg.voicestudio.url}/health`, {}, 2500); return r.ok ? { ok: true, detail: cfg.voicestudio.url } : { ok: false, why: `health ${r.status}` }; }
      catch { return { ok: false, why: `no VoiceStudio backend at ${cfg.voicestudio.url}` }; }
    },
    async speak(cfg, lines, outDir) {
      const durs = {};
      for (const L of lines) {
        const r = await http(`${cfg.voicestudio.url}/v1/audio/speech`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(cfg) },
          body: JSON.stringify({ model: 'tts-1', voice: L.vsVoice || cfg.voicestudio.voice || 'alloy', input: L.text, response_format: 'wav', speed: L.speed || 1 }) }, 180000);
        if (!r.ok) throw new Error(`VoiceStudio ${r.status}: ${(await r.text()).slice(0, 200)}`);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.slice(0, 4).toString() !== 'RIFF') throw new Error('VoiceStudio did not return a wav');
        const p = path.join(outDir, `${L.id}.wav`); fs.writeFileSync(p, buf); durs[L.id] = wavDur(buf);
      }
      writeJSON(path.join(outDir, 'dur.json'), durs); return durs;
    },
    async transcribe(cfg, wav) {
      const fd = new FormData(); fd.append('file', new Blob([fs.readFileSync(wav)]), path.basename(wav)); fd.append('model', 'whisper-1'); fd.append('response_format', 'verbose_json');
      const r = await http(`${cfg.voicestudio.url}/v1/audio/transcriptions`, { method: 'POST', body: fd, headers: auth(cfg) }, 180000);
      if (!r.ok) throw new Error(`VoiceStudio transcription ${r.status}`);
      return r.json();
    },
  },
  kokoro: {
    async available(cfg) {
      const ok = fs.existsSync(path.join(cfg.lib, 'core', 'tts', 'kokoro-v1.0.onnx')) && fs.existsSync(path.join(cfg.lib, '.venv', 'bin', 'python'));
      return ok ? { ok: true, detail: 'Kokoro (CPU, offline)' } : { ok: false, why: 'Kokoro model missing: setup.sh deps voice' };
    },
    async speak(cfg, lines, outDir, { signal, slug, stage } = {}) {
      const lj = path.join(outDir, 'kokoro-lines.json');
      writeJSON(lj, lines.map(L => ({ id: L.id, text: L.text, voice: L.kVoice, speed: L.speed })));
      const r = await run(path.join(cfg.lib, '.venv', 'bin', 'python'), ['-I', path.join(cfg.lib, 'core', 'tts', 'tts.py'), lj, outDir], { cwd: cfg.lib, signal, onLine: l => l.trim() && emit('engine', { slug, stage, engine: 'kokoro', text: l.slice(0, 160) }) });
      if (r.code !== 0) throw new Error(`Kokoro failed: ${(r.err || r.out).slice(-400)}`);
      return readJSON(path.join(outDir, 'dur.json'), {});
    },
  },
  elevenlabs: {
    async available(cfg) {
      if (!cfg.elevenlabs?.enabled) return { ok: false, why: 'off (config.elevenlabs.enabled)' };
      return loadEnv().ELEVENLABS_API_KEY ? { ok: true, detail: 'free tier, premade voices' } : { ok: false, why: 'ELEVENLABS_API_KEY not in studio/.env' };
    },
    async speak(cfg, lines, outDir) {
      const key = loadEnv().ELEVENLABS_API_KEY, durs = {};
      for (const L of lines) {
        const voice = L.elVoice || cfg.elevenlabs.voices?.narrator;
        const r = await http(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=pcm_24000`, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: L.text, model_id: cfg.elevenlabs.model || 'eleven_multilingual_v2' }) }, 120000);
        if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
        const pcm = Buffer.from(await r.arrayBuffer()), wav = pcmToWav(pcm, 24000);
        fs.writeFileSync(path.join(outDir, `${L.id}.wav`), wav); durs[L.id] = pcm.length / 2 / 24000;
      }
      writeJSON(path.join(outDir, 'dur.json'), durs); return durs;
    },
  },
};

function auth(cfg) { const k = loadEnv().VOICESTUDIO_API_KEY; return k ? { Authorization: `Bearer ${k}` } : {}; }
function wavDur(buf) { const ch = buf.readUInt16LE(22), sr = buf.readUInt32LE(24), bits = buf.readUInt16LE(34); let i = 12; while (i < buf.length - 8) { const id = buf.slice(i, i + 4).toString(), sz = buf.readUInt32LE(i + 4); if (id === 'data') return sz / (sr * ch * bits / 8); i += 8 + sz; } return 0; }
function pcmToWav(pcm, sr) { const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); }

/** Assigns each line a voice per engine (narrator, then cast members alternate female/male voices). */
export function castVoices(bible) {
  const cast = bible.cast || {}, ids = Object.keys(cast); let f = 0, m = 0;
  const pick = {};
  for (const id of ids) {
    const c = cast[id];
    if (c.voice) { pick[id] = c.voice; continue; }
    const fem = /\b(she|her|woman|girl|mum|mom|female)\b/i.test(c.role || '') || ['bob', 'long', 'bun'].includes(c.hairStyle);
    pick[id] = fem ? KOKORO.f[f++ % KOKORO.f.length] : KOKORO.m[m++ % KOKORO.m.length];
  }
  return (bible.vo?.lines || []).map(L => {
    const narr = !L.speaker || L.speaker === 'narrator';
    return { ...L, kVoice: narr ? (bible.vo.voice || KOKORO.narrator) : pick[L.speaker] || KOKORO.narrator, speed: L.speed || bible.vo.speed || .95,
      vsVoice: narr ? bible.vo.vsVoice : cast[L.speaker]?.vsVoice, elVoice: narr ? undefined : cast[L.speaker]?.elVoice };
  });
}

export async function checkSpeech(cfg, lines, outDir, { chain, signal, slug, stage }) {
  for (const name of chain) {
    if (name === 'voicestudio') {
      const a = await engines.voicestudio.available(cfg); if (!a.ok) { emit('engine', { slug, stage, engine: 'asr', text: `voicestudio: ${a.why} → next` }); continue; }
      const res = {}; for (const L of lines) { const j = await engines.voicestudio.transcribe(cfg, path.join(outDir, `${L.id}.wav`)); res[L.id] = { heard: j.text, ok: same(j.text, L.text) }; }
      return { engine: 'voicestudio', lines: res, pass: Object.values(res).every(x => x.ok) };
    }
    if (name === 'whisper') {
      const lj = path.join(outDir, 'asr-lines.json'); writeJSON(lj, lines.map(L => ({ id: L.id, text: L.text, ...(L.asr ? { asr: L.asr } : {}) })));
      const r = await run(path.join(cfg.lib, '.venv', 'bin', 'python'), ['-I', path.join(cfg.lib, 'core', 'tts', 'asr_check.py'), lj, outDir, '--lang', 'en', '--model', cfg.whisperModel || 'base'], { cwd: cfg.lib, signal });
      if (/No module named|ModuleNotFoundError/.test(r.err)) { emit('engine', { slug, stage, engine: 'asr', text: 'whisper not installed → no speech check' }); continue; }
      const report = (r.out + r.err).trim().split('\n').slice(-20).join('\n'), diffs = whisperDiffs(report);
      // a DIFF that only differs in how numbers are written ("nine" vs "9") is not a misread
      const real = diffs.filter(d => !sameSpoken(d.want, d.heard));
      const pass = r.code === 0 || (diffs.length > 0 && real.length === 0);
      return { engine: 'whisper', pass, report: real.length < diffs.length ? `${report}\n(${diffs.length - real.length} diff(s) only in number spelling: counted as OK)` : report, words: readJSON(path.join(outDir, 'words.json'), null) };
    }
  }
  return { engine: 'none', pass: null, report: 'no speech-to-text engine available' };
}
const NUM = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ');
/** Parses the library checker's "DIFF id | wanted → heard" lines. Pure. */
export function whisperDiffs(report) { return String(report).split('\n').map(l => l.match(/^DIFF\s+(\S+)\s*\|\s*(.*?)\s*→\s*(.*)$/)).filter(Boolean).map(m => ({ id: m[1], want: m[2], heard: m[3] })); }
/** Same words once case, punctuation and number spelling (words ↔ digits, 0-20) are ignored. Pure. */
export function sameSpoken(a, b) { const n = s => norm(s).split(' ').map(w => (NUM.indexOf(w) >= 0 ? String(NUM.indexOf(w)) : w)).join(' '); return n(a) === n(b); }
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function same(a, b) { const A = norm(a).split(' '), B = norm(b).split(' '); let hit = 0; for (const w of B) if (A.includes(w)) hit++; return hit / Math.max(1, B.length) >= .85; }

/** Caption chunks (≤ 38 characters, at word boundaries) timed from the word timings when there are any, else by length. */
export function buildCues(lines, durs, words) {
  const cues = [];
  for (const L of lines) {
    const d = durs[L.id] || 0, t0 = L.at, wl = words?.[L.id];
    // sentences first; a sentence longer than 56 characters (two caption lines) splits at a comma, else in balanced halves
    const parts = [];
    for (const sent of L.text.match(/[^.!?]+[.!?]*\s*/g) || [L.text]) {
      const t = sent.trim(); if (!t) continue;
      if (t.length <= 56) { parts.push(t); continue; }
      const c = t.indexOf(', ', t.length * .3);
      if (c > 0 && c < t.length * .7) { parts.push(t.slice(0, c + 1)); parts.push(t.slice(c + 2)); continue; }
      const w = t.split(' '), half = Math.ceil(w.length / 2); parts.push(w.slice(0, half).join(' ')); parts.push(w.slice(half).join(' '));
    }
    const total = parts.reduce((s, p) => s + p.length, 0); let acc = 0, wi = 0;
    for (const p of parts) {
      const n = p.split(' ').length;
      let a = t0 + d * acc / total, b = t0 + d * (acc + p.length) / total;
      if (Array.isArray(wl) && wl.length === L.text.split(/\s+/).length && wl[wi] && wl[wi + n - 1]) { a = t0 + Math.max(0, wl[wi][1]); b = t0 + Math.min(d, wl[wi + n - 1][2]); }   // words.json: [word, start, end]
      cues.push({ t0: +a.toFixed(3), t1: +(b + .12).toFixed(3), text: p, speaker: L.speaker || 'narrator', line: L.id });
      acc += p.length; wi += n;
    }
  }
  // no gaps under a quarter second between chunks of the same line, no overlaps
  cues.sort((x, y) => x.t0 - y.t0);
  for (let i = 0; i < cues.length - 1; i++) { if (cues[i + 1].t0 - cues[i].t1 < .25 && cues[i].line === cues[i + 1].line) cues[i].t1 = cues[i + 1].t0; if (cues[i].t1 > cues[i + 1].t0) cues[i].t1 = cues[i + 1].t0; }
  return cues;
}

export function srt(cues) {
  const ts = s => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  return cues.map((c, i) => `${i + 1}\n${ts(c.t0)} --> ${ts(c.t1)}\n${c.text}\n`).join('\n');
}
