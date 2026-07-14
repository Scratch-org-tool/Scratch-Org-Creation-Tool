import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { DefectsService } from './defects.service';
import { AuthGuard, type AuthenticatedRequest } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';

@Controller('defects')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('defects')
export class DefectsController {
  constructor(private readonly defectsService: DefectsService) {}

  @Get('projects')
  listProjects() {
    return this.defectsService.listProjects();
  }

  @Get('overview')
  getOverview(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Query() query: Record<string, string>,
  ) {
    const isAdmin = req.userProfile?.role === 'admin';
    return this.defectsService.getOverview(userId, isAdmin, query);
  }

  @Get('work-items')
  listWorkItems(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Query() query: Record<string, string>,
  ) {
    const isAdmin = req.userProfile?.role === 'admin';
    return this.defectsService.listWorkItems(userId, isAdmin, query);
  }

  @Get('work-items/:id')
  getWorkItem(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('project') project?: string,
  ) {
    const isAdmin = req.userProfile?.role === 'admin';
    return this.defectsService.getWorkItem(userId, isAdmin, id, project);
  }

  @Get('work-items/:id/comments')
  getComments(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('project') project?: string,
  ) {
    const isAdmin = req.userProfile?.role === 'admin';
    return this.defectsService.getComments(userId, isAdmin, id, project);
  }

  @Get('work-items/:id/states')
  getStates(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('project') project?: string,
  ) {
    const isAdmin = req.userProfile?.role === 'admin';
    return this.defectsService.getStates(userId, isAdmin, id, project);
  }

  @Get('work-items/:id/history')
  getHistory(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('project') project?: string,
  ) {
    const isAdmin = req.userProfile?.role === 'admin';
    return this.defectsService.getHistory(userId, isAdmin, id, project);
  }

  @Get('work-items/:id/attachments')
  getAttachments(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('project') project?: string,
  ) {
    const isAdmin = req.userProfile?.role === 'admin';
    return this.defectsService.getAttachments(userId, isAdmin, id, project);
  }

  @Get('work-items/:id/attachments/:attachmentId/content')
  async getAttachmentContent(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('attachmentId') attachmentId: string,
    @Query('project') project: string | undefined,
    @Res() res: Response,
  ) {
    const isAdmin = req.userProfile?.role === 'admin';
    const { buffer, contentType, fileName } = await this.defectsService.getAttachmentContent(
      userId,
      isAdmin,
      id,
      attachmentId,
      project,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  }

  @Patch('work-items/:id/state')
  updateState(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @Query('project') project?: string,
  ) {
    const isAdmin = req.userProfile?.role === 'admin';
    return this.defectsService.updateState(userId, isAdmin, id, body, project);
  }

  @Post('work-items/:id/investigate')
  investigate(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('project') project?: string,
  ) {
    const isAdmin = req.userProfile?.role === 'admin';
    return this.defectsService.investigate(userId, isAdmin, id, project);
  }
}
