import type { AutomationRunView, ScratchOrgFormState } from '@/components/scratch-org/types';
import type { ScratchCredentials } from './types';
import { parseRuntimeEmailPool } from './template-v2-runtime';

export function runtimeEmailPoolOverride(value: string): { emails: string[] } | undefined {
  if (!value.trim()) return undefined;
  return { emails: parseRuntimeEmailPool(value) };
}

export function completedRunAlias(run: AutomationRunView): string | undefined {
  const alias = (run.config as { alias?: unknown } | undefined)?.alias;
  return typeof alias === 'string' && alias.trim() ? alias : undefined;
}

export function buildTemplateLaunchRequest(
  form: ScratchOrgFormState,
  gitSource: unknown,
  installPackage: boolean,
): Record<string, unknown> {
  return {
    alias: form.alias,
    duration: form.duration,
    devHubAlias: form.devHubAlias,
    description: form.description || undefined,
    sourceOrgId: form.dataDeploymentOrgId || form.sourceOrgId || undefined,
    dataDeploymentOrgId: form.dataDeploymentOrgId || form.sourceOrgId || undefined,
    customSettingsOrgId: form.customSettingsOrgId || undefined,
    templateId: form.templateId || undefined,
    gitSource,
    installPackage,
    runtimeEmailPoolOverride: runtimeEmailPoolOverride(form.runtimeEmailPool),
  };
}

export async function retrieveCredentialsWithRetry(
  alias: string,
  request: (alias: string) => Promise<ScratchCredentials>,
  options: { attempts?: number; delayMs?: number; wait?: (ms: number) => Promise<void> } = {},
): Promise<ScratchCredentials> {
  const attempts = options.attempts ?? 4;
  const delayMs = options.delayMs ?? 500;
  const wait = options.wait ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await request(alias);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await wait(delayMs * (attempt + 1));
    }
  }
  throw lastError;
}
