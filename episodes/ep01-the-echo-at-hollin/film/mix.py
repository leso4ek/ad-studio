# Case 01 mix: original synthesized score + beds + event foley + voice (Kokoro) -> film/mix.wav
# Reads film/events.json (from core/render/events.mjs) and film/cues.json. Cue map: ../TREATMENT.md §6–7.
import sys, os, json, numpy as np, soundfile as sf
from scipy.signal import resample_poly
HERE = os.path.dirname(os.path.abspath(__file__)); EP = os.path.dirname(HERE)
LIB = os.environ.get('LIB', '/root/lemo-opuscar'); sys.path.insert(0, os.path.join(LIB, 'core/audio'))
from sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, click, thump, pop, add, compress, limit

VOICE = os.environ.get('VOICE', 'kokoro')
EVJ = json.load(open(os.path.join(HERE, 'events.json'))); DUR = EVJ['dur']; EV = EVJ['ev']
CUES = json.load(open(os.path.join(HERE, 'cues.json')))
N = int(DUR * SR); tt = np.arange(N) / SR; R = np.random.default_rng(1999)

def curve(keys):
    k = np.array(keys, float); return np.interp(tt, k[:, 0], k[:, 1])
def gate(a, b, fade=.02):          # 1 inside [a, b) with short fades
    return np.clip(np.minimum((tt - a) / fade, (b - tt) / fade), 0, 1)
def mono(n=N): return np.zeros(n)
def st(x, pan=0.):
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4); return np.stack([x * l * 1.414, x * r * 1.414], 1)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}
def midi(s): return 12 * (int(s[-1]) + 1) + NOTE[s[:-1]]

# ── beds ─────────────────────────────────────────────────────────────────────────────────────────────
def cicadas():
    x = bp(noise(DUR), 4200, 7200, 3)
    am = (.55 + .45 * np.sin(2 * np.pi * 7.3 * tt) ** 2) * (.7 + .3 * np.sin(2 * np.pi * .21 * tt + 1)) * (.8 + .2 * np.sin(2 * np.pi * 31 * tt))
    return x * am
def crickets():
    car = np.sin(2 * np.pi * 4700 * tt); pulse = (np.sin(2 * np.pi * 28 * tt) > .2) * (np.sin(2 * np.pi * 2.6 * tt) > .55)
    return lp(car * pulse, 6000) * .5
def hum(): return sum(a * np.sin(2 * np.pi * f * tt) for f, a in [(60, 1), (120, .55), (180, .35), (240, .18), (300, .1)])
def wind(): return bp(brown(DUR), 250, 900) * (.6 + .4 * np.sin(2 * np.pi * .13 * tt) ** 2)
def room(): return lp(brown(DUR), 400)

beds = mono()
beds += norm(cicadas(), .9) * (curve([(0, 0), (3, 0), (3.001, .32), (10.2, .32), (10.201, .03), (16.6, .03), (16.601, 0), (39.4, 0), (39.401, .26), (44, .26), (44.001, 0),
                                    (117.5, 0), (117.501, .3), (120, .3)]))
beds += norm(crickets(), .9) * (curve([(0, 0), (34.2, 0), (34.201, .10), (39.4, .10), (39.401, 0), (89.6, 0), (89.601, .05), (97.4, .05), (97.401, .12), (117.5, .12), (117.501, 0)]))
beds += norm(hum(), 1) * curve([(0, 0), (10.2, 0), (10.201, .05), (24.4, .05), (34.2, .06), (34.201, .09), (39.4, .09), (39.401, .02), (44, .02), (48.4, 0), (48.401, .05), (71.7, .07), (71.701, .02),
                                (73.6, .02), (97.4, 0), (97.401, .03), (117.5, .03), (117.501, 0)])
beds += norm(wind(), 1) * curve([(0, 0), (3, 0), (3.001, .14), (10.2, .14), (10.201, 0), (71.7, 0), (71.701, .12), (73.6, .12), (89.6, 0), (89.601, .1), (117.5, .16), (117.501, 0)])
beds += norm(room(), 1) * curve([(0, 0), (10.2, 0), (10.201, .05), (34.2, .05), (34.201, 0), (48.4, 0), (48.401, .04), (71.7, .05), (71.701, 0)])

