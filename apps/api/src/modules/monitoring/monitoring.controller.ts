import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { AuthGuard, type AuthenticatedRequest } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';

@Controller('monitoring')
@UseGuards(AuthGuard, ModuleGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('dashboard')
  @RequireModule('monitoring')
  getDashboard(@Query('days') days?: string, @CurrentUser() userId?: string) {
    const parsed = parseInt(days ?? '7', 10);
    const allowed = [7, 14, 30].includes(parsed) ? parsed : 7;
    return this.monitoringService.getDashboard(allowed, userId);
  }

  @Get('overview')
  @RequireModule('monitoring')
  getOverview(@Query('days') days?: string, @CurrentUser() userId?: string) {
    const parsed = parseInt(days ?? '7', 10);
    const allowed = [7, 14, 30].includes(parsed) ? parsed : 7;
    return this.monitoringService.getDashboard(allowed, userId);
  }

  @Get('throughput')
  @RequireModule('monitoring')
  getThroughput(@Query('hours') hours?: string, @CurrentUser() userId?: string) {
    return this.monitoringService.getJobThroughput(parseInt(hours ?? '24', 10), userId);
  }

  @Get('dead-letters')
  @RequireModule('monitoring')
  listDeadLetters(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Query('limit') limit?: string,
  ) {
    const isAdmin = req.userProfile?.role === 'admin';
    return this.monitoringService.listDeadLetters(userId, isAdmin, limit ? parseInt(limit, 10) : 50);
  }

  @Post('dead-letters/:jobId/replay')
  @RequireModule('monitoring')
  replayDeadLetter(
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
  ) {
    const isAdmin = req.userProfile?.role === 'admin';
    return this.monitoringService.replayDeadLetter(jobId, userId, isAdmin);
  }

  @Get('datadog')
  @RequireModule('monitoring')
  getDatadogStub() {
    return {
      message: 'Datadog integration stub - configure DATADOG_API_KEY to enable',
      metrics: ['job.duration', 'job.failures', 'queue.depth'],
    };
  }
}
