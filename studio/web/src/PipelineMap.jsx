import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const LABEL = { offer: 'optional', idle: 'waiting', running: 'running', review: 'your review', gate: 'your approval', done: 'done', error: 'error', stale: 'stale' };
const fmt = ms => ms ? (ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} m ${Math.round(ms % 60000 / 1000)} s`) : '';

/** The twelve stages as a rail: the filled part of the rail is animated with GSAP as stages finish, the running node pulses. */
export default function PipelineMap({ stages, state, selected, onSelect }) {
  const rail = useRef(null), fill = useRef(null), root = useRef(null);
  const done = stages.filter(s => state[s.id]?.status === 'done').length;
  const runningIdx = stages.findIndex(s => state[s.id]?.status === 'running');

  useEffect(() => {
    if (!root.current || !fill.current) return;
    const nodes = root.current.querySelectorAll('.node');
    const last = nodes[Math.max(0, done - 1)], h = root.current.scrollHeight;
    rail.current.setAttribute('height', h);
    const y = done ? last.offsetTop + last.offsetHeight / 2 : 0;
    gsap.to(fill.current, { attr: { height: y }, duration: .8, ease: 'power3.out' });
  }, [done, stages.length]);

  useEffect(() => {
    if (runningIdx < 0 || !root.current) return;
    const dot = root.current.querySelectorAll('.node .dot')[runningIdx];
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(dot, { boxShadow: '0 0 0 7px rgba(90,169,255,.18)', duration: .7, ease: 'sine.inOut' });
    return () => { tl.kill(); gsap.set(dot, { boxShadow: 'none' }); };
  }, [runningIdx]);

  return (
    <div className="map" ref={root}>
      <svg className="rail" ref={rail} aria-hidden="true">
        <rect x="0" y="0" width="3" height="100%" rx="1.5" fill="var(--line)" />
        <rect ref={fill} x="0" y="0" width="3" height="0" rx="1.5" fill="var(--ok)" />
      </svg>
      {stages.map(s => {
        const x = state[s.id] || { status: 'idle' };
        const eng = x.engine, fb = (x.fallbacks || []).length;
        return (
          <button key={s.id} className={`node st-${x.status}`} aria-current={selected === s.id} onClick={() => onSelect(s.id)}
            title={`${s.title}: ${LABEL[x.status] || x.status}${x.error ? ` — ${x.error}` : ''}`}>
            <span className="dot">{x.status === 'done' ? '✓' : x.status === 'error' ? '!' : s.n}</span>
            <span>
              <span className="t">{s.title}
                {s.kind === 'decide' && <span className="chip claude" title="Claude decides">Claude</span>}
                {s.gate && <span className="chip gate" title="Waits for your approval">gate</span>}
                {s.paid && <span className="chip" title="Optional, spends OpenRouter credit after you confirm">paid</span>}
                {fb > 0 && <span className="chip warn" title={(x.fallbacks || []).map(f => `${f.engine}: ${f.why}`).join('\n')}>⤷ {fb}</span>}
              </span>
              <span className="s">{LABEL[x.status] || x.status}{eng ? ` · ${eng}` : ''}{x.ms ? ` · ${fmt(x.ms)}` : ''}{x.summary ? ` · ${x.summary}` : ''}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
