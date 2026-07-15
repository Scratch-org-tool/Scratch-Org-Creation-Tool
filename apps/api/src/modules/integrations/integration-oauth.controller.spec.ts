import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { IntegrationOAuthService } from './integration-oauth.service';
import {
  IntegrationOAuthCallbackController,
  IntegrationOAuthController,
} from './integration-oauth.controller';

describe('IntegrationOAuthCallbackController', () => {
  it('sets a secure host-only browser-binding cookie without returning its value', async () => {
    const oauth = {
      start: vi.fn().mockResolvedValue({
        authorizationUrl: 'https://provider.test/authorize',
        provider: 'jira',
        state: 'S'.repeat(43),
        browserBinding: 'B'.repeat(43),
      }),
    } as unknown as IntegrationOAuthService;
    const response = { cookie: vi.fn() } as unknown as Response;
    const result = await new IntegrationOAuthController(oauth).start(
      'jira',
      'user-1',
      {},
      response,
    );
    expect(response.cookie).toHaveBeenCalledWith(
      `__Host-sfcc_oauth_${'S'.repeat(16)}`,
      'B'.repeat(43),
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
    expect(result).not.toHaveProperty('browserBinding');
  });

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
      clearCookie: vi.fn(),
    } as unknown as Response;
    const controller = new IntegrationOAuthCallbackController(oauth);

    await controller.callback(
      'jira',
      'S'.repeat(43),
      'provider-code',
      undefined,
      { headers: { cookie: `__Host-sfcc_oauth_${'S'.repeat(16)}=${'B'.repeat(43)}` } } as Request,
      response,
    );

    expect(response.redirect).toHaveBeenCalledWith(
      303,
      'https://app.example.test/environment-center?integration_status=error',
    );
    const serialized = JSON.stringify((response.redirect as unknown as ReturnType<typeof vi.fn>).mock.calls);
    expect(serialized).not.toContain('server-secret');
    expect(serialized).not.toContain('provider-code');
  });
});
