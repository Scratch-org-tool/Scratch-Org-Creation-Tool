import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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
  async start(
    @Param('provider') provider: string,
    @CurrentUser() appUserId: string,
    @Body() body: { returnPath?: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.oauth.start(provider, appUserId, body);
    response.cookie(this.cookieName(result.state), result.browserBinding, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1_000,
    });
    return { authorizationUrl: result.authorizationUrl, provider: result.provider };
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

  private cookieName(state: string): string {
    return `__Host-sfcc_oauth_${state.slice(0, 16)}`;
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
    @Req() request: Request,
    @Res() response: Response,
  ) {
    if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state)) {
      return response.redirect(303, this.oauth.failureUrl(provider, 'Missing provider state'));
    }
    const cookieName = `__Host-sfcc_oauth_${state.slice(0, 16)}`;
    const browserBinding = this.cookie(request.headers.cookie, cookieName);
    response.clearCookie(cookieName, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
    try {
      const target = await this.oauth.callback(
        provider,
        state,
        browserBinding ?? '',
        code,
        installationId,
      );
      return response.redirect(303, target);
    } catch {
      // Do not reflect provider errors, codes, tokens, or stored secrets into the browser.
      return response.redirect(303, this.oauth.failureUrl(provider));
    }
  }

  private cookie(header: string | undefined, name: string): string | null {
    for (const part of header?.split(';') ?? []) {
      const separator = part.indexOf('=');
      if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
    return null;
  }
}
