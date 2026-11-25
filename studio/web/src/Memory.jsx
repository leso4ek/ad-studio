// Ad Studio · the hindsight memory: what Claude has learned from past ads, and the rules waiting for your approval.
import { useEffect, useState } from 'react';
import { api } from './api.js';

const KIND = { real: 'missed its goal: do this instead', hindsight: 'what an attempt did achieve, kept as a recipe', future: 'a later fix, kept as the example' };

export default function Memory({ slug }) {
  const [m, setM] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const load = () => api.memory().then(setM).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const act = async fn => { setBusy(true); setErr(''); try { await fn(); await load(); } catch (e) { setErr(e.message); } setBusy(false); };
  if (!m) return <div className="empty">{err || 'Loading the memory…'}</div>;
  const pending = m.proposals.filter(p => p.status === 'pending');
  return (
    <div>
      <h2>Hindsight memory</h2>
      <h3>What Claude learned from past ads</h3>
      <div className="row" style={{ color: 'var(--muted)', marginBottom: 12 }}>
        <span className="chip">{m.ads.length} ad{m.ads.length === 1 ? "" : "s"}</span><span className="chip">{m.episodes} decisions</span><span className="chip">{m.signals} outcome signals</span><span className="chip">{m.lessons.length} lessons</span>
        {slug && <button className="btn" disabled={busy} onClick={() => act(() => api.learn(slug))} title="One short Claude call turns this ad's outcomes into lessons">Learn from this ad</button>}
      </div>
      {err && <div className="err-box">{err}</div>}
      <div className="card">
        <h2>Rules waiting for you · {pending.length}</h2>
        {!pending.length && <p style={{ color: 'var(--muted)' }}>A lesson becomes a proposed rule once it has shown up in 3 different ads. Approved rules are written into the director skill.</p>}
        {pending.map(p => <div key={p.id} className="row" style={{ justifyContent: 'space-between', margin: '8px 0', gap: 12 }}>
          <div><span className="chip">{p.stage}</span> {p.rule}{p.when && p.when !== 'any' ? <span style={{ color: 'var(--muted)' }}> · when: {p.when}</span> : null}<div style={{ color: 'var(--muted)', fontSize: 13 }}>seen in {p.ads.join(', ')}</div></div>
          <div className="row"><button className="btn primary" disabled={busy} onClick={() => act(() => api.proposal(p.id, true))}>Make it a rule</button><button className="btn" disabled={busy} onClick={() => act(() => api.proposal(p.id, false))}>Reject</button></div>
        </div>)}
      </div>
      <div className="card">
        <h2>Lessons</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>The best ones for each stage go into Claude's prompt automatically (about 600 tokens at most).</p>
        <table className="shots"><tbody>
          {m.lessons.map(l => <tr key={l.id}><td><span className="chip">{l.stage}</span></td><td>{l.lesson}{l.when && l.when !== 'any' ? <div style={{ color: 'var(--muted)' }}>when: {l.when}</div> : null}</td>
            <td title={KIND[l.kind]} style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{l.kind}{l.status ? ` · ${l.status}` : ''}</td><td style={{ whiteSpace: 'nowrap' }}>{l.ads.length} ad{l.ads.length > 1 ? 's' : ''}</td></tr>)}
        </tbody></table>
        {!m.lessons.length && <p className="empty">No lessons yet: they appear after a scorecard or an audience test.</p>}
      </div>
    </div>
  );
}
