import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * Records request count + latency per (method, route pattern, status). The
 * Express route pattern (e.g. `/api/drift/monitors/:id`) is used instead of
 * the raw URL to keep label cardinality bounded.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const started = process.hrtime.bigint();
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { route?: { path?: string } }>();
    const response = http.getResponse<Response>();

    const record = () => {
      const route = request.route?.path ?? request.path ?? 'unknown';
      // Never track the scrape endpoint itself.
      if (route.includes('/metrics')) return;
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      this.metrics.recordHttpRequest(
        request.method,
        typeof route === 'string' ? route : 'unknown',
        response.statusCode,
        seconds,
      );
    };

    return next.handle().pipe(
      tap({
        next: record,
        error: record,
      }),
    );
  }
}
