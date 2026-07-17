import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MailService } from './mail.service';
import { ChannelWebhookService } from './channel-webhook.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, MailService, ChannelWebhookService],
  exports: [NotificationsService, MailService, ChannelWebhookService],
})
export class NotificationsModule {}
