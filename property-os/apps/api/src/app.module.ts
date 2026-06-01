import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { User } from './modules/users/entities/user.entity';
import { Property } from './modules/properties/entities/property.entity';
import { PropertyUser } from './modules/properties/entities/property-user.entity';
import { RoomType } from './modules/inventory/entities/room-type.entity';
import { RoomAmenity } from './modules/inventory/entities/room-amenity.entity';
import { Room } from './modules/inventory/entities/room.entity';
import { RoomAvailability } from './modules/inventory/entities/room-availability.entity';
import { RatePeriod } from './modules/inventory/entities/rate-period.entity';
import { RatePlan } from './modules/inventory/entities/rate-plan.entity';
import { Booking } from './modules/bookings/entities/booking.entity';
import { Guest } from './modules/bookings/entities/guest.entity';
import { Payment } from './modules/payments/entities/payment.entity';
import { PaymentSettings } from './modules/payments/entities/payment-settings.entity';
import { Refund } from './modules/payments/entities/refund.entity';
import { Invoice } from './modules/payments/entities/invoice.entity';
import { Notification } from './modules/notifications/entities/notification.entity';
import { NotificationSettings } from './modules/notifications/entities/notification-settings.entity';
import { EmailTemplate } from './modules/notifications/entities/email-template.entity';
import { AuditLog } from './modules/audit/entities/audit-log.entity';
import { Channel } from './modules/channels/entities/channel.entity';
import { ChannelMapping } from './modules/channels/entities/channel-mapping.entity';
import { SyncLog } from './modules/channels/entities/sync-log.entity';
import { PricingRule } from './modules/pricing/entities/pricing-rule.entity';
import { HousekeepingTask } from './modules/housekeeping/entities/housekeeping-task.entity';
import { GuestConsent } from './modules/guests/entities/guest-consent.entity';
import { DataRetentionSettings } from './modules/guests/entities/data-retention-settings.entity';
import { GuestsModule } from './modules/guests/guests.module';
import { SmartAlert } from './modules/alerts/entities/smart-alert.entity';
import { AlertSettings } from './modules/alerts/entities/alert-settings.entity';
import { AlertsModule } from './modules/alerts/alerts.module';
import { FolioItem } from './modules/frontdesk/entities/folio-item.entity';
import { FrontdeskModule } from './modules/frontdesk/frontdesk.module';
import { PromoCode } from './modules/promos/entities/promo-code.entity';
import { PromosModule } from './modules/promos/promos.module';
import { Review } from './modules/reviews/entities/review.entity';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { Package } from './modules/packages/entities/package.entity';
import { BookingPackage } from './modules/packages/entities/booking-package.entity';
import { PackagesModule } from './modules/packages/packages.module';
import { TourismLevySettings } from './modules/tourism-levy/entities/tourism-levy-settings.entity';
import { TourismLevyRecord } from './modules/tourism-levy/entities/tourism-levy-record.entity';
import { TourismLevyModule } from './modules/tourism-levy/tourism-levy.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { AbandonedBooking } from './modules/bookings/entities/abandoned-booking.entity';
import { AccountingConnection } from './modules/accounting/entities/accounting-connection.entity';
import { AccountingMapping } from './modules/accounting/entities/accounting-mapping.entity';
import { AccountingSyncLog } from './modules/accounting/entities/accounting-sync-log.entity';
import { CacheModule } from './common/cache/cache.module';
import { PropertyGuardModule } from './common/guards/property-guard.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { throttlerConfig } from './common/throttler/throttler.config';
import { AddGiSTDoubleBookingConstraint1716950000000 } from './migrations/1716950000000-AddGiSTDoubleBookingConstraint';
import { InitialSchema1716900000000 } from './migrations/1716900000000-InitialSchema';
import { AddBookingGroupColumns1717000000000 } from './migrations/1717000000000-AddBookingGroupColumns';
import { AddRemainingTables1717100000000 } from './migrations/1717100000000-AddRemainingTables';
import { AddAccountingTables1717200000000 } from './migrations/1717200000000-AddAccountingTables';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(throttlerConfig),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: { index: false },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [
          User,
          Property,
          PropertyUser,
          RoomType,
          RoomAmenity,
          Room,
          RoomAvailability,
          RatePeriod,
          RatePlan,
          Booking,
          Guest,
          Payment,
          PaymentSettings,
          Refund,
          Invoice,
          Notification,
          NotificationSettings,
          EmailTemplate,
          AuditLog,
          Channel,
          ChannelMapping,
          SyncLog,
          PricingRule,
          HousekeepingTask,
          GuestConsent,
          DataRetentionSettings,
          SmartAlert,
          AlertSettings,
          FolioItem,
          PromoCode,
          Review,
          Package,
          BookingPackage,
          TourismLevySettings,
          TourismLevyRecord,
          AccountingConnection,
          AccountingMapping,
          AccountingSyncLog,
          AbandonedBooking,
        ],
        synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
        migrationsRun: true,
        migrations: [
          InitialSchema1716900000000,
          AddGiSTDoubleBookingConstraint1716950000000,
          AddBookingGroupColumns1717000000000,
          AddRemainingTables1717100000000,
          AddAccountingTables1717200000000,
        ],
        extra: {
          max: parseInt(configService.get<string>('DB_POOL_MAX') || '20', 10),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
      inject: [ConfigService],
    }),
    CacheModule,
    PropertyGuardModule,
    AuthModule,
    PropertiesModule,
    InventoryModule,
    BookingsModule,
    PaymentsModule,
    NotificationsModule,
    AuditModule,
    ChannelsModule,
    PricingModule,
    HousekeepingModule,
    GuestsModule,
    AlertsModule,
    FrontdeskModule,
    PromosModule,
    ReviewsModule,
    PackagesModule,
    TourismLevyModule,
    AccountingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
