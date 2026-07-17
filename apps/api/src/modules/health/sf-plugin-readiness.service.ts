import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  createSfCliClient,
  requiredSfPlugins,
  type SfCliReadiness,
} from '@sfcc/sf-cli';

export type SfPluginReadinessSnapshot =
  | {
      state: 'checking';
      checkedAt: string;
      ready: false;
      cliAvailable: null;
      plugins: Array<{
        id: string;
        label: string;
        requiredFor: string;
        requestedVersion: string;
        state: 'checking';
      }>;
    }
  | ({ state: 'ready' | 'degraded' } & SfCliReadiness);

/**
 * Best-effort startup provisioning for the small, explicit plugin allowlist in
 * @sfcc/sf-cli. The API remains available when npm/registry access is down;
 * plugin-backed features expose a degraded readiness state and retry on use.
 */
@Injectable()
export class SfPluginReadinessService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SfPluginReadinessService.name);
  private readonly sfCli = createSfCliClient();
  private inFlight?: Promise<SfPluginReadinessSnapshot>;
  private snapshot: SfPluginReadinessSnapshot = {
    state: 'checking',
    checkedAt: new Date().toISOString(),
    ready: false,
    cliAvailable: null,
    plugins: requiredSfPlugins().map((plugin) => ({
      id: plugin.id,
      label: plugin.label,
      requiredFor: plugin.requiredFor,
      requestedVersion: plugin.version,
      state: 'checking',
    })),
  };

  async onApplicationBootstrap(): Promise<void> {
    // Finish the first readiness pass before accepting traffic so the
    // workbench capability cache never records a plugin as unavailable while
    // startup provisioning is still in progress. Failures degrade only the
    // plugin-backed features; performRefresh intentionally does not throw.
    await this.refresh();
  }

  getSnapshot(): SfPluginReadinessSnapshot {
    return this.snapshot;
  }

  async refresh(options?: { installMissing?: boolean }): Promise<SfPluginReadinessSnapshot> {
    if (this.inFlight) return this.inFlight;
    const refresh = this.performRefresh(options);
    this.inFlight = refresh;
    try {
      return await refresh;
    } finally {
      if (this.inFlight === refresh) this.inFlight = undefined;
    }
  }

  private async performRefresh(
    options?: { installMissing?: boolean },
  ): Promise<SfPluginReadinessSnapshot> {
    try {
      const readiness = await this.sfCli.getRequiredPluginsReadiness(options);
      this.snapshot = {
        ...readiness,
        state: readiness.ready ? 'ready' : 'degraded',
      };
      if (readiness.ready) {
        const versions = readiness.plugins
          .map((plugin) => `${plugin.label} ${plugin.installedVersion ?? plugin.version}`)
          .join(', ');
        this.logger.log(`Salesforce CLI runtime ready (${readiness.cliVersion ?? 'version unknown'}; ${versions})`);
      } else {
        this.logger.warn(`Salesforce CLI plugin readiness degraded: ${readiness.error ?? 'unknown error'}`);
      }
      return this.snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed: SfCliReadiness = {
        checkedAt: new Date().toISOString(),
        cliAvailable: false,
        autoInstall: process.env.SF_AUTO_INSTALL_PLUGINS !== 'false',
        ready: false,
        error: message,
        plugins: requiredSfPlugins().map((plugin) => ({
          ...plugin,
          installed: false,
          ready: false,
          action: 'failed',
          error: message,
        })),
      };
      this.snapshot = { ...failed, state: 'degraded' };
      this.logger.warn(`Salesforce CLI plugin readiness check failed: ${message}`);
      return this.snapshot;
    }
  }
}
