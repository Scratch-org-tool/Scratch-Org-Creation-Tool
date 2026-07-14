import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AZURE_DEFECT_WORK_ITEM_TYPES,
  azureWiqlUrl,
  azureWitAttachmentUrl,
  azureWorkItemCommentsUrl,
  azureWorkItemTypesStatesUrl,
  azureWorkItemUpdatesUrl,
  azureWorkItemUrl,
  azureWorkItemWebUrl,
  azureWorkItemsBatchUrl,
  azureProjectsUrl,
  normalizeAzureProject,
  stripHtmlForDisplay,
  type AzureDevOpsProjectOption,
  type AzureWorkItemAttachment,
  type AzureWorkItemComment,
  type AzureWorkItemDetail,
  type AzureWorkItemHistoryEvent,
  type AzureWorkItemHistoryResponse,
  type AzureWorkItemStateOption,
  type AzureWorkItemSummary,
} from '@sfcc/shared';
import { AzureIntegrationService } from '../../modules/integrations/azure-integration.service';

type AdoFieldValue = string | number | { displayName?: string; uniqueName?: string } | null | undefined;

interface AdoWorkItemFields {
  'System.Id'?: number;
  'System.Title'?: string;
  'System.State'?: string;
  'System.WorkItemType'?: string;
  'System.AssignedTo'?: AdoFieldValue;
  'System.ChangedDate'?: string;
  'System.CreatedDate'?: string;
  'System.Tags'?: string;
  'System.Description'?: string;
  'Microsoft.VSTS.TCM.ReproSteps'?: string;
  'Microsoft.VSTS.Common.AcceptanceCriteria'?: string;
  'System.AreaPath'?: string;
  'System.IterationPath'?: string;
  'Microsoft.VSTS.Common.Priority'?: number;
  'Microsoft.VSTS.Common.Severity'?: string;
  'System.TeamProject'?: string;
}

interface AdoWorkItem {
  id: number;
  fields: AdoWorkItemFields;
  relations?: Array<{
    rel: string;
    url: string;
    attributes?: { name?: string; comment?: string; resourceSize?: number };
  }>;
}

@Injectable()
export class AzureWorkItemsService {
  constructor(private readonly azureIntegration: AzureIntegrationService) {}

  async resolveProject(projectOverride?: string): Promise<{ orgSlug: string; project: string; pat: string }> {
    const creds = await this.azureIntegration.getCredentials();
    if (!creds) {
      throw new NotFoundException({
        code: 'AZURE_NOT_CONNECTED',
        message: 'Azure DevOps is not connected. Link it in Environment Center → Integrations.',
      });
    }
    const project =
      normalizeAzureProject(projectOverride) ??
      normalizeAzureProject(creds.project) ??
      normalizeAzureProject(process.env.AZURE_DEFAULT_PROJECT);
    if (!project) {
      throw new UnprocessableEntityException({
        code: 'AZURE_PROJECT_REQUIRED',
        message: 'Select an Azure DevOps project in Developer Board, or set a default project in Integrations.',
      });
    }
    return { orgSlug: creds.orgSlug, project, pat: creds.pat };
  }

  async resolveDefaultProject(): Promise<string | null> {
    const creds = await this.azureIntegration.getCredentials();
    if (!creds) return null;
    return (
      normalizeAzureProject(creds.project) ??
      normalizeAzureProject(process.env.AZURE_DEFAULT_PROJECT) ??
      null
    );
  }

  async getConnectionInfo(): Promise<{ orgSlug: string; defaultProject: string | null } | null> {
    const creds = await this.azureIntegration.getCredentials();
    if (!creds) return null;
    return {
      orgSlug: creds.orgSlug,
      defaultProject:
        normalizeAzureProject(creds.project) ??
        normalizeAzureProject(process.env.AZURE_DEFAULT_PROJECT) ??
        null,
    };
  }

