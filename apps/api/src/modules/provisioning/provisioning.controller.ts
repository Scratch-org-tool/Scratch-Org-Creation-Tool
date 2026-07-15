import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ProvisioningService } from './provisioning.service';
import { OrgUserMetadataService } from './org-user-metadata.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';

@Controller('provisioning')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('provisioning')
export class ProvisioningController {
  constructor(
    private readonly provisioningService: ProvisioningService,
    private readonly orgUserMetadata: OrgUserMetadataService,
  ) {}

  @Get('batches')
  listBatches(@CurrentUser() userId: string) {
    return this.provisioningService.listBatches(userId);
  }

  @Get('orgs/:orgId/discover')
  discoverOrgUsers(@Param('orgId') orgId: string, @CurrentUser() userId: string) {
    return this.orgUserMetadata.discover(orgId, userId);
  }

  @Post('bulk')
  provisionBulk(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.provisioningService.provisionFromCsv(body, userId);
  }

  @Post('cona-users')
  provisionConaUsers(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.provisioningService.provisionConaUsers(body, userId);
  }

  @Post('plan/preview')
  previewTemplatePlan(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.provisioningService.previewTemplatePlan(body, userId);
  }

  @Post('parse-csv')
  parseCsv(@Body('csv') csv: string) {
    return this.provisioningService.parseCsv(csv);
  }
}
