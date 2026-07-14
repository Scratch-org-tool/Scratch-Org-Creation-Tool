import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AccountPartnerImportService } from '../modules/data/account-partner-import.service';
import { resolveSalesOfficeConfig } from '../modules/data/bottler-config';
import type { BottlerSalesOfficeConfig } from '@sfcc/shared';
import { JobsService } from '../modules/jobs/jobs.service';
import { StreamService } from '../modules/stream/stream.service';
import type { BottlerId } from '../modules/data/bottler-config';

@Injectable()
export class AccountPartnerImportWorker {
  constructor(
    private readonly partnerService: AccountPartnerImportService,
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
  ) {}

  async process(job: Job) {
    const data = job.data as {
      mode: 'excel' | 'org_to_org' | 'org_to_org_matched';
      bottler: BottlerId | 'all';
      targetOrgId: string;
      sourceOrgId?: string;
      perOffice?: number;
      matchOrgDistribution?: boolean;
      salesOfficeConfig?: BottlerSalesOfficeConfig;
      excelBase64?: string;
      excelPath?: string;
      sheet?: string;
      dryRun?: boolean;
      dbJobId: string;
    };

    const log = async (line: string) => {
      await this.jobsService.addLog(data.dbJobId, 'stdout', line);
      await this.streamService.publishJobLog(data.dbJobId, 'stdout', line);
    };

    if (data.mode === 'org_to_org_matched') {
      if (!data.sourceOrgId) throw new Error('sourceOrgId required for org_to_org_matched transfer');
      if (data.bottler === 'all') throw new Error('org_to_org_matched requires a specific bottler');
      const bottler = data.bottler as BottlerId;
      await log(`Matching partners from ${data.sourceOrgId} to ${data.targetOrgId} (${bottler})...`);
      return this.partnerService.transferOrgToOrgMatched(data.sourceOrgId, data.targetOrgId, bottler, {
        perOffice: data.perOffice,
        matchOrgDistribution: data.matchOrgDistribution,
        salesOfficeConfig: data.salesOfficeConfig ?? resolveSalesOfficeConfig(bottler),
      });
    }

    if (data.mode === 'org_to_org') {
      if (!data.sourceOrgId) throw new Error('sourceOrgId required for org_to_org transfer');
      await log(`Transferring partners from ${data.sourceOrgId} to ${data.targetOrgId}...`);
      return this.partnerService.transferOrgToOrg(data.sourceOrgId, data.targetOrgId, data.bottler);
    }

    const bottler = data.bottler as BottlerId;
    if (data.bottler === 'all') throw new Error('Excel mode requires a specific bottler');

    await log(`Processing Excel partners for bottler ${bottler}...`);
    const summary = await this.partnerService.processExcel({
      bottler,
      targetOrgId: data.targetOrgId,
      perOffice: data.perOffice,
      matchOrgDistribution: data.matchOrgDistribution,
      excelBase64: data.excelBase64,
      excelPath: data.excelPath,
      sheet: data.sheet,
    });
    await log(`Processed ${summary.partners} partners, ${summary.employees} employees`);

    if (!data.dryRun) {
      await log('Loading partners to target org...');
      return this.partnerService.loadFromArtifacts(bottler, data.targetOrgId, false);
    }
    return summary;
  }
}
