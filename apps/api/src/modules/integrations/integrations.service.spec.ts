import { describe, expect, it, vi } from 'vitest';
import type { WorkItemAdapter } from '../../integrations/foundation/adapter.contracts';
import { WorkItemAdapterRegistry } from '../../integrations/foundation/adapter.registry';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsService work-item connection routing', () => {
  it('passes connectionId through detail and secondary-resource operations', async () => {
    const adapter = {
      provider: 'jira',
      getWorkItem: vi.fn(),
      getComments: vi.fn(),
      getStateOptions: vi.fn(),
      updateState: vi.fn(),
      getHistory: vi.fn(),
      listUsers: vi.fn(),
      listAttachments: vi.fn(),
      getAttachmentContent: vi.fn(),
      listSubIssues: vi.fn(),
    } as unknown as WorkItemAdapter;
    const service = new IntegrationsService(
      {} as never,
      {} as never,
      new WorkItemAdapterRegistry([adapter]),
      {} as never,
      {} as never,
    );
    const context = { connectionId: 'jira-second' };

    await service.detail('jira', 'CORE-1', 'CORE', context.connectionId);
    await service.comments('jira', 'CORE-1', 'CORE', context.connectionId);
    await service.states('jira', 'CORE-1', 'CORE', context.connectionId);
    await service.updateState('jira', 'CORE-1', 'Done', 'CORE', context.connectionId);
    await service.history('jira', 'CORE-1', 'CORE', context.connectionId);
    await service.users('jira', 'CORE', 'ada', context.connectionId);
    await service.attachments('jira', 'CORE-1', 'CORE', context.connectionId);
    await service.attachmentContent(
      'jira',
      'CORE-1',
      'attachment-1',
      'CORE',
      context.connectionId,
    );
    await service.subIssues('jira', 'CORE-1', 'CORE', context.connectionId);

    expect(adapter.getWorkItem).toHaveBeenCalledWith('CORE-1', 'CORE', context);
    expect(adapter.getComments).toHaveBeenCalledWith('CORE-1', 'CORE', context);
    expect(adapter.getStateOptions).toHaveBeenCalledWith('CORE-1', 'CORE', context);
    expect(adapter.updateState).toHaveBeenCalledWith('CORE-1', 'Done', 'CORE', context);
    expect(adapter.getHistory).toHaveBeenCalledWith('CORE-1', 'CORE', context);
    expect(adapter.listUsers).toHaveBeenCalledWith('CORE', 'ada', context);
    expect(adapter.listAttachments).toHaveBeenCalledWith('CORE-1', 'CORE', context);
    expect(adapter.getAttachmentContent).toHaveBeenCalledWith(
      'CORE-1',
      'attachment-1',
      'CORE',
      context,
    );
    expect(adapter.listSubIssues).toHaveBeenCalledWith('CORE-1', 'CORE', context);
  });

  it('passes the authenticated admin actor to GitHub attachment uploads', async () => {
    const adapter = {
      provider: 'github_issues',
      uploadAttachment: vi.fn().mockResolvedValue({ id: 'attachment-1' }),
    } as unknown as WorkItemAdapter;
    const service = new IntegrationsService(
      {} as never,
      {} as never,
      new WorkItemAdapterRegistry([adapter]),
      {} as never,
      {} as never,
    );

    await service.uploadAttachment(
      'admin-user',
      'github_issues',
      'acme/repo#7',
      {
        fileName: 'proof.txt',
        contentType: 'text/plain',
        buffer: Buffer.from('proof'),
      },
      'acme/repo',
      'github-connection',
    );

    expect(adapter.uploadAttachment).toHaveBeenCalledWith(
      'acme/repo#7',
      expect.objectContaining({
        fileName: 'proof.txt',
        contentType: 'text/plain',
        buffer: Buffer.from('proof'),
      }),
      'acme/repo',
      {
        connectionId: 'github-connection',
        actorId: 'admin-user',
        isAdmin: true,
      },
    );
  });
});
