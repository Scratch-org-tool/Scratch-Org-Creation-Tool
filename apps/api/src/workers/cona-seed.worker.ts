import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ConaSeedService } from '../modules/data/cona-seed.service';
import { JobsService } from '../modules/jobs/jobs.service';
import { StreamService } from '../modules/stream/stream.service';
import type { AccountSeedRow } from '../modules/data/account-seed-query.builder';
import type { BottlerSalesOfficeConfig, DataSeedQuerySet } from '@sfcc/shared';

@Injectable()
export class ConaSeedWorker {
  constructor(
    private readonly conaSeedService: ConaSeedService,
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
  ) {}

  async process(job: Job) {
    const { sourceOrgId, targetOrgId, datasets, accountSeedRows, dataSeedMode, querySet, salesOfficeConfig, dbJobId } = job.data as {
      sourceOrgId: string;
      targetOrgId: string;
      datasets?: Array<'OnboardingConfig' | 'Products' | 'VisitPlans' | 'Accounts'>;
      accountSeedRows?: AccountSeedRow[];
      dataSeedMode?: 'automatic' | 'query_json' | 'hybrid';
      querySet?: DataSeedQuerySet;
      salesOfficeConfig?: BottlerSalesOfficeConfig;
      dbJobId: string;
    };

    const log = async (line: string) => {
      await this.jobsService.addLog(dbJobId, 'stdout', line);
      await this.streamService.publishJobLog(dbJobId, 'stdout', line);
    };

    return this.conaSeedService.runSeed({
      sourceOrgId,
      targetOrgId,
      datasets,
      accountSeedRows,
      dataSeedMode,
      querySet,
      salesOfficeConfig,
      onLog: log,
    });
  }
}
