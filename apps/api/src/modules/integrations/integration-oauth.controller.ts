import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { RequireRole, RoleGuard } from '../../common/role.guard';
import { IntegrationOAuthService } from './integration-oauth.service';

@Controller('integrations/oauth')
@UseGuards(AuthGuard, RoleGuard)
@RequireRole('admin')
export class IntegrationOAuthController {
  constructor(private readonly oauth: IntegrationOAuthService) {}

  @Post(':provider/start')
  start(
    @Param('provider') provider: string,
    @CurrentUser() appUserId: string,
    @Body() body: { returnPath?: string },
  ) {
    return this.oauth.start(provider, appUserId, body);
  }

  @Get('jira/selections/:state')
  jiraSelection(
    @Param('state') state: string,
    @CurrentUser() appUserId: string,
  ) {
    return this.oauth.jiraSelection(state, appUserId);
  }

  @Post('jira/selections/:state')
  selectJiraSite(
    @Param('state') state: string,
    @CurrentUser() appUserId: string,
    @Body() body: { siteId?: string },
  ) {
    return this.oauth.selectJiraSite(state, body.siteId ?? '', appUserId);
  }
}

@Controller('integrations/oauth')
export class IntegrationOAuthCallbackController {
  constructor(private readonly oauth: IntegrationOAuthService) {}

  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('installation_id') installationId: string | undefined,
    @Res() response: Response,
  ) {
    if (!state) {
      return response.redirect(303, this.oauth.failureUrl(provider, 'Missing provider state'));
    }
    try {
      const target = await this.oauth.callback(provider, state, code, installationId);
      return response.redirect(303, target);
    } catch {
      // Do not reflect provider errors, codes, tokens, or stored secrets into the browser.
      return response.redirect(303, this.oauth.failureUrl(provider));
    }
  }
}
