#!/usr/bin/env python3
"""camera30: read the camera movement of a video at 30 fps (research teardowns).

  python3 research/tools/camera30.py <video> [--out <dir>] [--fps 30] [--width 160] [--strip 3]

Per frame pair (grey, 160 px wide): tracked corners (Lucas-Kanade) → a similarity fit (RANSAC) = translation, scale, roll;
phase correlation when too few corners. Shots come from colour-histogram jumps (local peaks), then each shot gets:
  move      static · pan-left/right · tilt-up/down · push-in · pull-out · truck-left/right (translation with parallax) ·
            handheld · whip-left/right · snap-zoom-in/out · roll (several can apply: `moves` lists them by strength)
  speed     frame widths per second (pan/truck), % scale per second (push/pull)
  ease      ease-in · ease-out · ease-in-out · constant, from the speed profile over the shot
  shake     the jitter left after smoothing, in % of the frame width (handheld feel)
plus a contact strip of the first --strip seconds at full frame rate (every 3rd frame) for watching the opening move.
Directions are the CAMERA's: content sliding left means the camera pans right; content growing means a push-in.
Research use only; delete downloaded videos after the teardown.
"""
import json, math, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.exists(os.path.join(HERE, '.venv')) and os.path.realpath(sys.prefix) != os.path.realpath(os.path.join(HERE, '.venv')) and not os.environ.get('VIDGET_NOREEXEC'):
    os.environ['VIDGET_NOREEXEC'] = '1'; py = os.path.join(HERE, '.venv', 'bin', 'python'); os.execv(py, [py, '-I', os.path.abspath(__file__), *sys.argv[1:]])
import numpy as np
import cv2

def frames(path, fps=30, width=160):
    """Grey frames at a fixed rate, plus small colour frames for the cut detector and the strip."""
    probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', path], capture_output=True, text=True).stdout)
    w0, h0 = probe['streams'][0]['width'], probe['streams'][0]['height']
    h = int(round(width * h0 / w0 / 2) * 2)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-an', '-vf', f'fps={fps},scale={width}:{h}:flags=area', '-pix_fmt', 'bgr24', '-f', 'rawvideo', '-'], capture_output=True).stdout
    n = len(raw) // (width * h * 3)
    col = np.frombuffer(raw[:n * width * h * 3], np.uint8).reshape(n, h, width, 3)
    return col, width, h

