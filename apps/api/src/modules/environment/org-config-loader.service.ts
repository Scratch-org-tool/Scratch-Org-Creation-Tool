import { Injectable } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import { escapeSoqlLiteral, ONBOARDING_CONFIG_OBJECT, ONBOARDING_CONFIG_QUEUE_MAP } from '@sfcc/shared';

export interface OrgConfigLoadOptions {
  upsertQueueIds?: boolean;
  upsertDomainFields?: boolean;
  upsertRequestId?: boolean;
  bottler?: string;
  configKey?: string;
}

@Injectable()
export class OrgConfigLoaderService {
  private readonly sfCli = createSfCliClient();

  async loadForOrg(orgId: string, options: OrgConfigLoadOptions = {}) {
    const org = await prisma.orgConnection.findUnique({ where: { id: orgId } });
    if (!org) throw new Error('Org not found');

    const alias = org.username ?? org.alias;
    const flags = {
      upsertQueueIds: options.upsertQueueIds ?? true,
      upsertDomainFields: options.upsertDomainFields ?? true,
      upsertRequestId: options.upsertRequestId ?? true,
    };

    const updates: Record<string, string> = {};
    const logs: string[] = [];

    if (flags.upsertQueueIds) {
      const devNames = Object.keys(ONBOARDING_CONFIG_QUEUE_MAP);
      const quoted = devNames.map((d) => `'${d}'`).join(',');
      const queueResult = await this.sfCli.query(
        alias,
        `SELECT Id, DeveloperName FROM Group WHERE Type = 'Queue' AND DeveloperName IN (${quoted})`,
      );
      const queues = (queueResult.data as { result?: { records?: Array<{ Id: string; DeveloperName: string }> } })?.result?.records ?? [];
      for (const [devName, fieldName] of Object.entries(ONBOARDING_CONFIG_QUEUE_MAP)) {
        const match = queues.find((q) => q.DeveloperName === devName);
        if (match) {
          updates[fieldName] = match.Id;
          logs.push(`Mapped queue ${devName} → ${match.Id}`);
        } else {
          logs.push(`WARN: Queue not found: ${devName}`);
        }
      }
    }

    if (flags.upsertDomainFields) {
      const display = await this.sfCli.getOrgDisplay(alias);
      const instanceUrl = display.data?.result?.instanceUrl ?? org.instanceUrl ?? '';
      const lightningBase = this.deriveLightningBase(instanceUrl);
      updates.cfs_ob__Lightning_Instance__c = lightningBase;
      updates.cfs_ob__Lightning_InstanceLabel__c = lightningBase;
      updates.cfs_ob__FileAssetDomain__c = `${lightningBase}/lightning/r/ContentDocument/`;

      const srResult = await this.sfCli.query(
        alias,
        "SELECT Name, NamespacePrefix, SystemModstamp FROM StaticResource WHERE Name = 'fsvLightingComponent' LIMIT 1",
      );
      const sr = (srResult.data as {
        result?: { records?: Array<{ Name: string; NamespacePrefix: string | null; SystemModstamp: string }> };
      })?.result?.records?.[0];
      if (sr) {
        const vfBase = lightningBase.replace('.lightning.force.com', '.lightning.force.com.visualforce.com');
        const ns = sr.NamespacePrefix ? `${sr.NamespacePrefix}__` : '';
        const ts = new Date(sr.SystemModstamp).getTime();
        updates.cfs_ob__OnboardingProgressBarStyle__c = `${vfBase}/resource/${ts}/${ns}${sr.Name}`;
      }
      logs.push('Domain fields derived from org instance URL');
    }

    if (flags.upsertRequestId) {
      const createResult = await this.sfCli.createRecord(alias, 'u_Request__c', { Name: 'Sample Request for Config' });
      const newId = createResult.data?.result?.id;
      if (newId) {
        updates.cfs_ob__Request_ID__c = newId.substring(0, 3);
        await this.sfCli.deleteRecord(alias, 'u_Request__c', newId);
        logs.push(`Request ID prefix: ${updates.cfs_ob__Request_ID__c}`);
      }
    }

    if (Object.keys(updates).length === 0) {
      return { success: true, logs: ['No org config operations enabled'], recordId: null };
    }

    const selectors = [
      options.bottler
        ? `cfs_ob__Bottler__c = '${escapeSoqlLiteral(options.bottler)}'`
        : undefined,
      options.configKey ? `Name = '${escapeSoqlLiteral(options.configKey)}'` : undefined,
    ].filter(Boolean);
    const existing = await this.sfCli.query(
      alias,
      selectors.length
        ? `SELECT Id FROM ${ONBOARDING_CONFIG_OBJECT} WHERE ${selectors.join(' AND ')} ORDER BY Id LIMIT 2`
        : `SELECT Id FROM ${ONBOARDING_CONFIG_OBJECT} LIMIT 1`,
    );
    const existingRecords =
      (existing.data as { result?: { records?: Array<{ Id: string }> } })?.result?.records ?? [];
    if (selectors.length && existingRecords.length > 1) {
      throw new Error(`OnboardingConfig selector is ambiguous: ${selectors.join(', ')}`);
    }
    const recordId = existingRecords[0]?.Id;

    if (recordId) {
      const updateResult = await this.sfCli.updateRecord(alias, ONBOARDING_CONFIG_OBJECT, recordId, updates);
      if (!updateResult.success) throw new Error(updateResult.error ?? 'Failed to update OnboardingConfig');
      logs.push(`Updated ${ONBOARDING_CONFIG_OBJECT} ${recordId}`);
      return { success: true, logs, recordId };
    }

    const createValues = {
      ...updates,
      ...(options.bottler ? { cfs_ob__Bottler__c: options.bottler } : {}),
      ...(options.configKey ? { Name: options.configKey } : {}),
    };
    const createResult = await this.sfCli.createRecord(
      alias,
      ONBOARDING_CONFIG_OBJECT,
      createValues,
    );
    if (!createResult.success) throw new Error(createResult.error ?? 'Failed to create OnboardingConfig');
    logs.push(`Created ${ONBOARDING_CONFIG_OBJECT}`);
    return { success: true, logs, recordId: createResult.data?.result?.id ?? null };
  }

  private deriveLightningBase(instanceUrl: string): string {
    let base = instanceUrl.replace(/\/$/, '');
    if (base.includes('.my.salesforce.com')) {
      base = base.replace('.my.salesforce.com', '.lightning.force.com');
    } else if (base.includes('.salesforce.com')) {
      base = base.replace('.salesforce.com', '.lightning.force.com');
    } else if (!base.includes('lightning.force.com')) {
      base = base.replace('.force.com', '.lightning.force.com');
    }
    return base;
  }
}
