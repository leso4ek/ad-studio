import { useState, useRef, Fragment } from 'react';
import { api, file } from './api.js';

const ROLES = [['character', 'a character'], ['product', 'the product'], ['place', 'a place'], ['prop', 'an item / prop']];
const MODES = {
  remake: ['Remake with our tools', 'Rebuild the structure, timing and shot sizes in our own format and style. The footage is never reused.'],
  transfer: ['Motion transfer (Genjutsu)', 'Higgsfield Genjutsu keeps the original motion, camera and timing and re-skins it from your reference images. Paid per second; needs the rights.'],
  mixed: ['Mixed, per shot', 'Shots with people or strong motion go to Genjutsu, the rest are remade; switch any shot on the shot board.'],
};
const TARGETS = { 'story-ad': 'Story ad (code-drawn styles)', '3d-skit': '3D skit (voxel stage)', '3d-explainer': '3D explainer (Blender world)' };

/** Stage "Source video": upload the video and the reference images, say what changes, choose the route, then analyse. */
export function RecreateSource({ ad, meta, slug, x, refresh }) {
  const r = ad.project.recreate || {}, [busy, setBusy] = useState(''), [err, setErr] = useState(''), [pct, setPct] = useState(0);
  const [prompt, setPrompt] = useState({ characters: '', wardrobe: '', items: '', product: '', notes: '', ...(r.prompt || {}) });
  const vid = useRef(null), img = useRef(null), [role, setRole] = useState('character'), [label, setLabel] = useState('');
  const act = async (what, fn) => { setBusy(what); setErr(''); try { await fn(); } catch (e) { setErr(e.message); } setBusy(''); refresh(); };
  const upload = (f, kind, extra = {}) => new Promise((res, rej) => {
    const q = new URLSearchParams({ kind, name: f.name, ...extra }), xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/ads/${slug}/source?${q}`); xhr.upload.onprogress = e => e.lengthComputable && setPct(Math.round(e.loaded / e.total * 100));
    xhr.onload = () => { setPct(0); const b = JSON.parse(xhr.responseText || '{}'); xhr.status < 300 ? res(b) : rej(new Error(b.error || xhr.statusText)); };
    xhr.onerror = () => rej(new Error('upload failed')); xhr.send(f);
  });
  const pickVideo = e => { const f = e.target.files[0]; if (f) act('uploading the video', () => upload(f, 'video')); e.target.value = ''; };
  const pickImgs = e => { const fs = [...e.target.files]; act('uploading reference images', async () => { for (const f of fs) await upload(f, 'ref', { role, label: label || f.name.replace(/\.[^.]+$/, '') }); setLabel(''); }); e.target.value = ''; };
  const patch = b => act('saving', () => api.recreate(slug, b));
  const savePrompt = () => JSON.stringify(prompt) !== JSON.stringify({ characters: '', wardrobe: '', items: '', product: '', notes: '', ...(r.prompt || {}) }) && patch({ prompt });
  const running = ad.running || x.status === 'running';
  return <div className="form">
    <div className="card hero"><div className="who">Recreate a video</div>
      <div className="reason">Upload a video (up to 60 s). The app reads it by code (shots, motion, words), then Claude maps your prompt and reference images onto it and recreates it with the tools here.</div></div>
    {err && <div className="err-box" style={{ marginBottom: 12 }}>{err}</div>}
    {busy && <div className="card"><span className="pulse" /> {busy}{pct ? ` · ${pct}%` : ''}…</div>}

    <div className="card">
      <h2>1 · The video</h2>
      {r.source ? <div className="row" style={{ alignItems: 'flex-start' }}>
        <video src={file(slug, r.source)} controls preload="metadata" style={{ width: 160, maxHeight: 290, borderRadius: 8, background: '#000' }} />
        <div><b>{r.source.split('/').pop()}</b><p style={{ color: 'var(--muted)', fontSize: 13 }}>Replace it to start over: the analysis runs again.</p>
          <button className="btn" disabled={!!busy || running} onClick={() => vid.current.click()}>Replace video…</button></div>
      </div> : <button className="btn primary" disabled={!!busy} onClick={() => vid.current.click()}>Upload a video (MP4 / MOV, up to 60 s)…</button>}
      <input ref={vid} type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={pickVideo} />
    </div>

    <div className="card">
      <h2>2 · Reference images (optional, up to 12)</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>Faces and outfits, items, the product, places. They become chosen elements on the shot board, sent first in every reference list (Genjutsu takes up to 8).</p>
      <div className="refs" style={{ marginBottom: 10 }}>
        {(r.refs || []).map(f => <figure key={f.file} style={{ margin: 0, width: 96 }}>
          <img src={file(slug, f.file)} alt={f.label} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, background: '#000' }} />
          <figcaption style={{ fontSize: 11 }}><b>{f.label || 'reference'}</b><br /><span style={{ color: 'var(--muted)' }}>{f.role}</span>
            <button className="btn ghost" style={{ padding: '0 6px', fontSize: 11 }} disabled={running} onClick={() => patch({ removeRef: f.file })} aria-label={`Remove ${f.label}`}>remove</button></figcaption></figure>)}
      </div>
      <div className="row">
        <label className="tog">This is <select className="adpick" value={role} onChange={e => setRole(e.target.value)}>{ROLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="name, e.g. Juno, red jacket, the bottle" style={{ flex: 1, minWidth: 160, width: 'auto' }} />
        <button className="btn" disabled={!!busy || running} onClick={() => img.current.click()}>Add images…</button>
        <input ref={img} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={pickImgs} />
      </div>
    </div>

    <div className="card">
      <h2>3 · What changes</h2>
      {[['characters', 'What the characters look like', 'e.g. the woman becomes Juno, thirties, dark bun; the man becomes a tall grey-haired neighbour'],
        ['wardrobe', 'What they wear', 'e.g. Juno: an orange jumper and green trousers'],
        ['items', 'Which items they have', 'e.g. a watering can instead of the phone'],
        ['product', 'The product it advertises', 'e.g. Sprigly, a 250 ml houseplant feed with a yellow measuring cap'],
        ['notes', 'Anything else', 'e.g. keep the opening joke, make it calmer']].map(([k, t, ph]) =>
        <label key={k}>{t}<textarea rows={2} value={prompt[k]} placeholder={ph} onChange={e => setPrompt(o => ({ ...o, [k]: e.target.value }))} onBlur={savePrompt} /></label>)}
    </div>

    <div className="card">
      <h2>4 · How to recreate it</h2>
      <div className="opts">{Object.entries(MODES).map(([k, [t, d]]) => <button key={k} className="opt" aria-pressed={(r.mode || 'remake') === k} disabled={running || (k !== 'remake' && !r.rights)}
        title={k !== 'remake' && !r.rights ? 'Tick the rights box first' : ''} onClick={() => patch({ mode: k })}><b>{t}</b><small>{d}</small></button>)}</div>
      <label className="tog" style={{ display: 'flex', margin: '12px 0' }}><input type="checkbox" checked={!!r.rights} disabled={running} onChange={e => patch({ rights: e.target.checked, ...(!e.target.checked && r.mode !== 'remake' ? { mode: 'remake' } : {}) })} />
        I own this video or have the rights to it (required for motion transfer; without it only the structure is remade)</label>
      <div className="row">
        <label style={{ flex: 1 }}>Remake it as<select value={r.target || 'story-ad'} disabled={running} onChange={e => patch({ target: e.target.value })}>{Object.entries(TARGETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        {(r.target || 'story-ad') === 'story-ad' && <label style={{ flex: 1 }}>Style<select value={r.style || ''} disabled={running} onChange={e => patch({ style: e.target.value })}><option value="">Claude chooses</option>{Object.entries(meta?.styles || {}).map(([k, v]) => <option key={k} value={k}>{v.split(':')[0]}</option>)}</select></label>}
        {(r.target || 'story-ad') === '3d-explainer' && <label className="tog" style={{ flex: 1 }}><input type="checkbox" checked={!!r.photoreal} disabled={running} onChange={e => patch({ photoreal: e.target.checked })} />Photoreal finish (Blender → Genjutsu, paid)</label>}
      </div>
    </div>
    <div className="row" style={{ justifyContent: 'flex-end' }}>
      <button className="btn primary" disabled={!r.source || !!busy || running} onClick={() => act('starting', async () => { await savePrompt(); await api.run(slug, 'source'); })}>
        {ad.project.stages.source?.status === 'done' ? 'Analyse again and continue' : 'Analyse and start'}</button>
    </div>
    {ad.project.stages.source?.status === 'done' && <Analysis slug={slug} />}
  </div>;
}

/** The code analysis: contact sheets, the rhythm, and per shot motion and words. */
export function Analysis({ slug, rec }) {
  const [a, setA] = useState(null), [tried, setTried] = useState(false);
  if (!tried) { setTried(true); fetch(`/api/ads/${slug}/analysis`).then(r => r.ok ? r.json() : null).then(setA).catch(() => {}); }
  if (!a) return null;
  const table = rec?.output?.shots || [];
  return <div className="card">
    <h2>What the code found</h2>
    <dl className="kv">
      <dt>Video</dt><dd>{a.w}×{a.h}, {a.fps} fps, {a.duration.toFixed(1)} s</dd>
      <dt>Rhythm</dt><dd>{a.rhythm.shots} shots · {a.rhythm.cutsPer10s} cuts per 10 s · first cut {a.rhythm.firstCut ?? 'none'} s · mean shot {a.rhythm.meanShot} s</dd>
      <dt>Sound</dt><dd>{a.audio.speech ? `${a.audio.words} words (${a.audio.wordsPerSec}/s)` : 'no speech'}{a.audio.musicLikely ? ' · music bed likely' : ''}{a.audio.integratedLufs !== null ? ` · ${a.audio.integratedLufs} LUFS` : ''}</dd>
      {a.audio.transcript && <><dt>Words</dt><dd style={{ fontStyle: 'italic' }}>“{a.audio.transcript}”</dd></>}
    </dl>
    <div className="row" style={{ marginTop: 10, alignItems: 'flex-start' }}>{a.sheets.map(f => <a key={f} href={file(slug, `source/${f}`)} target="_blank" rel="noreferrer"><img src={file(slug, `source/${f}`)} alt="contact sheet: first, middle and last frame of each shot" style={{ width: 300, borderRadius: 8 }} /></a>)}</div>
    <table className="tbl" style={{ marginTop: 12, width: '100%', fontSize: 12 }}>
      <thead><tr><th>shot</th><th>time</th><th>camera</th><th>motion</th>{table.length > 0 && <><th>size</th><th>action</th><th>complexity</th></>}<th>voice</th></tr></thead>
      <tbody>{a.shots.map(s => { const c = table.find(t => t.id === s.id); return <tr key={s.id}>
        <td><b>{s.id}</b></td><td style={{ fontFamily: 'var(--mono)' }}>{s.t0.toFixed(1)}–{s.t1.toFixed(1)}</td><td>{s.motion.camera}</td>
        <td><span style={{ display: 'inline-block', width: 50, height: 6, background: 'var(--line)', borderRadius: 3, verticalAlign: 'middle' }}><span style={{ display: 'block', width: `${Math.round(s.motion.score * 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} /></span> {s.motion.score.toFixed(2)}</td>
        {table.length > 0 && <><td>{c?.size} · {c?.move}</td><td>{c?.action}</td><td>{c?.complexity}{c?.physics ? ' · physics' : ''}</td></>}
        <td style={{ color: 'var(--muted)' }}>{s.voice}</td></tr>; })}</tbody>
    </table>
  </div>;
}

