import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ConaSeedService } from '../modules/data/cona-seed.service';
import { QuerySectionRuntimeService } from '../modules/data/query-section-runtime.service';
import { JobsService } from '../modules/jobs/jobs.service';
import { StreamService } from '../modules/stream/stream.service';
import type { AccountSeedRow } from '../modules/data/account-seed-query.builder';
import type {
  BottlerSalesOfficeConfig,
  ConaManualAccountQuery,
  DataSeedQuerySet,
} from '@sfcc/shared';

@Injectable()
export class ConaSeedWorker {
  constructor(
    private readonly conaSeedService: ConaSeedService,
    private readonly querySectionRuntime: QuerySectionRuntimeService,
    private readonly jobsService: JobsService,
    private readonly streamService: StreamService,
  ) {}

  async process(job: Job) {
    const {
      sourceOrgId,
      targetOrgId,
      datasets,
      accountSeedRows,
      accountQueryMode,
      manualAccountQueries,
      dataSeedMode,
      querySet,
      querySection,
      salesOfficeConfig,
      dbJobId,
      automationRunId,
    } = job.data as {
      sourceOrgId: string;
      targetOrgId: string;
      datasets?: Array<'OnboardingConfig' | 'Products' | 'VisitPlans' | 'Accounts'>;
      accountSeedRows?: AccountSeedRow[];
      accountQueryMode?: 'guided' | 'manual';
      manualAccountQueries?: ConaManualAccountQuery[];
      dataSeedMode?: 'automatic' | 'query_json' | 'hybrid' | 'query_section';
      querySet?: DataSeedQuerySet;
      querySection?: unknown;
      salesOfficeConfig?: BottlerSalesOfficeConfig;
      dbJobId: string;
      automationRunId?: string;
    };

    const log = async (line: string) => {
      await this.jobsService.addLog(dbJobId, 'stdout', line);
      await this.streamService.publishJobLog(dbJobId, 'stdout', line);
    };

    if (dataSeedMode === 'query_section') {
      if (!automationRunId || !querySection) {
        throw new Error('Template V2 query runtime requires automationRunId and querySection');
      }
      return this.querySectionRuntime.execute({
        automationRunId,
        sourceOrgId,
        targetOrgId,
        section: querySection,
        salesOffices: salesOfficeConfig?.offices,
        salesOfficesByBottler: salesOfficeConfig
          ? { [salesOfficeConfig.bottler]: salesOfficeConfig.offices }
          : undefined,
        dbJobId,
      });
    }

    return this.conaSeedService.runSeed({
      sourceOrgId,
      targetOrgId,
      datasets,
      accountSeedRows,
      accountQueryMode,
      manualAccountQueries,
      dataSeedMode,
      querySet,
      salesOfficeConfig,
      onLog: log,
    });
  }
}
