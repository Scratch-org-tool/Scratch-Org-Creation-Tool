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
import { SandboxRefreshService } from './sandbox-refresh.service';

@Controller('sandbox-refresh')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('environment')
export class SandboxRefreshController {
  constructor(private readonly service: SandboxRefreshService) {}

  @Get()
  list(
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId?: string,
  ) {
    return this.service.list(userId, this.isAdmin(req), orgId);
  }

  @Post()
  create(
    @Body() body: unknown,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(body, userId, this.isAdmin(req));
  }

  @Post(':id/complete')
  complete(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.complete(id, userId, this.isAdmin(req));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(id, body, userId, this.isAdmin(req));
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(id, userId, this.isAdmin(req));
  }

  private isAdmin(req: AuthenticatedRequest): boolean {
    return req.userProfile?.role === 'admin';
  }
}
