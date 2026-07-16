import { Module, forwardRef } from '@nestjs/common';
import { RecordTypeMapperService } from './record-type-mapper.service';
import { QuerySetService } from './query-set.service';
import { ConaSeedService } from './cona-seed.service';
import { AccountPartnerImportService } from './account-partner-import.service';
import { OrgToOrgCompareService } from './org-to-org-compare.service';
import { OrgToOrgBrowseService } from './org-to-org-browse.service';
import { DataDeployOrchestratorService } from './data-deploy-orchestrator.service';
import { DataPreflightService } from './data-preflight.service';
import { BulkThrottleService } from './bulk-throttle.service';
import { QuerySectionRuntimeService } from './query-section-runtime.service';
import { DataRollbackService } from './data-rollback.service';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { JobsModule } from '../jobs/jobs.module';
import { StreamModule } from '../stream/stream.module';

@Module({
  imports: [forwardRef(() => OrchestratorModule), JobsModule, StreamModule],
  providers: [
    RecordTypeMapperService,
    QuerySetService,
    ConaSeedService,
    AccountPartnerImportService,
    OrgToOrgCompareService,
    OrgToOrgBrowseService,
    DataDeployOrchestratorService,
    DataPreflightService,
    BulkThrottleService,
    QuerySectionRuntimeService,
    DataRollbackService,
  ],
  exports: [
    RecordTypeMapperService,
    QuerySetService,
    ConaSeedService,
    AccountPartnerImportService,
    OrgToOrgCompareService,
    OrgToOrgBrowseService,
    DataDeployOrchestratorService,
    DataPreflightService,
    BulkThrottleService,
    QuerySectionRuntimeService,
    DataRollbackService,
  ],
})
export class DataCoreModule {}
