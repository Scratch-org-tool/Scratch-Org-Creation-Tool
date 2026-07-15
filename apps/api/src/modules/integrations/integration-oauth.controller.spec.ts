import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import type { IntegrationOAuthService } from './integration-oauth.service';
import { IntegrationOAuthCallbackController } from './integration-oauth.controller';

describe('IntegrationOAuthCallbackController', () => {
  it('redacts callback failures instead of reflecting provider or secret values', async () => {
    const oauth = {
      callback: vi.fn().mockRejectedValue(
        new Error('exchange failed: client_secret=server-secret&code=provider-code'),
      ),
      failureUrl: vi.fn().mockReturnValue(
        'https://app.example.test/environment-center?integration_status=error',
      ),
    } as unknown as IntegrationOAuthService;
    const response = {
      redirect: vi.fn(),
    } as unknown as Response;
    const controller = new IntegrationOAuthCallbackController(oauth);

    await controller.callback('jira', 'state', 'provider-code', undefined, response);

    expect(response.redirect).toHaveBeenCalledWith(
      303,
      'https://app.example.test/environment-center?integration_status=error',
    );
    const serialized = JSON.stringify((response.redirect as unknown as ReturnType<typeof vi.fn>).mock.calls);
    expect(serialized).not.toContain('server-secret');
    expect(serialized).not.toContain('provider-code');
  });
});
