import { Module } from '@nestjs/common';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { ScratchOrgEligibilityModule } from './scratch-org-eligibility.module';
import { ScratchOrgRenewalService } from './scratch-org-renewal.service';

/**
 * Scratch org renewal automation. Kept as its own module so both the
 * Environment API (panel CRUD + manual runs) and the background scheduler
 * (due-rule firing and pipeline finalization) can share one service without
 * pulling the full EnvironmentModule into the scheduler.
 */
@Module({
  imports: [OrchestratorModule, ScratchOrgEligibilityModule],
  providers: [ScratchOrgRenewalService],
  exports: [ScratchOrgRenewalService],
})
export class ScratchOrgRenewalModule {}
