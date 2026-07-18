import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import type {
  ExplainerDelivery,
  ExplainerMediaStatus,
  ExplainerMediaTierStatus,
  ExplainerStudioVoice,
} from '@sfcc/shared';
import { GradioSpaceClient, extractFileRef } from './gradio-space.client';

/**
 * Self-hosted open-source media stack for Academy stories:
 *
 * - Voice   → Qwen3-TTS Space (`/generate_custom_voice`) or Microsoft VibeVoice
 *             behind any community OpenAI-compatible server.
 * - Images  → FLUX.1-schnell / SDXL behind any Stable-Diffusion-WebUI-
 *             compatible server (`POST {SD_WEBUI_BASE_URL}/sdapi/v1/txt2img`).
 * - Video   → LTX-Video / Wan 2.2 via the ComfyUI HTTP API
 *             (`POST {COMFYUI_BASE_URL}/prompt` + history polling), with the
 *             workflow graph supplied by a replaceable template.
 *
 * Every capability is optional and fails closed to `null`, which callers
 * translate into HTTP 204 so the web player can activate its next fallback.
 */

const SPEECH_TIMEOUT_MS = 60_000;
const IMAGE_TIMEOUT_MS = 60_000;
const VIDEO_TIMEOUT_MS = 180_000;
const SPACE_SPEECH_TIMEOUT_MS = 300_000;
const SPACE_IMAGE_TIMEOUT_MS = 120_000;
const SPACE_VIDEO_TIMEOUT_MS = 480_000;
const VIDEO_POLL_INTERVAL_MS = 1_500;
const PROBE_TIMEOUT_MS = 2_500;
const PROBE_CACHE_TTL_MS = 60_000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

export interface GeneratedMedia {
  buffer: Buffer;
  contentType: string;
}

