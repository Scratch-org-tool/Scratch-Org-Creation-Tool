import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { DeploymentWorkbenchService } from './deployment-workbench.service';

/** Provider-neutral workbench; the deployments prefix remains a compatibility alias. */
@Controller(['deployment-workbench', 'deployments/workbench'])
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('deployment')
export class DeploymentWorkbenchController {
  constructor(private readonly workbench: DeploymentWorkbenchService) {}

  @Get('capabilities')
  capabilities() {
    return this.workbench.capabilities();
  }

  @Post('preview')
  preview(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.workbench.preview(body, userId);
  }

  @Post('plans')
  createPlan(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.workbench.create(body, userId);
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.workbench.create(body, userId);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.workbench.getStatus(id, userId);
  }

  @Get(':id/status')
  status(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.workbench.getStatus(id, userId);
  }

  @Get(':id/policy')
  policy(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.workbench.getPolicy(id, userId);
  }

  @Get(':id/stages')
  stages(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.workbench.getStages(id, userId);
  }

  @Get(':id/results')
  results(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.workbench.getResults(id, userId);
  }

  @Get(':id/progress')
  progress(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.workbench.getProgress(id, userId);
  }

  @Get(':id/destructive-review')
  destructiveReview(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.workbench.destructiveReview(id, userId);
  }

  @Post(':id/resume')
  resume(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.workbench.resume(id, userId);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.workbench.cancel(id, userId);
  }

  @Post(':id/quick-deploy')
  quickDeploy(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.workbench.quickDeploy(id, userId);
  }

  @Post(':id/rollback')
  rollback(
    @Param('id') id: string,
    @Body('reason') reason: unknown,
    @CurrentUser() userId: string,
  ) {
    return this.workbench.rollback(id, reason, userId);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @CurrentUser() userId: string,
  ) {
    return this.workbench.approve(id, {
      userId,
      isAdmin: request.userProfile?.role === 'admin',
    });
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body('reason') reason: unknown,
    @Req() request: AuthenticatedRequest,
    @CurrentUser() userId: string,
  ) {
    return this.workbench.reject(id, reason, {
      userId,
      isAdmin: request.userProfile?.role === 'admin',
    });
  }
}
