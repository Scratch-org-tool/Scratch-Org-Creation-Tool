import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { createSfCliClient } from '@sfcc/sf-cli';
import { assertResourceOwner } from '../../common/user-tenancy.util';
import { buildPicklistDependencies } from './picklist-dependency.util';

const DISCOVER_FIELDS = [
  'cfs_ob__Onboarding_Role__c',
  'cfs_ob__Bottler__c',
  'cfs_ob__Modules__c',
  'cfs_ob__u_Locations__c',
] as const;

export interface PicklistFieldInfo {
  name: string;
  values: string[];
  controllerName?: string;
  dependencies?: Array<{ value: string; validFor: string[] }>;
}

@Injectable()
export class OrgUserMetadataService {
  private readonly sfCli = createSfCliClient();

  async discover(orgId: string, userId: string) {
    const org = await prisma.orgConnection.findUnique({ where: { id: orgId } });
    assertResourceOwner(org, userId, 'Org');

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
      const activeValues = (field.picklistValues ?? [])
        .filter((p) => p.active)
      const values = activeValues.map((p) => p.value);
      const controller = field.controllerName
        ? fields.find((candidate) => candidate.name === field.controllerName)
        : undefined;
      picklists.push({
        name: fieldName,
        values,
        controllerName: field.controllerName,
        dependencies: field.controllerName
          ? buildPicklistDependencies(activeValues, controller?.picklistValues ?? [])
          : undefined,
      });
    }

    const [profilesResult, permissionSetsResult] = await Promise.all([
      this.sfCli.query(alias, 'SELECT Id, Name FROM Profile ORDER BY Name LIMIT 500'),
      this.sfCli.query(
        alias,
        'SELECT Id, Name, Label FROM PermissionSet WHERE IsOwnedByProfile = false ORDER BY Name LIMIT 2000',
      ),
    ]);
    if (!profilesResult.success || !permissionSetsResult.success) {
      throw new BadRequestException(
        profilesResult.error ?? permissionSetsResult.error ?? 'Failed to discover profiles or permission sets',
      );
    }
    const profiles = (profilesResult.data?.result?.records ?? []) as Array<{ Id: string; Name: string }>;
    const permissionSets = (permissionSetsResult.data?.result?.records ?? []) as Array<{
      Id: string;
      Name: string;
      Label: string;
    }>;

    return {
      orgId,
      alias: org.alias,
      picklists,
      missingFields: DISCOVER_FIELDS.filter((name) => !fields.some((field) => field.name === name)),
      profiles,
      permissionSets,
    };
  }
}
