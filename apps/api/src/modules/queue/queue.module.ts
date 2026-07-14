import { Global, Module, forwardRef } from '@nestjs/common';
import { QueueService } from './queue.service';
import { WorkerRegistry } from './worker.registry';
import { JobsModule } from '../jobs/jobs.module';
import { WorkersModule } from '../workers/workers.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { StreamModule } from '../stream/stream.module';

@Global()
@Module({
  imports: [JobsModule, WorkersModule, StreamModule, forwardRef(() => OrchestratorModule)],
  providers: [QueueService, WorkerRegistry],
  exports: [QueueService, WorkerRegistry],
})
export class QueueModule {}
