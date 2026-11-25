#!/usr/bin/env node
// Ad Studio · render a test contact sheet of one kit style, without the app.
//   node studio/bin/stylesheet.mjs <style> [--bible path/to/bible.json] [--out dir] [--aspect 9:16|16:9] [--times 1.5,4,7,...]
// Copies the bible (default: ads/first-story-ad, plus its voice cues for captions) into a scratch ad folder,
// switches its style, renders still frames with the Lemo-Opuscar still tool and writes <out>/sheet.jpg.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadConfig, REPO, run } from '../server/util.mjs';
import * as render from '../server/engines/render.mjs';

const args = process.argv.slice(2), style = args[0];
const opt = k => { const i = args.indexOf(`--${k}`); return i > 0 ? args[i + 1] : null; };
if (!style) { console.error('usage: node studio/bin/stylesheet.mjs <style> [--bible f] [--out dir] [--aspect 9:16] [--times a,b]'); process.exit(2); }
const cfg = loadConfig();
const src = opt('bible') || path.join(REPO, 'ads', 'first-story-ad', 'bible.json');
const out = path.resolve(opt('out') || path.join(os.tmpdir(), `stylesheet-${style}`));
const aspect = opt('aspect') || '9:16';
const ad = fs.mkdtempSync(path.join(os.tmpdir(), 'sheet-ad-'));
const bible = JSON.parse(fs.readFileSync(src, 'utf8'));
fs.writeFileSync(path.join(ad, 'bible.json'), JSON.stringify({ ...bible, style }));
const cues = path.join(path.dirname(src), 'voice', 'cues.json');
if (fs.existsSync(cues)) { fs.mkdirSync(path.join(ad, 'voice')); fs.copyFileSync(cues, path.join(ad, 'voice', 'cues.json')); }
const times = opt('times') ? opt('times').split(',').map(Number)
  : [...bible.shots.map(s => +(s.t0 + (s.t1 - s.t0) * .6).toFixed(2)), +((bible.endcard?.t0 ?? bible.dur - 2) + 1.5).toFixed(2)];
fs.mkdirSync(out, { recursive: true });
const files = await render.stills(cfg, ad, times, { aspect, out, prefix: 'f_' });
const sheet = path.join(out, 'sheet.jpg');
const r = await run(path.join(cfg.lib, '.venv', 'bin', 'python'), ['-I', path.join(cfg.lib, 'core', 'render', 'sheet.py'), sheet, ...files, '--cols', String(Math.min(files.length, 4)), '--w', aspect === '16:9' ? '480' : '300']);
if (r.code !== 0) { console.error(r.err || r.out); process.exit(1); }
fs.rmSync(ad, { recursive: true, force: true });
console.log(`frames: ${files.map(f => path.basename(f)).join(' ')}\nsheet: ${sheet}`);
