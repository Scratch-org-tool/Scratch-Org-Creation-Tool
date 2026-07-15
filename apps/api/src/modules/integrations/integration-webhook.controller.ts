import { Body, Controller, Param, Post, Req } from '@nestjs/common';
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
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(payload ?? {}));
    return this.service.receive({
      provider,
      connectionId,
      headers: request.headers,
      rawBody,
      payload,
    });
  }
}
