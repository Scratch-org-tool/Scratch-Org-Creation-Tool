import type { CopilotStreamEvent, CopilotAction } from '@sfcc/shared';
import { buildApiUrl } from '@/lib/api-base-url';
import { buildAuthHeaders } from '@/services/api';

export interface StreamCopilotOptions {
  message: string;
  sessionId?: string;
  context?: Record<string, unknown>;
  signal?: AbortSignal;
  onSession?: (sessionId: string) => void;
  onContent?: (chunk: string) => void;
  onReasoning?: (chunk: string) => void;
  onDone?: (event: Extract<CopilotStreamEvent, { type: 'done' }>) => void;
  onError?: (message: string) => void;
}

export async function streamCopilotChat(options: StreamCopilotOptions): Promise<void> {
  const request = async (forceRefresh = false): Promise<Response> => {
    const headers = await buildAuthHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
    }, forceRefresh);
    try {
      return await fetch(buildApiUrl('/copilot/chat/stream'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: options.message,
          sessionId: options.sessionId,
          context: options.context,
        }),
        signal: options.signal,
        cache: 'no-store',
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      throw new Error(
        'Cannot reach API. Make sure `npm run dev` is running on the host machine (web + API).',
      );
    }
  };

  let res = await request();

  if (res.status === 401) {
    res = await request(true);
    if (res.status === 401) throw new Error('Session expired — please sign in again.');
  }

  if (!res.ok) {
    const text = await res.text();
    let message = text || `API error: ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (parsed.message) {
        message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
      }
    } catch {
      /* use raw */
    }
    throw new Error(message);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming not supported by the browser');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event: CopilotStreamEvent;
      try {
        event = JSON.parse(trimmed) as CopilotStreamEvent;
      } catch {
        continue;
      }

      switch (event.type) {
        case 'session':
          options.onSession?.(event.sessionId);
          break;
        case 'content':
          options.onContent?.(event.content);
          break;
        case 'reasoning':
          options.onReasoning?.(event.content);
          break;
        case 'done':
          options.onDone?.(event);
          break;
        case 'error':
          options.onError?.(event.message);
          break;
        default:
          break;
      }
    }
  }
}
