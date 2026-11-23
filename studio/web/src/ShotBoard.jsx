import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { file } from './api.js';

const j = async r => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || r.statusText); return b; };
const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }).then(j);

/** The shot board: element sheets → previz → paid takes → your pick, for every shot. Nothing is paid for without your OK. */
export default function ShotBoard({ slug, events }) {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [bust, setBust] = useState(Date.now());
  const base = `/api/ads/${slug}/production`;
  const load = useCallback(() => fetch(base).then(j).then(x => { setD(x); setBust(Date.now()); }).catch(e => setErr(e.message)), [base]);
  useEffect(() => { load(); }, [load]);
  const last = events.at(-1);
  useEffect(() => { if (last?.type === 'production') { load(); if (last.kind === 'error') setErr(last.text); } }, [last, load]);
  const act = async fn => { setErr(''); try { await fn(); } catch (e) { setErr(e.message); } load(); };

  if (!d) return <div className="empty">Loading the shot board…</div>;
  if (!d.plan) return (
    <div className="card">
      <h3>Shot board</h3>
      <p style={{ color: 'var(--muted)' }}>Turns the approved bible into shots you produce one by one: a cheap previz (the code-drawn animatic or a Blender render) becomes the motion reference for Seedance 2.5, together with the element sheets you approve. Every paid step shows its cost and waits for your OK.</p>
      <button className="btn primary" onClick={() => act(() => post(`${base}/init`))}>Set up the shot board</button>
      {err && <div className="err-box" style={{ marginTop: 10 }}>{err}</div>}
    </div>);
  const { plan, budget, busy } = d, S = plan.settings;
  return (
    <div>
      <div className="card row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <label className="tog">Video model <select className="adpick" value={S.model} onChange={e => act(() => post(`${base}/settings`, { model: e.target.value }))}>
            <option value="bytedance/seedance-2.5-flash">Seedance 2.5 Flash (drafts)</option><option value="bytedance/seedance-2.5">Seedance 2.5 (finals)</option></select></label>
          <label className="tog">Resolution <select className="adpick" value={S.resolution} onChange={e => act(() => post(`${base}/settings`, { resolution: e.target.value }))}><option>480p</option><option>720p</option></select></label>
          <label className="tog" title="How the previz drives Seedance">Motion <select className="adpick" value={S.motionMode || 'video'} onChange={e => act(() => post(`${base}/settings`, { motionMode: e.target.value }))}>
            <option value="video">previz video as reference</option><option value="keyframes">styled first/last keyframes</option><option value="none">prompt only</option></select></label>
          <button className="btn ghost" onClick={() => act(() => post(`${base}/init`))} title="Re-read the bible (keeps your edited prompts and takes)">Sync with bible</button>
        </div>
        <Budget b={budget} />
      </div>
      {busy && <div className="card"><span className="pulse" /> {busy}… (follow it in the live pane)</div>}
      {err && <div className="err-box" style={{ marginBottom: 12 }}>{err}</div>}

      <h2>Elements (the consistency anchors)</h2>
      <div className="opts" style={{ marginBottom: 18 }}>{plan.assets.map(a => <Asset key={a.id} a={a} slug={slug} base={base} bust={bust} act={act} S={S} busy={!!busy} />)}</div>

      <h2>Shots</h2>
      <div style={{ display: 'grid', gap: 14 }}>{plan.shots.map((s, i) => <Shot key={s.id} s={s} i={i} plan={plan} slug={slug} base={base} bust={bust} act={act} busy={!!busy} />)}</div>
    </div>
  );
}

function Budget({ b }) {
  const pct = Math.min(100, b.spent / b.cap * 100);
  return <div style={{ minWidth: 200 }} title="Hard cap: a paid call that would pass it is refused">
    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.mock ? 'MOCK MODE · ' : ''}spent ${b.spent.toFixed(2)} of ${b.cap.toFixed(2)}</div>
    <div style={{ height: 6, background: 'var(--line)', borderRadius: 4, marginTop: 4 }}><div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? 'var(--err)' : 'var(--ok)', borderRadius: 4 }} /></div>
  </div>;
}

