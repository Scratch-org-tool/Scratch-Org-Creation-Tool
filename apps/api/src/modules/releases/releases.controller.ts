import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/auth.guard';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { ReleasesService } from './releases.service';

@Controller('releases')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('deployment')
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.releases.list(status);
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.releases.create(body, userId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.releases.get(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.releases.update(id, body, userId, this.isAdmin(req));
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.releases.remove(id, userId, this.isAdmin(req));
  }

  @Post(':id/items')
  addItem(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.releases.addItem(id, body, userId, this.isAdmin(req));
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.releases.removeItem(id, itemId, userId, this.isAdmin(req));
  }

  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.releases.submit(id, userId, this.isAdmin(req));
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: unknown, @CurrentUser() userId: string) {
    return this.releases.approve(id, body, userId);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() body: unknown, @CurrentUser() userId: string) {
    return this.releases.reject(id, body, userId);
  }

  @Post(':id/release')
  release(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.releases.release(id, userId, this.isAdmin(req));
  }

  @Post(':id/reopen')
  reopen(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.releases.reopen(id, userId, this.isAdmin(req));
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.releases.cancel(id, userId, this.isAdmin(req));
  }

  @Post(':id/generate-notes')
  generateNotes(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.releases.generateNotes(id, userId, this.isAdmin(req));
  }

  private isAdmin(req: AuthenticatedRequest): boolean {
    return req.userProfile?.role === 'admin';
  }
}