export function configuredBaseUrl(value: string | undefined): string {
  const candidate = value?.trim() ?? '';
  if (!candidate || !/^https?:\/\//i.test(candidate)) return '';
  return candidate.replace(/\/+$/, '');
}

/** Teaching-style instruct strings for Qwen3-TTS from scene delivery. */
export function qwenInstructForDelivery(delivery?: ExplainerDelivery): string {
  const map: Record<ExplainerDelivery, string> = {
    curious:
      'Teach like a patient mentor discovering the idea with the learner; conversational, not monotone.',
    clear:
      'Explain simply to a Salesforce beginner; emphasize cause and effect, not slide labels.',
    energetic:
      'Sound engaged and encouraging, like coaching through a breakthrough moment.',
    reflective:
      'Slow down and help the learner connect this scene to the bigger picture.',
  };
  return delivery ? map[delivery] : map.clear;
}

/** Map legacy VibeVoice voice ids to Qwen speakers when old clients still send them. */
export function mapQwenSpeaker(voice: ExplainerStudioVoice | string): string {
  const legacy: Record<string, ExplainerStudioVoice> = {
    'en-Alice_woman': 'Serena',
    'en-Carter_man': 'Ryan',
    'en-Frank_man': 'Dylan',
    'en-Maya_woman': 'Vivian',
    'en-Yasser_man': 'Eric',
    'in-Samuel_man': 'Aiden',
  };
  return legacy[voice] ?? voice;
}

function isGradioSpaceUrl(base: string): boolean {
  return /\.hf\.space/i.test(base) || /huggingface\.co\/spaces/i.test(base);
}

function probeTargetUrl(base: string): string {
  return isGradioSpaceUrl(base) ? `${base}/gradio_api/info` : base;
}

function envInt(name: string, fallback: number): number {
  return parseInt(process.env[name] ?? String(fallback), 10) || fallback;
}

/** VibeVoice servers emit mono 24 kHz signed 16-bit PCM; browsers need a WAV container. */
export function pcmToWav(pcm: Buffer, sampleRate = 24_000): Buffer {
  const header = Buffer.alloc(44);
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * Fill a ComfyUI workflow template. Placeholders may appear quoted (strings)
 * or bare (numbers); prompt text is JSON-escaped so any template stays valid.
 */
export function substituteWorkflowPlaceholders(
  template: string,
  values: Record<string, string | number>,
): string {
  let result = template;
  for (const [key, raw] of Object.entries(values)) {
    const replacement =
      typeof raw === 'number' ? String(raw) : JSON.stringify(raw).slice(1, -1);
    result = result.split(`{{${key}}}`).join(replacement);
  }
  return result;
}

interface ComfyOutputFile {
  filename: string;
  subfolder?: string;
  type?: string;
}

const MOTION_CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  webp: 'image/webp',
  gif: 'image/gif',
  png: 'image/png',
};

/** Locate the first playable clip in a ComfyUI history `outputs` object. */
export function findComfyOutputFile(outputs: unknown): ComfyOutputFile | null {
  if (!outputs || typeof outputs !== 'object') return null;
  const candidates: ComfyOutputFile[] = [];
  for (const node of Object.values(outputs as Record<string, unknown>)) {
    if (!node || typeof node !== 'object') continue;
    for (const key of ['videos', 'gifs', 'images']) {
      const files = (node as Record<string, unknown>)[key];
      if (!Array.isArray(files)) continue;
      for (const file of files) {
        const filename = (file as ComfyOutputFile)?.filename;
        if (typeof filename === 'string' && filename.length > 0) {
          candidates.push(file as ComfyOutputFile);
        }
      }
    }
  }
  const motion = candidates.find((file) =>
    /\.(mp4|webm|webp|gif)$/i.test(file.filename),
  );
  return motion ?? candidates[0] ?? null;
}

/**
 * Default text-to-video workflow targeting ComfyUI-core LTX-Video nodes and
 * the core SaveAnimatedWEBP writer (no custom node packs required). Override
 * with COMFYUI_VIDEO_WORKFLOW to run LTX-2, Wan 2.2, or any custom graph.
 */
const DEFAULT_COMFY_WORKFLOW = `{
  "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "{{CHECKPOINT}}"}},
  "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "{{TEXT_ENCODER}}", "type": "ltxv"}},
  "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{PROMPT}}", "clip": ["2", 0]}},
  "4": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{NEGATIVE_PROMPT}}", "clip": ["2", 0]}},
  "5": {"class_type": "LTXVConditioning", "inputs": {"positive": ["3", 0], "negative": ["4", 0], "frame_rate": {{FPS}}}},
  "6": {"class_type": "EmptyLTXVLatentVideo", "inputs": {"width": {{WIDTH}}, "height": {{HEIGHT}}, "length": {{FRAMES}}, "batch_size": 1}},
  "7": {"class_type": "LTXVScheduler", "inputs": {"steps": 24, "max_shift": 2.05, "base_shift": 0.95, "stretch": true, "terminal": 0.1, "latent": ["6", 0]}},
  "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
  "9": {"class_type": "SamplerCustom", "inputs": {"model": ["1", 0], "add_noise": true, "noise_seed": {{SEED}}, "cfg": 3, "positive": ["5", 0], "negative": ["5", 1], "sampler": ["8", 0], "sigmas": ["7", 0], "latent_image": ["6", 0]}},
  "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["1", 2]}},
  "11": {"class_type": "SaveAnimatedWEBP", "inputs": {"images": ["10", 0], "filename_prefix": "academy-scene", "fps": {{FPS}}, "lossless": false, "quality": 85, "method": "default"}}
}`;

function asMedia(
  buffer: Buffer,
  contentType: string,
  maxBytes: number,
): GeneratedMedia | null {
  if (buffer.length < 64 || buffer.length > maxBytes) return null;
  return { buffer, contentType };
}

@Injectable()
export class OpenSourceMediaService {
  private readonly logger = new Logger(OpenSourceMediaService.name);
  private readonly probeCache = new Map<string, { reachable: boolean; expires: number }>();

  /* ----------------------------- capabilities ----------------------------- */
  /*
   * Each tier supports two open-source backends and picks the first configured:
   *  1. A hosted Hugging Face Space (Gradio API) — zero self-managed infra.
   *  2. A self-hosted server (VibeVoice server / SD-WebUI / ComfyUI).
   */

  private qwenSpeechSpaceUrl(): string {
    return configuredBaseUrl(process.env.QWEN_TTS_SPACE_URL);
  }

  private vibeVoiceSpeechSpaceUrl(): string {
    return configuredBaseUrl(process.env.VIBEVOICE_SPACE_URL);
  }

  private speechSpaceUrl(): string {
    return this.qwenSpeechSpaceUrl() || this.vibeVoiceSpeechSpaceUrl();
  }

  private imageSpaceUrl(): string {
    return configuredBaseUrl(process.env.ZIMAGE_SPACE_URL);
  }

  private videoSpaceUrl(): string {
    return configuredBaseUrl(process.env.WAN_VIDEO_SPACE_URL);
  }

  private spaceClient(base: string): GradioSpaceClient {
    return new GradioSpaceClient(base, process.env.HF_TOKEN?.trim() || undefined);
  }

  isSpeechConfigured(): boolean {
    return (
      Boolean(
        this.qwenSpeechSpaceUrl() ||
          this.vibeVoiceSpeechSpaceUrl() ||
          configuredBaseUrl(process.env.VIBEVOICE_BASE_URL),
      ) && process.env.VIBEVOICE_ENABLED !== 'false'
    );
  }

  isImageConfigured(): boolean {
    return (
      Boolean(this.imageSpaceUrl() || configuredBaseUrl(process.env.SD_WEBUI_BASE_URL)) &&
      process.env.SD_IMAGE_ENABLED !== 'false'
    );
  }

  isVideoConfigured(): boolean {
    return (
      Boolean(this.videoSpaceUrl() || configuredBaseUrl(process.env.COMFYUI_BASE_URL)) &&
      process.env.COMFYUI_VIDEO_ENABLED !== 'false'
    );
  }

  /**
   * Live per-tier health, surfaced to the player so a missing or crashed
   * media server is an explicit "unreachable"/"off" instead of a silent
   * fallback. Probes are cached for one minute.
   */
  async getMediaStatus(): Promise<ExplainerMediaStatus> {
    const [video, images, speech] = await Promise.all([
      this.tierStatus(
        this.isVideoConfigured(),
        this.videoSpaceUrl() || process.env.COMFYUI_BASE_URL,
        'Video generation (Wan/ComfyUI)',
      ),
      this.tierStatus(
        this.isImageConfigured(),
        this.imageSpaceUrl() || process.env.SD_WEBUI_BASE_URL,
        'Image generation (Z-Image/Stable Diffusion)',
      ),
      this.tierStatus(
        this.isSpeechConfigured(),
        this.qwenSpeechSpaceUrl() ||
          this.vibeVoiceSpeechSpaceUrl() ||
          process.env.VIBEVOICE_BASE_URL,
        'Speech (Qwen3-TTS/VibeVoice)',
      ),
    ]);
    return { video, images, speech };
  }

  private async tierStatus(
    configured: boolean,
    rawBase: string | undefined,
    label: string,
  ): Promise<ExplainerMediaTierStatus> {
    if (!configured) return 'off';
    const base = configuredBaseUrl(rawBase);
    if (!base) return 'off';
    const reachable = await this.probeBase(base, label);
    return reachable ? 'ready' : 'unreachable';
  }

  /** Any HTTP answer (even 404) counts as reachable; only network failures do not. */
  private async probeBase(base: string, label: string): Promise<boolean> {
    const cached = this.probeCache.get(base);
    if (cached && cached.expires > Date.now()) return cached.reachable;

    let reachable = false;
    try {
      await this.fetchWithTimeout(
        probeTargetUrl(base),
        { method: 'GET' },
        envInt('MEDIA_PROBE_TIMEOUT_MS', PROBE_TIMEOUT_MS),
        `${label} probe`,
      );
      reachable = true;
    } catch (error) {
      this.logger.warn(
        `${label} at ${base} is unreachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    this.probeCache.set(base, { reachable, expires: Date.now() + PROBE_CACHE_TTL_MS });
    return reachable;
  }

  /* ------------------------- voice — Qwen3-TTS / VibeVoice ---------------- */

  async generateSpeech(
    narration: string,
    voice: ExplainerStudioVoice,
    delivery?: ExplainerDelivery,
  ): Promise<GeneratedMedia | null> {
    if (!this.isSpeechConfigured()) return null;
    if (this.qwenSpeechSpaceUrl()) {
      return this.generateSpeechViaQwenSpace(narration, voice, delivery);
    }
    if (this.vibeVoiceSpeechSpaceUrl()) {
      return this.generateSpeechViaVibeVoiceSpace(narration, voice);
    }
    const base = configuredBaseUrl(process.env.VIBEVOICE_BASE_URL);
    if (!base) return null;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = process.env.VIBEVOICE_API_KEY?.trim();
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const response = await this.fetchWithTimeout(
        `${base}/v1/audio/speech`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: process.env.VIBEVOICE_MODEL?.trim() || 'vibevoice',
            voice,
            input: narration,
            response_format: 'wav',
          }),
        },
        envInt('VIBEVOICE_TIMEOUT_MS', SPEECH_TIMEOUT_MS),
        'VibeVoice speech',
      );
      if (!response.ok) {
        this.logger.warn(`VibeVoice returned HTTP ${response.status}`);
        return null;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.subarray(0, 4).toString() === 'RIFF') {
        return asMedia(buffer, 'audio/wav', MAX_AUDIO_BYTES);
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('mpeg') || contentType.includes('mp3')) {
        return asMedia(buffer, 'audio/mpeg', MAX_AUDIO_BYTES);
      }
      // Some servers stream raw 24 kHz PCM even when WAV is requested.
      return asMedia(pcmToWav(buffer), 'audio/wav', MAX_AUDIO_BYTES);
    } catch (error) {
      this.logger.warn(
        `VibeVoice speech generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** Qwen3-TTS via its hosted Gradio Space (`/generate_custom_voice`). */
  private async generateSpeechViaQwenSpace(
    narration: string,
    voice: ExplainerStudioVoice,
    delivery?: ExplainerDelivery,
  ): Promise<GeneratedMedia | null> {
    const base = this.qwenSpeechSpaceUrl();
    const apiName =
      process.env.QWEN_TTS_SPACE_API?.trim() || '/generate_custom_voice';
    const modelSize = process.env.QWEN_TTS_MODEL_SIZE?.trim() || '1.7B';
    const timeoutMs = envInt('HF_SPEECH_TIMEOUT_MS', SPACE_SPEECH_TIMEOUT_MS);
    try {
      const outputs = await this.spaceClient(base).call(
        apiName,
        [
          narration.replace(/\s+/g, ' ').trim(),
          'English',
          mapQwenSpeaker(voice),
          qwenInstructForDelivery(delivery),
          modelSize,
        ],
        timeoutMs,
      );
      const statusMsg = typeof outputs[1] === 'string' ? outputs[1] : '';
      const ref = extractFileRef(outputs[0] ?? outputs);
      if (!ref) {
        this.logger.warn(
          `Qwen TTS Space returned no audio${statusMsg ? ` (${statusMsg})` : ''}: ${JSON.stringify(outputs).slice(0, 300)}`,
        );
        return null;
      }
      const media = await this.spaceClient(base).download(ref, timeoutMs);
      return asMedia(media.buffer, media.contentType, MAX_AUDIO_BYTES);
    } catch (error) {
      this.logger.warn(
        `Qwen TTS Space speech failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** VibeVoice via its hosted Gradio Space (`/generate_podcast_wrapper`). */
  private async generateSpeechViaVibeVoiceSpace(
    narration: string,
    voice: ExplainerStudioVoice,
  ): Promise<GeneratedMedia | null> {
    const base = this.vibeVoiceSpeechSpaceUrl();
    try {
      const script = `Speaker 1: ${narration.replace(/\s+/g, ' ').trim()}`;
      const outputs = await this.spaceClient(base).call(
        process.env.VIBEVOICE_SPACE_API?.trim() || '/generate_podcast_wrapper',
        [
          1,
          script,
          voice,
          'en-Carter_man',
          'en-Frank_man',
          'en-Maya_woman',
          Number(process.env.VIBEVOICE_CFG_SCALE ?? '') || 1.3,
        ],
        envInt('HF_SPEECH_TIMEOUT_MS', SPACE_SPEECH_TIMEOUT_MS),
      );
      const ref = extractFileRef(outputs[0] ?? outputs);
      if (!ref) {
        this.logger.warn(
          `VibeVoice Space returned no audio: ${JSON.stringify(outputs[1] ?? outputs).slice(0, 200)}`,
        );
        return null;
      }
      const media = await this.spaceClient(base).download(
        ref,
        envInt('HF_SPEECH_TIMEOUT_MS', SPACE_SPEECH_TIMEOUT_MS),
      );
      return asMedia(media.buffer, media.contentType, MAX_AUDIO_BYTES);
    } catch (error) {
      this.logger.warn(
        `VibeVoice Space speech failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /* ------------- images — Z-Image Space / Stable Diffusion API ------------ */

  async generateImage(
    prompt: string,
    negativePrompt: string,
  ): Promise<GeneratedMedia | null> {
    if (!this.isImageConfigured()) return null;
    if (this.imageSpaceUrl()) return this.generateImageViaSpace(prompt, negativePrompt);
    const base = configuredBaseUrl(process.env.SD_WEBUI_BASE_URL);
    if (!base) return null;
    try {
      const checkpoint = process.env.SD_IMAGE_MODEL?.trim();
      const response = await this.fetchWithTimeout(
        `${base}/sdapi/v1/txt2img`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            negative_prompt: negativePrompt,
            width: envInt('SD_IMAGE_WIDTH', 1280),
            height: envInt('SD_IMAGE_HEIGHT', 720),
            steps: envInt('SD_IMAGE_STEPS', 20),
            cfg_scale: Number(process.env.SD_IMAGE_CFG_SCALE ?? '') || 7,
            sampler_name: process.env.SD_IMAGE_SAMPLER?.trim() || 'Euler a',
            batch_size: 1,
            ...(checkpoint
              ? { override_settings: { sd_model_checkpoint: checkpoint } }
              : {}),
          }),
        },
        envInt('SD_IMAGE_TIMEOUT_MS', IMAGE_TIMEOUT_MS),
        'image generation',
      );
      if (!response.ok) {
        this.logger.warn(`Stable Diffusion API returned HTTP ${response.status}`);
        return null;
      }
      const payload = (await response.json()) as { images?: string[] };
      const encoded = payload.images?.[0];
      if (!encoded) {
        this.logger.warn('Stable Diffusion API returned no images');
        return null;
      }
      return asMedia(Buffer.from(encoded, 'base64'), 'image/png', MAX_IMAGE_BYTES);
    } catch (error) {
      this.logger.warn(
        `Image generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** Z-Image-Turbo via its hosted Gradio Space (`/generate_image`). */
  private async generateImageViaSpace(
    prompt: string,
    negativePrompt: string,
  ): Promise<GeneratedMedia | null> {
    const base = this.imageSpaceUrl();
    try {
      // Z-Image has no negative-prompt input; fold the bans into the prompt.
      const fullPrompt = `${prompt}. Strictly avoid: ${negativePrompt}.`;
      const timeoutMs = envInt('HF_IMAGE_TIMEOUT_MS', SPACE_IMAGE_TIMEOUT_MS);
      const outputs = await this.spaceClient(base).call(
        process.env.ZIMAGE_SPACE_API?.trim() || '/generate_image',
        [
          fullPrompt,
          envInt('SD_IMAGE_HEIGHT', 720),
          envInt('SD_IMAGE_WIDTH', 1280),
          envInt('ZIMAGE_STEPS', 9),
          Math.floor(Math.random() * 2_147_483_647),
          true,
        ],
        timeoutMs,
      );
      const ref = extractFileRef(outputs);
      if (!ref) {
        this.logger.warn('Z-Image Space returned no image');
        return null;
      }
      const media = await this.spaceClient(base).download(ref, timeoutMs);
      return asMedia(media.buffer, media.contentType, MAX_IMAGE_BYTES);
    } catch (error) {
      this.logger.warn(
        `Z-Image Space generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /* ------------- motion clips — Wan I2V Space / ComfyUI API --------------- */

  async generateVideo(
    prompt: string,
    negativePrompt: string,
    baseImage?: GeneratedMedia | null,
  ): Promise<GeneratedMedia | null> {
    if (!this.isVideoConfigured()) return null;
    if (this.videoSpaceUrl()) {
      return this.generateVideoViaSpace(prompt, negativePrompt, baseImage ?? null);
    }
    const base = configuredBaseUrl(process.env.COMFYUI_BASE_URL);
    if (!base) return null;
    const timeoutMs = envInt('COMFYUI_VIDEO_TIMEOUT_MS', VIDEO_TIMEOUT_MS);
    const deadline = Date.now() + timeoutMs;
    try {
      const workflow = JSON.parse(
        substituteWorkflowPlaceholders(this.loadWorkflowTemplate(), {
          PROMPT: prompt,
          NEGATIVE_PROMPT: negativePrompt,
          SEED: Math.floor(Math.random() * 2_147_483_647),
          WIDTH: envInt('COMFYUI_VIDEO_WIDTH', 768),
          HEIGHT: envInt('COMFYUI_VIDEO_HEIGHT', 512),
          FRAMES: envInt('COMFYUI_VIDEO_FRAMES', 97),
          FPS: envInt('COMFYUI_VIDEO_FPS', 24),
          CHECKPOINT:
            process.env.COMFYUI_VIDEO_CHECKPOINT?.trim() ||
            'ltx-video-2b-v0.9.5.safetensors',
          TEXT_ENCODER:
            process.env.COMFYUI_TEXT_ENCODER?.trim() || 't5xxl_fp16.safetensors',
        }),
      ) as Record<string, unknown>;

      const queueResponse = await this.fetchWithTimeout(
        `${base}/prompt`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: workflow, client_id: randomUUID() }),
        },
        Math.min(timeoutMs, 15_000),
        'ComfyUI queue',
      );
      if (!queueResponse.ok) {
        this.logger.warn(
          `ComfyUI rejected the video workflow: HTTP ${queueResponse.status} ${await queueResponse
            .text()
            .catch(() => '')}`.slice(0, 300),
        );
        return null;
      }
      const { prompt_id: promptId } = (await queueResponse.json()) as {
        prompt_id?: string;
      };
      if (!promptId) {
        this.logger.warn('ComfyUI did not return a prompt id');
        return null;
      }

      const file = await this.pollComfyHistory(base, promptId, deadline);
      if (!file) return null;

      const query = new URLSearchParams({
        filename: file.filename,
        subfolder: file.subfolder ?? '',
        type: file.type ?? 'output',
      });
      const download = await this.fetchWithTimeout(
        `${base}/view?${query.toString()}`,
        { method: 'GET' },
        Math.min(Math.max(deadline - Date.now(), 5_000), 30_000),
        'ComfyUI download',
      );
      if (!download.ok) {
        this.logger.warn(`ComfyUI clip download failed: HTTP ${download.status}`);
        return null;
      }
      const extension = file.filename.split('.').pop()?.toLowerCase() ?? '';
      return asMedia(
        Buffer.from(await download.arrayBuffer()),
        MOTION_CONTENT_TYPES[extension] ?? 'video/mp4',
        MAX_VIDEO_BYTES,
      );
    } catch (error) {
      this.logger.warn(
        `Video generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Wan 2.2 image-to-video via its hosted Gradio Space: upload the generated
   * scene still, then animate it (`/generate_video`). Needs the image tier —
   * without a base frame there is nothing to animate.
   */
  private async generateVideoViaSpace(
    prompt: string,
    negativePrompt: string,
    baseImage: GeneratedMedia | null,
  ): Promise<GeneratedMedia | null> {
    if (!baseImage) {
      this.logger.warn(
        'Wan I2V Space needs a scene image to animate — enable the image tier (ZIMAGE_SPACE_URL or SD_WEBUI_BASE_URL)',
      );
      return null;
    }
    const base = this.videoSpaceUrl();
    try {
      const timeoutMs = envInt('HF_VIDEO_TIMEOUT_MS', SPACE_VIDEO_TIMEOUT_MS);
      const client = this.spaceClient(base);
      const uploadedPath = await client.upload(
        baseImage.buffer,
        'academy-scene.png',
        Math.min(timeoutMs, 60_000),
      );
      const outputs = await client.call(
        process.env.WAN_VIDEO_SPACE_API?.trim() || '/generate_video',
        [
          { path: uploadedPath, orig_name: 'academy-scene.png', meta: { _type: 'gradio.FileData' } },
          null,
          prompt,
          envInt('WAN_VIDEO_STEPS', 4),
          negativePrompt,
          Number(process.env.WAN_VIDEO_DURATION_SECONDS ?? '') || 2.5,
          1,
          1,
          Math.floor(Math.random() * 2_147_483_647),
          true,
          6,
          'UniPCMultistep',
          3,
          '16',
          true,
          true,
        ],
        timeoutMs,
      );
      const ref = extractFileRef(outputs);
      if (!ref) {
        this.logger.warn('Wan I2V Space returned no video');
        return null;
      }
      const media = await client.download(ref, Math.min(timeoutMs, 120_000));
      return asMedia(media.buffer, media.contentType, MAX_VIDEO_BYTES);
    } catch (error) {
      this.logger.warn(
        `Wan I2V Space generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private loadWorkflowTemplate(): string {
    const path = process.env.COMFYUI_VIDEO_WORKFLOW?.trim();
    if (path) {
      try {
        return readFileSync(path, 'utf8');
      } catch (error) {
        this.logger.warn(
          `Cannot read COMFYUI_VIDEO_WORKFLOW at ${path} — using the built-in LTX template (${
            error instanceof Error ? error.message : String(error)
          })`,
        );
      }
    }
    return DEFAULT_COMFY_WORKFLOW;
  }

  private async pollComfyHistory(
    base: string,
    promptId: string,
    deadline: number,
  ): Promise<ComfyOutputFile | null> {
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
      const response = await this.fetchWithTimeout(
        `${base}/history/${promptId}`,
        { method: 'GET' },
        10_000,
        'ComfyUI history',
      );
      if (!response.ok) continue;
      const history = (await response.json()) as Record<
        string,
        { outputs?: unknown; status?: { status_str?: string } }
      >;
      const entry = history[promptId];
      if (!entry) continue;
      if (entry.status?.status_str === 'error') {
        this.logger.warn('ComfyUI reported a workflow execution error');
        return null;
      }
      const file = findComfyOutputFile(entry.outputs);
      if (file) return file;
    }
    this.logger.warn('ComfyUI video generation timed out');
    return null;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    label: string,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
