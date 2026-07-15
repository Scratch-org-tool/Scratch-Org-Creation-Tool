/**
 * Normalize Azure DevOps org slug — users often paste full URLs like
 * https://dev.azure.com/my-org which would put ":" in the request path.
 */
export function normalizeAzureOrgSlug(input: string): string {
  let value = input.trim();
  if (!value) return value;

  const devAzureMatch = value.match(/(?:https?:\/\/)?dev\.azure\.com\/([^/?#]+)/i);
  if (devAzureMatch) return devAzureMatch[1];

  const legacyMatch = value.match(/^(?:https?:\/\/)?([^.]+)\.visualstudio\.com/i);
  if (legacyMatch) return legacyMatch[1];

  value = value.replace(/^https?:\/\//i, '');
  value = value.replace(/^dev\.azure\.com\//i, '');
  return value.split('/')[0].split('?')[0].split('#')[0].trim();
}

/** Normalize project name; supports pasted project URLs. */
export function normalizeAzureProject(input?: string | null): string | undefined {
  if (!input?.trim()) return undefined;
  let value = input.trim();

  const devAzureMatch = value.match(/(?:https?:\/\/)?dev\.azure\.com\/[^/]+\/([^/?#]+)/i);
  if (devAzureMatch) return decodeURIComponent(devAzureMatch[1]);

  value = value.replace(/^https?:\/\//i, '');
  value = value.replace(/^dev\.azure\.com\/[^/]+\//i, '');
  const segment = value.split('/').filter(Boolean).pop() ?? value;
  return segment.trim() || undefined;
}

export function azureGitReposUrl(orgSlug: string, project?: string, query = 'api-version=7.0'): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const proj = normalizeAzureProject(project);
  if (proj) {
    return `https://dev.azure.com/${org}/${encodeURIComponent(proj)}/_apis/git/repositories?${query}`;
  }
  return `https://dev.azure.com/${org}/_apis/git/repositories?${query}`;
}

/** List projects — reliable PAT/org verification endpoint. */
export function azureProjectsUrl(orgSlug: string, query = 'api-version=7.0&$top=1'): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  return `https://dev.azure.com/${org}/_apis/projects?${query}`;
}

/** Fetch a single project by name or id. */
export function azureProjectUrl(orgSlug: string, project: string, query = 'api-version=7.0'): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const proj = encodeURIComponent(normalizeAzureProject(project) ?? project);
  return `https://dev.azure.com/${org}/_apis/projects/${proj}?${query}`;
}

export function azureGitBranchesUrl(
  orgSlug: string,
  project: string,
  repo: string,
  query = 'filter=heads/&api-version=7.0',
): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const proj = encodeURIComponent(normalizeAzureProject(project) ?? project);
  const repoEnc = encodeURIComponent(repo);
  return `https://dev.azure.com/${org}/${proj}/_apis/git/repositories/${repoEnc}/refs?${query}`;
}

export function azureWiqlUrl(orgSlug: string, project: string, query = 'api-version=7.0'): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const proj = encodeURIComponent(normalizeAzureProject(project) ?? project);
  return `https://dev.azure.com/${org}/${proj}/_apis/wit/wiql?${query}`;
}

export function azureWorkItemsBatchUrl(
  orgSlug: string,
  ids: number[],
  query = 'api-version=7.0&$expand=all',
): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const idList = ids.join(',');
  return `https://dev.azure.com/${org}/_apis/wit/workitems?ids=${idList}&${query}`;
}

export function azureWorkItemUrl(
  orgSlug: string,
  project: string,
  id: number,
  query = 'api-version=7.0&$expand=all',
): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const proj = encodeURIComponent(normalizeAzureProject(project) ?? project);
  return `https://dev.azure.com/${org}/${proj}/_apis/wit/workitems/${id}?${query}`;
}

export function azureWorkItemCreateUrl(
  orgSlug: string,
  project: string,
  workItemType: string,
  query = 'api-version=7.0',
): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const proj = encodeURIComponent(normalizeAzureProject(project) ?? project);
  return `https://dev.azure.com/${org}/${proj}/_apis/wit/workitems/$${encodeURIComponent(workItemType)}?${query}`;
}

export function azureWorkItemCommentsUrl(
  orgSlug: string,
  project: string,
  id: number,
  query = 'api-version=7.0-preview.3&$top=100',
): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const proj = encodeURIComponent(normalizeAzureProject(project) ?? project);
  return `https://dev.azure.com/${org}/${proj}/_apis/wit/workItems/${id}/comments?${query}`;
}

export function azureWorkItemTypesStatesUrl(
  orgSlug: string,
  project: string,
  workItemType: string,
  query = 'api-version=7.0',
): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const proj = encodeURIComponent(normalizeAzureProject(project) ?? project);
  const type = encodeURIComponent(workItemType);
  return `https://dev.azure.com/${org}/${proj}/_apis/wit/workitemtypes/${type}/states?${query}`;
}

export function azureWorkItemTypesUrl(
  orgSlug: string,
  project: string,
  query = 'api-version=7.0',
): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const proj = encodeURIComponent(normalizeAzureProject(project) ?? project);
  return `https://dev.azure.com/${org}/${proj}/_apis/wit/workitemtypes?${query}`;
}

export function azureWorkItemWebUrl(orgSlug: string, project: string, id: number): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const proj = encodeURIComponent(normalizeAzureProject(project) ?? project);
  return `https://dev.azure.com/${org}/${proj}/_workitems/edit/${id}`;
}

export function azureWorkItemUpdatesUrl(
  orgSlug: string,
  project: string,
  id: number,
  query = 'api-version=7.1&$top=100',
): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const proj = encodeURIComponent(normalizeAzureProject(project) ?? project);
  return `https://dev.azure.com/${org}/${proj}/_apis/wit/workitems/${id}/updates?${query}`;
}

export function azureWitAttachmentUrl(
  orgSlug: string,
  attachmentGuid: string,
  query = 'api-version=7.0',
): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  const guid = encodeURIComponent(attachmentGuid);
  return `https://dev.azure.com/${org}/_apis/wit/attachments/${guid}?${query}`;
}

export function azureWitAttachmentsUrl(
  orgSlug: string,
  fileName: string,
  query = 'api-version=7.0',
): string {
  const org = encodeURIComponent(normalizeAzureOrgSlug(orgSlug));
  return `https://dev.azure.com/${org}/_apis/wit/attachments?fileName=${encodeURIComponent(fileName)}&${query}`;
}
