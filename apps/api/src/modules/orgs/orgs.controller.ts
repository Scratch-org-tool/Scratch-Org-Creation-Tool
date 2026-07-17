import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { authorizeOrgSchema, formatZodIssues } from '@sfcc/shared';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';

@Controller('orgs')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('environment')
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Get()
  findAll(@CurrentUser() userId: string) {
    return this.orgsService.findAll(userId);
  }

  @Get('authorize/:alias/status')
  getAuthorizationStatus(@Param('alias') alias: string, @CurrentUser() userId: string) {
    return this.orgsService.getAuthorizationStatus(alias, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.orgsService.findOne(id, userId);
  }

  @Post('authorize')
  @HttpCode(HttpStatus.ACCEPTED)
  async authorize(@Body() body: unknown, @CurrentUser() userId: string) {
    const input = authorizeOrgSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(formatZodIssues(input.error));
    }
    return this.orgsService.authorize(input.data, userId);
  }

  @Post('authorize/cancel')
  cancelAuthorize(@Body() body: { alias: string }, @CurrentUser() userId: string) {
    if (!body?.alias) throw new BadRequestException('alias is required');
    return this.orgsService.cancelAuthorize(body.alias, userId);
  }

  @Post(':alias/revoke')
  revoke(@Param('alias') alias: string, @CurrentUser() userId: string) {
    return this.orgsService.revoke(alias, userId);
  }

  @Post(':alias/open')
  openOrg(@Param('alias') alias: string, @CurrentUser() userId: string) {
    return this.orgsService.openOrg(alias, userId);
  }

  @Delete(':alias')
  deleteScratchOrg(@Param('alias') alias: string, @CurrentUser() userId: string) {
    return this.orgsService.deleteScratchOrg(alias, userId);
  }

  @Post(':alias/extend')
  extendScratchOrg(
    @Param('alias') alias: string,
    @Query('duration') duration: string,
    @CurrentUser() userId: string,
  ) {
    return this.orgsService.extendScratchOrg(alias, parseInt(duration, 10) || 7, userId);
  }
}
