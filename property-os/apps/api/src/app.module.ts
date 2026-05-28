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
import { User } from './modules/users/entities/user.entity';
import { Property } from './modules/properties/entities/property.entity';
import { PropertyUser } from './modules/properties/entities/property-user.entity';
import { RoomType } from './modules/inventory/entities/room-type.entity';
import { RoomAmenity } from './modules/inventory/entities/room-amenity.entity';
import { Room } from './modules/inventory/entities/room.entity';
import { RoomAvailability } from './modules/inventory/entities/room-availability.entity';
import { RatePeriod } from './modules/inventory/entities/rate-period.entity';
import { Booking } from './modules/bookings/entities/booking.entity';
import { Guest } from './modules/bookings/entities/guest.entity';
import { Payment } from './modules/payments/entities/payment.entity';
import { PaymentSettings } from './modules/payments/entities/payment-settings.entity';
import { Notification } from './modules/notifications/entities/notification.entity';
import { NotificationSettings } from './modules/notifications/entities/notification-settings.entity';
import { AuditLog } from './modules/audit/entities/audit-log.entity';
import { Channel } from './modules/channels/entities/channel.entity';
import { ChannelMapping } from './modules/channels/entities/channel-mapping.entity';
import { SyncLog } from './modules/channels/entities/sync-log.entity';
import { CacheModule } from './common/cache/cache.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { throttlerConfig } from './common/throttler/throttler.config';
import { AddGiSTDoubleBookingConstraint1716825600000 } from './migrations/1716825600000-AddGiSTDoubleBookingConstraint';

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
          Booking,
          Guest,
          Payment,
          PaymentSettings,
          Notification,
          NotificationSettings,
          AuditLog,
          Channel,
          ChannelMapping,
          SyncLog,
        ],
        synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
        migrationsRun: true,
        migrations: [AddGiSTDoubleBookingConstraint1716825600000],
      }),
      inject: [ConfigService],
    }),
    CacheModule,
    AuthModule,
    PropertiesModule,
    InventoryModule,
    BookingsModule,
    PaymentsModule,
    NotificationsModule,
    AuditModule,
    ChannelsModule,
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
