import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SfPluginReadinessService } from './sf-plugin-readiness.service';

@Module({
  controllers: [HealthController],
  providers: [SfPluginReadinessService],
  exports: [SfPluginReadinessService],
})
export class HealthModule {}
