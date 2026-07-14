import { Controller, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { AuthGuard, type AuthenticatedRequest } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@Controller('runs')
@UseGuards(AuthGuard)
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Get(':id')
  async getRun(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const run = await this.orchestratorService.getRun(id);
    const isAdmin = req.userProfile?.role === 'admin';
    if (!run || (!isAdmin && run.createdBy !== 'system' && run.createdBy !== userId)) {
      throw new NotFoundException('Run not found');
    }
    return run;
  }
}
