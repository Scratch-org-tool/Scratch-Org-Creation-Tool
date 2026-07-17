import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { jenkinsTriggerSchema } from '@sfcc/shared';
import { AuthGuard } from '../../common/auth.guard';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { JenkinsService } from '../../integrations/jenkins/jenkins.service';

/**
 * First-class Jenkins runner: browse jobs, trigger (parameterized) builds,
 * follow queue items, and stream progressive console logs.
 *
 * Job paths are folder-qualified (`folder/job`) and passed via the `path`
 * query/body parameter to avoid URL-encoding ambiguity in route params.
 */
@Controller('jenkins')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('deployment')
export class JenkinsController {
  constructor(private readonly jenkins: JenkinsService) {}

  @Get('status')
  status() {
    return this.jenkins.getStatus();
  }

  @Get('jobs')
  listJobs() {
    return this.jenkins.listJobs();
  }

  @Get('job')
  async jobDetail(@Query('path') path?: string) {
    if (!path) throw new BadRequestException('path query parameter is required');
    const detail = await this.jenkins.getJobDetail(path);
    if (!detail) throw new BadRequestException(`Job '${path}' was not found on Jenkins`);
    return detail;
  }

  @Post('trigger')
  trigger(@Body() body: unknown) {
    const parsed = jenkinsTriggerSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid trigger payload');
    }
    return this.jenkins.triggerBuild(parsed.data.path, parsed.data.parameters ?? {});
  }

  @Get('queue/:id')
  queueItem(@Param('id', ParseIntPipe) id: number) {
    return this.jenkins.getQueueItem(id);
  }

  @Get('build/:number')
  async build(
    @Param('number', ParseIntPipe) number: number,
    @Query('path') path?: string,
  ) {
    if (!path) throw new BadRequestException('path query parameter is required');
    const build = await this.jenkins.getBuild(path, number);
    if (!build) throw new BadRequestException(`Build #${number} was not found`);
    return build;
  }

  @Get('build/:number/log')
  log(
    @Param('number', ParseIntPipe) number: number,
    @Query('path') path?: string,
    @Query('start') start?: string,
  ) {
    if (!path) throw new BadRequestException('path query parameter is required');
    const offset = Number(start ?? 0);
    return this.jenkins.getConsoleLog(path, number, Number.isFinite(offset) ? offset : 0);
  }

  @Post('build/:number/stop')
  stop(
    @Param('number', ParseIntPipe) number: number,
    @Query('path') path?: string,
  ) {
    if (!path) throw new BadRequestException('path query parameter is required');
    return this.jenkins.stopBuild(path, number);
  }
}
