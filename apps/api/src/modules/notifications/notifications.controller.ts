import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  notificationListQuerySchema,
  notificationPreferencesUpdateSchema,
  notificationSettingsUpdateSchema,
  notificationWebhookCreateSchema,
  notificationWebhookUpdateSchema,
} from '@sfcc/shared';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { RequireRole, RoleGuard } from '../../common/role.guard';
import { ChannelWebhookService } from './channel-webhook.service';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard, RoleGuard)
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly webhooks: ChannelWebhookService,
  ) {}

  @Get()
  list(@CurrentUser() userId: string, @Query() query: Record<string, unknown>) {
    const parsed = notificationListQuerySchema.safeParse(query ?? {});
    const q = parsed.success ? parsed.data : notificationListQuerySchema.parse({});
    return this.service.list(userId, q);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() userId: string) {
    return this.service.unreadCount(userId);
  }

  @Post(':id/read')
  markRead(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.service.markRead(userId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() userId: string) {
    return this.service.markAllRead(userId);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() userId: string) {
    return this.service.getPreferences(userId);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() userId: string, @Body() body: unknown) {
    const parsed = notificationPreferencesUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Invalid notification preferences');
    }
    return this.service.updatePreferences(userId, parsed.data.emailNotifications);
  }

  @Get('settings')
  @RequireRole('admin')
  getSettings() {
    return this.service.getSettings();
  }

  @Patch('settings')
  @RequireRole('admin')
  updateSettings(@CurrentUser() userId: string, @Body() body: unknown) {
    const parsed = notificationSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid notification settings',
      );
    }
    return this.service.updateSettings(parsed.data, userId);
  }

  @Post('settings/test')
  @RequireRole('admin')
  sendTest(@CurrentUser() userId: string) {
    return this.service.sendTest(userId);
  }

  @Get('webhooks')
  @RequireRole('admin')
  listWebhooks() {
    return this.webhooks.list();
  }

  @Post('webhooks')
  @RequireRole('admin')
  createWebhook(@CurrentUser() userId: string, @Body() body: unknown) {
    const parsed = notificationWebhookCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid webhook configuration',
      );
    }
    return this.webhooks.create(parsed.data, userId);
  }

  @Patch('webhooks/:id')
  @RequireRole('admin')
  updateWebhook(@Param('id') id: string, @Body() body: unknown) {
    const parsed = notificationWebhookUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid webhook update',
      );
    }
    return this.webhooks.update(id, parsed.data);
  }

  @Delete('webhooks/:id')
  @RequireRole('admin')
  deleteWebhook(@Param('id') id: string) {
    return this.webhooks.remove(id);
  }

  @Post('webhooks/:id/test')
  @RequireRole('admin')
  testWebhook(@Param('id') id: string) {
    return this.webhooks.sendTest(id);
  }
}
