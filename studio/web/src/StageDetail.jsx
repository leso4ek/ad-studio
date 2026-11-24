import { useState, Fragment } from 'react';
import { motion } from 'motion/react';
import { api, file } from './api.js';

const STATUS = { offer: 'optional: start it when you want', idle: 'waiting', running: 'running…', review: 'waiting for your review', gate: 'waiting for your approval', done: 'done', error: 'error', stale: 'stale: an earlier stage changed' };
const sec = ms => ms ? `${(ms / 1000).toFixed(1)} s` : '';

export default function StageDetail({ ad, meta, id, bust, onNow, refresh }) {
  const st = meta?.stages.find(s => s.id === id); if (!st) return null;
  const x = ad.project.stages[id] || { status: 'idle' }, rec = ad.decisions[id], slug = ad.project.slug;
  const waiting = x.status === 'gate' || x.status === 'review';
  const [note, setNote] = useState(''), [redo, setRedo] = useState(false), [busy, setBusy] = useState(false);
  const act = async (fn) => { setBusy(true); try { await fn(); } catch (e) { alert(e.message); } setBusy(false); refresh(); };
  const choose = (choice) => waiting && act(() => api.approve(slug, id, choice));
  const P = { ad, rec, x, slug, bust, onNow, choose, waiting };

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2>Stage {st.n} of {meta.stages.length} · {st.kind === 'decide' ? 'Claude decides' : 'engines'}{st.gate ? ' · gate' : ''}{st.optional ? ' · optional' : ''}{st.paid ? ' · paid' : ''}</h2>
          <h3>{st.title}</h3>
          <div className="row" style={{ color: 'var(--muted)' }}>
            <span className={`chip ${x.status === 'done' ? 'ok' : x.status === 'error' ? 'err' : waiting ? 'gate' : ''}`}>{STATUS[x.status] || x.status}</span>
            {x.engine && <span className="chip">{x.engine}</span>}
            {x.ms && <span>{sec(x.ms)}</span>}
            {rec?.meta?.cost_usd_list !== undefined && <span title="Claude Code's own estimate at API list price; on a subscription it is part of your plan">≈ ${rec.meta.cost_usd_list?.toFixed(2)} list</span>}
            {rec?.meta?.turns && <span>{rec.meta.turns} turns</span>}
            {rec?.overriddenBy && <span className="chip warn">you overrode Claude</span>}
          </div>
        </div>
        <div className="row">
          {waiting && <button className="btn primary" disabled={busy} onClick={() => act(() => api.approve(slug, id))}>{x.status === 'gate' ? 'Approve & continue' : 'Looks good, continue'}</button>}
          {['done', 'gate', 'review', 'error', 'stale'].includes(x.status) && !ad.running && <button className="btn" disabled={busy} onClick={() => setRedo(r => !r)}>Redo…</button>}
          {st.paid && ['idle', 'offer', 'stale', 'error', 'done'].includes(x.status) && !ad.running && ad.project.stages.final?.status === 'done' && <button className="btn primary" disabled={busy} title="MiroFish simulated viewers on a cheap OpenRouter model; stopped automatically at the cap" onClick={() => confirm('Run the audience test? It spends up to $1 of OpenRouter (usually less) and takes 10-30 minutes.') && act(() => api.run(slug, id))}>{x.status === 'done' ? 'Run it again (≤ $1)' : 'Run the audience test (≤ $1)'}</button>}
          {!st.paid && ['idle', 'stale', 'error'].includes(x.status) && !ad.running && <button className="btn" disabled={busy} onClick={() => act(() => api.run(slug, id))}>Run from here</button>}
        </div>
      </div>
      {redo && <motion.div className="card" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
        <label htmlFor="note" style={{ color: 'var(--muted)', fontSize: 13 }}>{st.kind === 'decide' ? 'Tell Claude what to change (optional). The stages after this one become stale and run again.' : 'Run this stage again. The stages after it become stale.'}</label>
        {st.kind === 'decide' && <textarea id="note" className="note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. make the hook a question; keep the cat" />}
        <div className="row" style={{ marginTop: 8 }}><button className="btn primary" disabled={busy} onClick={() => act(() => api.redo(slug, id, note)).then(() => { setRedo(false); setNote(''); })}>Redo {st.title.toLowerCase()}</button></div>
      </motion.div>}
      {x.error && <div className="err-box" style={{ marginBottom: 14 }}>{x.error}</div>}
      {(x.fallbacks || []).length > 0 && <div className="card"><h2>Fallbacks taken</h2>{x.fallbacks.map((f, i) => <div key={i} style={{ fontSize: 13 }}><b>{f.engine}</b>: {f.why}</div>)}</div>}
      {x.status === 'running' && !rec && <div className="card"><span className="pulse" /> Working. Follow it in the Claude live pane.</div>}
      <Body id={id} {...P} />
      {(x.warnings || []).length > 0 && <ul className="warn-list">{x.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
    </div>
  );
}

function Why({ rec }) {
  if (!rec) return null;
  return <div className="card hero"><div className="who">◆ Claude{rec.meta?.engine === 'inbox' ? ' (via the decision inbox)' : ''}{rec.note ? ` · redo note: "${rec.note}"` : ''}</div><div className="reason">{rec.output.reason}</div></div>;
}

function Body({ id, ad, rec, x, slug, bust, onNow, choose, waiting }) {
  const o = rec?.output;
  switch (id) {
    case 'brief': return o ? <>
      <Why rec={rec} />
      <div className="card"><dl className="kv">
        <dt>Product</dt><dd><b>{o.product.name}</b> · {o.product.what}</dd>
        <dt>Benefit</dt><dd>{o.product.benefit}</dd>
        <dt>Pack</dt><dd className="row">{o.product.kind} · “{o.product.label}” {Object.entries(o.product.colors || {}).map(([k, c]) => <span key={k} title={k} style={{ width: 18, height: 18, borderRadius: 5, background: c, border: '1px solid var(--line)', display: 'inline-block' }} />)}</dd>
        <dt>Proof</dt><dd>{o.product.proof.join(' · ')}</dd>
        <dt>Audience</dt><dd>{o.audience.who}. {o.audience.moment}. {o.audience.pain}</dd>
        <dt>May say</dt><dd>{o.claims.join(' · ')}</dd>
        <dt>Never say</dt><dd>{(o.noClaims || []).join(' · ')}</dd>
        <dt>Format</dt><dd>{o.format.aspect}, {o.format.seconds} s · {o.tone}{o.fictional ? ' · fictional product' : ''}</dd>
      </dl></div></> : <Pending x={x} />;
    case 'premises': return o ? <>
      <Why rec={rec} />
      <div className="opts">{o.premises.map(p => <button key={p.id} className="opt" aria-pressed={p.id === o.chosen} onClick={() => choose(p.id)} disabled={!waiting && p.id !== o.chosen} title={waiting ? 'Pick this premise instead' : ''}>
        <b>{p.id === o.chosen ? '★ ' : ''}{p.logline}</b><small>{p.emotion} · turn: {p.productRole}</small><small>hook: {p.hookIdea}</small></button>)}</div>
      {waiting && <p style={{ color: 'var(--muted)' }}>Click another premise to override Claude's pick, or approve.</p>}</> : <Pending x={x} />;
    case 'hooks': return o ? <>
      <Why rec={rec} />
      <div className="opts">{o.hooks.map(h => <button key={h.id} className="opt" aria-pressed={h.id === o.lead} onClick={() => choose(h.id)} disabled={!waiting && h.id !== o.lead}>
        <b>{h.id}{h.id === o.lead ? ' · lead' : ' · A/B variant'}: “{h.onScreen}”</b><small>{h.type}</small><small>{h.visual}</small>{h.vo && <small>VO: “{h.vo}”</small>}</button>)}</div></> : <Pending x={x} />;
    case 'story': return o ? <>
      <Why rec={rec} />
      <div className="card"><h2>Story Spine</h2><ol style={{ margin: 0, paddingLeft: 18 }}>{o.spine.map((l, i) => <li key={i}>{l}</li>)}</ol></div>
      <div className="card"><h2>Five acts · {o.emotion}</h2><table className="shots"><tbody>{o.acts.map(a => <tr key={a.act}><td>{a.act}</td><td>{a.name}</td><td style={{ fontFamily: 'var(--mono)' }}>{a.t0}–{a.t1} s</td><td>{a.beats}</td></tr>)}</tbody></table><p style={{ marginBottom: 0 }}><b>Turn:</b> {o.turn}</p></div></> : <Pending x={x} />;
    case 'brandmap': return o ? <>
      <Why rec={rec} />
      <div className="card"><dl className="kv">
        <dt>Plant</dt><dd>{o.plant.t} s · {o.plant.how}</dd>
        {o.pulses.map((p, i) => <Fragment key={i}><dt>Pulse</dt><dd>{p.t} s · {p.how}</dd></Fragment>)}
        <dt>Reveal</dt><dd>{o.reveal.t} s · {o.reveal.how}</dd>
        <dt>Tag</dt><dd>{o.tag.t} s · “{o.tag.line}”</dd>
      </dl></div>
      <div className="card"><h2>Claims and their basis</h2>{o.claims.map((c, i) => <div key={i}>“{c.text}” <span style={{ color: 'var(--muted)' }}>← {c.basis}</span></div>)}</div></> : <Pending x={x} />;
    case 'style': return o ? <>
      <Why rec={rec} />
      <div className="opts">{['ad-paper-cutout', 'ad-riso-print', 'ad-midcentury-toon', 'ad-kinetic-type', 'ad-toy-3d'].map(s => {
        const alt = o.alternatives.find(a => a.style === s);
        return <button key={s} className="opt" aria-pressed={s === o.style} onClick={() => choose(s)} disabled={!waiting && s !== o.style}>
          <img src={`/styleframes/${s}.jpg`} alt="" style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', borderRadius: 7, marginBottom: 6, background: '#000' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          <b>{s === o.style ? '★ ' : ''}{s.replace('ad-', '').replace(/-/g, ' ')}</b>{alt && <small>not this: {alt.why_not}</small>}</button>;
      })}</div>
      {waiting && <p style={{ color: 'var(--muted)' }}>This is a gate: approve Claude's style or click another. The bible keeps the story; only the look changes.</p>}</> : <Pending x={x} />;
    case 'bible': return ad.bible ? <>
      <Why rec={rec} />
      <div className="card"><h2>{ad.bible.title} · {ad.bible.style} · {ad.bible.dur} s</h2><p style={{ marginTop: 0, color: 'var(--muted)' }}>{ad.bible.stylePara}</p>
        <table className="shots"><thead><tr><th>Shot</th><th>Time</th><th>Beat</th><th>Place</th><th>What we see</th></tr></thead><tbody>
          {ad.bible.shots.map(s => <tr key={s.id}><td>{s.id}</td><td style={{ fontFamily: 'var(--mono)' }}>{s.t0}–{s.t1}</td><td>{s.beat}</td><td>{s.place}</td><td>{(s.layers || []).map(l => l.type === 'text' ? `“${l.text.replace(/\n/g, ' ')}”` : l.type === 'char' ? `${l.id} (${l.pose || 'neutral'})` : l.type === 'product' ? `product${(l.anim || []).includes('reveal') ? ' REVEAL' : ''}` : l.kind).join(' · ')}{s.note ? <div style={{ color: 'var(--muted)' }}>{s.note}</div> : null}</td></tr>)}
          <tr><td>end</td><td style={{ fontFamily: 'var(--mono)' }}>{ad.bible.endcard.t0}–{ad.bible.dur}</td><td>tag</td><td></td><td>{ad.bible.endcard.logo} · “{ad.bible.endcard.line}” · {ad.bible.endcard.cta}</td></tr>
        </tbody></table></div>
      <div className="card"><h2>Voice ({ad.bible.vo.voice}, speed {ad.bible.vo.speed})</h2>{ad.bible.vo.lines.map(l => <div key={l.id}><span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{l.at.toFixed(1)} s</span> <b>{l.speaker || 'narrator'}</b>: {l.text}</div>)}</div></> : <Pending x={x} />;
    case 'frames': {
      const files = (x.outputs || []).filter(f => /f_|w_/.test(f)), review = ad.decisions['frames-review'];
      return <>
        {review && <Why rec={review} />}
        {review?.output?.notes?.length > 0 && <div className="card"><h2>Claude's notes</h2>{review.output.notes.map((n, i) => <div key={i}><b>{n.shot || ''}</b> {n.issue}{n.fix ? <span style={{ color: 'var(--muted)' }}> → {n.fix}</span> : null}</div>)}</div>}
        {files.length ? <div className="gallery">{files.map(f => <figure key={f}><img src={file(slug, f, bust)} alt={f} loading="lazy" /><figcaption>{f.includes('w_') ? '16:9 · ' : ''}{f.replace(/.*[fw]_/, '').replace('.jpg', '')} s</figcaption></figure>)}</div> : <Pending x={x} />}
      </>;
    }
    case 'voice': {
      const r = x.result || {}, lines = ad.bible?.vo?.lines || [];
      return x.status === 'idle' ? <Pending x={x} /> : <>
        <div className="card"><div className="row" style={{ marginBottom: 8 }}><span className="chip">{r.engine || x.engine}</span><span className={`chip ${r.check?.pass ? 'ok' : r.check?.pass === false ? 'err' : ''}`}>speech check: {r.check?.pass === null ? 'not run' : r.check?.pass ? 'pass' : 'fail'} ({r.check?.engine})</span></div>
          <div className="lines">{lines.map(l => <div className="line" key={l.id}><span className="at">{l.at.toFixed(1)} s</span><span><b>{l.speaker || 'narrator'}</b> {l.text}{r.durs?.[l.id] ? <span style={{ color: 'var(--muted)' }}> · {r.durs[l.id].toFixed(1)} s</span> : null}</span><audio controls preload="none" src={file(slug, `voice/lines/${l.id}.wav`, bust)} /></div>)}</div>
          {(r.warnings || []).length > 0 && <ul className="warn-list">{r.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          {r.check?.report && <details style={{ marginTop: 10 }}><summary>speech-check report</summary><pre className="log">{r.check.report}</pre></details>}
        </div>
        <div className="card"><h2>Captions</h2>{ad.cues.map((c, i) => <div key={i} style={{ fontSize: 13 }}><span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{c.t0.toFixed(2)}–{c.t1.toFixed(2)}</span> {c.text}</div>)}</div></>;
    }
    case 'animatic': {
      const r = x.result || {};
      return x.status === 'idle' ? <Pending x={x} /> : <>
        <div className="videos"><video className="v916" controls src={file(slug, 'out/animatic.mp4', bust)} onTimeUpdate={e => onNow(e.currentTarget.currentTime)} /></div>
        <div className="card" style={{ marginTop: 14 }}><h2>Checks</h2><div className="row">
          {Object.entries(r.checks || {}).map(([k, v]) => <span key={k} className={`chip ${v ? 'ok' : 'err'}`}>{k}: {v ? 'pass' : 'look'}</span>)}</div>
          {r.details?.readcheck && <details style={{ marginTop: 10 }}><summary>reading-time report</summary><pre className="log">{r.details.readcheck}</pre></details>}
          {[...(r.details?.safe9x16 || []), ...(r.details?.safe16x9 || [])].map((o, i) => <div key={i} style={{ fontSize: 13, color: 'var(--warn)' }}>{o.t} s · “{o.text}” outside the safe zone</div>)}
        </div></>;
    }
    case 'final': {
      const outs = (x.outputs || []).filter(f => f.endsWith('.mp4'));
      return x.status === 'idle' ? <Pending x={x} /> : <>
        <div className="videos">
          {outs.filter(f => f.includes('9x16')).map(f => <figure key={f} style={{ margin: 0 }}><video className="v916" controls src={file(slug, f, bust)} poster={file(slug, `out/${slug}-poster.jpg`, bust)} onTimeUpdate={e => onNow(e.currentTarget.currentTime)} /><figcaption className="chip" style={{ marginTop: 6, display: 'inline-block' }}>9:16 master</figcaption></figure>)}
          <div style={{ display: 'grid', gap: 12, flex: 1, minWidth: 280 }}>
            {outs.filter(f => f.includes('16x9')).map(f => <figure key={f} style={{ margin: 0 }}><video className="v169" controls src={file(slug, f, bust)} /><figcaption className="chip" style={{ marginTop: 6, display: 'inline-block' }}>16:9</figcaption></figure>)}
            <div className="videos">{outs.filter(f => f.includes('hook')).map(f => <figure key={f} style={{ margin: 0 }}><video className="small" controls preload="metadata" src={file(slug, f, bust)} /><figcaption className="chip" style={{ marginTop: 6, display: 'inline-block' }}>hook {f.replace(/.*hook|\.mp4/g, '')}</figcaption></figure>)}</div>
          </div>
        </div>
        <div className="card" style={{ marginTop: 14 }}><h2>Files</h2>{(x.outputs || []).map(f => <div key={f}><a href={file(slug, f)} download style={{ color: 'var(--ink)' }}>{f}</a></div>)}
          {Object.entries(x.result?.probes || {}).map(([k, p]) => <div key={k} style={{ fontSize: 13, color: 'var(--muted)' }}>{k}: {p?.w}×{p?.h} · {p?.fps} · {p?.dur} s</div>)}</div></>;
    }
    case 'scorecard': return o ? <>
      <Why rec={rec} />
      <div className="card"><h2>{o.total}/35 · {o.verdict}</h2><table className="shots"><tbody>{o.scores.map((s, i) => <tr key={i}><td>{s.rule}</td><td><Bar v={s.score} /></td><td>{s.note}</td></tr>)}</tbody></table>
        <p><b>Test first:</b> hook {o.bestHook}</p><ul>{o.fixes.map((f, i) => <li key={i}>{f}</li>)}</ul>
        <a className="btn" href={file(slug, 'out/REPORT.md')} target="_blank" rel="noreferrer">Open REPORT.md</a></div></> : <Pending x={x} />;
    case 'audience': return o ? <>
      <div className="card hero"><div className="who">◆ Claude read MiroFish's report{o.mock ? ' (mock run)' : ''} · {o.stats?.agents ?? '?'} simulated viewers · {o.stats?.rounds ?? '?'} rounds · ${(o.costUsd || 0).toFixed(2)} of OpenRouter · confidence {o.confidence}</div><div className="reason">{o.reason}</div></div>
      <div className="card"><h2>Simulated audience</h2><table className="shots"><tbody>
        {[['stopScroll', 'Stops scrolling'], ['watchThrough', 'Watches to the end'], ['brandRecall', 'Remembers the brand'], ['trust', 'Believes the claims'], ['clickIntent', 'Wants to click']].map(([k, l]) => <tr key={k}><td>{l}</td><td><Bar v={o.scores[k]} /></td></tr>)}
      </tbody></table><p><b>Opening that worked best:</b> {o.bestHook}</p>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Simulated viewers are language-model agents: read this as a smoke test next to the scorecard, not as real audience data.</p></div>
      <div className="card"><h2>What they said</h2>{o.comments.map((c, i) => <div key={i} style={{ fontSize: 14, margin: '6px 0' }}><span className={`chip ${c.tone === 'positive' ? 'ok' : c.tone === 'negative' ? 'err' : ''}`}>{c.who}</span> {c.text}</div>)}</div>
      <div className="card"><h2>Fixes</h2><ul>{o.fixes.map((f, i) => <li key={i}>{f}</li>)}</ul>{o.risks?.length > 0 && <><h2>Risks</h2><ul>{o.risks.map((f, i) => <li key={i}>{f}</li>)}</ul></>}
        <div className="row"><a className="btn" href={file(slug, 'out/audience/report.md')} target="_blank" rel="noreferrer">MiroFish report</a><a className="btn" href={file(slug, 'out/audience/dossier.md')} target="_blank" rel="noreferrer">What the viewers were shown</a></div></div></> : <div className="empty">{x.status === 'running' ? 'Simulating viewers… follow the steps in the live pane.' : x.status === 'error' ? 'The audience test stopped (above).' : 'Optional: after the final, simulated viewers react to the ad (MiroFish, about $0.10-1).'}</div>;
    default: return null;
  }
}

function Bar({ v }) { return <span aria-label={`${v} of 5`} style={{ display: 'inline-flex', gap: 2 }}>{[1, 2, 3, 4, 5].map(i => <i key={i} style={{ width: 10, height: 10, borderRadius: 3, background: i <= v ? 'var(--ok)' : 'var(--line)', display: 'inline-block' }} />)}</span>; }
function Pending({ x }) { return <div className="empty">{x.status === 'running' ? 'Working on it…' : x.status === 'error' ? 'This stage stopped with an error (above).' : 'Not run yet.'}</div>; }
