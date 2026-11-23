"""Kid Studio: ComfyUI nodes for gentle children's videos with Seedance 2.5 via OpenRouter and local helpers."""
from .nodes_media import AssembleEpisode, CompareGrid, FrameFromVideo, Narration, UpscaleVideo
from .nodes_openrouter import BudgetStatus, OpenRouterImage, OpenRouterVideo, PickClip
from .nodes_story import (ElementFromBible, ElementPrompt, LoadElements, ManualShotPrompt, SafetyLint, SaveElement,
                          ShotFromBible)

_NODES = {
    "KidStudioOpenRouterImage": (OpenRouterImage, "Kid Studio · OpenRouter Image"),
    "KidStudioOpenRouterVideo": (OpenRouterVideo, "Kid Studio · Seedance Video (OpenRouter)"),
    "KidStudioBudget": (BudgetStatus, "Kid Studio · Budget"),
    "KidStudioPickClip": (PickClip, "Kid Studio · Pick Clip"),
    "KidStudioShotFromBible": (ShotFromBible, "Kid Studio · Shot Prompt from Bible"),
    "KidStudioManualShot": (ManualShotPrompt, "Kid Studio · Shot Prompt (manual)"),
    "KidStudioElementPrompt": (ElementPrompt, "Kid Studio · Element Prompt"),
    "KidStudioElementFromBible": (ElementFromBible, "Kid Studio · Element Prompt from Bible"),
    "KidStudioSafetyLint": (SafetyLint, "Kid Studio · Kids Safety Check"),
    "KidStudioLoadElements": (LoadElements, "Kid Studio · Load Elements"),
    "KidStudioSaveElement": (SaveElement, "Kid Studio · Save Element"),
    "KidStudioFrameFromVideo": (FrameFromVideo, "Kid Studio · Frame from Video"),
    "KidStudioNarration": (Narration, "Kid Studio · Narration (Kokoro, local)"),
    "KidStudioUpscaleVideo": (UpscaleVideo, "Kid Studio · Upscale Video (local)"),
    "KidStudioCompareGrid": (CompareGrid, "Kid Studio · Compare Grid"),
    "KidStudioAssemble": (AssembleEpisode, "Kid Studio · Assemble Episode"),
}
NODE_CLASS_MAPPINGS = {k: v[0] for k, v in _NODES.items()}
NODE_DISPLAY_NAME_MAPPINGS = {k: v[1] for k, v in _NODES.items()}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
