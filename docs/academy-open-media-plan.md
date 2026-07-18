# Academy Open-Source Media Plan (Voice, Image, Video)

Top-level plan for replacing hosted generative media (Google Gemini) in the Salesforce Academy
story mode with a fully open-source, self-hosted stack — and for adding **motion scenes (video)**
so stories feel like short learning films instead of slideshows.

## 1. Goals

1. **Zero per-request vendor cost** — all media generation runs on hardware you control.
2. **No learner data leaves the platform** — narration text and scene prompts stay on your network.
3. **More attractive stories** — every scene can be a short generated motion clip, falling back to
   generated still art, falling back to the built-in animated diagrams.
4. **Never break the Academy** — each media capability is optional and independently degradable.
   With nothing configured, story mode still works exactly as before (diagrams + browser voice).

## 2. Chosen engines and why

| Capability | Engine | License | Why this one |
|-----------|--------|---------|--------------|
| Voice narration | **Microsoft VibeVoice** (`microsoft/VibeVoice-1.5B`), served by a community OpenAI-compatible server | MIT (code + weights) | The user-requested engine. Frontier long-form expressive TTS; runs on an 8–12 GB GPU; the community standard serving contract is OpenAI's `POST /v1/audio/speech`, which many maintained servers implement (`vibevoice-community/VibeVoice-API`, `ncoder-ai/VibeVoice-FastAPI`, `marhensa/vibevoice-realtime-openai-api` for the 0.5B realtime model on ~2 GB VRAM). Microsoft disabled TTS inference in the primary repo, so a community server is the supported self-host path. |
| Scene images | **FLUX.1 [schnell]** (or SDXL on smaller GPUs) behind a **Stable Diffusion WebUI-compatible REST API** (`POST /sdapi/v1/txt2img`) | FLUX.1-schnell: Apache-2.0 | FLUX.1-schnell is the strongest permissively-licensed open image model and generates in 1–4 steps. The SD-WebUI API is the de-facto open-source image-serving standard — AUTOMATIC1111, Forge, SD.Next, and ComfyUI API wrappers all expose the same endpoint, so the platform is not married to one UI project. |
| Motion scenes (video) | **LTX-Video / LTX-2** running in **ComfyUI** (native support); **Wan 2.2** as the low-VRAM alternative | LTX: Apache-2.0 (incl. licensed training data); Wan 2.2: Apache-2.0 | LTX is the fastest high-quality open video family and is built into ComfyUI core; distilled/quantized variants run on 8–16 GB consumer GPUs. ComfyUI's HTTP API (`POST /prompt` → poll `GET /history/{id}` → `GET /view`) is workflow-based, so the exact model (LTX 2B distilled, LTX-2, Wan 2.2 1.3B/14B) is swappable per deployment via a workflow template file — no code change needed. |

Video really is the stability/attractiveness win: a 3–4 second generated motion clip per scene
(slow camera push, flowing data, characters reacting) reads as a produced learning film, and
because clips are generated per scene from the same art direction, the look stays consistent.

## 3. Architecture (implemented in this change)

```
Learner ──> Web player (video → image → animated diagram; VibeVoice → device voice → captions)
                 │  POST /api/learning/tutor/explainer            (storyboard + capabilities)
                 │  POST /api/learning/tutor/explainer/video      (per scene, 204 = fall back)
                 │  POST /api/learning/tutor/explainer/image      (per scene, 204 = fall back)
                 │  POST /api/learning/tutor/explainer/speech     (per scene + voice, 204 = fall back)
                 ▼
NestJS API ── OpenSourceMediaService
                 ├── VIBEVOICE_BASE_URL   → POST {base}/v1/audio/speech   (OpenAI-compatible, WAV out)
                 ├── SD_WEBUI_BASE_URL    → POST {base}/sdapi/v1/txt2img  (base64 PNG out)
                 └── COMFYUI_BASE_URL     → POST {base}/prompt + poll     (webp/mp4/webm clip out)
                                            workflow from COMFYUI_VIDEO_WORKFLOW template
```

Design rules carried over from the previous provider:

- The **API composes all prompts from the trusted storyboard** — the browser can only name a
  scene, never inject a raw generation prompt.
- Every media call is **cached six hours** per lesson/focus/question/scene (and voice), with
  in-flight deduplication so one popular lesson can't stampede the GPU.
