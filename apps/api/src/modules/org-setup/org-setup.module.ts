import { Module } from '@nestjs/common';
import { OrgSetupService } from './org-setup.service';
import { OrgSetupController } from './org-setup.controller';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';

@Module({
  imports: [OrchestratorModule],
  controllers: [OrgSetupController],
  providers: [OrgSetupService],
})
export class OrgSetupModule {}
