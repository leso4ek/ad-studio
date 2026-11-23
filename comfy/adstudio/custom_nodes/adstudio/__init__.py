"""Ad Studio ComfyUI nodes: finishing passes for Seedance takes so shots cut together (the Higgsfield-style consistency
steps that happen after generation). Needs the kidstudio pack in the same ComfyUI for KidStudioUpscaleVideo."""
import os, shutil, subprocess, json
import numpy as np

def _ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return shutil.which('ffmpeg') or 'ffmpeg'

def _probe(path):
    out = subprocess.run([_ffmpeg(), '-i', path], capture_output=True, text=True).stderr
    import re
    m = re.search(r', (\d{2,5})x(\d{2,5})[, ]', out); fps = re.search(r'([\d.]+) fps', out)
    return int(m.group(1)), int(m.group(2)), float(fps.group(1)) if fps else 24.0

# sRGB <-> CIE Lab (D65), vectorised
def _to_lab(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

def _from_lab(lab):
    fy = (lab[..., 0] + 16) / 116; fx = fy + lab[..., 1] / 500; fz = fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1); xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * np.array([0.95047, 1.0, 1.08883])
    Mi = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    c = xyz @ Mi.T; c = np.where(c > 0.0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(c * 255, 0, 255)

class AdStudioColorMatch:
    """Moves a clip's colour statistics (Lab mean and spread) toward a reference image, e.g. the first take you approved,
    so consecutive Seedance shots share one grade. strength 0..1."""
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"video_path": ("STRING", {"default": ""}), "reference_image": ("STRING", {"default": ""}),
                             "strength": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 1.0, "step": 0.05})}}
    RETURN_TYPES = ("STRING",); RETURN_NAMES = ("video_path",); FUNCTION = "run"; CATEGORY = "Ad Studio"
    def run(self, video_path, reference_image, strength):
        from PIL import Image
        w, h, fps = _probe(video_path)
        ref = _to_lab(np.asarray(Image.open(reference_image).convert('RGB').resize((w, h)), dtype=np.float64))
        rm, rs = ref.reshape(-1, 3).mean(0), ref.reshape(-1, 3).std(0) + 1e-6
        raw = subprocess.run([_ffmpeg(), '-v', 'error', '-i', video_path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
        frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(np.float64)
        # one transfer for the whole clip (stats of the clip, not per frame), so it doesn't flicker
        lab_all = _to_lab(frames[:: max(1, len(frames) // 8)]); cm, cs = lab_all.reshape(-1, 3).mean(0), lab_all.reshape(-1, 3).std(0) + 1e-6
        out = os.path.splitext(video_path)[0] + '_cm.mp4'
        p = subprocess.Popen([_ffmpeg(), '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(fps), '-i', '-',
                              '-i', video_path, '-map', '0:v', '-map', '1:a?', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-c:a', 'copy', out], stdin=subprocess.PIPE)
        for f in frames:
            lab = _to_lab(f); t = (lab - cm) / cs * (cs + (rs - cs) * strength) + cm + (rm - cm) * strength
            p.stdin.write(_from_lab(t).astype(np.uint8).tobytes())
        p.stdin.close(); p.wait()
        return {"ui": {"text": [f"colour matched → {out}"]}, "result": (out,)}

class AdStudioSaveTo:
    """Copies a finished file to an absolute path the app chose (so the app knows where the result is)."""
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"path": ("STRING", {"default": ""}), "dest": ("STRING", {"default": ""})}}
    RETURN_TYPES = ("STRING",); FUNCTION = "run"; CATEGORY = "Ad Studio"; OUTPUT_NODE = True
    def run(self, path, dest):
        os.makedirs(os.path.dirname(dest), exist_ok=True); shutil.copyfile(path, dest)
        return {"ui": {"text": [json.dumps({"saved": dest})]}, "result": (dest,)}

NODE_CLASS_MAPPINGS = {"AdStudioColorMatch": AdStudioColorMatch, "AdStudioSaveTo": AdStudioSaveTo}
NODE_DISPLAY_NAME_MAPPINGS = {"AdStudioColorMatch": "Ad Studio · Colour match to reference", "AdStudioSaveTo": "Ad Studio · Save to path"}
