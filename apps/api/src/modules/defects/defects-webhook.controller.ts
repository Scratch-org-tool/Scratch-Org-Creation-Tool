import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { DefectsWebhookService } from './defects-webhook.service';

/**
 * Public (secret-guarded) webhook endpoint for work-item update events.
 *
 * Register an Azure DevOps Service Hook on `workitem.updated` pointing at
 * `POST /api/defects/webhooks/work-item-updated` with the shared secret in the
 * `x-webhook-secret` header (or `?secret=` when custom headers are not
 * available). Disabled entirely until DEFECTS_WEBHOOK_SECRET is set.
 */
@Controller('defects/webhooks')
export class DefectsWebhookController {
  constructor(private readonly service: DefectsWebhookService) {}

  @Post('work-item-updated')
  @HttpCode(200)
  async workItemUpdated(
    @Body() body: unknown,
    @Headers('x-webhook-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
  ) {
    if (!this.service.isEnabled()) {
      throw new ServiceUnavailableException('Work-item webhooks are not configured');
    }
    if (!this.service.verifySecret(headerSecret ?? querySecret)) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
    const event = this.service.normalize(body);
    if (!event) {
      throw new BadRequestException('Unrecognized work-item payload');
    }
    return this.service.process(event);
  }
}
