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
import { OrchestratorModule } from '../orchestrator/orchestrator.module';

@Module({
  imports: [forwardRef(() => OrchestratorModule)],
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
  ],
})
export class DataCoreModule {}