/** Stage "Analysis": Claude's read of the video and the mapping onto your prompt. */
export function AnalysisDecision({ rec, slug }) {
  const o = rec?.output; if (!o) return null;
  return <>
    <div className="card hero"><div className="who">◆ Claude{rec.meta?.engine === 'inbox' ? ' (via the decision inbox)' : ''}</div><div className="reason">{o.summary} {o.reason}</div></div>
    <div className="card"><dl className="kv">
      <dt>Kind</dt><dd>{o.kind}</dd>
      <dt>Hook</dt><dd>{o.hook.type} (to {o.hook.t1} s): {o.hook.what}</dd>
      <dt>Look</dt><dd>{o.look}</dd><dt>Rhythm</dt><dd>{o.rhythm}</dd>
      <dt>Beats</dt><dd>{o.beats.map(b => `${b.t0}–${b.t1} s ${b.what}`).join(' · ')}</dd>
      <dt>Recommends</dt><dd>{o.recommend.mode} as {TARGETS[o.recommend.target] || o.recommend.target}: {o.recommend.why}</dd>
    </dl></div>
    <div className="card"><h2>Who and what becomes what</h2><dl className="kv">
      {o.characters.map(c => <Fragment key={c.id}><dt>{c.id}</dt><dd>{c.desc} · wears {c.wears} · holds {c.holds} → <b>{c.becomes}</b></dd></Fragment>)}
      {o.props.map(c => <Fragment key={c.id}><dt>{c.id}</dt><dd>{c.desc} → <b>{c.becomes}</b></dd></Fragment>)}
      <dt>product</dt><dd>{o.product.seen ? o.product.desc : 'none on screen'} → <b>{o.product.becomes}</b></dd>
      {o.places.map(p => <Fragment key={p.id}><dt>{p.id}</dt><dd>{p.desc} ({p.kind})</dd></Fragment>)}
    </dl></div>
    <Analysis slug={slug} rec={rec} />
  </>;
}
