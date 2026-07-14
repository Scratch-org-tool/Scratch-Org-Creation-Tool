/** Structured actions the Copilot can suggest; user must confirm before execution. */
export type CopilotAction =
  | { type: 'navigate'; href: string; label: string }
  | { type: 'open_tab'; href: string; tab: string; label: string }
  | { type: 'prefill_form'; formId: string; values: Record<string, string>; label: string }
  | { type: 'open_copilot'; query?: string };

export function isCopilotAction(value: unknown): value is CopilotAction {
  if (!value || typeof value !== 'object') return false;
  const t = (value as { type?: string }).type;
  return t === 'navigate' || t === 'open_tab' || t === 'prefill_form' || t === 'open_copilot';
}
