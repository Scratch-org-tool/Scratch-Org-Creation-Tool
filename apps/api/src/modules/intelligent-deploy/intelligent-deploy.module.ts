import { Module } from '@nestjs/common';
import { IntelligentOrchestratorService, DeploySourceResolver } from './intelligent-orchestrator.service';
import { IntelligentDeployController } from './intelligent-deploy.controller';
import { AzureService } from '../../integrations/azure/azure.service';
import { AzureIntegrationService } from '../integrations/azure-integration.service';

@Module({
  controllers: [IntelligentDeployController],
  providers: [
    IntelligentOrchestratorService,
    {
      provide: DeploySourceResolver,
      useFactory: (azure: AzureService) =>
        new DeploySourceResolver({
          checkoutRepo: (project, repo, branch) => azure.checkoutRepo(project, repo, branch),
          prepareManifestDeploy: (workspaceDir, manifest) =>
            azure.prepareManifestDeploy(workspaceDir, manifest),
        }),
      inject: [AzureService],
    },
    AzureIntegrationService,
    AzureService,
  ],
  exports: [IntelligentOrchestratorService, DeploySourceResolver],
})
export class IntelligentDeployModule {}
