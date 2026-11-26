import { useState, useRef, useEffect } from 'react';
import { api, file } from './api.js';

/** Clipper · Video and chat: a VOD/video URL (Twitch, YouTube, Kick, any yt-dlp site) or an upload, plus an optional chat log. */
export function ClipSource({ ad, slug, x, refresh }) {
  const r = ad.project.recreate || {}, k = r.clip || {};
  const [url, setUrl] = useState(k.url || ''), [intent, setIntent] = useState(k.intent || ''), [max, setMax] = useState(k.maxClips || 5), [mode, setMode] = useState(k.mode || 'stream');
  const [busy, setBusy] = useState(''), [err, setErr] = useState(''), vid = useRef(null), chat = useRef(null);
  const act = async (what, fn) => { setBusy(what); setErr(''); try { await fn(); } catch (e) { setErr(e.message); } setBusy(''); refresh(); };
  const upload = (f, kind) => new Promise((res, rej) => { const xhr = new XMLHttpRequest(); xhr.open('POST', `/api/ads/${slug}/source?${new URLSearchParams({ kind, name: f.name })}`); xhr.onload = () => { const b = JSON.parse(xhr.responseText || '{}'); xhr.status < 300 ? res(b) : rej(new Error(b.error || xhr.statusText)); }; xhr.onerror = () => rej(new Error('upload failed')); xhr.send(f); });
  const save = () => api.recreate(slug, { clip: { url: url.trim(), intent, maxClips: +max, mode } });
  const running = ad.running || x.status === 'running';
  return <div className="form">
    <div className="card hero"><div className="who">Clip a stream or a video</div>
      <div className="reason">Streams: the clipper finds where chat explodes (messages, laughter, hype, "clip it") and keeps the build-up before the moment. Normal videos: OpenClip ranks the transcript (on your PC), or Claude ranks sentence windows. Claude then picks and trims with the clip rubric, and each clip is rendered 9:16 with word captions and a hook title.</div></div>
    {err && <div className="err-box">{err}</div>}
    {busy && <div className="card"><span className="pulse" /> {busy}…</div>}
    <div className="card"><h2>1 · The video</h2>
      <label>VOD or video URL (Twitch, YouTube, Kick, …)<input type="text" value={url} onChange={e => setUrl(e.target.value)} onBlur={save} placeholder="https://www.twitch.tv/videos/…" /></label>
      <div className="row">{r.source ? <span className="chip ok">uploaded: {r.source.split('/').pop()}</span> : null}<button className="btn" disabled={running} onClick={() => vid.current.click()}>…or upload a recording</button></div>
      <input ref={vid} type="file" accept="video/*" hidden onChange={e => { const f = e.target.files[0]; if (f) act('uploading', () => upload(f, 'video')); e.target.value = ''; }} />
    </div>
    <div className="card"><h2>2 · Mode</h2>
      <div className="opts">{[['stream', 'Stream', 'Chat replay decides where the moments are (Twitch, YouTube and Kick chat are fetched from the URL; or upload a chat log).'], ['video', 'Normal video', 'Podcasts, talks, interviews: the transcript decides.']].map(([k2, t, d]) => <button key={k2} className="opt" aria-pressed={mode === k2} disabled={running} onClick={() => { setMode(k2); act('saving', () => api.recreate(slug, { clip: { mode: k2 } })); }}><b>{t}</b><small>{d}</small></button>)}</div>
      {mode === 'stream' && <div className="row" style={{ marginTop: 8 }}>{r.chat ? <span className="chip ok">chat log: {r.chat.split('/').pop()}</span> : <span style={{ color: 'var(--muted)', fontSize: 13 }}>No chat log uploaded: it is fetched from the URL.</span>}
        <button className="btn ghost" disabled={running} onClick={() => chat.current.click()}>Upload a chat log (JSON/CSV)</button></div>}
      <input ref={chat} type="file" accept=".json,.jsonl,.csv,.tsv,.txt,.log" hidden onChange={e => { const f = e.target.files[0]; if (f) act('uploading chat', () => upload(f, 'chat')); e.target.value = ''; }} />
    </div>
    <div className="card"><h2>3 · What to look for</h2>
      <div className="row"><label style={{ flex: 3 }}>Intent (optional)<input type="text" value={intent} onChange={e => setIntent(e.target.value)} onBlur={save} placeholder="e.g. the funniest fails; anything about the new map" /></label>
        <label style={{ flex: 1 }}>Clips<input type="number" min={1} max={20} value={max} onChange={e => setMax(e.target.value)} onBlur={save} /></label></div>
    </div>
    <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" disabled={(!url.trim() && !r.source) || running || !!busy} onClick={() => act('starting', async () => { await save(); await api.run(slug, 'clip-source'); })}>Find the clips</button></div>
  </div>;
}

