/** The ad on the clock: acts (from the story decision), shots, brand beats, voice lines and captions, with a playhead. */
export default function Timeline({ ad, now }) {
  const b = ad.bible, D = b.dur, pct = t => `${(t / D) * 100}%`;
  const acts = ad.decisions.story?.output?.acts || [], bm = ad.decisions.brandmap?.output;
  const beats = bm ? [{ t: bm.plant.t, k: 'plant' }, ...bm.pulses.map(p => ({ t: p.t, k: 'pulse' })), { t: bm.reveal.t, k: 'reveal' }, { t: bm.tag.t, k: 'tag' }] : [];
  const lineDur = ad.project.stages.voice?.result?.durs || {};
  return (
    <section className="tl" aria-label="Ad timeline">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}><h2 style={{ margin: 0 }}>Timeline · {D} s</h2><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{now.toFixed(1)} s</span></div>
      <div className="tracks">
        <div className="playhead" style={{ left: `calc(72px + (100% - 72px) * ${Math.min(D, now) / D})` }} />
        <div className="trow"><span className="lab">acts</span><div className="track">{acts.map(a => <div key={a.act} className="seg-b act" style={{ left: pct(a.t0), width: pct(a.t1 - a.t0) }} title={a.beats}>{a.act} · {a.name}</div>)}</div></div>
        <div className="trow"><span className="lab">shots</span><div className="track">
          {b.shots.map(s => <div key={s.id} className="seg-b" style={{ left: pct(s.t0), width: pct(s.t1 - s.t0) }} title={(s.layers || []).filter(l => l.type === 'text').map(l => l.text).join(' / ')}>{s.id} {s.place}</div>)}
          <div className="seg-b" style={{ left: pct(b.endcard.t0), width: pct(D - b.endcard.t0) }}>end card</div>
          {beats.map((x, i) => <div key={i} className="beat" style={{ left: pct(x.t) }}><span>{x.k}</span></div>)}
        </div></div>
        <div className="trow"><span className="lab">voice</span><div className="track">{b.vo.lines.map(l => <div key={l.id} className="seg-b vo" style={{ left: pct(l.at), width: pct(lineDur[l.id] || l.text.split(' ').length / 2.9) }} title={l.text}>{l.text}</div>)}</div></div>
        {ad.cues.length > 0 && <div className="trow"><span className="lab">captions</span><div className="track">{ad.cues.map((c, i) => <div key={i} className="seg-b cap" style={{ left: pct(c.t0), width: pct(c.t1 - c.t0) }} title={c.text}>{c.text}</div>)}</div></div>}
      </div>
    </section>
  );
}
