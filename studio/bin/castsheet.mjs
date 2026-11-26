#!/usr/bin/env node
// Ad Studio · character sheets for the v2 rig (round 14), rendered in any 2D kit style without the app.
//   node studio/bin/castsheet.mjs <style> [--what expressions|views|outfits|hair|poses] [--cast cast.json] [--who <id>] [--place office] [--out dir]
// Builds a scratch bible with one shot per cell (a close-up per expression, a wide per view / outfit / pose, a medium per hair
// style), renders a still from each with the Lemo-Opuscar still tool and writes <out>/<what>.jpg.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadConfig, run } from '../server/util.mjs';
import * as render from '../server/engines/render.mjs';
import { EXPR, HAIR, TOPS } from '../kit/rig.js';

const args = process.argv.slice(2), style = args[0];
const opt = (k, d = null) => { const i = args.indexOf(`--${k}`); return i > 0 ? args[i + 1] : d; };
if (!style) { console.error('usage: node studio/bin/castsheet.mjs <style> [--what expressions|views|outfits|hair|poses] [--cast f] [--who id] [--out dir]'); process.exit(2); }
const what = opt('what', 'expressions'), place = opt('place', 'office');
export const DEMO_CAST = {
  elena: { name: 'Elena', rig: 'v2', proportions: 'drama', build: 'slim', jaw: 'heart', eyes: { shape: 'almond', color: '#5a4030' }, lashes: true, brows: 'medium', nose: 'small', lips: 'full', hairStyle: 'long-wavy', skin: '#E8B796', hair: '#2B1B14', top: '#F2EDE4', top2: '#1F2A44', bottom: '#1F2A44', shoe: '#14141a', accent: '#B23A48', outfit: { top: 'blazer', bottom: 'trousers', accessories: ['badge', 'watch'] }, details: ['earrings'] },
  marcus: { name: 'Marcus', rig: 'v2', proportions: 'drama', build: 'broad', jaw: 'square', eyes: { shape: 'almond', color: '#2a1a10' }, brows: 'thick', nose: 'broad', lips: 'medium', hairStyle: 'crew', skin: '#8D5A3B', hair: '#151010', top: '#E9EEF2', top2: '#2E3440', bottom: '#2E3440', shoe: '#1a1410', accent: '#7A1F2B', outfit: { top: 'suit', bottom: 'trousers', accessories: ['watch'] }, details: ['stubble'] },
  noor: { name: 'Noor', rig: 'v2', proportions: 'drama', build: 'average', jaw: 'oval', eyes: { shape: 'round', color: '#3a2a1a' }, lashes: true, brows: 'medium', nose: 'straight', lips: 'medium', hairStyle: 'headscarf', skin: '#C99272', hair: '#1a1010', top: '#6E8B74', bottom: '#3B3B44', shoe: '#2a2420', accent: '#C9A86A', outfit: { top: 'knit', bottom: 'skirt', accessories: ['bag'] }, details: ['glasses'] },
  theo: { name: 'Theo', rig: 'v2', proportions: 'drama', build: 'slim', height: .97, jaw: 'oval', eyes: { shape: 'almond', color: '#3d5a6c' }, brows: 'thin', nose: 'aquiline', lips: 'thin', hairStyle: 'side-part', skin: '#F1C7A6', hair: '#B7803F', top: '#3E4A61', bottom: '#5B6B7A', shoe: '#3a2a20', accent: '#D9A441', outfit: { top: 'hoodie', bottom: 'jeans', accessories: ['phone'] }, details: ['freckles'] },
};
const cfg = loadConfig();
const cast = opt('cast') ? JSON.parse(fs.readFileSync(opt('cast'), 'utf8')) : DEMO_CAST;
const ids = opt('who') ? [opt('who')] : Object.keys(cast);
const cells = [];
const label = t => ({ type: 'text', id: 'lab', role: 'small', text: t, x: .5, y: .9, size: .05 });
if (what === 'expressions') for (const e of Object.keys(EXPR)) cells.push({ label: e, layers: [{ type: 'char', id: ids[0], x: .5, y: .95, pose: 'idle', view: '34', face: 'right', expression: e }], camera: { size: 'CU', subject: ids[0] } });
if (what === 'views') for (const id of ids) for (const [v, f] of [['front', 'right'], ['34', 'right'], ['profile', 'right'], ['34', 'left']]) cells.push({ label: `${cast[id].name} · ${v}${v !== 'front' ? ' ' + f : ''}`, layers: [{ type: 'char', id, x: .5, y: .92, pose: 'idle', view: v, face: f, expression: 'neutral' }], camera: { size: 'WS', subject: id } });
if (what === 'outfits') for (const id of ids) cells.push({ label: cast[id].name, layers: [{ type: 'char', id, x: .5, y: .92, pose: 'idle', view: '34', face: 'right', expression: 'warm' }], camera: { size: 'WS', subject: id } });
if (what === 'poses') for (const p of ['idle', 'talk', 'point', 'arms-crossed', 'hands-on-hips', 'hand-to-mouth', 'phone-to-ear', 'reading-phone', 'sit', 'lean', 'walk', 'recoil']) cells.push({ label: p, layers: [{ type: 'char', id: ids[0], x: .5, y: .92, pose: p, view: '34', face: 'right', expression: p === 'recoil' ? 'shocked' : 'neutral' }], camera: { size: 'WS', subject: ids[0] } });
if (what === 'hair') for (const h of HAIR.filter(h => !['short', 'long', 'curly'].includes(h))) cells.push({ label: h, layers: [{ type: 'char', id: 'h_' + h, x: .5, y: .95, pose: 'idle', view: '34', face: 'right', expression: 'neutral' }], camera: { size: 'MCU', subject: 'h_' + h }, cast: { ['h_' + h]: { ...cast[ids[0]], hairStyle: h } } });
if (!cells.length) { console.error(`nothing to draw for --what ${what}`); process.exit(2); }
const shots = cells.map((c, i) => ({ id: `c${i + 1}`, t0: i, t1: i + 1, place, layers: [...c.layers, label(c.label)], camera: c.camera }));
const bible = { title: 'cast sheet', style, dur: cells.length, rig: 'v2', cast: Object.assign({}, cast, ...cells.map(c => c.cast || {})), places: { office: { kind: 'office', time: 'day' }, studio: { kind: 'studio' } }, shots };
const out = path.resolve(opt('out', path.join(os.tmpdir(), `castsheet-${style}`)));
const ad = fs.mkdtempSync(path.join(os.tmpdir(), 'cast-ad-'));
fs.writeFileSync(path.join(ad, 'bible.json'), JSON.stringify(bible));
fs.mkdirSync(out, { recursive: true });
const files = await render.stills(cfg, ad, cells.map((_, i) => i + .5), { aspect: '9:16', out, prefix: `${what}_` });
const sheet = path.join(out, `${what}.jpg`);
const r = await run(path.join(cfg.lib, '.venv', 'bin', 'python'), ['-I', path.join(cfg.lib, 'core', 'render', 'sheet.py'), sheet, ...files, '--cols', String(Math.min(files.length, what === 'expressions' ? 4 : 4)), '--w', '300']);
if (r.code !== 0) { console.error(r.err || r.out); process.exit(1); }
fs.rmSync(ad, { recursive: true, force: true });
console.log(`sheet: ${sheet}`);
