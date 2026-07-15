import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, type AuthenticatedRequest } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { DefectsService } from './defects.service';

type QueryParams = Record<string, string | undefined>;

@Controller('defects')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('defects')
export class DefectsController {
  constructor(private readonly defectsService: DefectsService) {}

  @Get('contexts')
  listContexts(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
  ) {
    return this.defectsService.listContexts(userId, this.isAdmin(req));
  }

  @Get(['projects', 'providers/:provider/projects'])
  listProjects(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.listProjects(userId, this.isAdmin(req), this.query(query, provider));
  }

  @Get(['overview', 'providers/:provider/overview'])
  getOverview(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.getOverview(userId, this.isAdmin(req), this.query(query, provider));
  }

  @Get(['work-items', 'providers/:provider/work-items'])
  listWorkItems(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.listWorkItems(userId, this.isAdmin(req), this.query(query, provider));
  }

  @Post(['work-items', 'providers/:provider/work-items'])
  createWorkItem(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Body() body: unknown,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.createWorkItem(
      userId,
      this.isAdmin(req),
      body,
      this.query(query, provider),
    );
  }

  @Get(['work-items/types', 'providers/:provider/work-items/types'])
  listTypes(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.listTypes(userId, this.isAdmin(req), this.query(query, provider));
  }

  @Get(['work-items/users', 'providers/:provider/work-items/users'])
  listUsers(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.listUsers(userId, this.isAdmin(req), this.query(query, provider));
  }

  @Get(['work-items/:id', 'providers/:provider/work-items/:id'])
  getWorkItem(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.getWorkItem(
      userId,
      this.isAdmin(req),
      id,
      this.query(query, provider),
    );
  }

  @Patch(['work-items/:id', 'providers/:provider/work-items/:id'])
  updateWorkItem(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.updateWorkItem(
      userId,
      this.isAdmin(req),
      id,
      body,
      this.query(query, provider),
    );
  }

  @Get(['work-items/:id/comments', 'providers/:provider/work-items/:id/comments'])
  getComments(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.getComments(
      userId,
      this.isAdmin(req),
      id,
      this.query(query, provider),
    );
  }

  @Post(['work-items/:id/comments', 'providers/:provider/work-items/:id/comments'])
  addComment(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.addComment(
      userId,
      this.isAdmin(req),
      id,
      body,
      this.query(query, provider),
    );
  }

  @Get(['work-items/:id/states', 'providers/:provider/work-items/:id/states'])
  getStates(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.getStates(
      userId,
      this.isAdmin(req),
      id,
      this.query(query, provider),
    );
  }

  @Patch(['work-items/:id/state', 'providers/:provider/work-items/:id/state'])
  updateState(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.updateState(
      userId,
      this.isAdmin(req),
      id,
      body,
      this.query(query, provider),
    );
  }

  @Get(['work-items/:id/history', 'providers/:provider/work-items/:id/history'])
  getHistory(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.getHistory(
      userId,
      this.isAdmin(req),
      id,
      this.query(query, provider),
    );
  }

  @Get(['work-items/:id/attachments', 'providers/:provider/work-items/:id/attachments'])
  getAttachments(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.getAttachments(
      userId,
      this.isAdmin(req),
      id,
      this.query(query, provider),
    );
  }

  @Post(['work-items/:id/attachments', 'providers/:provider/work-items/:id/attachments'])
  uploadAttachment(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.uploadAttachment(
      userId,
      this.isAdmin(req),
      id,
      body,
      this.query(query, provider),
    );
  }

  @Get([
    'work-items/:id/attachments/:attachmentId/content',
    'providers/:provider/work-items/:id/attachments/:attachmentId/content',
  ])
  async getAttachmentContent(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Query() query: QueryParams,
    @Param('provider') provider: string | undefined,
    @Res() res: Response,
  ) {
    const content = await this.defectsService.getAttachmentContent(
      userId,
      this.isAdmin(req),
      id,
      attachmentId,
      this.query(query, provider),
    );
    res.setHeader('Content-Type', content.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${content.fileName.replace(/["\r\n]/g, '')}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(content.buffer);
  }

  @Get(['work-items/:id/subissues', 'providers/:provider/work-items/:id/subissues'])
  listSubIssues(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.listSubIssues(
      userId,
      this.isAdmin(req),
      id,
      this.query(query, provider),
    );
  }

  @Post(['work-items/:id/subissues', 'providers/:provider/work-items/:id/subissues'])
  addSubIssue(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.addSubIssue(
      userId,
      this.isAdmin(req),
      id,
      body,
      this.query(query, provider),
    );
  }

  @Post(['work-items/:id/investigate', 'providers/:provider/work-items/:id/investigate'])
  investigate(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Query() query: QueryParams,
    @Param('provider') provider?: string,
  ) {
    return this.defectsService.investigate(
      userId,
      this.isAdmin(req),
      id,
      this.query(query, provider),
    );
  }

  private isAdmin(req: AuthenticatedRequest): boolean {
    return req.userProfile?.role === 'admin';
  }

  private query(query: QueryParams, provider?: string): QueryParams {
    return provider ? { ...query, provider } : query;
  }
}
