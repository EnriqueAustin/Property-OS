import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Booking, BookingStatus, BookingSource } from './entities/booking.entity';
import { RoomAvailability } from '../inventory/entities/room-availability.entity';

@Injectable()
export class BookingsCleanupService {
  private readonly logger = new Logger(BookingsCleanupService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(RoomAvailability)
    private availabilityRepo: Repository<RoomAvailability>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cancelExpiredPendingBookings() {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);

    const expired = await this.bookingsRepo.find({
      where: {
        status: BookingStatus.PENDING,
        source: BookingSource.DIRECT,
        booked_at: LessThan(cutoff),
      },
    });

    if (!expired.length) return;

    this.logger.log(`Auto-cancelling ${expired.length} expired pending booking(s)`);

    for (const booking of expired) {
      booking.status = BookingStatus.CANCELLED;
      booking.cancelled_at = new Date();
      booking.cancellation_reason = 'Auto-cancelled: no payment received within 30 minutes';
      await this.bookingsRepo.save(booking);

      await this.availabilityRepo
        .createQueryBuilder()
        .update()
        .set({ status: 'available' as any, booking_id: null as any })
        .where('booking_id = :id', { id: booking.id })
        .execute();
    }
  }
}
