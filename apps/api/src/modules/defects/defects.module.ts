import { Module } from '@nestjs/common';
import { DefectsController } from './defects.controller';
import { DefectsService } from './defects.service';
import { EnvironmentModule } from '../environment/environment.module';
import { AgentsModule } from '../agents/agents.module';
import { AzureWorkItemsService } from '../../integrations/azure/azure-work-items.service';

@Module({
  imports: [EnvironmentModule, AgentsModule],
  controllers: [DefectsController],
  providers: [DefectsService, AzureWorkItemsService],
})
export class DefectsModule {}
