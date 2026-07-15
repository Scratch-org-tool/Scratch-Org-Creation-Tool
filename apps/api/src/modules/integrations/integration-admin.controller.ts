import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { RequireRole, RoleGuard } from '../../common/role.guard';
import { IntegrationAdminService } from './integration-admin.service';

@Controller('integrations/admin')
@UseGuards(AuthGuard, RoleGuard)
@RequireRole('admin')
export class IntegrationAdminController {
  constructor(private readonly service: IntegrationAdminService) {}

  @Get('connections')
  listConnections() {
    return this.service.listConnections();
  }

  @Post('scm/:provider/connect')
  connectScm(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
  ) {
    return this.service.connectScm(provider, body, userId);
  }

  @Post('work-items/:provider/connect')
  connectWorkItems(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
  ) {
    return this.service.connectWorkItems(provider, body, userId);
  }

  @Post('scm/:provider/:id/verify')
  verifyScm(@Param('provider') provider: string, @Param('id') id: string) {
    return this.service.verifyScm(provider, id);
  }

  @Post('work-items/:provider/:id/verify')
  verifyWorkItems(@Param('provider') provider: string, @Param('id') id: string) {
    return this.service.verifyWorkItems(provider, id);
  }

  @Delete('scm/:provider/:id')
  disconnectScm(@Param('provider') provider: string, @Param('id') id: string) {
    return this.service.disconnectScm(provider, id);
  }

  @Delete('work-items/:provider/:id')
  disconnectWorkItems(@Param('provider') provider: string, @Param('id') id: string) {
    return this.service.disconnectWorkItems(provider, id);
  }

  @Get('bindings')
  listBindings() {
    return this.service.listBindings();
  }

  @Post('bindings')
  saveBinding(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.service.saveBinding(body, userId);
  }

  @Delete('bindings/:id')
  deleteBinding(@Param('id') id: string) {
    return this.service.deleteBinding(id);
  }

  @Get('identity-bindings')
  listIdentityBindings(@Query('connectionId') connectionId?: string) {
    return this.service.listIdentityBindings(connectionId);
  }

  @Post('identity-bindings')
  saveIdentityBinding(@Body() body: unknown) {
    return this.service.saveIdentityBinding(body);
  }

  @Delete('identity-bindings/:id')
  deleteIdentityBinding(@Param('id') id: string) {
    return this.service.deleteIdentityBinding(id);
  }
}
