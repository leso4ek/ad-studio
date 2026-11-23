// Ad Studio · event bus: every event goes to the browsers (Server-Sent Events) and to the ad's log.jsonl,
// so the app can replay a whole run later.
import fs from 'fs';
import path from 'path';

const clients = new Set();
let adsDir = null;
export function initBus(dir) { adsDir = dir; }

export function subscribe(res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write(': hello\n\n');
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  res.on('close', () => { clearInterval(ping); clients.delete(res); });
}

/** type: stage | claude | log | engine | job | decision | gate | file */
export function emit(type, data = {}) {
  const ev = { type, at: new Date().toISOString(), ...data };
  const line = `data: ${JSON.stringify(ev)}\n\n`;
  for (const c of clients) c.write(line);
  if (data.slug && adsDir) {
    try { fs.appendFileSync(path.join(adsDir, data.slug, 'log.jsonl'), JSON.stringify(ev) + '\n'); } catch { /* ad folder not there yet */ }
  }
  return ev;
}
