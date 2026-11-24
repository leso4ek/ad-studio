#!/usr/bin/env python3
"""vidget: download a TikTok (or any yt-dlp-supported) video for research teardowns.

  python3 research/tools/vidget.py <url> [<url> …] --out <dir> [--probe]

- yt-dlp first (install: pip install -U "yt-dlp[default,curl-cffi]" in a private venv; this script re-execs into
  research/tools/.venv when it exists).
- Fallback for TikTok: read the page's own JSON (__UNIVERSAL_DATA_FOR_REHYDRATION__), take the video's playAddr and
  fetch it with the page's cookies.
- Each video goes into its own folder <out>/<platform>-<id>/ (video.mp4 + info.json). --probe only prints which hosts
  the page and the media come from (to allow-list them in a restricted network), then exits.
Research use only: watch, describe, quote briefly; never re-upload.
"""
import json, os, re, sys, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
VENV_PY = os.path.join(HERE, '.venv', 'bin', 'python')
if os.path.exists(VENV_PY) and os.path.realpath(sys.executable) != os.path.realpath(VENV_PY) and not os.environ.get('VIDGET_NOREEXEC'):
    os.environ['VIDGET_NOREEXEC'] = '1'; os.execv(VENV_PY, [VENV_PY, '-I', os.path.abspath(__file__), *sys.argv[1:]])

def vid_id(url):
    m = re.search(r'/video/(\d+)', url) or re.search(r'/(\d{15,})', url)
    return ('tiktok-' + m.group(1)) if m and 'tiktok' in url else re.sub(r'\W+', '-', url)[-40:]

def with_ytdlp(url, folder, probe):
    try:
        import yt_dlp
    except ImportError:
        return None, 'yt-dlp not installed'
    opts = {'outtmpl': os.path.join(folder, 'video.%(ext)s'), 'format': 'bv*+ba/b', 'merge_output_format': 'mp4', 'quiet': True,
            'no_warnings': True, 'noplaylist': True, 'writeinfojson': False, 'retries': 3}
    try:
        with yt_dlp.YoutubeDL(opts) as y:
            info = y.extract_info(url, download=not probe)
        hosts = sorted({urllib.parse.urlparse(f.get('url', '')).hostname for f in info.get('formats', []) if f.get('url')} - {None})
        slim = {k: info.get(k) for k in ('id', 'title', 'description', 'uploader', 'channel', 'duration', 'view_count', 'like_count', 'comment_count', 'repost_count', 'timestamp', 'track', 'artist', 'tags', 'webpage_url', 'width', 'height', 'fps')}
        slim['media_hosts'] = hosts
        return slim, None
    except Exception as e:
        return None, f'yt-dlp: {e}'

def with_page(url, folder, probe):
    import http.cookiejar, urllib.request
    cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
    op.addheaders = [('User-Agent', ua), ('Accept-Language', 'en-US,en;q=0.9')]
    html = op.open(url, timeout=30).read().decode('utf-8', 'replace')
    m = re.search(r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>', html, re.S)
    if not m: return None, 'page has no rehydration data (bot wall?)'
    data = json.loads(m.group(1))
    item = data.get('__DEFAULT_SCOPE__', {}).get('webapp.video-detail', {}).get('itemInfo', {}).get('itemStruct')
    if not item: return None, 'no itemStruct in page data'
    v = item.get('video', {}); play = v.get('playAddr') or v.get('downloadAddr')
    info = {'id': item.get('id'), 'title': item.get('desc'), 'description': item.get('desc'), 'uploader': item.get('author', {}).get('uniqueId'),
            'duration': v.get('duration'), 'view_count': item.get('stats', {}).get('playCount'), 'like_count': item.get('stats', {}).get('diggCount'),
            'comment_count': item.get('stats', {}).get('commentCount'), 'track': item.get('music', {}).get('title'), 'webpage_url': url,
            'media_hosts': [urllib.parse.urlparse(play).hostname] if play else []}
    if probe or not play: return info, None if play else 'no playAddr'
    req = urllib.request.Request(play, headers={'User-Agent': ua, 'Referer': 'https://www.tiktok.com/'})
    with op.open(req, timeout=120) as r, open(os.path.join(folder, 'video.mp4'), 'wb') as f: f.write(r.read())
    return info, None

def main():
    args = sys.argv[1:]; probe = '--probe' in args; out = 'downloads'
    if '--out' in args: out = args[args.index('--out') + 1]
    urls = [a for a in args if a.startswith('http')]
    for url in urls:
        folder = os.path.join(out, vid_id(url)); os.makedirs(folder, exist_ok=True)
        info, err = with_ytdlp(url, folder, probe)
        if not info and 'tiktok.com' in url:
            try: info, err2 = with_page(url, folder, probe)
            except Exception as e: info, err2 = None, f'page: {e}'
            err = f'{err}; {err2}' if err2 else err if not info else None
        if info:
            json.dump(info, open(os.path.join(folder, 'info.json'), 'w'), ensure_ascii=False, indent=1)
            got = [f for f in os.listdir(folder) if f.startswith('video.')]
            print(json.dumps({'url': url, 'ok': True, 'folder': folder, 'file': got[0] if got else None, 'media_hosts': info.get('media_hosts'), 'views': info.get('view_count'), 'title': (info.get('title') or '')[:90]}))
        else:
            print(json.dumps({'url': url, 'ok': False, 'error': (err or '')[:400]}))

if __name__ == '__main__':
    main()
