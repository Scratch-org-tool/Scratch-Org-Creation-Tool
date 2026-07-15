import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DeploymentService } from './deployment.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import type { ScmProvider } from '@sfcc/shared';

@Controller('deployments')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('deployment')
export class DeploymentController {
  constructor(private readonly deploymentService: DeploymentService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.deploymentService.listDeployments(userId);
  }

  @Post('org-to-org-metadata/deploy')
  deployOrgToOrgMetadata(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.deploymentService.deployOrgToOrgMetadata(body, userId);
  }

  @Post('deploy')
  deployNow(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.deploymentService.deployNow(body, userId);
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.deploymentService.createDeployment(body, userId);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.deploymentService.cancelDeployment(id, userId);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    return this.deploymentService.approveDeployment(id, userId);
  }

  @Post(':id/rollback')
  rollback(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() userId: string,
  ) {
    return this.deploymentService.rollback(id, reason, userId);
  }

  @Post(':id/quick-deploy')
  quickDeploy(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.deploymentService.quickDeploy(id, userId);
  }

  @Get('test-classes')
  listTestClasses(
    @Query('orgId') orgId: string,
    @CurrentUser() userId: string,
    @Query('search') search?: string,
  ) {
    return this.deploymentService.listApexTestClasses(orgId, userId, search);
  }

  @Get('repos')
  listRepos(
    @Query('provider') provider?: ScmProvider,
    @Query('strategy') strategy?: 'azure' | 'jenkins',
    @Query('connectionId') connectionId?: string,
    @Query('namespace') namespace?: string,
    @Query('project') project?: string,
  ) {
    return this.deploymentService.listRepos(
      provider ?? strategy ?? 'azure',
      connectionId,
      namespace,
      project,
    );
  }

  @Get('branches')
  listBranches(
    @Query('provider') provider: ScmProvider | undefined,
    @Query('strategy') strategy: 'azure' | 'jenkins' | undefined,
    @Query('repo') repo: string,
    @Query('project') project?: string,
    @Query('connectionId') connectionId?: string,
    @Query('namespace') namespace?: string,
    @Query('repositoryId') repositoryId?: string,
    @Query('bindingId') bindingId?: string,
  ) {
    return this.deploymentService.listBranches(
      provider ?? strategy ?? 'azure',
      repo,
      project,
      connectionId,
      namespace,
      repositoryId,
      bindingId,
    );
  }

  @Get('scm/:provider/defaults')
  scmDefaults(
    @Param('provider') provider: ScmProvider,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.deploymentService.getScmDefaults(provider, connectionId);
  }
}
