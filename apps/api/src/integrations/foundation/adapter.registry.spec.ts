import { describe, expect, it } from 'vitest';
import type { ScmAdapter } from './adapter.contracts';
import { AdapterNotRegisteredError } from './adapter.errors';
import { ScmAdapterRegistry } from './adapter.registry';

function adapter(provider: ScmAdapter['provider']): ScmAdapter {
  return { provider } as ScmAdapter;
}

describe('ScmAdapterRegistry', () => {
  it('dispatches by canonical provider', () => {
    const azure = adapter('azure_devops');
    const github = adapter('github');
    const registry = new ScmAdapterRegistry([azure, github]);

    expect(registry.get('azure_devops')).toBe(azure);
    expect(registry.get('github')).toBe(github);
    expect(registry.providers()).toEqual(['azure_devops', 'github']);
  });

  it('rejects duplicate providers and reports missing adapters canonically', () => {
    expect(() => new ScmAdapterRegistry([adapter('bitbucket'), adapter('bitbucket')]))
      .toThrow(/already registered/);

    const registry = new ScmAdapterRegistry();
    expect(() => registry.get('github')).toThrow(AdapterNotRegisteredError);
  });
});
