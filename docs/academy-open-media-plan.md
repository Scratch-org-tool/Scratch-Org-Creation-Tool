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

Every tier supports **two open-source backends** and automatically uses whichever is configured —
a hosted **Hugging Face Space** (zero infrastructure; the default) or a **self-hosted server**:

| Capability | Hosted Space (default) | Self-hosted alternative | License | Why |
|-----------|------------------------|------------------------|---------|-----|
| Voice narration | **Qwen3-TTS Space** (`QWEN_TTS_SPACE_URL`, Gradio `/generate_custom_voice`) — teaching-style `instruct` per scene delivery | Legacy VibeVoice Space (`VIBEVOICE_SPACE_URL`) or OpenAI-compatible VibeVoice server (`VIBEVOICE_BASE_URL`, `POST /v1/audio/speech`) | Qwen3-TTS: Apache-2.0; VibeVoice: MIT | Qwen3-TTS supports expressive instruct-driven narration (mentor tone, not read-aloud) with stock speakers (Serena, Ryan, Dylan, …). VibeVoice remains a fallback when Qwen is not configured. |
| Scene images | **Z-Image-Turbo Space** (`ZIMAGE_SPACE_URL`, Gradio `/generate_image`) | FLUX.1-schnell / SDXL behind an SD-WebUI-compatible API (`SD_WEBUI_BASE_URL`, `POST /sdapi/v1/txt2img`) | Z-Image: Apache-2.0; FLUX.1-schnell: Apache-2.0 | Z-Image-Turbo (Tongyi) generates strong 1280×720 scene art in ~9 steps / ~10 s on the free Space. Self-host path keeps the de-facto SD-WebUI REST standard. |
| Motion scenes (video) | **Wan555 I2V Space** (`WAN_VIDEO_SPACE_URL`, Gradio `/generate_video`) — animates the generated scene still (image-to-video, 4–8 steps) | LTX-Video / Wan 2.2 in ComfyUI (`COMFYUI_BASE_URL`, workflow template) | Wan 2.2: Apache-2.0; LTX: Apache-2.0 | Image-to-video keeps every clip visually consistent with the still-art tier and needs no text-to-video prompt fidelity. ComfyUI remains the fully-controlled option. |

Set `HF_TOKEN` (a free Hugging Face account token) when using Spaces: public **ZeroGPU** Spaces
strictly limit anonymous GPU time, and long jobs (voice, video) are typically rejected without a
token. Duplicating a Space into your own account is the reliable production option.

Video really is the stability/attractiveness win: a 3–4 second generated motion clip per scene
(slow camera push, flowing data, characters reacting) reads as a produced learning film, and
because clips are generated per scene from the same art direction, the look stays consistent.

## 3. Architecture (implemented in this change)

```
Learner ──> Web player (video → image → animated diagram; Qwen studio voice → device voice → captions)
                 │  POST /api/learning/tutor/explainer            (storyboard + capabilities)
                 │  POST /api/learning/tutor/explainer/video      (per scene, 204 = fall back)
                 │  POST /api/learning/tutor/explainer/image      (per scene, 204 = fall back)
                 │  POST /api/learning/tutor/explainer/speech     (per scene + voice + delivery, 204 = fall back)
                 ▼
NestJS API ── OpenSourceMediaService
                 ├── QWEN_TTS_SPACE_URL    → Gradio /generate_custom_voice (WAV/MP3 out)
                 ├── ZIMAGE_SPACE_URL      → Gradio /generate_image
                 ├── WAN_VIDEO_SPACE_URL   → Gradio /generate_video (I2V)
                 ├── VIBEVOICE_BASE_URL    → POST {base}/v1/audio/speech   (OpenAI-compatible, WAV out)
                 ├── SD_WEBUI_BASE_URL     → POST {base}/sdapi/v1/txt2img  (base64 PNG out)
                 └── COMFYUI_BASE_URL      → POST {base}/prompt + poll     (webp/mp4/webm clip out)
```

Design rules carried over from the previous provider:

- The **API composes all prompts from the trusted storyboard** — the browser can only name a
  scene, never inject a raw generation prompt.
- Every media call is **cached six hours** per lesson/focus/question/scene (and voice), with
  in-flight deduplication so one popular lesson can't stampede the GPU.
- A missing/failed provider returns **HTTP 204**, which the player treats as "use the next tier".
- Generated visuals carry a "conceptual aid" disclaimer; exact labels stay in app-owned overlays.

## 4. Deployment recipes

### Option A — hosted Hugging Face Spaces (no GPU, fastest start)

