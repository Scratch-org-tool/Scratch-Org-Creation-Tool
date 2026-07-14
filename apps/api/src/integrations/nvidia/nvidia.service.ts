import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

export interface ChatOptions {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  stream?: boolean;
  useFallback?: boolean;
  enableThinking?: boolean;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  model?: string;
  timeoutMs?: number;
  /** Use NVIDIA_FALLBACK_API_KEY (falls back to NVIDIA_API_KEY). */
  useFallbackKey?: boolean;
}

export interface ChatResult {
  content: string;
  reasoning?: string;
  model: string;
}

const DEFAULT_CHAT_TIMEOUT_MS = parseInt(process.env.NVIDIA_CHAT_TIMEOUT_MS ?? '90000', 10) || 90_000;
const CLIENT_TIMEOUT_MS = parseInt(process.env.NVIDIA_CLIENT_TIMEOUT_MS ?? '120000', 10) || 120_000;
const DEFAULT_COPILOT_MODEL = 'google/gemma-3n-e4b-it';
const DEFAULT_FALLBACK_MODEL = 'nvidia/llama-3.3-nemotron-super-49b-v1.5';
const COPILOT_FAST_TIMEOUT_MS = parseInt(process.env.NVIDIA_COPILOT_FAST_TIMEOUT_MS ?? '10000', 10) || 10_000;

export type ChatDelta = { reasoning?: string; content?: string };

function isNvidiaConfigured(): boolean {
  const key = process.env.NVIDIA_API_KEY?.trim() ?? '';
  if (!key) return false;
  if (key.includes('your-key') || key.includes('nvapi-your')) return false;
  return true;
}

@Injectable()
export class NvidiaService {
  private readonly primaryClient: OpenAI;
  private readonly fallbackClient: OpenAI;
  private readonly primaryApiKey: string;
  private readonly fallbackApiKey: string;
  private readonly primaryModel: string;
  private readonly copilotModel: string;
  private readonly fallbackModel: string;

  constructor() {
    const baseURL = process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
    this.primaryApiKey = process.env.NVIDIA_API_KEY?.trim() ?? '';
    this.fallbackApiKey =
      process.env.NVIDIA_FALLBACK_API_KEY?.trim() || this.primaryApiKey;
    const clientOptions = {
      baseURL,
      timeout: CLIENT_TIMEOUT_MS,
      maxRetries: 0,
    };

    this.primaryClient = new OpenAI({ ...clientOptions, apiKey: this.primaryApiKey });
    this.fallbackClient = new OpenAI({ ...clientOptions, apiKey: this.fallbackApiKey });
    this.copilotModel =
      process.env.NVIDIA_COPILOT_MODEL ?? process.env.NVIDIA_PRIMARY_MODEL ?? DEFAULT_COPILOT_MODEL;
    this.primaryModel = process.env.NVIDIA_PRIMARY_MODEL ?? this.copilotModel;
    this.fallbackModel = process.env.NVIDIA_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL;
  }

  /** Fast, non-streaming chat tuned for the Copilot panel */
  async chatCopilot(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  ): Promise<ChatResult> {
    return this.chatCopilotResilient(messages);
  }

  /**
   * Try fast gemma first (default 10s). On timeout/failure, stream from Nemotron fallback.
   */
  async chatCopilotResilient(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onDelta?: (delta: ChatDelta) => void,
  ): Promise<ChatResult> {
    if (!isNvidiaConfigured()) {
      const mock = this.devChat(messages);
      if (mock.content) onDelta?.({ content: mock.content });
      return mock;
    }

    const fastMs = COPILOT_FAST_TIMEOUT_MS;
    const slowMs = DEFAULT_CHAT_TIMEOUT_MS;

    if (this.copilotModel === this.fallbackModel) {
      return this.chatCopilotSingle(messages, onDelta, slowMs);
    }

    try {
      const result = await this.withTimeout(
        this.chatViaRest({
          messages,
          model: this.copilotModel,
          maxTokens: 512,
          temperature: 0.2,
          topP: 0.7,
          frequencyPenalty: 0,
          presencePenalty: 0,
          timeoutMs: fastMs,
        }),
        fastMs,
      );
      if (result.content) onDelta?.({ content: result.content });
      return result;
    } catch (error) {
      console.warn(
        `[NVIDIA] ${this.copilotModel} did not respond within ${fastMs / 1000}s — switching to ${this.fallbackModel}`,
        error instanceof Error ? error.message : error,
      );
    }

    return this.chatCopilotFallback(messages, onDelta, slowMs);
  }

