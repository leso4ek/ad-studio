"""ComfyUI nodes that run locally: frames, Kokoro narration, streaming upscale, comparison grid, episode assembly."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from . import core, story
from .nodes_openrouter import probe_frames, video_duration
from .nodes_story import _bible_path


class FrameFromVideo:
    """First, middle or last frame of a clip, e.g. the last frame as the start frame of the next shot (extend)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"video_path": ("STRING", {"forceInput": True}),
                             "which": (["last", "first", "middle"], {"default": "last"})}}

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "run"
    CATEGORY = "Kid Studio"

    def run(self, video_path, which):
        return (core.pils_to_tensor([probe_frames(video_path, which)]),)


# ── narration (local, CPU) ───────────────────────────────────────────────────────────────────────────────────
def _kokoro():
    from kokoro_onnx import Kokoro
    mdir = Path(core.setting("KIDSTUDIO_KOKORO_DIR", str(core.PACK_DIR / "models" / "kokoro")))
    model, voices = mdir / "kokoro-v1.0.onnx", mdir / "voices-v1.0.bin"
    if not model.exists():
        raise FileNotFoundError(f"Kokoro model not found in {mdir}. Run scripts/download_models.sh (about 340 MB).")
    return Kokoro(str(model), str(voices))


class Narration:
    """Speaks every narration line of the bible with Kokoro (offline), one wav per line, plus captions (.srt)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "bible_path": ("STRING", {"default": "pilot/bible.json"}),
            "voice": (["af_heart", "af_bella", "af_sky", "bf_emma", "bf_isabella", "am_michael", "bm_george"], {"default": "af_heart"}),
            "speed": ("FLOAT", {"default": 0.88, "min": 0.6, "max": 1.2, "step": 0.02}),
        }}

    RETURN_TYPES = ("STRING", "AUDIO")
    RETURN_NAMES = ("voice_dir", "narration")
    FUNCTION = "run"
    CATEGORY = "Kid Studio"
    OUTPUT_NODE = True

    def run(self, bible_path, voice, speed):
        import numpy as np
        import soundfile as sf
        import torch
        bible = story.load_bible(_bible_path(bible_path))
        lines = story.narration_lines(bible)
        slug = bible.get("slug", "episode")
        out = core.runs_dir() / "voice" / slug
        out.mkdir(parents=True, exist_ok=True)
        total = sum(s["seconds"] for s in bible["shots"])
        sr = 24000
        track = np.zeros(int((total + 2) * sr), dtype="float32")
        meta, notes = [], []
        k = None if core.mock_mode() else _kokoro()
        for i, ln in enumerate(lines, 1):
            if k is None:  # mock: a short soft tone instead of speech
                a = (0.05 * np.sin(np.linspace(0, 440 * 2 * np.pi, int(sr * 1.5)))).astype("float32")
            else:
                a, sr = k.create(ln["text"], voice=voice, speed=speed, lang="en-us")
                a = a.astype("float32")
            p = out / f"line{i:02d}.wav"
            sf.write(p, a, sr)
            dur = len(a) / sr
            s0 = int(ln["t"] * sr)
            track[s0:s0 + len(a)] += a[: max(0, len(track) - s0)]
            nxt = lines[i]["t"] if i < len(lines) else total
            if ln["t"] + dur > nxt:
                notes.append(f"line {i} runs {ln['t'] + dur - nxt:.1f}s into the next line: shorten it or move it")
            meta.append({**ln, "file": p.name, "dur": round(dur, 2)})
        (out / "lines.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
        (out / f"{slug}.srt").write_text(_srt(meta, total), encoding="utf-8")
        sf.write(out / "narration_full.wav", track, sr)
        audio = {"waveform": torch.from_numpy(track).reshape(1, 1, -1), "sample_rate": sr}
        msg = f"{len(meta)} lines -> {out}" + ("\n" + "\n".join(notes) if notes else "")
        return {"ui": {"text": [msg]}, "result": (str(out), audio)}


def _srt(meta: list[dict], total: float) -> str:
    def ts(t):
        return f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(round(t % 1 * 1000)) % 1000:03d}"
    rows = []
    for i, m in enumerate(meta):
        end = min(m["t"] + max(1.8, m["dur"] + 0.6), meta[i + 1]["t"] - 0.05 if i + 1 < len(meta) else total)
        rows.append(f"{i + 1}\n{ts(m['t'])} --> {ts(end)}\n{m['text']}\n")
    return "\n".join(rows)


# ── upscale (local GPU, streaming so long clips fit in RAM) ───────────────────────────────────────────────────
class UpscaleVideo:
    """Upscales an approved clip to the target height, a few frames at a time. With an upscale model (e.g.
    RealESRGAN_x2) it uses your GPU; without one it falls back to a clean Lanczos resize (free, instant)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "video_path": ("STRING", {"forceInput": True}),
            "target_height": ("INT", {"default": 1080, "min": 480, "max": 2160, "step": 8}),
            "chunk_frames": ("INT", {"default": 8, "min": 1, "max": 64}),
            "filename_prefix": ("STRING", {"default": "kidstudio/final/shot"}),
        }, "optional": {"upscale_model": ("UPSCALE_MODEL",)}}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("video_path",)
    FUNCTION = "run"
    CATEGORY = "Kid Studio"
    OUTPUT_NODE = True

    def run(self, video_path, target_height, chunk_frames, filename_prefix, upscale_model=None):
        import numpy as np
        ff = core.ffmpeg_exe()
        src = Path(video_path)
        w, h = _size(video_path)
        th = target_height
        tw = int(round(w * th / h / 8) * 8)          # 854x480 -> 1920x1080, not 1922
        out = core.next_path(filename_prefix, ".mp4")
        if upscale_model is None:
            subprocess.run([ff, "-v", "error", "-y", "-i", str(src), "-vf", f"scale={tw}:{th}:flags=lanczos,setsar=1",
                            "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "copy", str(out)], check=True)
            return {"ui": {"text": [f"Lanczos {w}x{h} -> {tw}x{th}: {out}"]}, "result": (str(out),)}

        import torch
        import comfy.model_management as mm
        import comfy.utils
        device = mm.get_torch_device()
        upscale_model.to(device)
        reader = subprocess.Popen([ff, "-v", "error", "-i", str(src), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
        tmp = out.with_suffix(".noaudio.mp4")
        writer = subprocess.Popen([ff, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{tw}x{th}", "-r", "24",
                                   "-i", "-", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", str(tmp)],
                                  stdin=subprocess.PIPE)
        frame_bytes = w * h * 3
        try:
            while True:
                buf = reader.stdout.read(frame_bytes * chunk_frames)
                if not buf:
                    break
                n = len(buf) // frame_bytes
                arr = np.frombuffer(buf[: n * frame_bytes], dtype=np.uint8).reshape(n, h, w, 3)
                x = torch.from_numpy(arr.astype("float32") / 255.0).permute(0, 3, 1, 2).to(device)
                with torch.no_grad():
                    y = comfy.utils.tiled_scale(x, lambda a: upscale_model(a), tile_x=512, tile_y=512, overlap=32,
                                                upscale_amount=upscale_model.scale)
                y = torch.nn.functional.interpolate(y, size=(th, tw), mode="bicubic", antialias=True).clamp(0, 1)
                writer.stdin.write((y.permute(0, 2, 3, 1).cpu().numpy() * 255).round().astype(np.uint8).tobytes())
        finally:
            writer.stdin.close()
            writer.wait()
            reader.wait()
            upscale_model.to("cpu")
        subprocess.run([ff, "-v", "error", "-y", "-i", str(tmp), "-i", str(src), "-map", "0:v", "-map", "1:a?", "-c", "copy", str(out)], check=True)
        tmp.unlink(missing_ok=True)
        return {"ui": {"text": [f"Upscaled {w}x{h} -> {tw}x{th}: {out}"]}, "result": (str(out),)}


def _size(path: str) -> tuple[int, int]:
    p = probe_frames(path, "first")
    return p.size


# ── comparison grid (the model test) ─────────────────────────────────────────────────────────────────────────
class CompareGrid:
    """Puts the first take of up to six images side by side with numbers, for picking a model or a take."""

    @classmethod
    def INPUT_TYPES(cls):
        opt = {f"image_{i}": ("IMAGE",) for i in range(1, 7)}
        return {"required": {"labels": ("STRING", {"multiline": True, "default": "1\n2\n3\n4\n5\n6"})}, "optional": opt}

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "run"
    CATEGORY = "Kid Studio"
    OUTPUT_NODE = True

    def run(self, labels, **images):
        from PIL import Image, ImageDraw
        labs = [l.strip() for l in labels.splitlines()]
        tiles = []
        for i in range(1, 7):
            t = images.get(f"image_{i}")
            if t is not None:
                p = core.tensor_to_pils(t)[0]
                p.thumbnail((640, 640))
                tiles.append((labs[i - 1] if i - 1 < len(labs) else str(i), p))
        if not tiles:
            raise ValueError("Connect at least one image.")
        cols = min(3, len(tiles))
        rows = (len(tiles) + cols - 1) // cols
        tw, th = 640, max(p.height for _, p in tiles) + 40
        grid = Image.new("RGB", (cols * tw, rows * th), (30, 30, 30))
        d = ImageDraw.Draw(grid)
        for k, (lab, p) in enumerate(tiles):
            x, y = (k % cols) * tw, (k // cols) * th
            grid.paste(p, (x + (tw - p.width) // 2, y))
            d.text((x + 10, y + th - 30), f"{k + 1}. {lab}", fill=(240, 240, 240))
        return {"ui": core.preview_ui([grid]), "result": (core.pils_to_tensor([grid]),)}


# ── assembly ─────────────────────────────────────────────────────────────────────────────────────────────────
def _has_audio(path: str) -> bool:
    r = subprocess.run([core.ffmpeg_exe(), "-i", path], capture_output=True, text=True)
    return "Audio:" in r.stderr


def _newest(pattern_dir: Path, shot_id: str) -> Path | None:
    files = sorted(pattern_dir.glob(f"{shot_id}_*.mp4"), key=lambda p: p.stat().st_mtime)
    files = [f for f in files if ".noaudio" not in f.name]
    return files[-1] if files else None


class AssembleEpisode:
    """Joins the approved clips in bible order, lays the narration at its times, adds optional music (ducked under
    the voice) and normalises to -14 LUFS. Writes the episode mp4 and its .srt captions."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "bible_path": ("STRING", {"default": "pilot/bible.json"}),
            "voice_dir": ("STRING", {"default": ""}),
            "music_path": ("STRING", {"default": ""}),
            "music_db": ("FLOAT", {"default": -20.0, "min": -40.0, "max": 0.0, "step": 1.0}),
            "ambience_db": ("FLOAT", {"default": -12.0, "min": -60.0, "max": 0.0, "step": 1.0}),
            "width": ("INT", {"default": 1920, "min": 640, "max": 3840, "step": 8}),
            "height": ("INT", {"default": 1080, "min": 360, "max": 2160, "step": 8}),
        }, "optional": {"clip_list": ("STRING", {"multiline": True, "default": ""})}}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("episode_path",)
    FUNCTION = "run"
    CATEGORY = "Kid Studio"
    OUTPUT_NODE = True

    def run(self, bible_path, voice_dir, music_path, music_db, ambience_db, width, height, clip_list=""):
        ff = core.ffmpeg_exe()
        bible = story.load_bible(_bible_path(bible_path))
        slug = bible.get("slug", "episode")
        clips = [c.strip() for c in clip_list.splitlines() if c.strip()]
        if not clips:  # newest final per shot, else newest draft
            final_dir, draft_dir = core.output_dir() / "kidstudio" / "final", core.output_dir() / "kidstudio" / "shots"
            for s in bible["shots"]:
                p = _newest(final_dir, s["id"]) or _newest(draft_dir, s["id"])
                if p is None:
                    raise FileNotFoundError(f"No clip for shot {s['id']} yet (run 04_shot_draft for it).")
                clips.append(str(p))
        work = core.runs_dir() / "assemble" / slug
        work.mkdir(parents=True, exist_ok=True)
        # 1) normalise every clip: same size and fps, trimmed or padded to its bible length; keep its own ambience
        parts = []
        for i, (c, s) in enumerate(zip(clips, bible["shots"])):
            p = work / f"part{i:02d}.mov"
            d = s["seconds"]
            vf = (f"scale={width}:{height}:force_original_aspect_ratio=decrease:flags=lanczos,"
                  f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,fps=24,tpad=stop_mode=clone:stop_duration={d},trim=duration={d},setpts=PTS-STARTPTS")
            if _has_audio(c):
                cmd = [ff, "-v", "error", "-y", "-i", c, "-vf", vf,
                       "-af", f"aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur={d},atrim=duration={d}"]
            else:
                cmd = [ff, "-v", "error", "-y", "-i", c, "-f", "lavfi", "-t", str(d), "-i", "anullsrc=r=48000:cl=stereo",
                       "-vf", vf, "-map", "0:v", "-map", "1:a"]
            subprocess.run(cmd + ["-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p",
                                  "-c:a", "pcm_s16le", "-t", str(d), str(p)], check=True)
            parts.append(p)
        lst = work / "parts.txt"
        lst.write_text("".join(f"file '{p}'\n" for p in parts), encoding="utf-8")
        video = work / "video.mov"
        subprocess.run([ff, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(video)], check=True)
        total = sum(s["seconds"] for s in bible["shots"])
        # 2) audio: narration lines at their times (+ music ducked under them), loudness -14 LUFS
        vdir = Path(voice_dir) if voice_dir.strip() else core.runs_dir() / "voice" / slug
        meta = json.loads((vdir / "lines.json").read_text(encoding="utf-8")) if (vdir / "lines.json").exists() else []
        inputs, filters, labels = [], [], []
        for i, m in enumerate(meta):
            inputs += ["-i", str(vdir / m["file"])]
            ms = int(m["t"] * 1000)
            filters.append(f"[{i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms},apad=whole_dur={total}[v{i}]")
            labels.append(f"[v{i}]")
        graph = ";".join(filters)
        voice_mix = f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0[voice]" if labels else f"anullsrc=r=48000:cl=stereo,atrim=duration={total}[voice]"
        graph = (graph + ";" if graph else "") + voice_mix
        graph += f";[0:a]volume={ambience_db}dB[amb];[voice][amb]amix=inputs=2:normalize=0[voice2]"
        if music_path.strip():
            k = len(meta) + 1
            inputs += ["-stream_loop", "-1", "-i", music_path.strip()]
            graph += (f";[{k}:a]aresample=48000,atrim=duration={total},volume={music_db}dB[mus];[voice2]asplit=2[vo][sc];"
                      f"[mus][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck];"
                      f"[vo][duck]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
        else:
            graph += ";[voice2]loudnorm=I=-14:TP=-1.5:LRA=11[aout]"
        out = core.next_path(f"kidstudio/episodes/{slug}", ".mp4")
        cmd = [ff, "-v", "error", "-y", "-i", str(video), *inputs, "-filter_complex", graph, "-map", "0:v", "-map", "[aout]",
               "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(total), "-movflags", "+faststart", str(out)]
        subprocess.run(cmd, check=True)
        srt = vdir / f"{slug}.srt"
        if srt.exists():
            out.with_suffix(".srt").write_text(srt.read_text(encoding="utf-8"), encoding="utf-8")
        dur = video_duration(str(out))
        return {"ui": {"text": [f"Episode: {out} ({dur:.1f}s, {len(clips)} clips, {len(meta)} lines)"]}, "result": (str(out),)}
