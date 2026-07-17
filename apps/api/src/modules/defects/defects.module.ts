import { Module } from '@nestjs/common';
import { DefectsController } from './defects.controller';
import { DefectsService } from './defects.service';
import { DefectsWebhookController } from './defects-webhook.controller';
import { DefectsWebhookService } from './defects-webhook.service';
import { EnvironmentModule } from '../environment/environment.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [EnvironmentModule, AgentsModule],
  controllers: [DefectsController, DefectsWebhookController],
  providers: [DefectsService, DefectsWebhookService],
})
export class DefectsModule {}
