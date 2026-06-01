import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Booking, BookingSource, BookingStatus } from './entities/booking.entity';
import { Guest } from './entities/guest.entity';
import { RoomAvailability, AvailabilityStatus } from '../inventory/entities/room-availability.entity';
import { Room } from '../inventory/entities/room.entity';
import { RoomType } from '../inventory/entities/room-type.entity';
import { Property } from '../properties/entities/property.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PublicBookingDto, OnlineCheckInDto } from './dto/public-booking.dto';
import {
  CancelBookingDto,
  UpdateBookingDto,
  UpdateStatusDto,
} from './dto/update-booking.dto';
import {
  BOOKING_EVENTS,
  BookingCreatedEvent,
  BookingCancelledEvent,
  BookingModifiedEvent,
} from './events/booking.events';
import { PricingService } from '../pricing/pricing.service';
import { InventoryService } from '../inventory/inventory.service';
import { PromosService } from '../promos/promos.service';
import { TourismLevyService } from '../tourism-levy/tourism-levy.service';
import { PaymentsService } from '../payments/payments.service';

const VALID_TRANSITIONS: Record<string, string[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.CHECKED_IN,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
  ],
  [BookingStatus.CHECKED_IN]: [BookingStatus.CHECKED_OUT],
};

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Guest)
    private guestsRepo: Repository<Guest>,
    @InjectRepository(RoomAvailability)
    private availabilityRepo: Repository<RoomAvailability>,
    @InjectRepository(Room)
    private roomsRepo: Repository<Room>,
    @InjectRepository(RoomType)
    private roomTypesRepo: Repository<RoomType>,
    @InjectRepository(Property)
    private propertiesRepo: Repository<Property>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
    private pricingService: PricingService,
    private inventoryService: InventoryService,
    private promosService: PromosService,
    private tourismLevyService: TourismLevyService,
    @Inject(forwardRef(() => PaymentsService))
    private paymentsService: PaymentsService,
  ) {}

  // -- Resolve roomIds from DTO (backward compatible) -------------------------

  private resolveRoomIds(dto: CreateBookingDto): string[] {
    if (dto.roomIds?.length) return dto.roomIds;
    if (dto.roomId) return [dto.roomId];
    throw new BadRequestException('Either roomId or roomIds must be provided');
  }

  // -- Admin booking creation (supports multi-room) ---------------------------

  async createBooking(dto: CreateBookingDto): Promise<Booking | Booking[]> {
    const roomIds = this.resolveRoomIds(dto);
    const nights = this.calcNights(dto.checkIn, dto.checkOut);
    if (nights < 1) throw new BadRequestException('checkOut must be after checkIn');

    const isMultiRoom = roomIds.length > 1;
    const groupId = isMultiRoom ? randomUUID() : null;

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      // Find or create guest once for the whole group
      const guest = await this.findOrCreateGuest(
        manager,
        dto.propertyId,
        dto.guest,
      );

      const bookings: Booking[] = [];

      for (let idx = 0; idx < roomIds.length; idx++) {
        const roomId = roomIds[idx];

        // Lock availability rows for this room
        const rows: RoomAvailability[] = await manager.query(
          `SELECT * FROM room_availability
           WHERE room_id = $1
             AND date >= $2
             AND date < $3
           ORDER BY date
           FOR UPDATE`,
          [roomId, dto.checkIn, dto.checkOut],
        );

        // Verify all dates available
        const dates = this.dateRange(dto.checkIn, dto.checkOut);
        const unavailable: string[] = [];
        for (const d of dates) {
          const row = rows.find(
            (r) => this.normalizeDate(r.date) === d,
          );
          if (!row || row.status !== AvailabilityStatus.AVAILABLE) {
            unavailable.push(d);
          }
        }
        if (unavailable.length) {
          throw new ConflictException({
            code: 'BOOK_DOUBLE_BOOKING',
            message: `Room ${roomId} is not available for the requested dates`,
            roomId,
            unavailableDates: unavailable,
          });
        }

        // Calculate pricing
        const room = await manager.findOne(Room, {
          where: { id: roomId },
          relations: ['room_type'],
        });
        if (!room) throw new NotFoundException(`Room ${roomId} not found`);

        let totalPrice = 0;
        const guestCount = dto.guestCount ?? 1;
        const nightDates = this.dateRange(dto.checkIn, dto.checkOut);
        for (let i = 0; i < nightDates.length; i++) {
          let baseForNight = await this.inventoryService.getEffectivePrice(
            room.room_type_id,
            dto.propertyId,
            nightDates[i],
          );
          const { price: derivedPrice } = await this.inventoryService.getDerivedPrice(
            room.room_type_id,
            baseForNight,
            guestCount,
          );
          baseForNight = derivedPrice;
          const { price } = await this.pricingService.calculatePrice(
            dto.propertyId,
            room.room_type_id,
            baseForNight,
            dto.checkIn,
            i,
            nights,
            0,
          );
          totalPrice += price;
        }
        const nightlyRate = Math.round((totalPrice / nights) * 100) / 100;

        // Generate reference number
        const refNumber = await this.generateRefNumber(manager);

        // Create booking
        const booking = manager.create(Booking, {
          property_id: dto.propertyId,
          room_id: roomId,
          guest_id: guest.id,
          group_id: groupId,
          group_index: idx,
          reference_number: refNumber,
          check_in: dto.checkIn,
          check_out: dto.checkOut,
          nights,
          total_price: totalPrice,
          nightly_rate: nightlyRate,
          status: BookingStatus.CONFIRMED,
          source: (dto.source as BookingSource) ?? BookingSource.DIRECT,
          guest_count: dto.guestCount ?? 1,
          special_requests: dto.specialRequests,
          internal_notes: dto.internalNotes,
        });
        const saved = await manager.save(booking);

        // Mark availability as booked
        await manager.query(
          `UPDATE room_availability
           SET status = 'booked', booking_id = $1, updated_at = NOW()
           WHERE room_id = $2
             AND date >= $3
             AND date < $4`,
          [saved.id, roomId, dto.checkIn, dto.checkOut],
        );

        const result = await manager.findOne(Booking, {
          where: { id: saved.id },
          relations: ['guest', 'room', 'room.room_type'],
        }) as Booking;

        bookings.push(result);

        this.eventEmitter.emit(
          BOOKING_EVENTS.CREATED,
          new BookingCreatedEvent(result.id, result.property_id, result.reference_number, result.source),
        );
      }

      return isMultiRoom ? bookings : bookings[0];
    });
  }

  // -- Public booking (widget) — supports multi-room --------------------------

  async createPublicBooking(dto: PublicBookingDto): Promise<any> {
    const property = await this.propertiesRepo.findOne({
      where: { slug: dto.propertySlug, is_active: true, is_published: true },
    });
    if (!property) throw new NotFoundException('Property not found');

    // Normalize: support both single roomTypeId and rooms array
    const roomSelections = dto.rooms?.length
      ? dto.rooms
      : dto.roomTypeId
        ? [{ roomTypeId: dto.roomTypeId, guestCount: dto.guestCount }]
        : (() => { throw new BadRequestException('Either roomTypeId or rooms must be provided'); })();

    // Validate all room types and find best available rooms
    const resolvedRooms: { roomId: string; roomTypeId: string; guestCount?: number }[] = [];
    const usedRoomIds = new Set<string>();

    for (const sel of roomSelections) {
      const roomType = await this.roomTypesRepo.findOne({ where: { id: sel.roomTypeId } });
      if (!roomType) throw new NotFoundException(`Room type ${sel.roomTypeId} not found`);
      if (sel.guestCount && sel.guestCount > roomType.max_occupancy) {
        throw new BadRequestException(
          `Guest count (${sel.guestCount}) exceeds ${roomType.name} max occupancy (${roomType.max_occupancy})`,
        );
      }

      const room = await this.findBestAvailableRoom(
        property.id,
        sel.roomTypeId,
        dto.checkIn,
        dto.checkOut,
        usedRoomIds,
      );
      usedRoomIds.add(room.id);
      resolvedRooms.push({ roomId: room.id, roomTypeId: sel.roomTypeId, guestCount: sel.guestCount });
    }

    const isMultiRoom = resolvedRooms.length > 1;
    const needsDeposit = property.deposit_required && Number(property.deposit_percentage) > 0;

    // Create bookings (single call handles both single and multi)
    const bookingResult = await this.createBooking({
      propertyId: property.id,
      roomIds: resolvedRooms.map((r) => r.roomId),
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      guest: dto.guest,
      guestCount: dto.guestCount,
      specialRequests: dto.specialRequests,
      source: 'direct',
    });

    const bookings = Array.isArray(bookingResult) ? bookingResult : [bookingResult];

    // Apply promo code across all bookings
    let totalDiscountAmount = 0;
    if (dto.promoCode) {
      const grandTotal = bookings.reduce((sum, b) => sum + Number(b.total_price), 0);
      const nights = this.calcNights(dto.checkIn, dto.checkOut);
      const validation = await this.promosService.validate(
        property.id,
        dto.promoCode,
        nights,
        grandTotal,
      );
      if (validation.valid) {
        const result = await this.promosService.applyDiscount(
          property.id,
          dto.promoCode,
          grandTotal,
        );
        totalDiscountAmount = result.discountAmount;

        // Distribute discount proportionally across bookings
        for (let i = 0; i < bookings.length; i++) {
          const share = Number(bookings[i].total_price) / grandTotal;
          const roomDiscount = Math.round(totalDiscountAmount * share * 100) / 100;
          bookings[i].total_price = Number(bookings[i].total_price) - roomDiscount;
          bookings[i].promo_code = dto.promoCode.toUpperCase();
          bookings[i].discount_amount = roomDiscount;
          bookings[i].nightly_rate = Math.round(Number(bookings[i].total_price) / nights * 100) / 100;
          await this.bookingsRepo.save(bookings[i]);
        }
      }
    }

    if (needsDeposit) {
      for (const booking of bookings) {
        booking.status = BookingStatus.PENDING;
        await this.bookingsRepo.save(booking);
      }
    }

    // Calculate tourism levy
    let totalTourismLevy = 0;
    try {
      const levySettings = await this.tourismLevyService.getSettings(property.id);
      if (levySettings.enabled) {
        for (const booking of bookings) {
          const nights = this.calcNights(dto.checkIn, dto.checkOut);
          const { levyAmount, rate } = this.tourismLevyService.calculateLevy(
            levySettings,
            nights,
            booking.guest_count,
            Number(booking.total_price),
          );
          if (levyAmount > 0) {
            await this.tourismLevyService.createRecord({
              propertyId: property.id,
              bookingId: booking.id,
              guestId: booking.guest_id,
              levyName: levySettings.levy_name,
              levyType: levySettings.levy_type,
              nights,
              guestCount: booking.guest_count,
              rate,
              totalLevy: levyAmount,
              checkIn: dto.checkIn,
              checkOut: dto.checkOut,
            });
            totalTourismLevy += levyAmount;
          }
        }
      }
    } catch {}

    const grandTotal = bookings.reduce((sum, b) => sum + Number(b.total_price), 0);
    const depositAmount = needsDeposit
      ? Math.round(grandTotal * Number(property.deposit_percentage)) / 100
      : 0;

    if (isMultiRoom) {
      return {
        groupId: bookings[0].group_id,
        bookings,
        totalPrice: grandTotal,
        depositRequired: needsDeposit,
        depositAmount,
        discountAmount: totalDiscountAmount,
        tourismLevy: totalTourismLevy,
      };
    }

    return {
      ...bookings[0],
      depositRequired: needsDeposit,
      depositAmount,
      discountAmount: totalDiscountAmount,
      tourismLevy: totalTourismLevy,
    };
  }

  // -- Public availability check --------------------------------------------

  async checkPublicAvailability(
    slug: string,
    checkIn: string,
    checkOut: string,
    guests?: number,
  ) {
    const property = await this.propertiesRepo.findOne({
      where: { slug, is_active: true },
    });
    if (!property) throw new NotFoundException('Property not found');

    const nights = this.calcNights(checkIn, checkOut);
    if (nights < 1) throw new BadRequestException('Invalid date range');

    const roomTypes = await this.roomTypesRepo.find({
      where: { property_id: property.id, is_active: true },
      relations: ['amenities', 'rooms'],
    });

    const filteredTypes = guests
      ? roomTypes.filter((rt) => rt.max_occupancy >= guests)
      : roomTypes;

    const allRoomIds = filteredTypes.flatMap((rt) =>
      rt.rooms.filter((r) => r.is_active).map((r) => r.id),
    );

    let blockedRoomIds: Set<string> = new Set();
    if (allRoomIds.length > 0) {
      const blockedRows = await this.availabilityRepo
        .createQueryBuilder('a')
        .select('DISTINCT a.room_id', 'room_id')
        .where('a.room_id IN (:...roomIds)', { roomIds: allRoomIds })
        .andWhere('a.date >= :start AND a.date < :end', {
          start: checkIn,
          end: checkOut,
        })
        .andWhere('a.status != :avail', {
          avail: AvailabilityStatus.AVAILABLE,
        })
        .getRawMany();
      blockedRoomIds = new Set(blockedRows.map((r) => r.room_id));
    }

    const nightDates = this.dateRange(checkIn, checkOut);

    const result: Array<{
      roomTypeId: string;
      roomTypeName: string;
      description: string;
      amenities: string[];
      photos: string[];
      nightlyRate: number;
      totalPrice: number;
      availableCount: number;
      maxOccupancy: number;
    }> = [];

    for (const rt of filteredTypes) {
      const availableCount = rt.rooms
        .filter((r) => r.is_active)
        .filter((r) => !blockedRoomIds.has(r.id)).length;

      if (availableCount > 0) {
        const restrictions = await this.inventoryService.getYieldRestrictions(
          rt.id, property.id, checkIn, checkOut,
        );
        if (restrictions.stopSell) continue;
        if (restrictions.closedToArrival) continue;
        if (restrictions.closedToDeparture) continue;
        if (restrictions.minStay != null && nights < restrictions.minStay) continue;
        if (restrictions.maxStay != null && nights > restrictions.maxStay) continue;

        let totalPrice = 0;
        const queryGuests = guests ?? 1;
        for (let i = 0; i < nightDates.length; i++) {
          let baseForNight = await this.inventoryService.getEffectivePrice(
            rt.id,
            property.id,
            nightDates[i],
          );
          const { price: derivedPrice } = await this.inventoryService.getDerivedPrice(
            rt.id,
            baseForNight,
            queryGuests,
          );
          baseForNight = derivedPrice;
          const { price } = await this.pricingService.calculatePrice(
            property.id,
            rt.id,
            baseForNight,
            checkIn,
            i,
            nights,
            0,
          );
          totalPrice += price;
        }
        const nightlyRate = Math.round((totalPrice / nights) * 100) / 100;

        result.push({
          roomTypeId: rt.id,
          roomTypeName: rt.name,
          description: rt.description,
          amenities: rt.amenities.map((a) => a.amenity),
          photos: rt.photos || [],
          nightlyRate,
          totalPrice,
          availableCount,
          maxOccupancy: rt.max_occupancy,
        });
      }
    }

    return {
      checkIn,
      checkOut,
      nights,
      availableRooms: result,
    };
  }

  // -- Public property info -------------------------------------------------

  async getGuestbook(slug: string) {
    const property = await this.propertiesRepo.findOne({
      where: { slug, is_active: true },
    });
    if (!property) throw new NotFoundException('Property not found');

    return {
      propertyName: property.name,
      wifiName: property.wifi_name || null,
      wifiPassword: property.wifi_password || null,
      houseRules: property.house_rules || null,
      localTips: property.local_tips || null,
      emergencyContact: property.emergency_contact || null,
      checkInTime: property.check_in_time,
      checkOutTime: property.check_out_time,
      address: [property.address_line1, property.city, property.province]
        .filter(Boolean)
        .join(', '),
      phone: property.phone || null,
    };
  }

  async getPublicProperty(slug: string) {
    const property = await this.propertiesRepo.findOne({
      where: { slug, is_active: true },
    });
    if (!property) throw new NotFoundException('Property not found');

    const roomTypes = await this.roomTypesRepo.find({
      where: { property_id: property.id, is_active: true },
      relations: ['amenities'],
      order: { sort_order: 'ASC' },
    });

    return {
      name: property.name,
      description: property.description,
      coverImage: property.cover_image_url,
      photos: property.photos || [],
      location: [property.city, property.province]
        .filter(Boolean)
        .join(', '),
      checkInTime: property.check_in_time,
      checkOutTime: property.check_out_time,
      googleAnalyticsId: property.google_analytics_id || null,
      roomTypes: roomTypes.map((rt) => ({
        id: rt.id,
        name: rt.name,
        description: rt.description,
        basePrice: Number(rt.base_price),
        maxOccupancy: rt.max_occupancy,
        photos: rt.photos || [],
        amenities: rt.amenities.map((a) => a.amenity),
      })),
    };
  }

  // -- List bookings --------------------------------------------------------

  async listBookings(
    propertyId: string,
    query: {
      status?: string;
      source?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.bookingsRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.guest', 'g')
      .leftJoinAndSelect('b.room', 'r')
      .where('b.property_id = :propertyId', { propertyId });

    if (query.status) qb.andWhere('b.status = :status', { status: query.status });
    if (query.source) qb.andWhere('b.source = :source', { source: query.source });
    if (query.startDate) qb.andWhere('b.check_in >= :start', { start: query.startDate });
    if (query.endDate) qb.andWhere('b.check_out <= :end', { end: query.endDate });
    if (query.search) {
      qb.andWhere(
        '(b.reference_number ILIKE :s OR g.first_name ILIKE :s OR g.last_name ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    qb.orderBy('b.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // -- Get single booking ---------------------------------------------------

  async getBooking(bookingId: string): Promise<Booking> {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId },
      relations: ['guest', 'room', 'room.room_type', 'property'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  // -- Get booking group ----------------------------------------------------

  async getBookingGroup(groupId: string): Promise<Booking[]> {
    const bookings = await this.bookingsRepo.find({
      where: { group_id: groupId },
      relations: ['guest', 'room', 'room.room_type', 'property'],
      order: { group_index: 'ASC' },
    });
    if (!bookings.length) throw new NotFoundException('Booking group not found');
    return bookings;
  }

  // -- Update booking -------------------------------------------------------

  async updateBooking(bookingId: string, dto: UpdateBookingDto): Promise<Booking> {
    const booking = await this.getBooking(bookingId);
    const snapshot = {
      check_in: booking.check_in,
      check_out: booking.check_out,
      guest_count: booking.guest_count,
      special_requests: booking.special_requests,
    };

    if (dto.checkIn || dto.checkOut) {
      const newCheckIn = dto.checkIn ?? booking.check_in;
      const newCheckOut = dto.checkOut ?? booking.check_out;
      const nights = this.calcNights(newCheckIn, newCheckOut);
      if (nights < 1) throw new BadRequestException('Invalid dates');

      const result = await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
        // Release old availability
        await manager.query(
          `UPDATE room_availability
           SET status = 'available', booking_id = NULL, updated_at = NOW()
           WHERE booking_id = $1`,
          [bookingId],
        );

        // Lock + verify new dates
        const rows: RoomAvailability[] = await manager.query(
          `SELECT * FROM room_availability
           WHERE room_id = $1 AND date >= $2 AND date < $3
           FOR UPDATE`,
          [booking.room_id, newCheckIn, newCheckOut],
        );

        const dates = this.dateRange(newCheckIn, newCheckOut);
        const unavailable = dates.filter((d) => {
          const r = rows.find(
            (row) => this.normalizeDate(row.date) === d,
          );
          return !r || r.status !== AvailabilityStatus.AVAILABLE;
        });
        if (unavailable.length) {
          throw new ConflictException({
            code: 'BOOK_DOUBLE_BOOKING',
            message: 'Room not available for modified dates',
            unavailableDates: unavailable,
          });
        }

        const nightlyRate = Number(booking.nightly_rate);
        booking.check_in = newCheckIn;
        booking.check_out = newCheckOut;
        booking.nights = nights;
        booking.total_price = nightlyRate * nights;
        if (dto.guestCount) booking.guest_count = dto.guestCount;
        if (dto.specialRequests !== undefined)
          booking.special_requests = dto.specialRequests;
        if (dto.internalNotes !== undefined)
          booking.internal_notes = dto.internalNotes;
        await manager.save(booking);

        await manager.query(
          `UPDATE room_availability
           SET status = 'booked', booking_id = $1, updated_at = NOW()
           WHERE room_id = $2 AND date >= $3 AND date < $4`,
          [bookingId, booking.room_id, newCheckIn, newCheckOut],
        );

        return booking;
      });

      this.emitModifiedEvent(result, snapshot);
      return result;
    }

    // Simple field updates (no date change)
    if (dto.guestCount) booking.guest_count = dto.guestCount;
    if (dto.specialRequests !== undefined)
      booking.special_requests = dto.specialRequests;
    if (dto.internalNotes !== undefined)
      booking.internal_notes = dto.internalNotes;
    const saved = await this.bookingsRepo.save(booking);
    this.emitModifiedEvent(saved, snapshot);
    return saved;
  }

  // -- Status transitions ---------------------------------------------------

  async updateStatus(bookingId: string, dto: UpdateStatusDto): Promise<Booking> {
    const booking = await this.getBooking(bookingId);
    const oldStatus = booking.status;
    const allowed = VALID_TRANSITIONS[booking.status];
    if (!allowed || !allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from '${booking.status}' to '${dto.status}'`,
      );
    }
    booking.status = dto.status;
    const saved = await this.bookingsRepo.save(booking);

    if (oldStatus !== dto.status) {
      this.eventEmitter.emit(
        BOOKING_EVENTS.MODIFIED,
        new BookingModifiedEvent(saved.id, {
          status: { old: oldStatus, new: dto.status },
        }, saved.property_id),
      );

      if (dto.status === BookingStatus.CHECKED_IN) {
        this.eventEmitter.emit(BOOKING_EVENTS.CHECKED_IN, {
          bookingId: saved.id,
          propertyId: saved.property_id,
        });
      }

      if (dto.status === BookingStatus.CHECKED_OUT) {
        this.updateGuestStatsOnCheckout(saved.id);
        this.eventEmitter.emit(BOOKING_EVENTS.CHECKED_OUT, {
          bookingId: saved.id,
          propertyId: saved.property_id,
        });
      }
    }

    return saved;
  }

  // -- Cancel (single booking) ----------------------------------------------

  async cancelBooking(
    bookingId: string,
    dto: CancelBookingDto,
  ): Promise<Booking> {
    const booking = await this.getBooking(bookingId);
    const allowed = VALID_TRANSITIONS[booking.status];
    if (!allowed || !allowed.includes(BookingStatus.CANCELLED)) {
      throw new BadRequestException(
        `Cannot cancel booking in '${booking.status}' status`,
      );
    }

    const result = await this.dataSource.transaction(async (manager) => {
      booking.status = BookingStatus.CANCELLED;
      booking.cancelled_at = new Date();
      booking.cancellation_reason = dto.reason ?? (null as any);
      await manager.save(booking);

      // Release availability
      await manager.query(
        `UPDATE room_availability
         SET status = 'available', booking_id = NULL, updated_at = NOW()
         WHERE booking_id = $1`,
        [bookingId],
      );

      return booking;
    });

    this.eventEmitter.emit(
      BOOKING_EVENTS.CANCELLED,
      new BookingCancelledEvent(result.id, dto.reason, result.property_id),
    );

    return result;
  }

  // -- Cancel entire group --------------------------------------------------

  async cancelBookingGroup(
    groupId: string,
    dto: CancelBookingDto,
  ): Promise<Booking[]> {
    const bookings = await this.getBookingGroup(groupId);
    const results: Booking[] = [];

    for (const booking of bookings) {
      const allowed = VALID_TRANSITIONS[booking.status];
      if (allowed && allowed.includes(BookingStatus.CANCELLED)) {
        const cancelled = await this.cancelBooking(booking.id, dto);
        results.push(cancelled);
      } else {
        results.push(booking);
      }
    }

    return results;
  }

  // -- Guest portal (public lookup) -----------------------------------------

  async lookupBooking(referenceNumber: string, email: string) {
    const booking = await this.bookingsRepo.findOne({
      where: { reference_number: referenceNumber },
      relations: ['guest', 'room', 'room.room_type', 'property'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (
      booking.guest?.email?.toLowerCase() !== email.toLowerCase()
    ) {
      throw new NotFoundException('Booking not found');
    }

    const base = this.formatBookingForGuest(booking);

    // Include payment summary
    try {
      const summary = await this.paymentsService.getBookingPaymentSummary(
        booking.id,
        booking.property_id,
      );
      (base as any).paymentSummary = {
        totalPaid: summary.totalPaid,
        balance: summary.balance,
        fullyPaid: summary.fullyPaid,
      };
    } catch {
      (base as any).paymentSummary = {
        totalPaid: 0,
        balance: Number(booking.total_price),
        fullyPaid: false,
      };
    }

    // If part of a group, include sibling bookings
    if (booking.group_id) {
      const siblings = await this.bookingsRepo.find({
        where: { group_id: booking.group_id },
        relations: ['room', 'room.room_type'],
        order: { group_index: 'ASC' },
      });
      base.group = {
        groupId: booking.group_id,
        totalRooms: siblings.length,
        rooms: siblings.map((s) => ({
          bookingId: s.id,
          referenceNumber: s.reference_number,
          roomName: s.room?.room_type?.name,
          roomNumber: s.room?.name,
          status: s.status,
          totalPrice: Number(s.total_price),
        })),
        grandTotal: siblings.reduce((sum, s) => sum + Number(s.total_price), 0),
      };
    }

    return base;
  }

  async initiatePublicPayment(referenceNumber: string, email: string, paymentType: string) {
    const booking = await this.bookingsRepo.findOne({
      where: { reference_number: referenceNumber },
      relations: ['guest', 'property'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.guest?.email?.toLowerCase() !== email.toLowerCase()) {
      throw new NotFoundException('Booking not found');
    }

    const settings = await this.paymentsService.getSettings(booking.property_id);

    if (paymentType === 'eft' || (!settings.payfast_enabled && settings.eft_enabled)) {
      if (!settings.eft_enabled) {
        throw new BadRequestException('Online payment not configured');
      }
      return {
        eftDetails: {
          bankName: settings.eft_bank_name,
          accountHolder: settings.eft_account_holder,
          accountNumber: settings.eft_account_number,
          branchCode: settings.eft_branch_code,
          reference: booking.reference_number,
        },
      };
    }

    if (settings.payfast_enabled) {
      const result = await this.paymentsService.initiatePayfast(booking.property_id, {
        bookingId: booking.id,
        paymentType: paymentType as any || 'balance',
      });
      return { redirectUrl: result.redirectUrl };
    }

    throw new BadRequestException('Online payment not configured');
  }

  async guestCancelBooking(
    referenceNumber: string,
    email: string,
    reason?: string,
    cancelGroup?: boolean,
  ) {
    const booking = await this.bookingsRepo.findOne({
      where: { reference_number: referenceNumber },
      relations: ['guest'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.guest?.email?.toLowerCase() !== email.toLowerCase()) {
      throw new NotFoundException('Booking not found');
    }

    if (cancelGroup && booking.group_id) {
      return this.cancelBookingGroup(booking.group_id, {
        reason: reason || 'Cancelled by guest',
      });
    }

    return this.cancelBooking(booking.id, { reason: reason || 'Cancelled by guest' });
  }

  // -- Online check-in (public) ---------------------------------------------

  async onlineCheckIn(dto: OnlineCheckInDto) {
    const booking = await this.bookingsRepo.findOne({
      where: { reference_number: dto.referenceNumber },
      relations: ['guest', 'room', 'room.room_type', 'property'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.guest?.email?.toLowerCase() !== dto.email.toLowerCase()) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        `Online check-in is only available for confirmed bookings (current status: ${booking.status})`,
      );
    }

    if (booking.online_check_in_completed) {
      throw new BadRequestException('Online check-in has already been completed for this booking');
    }

    booking.expected_arrival_time = dto.expectedArrivalTime ?? (null as any);
    booking.vehicle_registration = dto.vehicleRegistration ?? (null as any);
    booking.num_vehicles = dto.numVehicles ?? (null as any);
    booking.dietary_requirements = dto.dietaryRequirements ?? (null as any);
    booking.online_check_in_completed = true;
    booking.online_check_in_at = new Date();

    if (dto.specialRequests) {
      booking.special_requests = booking.special_requests
        ? `${booking.special_requests}\n${dto.specialRequests}`
        : dto.specialRequests;
    }

    if (dto.idNumber && booking.guest) {
      booking.guest.id_number = dto.idNumber;
      await this.guestsRepo.save(booking.guest);
    }

    await this.bookingsRepo.save(booking);

    // If part of a group, apply check-in details to all sibling bookings
    if (booking.group_id) {
      const siblings = await this.bookingsRepo.find({
        where: { group_id: booking.group_id },
      });
      for (const sibling of siblings) {
        if (sibling.id === booking.id) continue;
        if (sibling.status !== BookingStatus.CONFIRMED) continue;
        if (sibling.online_check_in_completed) continue;

        sibling.expected_arrival_time = booking.expected_arrival_time;
        sibling.vehicle_registration = booking.vehicle_registration;
        sibling.num_vehicles = booking.num_vehicles;
        sibling.dietary_requirements = booking.dietary_requirements;
        sibling.online_check_in_completed = true;
        sibling.online_check_in_at = new Date();
        if (dto.specialRequests) {
          sibling.special_requests = sibling.special_requests
            ? `${sibling.special_requests}\n${dto.specialRequests}`
            : dto.specialRequests;
        }
        await this.bookingsRepo.save(sibling);
      }
    }

    return {
      success: true,
      message: 'Online check-in completed successfully',
      referenceNumber: booking.reference_number,
      expectedArrivalTime: booking.expected_arrival_time,
      checkInDate: booking.check_in,
      propertyName: booking.property?.name,
    };
  }

  // -- Guest self-service modification ----------------------------------------

  async guestModifyBooking(
    referenceNumber: string,
    email: string,
    dto: { checkIn?: string; checkOut?: string; guestCount?: number; specialRequests?: string },
  ) {
    const booking = await this.bookingsRepo.findOne({
      where: { reference_number: referenceNumber },
      relations: ['guest', 'room', 'room.room_type', 'property'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.guest?.email?.toLowerCase() !== email.toLowerCase()) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Booking modifications are only allowed for pending or confirmed bookings (current: ${booking.status})`,
      );
    }

    const checkIn = new Date(booking.check_in);
    const now = new Date();
    const daysUntilCheckIn = Math.ceil((checkIn.getTime() - now.getTime()) / 86_400_000);
    if (daysUntilCheckIn < 2) {
      throw new BadRequestException('Booking modifications must be made at least 48 hours before check-in');
    }

    const updateDto: UpdateBookingDto = {};
    if (dto.checkIn) updateDto.checkIn = dto.checkIn;
    if (dto.checkOut) updateDto.checkOut = dto.checkOut;
    if (dto.guestCount) updateDto.guestCount = dto.guestCount;
    if (dto.specialRequests !== undefined) updateDto.specialRequests = dto.specialRequests;

    const updated = await this.updateBooking(booking.id, updateDto);

    return this.formatBookingForGuest(
      await this.bookingsRepo.findOne({
        where: { id: updated.id },
        relations: ['guest', 'room', 'room.room_type', 'property'],
      }) as Booking,
    );
  }

  // -- Helpers --------------------------------------------------------------

  private formatBookingForGuest(booking: Booking) {
    return {
      id: booking.id,
      referenceNumber: booking.reference_number,
      status: booking.status,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      guestCount: booking.guest_count,
      totalPrice: Number(booking.total_price),
      nightlyRate: Number(booking.nightly_rate),
      currency: booking.currency,
      specialRequests: booking.special_requests,
      bookedAt: booking.booked_at,
      guest: {
        firstName: booking.guest.first_name,
        lastName: booking.guest.last_name,
        email: booking.guest.email,
        phone: booking.guest.phone,
      },
      room: {
        name: booking.room?.room_type?.name,
        number: booking.room?.name,
      },
      property: {
        name: booking.property?.name,
        address: booking.property?.address_line1,
        city: booking.property?.city,
        phone: booking.property?.phone,
        checkInTime: booking.property?.check_in_time,
        checkOutTime: booking.property?.check_out_time,
      },
      onlineCheckIn: {
        completed: booking.online_check_in_completed,
        completedAt: booking.online_check_in_at,
        expectedArrivalTime: booking.expected_arrival_time,
        vehicleRegistration: booking.vehicle_registration,
        numVehicles: booking.num_vehicles,
        dietaryRequirements: booking.dietary_requirements,
      },
      canCheckInOnline:
        booking.status === BookingStatus.CONFIRMED &&
        !booking.online_check_in_completed,
      canModify:
        (booking.status === BookingStatus.PENDING ||
          booking.status === BookingStatus.CONFIRMED) &&
        Math.ceil(
          (new Date(booking.check_in).getTime() - Date.now()) / 86_400_000,
        ) >= 2,
      canCancel:
        booking.status === BookingStatus.PENDING ||
        booking.status === BookingStatus.CONFIRMED,
      group: null as any,
    };
  }

  private emitModifiedEvent(
    booking: Booking,
    snapshot: Record<string, any>,
  ) {
    const changes: Record<string, { old: any; new: any }> = {};
    for (const key of Object.keys(snapshot)) {
      const oldVal = snapshot[key];
      const newVal = (booking as any)[key];
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        changes[key] = { old: oldVal, new: newVal };
      }
    }
    if (Object.keys(changes).length > 0) {
      this.eventEmitter.emit(
        BOOKING_EVENTS.MODIFIED,
        new BookingModifiedEvent(booking.id, changes),
      );
    }
  }

  private async findOrCreateGuest(
    manager: any,
    propertyId: string,
    guestDto: { firstName: string; lastName: string; email?: string; phone?: string; country?: string },
  ): Promise<Guest & { isReturning?: boolean }> {
    let existing: Guest | null = null;

    if (guestDto.email) {
      existing = await manager.findOne(Guest, {
        where: { property_id: propertyId, email: guestDto.email },
      });
    }
    if (!existing && guestDto.phone) {
      existing = await manager.findOne(Guest, {
        where: { property_id: propertyId, phone: guestDto.phone },
      });
    }

    if (existing) {
      if (guestDto.firstName) existing.first_name = guestDto.firstName;
      if (guestDto.lastName) existing.last_name = guestDto.lastName;
      if (guestDto.phone && !existing.phone) existing.phone = guestDto.phone;
      if (guestDto.country && !existing.country) existing.country = guestDto.country;
      await manager.save(existing);
      (existing as any).isReturning = existing.total_stays > 0;
      return existing as Guest & { isReturning?: boolean };
    }

    const guest = manager.create(Guest, {
      property_id: propertyId,
      first_name: guestDto.firstName,
      last_name: guestDto.lastName,
      email: guestDto.email,
      phone: guestDto.phone,
      country: guestDto.country,
    });
    const saved = await manager.save(guest);
    (saved as any).isReturning = false;
    return saved;
  }

  async updateGuestStatsOnCheckout(bookingId: string): Promise<void> {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId },
      relations: ['guest'],
    });
    if (!booking?.guest) return;

    const guest = booking.guest;
    guest.total_stays = (guest.total_stays || 0) + 1;
    guest.total_revenue = Number(guest.total_revenue || 0) + Number(booking.total_price);
    guest.last_stay_date = booking.check_out;
    await this.guestsRepo.save(guest);
  }

  private async findBestAvailableRoom(
    propertyId: string,
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
    excludeRoomIds?: Set<string>,
  ): Promise<Room> {
    const rooms = await this.roomsRepo.find({
      where: { property_id: propertyId, room_type_id: roomTypeId, is_active: true },
    });
    for (const room of rooms) {
      if (excludeRoomIds?.has(room.id)) continue;

      const blocked = await this.availabilityRepo
        .createQueryBuilder('a')
        .where('a.room_id = :roomId', { roomId: room.id })
        .andWhere('a.date >= :start AND a.date < :end', {
          start: checkIn,
          end: checkOut,
        })
        .andWhere('a.status != :avail', { avail: AvailabilityStatus.AVAILABLE })
        .getCount();
      if (blocked === 0) return room;
    }
    throw new ConflictException(`No rooms of type ${roomTypeId} available for the selected dates`);
  }

  private async generateRefNumber(manager: any): Promise<string> {
    const year = new Date().getFullYear();
    const result = await manager.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(reference_number FROM 'POS-\\d{4}-(\\d+)') AS INTEGER)), 0) + 1 AS next_seq
       FROM bookings WHERE reference_number LIKE $1`,
      [`POS-${year}-%`],
    );
    const seq = (parseInt(result[0].next_seq, 10)).toString().padStart(4, '0');
    return `POS-${year}-${seq}`;
  }

  private calcNights(checkIn: string, checkOut: string): number {
    const ms =
      new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.round(ms / 86_400_000);
  }

  private normalizeDate(d: string | Date): string {
    if (d instanceof Date) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    if (typeof d === 'string' && d.length > 10) return d.slice(0, 10);
    return d;
  }

  private dateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const d = new Date(start);
    const last = new Date(end);
    while (d < last) {
      dates.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }
}
