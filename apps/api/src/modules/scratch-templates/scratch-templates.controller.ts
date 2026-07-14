import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ScratchTemplatesService } from './scratch-templates.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';

@Controller('environment/scratch-templates')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('environment')
export class ScratchTemplatesController {
  constructor(private readonly templatesService: ScratchTemplatesService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.templatesService.list(userId);
  }

  @Post('validate-bottler-config')
  validateBottlerConfig(@Body() body: unknown) {
    return this.templatesService.validateBottlerConfig(body);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.templatesService.get(id, userId);
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.templatesService.create(body, userId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() userId: string) {
    return this.templatesService.update(id, body, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.templatesService.remove(id, userId);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.templatesService.duplicate(id, userId);
  }
}
