import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OpenSourceMediaService,
  configuredBaseUrl,
  findComfyOutputFile,
  pcmToWav,
  substituteWorkflowPlaceholders,
} from './open-source-media.service';

describe('open-source media helpers', () => {
  it('normalizes base URLs and rejects junk', () => {
    expect(configuredBaseUrl('http://localhost:8000/')).toBe('http://localhost:8000');
    expect(configuredBaseUrl('https://gpu.internal/v1//')).toBe('https://gpu.internal/v1');
    expect(configuredBaseUrl('gpu.internal')).toBe('');
    expect(configuredBaseUrl('  ')).toBe('');
    expect(configuredBaseUrl(undefined)).toBe('');
  });

  it('wraps raw PCM in a valid mono 24 kHz WAV container', () => {
    const pcm = Buffer.from([0, 0, 1, 0, 255, 255]);
    const wav = pcmToWav(pcm);
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.subarray(8, 12).toString()).toBe('WAVE');
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
    expect(wav.subarray(44)).toEqual(pcm);
  });

  it('substitutes workflow placeholders with JSON-safe prompt text', () => {
    const template = '{"text": "{{PROMPT}}", "fps": {{FPS}}, "again": "{{PROMPT}}"}';
    const filled = substituteWorkflowPlaceholders(template, {
      PROMPT: 'A "cinematic" cloud\nwith depth',
      FPS: 24,
    });
    const parsed = JSON.parse(filled) as { text: string; fps: number; again: string };
    expect(parsed.text).toBe('A "cinematic" cloud\nwith depth');
    expect(parsed.again).toBe(parsed.text);
    expect(parsed.fps).toBe(24);
  });

  it('finds playable clips in ComfyUI history outputs, preferring motion files', () => {
    expect(findComfyOutputFile(null)).toBeNull();
    expect(findComfyOutputFile({})).toBeNull();
    const outputs = {
      '10': { images: [{ filename: 'preview.png', type: 'output' }] },
      '11': {
        gifs: [{ filename: 'academy-scene_00001.webp', subfolder: '', type: 'output' }],
      },
    };
    expect(findComfyOutputFile(outputs)?.filename).toBe('academy-scene_00001.webp');
    expect(
      findComfyOutputFile({ '10': { images: [{ filename: 'still.png' }] } })?.filename,
    ).toBe('still.png');
  });
});

