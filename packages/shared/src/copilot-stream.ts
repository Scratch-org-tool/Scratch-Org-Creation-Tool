import type { CopilotAction } from './copilot-actions.js';

export type CopilotStreamEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'reasoning'; content: string }
  | { type: 'content'; content: string }
  | {
      type: 'done';
      sessionId: string;
      agentType: string;
      message: { content: string; reasoning?: string };
      action?: CopilotAction | Record<string, unknown>;
    }
  | { type: 'error'; message: string };

export type { CopilotAction } from './copilot-actions.js';
