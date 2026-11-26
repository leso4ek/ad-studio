#!/usr/bin/env python3
"""Synthetic check for camera30 and outliers (known answers).  python3 research/tools/test_camera30.py"""
import os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.realpath(sys.prefix) != os.path.realpath(os.path.join(HERE, '.venv')):
    py = os.path.join(HERE, '.venv', 'bin', 'python'); os.execv(py, [py, '-I', os.path.abspath(__file__)])
sys.path.insert(0, HERE)
import numpy as np, cv2
import camera30, outliers

W, H, FPS = 320, 568, 30
rng = np.random.default_rng(7)

def texture(tint):
    base = rng.integers(0, 255, (H * 3, W * 3), dtype=np.uint8)
    base = cv2.GaussianBlur(base, (0, 0), 2.2)
    img = cv2.merge([np.clip(base * t, 0, 255).astype(np.uint8) for t in tint])
    for _ in range(140):   # strong corners to track
        x, y = int(rng.integers(0, W * 3)), int(rng.integers(0, H * 3)); cv2.rectangle(img, (x, y), (x + 14, y + 14), tuple(int(c) for c in rng.integers(0, 255, 3)), -1)
    return img

def render(tex, cx, cy, s):
    M = np.float32([[s, 0, W / 2 - s * cx], [0, s, H / 2 - s * cy]])
    return cv2.warpAffine(tex, M, (W, H), flags=cv2.INTER_LINEAR)

def video(path):
    frames = []
    t1, t2, t3, t4 = texture((1, .6, .3)), texture((.3, .8, 1)), texture((.9, .9, .2)), texture((.5, .2, .9))
    for i in range(45): frames.append(render(t1, W * 1.5, H * 1.5, 1))                       # static 1.5 s
    for i in range(60):                                                                        # camera pans right 0.6 widths, ease-in-out
        u = i / 59; e = .5 - .5 * np.cos(np.pi * u); frames.append(render(t2, W * 1.2 + e * W * .6, H * 1.5, 1))
    for i in range(60): frames.append(render(t3, W * 1.5, H * 1.5, 1 + .12 * i / 59))           # push-in 12 %, constant
    for i in range(45): frames.append(render(t4, W * 1.5 + rng.normal(0, 3.5), H * 1.5 + rng.normal(0, 3.5), 1))   # handheld
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', path], stdin=subprocess.PIPE)
    for f in frames: p.stdin.write(f.tobytes())
    p.stdin.close(); p.wait()

def main():
    d = tempfile.mkdtemp(); f = os.path.join(d, 'syn.mp4'); video(f)
    r = camera30.analyse(f)
    got = [(s['move'], s['ease']) for s in r['shots']]
    print(got)
    assert len(r['shots']) == 4, f'4 shots expected, got {len(r["shots"])}'
    assert got[0][0] == 'static', got[0]
    assert got[1][0] == 'pan-right' and got[1][1] == 'ease-in-out', got[1]
    assert got[2][0] == 'push-in' and abs(r['shots'][2]['net']['scale_pct'] - 12) < 3, r['shots'][2]
    assert got[3][0] == 'handheld', got[3]
    # outliers: the guide's worked example (median 12,000, target 180,000 → about 15x; young posts and small samples are not scored)
    now = 100 * 86400
    posts = [{'id': str(i), 'views': 12000, 'timestamp': now - 30 * 86400} for i in range(20)] + [{'id': 'hit', 'views': 180000, 'timestamp': now - 9 * 86400}, {'id': 'new', 'views': 10**6, 'timestamp': now - 3600}]
    s = {p['id']: p for p in outliers.score(posts, now)}
    assert s['hit']['lift'] == 15.0 and s['new']['status'] == 'too young' and s['hit']['z'] is None   # MAD 0 → no robust z
    assert outliers.score(posts[:5], now)[0]['status'] == 'insufficient history'
    rows = [dict(p, creator='a') for p in outliers.score(posts, now)] + [{'id': 'b1', 'creator': 'b', 'lift': 3.0}]
    assert [x['id'] for x in outliers.rank(rows, 3)][0] == 'hit'
    print('ok')

if __name__ == '__main__':
    main()
