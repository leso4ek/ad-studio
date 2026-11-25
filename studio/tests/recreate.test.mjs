// node --test studio/tests/recreate.test.mjs — round 12: the analyser on synthetic video, spans, the motion router,
// the Higgsfield Genjutsu engine against a fake server (no network, no spend), formats and the Genjutsu board → plates.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recreate-'));
process.env.ADSTUDIO_LEDGER = path.join(tmp, 'ledger.jsonl');   // before the engines load
const { loadConfig, ffmpeg7, run } = await import('../server/util.mjs');
const A = await import('../server/engines/analyse.mjs');
const hf = await import('../server/engines/higgsfield.mjs');
const cfg = loadConfig();
const ff = await ffmpeg7(cfg);

// a 6 s clip with cuts at 2.0 and 4.5: a static colour, a right-moving crop of a test card (a camera pan), a moving test card
async function synthetic(file) {
  const r = await run(ff, ['-y', '-v', 'error',
    '-f', 'lavfi', '-i', 'color=c=0x336699:s=160x284:d=2:r=24',
    '-f', 'lavfi', '-i', 'testsrc2=size=640x284:rate=24:duration=2.5',
    '-f', 'lavfi', '-i', 'testsrc=size=160x284:rate=24:duration=1.5',
    '-filter_complex', "[1:v]crop=160:284:x='t*120':y=0[p];[0:v]format=yuv420p[a];[p]format=yuv420p[b];[2:v]format=yuv420p[c];[a][b][c]concat=n=3:v=1:a=0[v]",
    '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file]);
  assert.equal(r.code, 0, r.err);
  return file;
}

test('cuts: local peaks of the scene score, minimum shot length', async () => {
  assert.deepEqual(A.pickPeaks([[1, .05], [2, .2], [2.04, .06], [3, .5], [3.04, .4]]), [2, 3]);
  assert.deepEqual(A.shotsFromCuts([2, 2.2, 4.5], 6, { minShot: .5 }).map(s => [s.t0, s.t1]), [[0, 2], [2, 4.5], [4.5, 6]]);
  const f = await synthetic(path.join(tmp, 'syn.mp4'));
  const cuts = await A.detectCuts(cfg, f);
  assert.equal(cuts.length, 2, `cuts ${cuts}`);
  assert.ok(Math.abs(cuts[0] - 2) < .1 && Math.abs(cuts[1] - 4.5) < .1, `cuts ${cuts}`);
});

test('motion: a static shot scores low, a pan is found with its direction', async () => {
  const f = path.join(tmp, 'syn.mp4'); if (!fs.existsSync(f)) await synthetic(f);
  const g = await A.grayFrames(cfg, f), st = A.motionStats(g.frames, g.w, g.h);
  const still = A.shotMotion(st, g.fps, g.w, 0, 2), pan = A.shotMotion(st, g.fps, g.w, 2.1, 4.4);
  assert.equal(still.camera, 'static'); assert.ok(still.score < .05, JSON.stringify(still));
  assert.equal(pan.camera, 'pan-right', JSON.stringify(pan));   // the crop window moves right, so the content slides left
  assert.ok(pan.score > still.score + .05);
});

test('the full analysis writes shots, stills, a contact sheet and the rhythm', async () => {
  const f = path.join(tmp, 'syn.mp4'); if (!fs.existsSync(f)) await synthetic(f);
  const out = path.join(tmp, 'src', 'analysis');
  const a = await A.analyse(cfg, f, out, { whisper: false });
  assert.equal(a.shots.length, 3); assert.equal(a.rhythm.shots, 3);
  assert.equal(a.shots[0].stills.length, 3);
  assert.ok(fs.existsSync(path.join(tmp, 'src', a.sheets[0])));
  assert.ok(fs.existsSync(path.join(out, 'analysis.json')));
  assert.ok(a.shots[1].motion.score > a.shots[0].motion.score);
});

test('spans: 4-30 s, long shots split, short tails join', () => {
  const sh = (id, t0, t1) => ({ id, t0, t1 });
  assert.deepEqual(A.mergeSpans([sh('a', 0, 1.5), sh('b', 1.5, 3), sh('c', 3, 6)]).map(s => [s.t0, s.t1, s.shots.join('')]), [[0, 6, 'abc']]);
  const long = A.mergeSpans([sh('a', 0, 40)]);
  assert.deepEqual(long.map(s => [s.t0, s.t1]), [[0, 30], [30, 40]]);
  const mix = A.mergeSpans([sh('a', 0, 5), sh('b', 5, 6)]);
  assert.deepEqual(mix.map(s => [s.t0, s.t1, s.shots.join('')]), [[0, 6, 'ab']]);
  const light = A.mergeSpans([sh('a', 0, 10), sh('b', 10, 20)], { max: 15 });
  assert.ok(light.every(s => s.seconds <= 15 && s.seconds >= 4), JSON.stringify(light));
  assert.equal(A.mergeSpans([sh('a', 0, 2)])[0].short, true);
});

test('the motion router', () => {
  const r = (shot, ctx) => A.routeFor(shot, ctx).route;
  assert.equal(r({ motion: { score: .1 } }, { format: '3d-skit' }), 'three');
  assert.equal(r({ motion: { score: .6 }, complexity: 'high' }, { format: '3d-skit' }), 'blender');
  assert.equal(r({ motion: { score: .2 }, physics: true }, { format: '3d-explainer', photoreal: true }), 'blender→genjutsu');
  assert.equal(r({ motion: { score: .1 } }, { format: 'story-ad' }), 'kit');
  assert.equal(r({ motion: { score: .7 }, complexity: 'high' }, { format: 'story-ad' }), 'seedance');
  assert.equal(r({ motion: { score: .7 }, complexity: 'high' }, { format: 'story-ad', allowPaid: false }), 'blender');
  assert.equal(r({ motion: { score: .1 } }, { format: 'recreate', mode: 'transfer', rights: true }), 'genjutsu');
  assert.notEqual(r({ motion: { score: .1 } }, { format: 'recreate', mode: 'transfer', rights: false }), 'genjutsu', 'never without rights');
  assert.equal(r({ motion: { score: .5 }, people: true }, { format: 'recreate', mode: 'mixed', rights: true }), 'genjutsu');
  assert.equal(r({ motion: { score: .05 } }, { format: 'recreate', mode: 'mixed', rights: true, target: '3d-skit' }), 'three');
  assert.equal(r({ motion: { score: .1 }, people: true }, { format: 'recreate', mode: 'mixed', rights: true, target: '3d-skit' }), 'three', 'a still shot with people is remade free');
});

test('higgsfield: estimate, presigned upload without credentials, submit with Key auth, poll, download, ledger, cap', async () => {
  assert.equal(hf.estimate(10, '480p'), 1.54); assert.equal(hf.billedSeconds(2), 4); assert.equal(hf.billedSeconds(40), 30); assert.equal(hf.billedSeconds(20, 'light'), 15);
  assert.equal(hf.resultUrl({ status: 'completed', video: { url: 'https://x/y.mp4' } }), 'https://x/y.mp4');
  assert.equal(hf.resultUrl({ outputs: [{ url: 'https://x/z.mp4' }] }), 'https://x/z.mp4');
  const seen = [], polls = { n: 0 };
  const srv = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
    seen.push({ m: req.method, u: req.url, auth: req.headers.authorization || null, type: req.headers['content-type'], body: req.method === 'POST' ? JSON.parse(body.toString() || '{}') : body.length });
    const base = `http://127.0.0.1:${srv.address().port}`, j = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url === '/files/generate-upload-url') { const n = seen.filter(x => x.u === req.url).length; return j({ upload_url: `${base}/put/${n}`, content_type: JSON.parse(body).content_type, upload_headers: { 'x-test': 'yes' }, public_url: `https://cdn.example/${n}` }); }
    if (req.url.startsWith('/put/')) { res.writeHead(200); return res.end(); }
    if (req.url === '/higgsfield/genjutsu/motion-transfer/v1.0') return j({ request_id: 'req-1' });
    if (req.url === '/requests/req-1/status') return ++polls.n < 2 ? j({ status: 'in_progress' }) : j({ status: 'completed', video: { url: `${base}/out.mp4` } });
    if (req.url === '/out.mp4') { res.writeHead(200, { 'Content-Type': 'video/mp4' }); return res.end(Buffer.from('MP4DATA')); }
    res.writeHead(404); res.end();
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const prevProxy = process.env.NODE_USE_ENV_PROXY; delete process.env.NODE_USE_ENV_PROXY;
  process.env.HIGGSFIELD_KEY = 'kid:ksecret';
  const c = { ...cfg, higgsfield: { api: `http://127.0.0.1:${srv.address().port}`, pollMs: 10, mock: false }, budget: { higgsfieldCapUsd: 5 } };
  const vid = path.join(tmp, 'syn.mp4'), img = path.join(tmp, 'ref.png');
  await run(ff, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=64x64:d=1', '-frames:v', '1', img]);
  try {
    const r = await hf.transfer(c, { video: vid, images: [img], prompt: 'the woman becomes Juno', resolution: '480p', seconds: 6, out: path.join(tmp, 'take.mp4') }, { what: 'test' });
    assert.equal(fs.readFileSync(r.file, 'utf8'), 'MP4DATA'); assert.equal(r.job, 'req-1'); assert.equal(r.cost, hf.estimate(6, '480p'));
    const puts = seen.filter(x => x.m === 'PUT');
    assert.equal(puts.length, 2); assert.ok(puts.every(x => x.auth === null), 'no credentials on the presigned PUT');
    assert.equal(puts[0].type, 'video/mp4');
    const sub = seen.find(x => x.u === '/higgsfield/genjutsu/motion-transfer/v1.0');
    assert.equal(sub.auth, 'Key kid:ksecret');
    assert.deepEqual(sub.body, { video_url: 'https://cdn.example/1', image_urls: ['https://cdn.example/2'], resolution: '480p', prompt: 'the woman becomes Juno' });
    assert.equal(hf.spent(), r.cost);
    // the cap refuses before any request is made
    const before = seen.length;
    await assert.rejects(hf.transfer({ ...c, budget: { higgsfieldCapUsd: 1 } }, { video: vid, images: [img], resolution: '1080p', seconds: 10, out: path.join(tmp, 't2.mp4') }), /budget/);
    assert.equal(seen.length, before);
    // OpenRouter's spend does not count Higgsfield jobs
    const orx = await import('../server/engines/openrouter.mjs'); assert.equal(orx.spent(), 0);
  } finally { srv.close(); delete process.env.HIGGSFIELD_KEY; if (prevProxy !== undefined) process.env.NODE_USE_ENV_PROXY = prevProxy; }
});

test('formats: stages that apply, fixed voxel style, format-aware cut rates', async () => {
  const S = await import('../server/stages.mjs');
  const st = id => S.STAGES.find(s => s.id === id);
  assert.equal(S.appliesTo(st('source'), { format: 'story-ad' }), false);
  assert.equal(S.appliesTo(st('source'), { format: 'recreate' }), true);
  assert.equal(S.appliesTo(st('premises'), { format: 'recreate' }), false);
  assert.equal(S.appliesTo(st('world'), { format: '3d-explainer' }), true);
  assert.equal(S.appliesTo(st('world'), { format: 'recreate', recreate: { target: '3d-explainer' } }), true);
  assert.equal(S.appliesTo(st('world'), { format: 'story-ad' }), false);
  assert.equal(S.appliesTo(st('brief'), {}), true);
  const ctx = f => ({ project: { format: f }, decision: () => null, cfg });
  assert.equal(st('style').fixed(ctx('3d-skit')).style, 'ad-voxel-3d');
  assert.ok(!st('style').fixed(ctx('story-ad')));
  const one = { shots: [{ id: 'a', t0: 0, t1: 6, size: 'WS', subject: 'pot' }, { id: 'b', t0: 6, t1: 12, size: 'WS', subject: 'pot' }, { id: 'c', t0: 12, t1: 18, size: 'MS', subject: 'pot' }] };
  assert.ok(S.checkDirection(one, 18).some(e => /cut rate|same size/.test(e)));
  assert.deepEqual(S.checkDirection(one, 18, '3d-explainer'), []);
  assert.ok(!S.checkDirection(one, 18, 'recreate').some(e => /cut rate/.test(e)));
});

test('board: genjutsu shots merge into spans, a mock take, rights required, plates into the bible', async () => {
  process.env.ADSTUDIO_MOCK = '1';
  const ad = path.join(tmp, 'ad'); fs.mkdirSync(path.join(ad, 'source'), { recursive: true });
  const bible = JSON.parse(fs.readFileSync(new URL('../kit/test/bible.json', import.meta.url)));
  const n = bible.shots.length;
  bible.shots = bible.shots.map((s, i) => ({ ...s, route: i < 2 ? 'genjutsu' : 'kit', source: { t0: s.t0, t1: s.t1 } }));
  fs.writeFileSync(path.join(ad, 'bible.json'), JSON.stringify(bible));
  fs.copyFileSync(path.join(tmp, 'syn.mp4'), path.join(ad, 'source', 'original.mp4'));
  fs.mkdirSync(path.join(ad, 'source', 'refs'), { recursive: true }); fs.copyFileSync(path.join(tmp, 'ref.png'), path.join(ad, 'source', 'refs', 'juno.png'));
  const proj = { slug: 'ad', format: 'recreate', recreate: { mode: 'transfer', rights: false, source: 'source/original.mp4', refs: [{ file: 'source/refs/juno.png', label: 'Juno', role: 'character' }, { file: 'source/refs/juno.png', label: 'Bottle', role: 'product' }] }, stages: {} };
  fs.writeFileSync(path.join(ad, 'project.json'), JSON.stringify(proj));
  const PR = await import('../server/production.mjs'); PR.initProduction({ ...cfg, budget: { capUsd: 10, higgsfieldCapUsd: 5 } });
  const p = PR.init(ad, 'ad', { route: 'kit' });
  const span = p.shots.find(s => s.span);
  assert.ok(span, 'a span entry'); assert.equal(p.shots.length, n - (span.covers.length - 1));
  assert.ok(span.seconds >= 4); assert.equal(span.refs[0], 'ref-1', 'the user reference comes first');
  assert.deepEqual(p.assets.slice(0, 2).map(a => a.id), ['ref-1', 'ref-2'], 'uploads keep their order');
  assert.ok(!p.assets.some(a => a.id === 'product'), 'the uploaded product replaces the generated product element');
  assert.ok(p.shots.every(s => !(s.refs || []).includes('product')), 'shots point at the upload instead');
  const gp = PR.genjutsuPrompt(p, { cast: { juno: { role: 'she, 30s' }, fern: { kind: 'plant', role: 'the fern' } }, product: { name: 'Sprigly', kind: 'bottle', label: 'SPRIGLY' } });
  assert.ok(/people become juno \(she\)/.test(gp) && !/people become[^.]*fern/.test(gp) && /plant stays a plant: fern/.test(gp), gp);
  assert.equal(p.assets[0].chosen, 'source/refs/juno.png');
  const est = PR.estimate(ad, span.id); assert.equal(est.engine, 'higgsfield'); assert.equal(est.estimate, hf.estimate(span.seconds, '480p'));
  await assert.rejects(PR.take(ad, 'ad', span.id, { confirm: true }), /rights/);
  proj.recreate.rights = true; fs.writeFileSync(path.join(ad, 'project.json'), JSON.stringify(proj));
  const t = await PR.take(ad, 'ad', span.id, { confirm: true });
  assert.equal(t.engine, 'genjutsu'); assert.equal(t.mock, true); assert.ok(fs.existsSync(path.join(ad, t.file)));
  PR.patchShot(ad, 'ad', span.id, { chosen: t.file });
  const u = await PR.usePlates(ad, 'ad');
  assert.equal(u.used.length, 1);
  const nb = JSON.parse(fs.readFileSync(path.join(ad, 'bible.json')));
  for (const id of span.covers) assert.equal(nb.shots.find(s => s.id === id).plate.dir, `plates/${span.id}`);
  assert.ok(fs.readdirSync(path.join(ad, 'production', 'plates', span.id)).length > 20);
  // switching a span back to the kit rebuilds the board per shot
  const p2 = PR.patchShot(ad, 'ad', span.id, { route: 'kit' });
  for (const id of span.covers) { const e = p2.shots.find(s => s.id === id); assert.ok(e && !e.span && e.route === 'kit', `${id} is its own kit shot again`); }
  delete process.env.ADSTUDIO_MOCK;
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
