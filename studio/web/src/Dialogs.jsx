import { useState, Fragment } from 'react';
import { motion } from 'motion/react';
import { api } from './api.js';

const Modal = ({ children, onClose, label }) => (
  <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <motion.div className="modal" role="dialog" aria-modal="true" aria-label={label} initial={{ y: 16, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      onKeyDown={e => e.key === 'Escape' && onClose()}>{children}</motion.div>
  </motion.div>
);

const FORMATS = [
  ['story-ad', 'Story ad', 'A five-act story in one of the code-drawn styles.'],
  ['explainer', 'Explainer', 'A topic video, no product: one question answered step by step in any of our styles (free).'],
  ['3d-skit', '3D skit', 'Voxel characters talk it through on a dark stage, step by step (three.js, free).'],
  ['3d-explainer', '3D explainer', 'One continuous camera through a world built layer by layer, with cutaways (Blender, free).'],
  ['recreate', 'Recreate a video', 'Upload a video and references; it is analysed and rebuilt with our tools or Genjutsu.'],
];
export function NewAd({ meta, onClose, onMade }) {
  const [f, setF] = useState({ format: 'story-ad', name: '', product: '', fictional: true, seconds: 20, aspect: '9:16', style: '', mode: 'autopilot', autoGates: false, decider: '' });
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const ex = f.format === 'explainer';
      const brief = ex ? { topic: f.product, seconds: +f.seconds, aspect: f.aspect, ...(f.style ? { style: f.style } : {}) } : { fictional: f.fictional, seconds: +f.seconds, aspect: f.aspect, ...(f.product ? { product: f.product } : {}), ...(f.style ? { style: f.style } : {}) };
      if (ex && !f.product.trim()) throw new Error('Write the topic first');
      const rec = f.format === 'recreate';
      const p = await api.create({ name: f.name || (rec ? 'Recreated video' : ex ? f.product.slice(0, 40) : f.fictional ? 'Fictional product ad' : f.product), brief, mode: f.mode, autoGates: f.autoGates, decider: f.decider || null, format: f.format, ...(rec ? { start: false } : {}) });
      onMade(p.slug);
    } catch (e) { alert(e.message); setBusy(false); }
  };
  return (
    <Modal onClose={onClose} label="New video">
      <h3>New video</h3>
      <div className="opts" role="radiogroup" aria-label="Format" style={{ marginBottom: 12 }}>{FORMATS.map(([k, t, d]) => <button key={k} className="opt" role="radio" aria-checked={f.format === k} aria-pressed={f.format === k} onClick={() => setF(o => ({ ...o, format: k, seconds: k === 'explainer' ? 45 : o.seconds > 30 ? 20 : o.seconds }))}><b>{t}</b><small>{d}</small></button>)}</div>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>Claude writes the brief, the premises, the hooks, the story and the bible; the engines draw, voice and mix it. You approve the style, the frames and the animatic.</p>
      <label>Name<input type="text" value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Afternoon tea ad" autoFocus /></label>
      {f.format === 'explainer' && <label>Topic: what should the video explain? (Claude finds the question, the angle and sourced facts)<textarea rows={3} value={f.product} onChange={e => set('product', e.target.value)} placeholder="e.g. why your ears pop on a plane" /></label>}
      {!['recreate', 'explainer'].includes(f.format) && <><label className="tog" style={{ display: 'flex', marginBottom: 12 }}><input type="checkbox" checked={f.fictional} onChange={e => set('fictional', e.target.checked)} />Fictional product (Claude invents an honest one)</label>
      <label>{f.fictional ? 'Product idea (optional)' : 'Your product: what it is, who it is for, proof points'}<textarea rows={3} value={f.product} onChange={e => set('product', e.target.value)} placeholder={f.fictional ? 'e.g. something for slow afternoons' : 'Name, what it does, honest facts, price, where to buy'} /></label>
      </>}
      {f.format === 'recreate' && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Next you upload the video and your reference images and say what changes (the characters, what they wear and carry, the product); the length follows the video.</p>}
      {f.format !== 'recreate' && <div className="row">
        <label style={{ flex: 1 }}>Length<select value={f.seconds} onChange={e => set('seconds', e.target.value)}>{(f.format === 'explainer' ? [30, 45, 60, 90] : [15, 20, 30]).map(s => <option key={s} value={s}>{s} s</option>)}</select></label>
        <label style={{ flex: 1 }}>Format<select value={f.aspect} onChange={e => set('aspect', e.target.value)}><option value="9:16">9:16 (+16:9 cut)</option><option value="16:9">16:9 (+9:16 cut)</option></select></label>
        {!f.format.startsWith('3d') ? <label style={{ flex: 2 }}>Style<select value={f.style} onChange={e => set('style', e.target.value)}><option value="">Claude chooses</option>{Object.entries(meta?.styles || {}).map(([k, v]) => <option key={k} value={k}>{v.split(':')[0]}</option>)}</select></label> : <span style={{ flex: 2, alignSelf: 'end', color: 'var(--muted)', fontSize: 13 }}>Drawn in the voxel 3D style</span>}
      </div>}
      <div className="row">
        <label style={{ flex: 1 }}>Mode<select value={f.mode} onChange={e => set('mode', e.target.value)}><option value="autopilot">Autopilot (stops at gates)</option><option value="step">Step (approve every decision)</option></select></label>
        <label style={{ flex: 1 }}>Decisions by<select value={f.decider} onChange={e => set('decider', e.target.value)}><option value="">Claude Code CLI → inbox</option><option value="claude">Claude Code CLI only</option><option value="inbox">Decision inbox</option></select></label>
      </div>
      <label className="tog" style={{ display: 'flex', marginBottom: 14 }}><input type="checkbox" checked={f.autoGates} onChange={e => set('autoGates', e.target.checked)} />Also auto-approve the three gates (full autopilot)</label>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={go}>Start</button></div>
    </Modal>
  );
}

export function Settings({ health, onClose }) {
  return (
    <Modal onClose={onClose} label="Engines">
      <h3>Engines and fallbacks</h3>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>Each stage tries its chain in order and records every fallback it takes. Change the order in <code>studio/config.local.json</code>; keys go in <code>studio/.env</code> (never in a chat).</p>
      {!health ? <div className="empty">Checking…</div> : <>
        <div className="health">{Object.entries(health.engines).map(([k, v]) => <div className="h" key={k}><b style={{ color: v.ok ? 'var(--ok)' : 'var(--muted)' }}>{v.ok ? '●' : '○'} {k}</b><span style={{ color: 'var(--muted)' }}>{v.ok ? v.detail || 'ready' : v.why}</span></div>)}</div>
        <h2 style={{ marginTop: 16 }}>Chains</h2>
        <dl className="kv">{Object.entries(health.chains).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v.join(' → ')}</dd></Fragment>)}</dl>
        <h2 style={{ marginTop: 16 }}>Claude Code</h2>
        <dl className="kv"><dt>model</dt><dd>{health.claude.model}</dd><dt>effort</dt><dd>{health.claude.effort}</dd></dl>
        <h2 style={{ marginTop: 16 }}>.env</h2>
        <dl className="kv">{Object.entries(health.env).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v ? 'set' : 'not set'}</dd></Fragment>)}</dl>
      </>}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="btn" onClick={onClose}>Close</button></div>
    </Modal>
  );
}
