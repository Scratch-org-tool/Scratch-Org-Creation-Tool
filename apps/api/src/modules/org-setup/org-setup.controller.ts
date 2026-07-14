import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { OrgSetupService } from './org-setup.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';

@Controller('org-setup')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('org-setup')
export class OrgSetupController {
  constructor(private readonly orgSetupService: OrgSetupService) {}

  @Post('execute')
  execute(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.orgSetupService.executeSetup(body, userId);
  }

  @Get('runs')
  listRuns(@Query('orgId') orgId?: string) {
    return this.orgSetupService.listRuns(orgId);
  }

  @Get('permission-sets')
  listPermissionSets(@Query('orgId') orgId: string, @CurrentUser() userId: string) {
    return this.orgSetupService.listPermissionSets(orgId, userId);
  }
}
