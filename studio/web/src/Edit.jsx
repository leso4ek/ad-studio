import { useState, useRef, useEffect } from 'react';
import { api, file } from './api.js';

/** Edit tool · Source: your footage, 3-5 reference reels, and what the edit is for. */
export function EditSource({ ad, slug, x, refresh }) {
  const r = ad.project.recreate || {}, [busy, setBusy] = useState(''), [err, setErr] = useState(''), [pct, setPct] = useState(0);
  const [goal, setGoal] = useState(r.prompt?.notes || ''), vid = useRef(null), refs = useRef(null);
  const act = async (what, fn) => { setBusy(what); setErr(''); try { await fn(); } catch (e) { setErr(e.message); } setBusy(''); refresh(); };
  const upload = (f, kind) => new Promise((res, rej) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', `/api/ads/${slug}/source?${new URLSearchParams({ kind, name: f.name })}`);
    xhr.upload.onprogress = e => e.lengthComputable && setPct(Math.round(e.loaded / e.total * 100));
    xhr.onload = () => { setPct(0); const b = JSON.parse(xhr.responseText || '{}'); xhr.status < 300 ? res(b) : rej(new Error(b.error || xhr.statusText)); };
    xhr.onerror = () => rej(new Error('upload failed')); xhr.send(f);
  });
  const running = ad.running || x.status === 'running';
  return <div className="form">
    <div className="card hero"><div className="who">Edit a video</div>
      <div className="reason">Claude edits your footage like the tutorial: cuts pauses and slips, word-by-word captions in the style of your reference reels, a music bed under the voice, a hook title, 9:16. You get draft v1, then revise it in plain words.</div></div>
    {err && <div className="err-box">{err}</div>}
    {busy && <div className="card"><span className="pulse" /> {busy}{pct ? ` · ${pct}%` : ''}…</div>}
    <div className="card"><h2>1 · Your footage</h2>
      {r.source ? <div className="row"><video src={file(slug, r.source)} controls preload="metadata" style={{ width: 160, maxHeight: 280, borderRadius: 8, background: '#000' }} /><button className="btn" disabled={running} onClick={() => vid.current.click()}>Replace…</button></div>
        : <button className="btn primary" onClick={() => vid.current.click()}>Upload a video…</button>}
      <input ref={vid} type="file" accept="video/*" hidden onChange={e => { const f = e.target.files[0]; if (f) act('uploading', () => upload(f, 'video')); e.target.value = ''; }} />
    </div>
    <div className="card"><h2>2 · Reference reels (3-5, optional)</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>Videos whose editing you like. Claude measures their pace and captions and writes style.md: inspiration, never a copy.</p>
      <div className="refs" style={{ marginBottom: 8 }}>{(r.refVideos || []).map(f => <figure key={f} style={{ margin: 0 }}><video src={file(slug, f)} muted preload="metadata" style={{ width: 90, aspectRatio: '9/16', borderRadius: 6, background: '#000' }} />
        <figcaption><button className="btn ghost" style={{ fontSize: 11, padding: '0 6px' }} disabled={running} onClick={() => act('removing', () => api.recreate(slug, { removeRef: f }))}>remove</button></figcaption></figure>)}</div>
      <button className="btn" disabled={running || (r.refVideos || []).length >= 5} onClick={() => refs.current.click()}>Add reference reels…</button>
      <input ref={refs} type="file" accept="video/*" multiple hidden onChange={e => { const fs = [...e.target.files]; act('uploading references', async () => { for (const f of fs) await upload(f, 'refvideo'); }); e.target.value = ''; }} />
    </div>
    <div className="card"><h2>3 · What is the edit for?</h2>
      <label>Goal, audience, anything to keep or cut<textarea rows={3} value={goal} onChange={e => setGoal(e.target.value)} onBlur={() => act('saving', () => api.recreate(slug, { prompt: { notes: goal } }))} placeholder="e.g. a 40 s TikTok from this talk; keep the joke about the kettle; energetic" /></label>
    </div>
    <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" disabled={!r.source || running || !!busy} onClick={() => act('starting', async () => { await api.recreate(slug, { prompt: { notes: goal } }); await api.run(slug, 'source'); })}>Edit it</button></div>
  </div>;
}

/** Edit tool · the drafts: watch, read the notes, revise in plain words (a new edit plan → the next draft). */
export function EditDrafts({ ad, slug, x, bust, refresh }) {
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [notes, setNotes] = useState({});
  const drafts = (x.outputs || []).filter(f => /draft-v\d+\.mp4$/.test(f));
  const all = [...new Set([...(ad.project.stages['edit-render']?.result?.drafts || []), ...drafts])];
  useEffect(() => { for (const f of all) { const n = f.replace(/draft-(v\d+)\.mp4$/, 'edit-notes-$1.md'); fetch(file(slug, n)).then(r => r.ok ? r.text() : '').then(t => setNotes(o => ({ ...o, [f]: t }))); } }, [all.join(), slug]);
  return <div>
    {all.length === 0 && <div className="empty">The draft appears here after the edit plan.</div>}
    <div className="row" style={{ alignItems: 'flex-start' }}>{all.map(f => <figure key={f} style={{ margin: 0, maxWidth: 260 }}>
      <video src={file(slug, f, bust)} controls preload="metadata" style={{ width: 240, aspectRatio: '9/16', borderRadius: 8, background: '#000' }} />
      <figcaption><b>{f.match(/v\d+/)?.[0]}</b><pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{notes[f] || ''}</pre></figcaption></figure>)}</div>
    {all.length > 0 && <div className="card"><h2>Revise</h2>
      <textarea className="note" value={note} onChange={e => setNote(e.target.value)} placeholder="Plain words, e.g. keep the pause before the punchline; cut the second take of the intro; bigger captions" />
      <button className="btn primary" style={{ marginTop: 6 }} disabled={busy || !note.trim() || ad.running} onClick={async () => { setBusy(true); try { await api.redo(slug, 'edit-plan', note); setNote(''); } catch (e) { alert(e.message); } setBusy(false); refresh(); }}>Make the next draft</button>
    </div>}
  </div>;
}
