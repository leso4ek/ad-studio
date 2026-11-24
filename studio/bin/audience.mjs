#!/usr/bin/env node
// Ad Studio · run stage 13 (the MiroFish audience test) for one ad from the command line, without the app.
//   node studio/bin/audience.mjs <slug>        (MiroFish must be running: bash studio/scripts/start_mirofish.sh)
// Prints the progress and the verdict. Paid: up to config mirofish.capUsd (default $1) of OpenRouter.
import { loadConfig } from '../server/util.mjs';
import { initBus, onEvent } from '../server/bus.mjs';
import * as P from '../server/pipeline.mjs';

const slug = process.argv[2];
if (!slug) { console.error('usage: node studio/bin/audience.mjs <slug>'); process.exit(2); }
const cfg = loadConfig();
initBus(cfg.adsDir); P.initPipeline(cfg);
onEvent(ev => { if (['engine', 'claude', 'job', 'gate'].includes(ev.type) && ev.text && ev.kind !== 'delta') console.log(`[${ev.type}${ev.engine ? ':' + ev.engine : ''}] ${String(ev.text).slice(0, 200)}`); });
await P.runFrom(slug, 'audience');
const st = P.project(slug).stages.audience;
console.log(`\naudience: ${st.status}${st.error ? ' · ' + st.error : ''}\n${st.summary || ''}`);
process.exit(st.status === 'done' ? 0 : 1);
