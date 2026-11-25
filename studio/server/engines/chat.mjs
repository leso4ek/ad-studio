// Ad Studio · engine "chat": live-stream chat replay → the moments chat exploded, plus the build-up before them.
//   fetch: chat-downloader (MIT; Twitch + YouTube chat replay, no login) · Kick: its public API (best effort)
//   parse: chat-downloader JSON, TwitchDownloader JSON, yt-dlp live_chat.json (YouTube), Kick messages, CSV/TSV/plain
//   signals per second: messages, laughter, hype, "clip it", caps, first-time chatters → a burst score (z against a
//   rolling baseline) → peaks → windows [peak − delay − pre, peak − delay + post]; the chat delay is estimated by
//   matching the chat rate to the audio loudness. Research basis: LIGHTOR (chat bursts in sliding windows) and
//   MINT (chat + emotes as highlight signals); research/viral/clip-rubric.md has the measured pre/post numbers.
import fs from 'fs';
import path from 'path';
import { run, STUDIO } from '../util.mjs';

export const LAUGH = /(\bLUL[W]?\b|\bKEKW?\b|\bOMEGALUL\b|\bICANT\b|\bLMF?AO+\b|\bxD+\b|\b(?:ha){2,}h?\b|\bjaja+\b|\bhehe+\b|😂|🤣|💀|😭)/i;
export const HYPE = /(\bPOG(?:GERS|CHAMP)?\b|\bLET'?S+ GO+\b|\bW+\b|\bNO WAY\b|\bWTF\b|\bOMG\b|\bHOLY\b|\bINSANE\b|\bGG\b|!!!|🔥|😱|🤯)/i;
export const CLIPIT = /\bclip (?:it|that|this)\b|\bclipped\b/i;

const num = v => (typeof v === 'number' ? v : parseFloat(v));
const hms = s => { const p = String(s).trim().split(':').map(Number); return p.some(isNaN) ? NaN : p.reduce((a, b) => a * 60 + b, 0); };

/** Any chat export → [{t, user, msg}] sorted by t (seconds from the start of the VOD). startIso: the stream start, for absolute times (Kick). */
export function parseChat(text, { startIso } = {}) {
  const out = [], start = startIso ? Date.parse(startIso) : null, push = (t, user, msg) => { if (Number.isFinite(t) && t >= 0 && msg) out.push({ t: +t.toFixed(3), user: String(user || ''), msg: String(msg) }); };
  const trimmed = text.trim();
  let json = null; if (!/^\{"replayChatItemAction"|"replayChatItemAction"/.test(trimmed.slice(0, 200))) try { json = JSON.parse(trimmed); } catch { /* not one JSON document */ }
  if (json) {
    const arr = Array.isArray(json) ? json : json.comments || json.data?.messages || json.messages || json.items || [];
    for (const m of arr) {
      if (m.content_offset_seconds !== undefined) push(num(m.content_offset_seconds), m.commenter?.display_name || m.commenter?.name, m.message?.body ?? m.message?.fragments?.map(f => f.text).join(''));   // TwitchDownloader
      else if (m.time_in_seconds !== undefined) push(num(m.time_in_seconds), m.author?.name, m.message);                                                                                              // chat-downloader
      else if (m.created_at && start !== null) push((Date.parse(m.created_at) - start) / 1000, m.sender?.username, m.content);                                                                        // Kick
      else if (m.t !== undefined) push(num(m.t), m.user, m.msg ?? m.message);                                                                                                                         // ours
    }
  } else if (/replayChatItemAction/.test(trimmed)) {                                                                                                                                               // yt-dlp live_chat.json (JSON lines)
    for (const line of trimmed.split('\n')) {
      let o; try { o = JSON.parse(line); } catch { continue; }
      const r = o.replayChatItemAction, t = num(r?.videoOffsetTimeMsec) / 1000;
      for (const a of r?.actions || []) {
        const it = a.addChatItemAction?.item?.liveChatTextMessageRenderer || a.addChatItemAction?.item?.liveChatPaidMessageRenderer; if (!it) continue;
        push(t, it.authorName?.simpleText, (it.message?.runs || []).map(x => x.text ?? x.emoji?.shortcuts?.[0] ?? '').join(''));
      }
    }
  } else {                                                                                                                                                                                          // CSV / TSV / "hh:mm:ss user: message"
    for (const line of trimmed.split('\n')) {
      const m = /^\s*\[?([\d:.]+)\]?[\s,;\t]+(?:([^,;\t:]{1,40})[,;\t:]\s*)?(.+)$/.exec(line); if (!m) continue;
      push(m[1].includes(':') ? hms(m[1]) : num(m[1]), m[2], m[3]);
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Per-second signals over [0, dur). */
export function signals(msgs, dur) {
  const n = Math.max(1, Math.ceil(dur)), z = () => new Float64Array(n), s = { n: z(), laugh: z(), hype: z(), clip: z(), caps: z(), fresh: z() }, seen = new Set();
  for (const m of msgs) {
    const i = Math.floor(m.t); if (i < 0 || i >= n) continue;
    s.n[i]++; if (LAUGH.test(m.msg)) s.laugh[i]++; if (HYPE.test(m.msg)) s.hype[i]++; if (CLIPIT.test(m.msg)) s.clip[i]++;
    const letters = m.msg.replace(/[^A-Za-z]/g, ''); if (letters.length >= 4 && letters === letters.toUpperCase()) s.caps[i]++;
    if (m.user && !seen.has(m.user)) { seen.add(m.user); s.fresh[i]++; }
  }
  return s;
}

const smooth = (a, w) => { const out = new Float64Array(a.length); let acc = 0; for (let i = 0; i < a.length; i++) { acc += a[i]; if (i >= w) acc -= a[i - w]; out[i] = acc / Math.min(i + 1, w); } return out; };
/** Burst score per second: z of the smoothed weighted activity against a trailing baseline (minutes before), so slow chats and busy chats both show their own spikes. */
export function burst(sig, { win = 5, base = 180, w = { n: 1, laugh: 2.5, hype: 1.5, clip: 4, caps: .8, fresh: .3 } } = {}) {
  const L = sig.n.length, act = new Float64Array(L);
  for (let i = 0; i < L; i++) act[i] = Object.entries(w).reduce((s, [k, v]) => s + v * sig[k][i], 0);
  const sm = smooth(act, win), out = new Float64Array(L);
  for (let i = 0; i < L; i++) {
    const a = Math.max(0, i - base), b = Math.max(a + 1, i - win); let mu = 0, k = 0, sq = 0;
    for (let j = a; j < b; j++) { mu += sm[j]; k++; } mu = k ? mu / k : 0;
    for (let j = a; j < b; j++) sq += (sm[j] - mu) ** 2; const sd = Math.sqrt(k ? sq / k : 0) || 1;
    out[i] = (sm[i] - mu) / Math.max(sd, .5);
  }
  return out;
}

/** Local maxima above thr, at least minGap seconds apart, strongest first. */
export function peaks(score, { minGap = 45, thr = 2.5, top = 15 } = {}) {
  const cand = [];
  for (let i = 1; i < score.length - 1; i++) if (score[i] >= thr && score[i] >= score[i - 1] && score[i] >= score[i + 1]) cand.push({ t: i, z: +score[i].toFixed(2) });
  cand.sort((a, b) => b.z - a.z);
  const kept = []; for (const c of cand) { if (kept.every(k => Math.abs(k.t - c.t) >= minGap)) kept.push(c); if (kept.length >= top) break; }
  return kept;
}

/** Chat reacts after the video: the lag (s) that best lines the chat rate up with the audio loudness (both per second). */
export function estimateDelay(chatRate, loud, { max = 15, fallback = 5 } = {}) {
  const L = Math.min(chatRate.length, loud.length); if (L < 60) return fallback;
  const norm = a => { const m = a.reduce((s, x) => s + x, 0) / a.length, sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) || 1; return a.map(x => (x - m) / sd); };
  const c = norm(Array.from(chatRate.slice(0, L))), l = norm(Array.from(loud.slice(0, L)));
  let best = { lag: fallback, r: -Infinity };
  for (let lag = 0; lag <= max; lag++) { let s = 0; for (let i = 0; i + lag < L; i++) s += l[i] * c[i + lag]; const r = s / (L - lag); if (r > best.r) best = { lag, r }; }
  return best.r > .05 ? best.lag : fallback;
}

/** Peaks → clip windows: the moment happened `delay` s before the chat peak; keep `pre` s of build-up and `post` s of reaction. */
export function windows(pk, { delay = 5, pre = 25, post = 8, dur = Infinity } = {}) {
  return pk.map((p, i) => { const moment = Math.max(0, p.t - delay); return { id: `c${i + 1}`, peak: p.t, moment, z: p.z, t0: +Math.max(0, moment - pre).toFixed(2), t1: +Math.min(dur, moment + post).toFixed(2) }; });
}

/** Snap a window to sentence edges from word times (start at a sentence start, end after the sentence that holds the reaction). */
export function snap(win, words, { maxShift = 6 } = {}) {
  if (!words?.length) return win;
  const starts = words.filter((w, i) => i === 0 || /[.!?]$/.test(words[i - 1].w) || w.t0 - words[i - 1].t1 > .7).map(w => w.t0);
  const ends = words.filter((w, i) => /[.!?]$/.test(w.w) || (words[i + 1] && words[i + 1].t0 - w.t1 > .7) || i === words.length - 1).map(w => w.t1);
  const s = starts.filter(t => t <= win.t0 + 1 && t >= win.t0 - maxShift).at(-1), e = ends.find(t => t >= win.t1 - 1 && t <= win.t1 + maxShift);
  return { ...win, t0: +(s ?? win.t0).toFixed(2), t1: +((e ?? win.t1) + .15).toFixed(2) };
}

/** Download a VOD's chat replay. Twitch/YouTube via chat-downloader; Kick via its public API (best effort). Returns the file. */
export async function fetchChat(cfg, url, outFile, { onLine } = {}) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  if (/kick\.com/.test(url)) return fetchKick(url, outFile);
  const py = path.join(STUDIO, '.tools', 'chatenv', 'bin', 'chat_downloader');
  if (!fs.existsSync(py)) throw new Error('chat-downloader is not installed: run studio/scripts/install_openclip.sh');
  const r = await run(py, [url, '--output', outFile, '--quiet'], { onLine });
  if (r.code !== 0 || !fs.existsSync(outFile)) throw new Error(`chat download failed: ${(r.err || r.out).slice(-300)}`);
  return outFile;
}
async function fetchKick(url, outFile) {
  // https://kick.com/<channel>/videos/<uuid> → the VOD's livestream start + channel id, then messages in 5 s steps
  const m = /kick\.com\/([^/]+)\/videos\/([\w-]+)/.exec(url); if (!m) throw new Error('a Kick VOD URL looks like kick.com/<channel>/videos/<id>');
  const get = async u => { const r = await fetch(u, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) throw new Error(`Kick ${r.status} for ${u}`); return r.json(); };
  const vod = await get(`https://kick.com/api/v1/video/${m[2]}`), ls = vod.livestream || vod;
  const start = ls.start_time || ls.created_at, chan = ls.channel?.id || ls.channel_id, dur = (ls.duration || 0) / 1000;
  if (!start || !chan) throw new Error('Kick did not return the stream start or channel');
  const msgs = [], t0 = Date.parse(start);
  for (let s = 0; s < dur; s += 5) {
    const d = await get(`https://kick.com/api/v2/channels/${chan}/messages?start_time=${encodeURIComponent(new Date(t0 + s * 1000).toISOString())}`).catch(() => null);
    for (const x of d?.data?.messages || []) if (!msgs.some(y => y.id === x.id)) msgs.push(x);
  }
  fs.writeFileSync(outFile, JSON.stringify({ start, data: { messages: msgs } }));
  return outFile;
}