# ── score (original; 60 BPM, 1 beat = 1 s) ──────────────────────────────────────────────────────────
mus = mono()
def tone(f, d, harm, att=.3, rel=.6, det=(0,), lpf=None):
    n = int(d * SR); x = np.zeros(n); tl = np.arange(n) / SR
    for dc in det:
        ff = f * 2 ** (dc / 1200); ph = 2 * np.pi * ff * tl + R.uniform(0, 6.28)
        for h in range(1, harm + 1):
            if ff * h > 9000: break
            x += np.sin(ph * h) / h
    env = np.minimum(1, tl / att) * np.minimum(1, (d - tl) / rel); x *= np.clip(env, 0, 1)
    return lp(x, lpf) if lpf else x
def put(buf, x, at, g=1.):
    a = int(at * SR); b = min(len(buf), a + len(x));
    if b > a: buf[a:b] += x[:b - a] * g
# string chorale, D minor, half notes, 21–44 s
CH = [('D3 A3 D4 F4'), ('A#2 F3 A#3 D4'), ('G2 D3 G3 A#3'), ('A2 E3 A3 C#4'), ('D3 A3 D4 F4'), ('F2 C3 F3 A3'),
      ('C3 G3 C4 E4'), ('A2 E3 A3 C#4'), ('D3 A3 D4 F4'), ('G2 D3 G3 A#3'), ('A#2 F3 A#3 D4'), ('A2 E3 A3 C#4')]
for i, c in enumerate(CH):
    t0 = 21 + i * 2 - .1
    for v, nn in enumerate(c.split()):
        put(mus, tone(hz(midi(nn)), 2.5 if i < 11 else 1.2, 10, att=.45, rel=.7, det=(-7, 0, 7), lpf=1600), t0, .055 / (1 + v * .15))
# harpsichord-like pluck doubling the top line in eighths from bar 9 (32 s)
def pluck(f, d=.9):
    n = int(d * SR); tl = np.arange(n) / SR; x = np.zeros(n)
    for h in range(1, 16):
        if f * h > 10000: break
        x += np.sin(2 * np.pi * f * h * tl) * np.exp(-tl * (3 + h * 1.6)) / h ** .7
    return x * np.minimum(1, tl / .002)
for i in range(6):
    c = CH[5 + i].split(); top = [midi(c[3]) + 12, midi(c[2]) + 12, midi(c[1]) + 12, midi(c[2]) + 12]
    for k in range(4): put(mus, pluck(hz(top[k])), 32 + i * 2 + k * .5, .045)
# cello pedal with tremolo 48.4–72.4 (D2, a semitone up at 67)
f_ped = np.where(tt < 67, hz(midi('D2')), hz(midi('D#2')))
ph = np.cumsum(f_ped / SR) * 2 * np.pi; ped = sum(np.sin(ph * h) / h for h in range(1, 9))
ped = lp(ped, 900) * (.75 + .25 * np.sin(2 * np.pi * 6 * tt)) * curve([(0, 0), (48.4, 0), (50, .12), (58, .2), (67, .24), (72.39, .3), (72.4, 0)])
mus += ped
# sparse descending piano, 75.6–90 (a note every 2 beats)
def piano(f, d=2.6):
    n = int(d * SR); tl = np.arange(n) / SR; x = np.zeros(n)
    for h in range(1, 10):
        fh = f * h * np.sqrt(1 + .0004 * h * h); x += np.sin(2 * np.pi * fh * tl) * np.exp(-tl * (1.1 + .5 * h)) / h
    return x * np.minimum(1, tl / .004)
for i, nn in enumerate(['A4', 'F4', 'D4', 'C4', 'A#3', 'A3', 'G3', 'F3']):
    put(mus, piano(hz(midi(nn))), 76 + i * 1.75, .22)
# choir "ah" pads, swelling 81–97.4 in D major (formant-filtered saws), cut on the cut
choir = mono(); CHO = ['D3 F#3 A3 D4', 'G2 D3 G3 B3', 'A2 E3 A3 C#4', 'D3 F#3 A3 D4']
for i, c in enumerate(CHO):
    for nn in c.split(): put(choir, tone(hz(midi(nn)), 4.6, 24, att=1.2, rel=1.0, det=(-9, 0, 9)), 81 + i * 4.1, .1)
choir = bp(choir, 600, 820) * 1.0 + bp(choir, 1050, 1300) * .55 + bp(choir, 2400, 2800) * .25
mus += choir * curve([(0, 0), (81, 0), (88, .7), (96, 1.25), (97.39, 1.3), (97.4, 0)])

