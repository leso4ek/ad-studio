import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { file } from './api.js';

const j = async r => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || r.statusText); return b; };
const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }).then(j);
const VIEWS = { character: ['portrait', 'turnaround'], place: ['reverse', 'detail'], product: ['three-quarter', 'detail'], prop: ['three-quarter'] };

/** The shot board, the Higgsfield way: elements (consistency anchors) → Claude's reference-assigned prompts → drafts → final.
 *  No first/last frames; a previz still is an optional positioning-only reference. Nothing is paid for without your OK. */
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
      <p style={{ color: 'var(--muted)' }}>Works like the Higgsfield contest creators: first the <b>elements</b> (characters, places, the product) as approved reference images, then every shot gets a long prompt with a <b>references block</b> that says what each image is for. No first or last frames. When blocking matters, a previz still goes along as a positioning-only reference. Drafts at 480p, then the chosen draft is re-made at final quality with the same prompt and seed. Every paid step shows its cost and waits for your OK.</p>
      <button className="btn primary" onClick={() => act(() => post(`${base}/init`))}>Set up the shot board</button>
      {err && <div className="err-box" style={{ marginTop: 10 }}>{err}</div>}
    </div>);
  const { plan, budget, busy, recreate } = d, S = plan.settings;
  const set = patch => act(() => post(`${base}/settings`, patch));
  return (
    <div>
      <div className="card row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <label className="tog">Drafts <select className="adpick" value={S.model} onChange={e => set({ model: e.target.value })}>
            <option value="bytedance/seedance-2.5-flash">Seedance 2.5 Flash</option><option value="bytedance/seedance-2.5">Seedance 2.5</option></select>
            <select className="adpick" value={S.resolution} onChange={e => set({ resolution: e.target.value })}><option>480p</option><option>720p</option></select></label>
          <label className="tog">Finals <select className="adpick" value={S.finalResolution || '720p'} onChange={e => set({ finalResolution: e.target.value })}><option>720p</option><option>1080p</option></select></label>
          <button className="btn" disabled={!!busy} onClick={() => act(() => post(`${base}/prompts`))} title="Claude writes every shot's prompt in the creators' format (free on your Claude plan)">Claude writes the prompts</button>
          <button className="btn ghost" onClick={() => act(() => post(`${base}/init`))} title="Re-read the bible (keeps Claude's/your prompts and takes)">Sync with bible</button>
          <button className="btn" disabled={!!busy} onClick={() => act(() => post(`${base}/plates`))} title="Free: every shot with a chosen take (or a Blender render) becomes the picture of the edit; then run the Animatic and Final stages again">Use picked clips in the edit</button>
        </div>
        <div><Budget b={budget} />{budget.higgsfield && (plan.shots.some(x => GENJUTSU(x.route)) || budget.higgsfield.spent > 0) && <Budget b={budget.higgsfield} label="Higgsfield" />}</div>
      </div>
      {busy && <div className="card"><span className="pulse" /> {busy}… (follow it in the live pane)</div>}
      {err && <div className="err-box" style={{ marginBottom: 12 }}>{err}</div>}
      {plan.promptsReason && <div className="card hero"><div className="who">◆ Claude{plan.promptsBy === 'inbox' ? ' (via the decision inbox)' : ''} wrote the prompts</div><div className="reason">{plan.promptsReason}</div></div>}

      {plan.shots.some(x => GENJUTSU(x.route)) && <div className="card row">
        <h2 style={{ margin: 0 }}>Genjutsu</h2>
        <label className="tog">Mode <select className="adpick" value={S.genjutsuMode || 'motion-transfer'} onChange={e => set({ genjutsuMode: e.target.value })}>
          <option value="motion-transfer">Motion Transfer (4-30 s)</option><option value="light">Light (first 15 s, keeps the audio)</option><option value="object-swap">Object Swap</option></select></label>
        <label className="tog">Drafts <select className="adpick" value={S.genjutsuResolution || '480p'} onChange={e => set({ genjutsuResolution: e.target.value })}><option>480p</option><option>720p</option></select></label>
        <label className="tog">Finals <select className="adpick" value={S.genjutsuFinalResolution || '720p'} onChange={e => set({ genjutsuFinalResolution: e.target.value })}><option>720p</option><option>1080p</option></select></label>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>about $0.15/s at 480p, $0.34/s at 720p, $0.83/s at 1080p · each take asks first</span>
      </div>}
      <Looks S={S} set={set} busy={!!busy} />
      <h2>Elements: the consistency anchors (choose 1–3 views each)</h2>
      <div className="opts" style={{ marginBottom: 18 }}>{plan.assets.map(a => <Element key={a.id} a={a} base={base} slug={slug} bust={bust} act={act} S={S} busy={!!busy} />)}</div>

      <h2>Shots</h2>
      <div style={{ display: 'grid', gap: 14 }}>{plan.shots.map(s => <Shot key={s.id} s={s} plan={plan} recreate={recreate} slug={slug} base={base} bust={bust} act={act} busy={!!busy} />)}</div>
    </div>
  );
}

