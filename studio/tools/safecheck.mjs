// Safe-zone check for an Ad Studio page: node safecheck.mjs <page dir> [--size 1080x1920] [--q k=v] [--step .1]
// Prints JSON {pass, out:[{t, id, text, box, safe}]}: every TEXTS(t) box must lie inside window.SAFE.
import path from 'path';
const LIB = process.env.LIB || path.join(process.env.HOME, 'lemo-opuscar');
const { openDemo, closeServer, takeSize } = await import(path.join(LIB, 'core', 'render', 'page.mjs'));
const args = process.argv.slice(2), { w, h } = takeSize(args), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const { browser, page } = await openDemo(args[0], { w, h, q: opt('--q', ''), gl: false });
const res = await page.evaluate(async (step) => {
  const S = window.SAFE, out = [], seen = new Set();
  for (let t = 0; t < window.DUR; t += step) {
    for (const b of window.TEXTS(t) || []) {
      if (b.pass || seen.has(b.id)) continue;
      if (b.x0 < S.x0 - 1 || b.y0 < S.y0 - 1 || b.x1 > S.x1 + 1 || b.y1 > S.y1 + 1) { seen.add(b.id); out.push({ t: +t.toFixed(2), id: b.id, text: b.text, box: [b.x0, b.y0, b.x1, b.y1].map(Math.round), safe: [S.x0, S.y0, S.x1, S.y1].map(Math.round) }); }
    }
  }
  return { pass: out.length === 0, out };
}, +opt('--step', .1));
console.log(JSON.stringify(res));
await browser.close(); closeServer?.();
process.exit(0);
