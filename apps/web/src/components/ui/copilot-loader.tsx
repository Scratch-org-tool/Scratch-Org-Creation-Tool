import type { CopilotStreamStatus } from '@/store';

interface CopilotThinkingBubbleProps {
  elapsedSec?: number;
  status?: CopilotStreamStatus;
}

/** Assistant-style typing indicator with visible status label */
export function CopilotThinkingBubble({ elapsedSec = 0, status = 'connecting' }: CopilotThinkingBubbleProps) {
  const label =
    status === 'connecting'
      ? `Connecting${elapsedSec > 0 ? `… ${elapsedSec}s` : '…'}`
      : `Thinking${elapsedSec > 0 ? `… ${elapsedSec}s` : '…'}`;

  return (
    <div className="flex justify-start" aria-live="polite" aria-label="Copilot is thinking">
      <div className="bg-muted/60 border border-border/60 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm max-w-[88%]">
        <p className="text-xs text-muted-foreground mb-2">{label}</p>
        <div className="copilot-typing-dots">
          <span className="copilot-typing-dot" />
          <span className="copilot-typing-dot" />
          <span className="copilot-typing-dot" />
        </div>
      </div>
    </div>
  );
}
