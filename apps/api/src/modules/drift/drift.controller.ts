import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DriftService } from './drift.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';

@Controller('drift/monitors')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('deployment')
export class DriftController {
  constructor(private readonly driftService: DriftService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.driftService.list(userId);
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.driftService.create(body, userId);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.driftService.get(id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() userId: string) {
    return this.driftService.update(id, body, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.driftService.remove(id, userId);
  }

  @Post(':id/check')
  runNow(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.driftService.runNow(id, userId);
  }

  @Get(':id/snapshots')
  listSnapshots(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.driftService.listSnapshots(id, userId, limit ? parseInt(limit, 10) : 20);
  }

  @Get(':id/snapshots/:snapshotId')
  getSnapshot(
    @Param('id') id: string,
    @Param('snapshotId') snapshotId: string,
    @CurrentUser() userId: string,
  ) {
    return this.driftService.getSnapshot(id, snapshotId, userId);
  }
}