- A missing/failed provider returns **HTTP 204**, which the player treats as "use the next tier".
- Generated visuals carry a "conceptual aid" disclaimer; exact labels stay in app-owned overlays.

## 4. Deployment recipes (self-hosted, all open source)

Voice — VibeVoice (pick one server):

```bash
# Full 1.5B model (best quality, ~8–12 GB VRAM)
git clone https://github.com/vibevoice-community/VibeVoice-API && cd VibeVoice-API
docker compose up -d          # serves POST http://localhost:8000/v1/audio/speech

# Lightweight realtime 0.5B (~2 GB VRAM)
docker run --gpus all -p 8000:8880 ghcr.io/marhensa/vibevoice-realtime-openai-api
```

```env
VIBEVOICE_BASE_URL="http://localhost:8000"
```

Images — FLUX.1-schnell or SDXL behind any SD-WebUI-compatible server:

```bash
# Example: SD WebUI Forge (supports FLUX) with the API enabled
./webui.sh --api --listen    # serves POST http://localhost:7860/sdapi/v1/txt2img
```

```env
SD_WEBUI_BASE_URL="http://localhost:7860"
# Optional: pin a checkpoint, e.g. "flux1-schnell-fp8.safetensors"
SD_IMAGE_MODEL=""
```

Motion scenes — ComfyUI + LTX-Video:

```bash
git clone https://github.com/comfyanonymous/ComfyUI && cd ComfyUI
# Download ltx-video 2B checkpoint + t5xxl text encoder per ComfyUI's LTX-Video guide
python main.py --listen      # serves http://localhost:8188
```

```env
COMFYUI_BASE_URL="http://localhost:8188"
# Optional: point at your own workflow template (Wan 2.2, LTX-2, custom nodes…)
# COMFYUI_VIDEO_WORKFLOW="/opt/comfy/workflows/academy-scene.json"
```

The bundled default workflow targets ComfyUI-core LTX-Video nodes and produces a ~4 s animated
scene. Any placeholder-compatible workflow (`{{PROMPT}}`, `{{NEGATIVE_PROMPT}}`, `{{SEED}}`,
`{{WIDTH}}`, `{{HEIGHT}}`, `{{FRAMES}}`, `{{FPS}}`) can replace it — that is how you switch to
Wan 2.2 or LTX-2 without touching application code.

### GPU sizing

| Tier | Hardware | What it enables |
|------|----------|-----------------|
| Minimum | 1× 8 GB GPU | VibeVoice-Realtime 0.5B + SDXL images (skip video) |
| Recommended | 1× 16–24 GB GPU | VibeVoice-1.5B + FLUX.1-schnell + LTX-Video distilled clips |
| Comfortable | 2 GPUs (split voice vs. image/video) | Parallel narration + visuals, faster first-scene time |
| None | CPU only | Ship it anyway: diagrams + device voices keep working |

## 5. Phased rollout

- **Phase 0 (done)** — deterministic fallbacks (animated diagrams, browser speech) are the
  permanent safety net; nothing below is load-bearing.
- **Phase 1 — Voice (this change)**: VibeVoice narration with six curated voices, selectable in
  the player; browser voices remain the fallback tier.
- **Phase 2 — Still art (this change)**: FLUX/SDXL scene art via the SD-WebUI API with the same
  prompt-composition and caching rules as before.
- **Phase 3 — Motion scenes (this change)**: ComfyUI/LTX clips per scene; player prefers motion,
  then still art, then diagrams. Next scene's media preloads while the current one narrates.
- **Phase 4 — Ops hardening (follow-up)**: shared Redis media cache across API instances,
  pre-warming the first scene of assigned lessons overnight, per-org generation quotas, and an
  admin toggle in the UI (env flags exist today).

## 6. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| GPU box offline / slow | Per-capability timeouts → 204 → next tier; the story never stalls on media. |
| ComfyUI workflow drift across versions | Workflow lives in a replaceable template file; poller accepts any webp/gif/mp4/webm output node. |
| VibeVoice misuse concerns (voice cloning) | Only ship the six stock demo voices; no learner-supplied reference audio path is exposed. |
| Diffusion models render gibberish text | Negative prompts forbid text/logos/UI; all real labels are app-owned overlays on top of the media. |
| Long video generation time | Clips are short (~4 s), cached 6 h, deduplicated, and loaded lazily scene-by-scene with preload. |
