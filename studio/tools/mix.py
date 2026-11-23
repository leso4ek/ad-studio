"""Ad Studio mix: voice lines at their times + a short synthesized score in the bible's mood + style foley at the page's events.
python mix.py --bible bible.json --voice voice/lines --events audio/events.json --out audio/mix.wav [--no-music] [--lib ~/lemo-opuscar]
Everything is synthesized here (no samples, no downloads): royalty-free by construction.
"""
import argparse, json, os, sys
import numpy as np, soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument('--bible', required=True); ap.add_argument('--voice', required=True); ap.add_argument('--events', required=True)
ap.add_argument('--out', required=True); ap.add_argument('--no-music', action='store_true'); ap.add_argument('--lib', default=os.path.expanduser('~/lemo-opuscar'))
ap.add_argument('--hook', default='')
a = ap.parse_args()
sys.path.insert(0, os.path.join(a.lib, 'core', 'audio'))
import sfx as X  # noqa: E402  (library foley helpers, SR = 48000)

SR = X.SR
B = json.load(open(a.bible)); EV = json.load(open(a.events)).get('ev', [])
DUR = float(B['dur']); N = int(DUR * SR) + SR // 2
L = np.zeros(N); R = np.zeros(N); VO = np.zeros(N)
STYLE = B.get('style', 'ad-paper-cutout')

def place(buf, x, at, g=1.0):
    i = int(at * SR)
    if i >= len(buf) or i + len(x) <= 0: return
    j0 = max(0, -i); x = x[j0:]; i = max(0, i); n = min(len(x), len(buf) - i); buf[i:i + n] += x[:n] * g

def stereo(x, at, g=1.0, pan=0.0):
    place(L, x, at, g * np.sqrt((1 - pan) / 2) * 1.414); place(R, x, at, g * np.sqrt((1 + pan) / 2) * 1.414)

# ---------- voice ----------
for line in B.get('vo', {}).get('lines', []):
    p = os.path.join(a.voice, f"{line['id']}.wav")
    if not os.path.exists(p): continue
    x, sr = sf.read(p, dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    if sr != SR: x = np.interp(np.arange(0, len(x), sr / SR), np.arange(len(x)), x)
    x = X.hp(x, 80) * 0.9
    place(VO, x, float(line['at']))

# ---------- score ----------
MOODS = {  # bpm, chord roots (semitones from A=220), scale-ish, timbre
    'warm':   (92,  [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]], 'keys'),
    'bouncy': (116, [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]], 'pluck'),
    'jazzy':  (104, [[2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [9, 12, 16, 19]], 'vibes'),
    'lofi':   (80,  [[0, 3, 7, 10], [5, 8, 12, 15], [3, 7, 10, 14], [7, 10, 14, 17]], 'keys'),
    'bright': (120, [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], 'pluck'),
    'tender': (72,  [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]], 'keys'),
}
mood = B.get('music', {}).get('mood', 'warm')
bpm, prog, timbre = MOODS.get(mood, MOODS['warm']); bpm = B.get('music', {}).get('bpm') or bpm
beat = 60 / bpm; bar = beat * 4
hz = lambda s: 220 * 2 ** (s / 12)
rng = np.random.default_rng(3)

def tone(f, d, kind):
    t = X.t_(d)
    if kind == 'pluck': return (np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t)) * np.exp(-t / .22)
    if kind == 'vibes': return (np.sin(2 * np.pi * f * t) + .15 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / .1)) * np.exp(-t / .9) * (1 + .15 * np.sin(2 * np.pi * 5 * t))
    return (np.sin(2 * np.pi * f * t) + .25 * np.sin(4 * np.pi * f * t) + .08 * np.sin(6 * np.pi * f * t)) * np.exp(-t / 1.1) * np.minimum(1, t / .01)

def kick(): t = X.t_(.3); return np.sin(2 * np.pi * (50 + 90 * np.exp(-t / .03)) * t) * np.exp(-t / .12)
def hat(): return X.hp(X.noise(.05), 7000) * X.env_exp(.05, .012) * .5
def snap(): return X.bp(X.noise(.12), 1500, 5000) * X.env_exp(.12, .03) * .6

