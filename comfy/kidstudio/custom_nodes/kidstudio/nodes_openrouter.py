"""OpenRouter image and video nodes (Seedance 2.5 via POST /api/v1/videos, images via POST /api/v1/images)."""
from __future__ import annotations

import base64
import io
import json
import subprocess
import time
from pathlib import Path

from . import core

VIDEO_MODELS = ["bytedance/seedance-2.5-flash", "bytedance/seedance-2.5"]
IMAGE_MODELS = ["bytedance-seed/seedream-5-5", "google/gemini-nano-banana-2.1", "openai/gpt-image-2.6-flare",
                "black-forest-labs/flux-3-image", "qwen/qwen-image-3", "recraft/recraft-v4.1", "(custom)"]
ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]


# ── video file helpers ─────────────────────────────────────────────────────────────────────────────────────────
def probe_frames(path: str, which: str = "last"):
    """Return one frame of a video as a PIL image ('first', 'middle' or 'last')."""
    from PIL import Image
    ff = core.ffmpeg_exe()
    if which == "first":
        args = [ff, "-v", "error", "-i", path, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]
    elif which == "middle":
        dur = video_duration(path)
        args = [ff, "-v", "error", "-ss", f"{dur / 2:.3f}", "-i", path, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]
    else:
        args = [ff, "-v", "error", "-sseof", "-0.25", "-i", path, "-update", "1", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]
    out = subprocess.run(args, capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(out)).convert("RGB")


