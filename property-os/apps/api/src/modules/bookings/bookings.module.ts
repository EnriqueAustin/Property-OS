import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsCleanupService } from './bookings-cleanup.service';
import { BookingsController } from './bookings.controller';
import { GuestsService } from './guests.service';
import { GuestsController } from './guests.controller';
import { Booking } from './entities/booking.entity';
import { Guest } from './entities/guest.entity';
import { PropertiesModule } from '../properties/properties.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Guest]),
    PropertiesModule,
    InventoryModule,
  ],
  providers: [BookingsService, BookingsCleanupService, GuestsService],
  controllers: [BookingsController, GuestsController],
  exports: [BookingsService, GuestsService, TypeOrmModule],
})
export class BookingsModule {}