ML = np.zeros(N); MR = np.zeros(N)
end_t = B.get('endcard', {}).get('t0', DUR)
if not a.no_music:
    nbar = int(np.ceil(DUR / bar)) + 1
    for b in range(nbar):
        t0 = b * bar
        if t0 > DUR: break
        ch = prog[b % len(prog)]
        final = t0 + bar > end_t and t0 <= end_t
        for k, s in enumerate(ch):   # chord, spread
            x = tone(hz(s), min(bar * 1.2, 3.5), timbre) * .07
            pan = (k / max(1, len(ch) - 1) - .5) * .6
            place(ML, x, t0 + k * .012, np.sqrt((1 - pan) / 2) * 1.4); place(MR, x, t0 + k * .012, np.sqrt((1 + pan) / 2) * 1.4)
        place(ML, tone(hz(ch[0] - 24), bar, 'keys') * .12, t0); place(MR, tone(hz(ch[0] - 24), bar, 'keys') * .12, t0)
        for q in range(8):   # a little melody on the off-beats, from the chord tones
            if rng.random() < (.55 if mood in ('bouncy', 'bright', 'jazzy') else .3):
                n = ch[rng.integers(len(ch))] + 12
                x = tone(hz(n), beat, 'pluck' if timbre != 'vibes' else 'vibes') * .05
                place(ML, x, t0 + q * beat / 2, .9); place(MR, x, t0 + q * beat / 2, 1.1)
        if mood not in ('tender',) and t0 < end_t:   # light kit
            for q in range(4):
                if q % 2 == 0: place(ML, kick() * .22, t0 + q * beat); place(MR, kick() * .22, t0 + q * beat)
                else: place(ML, snap() * .08, t0 + q * beat); place(MR, snap() * .08, t0 + q * beat)
                place(ML, hat() * .05, t0 + q * beat + beat / 2); place(MR, hat() * .07, t0 + q * beat + beat / 2)
    # the button: one resolving chord on the end card
    for k, s in enumerate(prog[0] + [prog[0][0] + 12]):
        x = tone(hz(s), 3.0, 'keys') * .08
        place(ML, x, end_t + .05 + k * .03); place(MR, x, end_t + .05 + k * .03)
    fade = np.ones(N); fi = int((DUR - .6) * SR); fade[fi:] = np.linspace(1, 0, N - fi); ML *= fade; MR *= fade

# ---------- foley per style ----------
def paper(): return X.bp(X.noise(.18), 900, 6000) * X.env_exp(.18, .05) * .5
def blip(f=880): t = X.t_(.18); return np.sin(2 * np.pi * f * t) * np.exp(-t / .05) * .5
def shimmer(): t = X.t_(1.2); return sum(np.sin(2 * np.pi * f * t) * np.exp(-t / .6) * np.minimum(1, t / (.05 + i * .06)) for i, f in enumerate([1320, 1760, 2217, 2637])) * .12
CUT = {'ad-paper-cutout': paper, 'ad-riso-print': lambda: X.thump(.5, 80), 'ad-midcentury-toon': lambda: blip(660), 'ad-kinetic-type': lambda: X.click(1.0, .8), 'ad-toy-3d': lambda: X.pop(.5)}
for e in EV:
    t, k = float(e['t']), e['type']
    if k == 'cut' and e.get('trans', 'cut') != 'cut': stereo(X.whoosh(.35, .5), t - .05, .35)
    elif k == 'cut': stereo(CUT.get(STYLE, paper)(), t, .3)
    elif k == 'pop': stereo(X.pop(.7), t + .02, .45, (hash(str(t)) % 7 - 3) / 10)
    elif k == 'whoosh': stereo(X.whoosh(.4, .6), t, .35)
    elif k == 'reveal': stereo(shimmer(), t, .9)
    elif k == 'type': stereo(blip(1320) if STYLE == 'ad-midcentury-toon' else X.click(1.4, .5), t, .3)
    elif k == 'logo': stereo(X.ding(.6), t + .1, .5)
    elif k in ('ding', 'thump', 'click', 'step', 'creak'): stereo(getattr(X, k)(), t, .5)

# ---------- duck and sum ----------
env = np.abs(VO); win = int(.12 * SR); env = np.convolve(env, np.ones(win) / win, 'same'); env = env / (env.max() + 1e-9)
duck = 1 - .55 * np.clip(env * 4, 0, 1)
ML *= duck; MR *= duck
out = np.stack([L + ML + VO, R + MR + VO], 1)
# the master loudness is set later by mux.sh (−14 LUFS)
pk = np.abs(out).max(); out = out / pk * .89 if pk > 0 else out
os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
sf.write(a.out, out[:int(DUR * SR)].astype(np.float32), SR)
print(f'mix: {a.out}  {DUR:.1f} s  mood={mood} bpm={bpm} events={len(EV)}')
