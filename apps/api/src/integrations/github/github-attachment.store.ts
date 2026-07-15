import { Injectable } from '@nestjs/common';
import type { WorkItemAttachment } from '@sfcc/shared';
import { IntegrationError } from '../foundation/adapter.errors';

export interface AppManagedAttachmentInput {
  workItemId: string;
  name: string;
  contentType: string;
  content: Buffer;
  authorId?: string;
}

/**
 * Attachment bytes must live in an app-controlled encrypted blob provider. GitHub issue-body
 * links are intentionally not considered attachments because their access controls can differ.
 */
export interface GitHubAttachmentStore {
  readonly available: boolean;
  list(workItemId: string): Promise<WorkItemAttachment[]>;
  put(input: AppManagedAttachmentInput): Promise<WorkItemAttachment>;
  get(workItemId: string, attachmentId: string): Promise<Buffer>;
}

@Injectable()
export class DisabledGitHubAttachmentStore implements GitHubAttachmentStore {
  readonly available = false;

  async list(_workItemId: string): Promise<WorkItemAttachment[]> {
    return [];
  }

  async put(_input: AppManagedAttachmentInput): Promise<WorkItemAttachment> {
    throw this.unsupported();
  }

  async get(_workItemId: string, _attachmentId: string): Promise<Buffer> {
    throw this.unsupported();
  }

  private unsupported(): IntegrationError {
    return new IntegrationError(
      'unsupported_capability',
      'GitHub attachments require an app-managed encrypted attachment provider',
      { provider: 'github_issues' },
    );
  }
}
