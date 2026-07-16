/**
 * Shared contracts for the admin User Access section: the security audit-event
 * views surfaced in "Activity Logs", plus pagination guards. Sensitive audit
 * columns (ipHash, userAgentHash) are intentionally excluded from these views.
 */

export type AuditMetadataValue = string | number | boolean | null;

export interface AuthAuditEventView {
  id: string;
  userId: string | null;
  eventType: string;
  metadata: Record<string, AuditMetadataValue> | null;
  createdAt: string;
}

export interface AuthAuditEventsPage {
  events: AuthAuditEventView[];
  total: number;
  limit: number;
  offset: number;
}

/** Human-friendly labels for known audit event types. */
export const AUTH_AUDIT_EVENT_LABELS: Record<string, string> = {
  profile_update_success: 'Profile updated',
  profile_update_failed: 'Profile update failed',
  password_change_success: 'Password changed',
  password_change_failed: 'Password change failed',
  sessions_revoked: 'Sessions revoked',
  password_reset_requested: 'Password reset requested',
  user_access_updated: 'User access updated',
  user_access_update_denied: 'User access change denied',
};

export function auditEventLabel(eventType: string): string {
  return (
    AUTH_AUDIT_EVENT_LABELS[eventType] ??
    eventType.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Failed/denied events that should read as warnings in the UI. */
export function isAuditEventFailure(eventType: string): boolean {
  return /(_failed|_denied)$/.test(eventType);
}

export const AUDIT_EVENTS_DEFAULT_LIMIT = 25;
export const AUDIT_EVENTS_MAX_LIMIT = 100;

export function clampAuditLimit(value: unknown): number {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return AUDIT_EVENTS_DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), AUDIT_EVENTS_MAX_LIMIT);
}

export function clampAuditOffset(value: unknown): number {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}
