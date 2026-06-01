import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestConsent } from './entities/guest-consent.entity';
import { DataRetentionSettings } from './entities/data-retention-settings.entity';
import { Guest } from '../bookings/entities/guest.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PopiaService } from './popia.service';
import { PopiaController } from './popia.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GuestConsent,
      DataRetentionSettings,
      Guest,
      Booking,
    ]),
  ],
  controllers: [PopiaController],
  providers: [PopiaService],
  exports: [PopiaService],
})
export class GuestsModule {}
