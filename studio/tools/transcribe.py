"""Ad Studio · word-timed transcript of a video's audio (faster-whisper, local, free).
usage: python -I transcribe.py <media> <out.json> [--model base] [--lang en]
Writes {"language", "duration", "text", "segments": [{t0, t1, text}], "words": [{w, t0, t1, p}]}.
"""
import json
import sys


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print(__doc__)
        sys.exit(2)
    src, out = args[0], args[1]
    model, lang = 'base', None
    if '--model' in args:
        model = args[args.index('--model') + 1]
    if '--lang' in args:
        lang = args[args.index('--lang') + 1]
    from faster_whisper import WhisperModel
    m = WhisperModel(model, device='cpu', compute_type='int8')
    segs, info = m.transcribe(src, language=lang, word_timestamps=True, vad_filter=True)
    res = {'language': info.language, 'duration': round(info.duration, 3), 'segments': [], 'words': []}
    for s in segs:
        res['segments'].append({'t0': round(s.start, 3), 't1': round(s.end, 3), 'text': s.text.strip()})
        for w in s.words or []:
            res['words'].append({'w': w.word.strip(), 't0': round(w.start, 3), 't1': round(w.end, 3), 'p': round(w.probability, 3)})
    res['text'] = ' '.join(s['text'] for s in res['segments'])
    with open(out, 'w') as f:
        json.dump(res, f, indent=1)
    print(f"{len(res['words'])} words, language {info.language}")


if __name__ == '__main__':
    main()
