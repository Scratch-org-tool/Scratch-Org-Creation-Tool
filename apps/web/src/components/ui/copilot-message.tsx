'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/utils/cn';

interface CopilotMessageContentProps {
  content: string;
  className?: string;
}

export function CopilotMessageContent({ content, className }: CopilotMessageContentProps) {
  return (
    <div className={cn('copilot-markdown', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 last:mb-0 ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 last:mb-0 ml-4 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-background/60 px-1 py-0.5 text-xs font-mono">{children}</code>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
