import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { RequireRole, RoleGuard } from '../../common/role.guard';
import { GitHubIntegrationService } from './github-integration.service';
import { GitHubWebhookService } from './github-webhook.service';

@Controller('integrations')
@UseGuards(AuthGuard, RoleGuard)
export class ProviderIntegrationController {
  constructor(private readonly github: GitHubIntegrationService) {}

  @Get(':provider/connection')
  getConnection(@Param('provider') provider: string) {
    this.assertGitHub(provider);
    return this.github.getStatus();
  }

  @Post(':provider/connection')
  @RequireRole('admin')
  connect(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
  ) {
    this.assertGitHub(provider);
    return this.github.connect(body, userId);
  }

  @Post(':provider/connection/verify')
  @RequireRole('admin')
  verify(@Param('provider') provider: string) {
    this.assertGitHub(provider);
    return this.github.verify();
  }

  @Delete(':provider/connection')
  @RequireRole('admin')
  disconnect(@Param('provider') provider: string) {
    this.assertGitHub(provider);
    return this.github.disconnect();
  }

  private assertGitHub(provider: string): void {
    if (provider !== 'github') {
      throw new BadRequestException(`Unsupported integration provider "${provider}"`);
    }
  }
}

@Controller('integrations/github/webhooks')
export class GitHubWebhookController {
  constructor(private readonly webhooks: GitHubWebhookService) {}

  @Post()
  receive(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature?: string,
    @Headers('x-github-delivery') deliveryId?: string,
    @Headers('x-github-event') eventType?: string,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException('Raw request body is required for webhook verification');
    }
    return this.webhooks.receive({
      rawBody: request.rawBody,
      signature,
      deliveryId,
      eventType,
    });
  }
}
