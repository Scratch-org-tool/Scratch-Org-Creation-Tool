import type { ScratchOrgFormState } from '@/components/scratch-org/types';
import type { DesktopStep, MobileView } from './types';

export const SCRATCH_ORG_WORKSPACE_KEY = 'sfcc:scratch-org-workspace';

export interface ScratchOrgWorkspaceSnapshot {
  automationRunId: string;
  form: ScratchOrgFormState;
  installPackage: boolean;
  desktopStep: DesktopStep;
  wizardStep: 0 | 1;
  mobileView: MobileView;
  startedAt: string;
}

export function saveWorkspaceSnapshot(snapshot: ScratchOrgWorkspaceSnapshot): void {
  try {
    sessionStorage.setItem(SCRATCH_ORG_WORKSPACE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore quota errors */
  }
}

export function loadWorkspaceSnapshot(): ScratchOrgWorkspaceSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SCRATCH_ORG_WORKSPACE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScratchOrgWorkspaceSnapshot;
  } catch {
    return null;
  }
}

export function clearWorkspaceSnapshot(): void {
  try {
    sessionStorage.removeItem(SCRATCH_ORG_WORKSPACE_KEY);
  } catch {
    /* ignore */
  }
}