/** Clipper · Candidates: the chat graph (messages per second and the burst score) with the candidate windows. */
export function ClipCandidates({ slug, x, bust }) {
  const [c, setC] = useState(null), [s, setS] = useState(null);
  useEffect(() => { fetch(file(slug, 'clips/candidates.json', bust)).then(r => r.ok ? r.json() : null).then(setC); fetch(file(slug, 'clips/chat-series.json', bust)).then(r => r.ok ? r.json() : null).then(setS); }, [slug, bust]);
  if (!c) return <div className="empty">{x.status === 'running' ? 'Finding candidates…' : 'Not run yet.'}</div>;
  const W = 820, H = 120, dur = c.duration || 1, maxR = Math.max(1, ...(s || []).map(p => p.rate));
  return <div>
    <div className="card"><h2>{c.mode === 'stream' ? `Chat (delay ${c.delay} s)` : 'Candidates'}</h2>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} role="img" aria-label="chat messages per second over the video, with the candidate windows">
        {c.candidates.map(k => <rect key={k.id} x={k.t0 / dur * W} width={Math.max(2, (k.t1 - k.t0) / dur * W)} y={0} height={H} fill="var(--accent)" opacity=".18" />)}
        {s && <polyline fill="none" stroke="var(--ink)" strokeWidth="1.2" points={s.map(p => `${p.t / dur * W},${H - 4 - p.rate / maxR * (H - 10)}`).join(' ')} />}
        {c.candidates.map(k => k.moment !== undefined && <line key={k.id + 'm'} x1={k.moment / dur * W} x2={k.moment / dur * W} y1={0} y2={H} stroke="var(--accent)" strokeWidth="1.5" />)}
      </svg>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.candidates.length} candidates · shaded = the window kept (build-up + reaction){c.mode === 'stream' ? ' · line = the moment (peak minus the chat delay)' : ''}</div></div>
    <table className="tbl" style={{ width: '100%', fontSize: 12 }}><thead><tr><th>id</th><th>window</th><th>{c.mode === 'stream' ? 'burst' : 'source'}</th><th>what is said</th>{c.mode === 'stream' && <th>chat</th>}</tr></thead>
      <tbody>{c.candidates.map(k => <tr key={k.id}><td><b>{k.id}</b></td><td style={{ fontFamily: 'var(--mono)' }}>{k.t0.toFixed(0)}–{k.t1.toFixed(0)} s</td><td>{k.z ?? k.source ?? ''}</td><td>{(k.title ? `${k.title}: ` : '') + (k.text || '').slice(0, 160)}</td>{c.mode === 'stream' && <td style={{ color: 'var(--muted)' }}>{(k.chat || []).slice(0, 4).join(' · ')}</td>}</tr>)}</tbody></table>
  </div>;
}

/** Clipper · Clips: the rendered clips, best first, with the rubric scores and why. */
export function ClipGallery({ slug, x, bust }) {
  const [clips, setClips] = useState(null);
  useEffect(() => { fetch(file(slug, 'clips/clips.json', bust)).then(r => r.ok ? r.json() : null).then(setClips); }, [slug, bust, x.status]);
  if (!clips) return <div className="empty">{x.status === 'running' ? 'Rendering clips…' : 'Not rendered yet.'}</div>;
  return <div className="opts">{clips.map(c => <div key={c.file} className="opt" style={{ cursor: 'default' }}>
    <video src={file(slug, c.file, bust)} controls preload="metadata" style={{ width: '100%', aspectRatio: '9/16', borderRadius: 8, background: '#000' }} />
    <b>{c.title || c.id} <span className="chip">{c.total}/25</span></b>
    <small>{c.t0.toFixed(0)}–{c.t1.toFixed(0)} s · hook {c.scores.hook} · setup {c.scores.setup} · peak {c.scores.peak} · payoff {c.scores.payoff} · standalone {c.scores.standalone}</small>
    <small>{c.why}</small>
    <a className="btn ghost" href={file(slug, c.file)} download>Download</a>
  </div>)}</div>;
}
