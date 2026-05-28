import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Channel, ChannelStatus, ChannelType } from './entities/channel.entity';
import { ChannelMapping } from './entities/channel-mapping.entity';
import { SyncLog, SyncDirection, SyncStatus } from './entities/sync-log.entity';
import { ICalService, ICalEvent } from './ical.service';
import { Booking, BookingSource, BookingStatus } from '../bookings/entities/booking.entity';
import { Room } from '../inventory/entities/room.entity';
import { RoomType } from '../inventory/entities/room-type.entity';
import { RoomAvailability, AvailabilityStatus } from '../inventory/entities/room-availability.entity';
import { Guest } from '../bookings/entities/guest.entity';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import {
  CreateChannelMappingDto,
  UpdateChannelMappingDto,
} from './dto/channel-mapping.dto';

const CHANNEL_TO_SOURCE: Record<ChannelType, BookingSource> = {
  [ChannelType.BOOKING_COM]: BookingSource.BOOKING_COM,
  [ChannelType.AIRBNB]: BookingSource.AIRBNB,
  [ChannelType.EXPEDIA]: BookingSource.EXPEDIA,
  [ChannelType.ICAL]: BookingSource.MANUAL,
};

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    @InjectRepository(Channel)
    private channelsRepo: Repository<Channel>,
    @InjectRepository(ChannelMapping)
    private mappingsRepo: Repository<ChannelMapping>,
    @InjectRepository(SyncLog)
    private syncLogsRepo: Repository<SyncLog>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Room)
    private roomsRepo: Repository<Room>,
    @InjectRepository(RoomType)
    private roomTypesRepo: Repository<RoomType>,
    @InjectRepository(RoomAvailability)
    private availabilityRepo: Repository<RoomAvailability>,
    @InjectRepository(Guest)
    private guestsRepo: Repository<Guest>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
    private icalService: ICalService,
  ) {}

  // --- Channel CRUD ---------------------------------------------------------

  async createChannel(dto: CreateChannelDto): Promise<Channel> {
    const existing = await this.channelsRepo.findOne({
      where: {
        property_id: dto.propertyId,
        type: dto.type,
        name: dto.name,
      },
    });
    if (existing) throw new ConflictException('Channel with this name already exists');

    const channel = this.channelsRepo.create({
      property_id: dto.propertyId,
      type: dto.type,
      name: dto.name,
      ical_import_url: dto.icalImportUrl,
      commission_percent: dto.commissionPercent ?? 0,
      rate_markup_percent: dto.rateMarkupPercent ?? 0,
      sync_interval_minutes: dto.syncIntervalMinutes ?? 15,
      ical_export_token: randomBytes(32).toString('hex'),
    });

    return this.channelsRepo.save(channel);
  }

  async listChannels(propertyId: string): Promise<Channel[]> {
    return this.channelsRepo.find({
      where: { property_id: propertyId },
      relations: ['mappings', 'mappings.room_type'],
      order: { created_at: 'ASC' },
    });
  }

  async getChannel(channelId: string): Promise<Channel> {
    const ch = await this.channelsRepo.findOne({
      where: { id: channelId },
      relations: ['mappings', 'mappings.room_type'],
    });
    if (!ch) throw new NotFoundException('Channel not found');
    return ch;
  }

  async updateChannel(channelId: string, dto: UpdateChannelDto): Promise<Channel> {
    const ch = await this.getChannel(channelId);
    if (dto.name !== undefined) ch.name = dto.name;
    if (dto.status !== undefined) ch.status = dto.status;
    if (dto.icalImportUrl !== undefined) ch.ical_import_url = dto.icalImportUrl;
    if (dto.commissionPercent !== undefined) ch.commission_percent = dto.commissionPercent;
    if (dto.rateMarkupPercent !== undefined) ch.rate_markup_percent = dto.rateMarkupPercent;
    if (dto.syncIntervalMinutes !== undefined) ch.sync_interval_minutes = dto.syncIntervalMinutes;
    return this.channelsRepo.save(ch);
  }

  async deleteChannel(channelId: string): Promise<void> {
    const ch = await this.getChannel(channelId);
    await this.channelsRepo.remove(ch);
  }

  // --- Channel Mappings -----------------------------------------------------

  async addMapping(
    channelId: string,
    dto: CreateChannelMappingDto,
  ): Promise<ChannelMapping> {
    await this.getChannel(channelId);

    const existing = await this.mappingsRepo.findOne({
      where: { channel_id: channelId, room_type_id: dto.roomTypeId },
    });
    if (existing) throw new ConflictException('Room type already mapped to this channel');

    const mapping = this.mappingsRepo.create({
      channel_id: channelId,
      room_type_id: dto.roomTypeId,
      external_listing_id: dto.externalListingId,
      external_room_id: dto.externalRoomId,
      rate_override: dto.rateOverride,
      sync_availability: dto.syncAvailability ?? true,
      sync_rates: dto.syncRates ?? true,
    });

    return this.mappingsRepo.save(mapping);
  }

  async updateMapping(
    mappingId: string,
    dto: UpdateChannelMappingDto,
  ): Promise<ChannelMapping> {
    const mapping = await this.mappingsRepo.findOne({
      where: { id: mappingId },
    });
    if (!mapping) throw new NotFoundException('Mapping not found');

    Object.assign(mapping, {
      ...(dto.externalListingId !== undefined && { external_listing_id: dto.externalListingId }),
      ...(dto.externalRoomId !== undefined && { external_room_id: dto.externalRoomId }),
      ...(dto.rateOverride !== undefined && { rate_override: dto.rateOverride }),
      ...(dto.syncAvailability !== undefined && { sync_availability: dto.syncAvailability }),
      ...(dto.syncRates !== undefined && { sync_rates: dto.syncRates }),
      ...(dto.isActive !== undefined && { is_active: dto.isActive }),
    });

    return this.mappingsRepo.save(mapping);
  }

  async removeMapping(mappingId: string): Promise<void> {
    const mapping = await this.mappingsRepo.findOne({
      where: { id: mappingId },
    });
    if (!mapping) throw new NotFoundException('Mapping not found');
    await this.mappingsRepo.remove(mapping);
  }

  // --- iCal Export (outbound feed) ------------------------------------------

  async generateICalExport(
    channelId: string,
    roomTypeId: string,
  ): Promise<string> {
    const channel = await this.channelsRepo.findOne({
      where: { id: channelId },
      relations: ['property'],
    });
    if (!channel) throw new NotFoundException('Channel not found');

    const roomType = await this.roomTypesRepo.findOne({
      where: { id: roomTypeId },
    });
    if (!roomType) throw new NotFoundException('Room type not found');

    const bookings = await this.bookingsRepo
      .createQueryBuilder('b')
      .innerJoin('b.room', 'r')
      .where('r.room_type_id = :roomTypeId', { roomTypeId })
      .andWhere('b.property_id = :propertyId', { propertyId: channel.property_id })
      .andWhere('b.status IN (:...statuses)', {
        statuses: [
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
          BookingStatus.PENDING,
        ],
      })
      .andWhere('b.check_out >= CURRENT_DATE')
      .getMany();

    const blocked = await this.availabilityRepo
      .createQueryBuilder('a')
      .innerJoin('a.room', 'r')
      .where('r.room_type_id = :roomTypeId', { roomTypeId })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [AvailabilityStatus.BLOCKED, AvailabilityStatus.MAINTENANCE],
      })
      .andWhere('a.date >= CURRENT_DATE')
      .getMany();

    const events = [
      ...bookings.map((b) => ({
        uid: `booking-${b.id}@propertyos`,
        summary: `Reserved - ${b.reference_number}`,
        checkIn: b.check_in,
        checkOut: b.check_out,
      })),
      ...this.groupBlockedDates(blocked),
    ];

    return this.icalService.generateICalFeed(
      channel.property?.name || 'Property',
      roomType.name,
      events,
    );
  }

  async getICalExportByToken(
    token: string,
    roomTypeId: string,
  ): Promise<string> {
    const channel = await this.channelsRepo.findOne({
      where: { ical_export_token: token },
    });
    if (!channel) throw new NotFoundException('Invalid export token');
    return this.generateICalExport(channel.id, roomTypeId);
  }

  private groupBlockedDates(
    rows: RoomAvailability[],
  ): { uid: string; summary: string; checkIn: string; checkOut: string }[] {
    if (rows.length === 0) return [];

    const sorted = rows.sort(
      (a, b) =>
        `${a.room_id}-${a.date}`.localeCompare(`${b.room_id}-${b.date}`),
    );

    const groups: { uid: string; summary: string; checkIn: string; checkOut: string }[] = [];
    let current = sorted[0]!;
    let startDate = current.date;
    let endDate = current.date;
    let roomId = current.room_id;

    for (let i = 1; i < sorted.length; i++) {
      const row = sorted[i]!;
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDateStr = nextDay.toISOString().split('T')[0]!;

      if (row.room_id === roomId && row.date === nextDateStr) {
        endDate = row.date;
      } else {
        const endPlusOne = new Date(endDate);
        endPlusOne.setDate(endPlusOne.getDate() + 1);
        groups.push({
          uid: `blocked-${roomId}-${startDate}@propertyos`,
          summary: 'Not Available',
          checkIn: startDate,
          checkOut: endPlusOne.toISOString().split('T')[0]!,
        });
        startDate = row.date;
        endDate = row.date;
        roomId = row.room_id;
      }
    }

    const endPlusOne = new Date(endDate);
    endPlusOne.setDate(endPlusOne.getDate() + 1);
    groups.push({
      uid: `blocked-${roomId}-${startDate}@propertyos`,
      summary: 'Not Available',
      checkIn: startDate,
      checkOut: endPlusOne.toISOString().split('T')[0]!,
    });

    return groups;
  }

  // --- iCal Import (inbound sync) -------------------------------------------

  async syncICalImport(channelId: string): Promise<SyncLog> {
    const start = Date.now();
    const channel = await this.channelsRepo.findOne({
      where: { id: channelId },
      relations: ['mappings'],
    });
    if (!channel) throw new NotFoundException('Channel not found');
    if (!channel.ical_import_url) {
      throw new BadRequestException('No iCal import URL configured');
    }

    const log = this.syncLogsRepo.create({
      channel_id: channelId,
      direction: SyncDirection.IMPORT,
      status: SyncStatus.SUCCESS,
    });

    try {
      const response = await fetch(channel.ical_import_url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const icalText = await response.text();
      const events = this.icalService.parseICalFeed(icalText);

      let imported = 0;
      let conflicts = 0;
      let conflictsResolved = 0;

      for (const event of events) {
        const result = await this.processImportedEvent(channel, event);
        if (result === 'imported') imported++;
        if (result === 'conflict') conflicts++;
        if (result === 'resolved') {
          conflicts++;
          conflictsResolved++;
        }
      }

      log.bookings_imported = imported;
      log.conflicts_found = conflicts;
      log.conflicts_resolved = conflictsResolved;

      channel.last_sync_at = new Date();
      channel.last_sync_error = null as any;
      if (channel.status === ChannelStatus.ERROR) {
        channel.status = ChannelStatus.ACTIVE;
      }
    } catch (err: any) {
      log.status = SyncStatus.FAILED;
      log.error_message = err.message;
      channel.last_sync_error = err.message;
      channel.status = ChannelStatus.ERROR;
      this.logger.error(`iCal sync failed for channel ${channelId}: ${err.message}`);
    }

    log.duration_ms = Date.now() - start;
    await this.channelsRepo.save(channel);
    return this.syncLogsRepo.save(log);
  }

  private async processImportedEvent(
    channel: Channel,
    event: ICalEvent,
  ): Promise<'imported' | 'skipped' | 'conflict' | 'resolved'> {
    const existingBooking = await this.bookingsRepo.findOne({
      where: { source_ref: event.uid },
    });
    if (existingBooking) return 'skipped';

    if (!channel.mappings || channel.mappings.length === 0) return 'skipped';

    const mapping = channel.mappings[0]!;
    const rooms = await this.roomsRepo.find({
      where: { room_type_id: mapping.room_type_id, is_active: true },
    });
    if (rooms.length === 0) return 'skipped';

    const checkIn = event.dtstart;
    const checkOut = event.dtend;
    const source = CHANNEL_TO_SOURCE[channel.type];

    const availableRoom = await this.findAvailableRoom(rooms, checkIn, checkOut);
    if (!availableRoom) return 'conflict';

    return this.dataSource.transaction<'imported' | 'skipped' | 'conflict' | 'resolved'>('SERIALIZABLE', async (manager) => {
      const guest = await this.findOrCreateChannelGuest(
        manager,
        channel,
        event.summary,
      );

      const nights = this.calculateNights(checkIn, checkOut);
      const roomType = await manager.findOne(RoomType, {
        where: { id: mapping.room_type_id },
      });
      const rate = Number(roomType?.base_price || 0);
      const year = new Date().getFullYear();
      const count = await manager.count(Booking, {
        where: { property_id: channel.property_id },
      });
      const refNum = `POS-${year}-${String(count + 1).padStart(4, '0')}`;

      const booking = manager.create(Booking, {
        property_id: channel.property_id,
        room_id: availableRoom.id,
        guest_id: guest.id,
        reference_number: refNum,
        check_in: checkIn,
        check_out: checkOut,
        nights,
        nightly_rate: rate,
        total_price: rate * nights,
        currency: 'ZAR',
        status: BookingStatus.CONFIRMED,
        source,
        source_ref: event.uid,
        guest_count: 1,
        special_requests: event.description || undefined,
      });
      await manager.save(Booking, booking);

      const dates = this.getDateRange(checkIn, checkOut);
      for (const date of dates) {
        await manager.upsert(
          RoomAvailability,
          {
            room_id: availableRoom.id,
            date,
            status: AvailabilityStatus.BOOKED,
            booking_id: booking.id,
          },
          { conflictPaths: { room_id: true, date: true } },
        );
      }

      this.eventEmitter.emit('booking.created', {
        booking,
        propertyId: channel.property_id,
      });

      return 'imported';
    });
  }

  private async findAvailableRoom(
    rooms: Room[],
    checkIn: string,
    checkOut: string,
  ): Promise<Room | null> {
    const dates = this.getDateRange(checkIn, checkOut);

    for (const room of rooms) {
      const conflicts = await this.availabilityRepo
        .createQueryBuilder('a')
        .where('a.room_id = :roomId', { roomId: room.id })
        .andWhere('a.date IN (:...dates)', { dates })
        .andWhere('a.status != :available', {
          available: AvailabilityStatus.AVAILABLE,
        })
        .getCount();

      if (conflicts === 0) return room;
    }

    return null;
  }

  private async findOrCreateChannelGuest(
    manager: any,
    channel: Channel,
    summary: string,
  ): Promise<Guest> {
    const channelName = channel.name;
    const email = `${channel.type}-import@propertyos.local`;

    let guest = await manager.findOne(Guest, {
      where: { email, property_id: channel.property_id },
    });

    if (!guest) {
      guest = manager.create(Guest, {
        property_id: channel.property_id,
        first_name: channelName,
        last_name: 'Guest',
        email,
      });
      guest = await manager.save(Guest, guest);
    }

    return guest;
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
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

  // --- Sync Logs ------------------------------------------------------------

  async getSyncLogs(
    channelId: string,
    limit = 20,
  ): Promise<SyncLog[]> {
    return this.syncLogsRepo.find({
      where: { channel_id: channelId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  // --- Revenue by source report ---------------------------------------------

  async getRevenueByChannel(
    propertyId: string,
    from: string,
    to: string,
  ): Promise<any[]> {
    return this.bookingsRepo
      .createQueryBuilder('b')
      .select('b.source', 'source')
      .addSelect('COUNT(b.id)', 'bookings')
      .addSelect('SUM(b.total_price)', 'revenue')
      .addSelect('AVG(b.nightly_rate)', 'avgRate')
      .where('b.property_id = :propertyId', { propertyId })
      .andWhere('b.check_in >= :from', { from })
      .andWhere('b.check_in <= :to', { to })
      .andWhere('b.status NOT IN (:...excluded)', {
        excluded: [BookingStatus.CANCELLED],
      })
      .groupBy('b.source')
      .orderBy('revenue', 'DESC')
      .getRawMany();
  }

  // --- Rate parity -----------------------------------------------------------

  async getRateParity(propertyId: string) {
    const channels = await this.channelsRepo.find({
      where: { property_id: propertyId },
      relations: ['mappings', 'mappings.room_type'],
    });

    const roomTypes = await this.roomTypesRepo.find({
      where: { property_id: propertyId },
    });

    const parity: Array<{
      roomType: { id: string; name: string; basePrice: number };
      channels: Array<{
        channelId: string;
        channelName: string;
        channelType: string;
        effectiveRate: number;
        rateMarkupPercent: number;
        rateOverride: number | null;
        deviationPercent: number;
        status: 'match' | 'higher' | 'lower';
      }>;
    }> = [];

    for (const rt of roomTypes) {
      const basePrice = Number(rt.base_price);
      const channelRates: typeof parity[number]['channels'] = [];

      for (const channel of channels) {
        const mapping = channel.mappings?.find(
          (m) => m.room_type_id === rt.id && m.is_active,
        );
        if (!mapping) continue;

        const rateOverride = mapping.rate_override
          ? Number(mapping.rate_override)
          : null;
        const markupPercent = Number(channel.rate_markup_percent || 0);
        const effectiveRate = rateOverride ?? Math.round(basePrice * (1 + markupPercent / 100) * 100) / 100;
        const deviationPercent = basePrice > 0
          ? Math.round(((effectiveRate - basePrice) / basePrice) * 10000) / 100
          : 0;

        let status: 'match' | 'higher' | 'lower' = 'match';
        if (deviationPercent > 1) status = 'higher';
        else if (deviationPercent < -1) status = 'lower';

        channelRates.push({
          channelId: channel.id,
          channelName: channel.name,
          channelType: channel.type,
          effectiveRate,
          rateMarkupPercent: markupPercent,
          rateOverride,
          deviationPercent,
          status,
        });
      }

      parity.push({
        roomType: { id: rt.id, name: rt.name, basePrice },
        channels: channelRates,
      });
    }

    return parity;
  }

  // --- Bulk availability push -----------------------------------------------

  async pushAvailabilityToChannels(propertyId: string): Promise<void> {
    const channels = await this.channelsRepo.find({
      where: { property_id: propertyId, status: ChannelStatus.ACTIVE },
    });

    for (const channel of channels) {
      if (channel.ical_import_url) {
        this.logger.log(
          `Would push availability to ${channel.name} (${channel.type}) — API integration pending`,
        );
      }
    }
  }
}
