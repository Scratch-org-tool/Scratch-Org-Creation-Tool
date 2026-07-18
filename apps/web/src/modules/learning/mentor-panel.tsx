'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, CornerDownLeft, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';
import { askTutor } from './learning-api';

interface MentorMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface MentorPanelProps {
  lessonId?: string;
  moduleId?: string;
  /** Reset the conversation when the context changes. */
  contextKey: string;
  suggestions?: string[];
  className?: string;
}

const DEFAULT_SUGGESTIONS = [
  'Explain this topic with a real-world example.',
  'How does this come up in day-to-day admin work?',
  'Quiz me with one quick question on this lesson.',
];

/**
 * Interactive AI mentor: a compact chat grounded in the current lesson.
 * History is kept client-side and passed with each question.
 */
export function MentorPanel({
  lessonId,
  moduleId,
  contextKey,
  suggestions,
  className,
}: MentorPanelProps) {
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [followUps, setFollowUps] = useState<string[]>(suggestions ?? DEFAULT_SUGGESTIONS);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput('');
    setError(null);
    setFollowUps(suggestions ?? DEFAULT_SUGGESTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || busy) return;
      setBusy(true);
      setError(null);
      setInput('');
      const nextMessages: MentorMessage[] = [...messages, { role: 'user', content: trimmed }];
      setMessages(nextMessages);
      try {
        const reply = await askTutor({
          question: trimmed,
          lessonId,
          moduleId,
          history: messages.slice(-8),
        });
        setMessages([...nextMessages, { role: 'assistant', content: reply.answer }]);
        if (reply.suggestions.length > 0) setFollowUps(reply.suggestions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The mentor is unavailable right now');
        setMessages(messages);
        setInput(trimmed);
      } finally {
        setBusy(false);
      }
    },
    [busy, lessonId, moduleId, messages],
  );

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-violet-400/25 bg-card/60',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-violet-500/10 px-4 py-3">
        <div className="flex size-7 items-center justify-center rounded-lg bg-violet-500/20">
          <Bot className="size-4 text-violet-300" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">AI Mentor</p>
          <p className="text-[11px] text-muted-foreground">
            Ask anything about this lesson — answers include real-world examples.
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4 min-h-[180px]">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Try asking:</p>
            {followUps.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                className="block w-full rounded-lg border border-border/60 bg-secondary/20 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-violet-400/40 hover:text-foreground"
              >
                <Sparkles className="mr-1.5 inline size-3 text-violet-300" />
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={cn('flex gap-2.5', message.role === 'user' && 'justify-end')}
          >
            {message.role === 'assistant' && (
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-500/20">
                <Bot className="size-3.5 text-violet-300" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed',
                message.role === 'user'
                  ? 'bg-primary/15 text-foreground'
                  : 'bg-secondary/40 text-foreground/90',
              )}
            >
              {message.content}
            </div>
            {message.role === 'user' && (
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15">
                <User className="size-3.5 text-primary" />
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-500/20">
              <Bot className="size-3.5 text-violet-300" />
            </div>
            <div className="copilot-typing-dots">
              <span className="copilot-typing-dot" />
              <span className="copilot-typing-dot" />
              <span className="copilot-typing-dot" />
            </div>
          </div>
        )}

        {messages.length > 0 && !busy && followUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {followUps.slice(0, 3).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-violet-400/40 hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
            {error}
          </p>
        )}
      </div>

      <form
        className="border-t border-border/60 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            placeholder="Ask the mentor…"
            rows={1}
            className="min-h-9 max-h-28 resize-none text-xs"
            disabled={busy}
            aria-label="Ask the AI mentor a question"
          />
          <Button
            type="submit"
            size="icon"
            className="size-9 shrink-0"
            disabled={busy || input.trim().length === 0}
            aria-label="Send question"
          >
            <CornerDownLeft className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