const GENJUTSU = r => r === 'genjutsu' || r === 'blender→genjutsu';
const ROUTES = [['seedance', 'Seedance (paid)'], ['kit', 'Code-drawn (free)'], ['three', 'three.js stage (free)'], ['blender', 'Blender (free)'], ['blender→genjutsu', 'Blender → Genjutsu (paid)'], ['genjutsu', 'Genjutsu from the upload (paid)']];
function Budget({ b, label = 'OpenRouter' }) {
  const pct = Math.min(100, b.spent / b.cap * 100);
  return <div style={{ minWidth: 200, marginBottom: 4 }} title="Hard cap: a paid call that would pass it is refused">
    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label} · {b.mock ? 'MOCK MODE · ' : ''}spent ${b.spent.toFixed(2)} of ${b.cap.toFixed(2)}</div>
    <div style={{ height: 6, background: 'var(--line)', borderRadius: 4, marginTop: 4 }}><div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? 'var(--err)' : 'var(--ok)', borderRadius: 4 }} /></div>
  </div>;
}

function Element({ a, base, slug, bust, act, S, busy }) {
  const [role, setRole] = useState(a.role || ''), [open, setOpen] = useState(false), [prompt, setPrompt] = useState('');
  useEffect(() => setRole(a.role || ''), [a.role]);
  const picks = a.picks || [];
  return <div className="opt" style={{ cursor: 'default' }}>
    <b>{a.name || a.id} <span className={`chip ${a.status === 'approved' ? 'ok' : a.status === 'review' ? 'gate' : ''}`}>{a.kind} · {picks.length} view{picks.length === 1 ? '' : 's'}</span></b>
    <small>{a.desc}</small>
    <label style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, display: 'block' }}>Role line (goes into every prompt's REFERENCES block)</label>
    <textarea className="note" style={{ minHeight: 44, fontSize: 12 }} value={role} onChange={e => setRole(e.target.value)} onBlur={() => role !== a.role && act(() => post(`${base}/assets/${a.id}`, { role }))} />
    <div className="row" style={{ marginTop: 6 }}>{a.files.map(f => {
      const k = picks.indexOf(f);
      return <button key={f} className="opt" aria-pressed={k >= 0} style={{ padding: 2, width: 70, position: 'relative' }} title={k === 0 ? 'main view' : k > 0 ? `extra view ${k + 1}` : 'click: main view · shift-click: add as extra view'}
        onClick={e => act(() => post(`${base}/assets/${a.id}/choose`, { file: f, add: e.shiftKey || (picks.length > 0 && k < 0 && e.altKey) }))}>
        <img src={file(slug, f, bust)} alt="" style={{ width: '100%', borderRadius: 5 }} />{k >= 0 && <span className="chip ok" style={{ position: 'absolute', top: 2, left: 2, padding: '0 5px' }}>{k + 1}</span>}</button>;
    })}</div>
    <div className="row" style={{ marginTop: 6 }}>
      <button className="btn" disabled={busy} onClick={() => setOpen(o => !o)}>Make…</button>
      {a.chosen && (VIEWS[a.kind] || []).map(v => <button key={v} className="btn ghost" disabled={busy} title={`Paid: a ${v} of the exact same ${a.kind}, made from your main view`}
        onClick={() => { if (confirm(`Make a ${v} view of ${a.name} from its main view (2 options, about $0.06)?`)) act(() => post(`${base}/assets/${a.id}/make`, { view: v, n: 2, confirm: true })); }}>+ {v}</button>)}
    </div>
    {open && <div style={{ marginTop: 6 }}>
      <textarea className="note" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Empty = the standard sheet prompt (views on flat grey, the locked style)" />
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn" disabled={busy} onClick={() => act(() => post(`${base}/assets/${a.id}/make`, { source: 'blender' }))} title="Free: renders production/blender/asset-<id>.json; later sheets use it as a reference">Blender render (free)</button>
        <button className="btn primary" disabled={busy} onClick={() => { if (confirm(`Generate 2 sheets with ${S.imageModel}? About $0.05–0.10.`)) act(() => post(`${base}/assets/${a.id}/make`, { prompt: prompt || undefined, n: 2, confirm: true })); }}>Image model (paid)…</button>
      </div></div>}
    <small style={{ marginTop: 4 }}>Click a sheet to make it the main view; shift-click to add or remove an extra view.</small>
  </div>;
}

