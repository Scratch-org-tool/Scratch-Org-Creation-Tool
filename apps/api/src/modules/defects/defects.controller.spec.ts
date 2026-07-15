import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '../../common/auth.guard';
import { DefectsController } from './defects.controller';
import type { DefectsService } from './defects.service';

describe('DefectsController', () => {
  it('discovers selectable contexts using the current authorization role', async () => {
    const service = {
      listContexts: vi.fn().mockResolvedValue({ connections: [], bindings: [] }),
    } as unknown as DefectsService;
    const controller = new DefectsController(service);

    await controller.listContexts(
      { userProfile: { role: 'user' } } as AuthenticatedRequest,
      'app-user',
    );

    expect(service.listContexts).toHaveBeenCalledWith('app-user', false);
  });

  it('forwards opaque external ids and provider/binding selection unchanged', async () => {
    const service = {
      getWorkItem: vi.fn().mockResolvedValue({ id: 'CORE-123' }),
    } as unknown as DefectsService;
    const controller = new DefectsController(service);
    const request = {
      userProfile: { role: 'user' },
    } as AuthenticatedRequest;

    await controller.getWorkItem(
      request,
      'app-user',
      'CORE-123',
      { bindingId: 'binding-1' },
      'jira',
    );

    expect(service.getWorkItem).toHaveBeenCalledWith(
      'app-user',
      false,
      'CORE-123',
      { provider: 'jira', bindingId: 'binding-1' },
    );
  });

  it('preserves numeric Azure ids as strings until the Azure adapter boundary', async () => {
    const service = {
      updateState: vi.fn().mockResolvedValue({ id: 42 }),
    } as unknown as DefectsService;
    const controller = new DefectsController(service);

    await controller.updateState(
      { userProfile: { role: 'admin' } } as AuthenticatedRequest,
      'admin-user',
      '42',
      { state: 'Done' },
      { project: 'Core' },
    );

    expect(service.updateState).toHaveBeenCalledWith(
      'admin-user',
      true,
      '42',
      { state: 'Done' },
      { project: 'Core' },
    );
  });
});