# ── event foley ──────────────────────────────────────────────────────────────────────────────────────
fx = np.zeros((N, 2))
def chirp(f=1600, d=.09):
    tl = t_(d); return np.sin(2 * np.pi * f * tl) * np.minimum(1, tl / .003) * np.minimum(1, (d - tl) / .01)
for ev in EV:
    t, ty, v = ev['t'], ev['type'], ev.get('v', 1.)
    if ty == 'chirp': add(fx, chirp(), t, .35 * v)
    elif ty == 'thump': add(fx, thump(1, 48), t, .9 * v)
    elif ty == 'pop': add(fx, click(1.6, .6), t, .4, float(np.clip((t - 24.5) * 4, -1, 1)))
    elif ty == 'relay': add(fx, click(.8, 1), t, .5)
    elif ty == 'stamp':
        y = click(.6, 1).copy(); c9 = chirp(900, .05); y[:len(c9)] += c9 * .4; add(fx, y, t, .6 * v)
    elif ty == 'chatter':
        d = ev['d']; x = (np.sign(np.sin(2 * np.pi * 37 * t_(d))) * (R.random(int(round(d * SR))) > .6)) * .3; add(fx, hp(x, 1500), t, .25)
    elif ty == 'alarm':
        d = ev['d']; tl = t_(d); f = np.where((tl % 1) < .5, 880, 660); x = np.sign(np.sin(np.cumsum(f / SR) * 2 * np.pi)); add(fx, lp(x, 3000) * .5, t, .32)
    elif ty == 'swell':
        d = ev['d']; tl = t_(d); f = 120 + (tl / d) ** 2 * 1800; x = np.sin(np.cumsum(f / SR) * 2 * np.pi) * (tl / d) ** 2 + bp(noise(d), 800, 6000) * (tl / d) ** 3 * .6
        add(fx, x, t, .55)
    elif ty == 'impact':
        d = 1.6; tl = t_(d); sub = np.sin(np.cumsum((60 - 30 * tl / d) / SR) * 2 * np.pi) * env_exp(d, .45)
        add(fx, sub * 1.0 + lp(noise(d), 4000) * env_exp(d, .12) * .8, t, 1.0)
    elif ty == 'ring':
        d = ev['d']; tl = t_(d); add(fx, np.sin(2 * np.pi * 3200 * tl) * env_exp(d, .9) * .15, t, 1)
    elif ty == 'pencil':
        d = .18 + .2 * R.random(); add(fx, bp(noise(d), 2200, 6500) * np.sin(np.pi * t_(d) / d) ** .5, t, .12, R.uniform(-.3, .3))
    elif ty == 'tick': add(fx, click(2.2, .3), t, .12)

# ── voice ────────────────────────────────────────────────────────────────────────────────────────────
vox = mono(); vact = mono()
for c in CUES:
    x, sr = sf.read(os.path.join(EP, 'voices', VOICE, c['id'] + '.wav'), dtype='float64')
    if x.ndim > 1: x = x.mean(1)
    x = resample_poly(x, SR, sr); x = norm(x, .7)
    if 'playback' in c['who']:
        x = bp(x, 300, 3000, 4) * 1.5 + bp(noise(len(x) / SR), 2000, 8000) * .012
    put(vox, x, c['t0']); vact[int(c['t0'] * SR): int(c['t0'] * SR) + len(x)] = 1
duck = 1 - .62 * np.convolve(vact, np.ones(int(.25 * SR)) / int(.25 * SR), 'same')

# ── sum, silences, master ────────────────────────────────────────────────────────────────────────────
mix = st(beds) + st(mus * duck * .9) + fx + st(vox * 1.15)
for ev in EV:
    if ev['type'] == 'silence':
        a, b = int(ev['t'] * SR), int((ev['t'] + ev['d']) * SR); mix[a:b] = 0       # true digital silence, hard cut
mix[int(119.995 * SR):] = 0                                                         # everything stops dead at the end
mix = mix / max(1e-9, np.abs(mix).max()) * .89
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
rms = lambda a, b: float(np.sqrt(np.mean(mix[int(a * SR):int(b * SR)] ** 2)))
print(f"mix.wav {DUR:.1f}s  silence RMS 47.7–48.3: {rms(47.7, 48.3):.2e}  73.7–75.5: {rms(73.7, 75.5):.2e}  voice 4–9: {rms(4, 9):.3f}")