function Asset({ a, slug, base, bust, act, S, busy }) {
  const [open, setOpen] = useState(false), [prompt, setPrompt] = useState(a.prompt || '');
  return <div className="opt" style={{ cursor: 'default' }}>
    <b>{a.id} <span className={`chip ${a.status === 'approved' ? 'ok' : a.status === 'review' ? 'gate' : ''}`}>{a.status}</span></b>
    <small>{a.desc}</small>
    <div className="row" style={{ marginTop: 6 }}>{a.files.map(f => <button key={f} className="opt" aria-pressed={a.chosen === f} style={{ padding: 2, width: 72 }} onClick={() => act(() => post(`${base}/assets/${a.id}/choose`, { file: f }))} title="Use this sheet as the reference">
      <img src={file(slug, f, bust)} alt="" style={{ width: '100%', borderRadius: 5 }} /></button>)}</div>
    <div className="row" style={{ marginTop: 6 }}>
      <button className="btn" disabled={busy} onClick={() => setOpen(o => !o)}>Make sheet…</button>
    </div>
    {open && <div style={{ marginTop: 6 }}>
      <textarea className="note" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Leave empty for the standard sheet prompt (four views, flat grey, the locked style)" />
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn" disabled={busy} onClick={() => act(() => post(`${base}/assets/${a.id}/make`, { source: 'blender' }))} title="Free: renders production/blender/asset-<id>.json">Blender render (free)</button>
        <button className="btn primary" disabled={busy} onClick={() => { if (confirm(`Generate 2 sheets with ${S.imageModel}? About $0.05–0.20.`)) act(() => post(`${base}/assets/${a.id}/make`, { prompt: prompt || undefined, n: 2, confirm: true })); }}>Image model (paid)…</button>
      </div></div>}
  </div>;
}

