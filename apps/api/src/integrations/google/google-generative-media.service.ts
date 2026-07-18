import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import type { ExplainerCloudVoice, ExplainerDelivery } from '@sfcc/shared';

const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image';
const DEFAULT_TTS_MODEL = 'gemini-3.1-flash-tts-preview';
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export interface GeneratedMedia {
  buffer: Buffer;
  contentType: string;
}

function configuredValue(value: string | undefined): string {
  const candidate = value?.trim() ?? '';
  if (
    !candidate ||
    candidate.includes('your-') ||
    candidate.includes('replace-') ||
    candidate.includes('...')
  ) {
    return '';
  }
  return candidate;
}

export function resolveGoogleGenAiApiKey(): string {
  for (const candidate of [
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ]) {
    const key = configuredValue(candidate);
    if (key) return key;
  }
  return '';
}

/** Gemini TTS returns mono 24 kHz signed 16-bit PCM; browsers need a WAV container. */
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

function asMedia(
  encoded: string | undefined,
  contentType: string | undefined,
  kind: 'image' | 'audio',
): GeneratedMedia | null {
  if (!encoded) return null;
  const buffer = Buffer.from(encoded, 'base64');
  const max = kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  if (buffer.length < 64 || buffer.length > max) return null;

  if (kind === 'image') {
    const safeType = ['image/png', 'image/jpeg', 'image/webp'].includes(contentType ?? '')
      ? contentType!
      : 'image/png';
    return { buffer, contentType: safeType };
  }
  if (contentType?.includes('wav')) {
    return { buffer, contentType: 'audio/wav' };
  }
  return { buffer: pcmToWav(buffer), contentType: 'audio/wav' };
}

@Injectable()
export class GoogleGenerativeMediaService {
  private readonly logger = new Logger(GoogleGenerativeMediaService.name);
  private readonly client: GoogleGenAI | null;
  private readonly timeoutMs =
    parseInt(process.env.GOOGLE_MEDIA_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10) ||
    DEFAULT_TIMEOUT_MS;

  constructor() {
    const apiKey = resolveGoogleGenAiApiKey();
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  isImageConfigured(): boolean {
    return Boolean(this.client) && process.env.GOOGLE_IMAGE_GENERATION_ENABLED !== 'false';
  }

  isSpeechConfigured(): boolean {
    return Boolean(this.client) && process.env.GOOGLE_TTS_ENABLED !== 'false';
  }

  async generateImage(prompt: string): Promise<GeneratedMedia | null> {
    if (!this.client || !this.isImageConfigured()) return null;
    const model = configuredValue(process.env.GOOGLE_IMAGE_MODEL) || DEFAULT_IMAGE_MODEL;
    try {
      const response = await this.withTimeout(
        this.client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: '16:9',
              imageSize: '1K',
            },
          },
        }),
        'image generation',
      );
      for (const candidate of response.candidates ?? []) {
        for (const part of candidate.content?.parts ?? []) {
          const media = asMedia(
            part.inlineData?.data,
            part.inlineData?.mimeType,
            'image',
          );
          if (media) return media;
        }
      }
      this.logger.warn(`Google image model ${model} returned no usable image`);
      return null;
    } catch (error) {
      this.logger.warn(
        `Google image generation failed (${model}): ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async generateSpeech(
    narration: string,
    voice: ExplainerCloudVoice,
    delivery: ExplainerDelivery,
  ): Promise<GeneratedMedia | null> {
    if (!this.client || !this.isSpeechConfigured()) return null;
    const model = configuredValue(process.env.GOOGLE_TTS_MODEL) || DEFAULT_TTS_MODEL;
    const direction: Record<ExplainerDelivery, string> = {
      curious: 'Begin with genuine curiosity, then make the insight feel satisfying.',
      clear: 'Sound calm, precise, and easy to follow.',
      energetic: 'Sound engaging and confident without rushing.',
      reflective: 'Use a thoughtful pace and leave room for the idea to land.',
    };
    try {
      const response = await this.withTimeout(
        this.client.models.generateContent({
          model,
          contents: [
            {
              parts: [
                {
                  text:
                    `Narrate as a trusted Salesforce mentor. ${direction[delivery]} ` +
                    `Use natural emphasis and short pauses. Read only the narration below; ` +
                    `do not announce these directions.\n\n${narration}`,
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        }),
        'speech generation',
      );
      for (const candidate of response.candidates ?? []) {
        for (const part of candidate.content?.parts ?? []) {
          const media = asMedia(
            part.inlineData?.data,
            part.inlineData?.mimeType,
            'audio',
          );
          if (media) return media;
        }
      }
      this.logger.warn(`Google TTS model ${model} returned no usable audio`);
      return null;
    } catch (error) {
      this.logger.warn(
        `Google speech generation failed (${model}): ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async withTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${label} timed out after ${this.timeoutMs}ms`)),
            this.timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
