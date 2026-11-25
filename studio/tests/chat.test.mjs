// node --test studio/tests/chat.test.mjs — the stream clipper's chat layer on recorded-format samples and a synthetic stream
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../server/engines/chat.mjs';

test('parsers: TwitchDownloader, chat-downloader, yt-dlp live_chat (YouTube), Kick, CSV', () => {
  const twitch = JSON.stringify({ comments: [{ content_offset_seconds: 12.5, commenter: { display_name: 'a' }, message: { body: 'KEKW' } }, { content_offset_seconds: 3, commenter: { display_name: 'b' }, message: { body: 'hi' } }] });
  assert.deepEqual(C.parseChat(twitch).map(m => [m.t, m.msg]), [[3, 'hi'], [12.5, 'KEKW']]);
  const cd = JSON.stringify([{ time_in_seconds: 61.2, message: 'clip it', author: { name: 'x' } }]);
  assert.equal(C.parseChat(cd)[0].t, 61.2);
  const yt = [JSON.stringify({ replayChatItemAction: { videoOffsetTimeMsec: '4500', actions: [{ addChatItemAction: { item: { liveChatTextMessageRenderer: { authorName: { simpleText: 'y' }, message: { runs: [{ text: 'NO WAY ' }, { emoji: { shortcuts: [':fire:'] } }] } } } } }] } })].join('\n');
  assert.deepEqual(C.parseChat(yt).map(m => [m.t, m.msg]), [[4.5, 'NO WAY :fire:']]);
  const kick = JSON.stringify({ data: { messages: [{ created_at: '2026-11-01T10:00:30Z', content: 'W', sender: { username: 'k' } }] } });
  assert.equal(C.parseChat(kick, { startIso: '2026-11-01T10:00:00Z' })[0].t, 30);
  assert.deepEqual(C.parseChat('0:01:05,bob,LMAO\n70\tann\tok').map(m => [m.t, m.user, m.msg]), [[65, 'bob', 'LMAO'], [70, 'ann', 'ok']]);
});

test('signals: laughter, hype, "clip it", caps, first-time chatters', () => {
  const s = C.signals([{ t: 1, user: 'a', msg: 'LMAO 😂' }, { t: 1.5, user: 'a', msg: 'CLIP IT NOW' }, { t: 2, user: 'b', msg: 'POGGERS' }], 3);
  assert.deepEqual([s.n[1], s.laugh[1], s.clip[1], s.caps[1], s.fresh[1], s.hype[2]], [2, 1, 1, 2, 1, 1]);
});

// a 20-minute stream: ~1 message/s of chatter, a laugh burst at 300 s and a hype + "clip it" burst at 900 s; the
// video's loud moments are 5 s earlier (the chat delay)
function stream() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const msgs = [], dur = 1200, loud = new Array(dur).fill(-30);
  for (let t = 0; t < dur; t += .5 + rnd()) msgs.push({ t, user: `u${Math.floor(rnd() * 300)}`, msg: ['hi', 'lol ok', 'nice', 'what game is this', 'gg'][Math.floor(rnd() * 5)] });
  for (let i = 0; i < 60; i++) msgs.push({ t: 300 + rnd() * 8, user: `l${i}`, msg: ['KEKW', 'LMAOOO', '😂😂', 'ICANT'][i % 4] });
  for (let i = 0; i < 50; i++) msgs.push({ t: 900 + rnd() * 6, user: `h${i}`, msg: ['NO WAY', 'CLIP IT', 'POGGERS', 'W'][i % 4] });
  for (const p of [295, 895]) for (let k = -2; k <= 3; k++) loud[p + k] = -8;
  for (let t = 0; t < dur; t += 37) loud[t] = -20;
  return { msgs: msgs.sort((a, b) => a.t - b.t), dur, loud };
}

test('stream: the two bursts are found, the delay is estimated, windows hold the build-up', () => {
  const { msgs, dur, loud } = stream(), sig = C.signals(msgs, dur), score = C.burst(sig);
  const pk = C.peaks(score, { thr: 3 });
  assert.equal(pk.length, 2, JSON.stringify(pk));
  const ts = pk.map(p => p.t).sort((a, b) => a - b);
  assert.ok(Math.abs(ts[0] - 303) <= 6 && Math.abs(ts[1] - 902) <= 6, `peaks ${ts}`);
  const delay = C.estimateDelay(sig.n, loud, { max: 15 });
  assert.ok(delay >= 3 && delay <= 10, `delay ${delay}`);
  const w = C.windows(pk, { delay, pre: 25, post: 8, dur });
  for (const x of w) { assert.ok(x.moment - x.t0 >= 24.9 && x.t1 - x.moment <= 8.01); assert.ok(x.t0 < x.peak - delay); }
});

test('snap: windows start at a sentence and end after the reaction sentence', () => {
  const W = (w, t0, t1) => ({ w, t0, t1 });
  const words = [W('So', 9, 9.2), W('then.', 9.3, 9.6), W('He', 11, 11.2), W('jumps', 11.3, 11.7), W('and', 11.8, 12), W('falls!', 12.1, 12.6), W('Oh', 14, 14.2), W('no.', 14.3, 14.6)];
  const s = C.snap({ t0: 11.5, t1: 13 }, words);
  assert.equal(s.t0, 11); assert.equal(s.t1, 12.75);
});
