import { Module } from '@nestjs/common';
import { OrgConfigLoaderService } from './org-config-loader.service';
import { ScratchOrgPreparationService } from './scratch-org-preparation.service';

@Module({
  providers: [OrgConfigLoaderService, ScratchOrgPreparationService],
  exports: [OrgConfigLoaderService, ScratchOrgPreparationService],
})
export class OrgConfigModule {}
