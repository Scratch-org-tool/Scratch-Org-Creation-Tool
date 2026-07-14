import { Global, Module } from '@nestjs/common';
import { ScratchOrgJobService } from './scratch-org-job.service';

@Global()
@Module({
  providers: [ScratchOrgJobService],
  exports: [ScratchOrgJobService],
})
export class ScratchOrgJobModule {}
