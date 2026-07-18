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
  @RequireRole('admin')
  connectScm(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
  ) {
    return this.service.connectScm(provider, body, userId);
  }

  @Post('work-items/:provider/connect')
  @RequireRole('admin')
  connectWorkItems(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
  ) {
    return this.service.connectWorkItems(provider, body, userId);
  }

  @Post('scm/:provider/:id/verify')
  @RequireRole('admin')
  verifyScm(@Param('provider') provider: string, @Param('id') id: string) {
    return this.service.verifyScm(provider, id);
  }

  @Post('work-items/:provider/:id/verify')
  @RequireRole('admin')
  verifyWorkItems(@Param('provider') provider: string, @Param('id') id: string) {
    return this.service.verifyWorkItems(provider, id);
  }

  @Delete('scm/:provider/:id')
  @RequireRole('admin')
  disconnectScm(@Param('provider') provider: string, @Param('id') id: string) {
    return this.service.disconnectScm(provider, id);
  }

  @Delete('work-items/:provider/:id')
  @RequireRole('admin')
  disconnectWorkItems(@Param('provider') provider: string, @Param('id') id: string) {
    return this.service.disconnectWorkItems(provider, id);
  }

  @Get('bindings')
  @RequireRole('admin')
  listBindings(@Query('connectionId') connectionId?: string) {
    return this.service.listBindings(connectionId);
  }

  @Post('bindings')
  @RequireRole('admin')
  saveBinding(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.service.saveBinding(body, userId);
  }

  @Delete('bindings/:id')
  @RequireRole('admin')
  deleteBinding(@Param('id') id: string) {
    return this.service.deleteBinding(id);
  }

  @Get('identity-bindings')
  @RequireRole('admin')
  listIdentityBindings(@Query('connectionId') connectionId?: string) {
    return this.service.listIdentityBindings(connectionId);
  }

  @Post('identity-bindings')
  @RequireRole('admin')
  saveIdentityBinding(@Body() body: unknown) {
    return this.service.saveIdentityBinding(body);
  }

  @Delete('identity-bindings/:id')
  @RequireRole('admin')
  deleteIdentityBinding(@Param('id') id: string) {
    return this.service.deleteIdentityBinding(id);
  }
}
