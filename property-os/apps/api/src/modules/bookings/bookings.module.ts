import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsCleanupService } from './bookings-cleanup.service';
import { BookingsController } from './bookings.controller';
import { GuestsService } from './guests.service';
import { GuestsController } from './guests.controller';
import { Booking } from './entities/booking.entity';
import { Guest } from './entities/guest.entity';
import { AbandonedBooking } from './entities/abandoned-booking.entity';
import { AbandonedBookingService } from './abandoned-booking.service';
import { PropertiesModule } from '../properties/properties.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule } from '../pricing/pricing.module';
import { PromosModule } from '../promos/promos.module';
import { TourismLevyModule } from '../tourism-levy/tourism-levy.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Guest, AbandonedBooking]),
    PropertiesModule,
    InventoryModule,
    PricingModule,
    PromosModule,
    TourismLevyModule,
    forwardRef(() => PaymentsModule),
  ],
  providers: [BookingsService, BookingsCleanupService, GuestsService, AbandonedBookingService],
  controllers: [BookingsController, GuestsController],
  exports: [BookingsService, GuestsService, TypeOrmModule],
})
export class BookingsModule {}