function Shot({ s, plan, recreate, slug, base, bust, act, busy }) {
  const [prompt, setPrompt] = useState(s.prompt), dirty = prompt !== s.prompt;
  useEffect(() => setPrompt(s.prompt), [s.prompt]);
  const refs = (s.refs || []).flatMap(id => { const a = plan.assets.find(x => x.id === id); const v = a?.picks?.length ? a.picks.slice(0, 2) : a?.chosen ? [a.chosen] : []; return v.length ? v.map((f, i) => ({ id, f, label: `${a.name}${v.length > 1 ? ` ${i + 1}` : ''}` })) : [{ id, f: null, label: `${a?.name || id} (no view yet)` }]; });
  if (s.layoutRef) refs.push({ id: 'layout', f: s.previz ? `production/previz/${s.id}_layout.png` : null, label: 'layout (positioning only)' });
  const gen = async kind => {
    const e = await fetch(`${base}/shots/${s.id}/estimate?kind=${kind}`).then(j);
    if (confirm(`${kind === 'final' ? 'Final' : 'Draft'} of ${s.id}: ${e.seconds || s.seconds} s, ${e.engine === 'higgsfield' ? e.model : e.model.split('/')[1]}, ${e.resolution}.\nAbout $${e.estimate.toFixed(2)}${e.mock ? ' (mock mode: free)' : ''}. Spent so far $${e.spent.toFixed(2)} of $${e.cap.toFixed(2)}.`))
      act(() => post(`${base}/shots/${s.id}/take`, { confirm: true, kind }));
  };
  const drafts = s.takes.filter(t => t.kind !== 'final'), finals = s.takes.filter(t => t.kind === 'final');
  return <motion.div className="card" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
      <div className="row"><b>{s.id}</b><span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>{s.t0}–{s.t1} s · generate {s.seconds} s{GENJUTSU(s.route) ? '' : ` · seed ${s.seed}`}</span>
        {s.span && <span className="chip" title="Consecutive Genjutsu shots are sent as one segment of 4-30 s">covers {s.covers.join(', ')} · source {s.source.t0.toFixed(1)}–{s.source.t1.toFixed(1)} s</span>}
        <span className={`chip ${s.status === 'finished' ? 'ok' : s.status === 'review' ? 'gate' : s.status === 'error' ? 'err' : ''}`}>{s.status}</span>
        <span className={`chip ${s.promptBy === 'claude' ? 'claude' : ''}`}>{s.promptEdited ? 'prompt edited by you' : s.promptBy === 'claude' ? 'prompt by Claude' : 'template prompt'}</span></div>
      <div className="row">
        <label className="tog" title="On: the previz middle still goes along as a positioning-only reference (never a frame). Off: prompting only."><input type="checkbox" checked={!!s.layoutRef} onChange={e => act(() => post(`${base}/shots/${s.id}`, { layoutRef: e.target.checked }))} />blocking matters</label>
        <select className="adpick" value={s.route} onChange={e => act(() => post(`${base}/shots/${s.id}`, { route: e.target.value }))} aria-label="Route">
          {ROUTES.filter(([k]) => k !== 'genjutsu' || (recreate?.rights && recreate?.source) || s.route === 'genjutsu').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 14 }}>
      <div>
        {s.route === 'genjutsu' && recreate?.source ? <><video src={`${file(slug, recreate.source)}#t=${(s.source || s).t0},${(s.source || s).t1}`} controls muted preload="metadata" style={{ width: 150, aspectRatio: '9/16', objectFit: 'cover', borderRadius: 8, background: '#000' }} />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>the source segment: Genjutsu keeps its motion</div></>
        : s.previz ? <video src={file(slug, s.previz.file, bust)} controls muted loop style={{ width: 150, aspectRatio: '9/16', borderRadius: 8, background: '#000' }} /> : <div className="empty" style={{ padding: 16, border: '1px dashed var(--line)', borderRadius: 8, fontSize: 12 }}>previz (only needed when blocking matters)</div>}
        {s.route !== 'genjutsu' && <button className="btn" style={{ marginTop: 6, width: '100%' }} disabled={busy} onClick={() => act(() => post(`${base}/shots/${s.id}/previz`))}>{s.previz ? 'Redo previz' : 'Make previz'}</button>}
      </div>
      <div>
        <div className="row" style={{ marginBottom: 6 }}><span style={{ fontSize: 12, color: 'var(--muted)' }}>References in order:</span>
          {refs.map((r, i) => <span key={i} className={`chip ${r.f ? 'ok' : 'warn'}`} title={r.f || 'no image yet: skipped'}>{i + 1} · {r.label}</span>)}</div>
        <textarea className="note" style={{ minHeight: 170, fontFamily: 'var(--mono)', fontSize: 12 }} value={prompt} onChange={e => setPrompt(e.target.value)} />
        <div className="row" style={{ marginTop: 6 }}>
          {dirty && <button className="btn" onClick={() => act(() => post(`${base}/shots/${s.id}`, { prompt }))}>Save prompt</button>}
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{prompt.split(/\s+/).length} words</span>
          {(s.route === 'seedance' || GENJUTSU(s.route)) && <button className="btn primary" disabled={busy || (s.layoutRef && !s.previz) || (s.route === 'blender→genjutsu' && !s.previz)} onClick={() => gen('draft')}>Draft…</button>}
          {(s.route === 'seedance' || GENJUTSU(s.route)) && s.chosen && <button className="btn" disabled={busy} onClick={() => gen('final')} title="Same prompt, references and seed as the chosen draft, at final quality">Make final…</button>}
        </div>
        {s.error && <div className="err-box" style={{ marginTop: 8 }}>{s.error}</div>}
        {s.takes.length > 0 && <div className="videos" style={{ marginTop: 10 }}>
          {[...drafts, ...finals].map(t => <figure key={t.n} style={{ margin: 0 }}>
            <video src={file(slug, t.file, bust)} controls preload="metadata" style={{ width: 140, aspectRatio: '9/16', borderRadius: 8, background: '#000', outline: s.chosen === t.file || s.finalTake === t.file ? `3px solid ${t.kind === 'final' ? 'var(--accent)' : 'var(--ok)'}` : 'none' }} />
            <figcaption className="row" style={{ marginTop: 4 }}><span className="chip">{t.kind === 'final' ? 'final' : `draft ${t.n}`}{t.mock ? ' · mock' : ''}{t.mode ? ` · ${t.mode}` : ''} · ${t.cost.toFixed(2)}</span>
              {t.kind !== 'final' && <button className="btn" onClick={() => act(() => post(`${base}/shots/${s.id}`, { chosen: t.file }))}>{s.chosen === t.file ? '✓ chosen' : 'Choose'}</button>}</figcaption></figure>)}
          {(s.chosen || s.finalTake) && <figure style={{ margin: 0 }}>
            {s.final ? <video src={file(slug, s.final.file, bust)} controls preload="metadata" style={{ width: 140, aspectRatio: '9/16', borderRadius: 8, background: '#000', outline: '3px solid var(--accent)' }} /> : <div className="empty" style={{ width: 140, padding: 10, border: '1px dashed var(--line)', borderRadius: 8 }}>not finished</div>}
            <figcaption className="row" style={{ marginTop: 4 }}>{s.final && <span className="chip ok">finished · {s.final.engine}</span>}
              <button className="btn" disabled={busy} onClick={() => act(() => post(`${base}/shots/${s.id}/finish`))} title="Free: colour match + upscale (ComfyUI), or a Lanczos upscale (ffmpeg)">Finish shot</button></figcaption></figure>}
        </div>}
      </div>
    </div>
  </motion.div>;
}

