// Ad Studio · engine "comfy" (optional fallback): cleans up a product photo the user supplies, on their own ComfyUI.
// Uploads the image, queues an API-format workflow (LoadImage → upscale model → SaveImage, the same graph as
// comfy/kidstudio/workflows/05 without the video parts) and downloads the result. No generation, only upscaling.
// Fallback "pillow": a Lanczos resize with the library's Python. Used by POST /api/ads/:slug/photo.
import fs from 'fs';
import path from 'path';
import { run, sleep } from '../util.mjs';

export async function available(cfg) {
  try { const r = await fetch(`${cfg.comfy.url}/system_stats`, { signal: AbortSignal.timeout(2500) }); return r.ok ? { ok: true, detail: cfg.comfy.url } : { ok: false, why: `status ${r.status}` }; }
  catch { return { ok: false, why: `no ComfyUI at ${cfg.comfy.url}` }; }
}

export async function upscale(cfg, src, out) {
  const fd = new FormData(); fd.append('image', new Blob([fs.readFileSync(src)]), path.basename(src)); fd.append('overwrite', 'true');
  const up = await (await fetch(`${cfg.comfy.url}/upload/image`, { method: 'POST', body: fd })).json();
  const wf = {
    1: { class_type: 'LoadImage', inputs: { image: up.name } },
    2: { class_type: 'UpscaleModelLoader', inputs: { model_name: cfg.comfy.upscaleModel || 'RealESRGAN_x2plus.pth' } },
    3: { class_type: 'ImageUpscaleWithModel', inputs: { upscale_model: ['2', 0], image: ['1', 0] } },
    4: { class_type: 'SaveImage', inputs: { images: ['3', 0], filename_prefix: 'adstudio/photo' } },
  };
  const q = await (await fetch(`${cfg.comfy.url}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: wf }) })).json();
  if (!q.prompt_id) throw new Error(`ComfyUI refused the workflow: ${JSON.stringify(q).slice(0, 300)}`);
  for (let i = 0; i < 600; i++) {
    const h = await (await fetch(`${cfg.comfy.url}/history/${q.prompt_id}`)).json();
    const item = h[q.prompt_id];
    if (item?.status?.status_str === 'error') throw new Error('ComfyUI workflow failed');
    const img = item?.outputs?.['4']?.images?.[0];
    if (img) { const r = await fetch(`${cfg.comfy.url}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`); fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); return out; }
    await sleep(1000);
  }
  throw new Error('ComfyUI timed out');
}

export async function pillow(cfg, src, out, maxSide = 2048) {
  const code = `import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert('RGBA')\ns=${maxSide}/max(im.size)\nim=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)\nim.save(sys.argv[2])`;
  const r = await run(path.join(cfg.lib, '.venv', 'bin', 'python'), ['-I', '-c', code, src, out]);
  if (r.code !== 0) throw new Error(`resize failed: ${r.err.slice(-300)}`);
  return out;
}
