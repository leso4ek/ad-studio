import { useEffect, useRef, useState } from 'react';

const time = at => at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

/** Everything Claude (and the engines) do, live: text, thinking, tool calls, results, decisions, gates, fallbacks. */
export default function ClaudePane({ events, running, pending, slug }) {
  const [filter, setFilter] = useState('claude');
  const box = useRef(null), stick = useRef(true);
  const list = events.filter(e => filter === 'all' ? true : filter === 'claude' ? (e.type === 'claude' || e.type === 'decision' || e.type === 'gate') : (e.type === 'engine' || e.type === 'job' || e.type === 'stage' || e.type === 'production'));
  useEffect(() => { const b = box.current; if (b && stick.current) b.scrollTop = b.scrollHeight; }, [list.length]);
  return (
    <>
      <div className="live-head">
        <h2 style={{ margin: 0 }}>{running ? <><span className="pulse" aria-hidden="true" /> </> : null}Claude live</h2>
        <div className="seg" role="group" aria-label="Show">
          {['claude', 'engines', 'all'].map(f => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
      </div>
      {pending.length > 0 && <div className="ev warn" style={{ margin: '8px 10px 0' }}>Waiting in the decision inbox: {pending.join(', ')}.<br /><code style={{ fontSize: 11.5 }}>node studio/bin/inbox.mjs show {slug} {pending[0]}</code></div>}
      <div className="live" ref={box} onScroll={e => { const b = e.currentTarget; stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 40; }}>
        {!list.length && <div className="empty">Nothing yet. Start a run and Claude's work shows up here.</div>}
        {list.map((e, i) => <Ev key={i} e={e} />)}
      </div>
    </>
  );
}

function Ev({ e }) {
  const meta = <div className="meta"><span>{time(e.at)}</span>{e.stage && <span>{e.stage}</span>}{e.engine && <span>{e.engine}</span>}</div>;
  if (e.type === 'claude') {
    const k = e.kind;
    if (k === 'tool') return <div className="ev tool">{meta}<b>{e.tool}</b> {e.text}</div>;
    if (k === 'result') return <div className={`ev result${e.error ? ' errorev' : ''}`}>{meta}{e.text}</div>;
    if (k === 'thinking') return <div className="ev thinking">{meta}{e.text}</div>;
    if (k === 'text') return <div className="ev text">{meta}{e.text}</div>;
    if (k === 'stderr') return <div className="ev engine">{meta}{e.text}</div>;
    return <div className="ev stage">{meta}{e.text}</div>;
  }
  if (e.type === 'decision') {
    if (e.kind === 'made') return <div className="ev decision">{meta}<b>Decided.</b> {e.record?.output?.reason || ''}</div>;
    if (e.kind === 'repair') return <div className="ev warn">{meta}Answer failed a check, asking for one repair: {e.text}</div>;
    if (e.kind === 'override') return <div className="ev warn">{meta}You picked {e.choice} instead.</div>;
  }
  if (e.type === 'gate') return <div className="ev gate">{meta}{e.kind === 'gate' ? 'Waiting for your approval' : e.kind === 'review' ? 'Waiting for your review' : e.kind === 'approved' ? 'Approved' : 'Gate auto-approved'}{e.text ? `: ${e.text}` : ''}</div>;
  if (e.type === 'engine') return <div className={`ev engine${e.level === 'warn' ? ' warn' : ''}`}>{meta}{e.text}</div>;
  if (e.type === 'job') return <div className={`ev job${e.kind === 'error' ? ' errorev' : ''}`}>{meta}run {e.kind}{e.text ? `: ${e.text}` : ''}</div>;
  if (e.type === 'production') return e.kind === 'plan' ? null : <div className={`ev ${e.kind === 'error' ? 'errorev' : 'decision'}`}>{meta}shot board: {e.kind}{e.text ? `: ${e.text}` : ''}</div>;
  if (e.type === 'stage') return <div className="ev stage">{meta}{e.state?.status}{e.state?.summary ? ` · ${e.state.summary}` : ''}</div>;
  return null;
}
