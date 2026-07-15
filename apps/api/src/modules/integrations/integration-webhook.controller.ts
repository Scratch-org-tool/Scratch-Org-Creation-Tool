import { BadRequestException, Body, Controller, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { IntegrationWebhookService } from './integration-webhook.service';

type RawRequest = Request & { rawBody?: Buffer };

@Controller('integrations/webhooks')
export class IntegrationWebhookController {
  constructor(private readonly service: IntegrationWebhookService) {}

  @Post(':provider/:connectionId')
  receive(
    @Param('provider') provider: string,
    @Param('connectionId') connectionId: string,
    @Req() request: RawRequest,
    @Body() payload: unknown,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException('Exact webhook request bytes are required');
    }
    const url = new URL(request.originalUrl, 'https://webhook.invalid');
    return this.service.receive({
      provider,
      connectionId,
      headers: request.headers,
      rawBody: request.rawBody,
      payload,
      method: request.method,
      path: url.pathname,
      query: url.search.slice(1),
    });
  }
}
