import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/auth.guard';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { QualityService } from './quality.service';

@Controller('quality/apex')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('deployment')
export class QualityController {
  constructor(private readonly quality: QualityService) {}

  @Post('run')
  startRun(
    @Body() body: unknown,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.quality.startRun(body, userId, this.isAdmin(req));
  }

  @Get('runs')
  listRuns(
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId?: string,
  ) {
    return this.quality.listRuns(orgId, userId, this.isAdmin(req));
  }

  @Get('runs/:id')
  getRun(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.quality.getRun(id, userId, this.isAdmin(req));
  }

  @Get('coverage')
  coverage(
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId?: string,
  ) {
    return this.quality.getCoverage(orgId ?? '', userId, this.isAdmin(req));
  }

  @Post('coverage/capture')
  captureCoverage(
    @Body() body: { orgId?: string },
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.quality.captureCoverage(body?.orgId ?? '', userId, this.isAdmin(req));
  }

  private isAdmin(req: AuthenticatedRequest): boolean {
    return req.userProfile?.role === 'admin';
  }
}
