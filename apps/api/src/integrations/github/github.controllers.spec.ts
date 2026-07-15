import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ROLE_KEY } from '../../common/role.guard';
import { ProviderIntegrationController } from './github.controllers';

describe('provider-neutral GitHub administration routes', () => {
  it.each(['connect', 'verify', 'disconnect'] as const)(
    'requires administrator access for %s',
    (method) => {
      const descriptor = Object.getOwnPropertyDescriptor(
        ProviderIntegrationController.prototype,
        method,
      );
      expect(Reflect.getMetadata(ROLE_KEY, descriptor?.value)).toBe('admin');
    },
  );

  it('keeps status read-only and does not require admin elevation', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      ProviderIntegrationController.prototype,
      'getConnection',
    );
    expect(Reflect.getMetadata(ROLE_KEY, descriptor?.value)).toBeUndefined();
  });
});
