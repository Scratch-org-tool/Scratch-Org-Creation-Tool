import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';

@Controller('plans')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('deployment')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.plansService.list(userId);
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.plansService.create(body, userId);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.plansService.get(id, userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
  ) {
    return this.plansService.update(id, body, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.plansService.remove(id, userId);
  }

  @Post(':id/execute')
  execute(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.plansService.execute(id, userId);
  }

  @Patch(':id/schedule')
  updateSchedule(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
  ) {
    return this.plansService.updateSchedule(id, body, userId);
  }

  @Get(':id/runs')
  listRuns(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.plansService.listRuns(id, userId, limit ? parseInt(limit, 10) : 20);
  }
}
