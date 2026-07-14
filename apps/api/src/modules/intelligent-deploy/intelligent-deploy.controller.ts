import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { IntelligentOrchestratorService } from './intelligent-orchestrator.service';
import { AuthGuard } from '../../common/auth.guard';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@Controller('intelligent-deploy')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('deployment')
export class IntelligentDeployController {
  constructor(private readonly orchestrator: IntelligentOrchestratorService) {}

  @Get(':runId')
  getRun(@Param('runId') runId: string, @CurrentUser() userId: string) {
    return this.orchestrator.getRunForUser(runId, userId);
  }
}
