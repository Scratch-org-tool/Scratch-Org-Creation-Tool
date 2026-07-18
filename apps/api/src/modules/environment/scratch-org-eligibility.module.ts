import { Module } from '@nestjs/common';
import { ScratchTemplatesModule } from '../scratch-templates/scratch-templates.module';
import { OrgConfigModule } from './org-config.module';
import { ExistingScratchOrgService } from './existing-scratch-org.service';

/**
 * Shared launch gate for interactive creation and scheduled renewals.
 * Keeping it outside EnvironmentModule avoids a renewal/environment cycle
 * while guaranteeing that every entry point performs the same live checks.
 */
@Module({
  imports: [ScratchTemplatesModule, OrgConfigModule],
  providers: [ExistingScratchOrgService],
  exports: [ExistingScratchOrgService],
})
export class ScratchOrgEligibilityModule {}
