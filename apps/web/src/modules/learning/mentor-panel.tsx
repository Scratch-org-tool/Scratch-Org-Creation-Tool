'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Clapperboard,
  CornerDownLeft,
  Lightbulb,
  MessageSquare,
  Play,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  Wand2,
} from 'lucide-react';
import type { ExplainerFocus } from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';
import { askTutor } from './learning-api';
import { useSpeech } from './use-speech';

interface MentorMessage {
  role: 'user' | 'assistant';
  content: string;
}

type MentorMode = 'story' | 'chat';

interface MentorPanelProps {
  lessonId?: string;
  moduleId?: string;
  /** Reset the conversation when the context changes. */
  contextKey: string;
  /** Title of the lesson's real-world example (labels the scenario story). */
  realWorldTitle?: string;
  /** Launch the animated visual story player. */
  onPlayStory?: (focus: ExplainerFocus, question?: string) => void;
  suggestions?: string[];
  className?: string;
}

const DEFAULT_SUGGESTIONS = [
  'Explain this topic with a real-world example.',
  'How does this come up in day-to-day admin work?',
  'Quiz me with one quick question on this lesson.',
];

function StoryCard({
  icon: Icon,
  title,
  description,
  cta,
  onPlay,
}: {
  icon: typeof Clapperboard;
  title: string;
  description: string;
  cta: string;
  onPlay: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-secondary/20 p-3.5 transition-colors hover:border-violet-400/40">
      <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-violet-500/10 blur-2xl transition-colors group-hover:bg-violet-500/20" />
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
          <Button size="sm" className="mt-2.5 h-7 gap-1.5 text-xs" onClick={onPlay}>
            <Play className="size-3" />
            {cta}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * AI Mentor studio: "Story" mode plays AI-directed animated explainers with
 * voice narration; "Chat" mode is the classic Q&A tutor (replies can be read
 * aloud). Both are grounded in the current lesson.
 */
export function MentorPanel({
  lessonId,
  moduleId,
  contextKey,
  realWorldTitle,
  onPlayStory,
  suggestions,
  className,
}: MentorPanelProps) {
  const storyAvailable = Boolean(onPlayStory && lessonId);
  const [mode, setMode] = useState<MentorMode>(storyAvailable ? 'story' : 'chat');
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [followUps, setFollowUps] = useState<string[]>(suggestions ?? DEFAULT_SUGGESTIONS);
  const [input, setInput] = useState('');
  const [storyQuestion, setStoryQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readingIndex, setReadingIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const speech = useSpeech();

  useEffect(() => {
    setMessages([]);
    setInput('');
    setStoryQuestion('');
    setError(null);
    setFollowUps(suggestions ?? DEFAULT_SUGGESTIONS);
    setMode(storyAvailable ? 'story' : 'chat');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  useEffect(() => {
    if (!speech.speaking) setReadingIndex(null);
  }, [speech.speaking]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, mode]);

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

  const toggleRead = useCallback(
    (index: number, text: string) => {
      if (readingIndex === index) {
        speech.cancel();
        setReadingIndex(null);
        return;
      }
      setReadingIndex(index);
      speech.speak(text, { onEnd: () => setReadingIndex(null) });
    },
    [readingIndex, speech],
  );

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-violet-400/25 bg-card/60',
        className,
      )}
    >
      <div className="border-b border-border/60 bg-violet-500/10 px-4 pt-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-violet-500/20">
            <Bot className="size-4 text-violet-300" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">AI Mentor</p>
            <p className="text-[11px] text-muted-foreground">
              Build a mental movie — or ask anything about this lesson.
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex gap-1">
          {storyAvailable && (
            <button
              type="button"
              onClick={() => setMode('story')}
              aria-pressed={mode === 'story'}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-1.5 text-xs font-medium transition-colors',
                mode === 'story'
                  ? 'border-violet-400 text-violet-200'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Clapperboard className="size-3.5" />
              Story
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode('chat')}
            aria-pressed={mode === 'chat'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'chat'
                ? 'border-violet-400 text-violet-200'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <MessageSquare className="size-3.5" />
            Chat
          </button>
        </div>
      </div>

      {mode === 'story' && storyAvailable ? (
        <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4 min-h-[180px]">
          <form
            className="relative overflow-hidden rounded-xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 via-secondary/20 to-sky-500/10 p-3.5"
            onSubmit={(event) => {
              event.preventDefault();
              const question = storyQuestion.trim();
              if (!question) return;
              onPlayStory!('lesson', question);
              setStoryQuestion('');
            }}
          >
            <div className="pointer-events-none absolute -right-5 -top-8 size-24 rounded-full bg-sky-400/10 blur-2xl" />
            <p className="relative flex items-center gap-1.5 text-xs font-semibold">
              <Wand2 className="size-3.5 text-violet-300" />
              Turn your question into a concept film
            </p>
            <p className="relative mt-1 text-[11px] leading-relaxed text-muted-foreground">
              The mentor answers with a narrated real-world story and generated motion scenes—so
              you catch the concept just by listening.
            </p>
            <Textarea
              value={storyQuestion}
              onChange={(event) => setStoryQuestion(event.target.value)}
              placeholder="What should I finally understand? e.g. Why do governor limits exist?"
              maxLength={500}
              rows={2}
              className="relative mt-2 min-h-[58px] resize-none bg-background/55 text-xs"
            />
            <Button
              type="submit"
              size="sm"
              className="relative mt-2.5 h-8 w-full gap-1.5 text-xs"
              disabled={storyQuestion.trim().length === 0}
            >
              <Play className="size-3.5" />
              Create narrated answer
            </Button>
            <div className="relative mt-2 flex flex-wrap justify-center gap-1.5 text-[9px] text-muted-foreground">
              <span className="rounded-full bg-background/50 px-2 py-0.5">Story-first</span>
              <span className="rounded-full bg-background/50 px-2 py-0.5">Motion scenes</span>
              <span className="rounded-full bg-background/50 px-2 py-0.5">VibeVoice narrators</span>
            </div>
          </form>
          <StoryCard
            icon={Lightbulb}
            title="Catch the lesson concept"
            description="Live one real-world storyline that teaches the core idea in five scenes, then locks it into a single thought you can recall."
            cta="Play concept story"
            onPlay={() => onPlayStory!('lesson')}
          />
          <StoryCard
            icon={Sparkles}
            title={realWorldTitle ? `Apply it: ${realWorldTitle}` : 'Apply it to a case'}
            description="Optional: watch the tension, turning point, and consequence when the concept meets a realistic case."
            cta="Watch case story"
            onPlay={() => onPlayStory!('real-world')}
          />
          <p className="text-center text-[10px] text-muted-foreground">
            Choose the narrator, speed, voice, and captions inside the player.
          </p>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4 min-h-[180px]"
          >
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
                    'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                    message.role === 'user'
                      ? 'bg-primary/15 text-foreground'
                      : 'bg-secondary/40 text-foreground/90',
                  )}
                >
                  <span className="whitespace-pre-wrap">{message.content}</span>
                  {message.role === 'assistant' && speech.supported && (
                    <button
                      type="button"
                      onClick={() => toggleRead(index, message.content)}
                      aria-label={readingIndex === index ? 'Stop reading aloud' : 'Read aloud'}
                      className={cn(
                        'mt-1.5 flex items-center gap-1 text-[10px] transition-colors',
                        readingIndex === index
                          ? 'text-violet-300'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {readingIndex === index ? (
                        <>
                          <VolumeX className="size-3" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Volume2 className="size-3" />
                          Listen
                        </>
                      )}
                    </button>
                  )}
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
        </>
      )}
    </div>
  );
}
