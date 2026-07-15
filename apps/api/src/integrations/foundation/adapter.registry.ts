import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ScmProvider, WorkItemProvider } from '@sfcc/shared';
import {
  SCM_ADAPTERS,
  WORK_ITEM_ADAPTERS,
  type ScmAdapter,
  type WorkItemAdapter,
} from './adapter.contracts';
import { AdapterNotRegisteredError } from './adapter.errors';

export class AdapterRegistry<Provider extends string, Adapter extends { provider: Provider }> {
  private readonly adapters = new Map<Provider, Adapter>();

  constructor(initialAdapters: readonly Adapter[] = []) {
    for (const adapter of initialAdapters) this.register(adapter);
  }

  register(adapter: Adapter): void {
    if (this.adapters.has(adapter.provider)) {
      throw new Error(`An adapter is already registered for "${adapter.provider}"`);
    }
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: Provider): Adapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new AdapterNotRegisteredError(provider);
    return adapter;
  }

  has(provider: Provider): boolean {
    return this.adapters.has(provider);
  }

  providers(): Provider[] {
    return [...this.adapters.keys()];
  }
}

@Injectable()
export class ScmAdapterRegistry extends AdapterRegistry<ScmProvider, ScmAdapter> {
  constructor(
    @Optional() @Inject(SCM_ADAPTERS) adapters: readonly ScmAdapter[] = [],
  ) {
    super(adapters);
  }
}

@Injectable()
export class WorkItemAdapterRegistry extends AdapterRegistry<WorkItemProvider, WorkItemAdapter> {
  constructor(
    @Optional() @Inject(WORK_ITEM_ADAPTERS) adapters: readonly WorkItemAdapter[] = [],
  ) {
    super(adapters);
  }
}
