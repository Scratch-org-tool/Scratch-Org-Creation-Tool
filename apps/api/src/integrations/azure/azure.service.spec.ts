import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AzureIntegrationService } from '../../modules/integrations/azure-integration.service';
import { IntegrationError } from '../foundation/adapter.errors';
import { AzureService } from './azure.service';

function createService() {
  const integration = {
    getCredentials: vi.fn().mockResolvedValue({
      orgSlug: 'acme',
      project: 'Core',
      pat: 'secret-pat',
    }),
  } as unknown as AzureIntegrationService;
  return new AzureService(integration);
}

describe('AzureService branch listing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows Azure continuation tokens and de-duplicates branches', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [
          { name: 'refs/heads/main' },
          { name: 'refs/heads/release' },
        ],
      }), {
        status: 200,
        headers: { 'x-ms-continuationtoken': 'page-2' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [
          { name: 'refs/heads/release' },
          { name: 'refs/heads/feature/search' },
          { name: 'refs/tags/v1' },
        ],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createService().listBranches('Core', 'repo-id')).resolves.toEqual([
      'main',
      'release',
      'feature/search',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('$top=1000');
    expect(String(fetchMock.mock.calls[1][0])).toContain('continuationToken=page-2');
  });

  it('surfaces provider failures instead of presenting an empty branch list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('', { status: 403 }),
    ));

    const error = await createService()
      .listBranches('Core', 'repo-id')
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(IntegrationError);
    expect(error).toMatchObject({
      code: 'authorization_failed',
      options: { provider: 'azure_devops', statusCode: 403 },
    });
  });
});
