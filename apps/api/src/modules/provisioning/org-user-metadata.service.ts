import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';

const DISCOVER_FIELDS = [
  'cfs_ob__Onboarding_Role__c',
  'cfs_ob__Bottler__c',
  'cfs_ob__Modules__c',
  'cfs_ob__u_Locations__c',
] as const;

export interface PicklistFieldInfo {
  name: string;
  values: string[];
}

@Injectable()
export class OrgUserMetadataService {
  private readonly sfCli = createSfCliClient();

  async discover(orgId: string) {
    const org = await prisma.orgConnection.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Org not found');

    const alias = org.username ?? org.alias;
    const describe = await this.sfCli.describeSObject(alias, 'User');
    if (!describe.success) {
      const err = describe.error ?? 'Failed to describe User';
      if (err.includes('html content') || err.includes('420')) {
        throw new BadRequestException(
          `Cannot reach org "${alias}" — session may be expired. Reconnect the org in Environment Center.`,
        );
      }
      throw new BadRequestException(err);
    }

    const fields = describe.data?.result?.fields ?? [];
    const picklists: PicklistFieldInfo[] = [];

    for (const fieldName of DISCOVER_FIELDS) {
      const field = fields.find((f) => f.name === fieldName);
      if (!field) continue;
      const values = (field.picklistValues ?? [])
        .filter((p) => p.active)
        .map((p) => p.value);
      picklists.push({ name: fieldName, values });
    }

    return {
      orgId,
      alias: org.alias,
      picklists,
    };
  }
}
