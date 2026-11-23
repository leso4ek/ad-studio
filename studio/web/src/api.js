// Ad Studio · client for the local server
const j = async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || r.statusText); return b; };
export const api = {
  meta: () => fetch('/api/meta').then(j),
  health: () => fetch('/api/health').then(j),
  ads: () => fetch('/api/ads').then(j),
  ad: (s) => fetch(`/api/ads/${s}`).then(j),
  log: (s) => fetch(`/api/ads/${s}/log`).then(j),
  create: (b) => fetch('/api/ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(j),
  run: (s, from) => fetch(`/api/ads/${s}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from }) }).then(j),
  approve: (s, id, choice) => fetch(`/api/ads/${s}/stages/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(choice === undefined ? {} : { choice }) }).then(j),
  redo: (s, id, note) => fetch(`/api/ads/${s}/stages/${id}/redo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) }).then(j),
  cancel: (s) => fetch(`/api/ads/${s}/cancel`, { method: 'POST' }).then(j),
  mode: (s, b) => fetch(`/api/ads/${s}/mode`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(j),
};
export const file = (slug, rel, bust) => `/files/${slug}/${rel}${bust ? `?v=${bust}` : ''}`;
