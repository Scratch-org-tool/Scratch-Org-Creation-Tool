import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GoogleGenerativeMediaService,
  pcmToWav,
  resolveGoogleGenAiApiKey,
} from './google-generative-media.service';

describe('Google generative media helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves supported API key names without reusing Firebase credentials', () => {
    vi.stubEnv('GOOGLE_GENAI_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'gemini-key');
    vi.stubEnv('GOOGLE_API_KEY', 'generic-key');
    vi.stubEnv('FIREBASE_WEB_API_KEY', 'firebase-key');
    expect(resolveGoogleGenAiApiKey()).toBe('gemini-key');

    vi.stubEnv('GEMINI_API_KEY', '');
    expect(resolveGoogleGenAiApiKey()).toBe('generic-key');

    vi.stubEnv('GOOGLE_API_KEY', '');
    expect(resolveGoogleGenAiApiKey()).toBe('');
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

  it('fails closed when Google media is not configured', async () => {
    vi.stubEnv('GOOGLE_GENAI_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GOOGLE_API_KEY', '');
    const service = new GoogleGenerativeMediaService();
    expect(service.isImageConfigured()).toBe(false);
    expect(service.isSpeechConfigured()).toBe(false);
    await expect(service.generateImage('draw a cloud')).resolves.toBeNull();
    await expect(service.generateSpeech('Explain CRM clearly.', 'Sulafat', 'clear')).resolves.toBeNull();
  });
});