  async listProjects(): Promise<AzureDevOpsProjectOption[]> {
    const creds = await this.azureIntegration.getCredentials();
    if (!creds) {
      throw new NotFoundException({
        code: 'AZURE_NOT_CONNECTED',
        message: 'Azure DevOps is not connected. Link it in Environment Center → Integrations.',
      });
    }

    const data = await this.fetchJson<{
      value: Array<{ id: string; name: string; description?: string }>;
    }>(azureProjectsUrl(creds.orgSlug, 'api-version=7.0&$top=100&stateFilter=WellFormed'), creds.pat);

    return (data.value ?? [])
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description?.trim() || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async queryWorkItems(options: {
    project?: string;
    assigneeEmail?: string;
    types?: readonly string[];
  }): Promise<AzureWorkItemSummary[]> {
    const { orgSlug, project, pat } = await this.resolveProject(options.project);
    const types = options.types ?? AZURE_DEFECT_WORK_ITEM_TYPES;
    const typeList = types.map((t) => `'${t.replace(/'/g, "''")}'`).join(',');
    let where = `[System.TeamProject] = '${project.replace(/'/g, "''")}' AND [System.WorkItemType] IN (${typeList}) AND [System.State] <> 'Removed'`;
    if (options.assigneeEmail) {
      const email = options.assigneeEmail.replace(/'/g, "''");
      where += ` AND [System.AssignedTo] CONTAINS '${email}'`;
    }
    const wiql = `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo], [System.ChangedDate], [Microsoft.VSTS.Common.Priority] FROM WorkItems WHERE ${where} ORDER BY [System.ChangedDate] DESC`;

    const wiqlRes = await this.fetchJson<{ workItems: Array<{ id: number }> }>(
      azureWiqlUrl(orgSlug, project),
      pat,
      { method: 'POST', body: JSON.stringify({ query: wiql }) },
    );

    const ids = (wiqlRes.workItems ?? []).map((w) => w.id);
    if (ids.length === 0) return [];

    const items: AzureWorkItemSummary[] = [];
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const batch = await this.fetchJson<{ value: AdoWorkItem[] }>(
        azureWorkItemsBatchUrl(orgSlug, chunk),
        pat,
      );
      for (const wi of batch.value ?? []) {
        items.push(this.toSummary(wi, orgSlug, project));
      }
    }
    return items;
  }

  async getWorkItem(id: number, projectOverride?: string): Promise<AzureWorkItemDetail> {
    const { orgSlug, project, pat } = await this.resolveProject(projectOverride);
    const wi = await this.fetchJson<AdoWorkItem>(azureWorkItemUrl(orgSlug, project, id), pat);
    return this.toDetail(wi, orgSlug, project);
  }

  async getComments(id: number, projectOverride?: string): Promise<AzureWorkItemComment[]> {
    const { orgSlug, project, pat } = await this.resolveProject(projectOverride);
    const data = await this.fetchJson<{
      comments: Array<{
        id: number;
        text: string;
        createdBy?: { displayName?: string };
        createdDate?: string;
        modifiedDate?: string;
      }>;
    }>(azureWorkItemCommentsUrl(orgSlug, project, id), pat);

    return (data.comments ?? []).map((c) => ({
      id: c.id,
      text: c.text ?? '',
      author: c.createdBy?.displayName ?? 'Unknown',
      createdDate: c.createdDate ?? '',
      modifiedDate: c.modifiedDate ?? c.createdDate ?? '',
    }));
  }

  async getStateOptions(workItemType: string, projectOverride?: string): Promise<AzureWorkItemStateOption[]> {
    const { orgSlug, project, pat } = await this.resolveProject(projectOverride);
    const data = await this.fetchJson<{
      value: Array<{ name: string; category: string }>;
    }>(azureWorkItemTypesStatesUrl(orgSlug, project, workItemType), pat);
    return (data.value ?? []).map((s) => ({ name: s.name, category: s.category }));
  }

  async getHistory(id: number, projectOverride?: string): Promise<AzureWorkItemHistoryResponse> {
    const { orgSlug, project, pat } = await this.resolveProject(projectOverride);

    const [updatesData, comments] = await Promise.all([
      this.fetchJson<{
        value: Array<{
          id: number;
          rev: number;
          revisedBy?: { displayName?: string };
          revisedDate?: string;
          fields?: Record<string, { oldValue?: unknown; newValue?: unknown }>;
          relations?: {
            added?: Array<{
              rel: string;
              url: string;
              attributes?: { name?: string; comment?: string };
            }>;
            removed?: Array<{
              rel: string;
              url: string;
              attributes?: { name?: string; comment?: string };
            }>;
          };
        }>;
      }>(azureWorkItemUpdatesUrl(orgSlug, project, id), pat),
      this.getComments(id, project),
    ]);

    const meaningfulFields = new Set([
      'System.State',
      'System.Title',
      'System.AssignedTo',
      'System.Description',
      'System.Tags',
      'System.AreaPath',
      'System.IterationPath',
      'System.WorkItemType',
      'Microsoft.VSTS.Common.Priority',
      'Microsoft.VSTS.Common.Severity',
      'Microsoft.VSTS.TCM.ReproSteps',
      'Microsoft.VSTS.Common.AcceptanceCriteria',
      'System.CreatedBy',
    ]);

    const events: AzureWorkItemHistoryEvent[] = [];

    for (const update of updatesData.value ?? []) {
      const revisedBy = update.revisedBy?.displayName ?? 'Unknown';
      const revisedDate = update.revisedDate ?? '';
      const rev = update.rev;

      const changes = Object.entries(update.fields ?? {})
        .filter(([fieldRef]) => meaningfulFields.has(fieldRef))
        .map(([fieldRef, delta]) => ({
          field: this.fieldLabel(fieldRef),
          fieldRef,
          oldValue: this.formatFieldValue(delta.oldValue),
          newValue: this.formatFieldValue(delta.newValue),
        }))
        .filter((c) => c.oldValue !== c.newValue);

      if (changes.length > 0) {
        const typeChange = changes.find((c) => c.fieldRef === 'System.WorkItemType');
        const typeName = typeChange?.newValue ?? 'Work item';
        events.push({
          id: `update-${update.id}-fields`,
          kind: rev === 1 ? 'created' : 'updated',
          rev,
          revisedBy,
          revisedDate,
          summary:
            rev === 1
              ? `Created the ${typeName}`
              : this.historySummary(rev, changes),
          changes,
        });
      }

      for (const [index, rel] of (update.relations?.added ?? []).entries()) {
        if (rel.rel !== 'AttachedFile') continue;
        const name = this.relationAttachmentName(rel);
        events.push({
          id: `update-${update.id}-att-add-${index}`,
          kind: 'attachment_added',
          rev,
          revisedBy,
          revisedDate,
          summary: name ? `Added attachment: ${name}` : 'Added an attachment',
          changes: [],
          body: name,
        });
      }

      for (const [index, rel] of (update.relations?.removed ?? []).entries()) {
        if (rel.rel !== 'AttachedFile') continue;
        const name = this.relationAttachmentName(rel);
        events.push({
          id: `update-${update.id}-att-rm-${index}`,
          kind: 'attachment_removed',
          rev,
          revisedBy,
          revisedDate,
          summary: name ? `Removed attachment: ${name}` : 'Removed an attachment',
          changes: [],
          body: name,
        });
      }
    }

    for (const comment of comments) {
      events.push({
        id: `comment-${comment.id}`,
        kind: 'comment',
        rev: 0,
        revisedBy: comment.author,
        revisedDate: comment.createdDate,
        summary: 'Added a comment',
        changes: [],
        body: comment.text,
      });
    }

    events.sort(
      (a, b) => new Date(a.revisedDate).getTime() - new Date(b.revisedDate).getTime(),
    );

    return { events };
  }

  async listAttachments(id: number, projectOverride?: string): Promise<AzureWorkItemAttachment[]> {
    const detail = await this.getWorkItem(id, projectOverride);
    return this.parseAttachments(detail);
  }

  async getAttachmentContent(
    orgSlug: string,
    attachmentGuid: string,
    pat: string,
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    const url = azureWitAttachmentUrl(orgSlug, attachmentGuid);
    const res = await fetch(url, { headers: this.authHeader(pat) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new ForbiddenException({
          code: 'AZURE_WIT_SCOPE',
          message:
            'PAT lacks Work Items (Read) scope. Update your Azure PAT and reconnect in Integrations.',
        });
      }
      throw new UnprocessableEntityException(
        `Failed to fetch attachment (${res.status}). ${text.slice(0, 200)}`,
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
    const disposition = res.headers.get('content-disposition') ?? '';
    const nameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
    const fileName = nameMatch ? decodeURIComponent(nameMatch[1].replace(/"/g, '')) : attachmentGuid;
    return { buffer, contentType, fileName };
  }

  async updateState(id: number, state: string, projectOverride?: string): Promise<AzureWorkItemDetail> {
    const { orgSlug, project, pat } = await this.resolveProject(projectOverride);
    const url = azureWorkItemUrl(orgSlug, project, id, 'api-version=7.0');
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.authHeader(pat),
        'Content-Type': 'application/json-patch+json',
      },
      body: JSON.stringify([{ op: 'add', path: '/fields/System.State', value: state }]),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new ForbiddenException({
          code: 'AZURE_WIT_SCOPE',
          message:
            'PAT lacks Work Items (Read & write) scope. Update your Azure PAT and reconnect in Integrations.',
        });
      }
      throw new UnprocessableEntityException(
        `Failed to update work item state (${res.status}). ${text.slice(0, 200)}`,
      );
    }
    const wi = (await res.json()) as AdoWorkItem;
    return this.toDetail(wi, orgSlug, project);
  }

  isAssignedToEmail(assignedTo: string | null, email: string): boolean {
    if (!assignedTo || !email) return false;
    return assignedTo.toLowerCase().includes(email.toLowerCase());
  }

  private authHeader(pat: string) {
    return { Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}` };
  }

  private async fetchJson<T>(
    url: string,
    pat: string,
    init?: RequestInit,
  ): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...this.authHeader(pat),
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new ForbiddenException({
          code: 'AZURE_WIT_SCOPE',
          message:
            'PAT lacks Work Items (Read) scope. Update your Azure PAT and reconnect in Integrations.',
        });
      }
      throw new UnprocessableEntityException(
        `Azure DevOps request failed (${res.status}). ${text.slice(0, 200)}`,
      );
    }
    return res.json() as Promise<T>;
  }

  private formatAssignedTo(value: AdoFieldValue): string | null {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      const name = value.displayName ?? '';
      const email = value.uniqueName ?? '';
      if (name && email) return `${name} <${email.replace(/^[^<]*<|>$/g, '')}>`;
      return name || email || null;
    }
    return String(value);
  }

  private formatFieldValue(value: unknown): string | null {
    if (value == null || value === '') return null;
    if (typeof value === 'object') {
      const obj = value as { displayName?: string; uniqueName?: string };
      if (obj.displayName) return obj.displayName;
      if (obj.uniqueName) return obj.uniqueName;
      return JSON.stringify(value);
    }
    const str = String(value);
    if (str.includes('<') && str.includes('>')) {
      return stripHtmlForDisplay(str);
    }
    return str;
  }

  private fieldLabel(fieldRef: string): string {
    const labels: Record<string, string> = {
      'System.State': 'State',
      'System.Title': 'Title',
      'System.AssignedTo': 'Assigned to',
      'System.Description': 'Description',
      'System.Tags': 'Tags',
      'System.AreaPath': 'Area',
      'System.IterationPath': 'Iteration',
      'System.WorkItemType': 'Type',
      'Microsoft.VSTS.Common.Priority': 'Priority',
      'Microsoft.VSTS.Common.Severity': 'Severity',
      'Microsoft.VSTS.TCM.ReproSteps': 'Repro steps',
      'Microsoft.VSTS.Common.AcceptanceCriteria': 'Acceptance criteria',
      'System.CreatedDate': 'Created',
      'System.CreatedBy': 'Created by',
    };
    return labels[fieldRef] ?? fieldRef.replace(/^System\.|^Microsoft\.VSTS\./, '').replace(/\./g, ' ');
  }

  private historySummary(
    rev: number,
    changes: Array<{ field: string; oldValue: string | null; newValue: string | null }>,
  ): string {
    if (changes.length === 0) return 'Updated';
    if (rev === 1) return 'Created';

    const stateChange = changes.find((c) => c.field === 'State');
    if (stateChange?.oldValue && stateChange.newValue) {
      const extra = changes.length > 1 ? ' and made field changes' : '';
      return `Changed State from ${stateChange.oldValue} to ${stateChange.newValue}${extra}`;
    }

    const primary = changes[0];
    if (primary.oldValue && primary.newValue) {
      const oldShort =
        primary.oldValue.length > 40 ? `${primary.oldValue.slice(0, 40)}…` : primary.oldValue;
      const newShort =
        primary.newValue.length > 40 ? `${primary.newValue.slice(0, 40)}…` : primary.newValue;
      const extra = changes.length > 1 ? ' and made field changes' : '';
      return `Changed ${primary.field} from ${oldShort} to ${newShort}${extra}`;
    }
    if (primary.newValue) {
      const val =
        primary.newValue.length > 50 ? `${primary.newValue.slice(0, 50)}…` : primary.newValue;
      return `Updated ${primary.field}: ${val}`;
    }
    return changes.length > 1 ? 'Made field changes' : primary.field;
  }

  private relationAttachmentName(rel: {
    url: string;
    attributes?: { name?: string };
  }): string {
    if (rel.attributes?.name) return rel.attributes.name;
    const segment = rel.url.split('/').pop()?.split('?')[0] ?? '';
    return segment ? decodeURIComponent(segment) : '';
  }

  private parseAttachments(detail: AzureWorkItemDetail): AzureWorkItemAttachment[] {
    return detail.relations
      .filter((r) => r.type === 'AttachedFile' || r.url.includes('/attachments/'))
      .map((r) => {
        const guidMatch = r.url.match(/\/attachments\/([a-f0-9-]+)/i);
        const id = guidMatch?.[1] ?? r.url.split('/').pop() ?? r.url;
        const nameFromUrl = r.url.split('/').pop()?.split('?')[0] ?? id;
        return {
          id,
          name: r.title && r.title !== nameFromUrl ? r.title : decodeURIComponent(nameFromUrl),
          sizeBytes: null,
          url: r.url,
          contentType: this.guessContentType(r.title || nameFromUrl),
        };
      });
  }

  private guessContentType(fileName: string): string | null {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      csv: 'text/csv',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      txt: 'text/plain',
    };
    return ext ? map[ext] ?? null : null;
  }

  private toSummary(wi: AdoWorkItem, orgSlug: string, project: string): AzureWorkItemSummary {
    const f = wi.fields ?? {};
    return {
      id: wi.id,
      title: f['System.Title'] ?? `Work Item ${wi.id}`,
      type: f['System.WorkItemType'] ?? 'Unknown',
      state: f['System.State'] ?? 'Unknown',
      priority: f['Microsoft.VSTS.Common.Priority'] ?? null,
      assignedTo: this.formatAssignedTo(f['System.AssignedTo']),
      changedDate: f['System.ChangedDate'] ?? '',
      createdDate: f['System.CreatedDate'] ?? '',
      tags: (f['System.Tags'] ?? '')
        .split(';')
        .map((t) => t.trim())
        .filter(Boolean),
      webUrl: azureWorkItemWebUrl(orgSlug, project, wi.id),
      project: f['System.TeamProject'] ?? project,
    };
  }

  private toDetail(wi: AdoWorkItem, orgSlug: string, project: string): AzureWorkItemDetail {
    const f = wi.fields ?? {};
    const summary = this.toSummary(wi, orgSlug, project);
    const relations = (wi.relations ?? []).map((r) => ({
      type: r.rel === 'AttachedFile' ? 'AttachedFile' : (r.attributes?.name ?? r.rel),
      title: this.attachmentTitle(r),
      url: r.url,
    }));
    return {
      ...summary,
      description: f['System.Description'] ?? null,
      reproSteps: f['Microsoft.VSTS.TCM.ReproSteps'] ?? null,
      acceptanceCriteria: f['Microsoft.VSTS.Common.AcceptanceCriteria'] ?? null,
      areaPath: f['System.AreaPath'] ?? null,
      iterationPath: f['System.IterationPath'] ?? null,
      severity: f['Microsoft.VSTS.Common.Severity'] ?? null,
      relations,
    };
  }

  private attachmentTitle(r: { rel: string; url: string; attributes?: { name?: string; comment?: string } }): string {
    if (r.attributes?.name) return r.attributes.name;
    const fromUrl = r.url.split('/').pop()?.split('?')[0] ?? r.url;
    return decodeURIComponent(fromUrl);
  }
}
