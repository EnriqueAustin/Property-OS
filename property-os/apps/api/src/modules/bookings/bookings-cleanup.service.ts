import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
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

    // Collect group IDs so we cancel all siblings in a multi-room group
    const groupIds = new Set<string>();
    for (const booking of expired) {
      if (booking.group_id) groupIds.add(booking.group_id);
    }

    // Fetch any pending group siblings not already in the expired list
    let groupSiblings: Booking[] = [];
    if (groupIds.size > 0) {
      groupSiblings = await this.bookingsRepo.find({
        where: {
          group_id: In([...groupIds]),
          status: BookingStatus.PENDING,
        },
      });
    }

    // Merge into a deduplicated set
    const allToCancel = new Map<string, Booking>();
    for (const b of [...expired, ...groupSiblings]) {
      allToCancel.set(b.id, b);
    }

    this.logger.log(`Auto-cancelling ${allToCancel.size} expired pending booking(s)`);

    for (const booking of allToCancel.values()) {
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
