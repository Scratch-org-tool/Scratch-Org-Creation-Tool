import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import type { ExplainerStudioVoice } from '@sfcc/shared';

/**
 * Self-hosted open-source media stack for Academy stories:
 *
 * - Voice   → Microsoft VibeVoice behind any community OpenAI-compatible
 *             server (`POST {VIBEVOICE_BASE_URL}/v1/audio/speech`).
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
const VIDEO_POLL_INTERVAL_MS = 1_500;
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

  /* ----------------------------- capabilities ----------------------------- */

  isSpeechConfigured(): boolean {
    return (
      Boolean(configuredBaseUrl(process.env.VIBEVOICE_BASE_URL)) &&
      process.env.VIBEVOICE_ENABLED !== 'false'
    );
  }

  isImageConfigured(): boolean {
    return (
      Boolean(configuredBaseUrl(process.env.SD_WEBUI_BASE_URL)) &&
      process.env.SD_IMAGE_ENABLED !== 'false'
    );
  }

  isVideoConfigured(): boolean {
    return (
      Boolean(configuredBaseUrl(process.env.COMFYUI_BASE_URL)) &&
      process.env.COMFYUI_VIDEO_ENABLED !== 'false'
    );
  }

  /* ------------------------- voice — VibeVoice --------------------------- */

  async generateSpeech(
    narration: string,
    voice: ExplainerStudioVoice,
  ): Promise<GeneratedMedia | null> {
    const base = configuredBaseUrl(process.env.VIBEVOICE_BASE_URL);
    if (!base || !this.isSpeechConfigured()) return null;
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

  /* ------------------- images — Stable Diffusion API --------------------- */

  async generateImage(
    prompt: string,
    negativePrompt: string,
  ): Promise<GeneratedMedia | null> {
    const base = configuredBaseUrl(process.env.SD_WEBUI_BASE_URL);
    if (!base || !this.isImageConfigured()) return null;
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

  /* --------------------- motion clips — ComfyUI API ---------------------- */

  async generateVideo(
    prompt: string,
    negativePrompt: string,
  ): Promise<GeneratedMedia | null> {
    const base = configuredBaseUrl(process.env.COMFYUI_BASE_URL);
    if (!base || !this.isVideoConfigured()) return null;
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
