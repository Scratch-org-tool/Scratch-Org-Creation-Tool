import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'sfcc-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      pid: process.pid,
    };
  }
}