describe('OpenSourceMediaService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('reports capabilities from env and fails closed when unconfigured', async () => {
    vi.stubEnv('VIBEVOICE_BASE_URL', '');
    vi.stubEnv('SD_WEBUI_BASE_URL', '');
    vi.stubEnv('COMFYUI_BASE_URL', '');
    const service = new OpenSourceMediaService();
    expect(service.isSpeechConfigured()).toBe(false);
    expect(service.isImageConfigured()).toBe(false);
    expect(service.isVideoConfigured()).toBe(false);
    await expect(service.generateSpeech('Hello learners.', 'en-Alice_woman')).resolves.toBeNull();
    await expect(service.generateImage('a cloud', 'text')).resolves.toBeNull();
    await expect(service.generateVideo('a cloud', 'text')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honors per-capability kill switches', () => {
    vi.stubEnv('VIBEVOICE_BASE_URL', 'http://localhost:8000');
    vi.stubEnv('VIBEVOICE_ENABLED', 'false');
    vi.stubEnv('SD_WEBUI_BASE_URL', 'http://localhost:7860');
    vi.stubEnv('SD_IMAGE_ENABLED', 'false');
    vi.stubEnv('COMFYUI_BASE_URL', 'http://localhost:8188');
    vi.stubEnv('COMFYUI_VIDEO_ENABLED', 'false');
    const service = new OpenSourceMediaService();
    expect(service.isSpeechConfigured()).toBe(false);
    expect(service.isImageConfigured()).toBe(false);
    expect(service.isVideoConfigured()).toBe(false);
  });

  it('requests VibeVoice speech with the OpenAI-compatible contract', async () => {
    vi.stubEnv('VIBEVOICE_BASE_URL', 'http://tts.local:8000/');
    vi.stubEnv('VIBEVOICE_API_KEY', 'secret-key');
    const wav = pcmToWav(Buffer.alloc(4096));
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array(wav), {
        status: 200,
        headers: { 'content-type': 'audio/wav' },
      }),
    );

    const service = new OpenSourceMediaService();
    const media = await service.generateSpeech('Governor limits are a contract.', 'en-Carter_man');
    expect(media?.contentType).toBe('audio/wav');
    expect(media?.buffer.subarray(0, 4).toString()).toBe('RIFF');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://tts.local:8000/v1/audio/speech');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      voice: 'en-Carter_man',
      input: 'Governor limits are a contract.',
      response_format: 'wav',
    });
  });

  it('wraps raw PCM speech responses into WAV', async () => {
    vi.stubEnv('VIBEVOICE_BASE_URL', 'http://tts.local:8000');
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array(Buffer.alloc(2048, 7)), {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      }),
    );
    const service = new OpenSourceMediaService();
    const media = await service.generateSpeech('Hello.', 'en-Alice_woman');
    expect(media?.contentType).toBe('audio/wav');
    expect(media?.buffer.subarray(0, 4).toString()).toBe('RIFF');
    expect(media?.buffer.length).toBe(44 + 2048);
  });

  it('calls the SD-WebUI txt2img API and decodes base64 output', async () => {
    vi.stubEnv('SD_WEBUI_BASE_URL', 'http://sd.local:7860');
    vi.stubEnv('SD_IMAGE_MODEL', 'flux1-schnell-fp8.safetensors');
    vi.stubEnv('SD_IMAGE_STEPS', '4');
    const png = Buffer.alloc(512, 9);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ images: [png.toString('base64')] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const service = new OpenSourceMediaService();
    const media = await service.generateImage('a luminous cloud platform', 'text, watermark');
    expect(media?.contentType).toBe('image/png');
    expect(media?.buffer).toEqual(png);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://sd.local:7860/sdapi/v1/txt2img');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      prompt: 'a luminous cloud platform',
      negative_prompt: 'text, watermark',
      width: 1280,
      height: 720,
      steps: 4,
      override_settings: { sd_model_checkpoint: 'flux1-schnell-fp8.safetensors' },
    });
  });

  it('returns null on provider HTTP errors instead of throwing', async () => {
    vi.stubEnv('SD_WEBUI_BASE_URL', 'http://sd.local:7860');
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    const service = new OpenSourceMediaService();
    await expect(service.generateImage('x', 'y')).resolves.toBeNull();
  });

  it('queues a ComfyUI workflow, polls history, and downloads the clip', async () => {
    vi.stubEnv('COMFYUI_BASE_URL', 'http://comfy.local:8188');
    vi.stubEnv('COMFYUI_VIDEO_TIMEOUT_MS', '10000');
    const clip = Buffer.alloc(1024, 3);
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/prompt')) {
        const body = JSON.parse((init?.body as string) ?? '{}') as {
          prompt: Record<string, { inputs: Record<string, unknown> }>;
        };
        expect(body.prompt['3']!.inputs.text).toContain('cinematic push-in');
        expect(body.prompt['6']!.inputs.width).toBe(768);
        return new Response(JSON.stringify({ prompt_id: 'job-1' }), { status: 200 });
      }
      if (url.includes('/history/job-1')) {
        return new Response(
          JSON.stringify({
            'job-1': {
              status: { status_str: 'success' },
              outputs: {
                '11': { gifs: [{ filename: 'academy-scene_00001.webp', type: 'output' }] },
              },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes('/view?')) {
        expect(url).toContain('filename=academy-scene_00001.webp');
        return new Response(new Uint8Array(clip), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const service = new OpenSourceMediaService();
    const media = await service.generateVideo('cinematic push-in over a cloud campus', 'text');
    expect(media?.contentType).toBe('image/webp');
    expect(media?.buffer).toEqual(clip);
  }, 15_000);

  it('gives up cleanly when ComfyUI reports a workflow error', async () => {
    vi.stubEnv('COMFYUI_BASE_URL', 'http://comfy.local:8188');
    vi.stubEnv('COMFYUI_VIDEO_TIMEOUT_MS', '8000');
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/prompt')) {
        return new Response(JSON.stringify({ prompt_id: 'job-2' }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ 'job-2': { status: { status_str: 'error' }, outputs: {} } }),
        { status: 200 },
      );
    });
    const service = new OpenSourceMediaService();
    await expect(service.generateVideo('x', 'y')).resolves.toBeNull();
  }, 15_000);
});
