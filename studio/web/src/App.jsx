import { useEffect, useMemo, useReducer, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from './api.js';
import PipelineMap from './PipelineMap.jsx';
import ClaudePane from './ClaudePane.jsx';
import StageDetail from './StageDetail.jsx';
import Timeline from './Timeline.jsx';
import ShotBoard from './ShotBoard.jsx';
import Memory from './Memory.jsx';
import { NewAd, Settings } from './Dialogs.jsx';

const init = { meta: null, ads: [], slug: null, ad: null, events: [], selected: null, health: null, bust: 0 };
function reducer(s, a) {
  switch (a.type) {
    case 'meta': return { ...s, meta: a.meta };
    case 'ads': return { ...s, ads: a.ads };
    case 'slug': return { ...s, slug: a.slug, ad: null, events: [], selected: null };
    case 'ad': return { ...s, ad: a.ad, bust: a.bust ?? s.bust };
    case 'events': return { ...s, events: a.events };
    case 'event': return { ...s, events: [...s.events.slice(-3000), a.ev] };
    case 'select': return { ...s, selected: a.id };
    case 'health': return { ...s, health: a.health };
    default: return s;
  }
}

export default function App() {
  const [s, d] = useReducer(reducer, init);
  const [dlg, setDlg] = useState(null);
  const [view, setView] = useState('pipeline');
  const [now, setNow] = useState(0);            // playhead (seconds) shared by the preview video and the timeline
  const slugRef = useRef(null); slugRef.current = s.slug;
  const refreshT = useRef(null);

  const loadAd = useCallback(async (slug, bust) => { if (!slug) return; try { d({ type: 'ad', ad: await api.ad(slug), bust }); } catch { /* deleted */ } }, []);
  const refresh = useCallback((bust) => { clearTimeout(refreshT.current); refreshT.current = setTimeout(() => { loadAd(slugRef.current, bust); api.ads().then(ads => d({ type: 'ads', ads })); }, 150); }, [loadAd]);

  useEffect(() => {
    api.meta().then(meta => d({ type: 'meta', meta }));
    api.health().then(health => d({ type: 'health', health }));
    api.ads().then(ads => { d({ type: 'ads', ads }); const want = new URLSearchParams(location.search).get('ad') || ads[0]?.slug; if (want) d({ type: 'slug', slug: want }); });
    const es = new EventSource('/api/events');
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data);
      if (ev.type === 'ad') { api.ads().then(ads => d({ type: 'ads', ads })); return; }
      if (ev.slug && ev.slug !== slugRef.current) return;
      d({ type: 'event', ev });
      if (['stage', 'decision', 'gate', 'job', 'file'].includes(ev.type)) refresh(ev.type === 'file' || (ev.type === 'stage' && ev.state?.status === 'done') ? Date.now() : undefined);
    };
    return () => es.close();
  }, [refresh]);

  useEffect(() => {
    if (!s.slug) return;
    history.replaceState(null, '', `?ad=${s.slug}`);
    loadAd(s.slug, Date.now());
    api.log(s.slug).then(events => d({ type: 'events', events }));
  }, [s.slug, loadAd]);

  // follow the pipeline: select the running stage, else the first that waits for the user
  // only the stages of this ad's format (recreate adds Source + Analysis; the 3D explainer adds the world; recreate skips Premises)
  const fmtOf = p => p?.format || 'story-ad', tgtOf = p => fmtOf(p) === 'recreate' ? (p.recreate?.target || 'story-ad') : fmtOf(p);
  const stages = (s.meta?.stages || []).filter(x => { const sf = s.meta?.stageFormats?.[x.id]; return !sf || sf.formats.includes(fmtOf(s.ad?.project)) || sf.targets.includes(tgtOf(s.ad?.project)); });
  const st = s.ad?.project?.stages || {};
  const focus = useMemo(() => {
    const running = stages.find(x => st[x.id]?.status === 'running');
    const waiting = stages.find(x => ['gate', 'review', 'error'].includes(st[x.id]?.status));
    const lastDone = [...stages].reverse().find(x => st[x.id]?.status === 'done');
    return (running || waiting || lastDone || stages[0])?.id;
  }, [stages, st]);
  const [follow, setFollow] = useState(true);
  const selected = (follow ? focus : s.selected) || focus;

  const p = s.ad?.project, running = !!s.ad?.running;
  const doneCount = stages.filter(x => st[x.id]?.status === 'done').length;
  const waitingStage = stages.find(x => ['gate', 'review'].includes(st[x.id]?.status));

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><i aria-hidden="true"><svg width="16" height="16" viewBox="0 0 32 32"><path d="M7 24l9-16 9 16" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></i>Ad Studio</div>
        <select className="adpick" aria-label="Ad" value={s.slug || ''} onChange={e => d({ type: 'slug', slug: e.target.value })}>
          {!s.ads.length && <option value="">no ads yet</option>}
          {s.ads.map(a => <option key={a.slug} value={a.slug}>{a.title} · {a.slug}</option>)}
        </select>
        <button className="btn" onClick={() => setDlg('new')}>New ad</button>
        {s.ad && <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === 'pipeline'} onClick={() => setView('pipeline')}>Pipeline</button>
          <button aria-pressed={view === 'board'} onClick={() => setView('board')} title="Previz → Seedance takes → your pick, shot by shot">Shot board</button>
          <button aria-pressed={view === 'memory'} onClick={() => setView('memory')} title="What Claude learned from past ads; rules waiting for your approval">Memory</button>
        </div>}
        <div className="spacer" />
        {p && <>
          <span className="chip" title="stages done">{doneCount}/{stages.length}</span>
          <div className="seg" role="group" aria-label="Mode">
            <button aria-pressed={p.mode === 'autopilot'} onClick={() => api.mode(s.slug, { mode: 'autopilot' }).then(() => refresh())} title="Claude decides and the run goes on; it stops at the three gates">Autopilot</button>
            <button aria-pressed={p.mode === 'step'} onClick={() => api.mode(s.slug, { mode: 'step' }).then(() => refresh())} title="Every decision waits for your approval">Step</button>
          </div>
          <label className="tog" title="Also approve the style, frames and animatic gates automatically"><input type="checkbox" checked={!!p.autoGates} onChange={e => api.mode(s.slug, { autoGates: e.target.checked }).then(() => refresh())} />auto gates</label>
          <select className="adpick" aria-label="Decisions by" value={p.decider || ''} onChange={e => api.mode(s.slug, { decider: e.target.value || null }).then(() => refresh())} title="Who answers the decisions">
            <option value="">Claude: chain (CLI → inbox)</option><option value="claude">Claude Code CLI</option><option value="inbox">Decision inbox</option>
          </select>
          {running ? <button className="btn" onClick={() => api.cancel(s.slug)}>Cancel</button>
            : waitingStage ? <button className="btn primary" onClick={() => setFollow(true)}>Review: {waitingStage.title}</button>
            : <button className="btn primary" onClick={() => api.run(s.slug).then(() => setFollow(true))} disabled={stages.filter(x => !x.optional).every(x => st[x.id]?.status === 'done')}>{doneCount ? 'Continue' : 'Run'}</button>}
        </>}
        <button className="btn ghost" onClick={() => { setDlg('settings'); api.health().then(health => d({ type: 'health', health })); }} aria-label="Settings and engines">Engines</button>
      </header>

      <main className="main">
        <nav className="col left" aria-label="Pipeline">
          <h2>Pipeline</h2>
          <PipelineMap stages={stages} state={st} selected={selected} onSelect={id => { setFollow(false); d({ type: 'select', id }); }} running={s.ad?.running} />
          {!follow && <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setFollow(true)}>Follow the run</button>}
        </nav>
        <section className="col center" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div key={(s.slug || '') + view + (view === 'pipeline' ? selected : '')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .18 }}>
              {s.ad && view === 'board' ? <ShotBoard slug={s.slug} events={s.events} />
                : view === 'memory' ? <Memory slug={s.slug} />
                : s.ad ? <StageDetail ad={s.ad} meta={s.meta} id={selected} bust={s.bust} onNow={setNow} refresh={refresh} />
                : <div className="empty">{s.ads.length ? 'Loading…' : <>No ads yet. <button className="btn primary" onClick={() => setDlg('new')}>Make the first ad</button></>}</div>}
            </motion.div>
          </AnimatePresence>
        </section>
        <aside className="col right" aria-label="Claude live">
          <ClaudePane events={s.events} running={s.ad?.running} pending={s.ad?.pending || []} slug={s.slug} />
        </aside>
      </main>

      {s.ad?.bible && <Timeline ad={s.ad} now={now} />}
      <AnimatePresence>{dlg === 'new' && <NewAd meta={s.meta} onClose={() => setDlg(null)} onMade={slug => { setDlg(null); d({ type: 'slug', slug }); setFollow(true); }} />}</AnimatePresence>
      <AnimatePresence>{dlg === 'settings' && <Settings health={s.health} onClose={() => setDlg(null)} />}</AnimatePresence>
    </div>
  );
}
