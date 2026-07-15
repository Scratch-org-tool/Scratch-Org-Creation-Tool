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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { RequireRole, RoleGuard } from '../../common/role.guard';
import type {
  WorkItemCreateInput,
  WorkItemUpdateInput,
} from '../../integrations/foundation/adapter.contracts';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(AuthGuard, RoleGuard)
@RequireRole('admin')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get('scm/:provider/status')
  scmStatus(@Param('provider') provider: string, @Query('connectionId') connectionId?: string) {
    return this.service.scmStatus(provider, connectionId);
  }

  @Get('scm/:provider/defaults')
  scmDefaults(@Param('provider') provider: string, @Query('connectionId') connectionId?: string) {
    return this.service.scmDefaults(provider, connectionId);
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
    @Query('bindingId') bindingId?: string,
  ) {
    if (!repo) throw new BadRequestException('repo is required');
    return this.service.branches(provider, {
      repo,
      branch,
      connectionId,
      namespace,
      project,
      repositoryId,
      bindingId,
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
  overview(
    @Param('provider') provider: string,
    @Query('project') project: string,
    @Query('connectionId') connectionId?: string,
  ) {
    if (!project) throw new BadRequestException('project is required');
    return this.service.overview(provider, project, connectionId);
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
  create(
    @Param('provider') provider: string,
    @Body() body: WorkItemCreateInput,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.service.create(provider, { ...body, connectionId: connectionId ?? body.connectionId });
  }

  @Get('work-items/:provider/items/:id')
  detail(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Query('project') project?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.service.detail(provider, id, project, connectionId);
  }

  @Patch('work-items/:provider/items/:id')
  update(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Body() body: WorkItemUpdateInput,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.service.update(provider, id, {
      ...body,
      connectionId: connectionId ?? body.connectionId,
    });
  }

  @Get('work-items/:provider/items/:id/comments')
  comments(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Query('project') project?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.service.comments(provider, id, project, connectionId);
  }

  @Post('work-items/:provider/items/:id/comments')
  addComment(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Body() body: { body?: string },
    @Query('project') project?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    if (!body.body?.trim()) throw new BadRequestException('body is required');
    return this.service.addComment(provider, id, body.body, project, connectionId);
  }

  @Get('work-items/:provider/items/:id/states')
  states(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Query('project') project?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.service.states(provider, id, project, connectionId);
  }

  @Patch('work-items/:provider/items/:id/state')
  updateState(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Body() body: { state?: string },
    @Query('project') project?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    if (!body.state?.trim()) throw new BadRequestException('state is required');
    return this.service.updateState(provider, id, body.state, project, connectionId);
  }

  @Get('work-items/:provider/issue-types')
  issueTypes(
    @Param('provider') provider: string,
    @Query('project') project: string,
    @Query('connectionId') connectionId?: string,
  ) {
    if (!project) throw new BadRequestException('project is required');
    return this.service.issueTypes(provider, project, connectionId);
  }

  @Get('work-items/:provider/labels')
  labels(
    @Param('provider') provider: string,
    @Query('project') project: string,
    @Query('connectionId') connectionId?: string,
  ) {
    if (!project) throw new BadRequestException('project is required');
    return this.service.labels(provider, project, connectionId);
  }

  @Get('work-items/:provider/users')
  users(
    @Param('provider') provider: string,
    @Query('project') project?: string,
    @Query('query') query?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.service.users(provider, project, query, connectionId);
  }

  @Get('work-items/:provider/items/:id/history')
  history(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Query('project') project?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.service.history(provider, id, project, connectionId);
  }

  @Get('work-items/:provider/items/:id/subissues')
  subIssues(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Query('project') project?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.service.subIssues(provider, id, project, connectionId);
  }

  @Post('work-items/:provider/items/:id/subissues')
  addSubIssue(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Body() body: { subIssueId?: string },
    @Query('project') project?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    if (!body.subIssueId?.trim()) throw new BadRequestException('subIssueId is required');
    return this.service.addSubIssue(provider, id, body.subIssueId, project, connectionId);
  }

  @Get('work-items/:provider/items/:id/attachments')
  attachments(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Query('project') project?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.service.attachments(provider, id, project, connectionId);
  }

  @Post('work-items/:provider/items/:id/attachments')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { files: 1, fileSize: 10 * 1024 * 1024 },
  }))
  uploadAttachment(
    @CurrentUser() actorId: string,
    @Param('provider') provider: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('project') project?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    if (!file) throw new BadRequestException('A multipart file field named "file" is required');
    return this.service.uploadAttachment(
      actorId,
      provider,
      id,
      {
        fileName: file.originalname,
        contentType: file.mimetype,
        buffer: file.buffer,
      },
      project,
      connectionId,
    );
  }

  @Get('work-items/:provider/items/:id/attachments/:attachmentId/content')
  async attachmentContent(
    @Param('provider') provider: string,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Query('project') project: string | undefined,
    @Query('connectionId') connectionId: string | undefined,
    @Res() response: Response,
  ) {
    const content = await this.service.attachmentContent(
      provider,
      id,
      attachmentId,
      project,
      connectionId,
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
