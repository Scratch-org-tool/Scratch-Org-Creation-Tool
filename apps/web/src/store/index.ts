import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CopilotAction } from '@sfcc/shared';

export type CopilotStreamStatus = 'idle' | 'connecting' | 'streaming' | 'error';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  isStreaming?: boolean;
  action?: CopilotAction | Record<string, unknown>;
  actionDismissed?: boolean;
}

interface CopilotState {
  isOpen: boolean;
  messages: CopilotMessage[];
  isLoading: boolean;
  streamStatus: CopilotStreamStatus;
  streamingMessageId?: string;
  streamStartedAt?: number;
  sessionId?: string;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  addMessage: (msg: Omit<CopilotMessage, 'id'> & { id?: string }) => string;
  updateMessage: (id: string, patch: Partial<CopilotMessage>) => void;
  appendToMessage: (id: string, field: 'content' | 'reasoning', chunk: string) => void;
  setLoading: (loading: boolean) => void;
  setStreamStatus: (status: CopilotStreamStatus, opts?: { messageId?: string; startedAt?: number }) => void;
  setSessionId: (id: string) => void;
  clear: () => void;
}

export function openCopilot() {
  useCopilotStore.getState().setOpen(true);
}

export const useCopilotStore = create<CopilotState>((set) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  streamStatus: 'idle',
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  addMessage: (msg) => {
    const id = msg.id ?? crypto.randomUUID();
    set((s) => ({
      messages: [...s.messages, { ...msg, id }],
    }));
    return id;
  },
  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  appendToMessage: (id, field, chunk) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, [field]: (m[field] ?? '') + chunk } : m,
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setStreamStatus: (streamStatus, opts) =>
    set({
      streamStatus,
      streamingMessageId: opts?.messageId,
      streamStartedAt: opts?.startedAt,
      ...(streamStatus === 'idle' ? { streamingMessageId: undefined, streamStartedAt: undefined } : {}),
    }),
  setSessionId: (sessionId) => set({ sessionId }),
  clear: () =>
    set({
      messages: [],
      sessionId: undefined,
      streamStatus: 'idle',
      streamingMessageId: undefined,
      streamStartedAt: undefined,
    }),
}));

interface AppState {
  persona: 'developer' | 'release_manager' | 'qa' | 'admin';
  setPersona: (p: AppState['persona']) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      persona: 'developer',
      setPersona: (persona) => set({ persona }),
    }),
    { name: 'sfcc-app-store' },
  ),
);