def video_duration(path: str) -> float:
    ff = core.ffmpeg_exe()
    r = subprocess.run([ff, "-i", path], capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if "Duration:" in line:
            h, m, s = line.split("Duration:")[1].split(",")[0].strip().split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    return 0.0


def make_mock_video(path: Path, w: int, h: int, seconds: int, label: str) -> None:
    """A free stand-in clip (soft colour gradient + the label) so workflows can be tested without spending."""
    ff = core.ffmpeg_exe()
    txt = label.replace(":", " ").replace("'", "")[:60]
    vf = f"drawbox=x=0:y=0:w=iw:h=ih:color=0x2a3b5c@1:t=fill,drawbox=x='mod(t*80,iw)':y=ih/3:w=iw/6:h=ih/3:color=0xf2c46b@1:t=fill"
    subprocess.run([ff, "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=0x2a3b5c:s={w}x{h}:r=24:d={seconds}",
                    "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", str(path)], check=True)
    (path.with_suffix(".txt")).write_text(label, encoding="utf-8")


# ── image node ───────────────────────────────────────────────────────────────────────────────────────────────
class OpenRouterImage:
    """Generate images through OpenRouter's Image API, with optional reference images (elements)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt": ("STRING", {"multiline": True, "default": ""}),
                "model": (IMAGE_MODELS, {"default": IMAGE_MODELS[0]}),
                "aspect_ratio": (["16:9", "1:1", "9:16", "4:3", "3:4", "3:2", "2:3"], {"default": "16:9"}),
                "n": ("INT", {"default": 4, "min": 1, "max": 4}),
                "resolution": (["1K", "2K"], {"default": "1K"}),
            },
            "optional": {
                "reference_images": ("IMAGE",),
                "custom_model": ("STRING", {"default": ""}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 2**31 - 1, "control_after_generate": True}),
            },
        }

    RETURN_TYPES = ("IMAGE", "FLOAT")
    RETURN_NAMES = ("images", "cost_usd")
    FUNCTION = "run"
    CATEGORY = "Kid Studio"
    OUTPUT_NODE = True

    def run(self, prompt, model, aspect_ratio, n, resolution, reference_images=None, custom_model="", seed=0):
        from PIL import Image
        if model == "(custom)":
            model = custom_model.strip()
            if not model:
                raise ValueError("Pick a model or type one in custom_model (an OpenRouter image model id).")
        refs = core.tensor_to_pils(reference_images)
        est = core.estimate_image(model, n, len(refs))
        budget = core.Budget.default()
        budget.charge_guard(est, f"image {model}")
        print(f"[Kid Studio] image: {model} x{n}, {len(refs)} refs, about ${est:.2f}")

        if core.mock_mode():
            w, h = {"16:9": (1024, 576), "9:16": (576, 1024), "1:1": (768, 768)}.get(aspect_ratio, (896, 672))
            pils = [Image.new("RGB", (w, h), (90 + 30 * i, 120, 160)) for i in range(n)]
            budget.log({"kind": "image", "model": model, "estimate": est, "cost": 0, "status": "completed"})
            return {"ui": core.preview_ui(pils), "result": (core.pils_to_tensor(pils), 0.0)}

        allowed = core.image_model_params(model)
        body = {"model": model, "prompt": prompt}
        for k, v in (("aspect_ratio", aspect_ratio), ("n", n), ("resolution", resolution), ("seed", seed)):
            if k in allowed:
                body[k] = v
        if refs:
            if "input_references" not in allowed:
                raise ValueError(f"{model} does not take reference images; pick another model or remove the references.")
            body["input_references"] = [{"type": "image_url", "image_url": {"url": core.pil_to_data_url(p)}} for p in refs]
        r = core.request("POST", "/images", json_body=body, timeout=600).json()
        pils = []
        for item in r.get("data", []):
            if item.get("b64_json"):
                pils.append(Image.open(io.BytesIO(base64.b64decode(item["b64_json"]))).convert("RGB"))
            elif item.get("url"):
                pils.append(Image.open(io.BytesIO(core.request("GET", item["url"], timeout=120).content)).convert("RGB"))
        cost = float((r.get("usage") or {}).get("cost", est))
        budget.log({"kind": "image", "model": model, "estimate": est, "cost": cost, "status": "completed", "n": len(pils)})
        if not pils:
            raise RuntimeError(f"OpenRouter returned no image: {json.dumps(r)[:300]}")
        return {"ui": core.preview_ui(pils), "result": (core.pils_to_tensor(pils), cost)}


# ── video node ───────────────────────────────────────────────────────────────────────────────────────────────
class OpenRouterVideo:
    """Seedance 2.5 (or 2.5 Flash) through OpenRouter: submit, poll, download, log the real cost."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt": ("STRING", {"multiline": True, "default": ""}),
                "model": (VIDEO_MODELS, {"default": VIDEO_MODELS[0]}),
                "seconds": ("INT", {"default": 8, "min": 4, "max": 30}),
                "resolution": (["480p", "720p", "1080p"], {"default": "480p"}),
                "aspect_ratio": (ASPECTS, {"default": "16:9"}),
                "generate_audio": ("BOOLEAN", {"default": True}),
                "filename_prefix": ("STRING", {"default": "kidstudio/shots/shot"}),
                "estimate_only": ("BOOLEAN", {"default": False}),
            },
            "optional": {
                "reference_images": ("IMAGE",),
                "first_frame": ("IMAGE",),
                "last_frame": ("IMAGE",),
                "reference_video_path": ("STRING", {"default": ""}),
                "reference_audio_path": ("STRING", {"default": ""}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 2**31 - 1, "control_after_generate": True}),
            },
        }

    RETURN_TYPES = ("STRING", "IMAGE", "FLOAT", "STRING")
    RETURN_NAMES = ("video_path", "last_frame", "cost_usd", "job_id")
    FUNCTION = "run"
    CATEGORY = "Kid Studio"
    OUTPUT_NODE = True

    def run(self, prompt, model, seconds, resolution, aspect_ratio, generate_audio, filename_prefix, estimate_only,
            reference_images=None, first_frame=None, last_frame=None, reference_video_path="", reference_audio_path="", seed=0):
        if model.endswith("flash") and resolution == "1080p":
            raise ValueError("Seedance 2.5 Flash goes up to 720p; use 480p/720p or the full model for 1080p.")
        w, h = core.video_size(aspect_ratio, resolution)
        est = core.estimate_video(model, aspect_ratio, resolution, seconds)
        print(f"[Kid Studio] video: {model} {seconds}s {w}x{h}, about ${est:.2f}")
        if estimate_only:
            from PIL import Image
            blank = Image.new("RGB", (w, h), (40, 40, 40))
            return {"ui": {"text": [f"Estimate only: about ${est:.2f}"]}, "result": ("", core.pils_to_tensor([blank]), est, "")}

        budget = core.Budget.default()
        budget.charge_guard(est, f"video {model} {seconds}s {resolution}")
        out = core.next_path(filename_prefix, ".mp4")

        if core.mock_mode():
            make_mock_video(out, w, h, seconds, prompt[:80] or "mock")
            budget.log({"kind": "video", "model": model, "estimate": est, "cost": 0, "status": "completed", "file": str(out)})
            last = probe_frames(str(out), "last")
            return {"ui": core.preview_ui([probe_frames(str(out), "first"), last]),
                    "result": (str(out), core.pils_to_tensor([last]), 0.0, "mock")}

        body = {"model": model, "prompt": prompt, "duration": seconds, "resolution": resolution,
                "aspect_ratio": aspect_ratio, "generate_audio": bool(generate_audio), "seed": int(seed)}
        frames = []
        for img, kind in ((first_frame, "first_frame"), (last_frame, "last_frame")):
            pils = [] if core.is_placeholder(img) else core.tensor_to_pils(img)
            if pils:
                frames.append({"type": "image_url", "image_url": {"url": core.pil_to_data_url(pils[0])}, "frame_type": kind})
        if frames:
            body["frame_images"] = frames
        ref_pils = [] if core.is_placeholder(reference_images) else core.tensor_to_pils(reference_images)[:4]
        refs = [{"type": "image_url", "image_url": {"url": core.pil_to_data_url(p, max_side=1280)}} for p in ref_pils]
        if reference_video_path.strip():
            refs.append({"type": "video_url", "video_url": {"url": core.file_to_data_url(reference_video_path.strip())}})
        if reference_audio_path.strip():
            refs.append({"type": "audio_url", "audio_url": {"url": core.file_to_data_url(reference_audio_path.strip())}})
        if refs:
            body["input_references"] = refs

        job = core.request("POST", "/videos", json_body=body, timeout=300).json()
        job_id = job.get("id", "")
        budget.log({"kind": "video", "model": model, "estimate": est, "status": "submitted", "job_id": job_id,
                    "seconds": seconds, "resolution": resolution, "prompt_head": prompt[:120]})
        print(f"[Kid Studio] submitted job {job_id}; polling...")
        t0, wait, status = time.time(), 5, {}
        while True:
            time.sleep(wait)
            status = core.request("GET", f"/videos/{job_id}", timeout=60).json()
            st = status.get("status")
            if st in ("completed", "failed", "cancelled", "expired"):
                break
            if time.time() - t0 > 60 * 45:
                raise RuntimeError(f"Kid Studio: job {job_id} still '{st}' after 45 minutes; check it on openrouter.ai")
            wait = min(30, wait + 5)
        if status.get("status") != "completed":
            budget.update(job_id, status="failed_free" if status.get("status") == "failed" else status.get("status"))
            raise RuntimeError(f"Kid Studio: job {job_id} {status.get('status')}: {status.get('error')}")
        content = core.request("GET", f"/videos/{job_id}/content", timeout=600).content
        out.write_bytes(content)
        cost = float((status.get("usage") or {}).get("cost", est))
        budget.update(job_id, status="completed", cost=cost, file=str(out))
        (out.with_suffix(".json")).write_text(json.dumps({"job_id": job_id, "model": model, "seconds": seconds,
                                                          "resolution": resolution, "aspect_ratio": aspect_ratio,
                                                          "seed": seed, "cost": cost, "prompt": prompt}, indent=1), encoding="utf-8")
        print(f"[Kid Studio] done: {out} (${cost:.2f}); ledger total ${budget.spent():.2f} of ${core.budget_usd():.2f}")
        last = probe_frames(str(out), "last")
        return {"ui": core.preview_ui([probe_frames(str(out), "first"), probe_frames(str(out), "middle"), last]),
                "result": (str(out), core.pils_to_tensor([last]), cost, job_id)}


