import type { WorkItemProvider } from './types';

export const WORK_ITEM_PROVIDERS: Array<{
  value: WorkItemProvider;
  label: string;
  shortLabel: string;
  setupTab: string;
}> = [
  { value: 'azure_boards', label: 'Azure Boards', shortLabel: 'Azure', setupTab: 'azure' },
  { value: 'github_issues', label: 'GitHub Issues', shortLabel: 'GitHub', setupTab: 'github' },
  { value: 'jira', label: 'Jira', shortLabel: 'Jira', setupTab: 'jira' },
];

export interface WorkItemContext {
  provider: WorkItemProvider;
  connectionId: string;
  bindingId: string;
  project: string;
}

export function isWorkItemProvider(value: string | null): value is WorkItemProvider {
  return WORK_ITEM_PROVIDERS.some((provider) => provider.value === value);
}

export function providerLabel(provider: WorkItemProvider): string {
  return WORK_ITEM_PROVIDERS.find((option) => option.value === provider)?.label ?? provider;
}

export function providerSetupHref(provider: WorkItemProvider): string {
  const tab = WORK_ITEM_PROVIDERS.find((option) => option.value === provider)?.setupTab ?? 'integrations';
  return `/environment-center?tab=${encodeURIComponent(tab)}`;
}

export function providerProjectUrl(
  provider: WorkItemProvider,
  project: { externalUrl?: string | null; url?: string | null; key: string } | null,
  connectionBaseUrl?: string | null,
): string | null {
  if (project?.externalUrl || project?.url) return project.externalUrl ?? project.url ?? null;
  if (provider === 'azure_boards' && connectionBaseUrl && project?.key) {
    return `${connectionBaseUrl.replace(/\/+$/, '')}/${encodeURIComponent(project.key)}/_boards`;
  }
  return null;
}

export function contextParams(context: WorkItemContext): URLSearchParams {
  const params = new URLSearchParams();
  if (context.connectionId) params.set('connectionId', context.connectionId);
  if (context.bindingId) params.set('bindingId', context.bindingId);
  if (context.project) params.set('project', context.project);
  return params;
}

export function providerEndpoint(provider: WorkItemProvider, suffix: string): string {
  const normalized = suffix.replace(/^\/+/, '');
  return `/defects/providers/${encodeURIComponent(provider)}/${normalized}`;
}

export function workItemEndpoint(
  context: WorkItemContext,
  id: string,
  suffix = '',
): string {
  const path = providerEndpoint(
    context.provider,
    `work-items/${encodeURIComponent(id)}${suffix ? `/${suffix.replace(/^\/+/, '')}` : ''}`,
  );
  const query = contextParams(context).toString();
  return query ? `${path}?${query}` : path;
}

export function defectsCacheKey(scope: string, context: WorkItemContext): string {
  return [
    'defects',
    scope,
    context.provider,
    context.connectionId || 'default-connection',
    context.bindingId || 'no-binding',
    context.project || 'no-project',
  ].map(encodeURIComponent).join(':');
}

export function projectValue(provider: WorkItemProvider, project: {
  id: string;
  key: string;
}): string {
  return provider === 'github_issues' ? project.id : project.key || project.id;
}

export function parseCsv(value: string): string[] {
  return [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))];
}

export function fileToBase64(file: File): Promise<string> {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  });
}
