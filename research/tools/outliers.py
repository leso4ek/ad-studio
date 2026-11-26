#!/usr/bin/env python3
"""outliers: find a creator's unusually successful posts (creator lift), for research teardowns.

  python3 research/tools/outliers.py @account [@account …] [--posts 60] [--min-age-days 3] [--top 20] [--out research/viral/outliers]

Independent implementation of the method in the uploaded outlier guide (no third-party analytics API):
- listing: yt-dlp's flat account listing (views, publication time) — TikTok works in the cloud, YouTube on the PC;
- creator lift = views / max(median views of the creator's OTHER mature posts, floor 500), only with >= 10 comparable posts,
  otherwise "insufficient history" (no score is invented);
- robust z = 0.6745 * (ln(1+views) - median(ln(1+h))) / MAD, none when MAD is 0 or the sample is small;
- posts younger than --min-age-days are listed apart ("too young"), since a 6-hour-old post cannot be compared to 30-day totals;
- the follower ratio is reported only when the listing gives followers (it usually doesn't): followers are not viewers;
- ranking keeps at most 2 posts per creator, so one creator cannot fill the list.
Every row carries observed_at and the source listing, so a report can say when a number was seen.
Research use only: the posts are watched, described and quoted briefly; never re-uploaded.
"""
import json, math, os, statistics, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
VENV_PY = os.path.join(HERE, '.venv', 'bin', 'python')
if os.path.exists(VENV_PY) and os.path.realpath(sys.prefix) != os.path.realpath(os.path.join(HERE, '.venv')) and not os.environ.get('VIDGET_NOREEXEC'):   # the venv's python is a link to the system one, so compare prefixes
    os.environ['VIDGET_NOREEXEC'] = '1'; os.execv(VENV_PY, [VENV_PY, '-I', os.path.abspath(__file__), *sys.argv[1:]])

MIN_SAMPLE, FLOOR = 10, 500

def robust_z(target, history):
    xs = [math.log1p(h) for h in history]
    if len(xs) < MIN_SAMPLE: return None
    m = statistics.median(xs); mad = statistics.median(abs(x - m) for x in xs)
    if mad == 0: return None
    return round(0.6745 * (math.log1p(target) - m) / mad, 2)

def score(posts, now, min_age_days=3):
    """posts: [{id, views, timestamp, ...}] of ONE creator. Adds lift, z, baseline, sample and a status to each. Pure."""
    mature = [p for p in posts if p.get('views') is not None and p.get('timestamp') and (now - p['timestamp']) >= min_age_days * 86400]
    out = []
    for p in posts:
        q = dict(p)
        if p.get('views') is None: q.update(status='no view count', lift=None, z=None)
        elif not p.get('timestamp') or (now - p['timestamp']) < min_age_days * 86400: q.update(status='too young', lift=None, z=None)
        else:
            hist = [o['views'] for o in mature if o['id'] != p['id']]
            if len(hist) < MIN_SAMPLE: q.update(status='insufficient history', lift=None, z=None, sample=len(hist))
            else:
                base = statistics.median(hist)
                q.update(status='scored', baseline=base, sample=len(hist), small_baseline=base < FLOOR,
                         lift=round(p['views'] / max(base, FLOOR), 2), z=robust_z(p['views'], hist))
        if p.get('followers'): q['follower_ratio'] = round(p['views'] / p['followers'], 2)
        out.append(q)
    return out

def rank(rows, top=20, per_creator=2):
    """Highest lift first, at most per_creator per creator. Unscored rows never rank. Pure."""
    seen, res = {}, []
    for r in sorted((r for r in rows if r.get('lift') is not None), key=lambda r: (-r['lift'], -(r.get('z') or 0))):
        c = r.get('creator'); seen[c] = seen.get(c, 0) + 1
        if seen[c] <= per_creator: res.append(r)
        if len(res) >= top: break
    return res

def listing(account, n):
    import yt_dlp
    url = account if account.startswith('http') else f'https://www.tiktok.com/{account if account.startswith("@") else "@" + account}'
    with yt_dlp.YoutubeDL({'extract_flat': 'in_playlist', 'quiet': True, 'no_warnings': True, 'playlistend': n}) as y:
        info = y.extract_info(url, download=False)
    return url, [{'id': e.get('id'), 'url': e.get('url') or e.get('webpage_url'), 'views': e.get('view_count'), 'timestamp': e.get('timestamp'),
                  'duration': e.get('duration'), 'title': (e.get('title') or '')[:140], 'followers': e.get('channel_follower_count')}
                 for e in info.get('entries') or []]

def main():
    a = sys.argv[1:]
    opt = lambda k, d: type(d)(a[a.index(k) + 1]) if k in a else d
    n, age, top, out = opt('--posts', 60), opt('--min-age-days', 3), opt('--top', 20), opt('--out', os.path.join(HERE, '..', 'viral', 'outliers'))
    accounts = [x for i, x in enumerate(a) if not x.startswith('--') and (i == 0 or not a[i - 1].startswith('--'))]
    now, rows, report = time.time(), [], []
    for acc in accounts:
        try: src, posts = listing(acc, n)
        except Exception as e: report.append({'account': acc, 'error': str(e)[:200]}); continue
        scored = score(posts, now, age)
        for r in scored: r.update(creator=acc, source=src, observed_at=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(now)))
        rows += scored
        st = [r['status'] for r in scored]
        report.append({'account': acc, 'posts': len(posts), 'scored': st.count('scored'), 'too_young': st.count('too young'), 'insufficient': st.count('insufficient history')})
    best = rank(rows, top)
    os.makedirs(out, exist_ok=True)
    f = os.path.join(out, time.strftime('%Y-%m-%d', time.gmtime(now)) + '.json')
    json.dump({'observed_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(now)), 'method': 'creator lift = views / max(median of other mature posts, 500); robust z on log views; >= 10 posts', 'accounts': report, 'top': best, 'all': rows}, open(f, 'w'), indent=1, ensure_ascii=False)
    for r in report: print(json.dumps(r))
    for r in best: print(f"{r['lift']:>7}x  z={r.get('z')}  {r['views']:>10,} views  base {r['baseline']:>9,.0f}  {r['creator']}  {r['url']}")
    print('wrote', os.path.relpath(f))

if __name__ == '__main__':
    main()