  private async chatCopilotSingle(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onDelta: ((delta: ChatDelta) => void) | undefined,
    timeoutMs: number,
  ): Promise<ChatResult> {
    const result = await this.withTimeout(
      this.chatViaRest({
        messages,
        model: this.copilotModel,
        maxTokens: 512,
        temperature: 0.2,
        topP: 0.7,
        frequencyPenalty: 0,
        presencePenalty: 0,
        timeoutMs,
      }),
      timeoutMs,
    );
    if (result.content) onDelta?.({ content: result.content });
    return result;
  }

  private buildNemotronMessages(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  ): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
    return [{ role: 'system', content: '/no_think' }, ...messages];
  }

  private async chatCopilotFallback(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onDelta: ((delta: ChatDelta) => void) | undefined,
    timeoutMs: number,
  ): Promise<ChatResult> {
    const fallbackOptions: ChatOptions = {
      messages: this.buildNemotronMessages(messages),
      model: this.fallbackModel,
      stream: true,
      maxTokens: 1024,
      temperature: 0,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      timeoutMs,
      useFallbackKey: true,
    };

    try {
      return await this.withTimeout(this.streamPrimary(fallbackOptions, onDelta), timeoutMs);
    } catch (streamError) {
      console.warn('[NVIDIA] Fallback stream failed, retrying non-stream:', streamError);
      try {
        const result = await this.withTimeout(
          this.chatViaRest({ ...fallbackOptions, stream: false }),
          timeoutMs,
        );
        if (result.content) onDelta?.({ content: result.content });
        return result;
      } catch (error) {
        return this.devChat(
          messages,
          error instanceof Error ? error.message : 'AI request failed',
        );
      }
    }
  }

  async chatStream(
    options: ChatOptions,
    onDelta: (delta: ChatDelta) => void,
  ): Promise<ChatResult> {
    if (!isNvidiaConfigured()) {
      const mock = this.devChat(options.messages);
      if (mock.content) onDelta({ content: mock.content });
      return mock;
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS;
    const failures: string[] = [];

    try {
      return await this.withTimeout(this.streamPrimary(options, onDelta), timeoutMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'stream failed';
      console.warn('[NVIDIA] Stream failed:', error);
      failures.push(message);
    }

    try {
      const result = await this.withTimeout(
        this.chatPrimary({ ...options, stream: false }),
        timeoutMs,
      );
      if (result.content) onDelta({ content: result.content });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'non-stream failed';
      console.warn('[NVIDIA] Non-stream retry failed:', error);
      failures.push(message);
    }

    const primaryModel = options.model ?? this.copilotModel;
    if (primaryModel !== this.fallbackModel) {
      try {
        const result = await this.withTimeout(
          this.chatPrimary({ ...options, model: this.fallbackModel, stream: false }),
          timeoutMs,
        );
        if (result.content) onDelta({ content: result.content });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'fallback failed';
        console.warn('[NVIDIA] Fallback model failed:', error);
        failures.push(message);
      }
    }

    const mock = this.devChat(
      options.messages,
      failures[failures.length - 1] ?? 'AI request failed',
    );
    if (mock.content) onDelta({ content: mock.content });
    return mock;
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    if (!isNvidiaConfigured()) {
      return this.devChat(options.messages);
    }

    if (options.useFallback) {
      return this.chatFallback(options.messages);
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS;

    try {
      return await this.withTimeout(this.chatPrimary(options), timeoutMs);
    } catch (error) {
      const sameModel = options.model === this.fallbackModel || this.copilotModel === this.fallbackModel;
      if (sameModel) {
        console.warn('[NVIDIA] Copilot model failed:', error);
        return this.devChat(
          options.messages,
          error instanceof Error ? error.message : 'AI request failed',
        );
      }
      console.warn('[NVIDIA] Primary model failed, using fallback:', error);
      try {
        return await this.withTimeout(this.chatFallback(options.messages), timeoutMs);
      } catch (fallbackError) {
        console.warn('[NVIDIA] Fallback failed:', fallbackError);
        return this.devChat(options.messages, 'AI request failed. Check NVIDIA_API_KEY and network.');
      }
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`AI request timed out after ${ms / 1000}s`)), ms);
      }),
    ]);
  }

  private devChat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    prefix?: string,
  ): ChatResult {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const query = lastUser?.content ?? '';
    if (prefix) {
      return {
        content: `Sorry, I couldn't get an AI response (${prefix}). Please try again.`,
        model: 'error',
      };
    }
    const intro =
      'Copilot is in dev mode — set a valid NVIDIA_API_KEY in .env for live AI responses.';
    const contextHint =
      'I can guide you through Environment (connect orgs, scratch orgs), Deployment Center (Azure, metadata, data), Monitoring, and User Access settings.';
    return {
      content: `${intro}\n\nYou said: "${query}"\n\n${contextHint}`,
      model: 'dev-mock',
    };
  }

  private buildPrimaryParams(options: ChatOptions, stream: boolean): Record<string, unknown> {
    const thinking = options.enableThinking ?? false;
    const params: Record<string, unknown> = {
      model: options.model ?? this.primaryModel,
      messages: options.messages,
      temperature: options.temperature ?? (thinking ? 1 : 0.2),
      top_p: options.topP ?? (thinking ? 0.95 : 0.7),
      max_tokens: options.maxTokens ?? 2048,
      stream,
      frequency_penalty: options.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? 0,
    };

    // Reasoning params only for models that support extended thinking (e.g. Nemotron)
    if (thinking) {
      params.reasoning_budget = 4096;
      params.chat_template_kwargs = { enable_thinking: true };
    }

    return params;
  }

  private chatCompletionsUrl(): string {
    const base = process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
    return `${base.replace(/\/$/, '')}/chat/completions`;
  }

  /** Direct REST call — matches NVIDIA NIM / axios examples (non-stream). */
  private async chatViaRest(options: ChatOptions): Promise<ChatResult> {
    const model = options.model ?? this.primaryModel;
    const timeoutMs = options.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS;
    const payload = {
      model,
      messages: options.messages,
      max_tokens: options.maxTokens ?? 512,
      temperature: options.temperature ?? 0.2,
      top_p: options.topP ?? 0.7,
      frequency_penalty: options.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? 0,
      stream: false,
    };

    const res = await fetch(this.chatCompletionsUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.useFallbackKey ? this.fallbackApiKey : this.primaryApiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`NVIDIA chat failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
    };
    const message = data.choices?.[0]?.message;

    return {
      content: message?.content ?? '',
      reasoning: message?.reasoning_content,
      model,
    };
  }

  private async chatPrimary(options: ChatOptions): Promise<ChatResult> {
    const useStream = options.stream ?? false;
    if (useStream) {
      return this.streamPrimary(options);
    }

    return this.chatViaRest(options);
  }

  private async streamPrimary(
    options: ChatOptions,
    onDelta?: (delta: ChatDelta) => void,
  ): Promise<ChatResult> {
    const model = options.model ?? this.primaryModel;
    const client = options.useFallbackKey ? this.fallbackClient : this.primaryClient;
    const stream = await client.chat.completions.create(
      this.buildPrimaryParams(options, true) as unknown as OpenAI.Chat.ChatCompletionCreateParamsStreaming,
    );

    let content = '';
    let reasoning = '';

    for await (const chunk of stream) {
      if (!chunk.choices?.length) continue;
      const delta = chunk.choices[0]?.delta as {
        content?: string;
        reasoning_content?: string;
      };
      if (delta.reasoning_content) {
        reasoning += delta.reasoning_content;
        onDelta?.({ reasoning: delta.reasoning_content });
      }
      if (delta.content) {
        content += delta.content;
        onDelta?.({ content: delta.content });
      }
    }

    return { content, reasoning, model };
  }

  private async chatFallback(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  ): Promise<ChatResult> {
    const nemotron = this.fallbackModel.includes('nemotron');
    return this.chatViaRest({
      messages: nemotron ? this.buildNemotronMessages(messages) : messages,
      model: this.fallbackModel,
      stream: false,
      maxTokens: nemotron ? 1024 : 512,
      temperature: nemotron ? 0 : 0.2,
      topP: nemotron ? 1 : 0.7,
      frequencyPenalty: 0,
      presencePenalty: 0,
      useFallbackKey: true,
    });
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.primaryClient.embeddings.create({
        model: process.env.NVIDIA_EMBEDDING_MODEL ?? 'nvidia/nv-embedqa-e5-v5',
        input: text,
      });
      return response.data[0]?.embedding ?? [];
    } catch {
      return this.simpleHashEmbed(text);
    }
  }

  private simpleHashEmbed(text: string, dims = 1024): number[] {
    const vec = new Array(dims).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % dims] += text.charCodeAt(i) / 255;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
