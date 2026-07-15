import { Module } from '@nestjs/common';
import { DefectsController } from './defects.controller';
import { DefectsService } from './defects.service';
import { EnvironmentModule } from '../environment/environment.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [EnvironmentModule, AgentsModule],
  controllers: [DefectsController],
  providers: [DefectsService],
})
export class DefectsModule {}
