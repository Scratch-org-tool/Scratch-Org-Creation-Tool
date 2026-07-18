import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { LearningQuizService } from './learning-quiz.service';
import { LearningTutorService } from './learning-tutor.service';
import { LearningExplainerService } from './learning-explainer.service';
import { LearningAdminService } from './learning-admin.service';

@Module({
  imports: [AgentsModule],
  controllers: [LearningController],
  providers: [
    LearningService,
    LearningQuizService,
    LearningTutorService,
    LearningExplainerService,
    LearningAdminService,
  ],
})
export class LearningModule {}
