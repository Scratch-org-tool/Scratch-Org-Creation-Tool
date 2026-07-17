import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { SfPluginReadinessService } from './sf-plugin-readiness.service';

@Controller('health')
export class HealthController {
  constructor(private readonly sfPlugins: SfPluginReadinessService) {}

  @Get()
  check() {
    const sfCli = this.sfPlugins.getSnapshot();
    return {
      status: 'ok',
      service: 'sfcc-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      pid: process.pid,
      salesforceCli: {
        state: sfCli.state,
        ready: sfCli.ready,
      },
    };
  }

  @Get('plugins')
  @UseGuards(AuthGuard)
  plugins() {
    return this.sfPlugins.getSnapshot();
  }
}