def cuts(col, fps, track=None):
    """Shot starts (frame indices) from local peaks of a cut score: colour-histogram distance + grey frame difference
    (+ the share of tracked corners lost, when given). Local peaks catch cuts inside one room that a fixed threshold misses."""
    hs, grey = [], []
    for f in col:
        hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV); hh = cv2.calcHist([hsv], [0, 1], None, [16, 8], [0, 180, 0, 256]); cv2.normalize(hh, hh); hs.append(hh)
        grey.append(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32))
    d = np.zeros(len(col))
    for i in range(1, len(col)):
        hd = cv2.compareHist(hs[i - 1], hs[i], cv2.HISTCMP_BHATTACHARYYA)
        md = float(np.mean(np.abs(grey[i] - grey[i - 1]))) / 40
        lost = track[i - 1] if track is not None and i - 1 < len(track) else 0
        d[i] = .55 * hd + .3 * min(1.5, md) + .15 * lost
    out, win = [0], max(4, fps // 2)
    for i in range(1, len(d)):
        lo, hi = max(0, i - win), min(len(d), i + win + 1)
        local = np.median(d[lo:hi])
        if d[i] == d[lo:hi].max() and d[i] > max(.16, local * 3.2) and i - out[-1] >= fps // 3: out.append(i)
    return out

def pair_motion(a, b):
    """Similarity a→b: dx, dy (px), scale, roll (rad), parallax residual (px), corners used."""
    pts = cv2.goodFeaturesToTrack(a, 200, .01, 4)
    if pts is not None and len(pts) >= 12:
        nxt, st, _ = cv2.calcOpticalFlowPyrLK(a, b, pts, None, winSize=(15, 15), maxLevel=3)
        ok = st.reshape(-1) == 1
        p0, p1 = pts.reshape(-1, 2)[ok], nxt.reshape(-1, 2)[ok]
        if len(p0) >= 10:
            M, inl = cv2.estimateAffinePartial2D(p0, p1, method=cv2.RANSAC, ransacReprojThreshold=1.5)
            if M is not None:
                s = math.hypot(M[0, 0], M[1, 0]); r = math.atan2(M[1, 0], M[0, 0])
                cx, cy = a.shape[1] / 2, a.shape[0] / 2
                # translation of the frame centre (so a zoom about the centre is not read as a pan)
                tx = M[0, 0] * cx + M[0, 1] * cy + M[0, 2] - cx; ty = M[1, 0] * cx + M[1, 1] * cy + M[1, 2] - cy
                pred = (p0 @ M[:, :2].T) + M[:, 2]; res = float(np.median(np.linalg.norm(pred - p1, axis=1)))
                n_in = int(inl.sum()) if inl is not None else len(p0)
                if n_in < 25: return 0.0, 0.0, 1.0, 0.0, res, n_in          # too few corners: no reading rather than noise
                # noise floor: sub-pixel jitter and tiny scale/roll readings are compression noise that would pile up over a long take
                if abs(tx) < .05: tx = 0.0
                if abs(ty) < .05: ty = 0.0
                if abs(math.log(s)) < .0012: s = 1.0
                if abs(r) < .0012: r = 0.0
                return tx, ty, s, r, res, n_in
    (tx, ty), _ = cv2.phaseCorrelate(np.float32(a), np.float32(b))
    return tx, ty, 1.0, 0.0, 0.0, 0

def ease_of(speed):
    """Shape of a speed profile (already smoothed): which third is slow relative to the middle."""
    n = len(speed)
    if n < 9 or speed.max() < 1e-6: return 'constant'
    t = n // 3; a, m, c = speed[:t].mean(), speed[t:2 * t].mean(), speed[2 * t:].mean()
    top = max(m, 1e-9)
    ein, eout = a < .6 * top, c < .6 * top
    return 'ease-in-out' if ein and eout else 'ease-in' if ein else 'ease-out' if eout else 'constant'

def classify(seg, fps, w):
    """seg: array of [dx, dy, scale, roll, residual] per pair inside one shot. Returns the shot's camera reading."""
    if len(seg) < 3: return {'move': 'static', 'moves': [], 'ease': 'constant', 'speed': 0, 'shake': 0}
    dx, dy, sc, ro, res = seg[:, 0], seg[:, 1], seg[:, 2], seg[:, 3], seg[:, 4]
    dur = len(seg) / fps
    k = max(3, int(fps * .25) | 1)                          # quarter-second smoothing
    smooth = lambda v: np.convolve(v, np.ones(k) / k, mode='same')
    sx, sy = smooth(dx), smooth(dy)
    shake = float(np.sqrt(np.mean((dx - sx) ** 2 + (dy - sy) ** 2)) / w * 100)   # % of frame width per frame
    netx, nety = dx.sum() / w, dy.sum() / w                 # frame widths over the shot
    lsc = float(np.log(np.clip(sc, .5, 2)).sum())           # log scale change over the shot
    rot = float(np.degrees(ro.sum()))
    vel = np.hypot(sx, sy) * fps / w                         # frame widths per second
    zvel = np.abs(smooth(np.log(np.clip(sc, .5, 2)))) * fps
    moves = []
    if vel.max() > 2.0:
        moves.append(('whip-left' if dx[np.argmax(vel)] > 0 else 'whip-right', float(vel.max())))
    win = min(len(sc), int(fps * .3))
    zs = [float(np.log(np.clip(sc[i:i + win], .5, 2)).sum()) for i in range(0, max(1, len(sc) - win + 1))]
    if zs and max(abs(z) for z in zs) > .1:
        z = max(zs, key=abs); moves.append(('snap-zoom-in' if z > 0 else 'snap-zoom-out', abs(z) * 10))
    if abs(lsc) > .03: moves.append(('push-in' if lsc > 0 else 'pull-out', abs(lsc) * 10))
    if abs(netx) > .06 or abs(nety) > .06:
        par = float(np.median(res)) > .35 and abs(netx) >= abs(nety)
        if abs(netx) >= abs(nety): moves.append((('truck-' if par else 'pan-') + ('left' if netx > 0 else 'right'), abs(netx) * 5))
        else: moves.append(('tilt-up' if nety > 0 else 'tilt-down', abs(nety) * 5))
    if abs(rot) > 3: moves.append(('roll', abs(rot) / 10))
    if shake > .12: moves.append(('handheld', shake * 4))
    moves.sort(key=lambda m: -m[1])
    names = [m[0] for m in moves]
    main = next((m for m in names if not m.startswith('handheld')), names[0] if names else 'static')
    prof = zvel if main in ('push-in', 'pull-out') else vel
    speed = (abs(lsc) / dur * 100) if main in ('push-in', 'pull-out') else (math.hypot(netx, nety) / dur)
    return {'move': main, 'moves': names, 'ease': ease_of(prof) if main != 'static' else 'constant',
            'speed': round(speed, 3), 'speed_unit': '% scale/s' if main in ('push-in', 'pull-out') else 'frame widths/s',
            'net': {'x': round(netx, 3), 'y': round(nety, 3), 'scale_pct': round((math.exp(lsc) - 1) * 100, 1), 'roll_deg': round(rot, 1)},
            'shake': round(shake, 3)}

def analyse(path, fps=30, width=160, strip=3, out=None):
    col, w, h = frames(path, fps, width)
    grey = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in col]
    full = np.array([pair_motion(grey[i - 1], grey[i]) for i in range(1, len(grey))]) if len(grey) > 1 else np.zeros((0, 6))
    pairs = full[:, :5]
    track = 1 - np.clip(full[:, 5] / 120, 0, 1) if len(full) else None
    starts = cuts(col, fps, track) + [len(col)]
    shots = []
    for a, b in zip(starts[:-1], starts[1:]):
        seg = pairs[a:max(a, b - 1)]           # pairs inside the shot (the cut pair itself is excluded)
        shot = {'t0': round(a / fps, 3), 't1': round(b / fps, 3), 'dur': round((b - a) / fps, 3), **classify(seg, fps, w)}
        if (b - a) > 4 * fps:   # a long take: what the camera does in each 2 s of it
            step = 2 * fps
            shot['segments'] = [{'t0': round((a + k) / fps, 2), **{x: v for x, v in classify(seg[k:k + step], fps, w).items() if x in ('move', 'ease', 'speed', 'shake')}} for k in range(0, len(seg) - fps, step)]
        shots.append(shot)
    res = {'file': os.path.basename(path), 'fps': fps, 'frames': len(col), 'duration': round(len(col) / fps, 2), 'shots': shots,
           'cuts_per_10s': round((len(shots) - 1) / max(.1, len(col) / fps) * 10, 2),
           'mix': {m: sum(1 for s in shots if s['move'] == m) for m in sorted({s['move'] for s in shots})}}
    if out:
        os.makedirs(out, exist_ok=True)
        n = min(len(col), int(strip * fps)); tiles = [cv2.resize(col[i], (w, h)) for i in range(0, n, 3)]
        if tiles:
            cols = 10; rows = [np.hstack(tiles[r:r + cols] + [np.zeros_like(tiles[0])] * (cols - len(tiles[r:r + cols]))) for r in range(0, len(tiles), cols)]
            cv2.imwrite(os.path.join(out, 'strip30.jpg'), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])
        json.dump(res, open(os.path.join(out, 'camera30.json'), 'w'), indent=1)
    return res

if __name__ == '__main__':
    a = sys.argv[1:]
    opt = lambda k, d: type(d)(a[a.index(k) + 1]) if k in a else d
    r = analyse(a[0], opt('--fps', 30), opt('--width', 160), opt('--strip', 3), opt('--out', ''))
    print(json.dumps({k: r[k] for k in ('file', 'duration', 'cuts_per_10s', 'mix')}))
    for s in r['shots']: print(f"{s['t0']:6.2f}-{s['t1']:6.2f}  {s['move']:<14} {s['ease']:<12} speed {s['speed']} {s.get('speed_unit', '')}  shake {s['shake']}  {'+'.join(s['moves'][1:])}")
