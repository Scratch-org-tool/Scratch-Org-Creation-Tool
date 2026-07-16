import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { PlansModule } from '../plans/plans.module';
import { DriftModule } from '../drift/drift.module';

@Module({
  imports: [PlansModule, DriftModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
