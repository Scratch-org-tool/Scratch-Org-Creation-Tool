import { Module } from '@nestjs/common';
import { DeploymentService } from './deployment.service';
import { DeploymentController } from './deployment.controller';
import { MetadataDeployQueueService } from './metadata-deploy-queue.service';
import { MetadataDeployJobService } from './metadata-deploy-job.service';
import { AzureService } from '../../integrations/azure/azure.service';
import { AzureIntegrationService } from '../integrations/azure-integration.service';
import { JenkinsService } from '../../integrations/jenkins/jenkins.service';
import { JobsModule } from '../jobs/jobs.module';
import { StreamModule } from '../stream/stream.module';
import { IntelligentDeployModule } from '../intelligent-deploy/intelligent-deploy.module';
import { MetadataDataChainService } from '../metadata/metadata-data-chain.service';

@Module({
  imports: [JobsModule, StreamModule, IntelligentDeployModule],
  controllers: [DeploymentController],
  providers: [
    DeploymentService,
    MetadataDeployQueueService,
    MetadataDeployJobService,
    MetadataDataChainService,
    AzureIntegrationService,
    AzureService,
    JenkinsService,
  ],
  exports: [MetadataDeployQueueService, MetadataDeployJobService, DeploymentService, MetadataDataChainService],
})
export class DeploymentModule {}
