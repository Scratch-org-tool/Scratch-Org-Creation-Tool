import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../common/auth.guard';
import type {
  WorkItemCreateInput,
  WorkItemUpdateInput,
} from '../../integrations/foundation/adapter.contracts';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(AuthGuard)
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get('scm/:provider/status')
  scmStatus(@Param('provider') provider: string, @Query('connectionId') connectionId?: string) {
    return this.service.scmStatus(provider, connectionId);
  }

  @Get('scm/:provider/namespaces')
  namespaces(@Param('provider') provider: string, @Query('connectionId') connectionId?: string) {
    return this.service.namespaces(provider, connectionId);
  }

  @Get('scm/:provider/repositories')
  repositories(
    @Param('provider') provider: string,
    @Query('connectionId') connectionId?: string,
    @Query('namespace') namespace?: string,
    @Query('project') project?: string,
  ) {
    return this.service.repositories(provider, { connectionId, namespace, project });
  }

  @Get('scm/:provider/branches')
  branches(
    @Param('provider') provider: string,
    @Query('repo') repo: string,
    @Query('branch') branch = 'main',
    @Query('connectionId') connectionId?: string,
    @Query('namespace') namespace?: string,
    @Query('project') project?: string,
    @Query('repositoryId') repositoryId?: string,
  ) {
    if (!repo) throw new BadRequestException('repo is required');
    return this.service.branches(provider, {
      repo,
      branch,
      connectionId,
      namespace,
      project,
      repositoryId,
    });
  }

  @Get('work-items/:provider/status')
  workItemStatus(
    @Param('provider') provider: string,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.service.workItemStatus(provider, connectionId);
  }

  @Get('work-items/:provider/sites')
  sites(@Param('provider') provider: string, @Query('connectionId') connectionId?: string) {
    return this.service.sites(provider, connectionId);
  }

  @Get('work-items/:provider/projects')
  projects(@Param('provider') provider: string, @Query('connectionId') connectionId?: string) {
    return this.service.projects(provider, connectionId);
  }

  @Get('work-items/:provider/overview')
  overview(@Param('provider') provider: string, @Query('project') project: string) {
    if (!project) throw new BadRequestException('project is required');
    return this.service.overview(provider, project);
  }

  @Get('work-items/:provider/items')
  items(
    @Param('provider') provider: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.service.query(provider, {
      connectionId: query.connectionId,
      project: query.project,
      assigneeEmail: query.assigneeEmail,
      assigneeId: query.assigneeId,
      state: query.state,
      text: query.text,
      jql: query.jql,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      pageToken: query.pageToken,
      types: query.types?.split(',').map((value) => value.trim()).filter(Boolean),
    });
  }

  @Post('work-items/:provider/items')
  create(@Param('provider') provider: string, @Body() body: WorkItemCreateInput) {
    return this.service.create(provider, body);
  }

  @Get('work-items/:provider/items/:id')
  detail(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Query('project') project?: string,
  ) {
    return this.service.detail(provider, id, project);
  }

  @Patch('work-items/:provider/items/:id')
  update(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Body() body: WorkItemUpdateInput,
  ) {
    return this.service.update(provider, id, body);
  }

  @Get('work-items/:provider/items/:id/comments')
  comments(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Query('project') project?: string,
  ) {
    return this.service.comments(provider, id, project);
  }

  @Post('work-items/:provider/items/:id/comments')
  addComment(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Body() body: { body?: string },
    @Query('project') project?: string,
  ) {
    if (!body.body?.trim()) throw new BadRequestException('body is required');
    return this.service.addComment(provider, id, body.body, project);
  }

  @Get('work-items/:provider/items/:id/states')
  states(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Query('project') project?: string,
  ) {
    return this.service.states(provider, id, project);
  }

  @Patch('work-items/:provider/items/:id/state')
  updateState(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Body() body: { state?: string },
    @Query('project') project?: string,
  ) {
    if (!body.state?.trim()) throw new BadRequestException('state is required');
    return this.service.updateState(provider, id, body.state, project);
  }

  @Get('work-items/:provider/issue-types')
  issueTypes(@Param('provider') provider: string, @Query('project') project: string) {
    if (!project) throw new BadRequestException('project is required');
    return this.service.issueTypes(provider, project);
  }

  @Get('work-items/:provider/labels')
  labels(@Param('provider') provider: string, @Query('project') project: string) {
    if (!project) throw new BadRequestException('project is required');
    return this.service.labels(provider, project);
  }

  @Get('work-items/:provider/users')
  users(
    @Param('provider') provider: string,
    @Query('project') project?: string,
    @Query('query') query?: string,
  ) {
    return this.service.users(provider, project, query);
  }

  @Get('work-items/:provider/items/:id/history')
  history(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Query('project') project?: string,
  ) {
    return this.service.history(provider, id, project);
  }

  @Get('work-items/:provider/items/:id/subissues')
  subIssues(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Query('project') project?: string,
  ) {
    return this.service.subIssues(provider, id, project);
  }

  @Post('work-items/:provider/items/:id/subissues')
  addSubIssue(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Body() body: { subIssueId?: string },
    @Query('project') project?: string,
  ) {
    if (!body.subIssueId?.trim()) throw new BadRequestException('subIssueId is required');
    return this.service.addSubIssue(provider, id, body.subIssueId, project);
  }

  @Get('work-items/:provider/items/:id/attachments')
  attachments(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Query('project') project?: string,
  ) {
    return this.service.attachments(provider, id, project);
  }

  @Post('work-items/:provider/items/:id/attachments')
  uploadAttachment(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Body() body: { fileName: string; contentType: string; base64: string },
    @Query('project') project?: string,
  ) {
    return this.service.uploadAttachment(provider, id, body, project);
  }

  @Get('work-items/:provider/items/:id/attachments/:attachmentId/content')
  async attachmentContent(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Query('project') project: string | undefined,
    @Res() response: Response,
  ) {
    const content = await this.service.attachmentContent(
      provider,
      id,
      attachmentId,
      project,
    );
    response.setHeader('Content-Type', content.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${content.fileName.replace(/["\r\n]/g, '')}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(content.buffer);
  }
}
