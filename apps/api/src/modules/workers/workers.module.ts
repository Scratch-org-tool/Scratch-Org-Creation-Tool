import { Module, Global } from '@nestjs/common';
import { ScratchOrgWorker } from '../../workers/scratch-org.worker';
import { MetadataDeployWorker } from '../../workers/metadata-deploy.worker';
import { SfdmuWorker } from '../../workers/sfdmu.worker';
import { DataDeployWorker } from '../../workers/data-deploy.worker';
import { UserProvisionWorker } from '../../workers/user-provision.worker';
import { OrgSetupWorker } from '../../workers/org-setup.worker';
import { ConaSeedWorker } from '../../workers/cona-seed.worker';
import { AccountPartnerImportWorker } from '../../workers/account-partner-import.worker';
import { BulkDataUpdateWorker } from '../../workers/bulk-data-update.worker';
import { AiAnalysisWorker } from '../../workers/ai-analysis.worker';
import { JobsModule } from '../jobs/jobs.module';
import { AgentsModule } from '../agents/agents.module';
import { ScratchOrgJobModule } from '../environment/scratch-org-job.module';
import { OrgConfigModule } from '../environment/org-config.module';
import { DataCoreModule } from '../data/data-core.module';
import { DeploymentModule } from '../deployment/deployment.module';
import { IntelligentDeployModule } from '../intelligent-deploy/intelligent-deploy.module';
import { AzureIntegrationService } from '../integrations/azure-integration.service';
import { AzureService } from '../../integrations/azure/azure.service';

@Global()
@Module({
  imports: [JobsModule, AgentsModule, ScratchOrgJobModule, DataCoreModule, OrgConfigModule, DeploymentModule, IntelligentDeployModule],
  providers: [
    ScratchOrgWorker,
    MetadataDeployWorker,
    SfdmuWorker,
    DataDeployWorker,
    UserProvisionWorker,
    OrgSetupWorker,
    ConaSeedWorker,
    AccountPartnerImportWorker,
    BulkDataUpdateWorker,
    AiAnalysisWorker,
    AzureIntegrationService,
    AzureService,
  ],
  exports: [
    ScratchOrgWorker,
    MetadataDeployWorker,
    SfdmuWorker,
    DataDeployWorker,
    UserProvisionWorker,
    OrgSetupWorker,
    ConaSeedWorker,
    AccountPartnerImportWorker,
    BulkDataUpdateWorker,
    AiAnalysisWorker,
  ],
})
export class WorkersModule {}