class BudgetStatus:
    """Shows what has been spent so far against the cap (reads the ledger; costs nothing)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"refresh": ("INT", {"default": 0, "min": 0, "max": 1_000_000, "control_after_generate": True})}}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("summary",)
    FUNCTION = "run"
    CATEGORY = "Kid Studio"
    OUTPUT_NODE = True

    def run(self, refresh):
        b = core.Budget.default()
        rows = [e for e in b.entries() if not e.get("mock")]
        txt = (f"Spent ${b.spent():.2f} of ${core.budget_usd():.2f} cap; {len(rows)} paid calls"
               + (" (mock mode on: nothing is charged)" if core.mock_mode() else ""))
        return {"ui": {"text": [txt]}, "result": (txt,)}


class PickClip:
    """Finds a generated take by shot id and take number (output/kidstudio/shots/<shot>_0000N.mp4)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"shot_id": ("STRING", {"default": "s01"}),
                             "take": ("INT", {"default": 1, "min": 1, "max": 999}),
                             "folder": (["shots", "final"], {"default": "shots"})}}

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("video_path", "final_prefix")
    FUNCTION = "run"
    CATEGORY = "Kid Studio"

    def run(self, shot_id, take, folder):
        p = core.output_dir() / "kidstudio" / folder / f"{shot_id.strip()}_{take:05d}.mp4"
        if not p.exists():
            have = sorted(x.name for x in p.parent.glob(f"{shot_id.strip()}_*.mp4"))
            raise FileNotFoundError(f"No take {take} for {shot_id} in {folder}. Takes there: {', '.join(have) or 'none'}")
        return (str(p), f"kidstudio/final/{shot_id.strip()}")
