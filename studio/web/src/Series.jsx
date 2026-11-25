import { useEffect, useState, Fragment } from 'react';
import { api, file } from './api.js';

/** Stage "Series bible" of a short-drama series: the characters, the arc and every episode's cliffhanger. */
export function SeriesBible({ rec }) {
  const o = rec?.output; if (!o) return null;
  return <>
    <div className="card hero"><div className="who">◆ Claude{rec.meta?.engine === 'inbox' ? ' (via the decision inbox)' : ''}</div><div className="reason"><b>{o.title}</b> · {o.logline} {o.reason}</div></div>
    <div className="card"><dl className="kv">
      <dt>Genre</dt><dd>{o.genre} · {o.tone}</dd><dt>Promise</dt><dd>{o.hookPromise}</dd><dt>Arc</dt><dd>{o.arc}</dd>
      {o.characters.map(c => <Fragment key={c.id}><dt>{c.name}</dt><dd>{c.role} · wants {c.want} · fears {c.fear}{c.secret ? ` · secret: ${c.secret}` : ''} · voice {c.voice}
        <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6 }}>{['skin', 'hair', 'top', 'bottom'].map(k => c.look?.[k] && <span key={k} title={k} style={{ width: 12, height: 12, borderRadius: 3, background: c.look[k], border: '1px solid var(--line)' }} />)}</span></dd></Fragment>)}
    </dl></div>
    <div style={{ display: 'grid', gap: 10 }}>{o.episodes.map(e => <div key={e.n} className="card" style={{ marginBottom: 0 }}>
      <b>Ep {e.n} · {e.title}</b> <span className="chip">{e.seconds} s</span>
      <div style={{ fontSize: 13, marginTop: 4 }}><b>Hook:</b> {e.hook}</div>
      <ol style={{ fontSize: 13, margin: '4px 0' }}>{e.beats.map((b, i) => <li key={i}>{b}</li>)}</ol>
      <div style={{ fontSize: 13 }}><b>Cliffhanger:</b> {e.cliffhanger.moment}{e.cliffhanger.line ? ` — “${e.cliffhanger.line}”` : ''} <span style={{ color: 'var(--muted)' }}>({e.cliffhanger.question})</span></div>
    </div>)}</div>
  </>;
}

/** Stage "Episodes": each episode is its own video; run the next one or all of them in order. */
export function Episodes({ slug, onOpen }) {
  const [eps, setEps] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const load = () => api.series(slug).then(r => setEps(r.episodes)).catch(e => setErr(e.message));
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [slug]);
  const run = async all => { setBusy(true); setErr(''); try { await api.runSeries(slug, all); } catch (e) { setErr(e.message); } setBusy(false); load(); };
  if (!eps) return <div className="empty">Loading episodes…</div>;
  if (!eps.length) return <div className="empty">The episodes are created when this stage runs (after you approve the series bible and the style).</div>;
  return <div>
    <div className="row" style={{ marginBottom: 12 }}>
      <button className="btn primary" disabled={busy} onClick={() => run(false)}>Run next episode</button>
      <button className="btn" disabled={busy} onClick={() => run(true)} title="One after another; each still stops at its gates">Run all in order</button>
      <span style={{ color: 'var(--muted)', fontSize: 13 }}>Free with the kit styles. Seedance shots are priced on each episode's shot board.</span>
    </div>
    {err && <div className="err-box">{err}</div>}
    <div className="opts">{eps.map(e => <div key={e.slug} className="opt" style={{ cursor: 'default' }}>
      <b>Ep {e.episode} {e.running ? <span className="pulse" /> : null}</b><small>{e.title}</small>
      <small>{e.done} stages done{e.waiting ? ` · waiting at ${e.waiting}` : ''}</small>
      {e.final && <video src={file(e.slug, e.final)} controls preload="metadata" style={{ width: '100%', aspectRatio: '9/16', borderRadius: 8, background: '#000', marginTop: 6 }} />}
      <button className="btn" style={{ marginTop: 6 }} onClick={() => onOpen?.(e.slug)}>Open episode</button>
    </div>)}</div>
  </div>;
}
