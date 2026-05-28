import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsAutomationService } from './notifications-automation.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { NotificationSettings } from './entities/notification-settings.entity';
import { EmailProvider } from './providers/email.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';
import { BookingsModule } from '../bookings/bookings.module';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationSettings]),
    BookingsModule,
    PropertiesModule,
  ],
  providers: [
    NotificationsService,
    NotificationsAutomationService,
    EmailProvider,
    WhatsappProvider,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
