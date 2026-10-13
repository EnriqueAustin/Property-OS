import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestConsent } from './entities/guest-consent.entity';
import { DataRetentionSettings } from './entities/data-retention-settings.entity';
import { ErasureRequest } from './entities/erasure-request.entity';
import { Guest } from '../bookings/entities/guest.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PopiaService } from './popia.service';
import { PopiaController } from './popia.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GuestConsent,
      DataRetentionSettings,
      ErasureRequest,
      Guest,
      Booking,
    ]),
    NotificationsModule,
  ],
  controllers: [PopiaController],
  providers: [PopiaService],
  exports: [PopiaService],
})
export class GuestsModule {}
