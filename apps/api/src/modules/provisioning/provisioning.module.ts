import { Module } from '@nestjs/common';
import { ProvisioningService } from './provisioning.service';
import { ProvisioningController } from './provisioning.controller';
import { OrgUserMetadataService } from './org-user-metadata.service';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';

@Module({
  imports: [OrchestratorModule],
  controllers: [ProvisioningController],
  providers: [ProvisioningService, OrgUserMetadataService],
  exports: [ProvisioningService, OrgUserMetadataService],
})
export class ProvisioningModule {}
