import {
  Controller,
  Get,
  Header,
  Headers,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { MetricsService } from './metrics.service';

/**
 * Prometheus scrape endpoint.
 *
 * Scrapers cannot obtain Firebase tokens, so authentication uses a static
 * bearer token: set METRICS_TOKEN and configure the scraper with
 * `Authorization: Bearer <token>`. Without METRICS_TOKEN the endpoint is open
 * in development and hidden (404) in production.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(@Headers('authorization') authorization?: string) {
    const token = process.env.METRICS_TOKEN;
    if (token) {
      if (authorization !== `Bearer ${token}`) {
        throw new UnauthorizedException('Invalid metrics token');
      }
    } else if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    return this.metrics.render();
  }
}

/** JSON view of the same data for the in-app monitoring dashboard. */
@Controller('metrics/summary')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('monitoring')
export class MetricsSummaryController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  summary() {
    return this.metrics.summary();
  }
}
