import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsAutomationService } from './notifications-automation.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { NotificationSettings } from './entities/notification-settings.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailProvider } from './providers/email.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';
import { EmailTemplatesService } from './email-templates.service';
import { BookingsModule } from '../bookings/bookings.module';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationSettings, EmailTemplate]),
    BookingsModule,
    PropertiesModule,
  ],
  providers: [
    NotificationsService,
    NotificationsAutomationService,
    EmailProvider,
    WhatsappProvider,
    EmailTemplatesService,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService, EmailTemplatesService],
})
export class NotificationsModule {}
