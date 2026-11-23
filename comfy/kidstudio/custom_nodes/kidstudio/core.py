"""Kid Studio core: settings, the budget ledger, OpenRouter HTTP, cost estimates, mock mode, image helpers.

Everything that spends money goes through `Budget.charge_guard()` first: a call that would push the total
past KIDSTUDIO_BUDGET_USD is refused before anything is sent.
"""
from __future__ import annotations

import base64
import io
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path

NODE_DIR = Path(__file__).resolve().parent
PACK_DIR = NODE_DIR.parent.parent                     # comfy/kidstudio (the node folder is symlinked into ComfyUI)
API = "https://openrouter.ai/api/v1"


def _load_env() -> None:
    """Read PACK_DIR/.env (KEY=VALUE lines) without overriding variables that are already set."""
    env = PACK_DIR / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()


def setting(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def mock_mode() -> bool:
    return setting("KIDSTUDIO_MOCK", "0").lower() in ("1", "true", "yes")


def budget_usd() -> float:
    return float(setting("KIDSTUDIO_BUDGET_USD", "25"))


def runs_dir() -> Path:
    d = Path(setting("KIDSTUDIO_RUNS", str(PACK_DIR / "runs")))
    d.mkdir(parents=True, exist_ok=True)
    return d


# ── the ledger: one JSON line per paid call ────────────────────────────────────────────────────────────────
class BudgetError(RuntimeError):
    pass


@dataclass
class Budget:
    path: Path

    @classmethod
    def default(cls) -> "Budget":
        return cls(runs_dir() / "ledger.jsonl")

    def entries(self) -> list[dict]:
        if not self.path.exists():
            return []
        out = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
        return out

    def spent(self) -> float:
        """Real cost where known, the estimate for calls still running or with no reported cost; mock calls are free."""
        total = 0.0
        for e in self.entries():
            if e.get("mock") or e.get("status") in ("refused", "failed_free"):
                continue
            total += float(e["cost"]) if e.get("cost") is not None else float(e.get("estimate", 0))
        return round(total, 4)

    def charge_guard(self, estimate: float, what: str) -> None:
        if mock_mode():
            return
        cap, spent = budget_usd(), self.spent()
        if spent + estimate > cap + 1e-9:
            self.log({"kind": what, "estimate": estimate, "status": "refused", "note": f"cap {cap}, spent {spent}"})
            raise BudgetError(f"Kid Studio budget: {what} would cost about ${estimate:.2f}; ${spent:.2f} of ${cap:.2f} "
                              f"is already spent. Raise KIDSTUDIO_BUDGET_USD in .env if you mean to spend more.")

    def log(self, entry: dict) -> None:
        entry = {"time": time.strftime("%Y-%m-%d %H:%M:%S"), "mock": mock_mode(), **entry}
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")

    def update(self, job_id: str, **fields) -> None:
        """Rewrite the entry of one job (status, real cost)."""
        rows = self.entries()
        for r in rows:
            if r.get("job_id") == job_id:
                r.update(fields)
        self.path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")


# ── cost estimates (from OpenRouter's published pricing, Nov 2026; the ledger stores the real cost afterwards) ──
# Seedance bills video tokens: width x height x 24 fps x seconds / 1024, times the per-token price.
VIDEO_TOKEN_PRICE = {
    "bytedance/seedance-2.5": {"default": 10.7e-6, "1080p": 11.7e-6},
    "bytedance/seedance-2.5-flash": {"default": 7.0e-6},
}
SIZES = {  # aspect -> resolution -> WxH, from OpenRouter's supported_sizes for Seedance 2.5
    "16:9": {"480p": (854, 480), "720p": (1280, 720), "1080p": (1920, 1080)},
    "9:16": {"480p": (480, 854), "720p": (720, 1280), "1080p": (1080, 1920)},
    "1:1": {"480p": (640, 640), "720p": (960, 960), "1080p": (1080, 1080)},
    "4:3": {"480p": (752, 560), "720p": (1112, 834), "1080p": (1440, 1080)},
    "3:4": {"480p": (560, 752), "720p": (834, 1112), "1080p": (1080, 1440)},
    "21:9": {"480p": (992, 432), "720p": (1470, 630), "1080p": (2520, 1080)},
}
IMAGE_PRICE = {  # USD per output image (+ per reference image where billed); token-billed models use a cautious guess
    "bytedance-seed/seedream-5-5": (0.02, 0.008),
    "qwen/qwen-image-3": (0.03, 0.003),
    "recraft/recraft-v4.1": (0.035, 0.0),
    "black-forest-labs/flux-3-image": (0.048, 0.0),
    "google/gemini-nano-banana-2.1": (0.05, 0.0),
    "openai/gpt-image-2.6-flare": (0.08, 0.01),
    "openai/gpt-image-2.6-sunburst": (0.08, 0.01),
}


def video_size(aspect: str, resolution: str) -> tuple[int, int]:
    return SIZES[aspect][resolution]


def estimate_video(model: str, aspect: str, resolution: str, seconds: int) -> float:
    w, h = video_size(aspect, resolution)
    prices = VIDEO_TOKEN_PRICE.get(model, {"default": 11.7e-6})
    rate = prices.get(resolution, prices["default"])
    return round(w * h * 24 * seconds / 1024 * rate, 4)


def estimate_image(model: str, n: int, n_refs: int) -> float:
    per, per_ref = IMAGE_PRICE.get(model, (0.10, 0.01))
    return round(n * per + n_refs * per_ref, 4)


# ── HTTP ───────────────────────────────────────────────────────────────────────────────────────────────────────
def _session():
    import requests
    s = requests.Session()
    key = setting("OPENROUTER_API_KEY")
    if not key and not mock_mode():
        raise RuntimeError("OPENROUTER_API_KEY is not set. Put it in comfy/kidstudio/.env (never paste keys in a chat).")
    s.headers.update({"Authorization": f"Bearer {key}", "HTTP-Referer": "https://localhost/kidstudio", "X-Title": "Kid Studio"})
    return s


def request(method: str, path: str, *, json_body=None, stream=False, timeout=120, retries=4):
    """OpenRouter call with backoff on 429/5xx; raises with the API's own error message."""
    s = _session()
    url = path if path.startswith("http") else API + path
    for attempt in range(retries + 1):
        r = s.request(method, url, json=json_body, stream=stream, timeout=timeout)
        if r.status_code in (429, 500, 502, 503, 504) and attempt < retries:
            time.sleep(min(60, 2 ** attempt * 3))
            continue
        if r.status_code >= 400:
            try:
                msg = r.json().get("error", {}).get("message", r.text[:300])
            except Exception:
                msg = r.text[:300]
            raise RuntimeError(f"OpenRouter {r.status_code} on {method} {path}: {msg}")
        return r
    raise RuntimeError(f"OpenRouter: gave up after {retries} retries on {path}")


_endpoint_cache: dict[str, dict] = {}


def image_model_params(model: str) -> set[str]:
    """The parameters this image model's endpoints accept (so we never send one that gets a 400)."""
    if model in _endpoint_cache:
        return set(_endpoint_cache[model].get("params", []))
    params: set[str] = {"aspect_ratio", "n", "input_references"}
    if not mock_mode():
        try:
            d = request("GET", f"/images/models/{model}/endpoints", timeout=30).json()
            eps = d.get("endpoints", [])
            if eps:
                params = set(eps[0].get("supported_parameters", {}).keys())
        except Exception:
            pass
    _endpoint_cache[model] = {"params": sorted(params)}
    return params


# ── images <-> tensors / data URLs ───────────────────────────────────────────────────────────────────────────
def tensor_to_pils(images) -> list:
    """ComfyUI IMAGE (B,H,W,C float 0..1) -> list of PIL images."""
    import numpy as np
    from PIL import Image
    if images is None:
        return []
    arr = (images.detach().cpu().numpy().clip(0, 1) * 255).astype("uint8")
    return [Image.fromarray(a) for a in arr]


def pils_to_tensor(pils: list, size: tuple[int, int] | None = None):
    """List of PIL images -> ComfyUI IMAGE batch; letterboxed to one size so they can share a batch."""
    import numpy as np
    import torch
    from PIL import Image
    if not pils:
        return torch.zeros((1, 64, 64, 3))
    if size is None:
        size = pils[0].size
    out = []
    for p in pils:
        p = p.convert("RGB")
        if p.size != size:
            canvas = Image.new("RGB", size, (128, 128, 128))
            q = p.copy()
            q.thumbnail(size)
            canvas.paste(q, ((size[0] - q.width) // 2, (size[1] - q.height) // 2))
            p = canvas
        out.append(np.asarray(p, dtype="float32") / 255.0)
    return torch.from_numpy(np.stack(out))


def is_placeholder(images) -> bool:
    """True for no image, or the 64x64 blank that LoadElements returns when a shot has no references."""
    return images is None or (images.shape[1] <= 64 and images.shape[2] <= 64)


def pil_to_data_url(p, fmt: str = "JPEG", max_side: int = 1536) -> str:
    p = p.convert("RGB")
    if max(p.size) > max_side:
        p = p.copy()
        p.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    p.save(buf, format=fmt, quality=92)
    mime = "image/jpeg" if fmt == "JPEG" else "image/png"
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode()


def file_to_data_url(path: str) -> str:
    ext = Path(path).suffix.lower()
    mime = {".mp4": "video/mp4", ".mov": "video/quicktime", ".wav": "audio/wav", ".mp3": "audio/mpeg",
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(ext, "application/octet-stream")
    return f"data:{mime};base64," + base64.b64encode(Path(path).read_bytes()).decode()


def ffmpeg_exe() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def output_dir() -> Path:
    try:
        import folder_paths  # ComfyUI
        return Path(folder_paths.get_output_directory())
    except Exception:
        d = runs_dir() / "output"
        d.mkdir(parents=True, exist_ok=True)
        return d


def temp_dir() -> Path:
    try:
        import folder_paths
        return Path(folder_paths.get_temp_directory())
    except Exception:
        d = runs_dir() / "temp"
        d.mkdir(parents=True, exist_ok=True)
        return d


def next_path(prefix: str, ext: str) -> Path:
    """output/<prefix>_00001.ext, never overwriting."""
    base = output_dir() / prefix
    base.parent.mkdir(parents=True, exist_ok=True)
    i = 1
    while True:
        p = Path(f"{base}_{i:05d}{ext}")
        if not p.exists():
            return p
        i += 1


def preview_ui(pils: list, prefix: str = "kidstudio_preview") -> dict:
    """Save small previews into ComfyUI's temp folder and return the node's ui payload."""
    items = []
    tdir = temp_dir()
    for i, p in enumerate(pils):
        name = f"{prefix}_{int(time.time() * 1000)}_{i}.png"
        q = p.copy()
        q.thumbnail((768, 768))
        q.save(tdir / name)
        items.append({"filename": name, "subfolder": "", "type": "temp"})
    return {"images": items}
