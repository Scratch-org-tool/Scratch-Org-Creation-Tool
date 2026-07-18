import { Module } from '@nestjs/common';
import { CopilotService } from './copilot.service';
import { CopilotController } from './copilot.controller';
import { CopilotSettingsService } from './copilot-settings.service';
import { AppGuideService } from './app-guide.service';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  controllers: [CopilotController],
  providers: [CopilotService, CopilotSettingsService, AppGuideService],
})
export class CopilotModule {}
