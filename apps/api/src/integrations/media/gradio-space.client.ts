import { Logger } from '@nestjs/common';

/**
 * Minimal client for the Gradio HTTP API exposed by every Hugging Face Space:
 *
 *   POST {base}/gradio_api/call/{fn}            {"data": [...]}  → {"event_id"}
 *   GET  {base}/gradio_api/call/{fn}/{event_id} SSE stream       → complete/error + data
 *   POST {base}/gradio_api/upload               multipart files  → ["/tmp/gradio/…"]
 *   GET  {base}/gradio_api/file={path}          output download
 *
 * Used to run the hosted open-source media Spaces (VibeVoice-Large,
 * Z-Image-Turbo, Wan 2.2 I2V) without any self-managed GPU server.
 */

export interface GradioFileRef {
  path?: string | null;
  url?: string | null;
  orig_name?: string | null;
  meta?: { _type?: string };
}

export interface SseResult {
  event: string;
  data: string;
}

/** Return the terminal complete/error event of a Gradio SSE stream. */
export function parseSseTerminalEvent(stream: string): SseResult | null {
  let currentEvent = '';
  let terminal: SseResult | null = null;
  for (const rawLine of stream.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line.startsWith('event:')) {
      currentEvent = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      const data = line.slice('data:'.length).trim();
      if (currentEvent === 'complete' || currentEvent === 'error') {
        terminal = { event: currentEvent, data };
      }
    }
  }
  return terminal;
}

function isFileRef(value: unknown): value is GradioFileRef {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as GradioFileRef;
  if (candidate.meta?._type === 'gradio.FileData') return true;
  return typeof candidate.url === 'string' || typeof candidate.path === 'string';
}

/** Depth-first search for the first downloadable file in a Gradio output payload. */
export function extractFileRef(value: unknown): GradioFileRef | null {
  if (isFileRef(value)) return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = extractFileRef(entry);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      const found = extractFileRef(entry);
      if (found) return found;
    }
  }
  return null;
}

export function fileRefToUrl(base: string, ref: GradioFileRef): string | null {
  if (ref.url && /^https?:\/\//i.test(ref.url)) return ref.url;
  if (ref.path) return `${base}/gradio_api/file=${ref.path}`;
  return null;
}

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

export function contentTypeForFile(name: string, headerType?: string | null): string {
  const extension = name.split('?')[0]!.split('.').pop()?.toLowerCase() ?? '';
  const fromExtension = EXTENSION_CONTENT_TYPES[extension];
  if (fromExtension) return fromExtension;
  if (headerType && headerType !== 'application/octet-stream') return headerType.split(';')[0]!;
  return 'application/octet-stream';
}

export class GradioSpaceClient {
  private readonly logger = new Logger(GradioSpaceClient.name);

  constructor(
    private readonly base: string,
    private readonly token?: string,
  ) {}

  private headers(json = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  /** Queue a Space function and wait for its terminal SSE event. */
  async call(apiName: string, data: unknown[], timeoutMs: number): Promise<unknown[]> {
    const name = apiName.replace(/^\//, '');
    const queueResponse = await this.fetchWithTimeout(
      `${this.base}/gradio_api/call/${name}`,
      { method: 'POST', headers: this.headers(true), body: JSON.stringify({ data }) },
      Math.min(timeoutMs, 20_000),
    );
    if (!queueResponse.ok) {
      throw new Error(`Space queue failed: HTTP ${queueResponse.status}`);
    }
    const { event_id: eventId } = (await queueResponse.json()) as { event_id?: string };
    if (!eventId) throw new Error('Space did not return an event id');

    const streamResponse = await this.fetchWithTimeout(
      `${this.base}/gradio_api/call/${name}/${eventId}`,
      { method: 'GET', headers: this.headers() },
      timeoutMs,
    );
    if (!streamResponse.ok) {
      throw new Error(`Space stream failed: HTTP ${streamResponse.status}`);
    }
    const terminal = parseSseTerminalEvent(await streamResponse.text());
    if (!terminal) throw new Error('Space stream ended without a result');
    if (terminal.event === 'error') {
      throw new Error(`Space reported an error: ${terminal.data.slice(0, 300)}`);
    }
    const parsed = JSON.parse(terminal.data) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Space returned a non-array payload');
    return parsed;
  }

  /** Upload bytes so image-conditioned Spaces (e.g. Wan I2V) can consume them. */
  async upload(buffer: Buffer, filename: string, timeoutMs: number): Promise<string> {
    const form = new FormData();
    form.append('files', new Blob([new Uint8Array(buffer)]), filename);
    const response = await this.fetchWithTimeout(
      `${this.base}/gradio_api/upload`,
      { method: 'POST', headers: this.headers(), body: form },
      timeoutMs,
    );
    if (!response.ok) throw new Error(`Space upload failed: HTTP ${response.status}`);
    const paths = (await response.json()) as unknown;
    const path = Array.isArray(paths) ? paths[0] : null;
    if (typeof path !== 'string' || !path) throw new Error('Space upload returned no path');
    return path;
  }

  async download(
    ref: GradioFileRef,
    timeoutMs: number,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const url = fileRefToUrl(this.base, ref);
    if (!url) throw new Error('Space output has no downloadable location');
    const response = await this.fetchWithTimeout(
      url,
      { method: 'GET', headers: this.headers() },
      timeoutMs,
    );
    if (!response.ok) throw new Error(`Space download failed: HTTP ${response.status}`);
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: contentTypeForFile(
        ref.orig_name ?? ref.path ?? url,
        response.headers.get('content-type'),
      ),
    };
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error(`Space request timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
