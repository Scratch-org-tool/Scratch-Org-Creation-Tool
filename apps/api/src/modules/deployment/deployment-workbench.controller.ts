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

/**
 * Planning-only foundation. The deployments/workbench prefix is a compatibility
 * shim for clients rooted on the existing deployments API.
 */
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
