import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { PlansModule } from '../plans/plans.module';
import { DriftModule } from '../drift/drift.module';
import { ScratchOrgRenewalModule } from '../environment/scratch-org-renewal.module';

@Module({
  imports: [PlansModule, DriftModule, ScratchOrgRenewalModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
