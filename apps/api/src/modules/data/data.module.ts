import { Module, forwardRef } from '@nestjs/common';
import { DataService } from './data.service';
import { DataController } from './data.controller';
import { DataCoreModule } from './data-core.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';

@Module({
  imports: [DataCoreModule, forwardRef(() => OrchestratorModule)],
  controllers: [DataController],
  providers: [DataService],
  exports: [DataService, DataCoreModule],
})
export class DataModule {}
