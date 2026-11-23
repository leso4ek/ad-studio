# Kid Studio (parked)

A ComfyUI node pack + workflows for calm children's videos made with OpenRouter video models (Seedance 2.5) and local models (Kokoro narration, Real-ESRGAN upscaling), with a hard budget ledger and a kids' safety lint.

**Status: parked (Nov 2026).** The user moved to code-drawn story ads (see `studio/`). What exists:

- `custom_nodes/kidstudio/`: 16 nodes (OpenRouter image/video, budget, bible → shot prompts, safety lint, elements library, Kokoro narration, upscale, compare grid, assemble). 6 unit tests pass (`python -m pytest tests`).
- `workflows/01…09`: API-format workflows, built by `tools/make_workflows.py`. Mock-tested on CPU ComfyUI (`KIDSTUDIO_MOCK=1`): 09, 01–04 (all 8 pilot shots), 05 (Real-ESRGAN and Lanczos). **Not yet tested: 06 extend, 07 narration, 08 assemble.**
- `pilot/bible.json`: the 76 s pilot "Hazel and the Gentle Night".
- `scripts/install_linux.sh`, `scripts/download_models.sh`, `scripts/run_workflow.py` (queue a workflow on a running ComfyUI).

Ad Studio reuses `scripts/run_workflow.py` and the upscale workflow (05) as its optional ComfyUI fallback for cleaning up product photos.