function Shot({ s, i, plan, slug, base, bust, act, busy }) {
  const [prompt, setPrompt] = useState(s.prompt), dirty = prompt !== s.prompt;
  useEffect(() => setPrompt(s.prompt), [s.prompt]);
  const take = async () => {
    const e = await fetch(`${base}/shots/${s.id}/estimate`).then(j);
    if (confirm(`Generate a take of ${s.id} (${s.seconds} s, ${plan.settings.model.split('/')[1]}, ${plan.settings.resolution})?\nAbout $${e.estimate.toFixed(2)}${e.mock ? ' (mock mode: free)' : ''}. Spent so far $${e.spent.toFixed(2)} of $${e.cap.toFixed(2)}.`))
      act(() => post(`${base}/shots/${s.id}/take`, { confirm: true }));
  };
  return <motion.div className="card" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
      <div className="row"><b>{s.id}</b><span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>{s.t0}–{s.t1} s · take length {s.seconds} s</span>
        <span className={`chip ${s.status === 'chosen' ? 'ok' : s.status === 'review' ? 'gate' : s.status === 'error' ? 'err' : ''}`}>{s.status}</span></div>
      <div className="row">
        <select className="adpick" value={s.route} onChange={e => act(() => post(`${base}/shots/${s.id}`, { route: e.target.value }))} aria-label="Route">
          <option value="seedance">Seedance (paid)</option><option value="kit">Code-drawn (free)</option><option value="blender">Blender (free)</option></select>
        <select className="adpick" value={s.firstFrame} onChange={e => act(() => post(`${base}/shots/${s.id}`, { firstFrame: e.target.value }))} aria-label="First frame">
          <option value="none">No first frame</option><option value="previz">First frame = previz</option>{i > 0 && <option value="chain">Continue from previous shot</option>}</select>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14 }}>
      <div>
        {s.previz ? <video src={file(slug, s.previz.file, bust)} controls muted loop style={{ width: 160, aspectRatio: '9/16', borderRadius: 8, background: '#000' }} /> : <div className="empty" style={{ padding: 20, border: '1px dashed var(--line)', borderRadius: 8 }}>no previz</div>}
        <button className="btn" style={{ marginTop: 6, width: '100%' }} disabled={busy} onClick={() => act(() => post(`${base}/shots/${s.id}/previz`))}>{s.previz ? 'Redo previz' : 'Make previz'} ({s.route === 'blender' ? 'Blender' : 'kit'})</button>
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--muted)' }}>Prompt {s.promptEdited ? '(edited by you)' : '(built from the bible; edit freely)'}</label>
        <textarea className="note" style={{ minHeight: 150, fontFamily: 'var(--mono)', fontSize: 12 }} value={prompt} onChange={e => setPrompt(e.target.value)} />
        <div className="row" style={{ marginTop: 6 }}>
          {dirty && <button className="btn" onClick={() => act(() => post(`${base}/shots/${s.id}`, { prompt }))}>Save prompt</button>}
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>refs: {(s.refs || []).map(r => { const a = plan.assets.find(x => x.id === r); return <span key={r} className={`chip ${a?.chosen ? 'ok' : 'warn'}`} title={a?.chosen ? 'sheet chosen' : 'no sheet chosen yet: it is skipped'}>{r}</span>; })}</span>
          {s.route === 'seedance' && <button className="btn primary" disabled={busy || (!s.previz && (plan.settings.motionMode || 'video') !== 'none') || ((plan.settings.motionMode) === 'keyframes' && !s.keys?.first)} onClick={take}>Generate take…</button>}
        </div>
        {plan.settings.motionMode === 'keyframes' && s.previz && <div style={{ marginTop: 10 }}>
          <div className="row"><span style={{ fontSize: 12, color: 'var(--muted)' }}>Styled keyframes: the previz frames repainted in the final look (pick a first and a last)</span>
            <button className="btn" disabled={busy} onClick={() => { if (confirm(`Repaint the first and last previz frames of ${s.id} with ${plan.settings.imageModel} (2 options each)? About $0.10–0.35.`)) act(() => post(`${base}/shots/${s.id}/keys`, { confirm: true })); }}>Style keyframes…</button></div>
          {['first', 'last'].map(w => (s.keyOptions?.[w] || []).length > 0 && <div key={w} className="row" style={{ marginTop: 6 }}><span className="chip">{w}</span>
            {s.keyOptions[w].map(f => <button key={f} className="opt" aria-pressed={s.keys?.[w] === f} style={{ padding: 2, width: 64 }} onClick={() => act(() => post(`${base}/shots/${s.id}/keys/choose`, { which: w, file: f }))}><img src={file(slug, f, bust)} alt="" style={{ width: '100%', borderRadius: 5 }} /></button>)}</div>)}
        </div>}
        {s.error && <div className="err-box" style={{ marginTop: 8 }}>{s.error}</div>}
        {s.takes.length > 0 && <div className="videos" style={{ marginTop: 10 }}>{s.takes.map(t => <figure key={t.n} style={{ margin: 0 }}>
          <video src={file(slug, t.file, bust)} controls preload="metadata" style={{ width: 150, aspectRatio: '9/16', borderRadius: 8, background: '#000', outline: s.chosen === t.file ? '3px solid var(--ok)' : 'none' }} />
          <figcaption className="row" style={{ marginTop: 4 }}><span className="chip">take {t.n}{t.mock ? ' · mock' : ''} · ${t.cost.toFixed(2)}</span>
            <button className="btn" onClick={() => act(() => post(`${base}/shots/${s.id}`, { chosen: t.file }))}>{s.chosen === t.file ? '✓ chosen' : 'Choose'}</button></figcaption></figure>)}
          {s.chosen && <figure style={{ margin: 0 }}>
            {s.final ? <video src={file(slug, s.final.file, bust)} controls preload="metadata" style={{ width: 150, aspectRatio: '9/16', borderRadius: 8, background: '#000', outline: '3px solid var(--accent)' }} /> : <div className="empty" style={{ width: 150, padding: 10, border: '1px dashed var(--line)', borderRadius: 8 }}>not finished</div>}
            <figcaption className="row" style={{ marginTop: 4 }}>{s.final && <span className="chip ok">final · {s.final.engine}</span>}
              <button className="btn" disabled={busy} onClick={() => act(() => post(`${base}/shots/${s.id}/finish`))} title="Free: colour match + upscale (ComfyUI), or a Lanczos upscale (ffmpeg)">Finish shot</button></figcaption></figure>}</div>}
      </div>
    </div>
  </motion.div>;
}
