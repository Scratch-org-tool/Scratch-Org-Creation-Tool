import { Module } from '@nestjs/common';
import { IntelligentOrchestratorService, DeploySourceResolver } from './intelligent-orchestrator.service';
import { IntelligentDeployController } from './intelligent-deploy.controller';

@Module({
  controllers: [IntelligentDeployController],
  providers: [IntelligentOrchestratorService, DeploySourceResolver],
  exports: [IntelligentOrchestratorService, DeploySourceResolver],
})
export class IntelligentDeployModule {}
