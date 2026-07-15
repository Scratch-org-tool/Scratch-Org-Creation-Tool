import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { IntegrationError, type IntegrationErrorCode } from './adapter.errors';

@Catch(IntegrationError)
export class IntegrationErrorFilter implements ExceptionFilter {
  catch(error: IntegrationError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = error.options.statusCode ?? this.status(error.code);
    response.status(statusCode).json({
      statusCode,
      error: error.code,
      message: error.message,
      provider: error.options.provider ?? null,
      retryable: error.options.retryable ?? false,
    });
  }

  private status(code: IntegrationErrorCode): number {
    switch (code) {
      case 'authentication_failed':
      case 'not_connected':
        return 401;
      case 'authorization_failed':
        return 403;
      case 'not_found':
        return 404;
      case 'rate_limited':
        return 429;
      case 'unsupported_capability':
      case 'adapter_not_registered':
        return 501;
      case 'provider_unavailable':
        return 503;
      case 'invalid_request':
      default:
        return 400;
    }
  }
}