// the Seedance style catalogue: one look per ad; picking it locks the STYLE paragraph every prompt pastes verbatim
function Looks({ S, set, busy }) {
  const [list, setList] = useState(null), [open, setOpen] = useState(false);
  useEffect(() => { fetch('/api/catalog').then(r => r.json()).then(setList).catch(() => setList([])); }, []);
  if (!list?.length) return null;
  const cur = list.find(e => e.slug === S.catalogStyle), fams = [...new Set(list.map(e => e.family))];
  return <div className="card">
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <div><h2>Look</h2><b>{cur ? cur.name : 'the bible\'s own style paragraph'}</b>{cur && <span style={{ color: 'var(--muted)' }}> · {cur.traits.slice(0, 2).join('; ')}</span>}</div>
      <div className="row">{cur && <button className="btn ghost" disabled={busy} onClick={() => set({ catalogStyle: '' })}>Use the bible's</button>}<button className="btn" onClick={() => setOpen(o => !o)}>{open ? 'Close' : `Choose from ${list.length} styles`}</button></div>
    </div>
    {open && fams.map(f => <div key={f}><h3 style={{ marginTop: 12 }}>{list.find(e => e.family === f)?.familyName || f}</h3>
      <div className="opts">{list.filter(e => e.family === f).map(e => <button key={e.slug} className="opt" aria-pressed={e.slug === S.catalogStyle} disabled={busy} onClick={() => set({ catalogStyle: e.slug })} title={`${e.traits.join('; ')}\nBest for: ${e.bestFor.join(', ')}`}>
        {e.example ? <img src={e.example} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', borderRadius: 7, marginBottom: 6, background: '#000' }} /> : null}
        <div style={{ fontWeight: 600 }}>{e.name}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.example ? e.bestFor.slice(0, 2).join(', ') : e.traits[0]}</div></button>)}</div></div>)}
  </div>;
}
