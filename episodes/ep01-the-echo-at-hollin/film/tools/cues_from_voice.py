# Re-time captions to the real voice lengths: hold = speech + 0.6 s (>= 1.8 s), yielding to the next line,
# never into a card shot. Writes film/cues.json (read by the page and mix.py) and ../ep01.srt.
import json, sys, os, soundfile as sf
E = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VOICE = sys.argv[1] if len(sys.argv) > 1 else 'kokoro'
CARDS = [(0, 3), (21, 24.4), (44, 47.6), (117.5, 120)]          # no caption may overlap a card shot
c = json.load(open(f'{E}/cues.json')); out = []
for i, x in enumerate(c):
    d = sf.info(f'{E}/voices/{VOICE}/{i+1:02d}.wav').duration
    nxt = c[i+1]['t0'] if i + 1 < len(c) else 120
    t1 = min(x['t0'] + max(1.8, d + 0.6), nxt - 0.05)
    for a, b in CARDS:
        if x['t0'] < a < t1: t1 = a - 0.05
    if t1 - x['t0'] < d + 0.1: print(f"WARN line {i+1}: caption {t1-x['t0']:.2f}s < speech {d:.2f}s")
    out.append({**x, 't1': round(t1, 3), 'dur': round(d, 3), 'id': f'{i+1:02d}'})
json.dump(out, open(f'{E}/film/cues.json', 'w'), indent=1)
def ts(t): return f"{int(t//3600):02d}:{int(t%3600//60):02d}:{int(t%60):02d},{int(round(t%1*1000)) % 1000:03d}"
with open(f'{E}/ep01.srt', 'w') as f:
    for i, x in enumerate(out): f.write(f"{i+1}\n{ts(x['t0'])} --> {ts(x['t1'])}\n{x['text']}\n\n")
print('cues:', len(out), '| last caption ends', out[-1]['t1'])
