import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobProcessRegistryService } from './job-process-registry.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, JobProcessRegistryService],
  exports: [JobsService, JobProcessRegistryService],
})
export class JobsModule {}
