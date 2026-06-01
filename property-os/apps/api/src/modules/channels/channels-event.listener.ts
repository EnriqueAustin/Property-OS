import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Channel, ChannelStatus } from './entities/channel.entity';
import { SyncLog, SyncDirection, SyncStatus } from './entities/sync-log.entity';
import { ChannelProviderRegistry } from './providers/channel-provider.registry';
import { ChannelAvailabilityUpdate } from './providers/channel-provider.interface';
import { Room } from '../inventory/entities/room.entity';

@Injectable()
export class ChannelsEventListener {
  private readonly logger = new Logger(ChannelsEventListener.name);

  constructor(
    @InjectRepository(Channel)
    private channelsRepo: Repository<Channel>,
    @InjectRepository(SyncLog)
    private syncLogsRepo: Repository<SyncLog>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Room)
    private roomsRepo: Repository<Room>,
    private providerRegistry: ChannelProviderRegistry,
  ) {}

  @OnEvent('booking.created')
  async onBookingCreated(payload: { booking: Booking; propertyId: string }) {
    if (payload.booking.source !== 'direct' && payload.booking.source !== 'walk_in' && payload.booking.source !== 'phone') {
      return;
    }
    await this.pushAvailabilityForBooking(payload.booking, payload.propertyId);
  }

  @OnEvent('booking.cancelled')
  async onBookingCancelled(payload: { bookingId: string; propertyId: string }) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: payload.bookingId },
    });
    if (booking) {
      await this.pushAvailabilityForBooking(booking, payload.propertyId);
    }
  }

  private async pushAvailabilityForBooking(booking: Booking, propertyId: string) {
    const channels = await this.channelsRepo.find({
      where: { property_id: propertyId, status: ChannelStatus.ACTIVE },
      relations: ['mappings'],
    });

    if (channels.length === 0) return;

    const room = await this.roomsRepo.findOne({
      where: { id: booking.room_id },
    });
    if (!room) return;

    for (const channel of channels) {
      const mapping = channel.mappings?.find(
        (m) => m.room_type_id === room.room_type_id && m.is_active && m.sync_availability,
      );
      if (!mapping) continue;

      const provider = this.providerRegistry.get(channel.type);
      if (!provider) continue;

      const start = Date.now();
      const log = this.syncLogsRepo.create({
        channel_id: channel.id,
        direction: SyncDirection.EXPORT,
        status: SyncStatus.SUCCESS,
      });

      try {
        const dates = this.getDateRange(booking.check_in, booking.check_out);
        const update: ChannelAvailabilityUpdate = {
          roomTypeId: room.room_type_id,
          externalRoomId: mapping.external_room_id || mapping.external_listing_id || '',
          dates: dates.map((d) => ({
            date: d,
            available: booking.status === 'cancelled',
          })),
        };

        const result = await provider.pushAvailability(
          channel.credentials,
          [update],
        );
        log.availability_updates = result.updatedCount;
        log.details = { trigger: 'booking_event', bookingId: booking.id };
      } catch (err: any) {
        log.status = SyncStatus.FAILED;
        log.error_message = err.message;
        this.logger.error(
          `Availability push failed for channel ${channel.id}: ${err.message}`,
        );
      }

      log.duration_ms = Date.now() - start;
      await this.syncLogsRepo.save(log);
    }
  }

  private getDateRange(checkIn: string, checkOut: string): string[] {
    const dates: string[] = [];
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]!);
    }
    return dates;
  }
}
