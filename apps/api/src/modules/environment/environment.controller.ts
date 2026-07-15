import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { EnvironmentService } from './environment.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { RequireRole, RoleGuard } from '../../common/role.guard';

@Controller('environment')
@UseGuards(AuthGuard, ModuleGuard, RoleGuard)
@RequireModule('environment')
export class EnvironmentController {
  constructor(private readonly environmentService: EnvironmentService) {}

  @Get('connected-orgs')
  listConnectedOrgs(@CurrentUser() userId: string) {
    return this.environmentService.listConnectedOrgs(userId);
  }

  @Post('connected-orgs/refresh')
  refreshConnectedOrgs(@CurrentUser() userId: string) {
    return this.environmentService.refreshConnectedOrgs(userId);
  }

  @Post('connected-orgs/:alias/default-dev-hub')
  setDefaultDevHub(@Param('alias') alias: string, @CurrentUser() userId: string) {
    return this.environmentService.setDefaultDevHub(alias, userId);
  }

  @Delete('connected-orgs/:alias')
  disconnectOrg(@Param('alias') alias: string, @CurrentUser() userId: string) {
    return this.environmentService.disconnectOrg(alias, userId);
  }

  @Get('scratch-orgs')
  listScratchOrgs(@CurrentUser() userId: string) {
    return this.environmentService.listScratchOrgs(userId);
  }

  @Get('scratch-orgs/:alias/credentials')
  getScratchOrgCredentials(@Param('alias') alias: string, @CurrentUser() userId: string) {
    return this.environmentService.getScratchOrgCredentials(alias, userId);
  }

  @Post('scratch-orgs/:alias/regenerate-password')
  regenerateScratchOrgPassword(@Param('alias') alias: string, @CurrentUser() userId: string) {
    return this.environmentService.regenerateScratchOrgPassword(alias, userId);
  }

  @Delete('scratch-orgs/:alias')
  deleteScratchOrg(@Param('alias') alias: string, @CurrentUser() userId: string) {
    return this.environmentService.deleteScratchOrg(alias, userId);
  }

  @Post('verify-org-auth')
  verifyOrgAuth(@Body() body: { orgId: string }, @CurrentUser() userId: string) {
    return this.environmentService.verifyOrgAuth(body.orgId, userId);
  }

  @Get('azure-defaults')
  getAzureDefaults() {
    return this.environmentService.getAzureDefaults();
  }

  @Get('azure-repos')
  listAzureRepos(@Query('project') project?: string) {
    return this.environmentService.listAzureRepos(project);
  }

  @Get('azure-branches')
  listAzureBranches(@Query('repo') repo: string, @Query('project') project?: string) {
    return this.environmentService.listAzureBranches(repo, project);
  }

  @Get('azure-connection')
  getAzureConnection() {
    return this.environmentService.getAzureConnection();
  }

  @Post('azure-connection/connect')
  @RequireRole('admin')
  connectAzureDevOps(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.environmentService.connectAzureDevOps(body, userId);
  }

  @Post('azure-connection/verify')
  verifyAzureConnection() {
    return this.environmentService.verifyAzureConnection();
  }

  @Delete('azure-connection')
  @RequireRole('admin')
  disconnectAzureDevOps() {
    return this.environmentService.disconnectAzureDevOps();
  }

  @Post('scratch-org/pipeline')
  createScratchOrgPipeline(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.environmentService.createScratchOrgPipeline(body, userId);
  }

  @Get('automation-runs/active')
  getActiveAutomationRun(
    @Query('intent') intent: string,
    @CurrentUser() userId: string,
  ) {
    return this.environmentService.getActiveAutomationRun(intent ?? 'scratch_org_pipeline', userId);
  }

  @Get('automation-runs/:id')
  getAutomationRun(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.environmentService.getAutomationRun(id, userId);
  }

  @Post('automation-runs/:id/resume')
  resumeAutomationRun(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
  ) {
    return this.environmentService.resumeAutomationRun(id, body, userId);
  }

  @Post('automation-runs/:id/cancel')
  cancelAutomationRun(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.environmentService.cancelAutomationRun(id, userId);
  }

  @Post('automation-runs/:id/run')
  runAutomationActions(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
  ) {
    return this.environmentService.runAutomationActions(id, body, userId);
  }

  @Post('orgs/:orgId/load-config')
  loadOrgConfig(
    @Param('orgId') orgId: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
  ) {
    return this.environmentService.loadOrgConfig(orgId, body, userId);
  }

  @Post('scratch-org/create')
  createScratchOrg(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.environmentService.createScratchOrg(body, userId);
  }

  @Get('jobs/:jobId')
  getJob(@Param('jobId') jobId: string, @CurrentUser() userId: string) {
    return this.environmentService.getJob(jobId, userId);
  }

  @Post('jobs/:jobId/cancel')
  cancelJob(@Param('jobId') jobId: string, @CurrentUser() userId: string) {
    return this.environmentService.cancelJob(jobId, userId);
  }

  @Post('jobs/:jobId/skip')
  skipJobStep(
    @Param('jobId') jobId: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
  ) {
    return this.environmentService.skipJobStep(jobId, body, userId);
  }
}
