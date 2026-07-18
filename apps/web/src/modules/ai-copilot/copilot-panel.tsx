'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bot, Send, ChevronDown, ChevronUp, X, Square, Mic, Volume2, VolumeX } from 'lucide-react';
import { getQuickPromptsForPath } from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { CopilotThinkingBubble } from '@/components/ui/copilot-loader';
import { CopilotMessageContent } from '@/components/ui/copilot-message';
import { cn } from '@/utils/cn';
import { useCopilotStore } from '@/store';
import { streamCopilotChat } from '@/hooks/use-copilot-stream';
import { useCopilotContext } from '@/hooks/use-copilot-context';
import { useVoiceSettings } from '@/hooks/use-voice-settings';
import { useCopilotVoice, type CopilotVoiceController } from '@/hooks/use-copilot-voice';
import { useAuth } from '@/contexts/auth-context';
import { CopilotActionCard } from '@/modules/ai-copilot/copilot-action-handler';

export function CopilotPanel() {
  const pathname = usePathname() ?? '/dashboard';
  const copilotContext = useCopilotContext();
  const quickPrompts = getQuickPromptsForPath(pathname);

  const {
    isOpen,
    messages,
    isLoading,
    streamStatus,
    streamingMessageId,
    streamStartedAt,
    sessionId,
    addMessage,
    updateMessage,
    appendToMessage,
    setLoading,
    setStreamStatus,
    setSessionId,
    setOpen,
    toggle,
  } = useCopilotStore();

  const { profile } = useAuth();
  const voiceConfig = useVoiceSettings();
  const [muteReplies, setMuteReplies] = useState(false);
  const voiceRef = useRef<CopilotVoiceController | null>(null);

  const [input, setInput] = useState('');
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [elapsedSec, setElapsedSec] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  const isBusy = isLoading || streamStatus === 'connecting' || streamStatus === 'streaming';
  const showThinkingBubble =
    streamStatus === 'connecting' ||
    (streamStatus === 'streaming' && !messages.find((m) => m.id === streamingMessageId)?.content);

  useEffect(() => {
    if (!isOpen) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, streamStatus]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      launcherRef.current?.focus();
    }
    // Never keep the mic or narration running once the panel is closed.
    voiceRef.current?.stopAll();
  }, [isOpen]);

  useEffect(() => {
    if (!isBusy || !streamStartedAt) {
      setElapsedSec(0);
      return;
    }
    const tick = () => setElapsedSec(Math.floor((Date.now() - streamStartedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isBusy, streamStartedAt]);

  const cancelStream = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (streamingMessageId) {
      updateMessage(streamingMessageId, { isStreaming: false });
    }
    setLoading(false);
    setStreamStatus('idle');
    voiceRef.current?.stopAll();
  };

  const sendMessage = async (text: string) => {
    const msg = text.trim();
    if (!msg || isBusy) return;
    setInput('');
    addMessage({ role: 'user', content: msg });

    const assistantId = addMessage({
      role: 'assistant',
      content: '',
      reasoning: '',
      isStreaming: true,
    });

    setLoading(true);
    setStreamStatus('connecting', { messageId: assistantId, startedAt: Date.now() });

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      await streamCopilotChat({
        message: msg,
        sessionId,
        context: copilotContext as unknown as Record<string, unknown>,
        signal: controller.signal,
        onSession: (id) => setSessionId(id),
        onContent: (chunk) => {
          setStreamStatus('streaming', {
            messageId: assistantId,
            startedAt: useCopilotStore.getState().streamStartedAt ?? Date.now(),
          });
          appendToMessage(assistantId, 'content', chunk);
        },
        onReasoning: (chunk) => {
          appendToMessage(assistantId, 'reasoning', chunk);
        },
        onDone: (event) => {
          setSessionId(event.sessionId);
          updateMessage(assistantId, {
            content: event.message.content,
            reasoning: event.message.reasoning,
            isStreaming: false,
            action: event.action,
          });
          voiceRef.current?.speakResponse(event.message.content);
        },
        onError: (message) => {
          updateMessage(assistantId, {
            content: `Error: ${message}`,
            isStreaming: false,
          });
          setStreamStatus('error');
        },
      });
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Request cancelled or timed out. Check that the API is running and NVIDIA_API_KEY is set.'
          : err instanceof Error
            ? err.message
            : 'Failed to get response';
      updateMessage(assistantId, {
        content: `Error: ${message}`,
        isStreaming: false,
      });
      setStreamStatus('error');
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      setLoading(false);
      setStreamStatus('idle');
      updateMessage(assistantId, { isStreaming: false });
      // Release the voice "thinking" state if the reply never reached onDone
      // (e.g. an error); a no-op once a spoken reply has already started.
      voiceRef.current?.speakResponse('');
    }
  };

  const send = () => void sendMessage(input);

  const voice = useCopilotVoice({
    settings: {
      ...voiceConfig.settings,
      speakResponses: voiceConfig.settings.speakResponses && !muteReplies,
    },
    available: voiceConfig.enabled,
    displayName: profile?.displayName,
    onCommand: (text) => {
      void sendMessage(text);
    },
  });
  voiceRef.current = voice;

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[55] bg-black/30 md:hidden"
          aria-label="Close copilot"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        id="ai-copilot-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-copilot-title"
        inert={!isOpen}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            return;
          }
          if (event.key !== 'Tab') return;
          const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          );
          if (!focusable?.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        className={cn(
          'fixed z-[60] flex flex-col pointer-events-none',
          'bottom-20 right-5 sm:right-8 sm:bottom-24',
          'w-[min(calc(100vw-2rem),400px)]',
          'max-h-[min(70vh,560px)]',
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-2 pointer-events-none',
          'transition-all duration-200 ease-out origin-bottom-right',
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex flex-col h-full max-h-[min(70vh,560px)] bg-card border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-card/95">
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="w-5 h-5 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <span id="ai-copilot-title" className="font-semibold text-sm block">AI Copilot</span>
                <span className="text-[10px] text-muted-foreground truncate block">
                  {copilotContext.pageTitle}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {voice.available && (
                <>
                  <button
                    type="button"
                    onClick={() => voice.toggleListening()}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      voice.listening
                        ? 'text-red-400 bg-red-500/15 hover:bg-red-500/25 animate-pulse'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                    )}
                    aria-label={voice.listening ? 'Stop voice listening' : 'Start voice listening'}
                    aria-pressed={voice.listening}
                    title={voice.listening ? 'Stop listening' : 'Talk to the Copilot'}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMuteReplies((m) => !m)}
                    className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary"
                    aria-label={muteReplies ? 'Unmute spoken replies' : 'Mute spoken replies'}
                    aria-pressed={!muteReplies}
                    title={muteReplies ? 'Spoken replies off' : 'Spoken replies on'}
                  >
                    {muteReplies ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </>
              )}
              {isBusy && (
                <button
                  type="button"
                  onClick={cancelStream}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary"
                  aria-label="Cancel response"
                  title="Cancel"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary"
                aria-label="Close copilot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-4 space-y-3">
                <Bot className="w-8 h-8 mx-auto opacity-50 text-purple-400" />
                <p>
                  I help you use this application — navigation, workflows, and troubleshooting on{' '}
                  <span className="text-foreground">{copilotContext.pageTitle}</span>.
                </p>
                {voice.available && (
                  <p className="text-xs text-muted-foreground/80">
                    Tip: tap the mic and say “{voiceConfig.settings.wakeWords[0]}” — I’ll greet you and
                    answer out loud.
                  </p>
                )}
                <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={isBusy}
                      onClick={() => void sendMessage(prompt)}
                      className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => {
              if (msg.role === 'assistant' && !msg.content && !msg.reasoning && msg.isStreaming) {
                return null;
              }
              return (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={cn(
                      'max-w-[88%] rounded-lg px-3 py-2 text-sm',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/80 border border-border/50 text-foreground',
                    )}
                  >
                    {msg.reasoning && (
                      <div className="mb-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedReasoning((s) => ({ ...s, [msg.id]: !s[msg.id] }))
                          }
                          className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
                          aria-expanded={Boolean(expandedReasoning[msg.id])}
                          aria-controls={`copilot-reasoning-${msg.id}`}
                        >
                          {expandedReasoning[msg.id] ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                          Thinking
                        </button>
                        {expandedReasoning[msg.id] && (
                          <pre
                            id={`copilot-reasoning-${msg.id}`}
                            className="mt-1 text-xs opacity-70 whitespace-pre-wrap"
                          >
                            {msg.reasoning}
                          </pre>
                        )}
                      </div>
                    )}
                    {msg.role === 'assistant' ? (
                      <>
                        {msg.content ? (
                          <CopilotMessageContent content={msg.content} />
                        ) : msg.isStreaming ? null : (
                          <p className="text-muted-foreground text-xs">No response.</p>
                        )}
                        {msg.isStreaming && msg.content && (
                          <span className="inline-block w-1.5 h-4 ml-0.5 bg-purple-400 animate-pulse align-middle" />
                        )}
                        {msg.action && !msg.actionDismissed && !msg.isStreaming && (
                          <CopilotActionCard
                            action={msg.action}
                            onDismiss={() => updateMessage(msg.id, { actionDismissed: true })}
                          />
                        )}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              );
            })}
            {showThinkingBubble && (
              <CopilotThinkingBubble elapsedSec={elapsedSec} status={streamStatus} />
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-border shrink-0 bg-card/95">
            {voice.available && (voice.error || voice.phase === 'listening' || voice.phase === 'thinking' || voice.phase === 'speaking') && (
              <div className="mb-2 flex items-center gap-2 text-xs" aria-live="polite">
                {voice.error ? (
                  <>
                    <span className="text-red-400 truncate flex-1">{voice.error}</span>
                    <button
                      type="button"
                      onClick={() => voice.clearError()}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Dismiss voice error"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className={cn(
                        'inline-flex h-2 w-2 shrink-0 rounded-full',
                        voice.phase === 'listening'
                          ? 'bg-red-400 animate-pulse'
                          : voice.phase === 'speaking'
                            ? 'bg-emerald-400'
                            : 'bg-purple-400',
                      )}
                    />
                    <span className="text-muted-foreground truncate">
                      {voice.phase === 'listening'
                        ? voice.interimTranscript || 'Listening…'
                        : voice.phase === 'thinking'
                          ? 'Thinking…'
                          : 'Speaking…'}
                    </span>
                  </>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask how to use this app..."
                className="min-h-[52px] resize-none text-sm"
                disabled={!isOpen}
                aria-label="Message AI Copilot"
              />
              <Button
                onClick={() => void send()}
                loading={isBusy}
                disabled={!isOpen || !input.trim()}
                size="sm"
                className="self-end shrink-0"
                aria-label="Send message"
              >
                {!isBusy && <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <button
        ref={launcherRef}
        type="button"
        onClick={() => toggle()}
        className={cn(
          'fixed z-[60] right-5 sm:right-8',
          isOpen ? 'bottom-5 sm:bottom-7' : 'bottom-[5.5rem] sm:bottom-[6.25rem]',
          'flex items-center justify-center rounded-full h-12 w-12 p-3',
          'bg-purple-600 hover:bg-purple-500 text-white',
          'shadow-lg shadow-purple-900/40 transition-all',
          isOpen && 'ring-2 ring-purple-400/50',
        )}
        aria-label={isOpen ? 'Close AI Copilot' : 'Open AI Copilot'}
        aria-expanded={isOpen}
        aria-controls="ai-copilot-panel"
        title={isOpen ? 'Close AI Copilot' : 'Ask AI Copilot'}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </button>
    </>
  );
}