```env
QWEN_TTS_SPACE_URL="https://qwen-qwen3-tts.hf.space"
QWEN_TTS_SPACE_API="/generate_custom_voice"
ZIMAGE_SPACE_URL="https://mrfakename-z-image-turbo.hf.space"
WAN_VIDEO_SPACE_URL="https://kulkas2pintu-wan555.hf.space"
HF_TOKEN="hf_..."   # free account token; required in practice for voice + video quota
# Optional overrides if your duplicated Space uses different Gradio fn names:
# ZIMAGE_SPACE_API="/generate_image"
# WAN_VIDEO_SPACE_API="/generate_video"
```

Notes:
- Image generation works instantly (~10 s per scene) even anonymously.
- Voice and video run on ZeroGPU queues: expect 30 s–3 min per scene, and add `HF_TOKEN`
  (anonymous callers get "GPU duration larger than the maximum allowed" style rejections).
- For dependable capacity, duplicate each Space into your own HF account (free or upgraded
  hardware) and point the URL at your copy — the API contract stays identical.

### Option B — self-hosted (full control)

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
- **Phase 1 — Voice (this change)**: Qwen3-TTS studio narration with six curated speakers, selectable in
  the player; scene `delivery` maps to teaching-style `instruct`; browser voices remain the fallback tier.
- **Phase 2 — Still art (this change)**: FLUX/SDXL scene art via the SD-WebUI API with the same
  prompt-composition and caching rules as before.
- **Phase 3 — Motion scenes (this change)**: ComfyUI/LTX clips per scene; player prefers motion,
  then still art, then diagrams. Next scene's media preloads while the current one narrates.
- **Phase 4 — Ops hardening (follow-up)**: shared Redis media cache across API instances,
  pre-warming the first scene of assigned lessons overnight, per-org generation quotas, and an
  admin toggle in the UI (env flags exist today).

## 6. Troubleshooting — "voice/images/video are not working"

The player now diagnoses itself: every storyboard response carries `media.status` with one value
per tier — `ready`, `unreachable` (configured but not answering a live probe), or `off` (not
configured) — and the player header shows a matching badge:

| What you see | Meaning | Fix |
|--------------|---------|-----|
| Badge **"Built-in visuals · device voice"**, voice list shows only Microsoft/Apple/Google system voices | No media backend is configured — this is the expected fallback, not a bug | Set `QWEN_TTS_SPACE_URL`, `ZIMAGE_SPACE_URL`, and `WAN_VIDEO_SPACE_URL` (Option A, zero infra) or self-hosted URLs in `apps/api/.env` and restart the API |
| Images work but voice/video fail with quota or "GPU duration" errors in API logs | Public ZeroGPU Spaces reject long anonymous jobs | Set `HF_TOKEN`, or duplicate the Space into your own HF account and point `*_SPACE_URL` at it |
| Amber badge **"Media studio unreachable"** | A URL is configured but the server didn't answer within ~2.5 s | Start the server; verify with `curl -i $VIBEVOICE_BASE_URL/v1/audio/voices`, `curl -i $SD_WEBUI_BASE_URL/sdapi/v1/sd-models`, `curl -i $COMFYUI_BASE_URL/system_stats`; check firewalls/ports |
| Studio voices listed but narration silent / wrong voice | Browser fallback engaged mid-scene (server error) | Check API logs for `[OpenSourceMediaService]` warnings; the picker keeps working with device voices meanwhile |
| Every concept shows identical diagrams | You are on the built-in fallback AND (pre-fix) it used one fixed template | Fixed: fallback visuals now derive icons/colors from each lesson's topic. For unique cinematic scenes per concept, connect the image/video servers |
| Stories read exactly like the lesson text | `NVIDIA_API_KEY` missing/invalid, so the deterministic script is used | Configure NVIDIA NIM (used by the platform copilot) to get AI-directed scripts |

Notes:
- Probes cache for 60 seconds, so a freshly started server appears within a minute (no restart).
- HF Spaces are probed via `GET {space}/gradio_api/info` (more reliable than `GET /`).
- `media.generated*` flags reflect whether a tier is **configured** (URLs set); `media.status` shows
  live probe results (`ready` / `unreachable` / `off`) for UI warnings only — generation is still attempted when configured.

## 7. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| GPU box offline / slow | Per-capability timeouts → 204 → next tier; the story never stalls on media. |
| ComfyUI workflow drift across versions | Workflow lives in a replaceable template file; poller accepts any webp/gif/mp4/webm output node. |
| VibeVoice misuse concerns (voice cloning) | Qwen path uses stock speakers only; no learner-supplied reference audio path is exposed. |
| Diffusion models render gibberish text | Negative prompts forbid text/logos/UI; all real labels are app-owned overlays on top of the media. |
| Long video generation time | Clips are short (~4 s), cached 6 h, deduplicated, and loaded lazily scene-by-scene with preload. |
