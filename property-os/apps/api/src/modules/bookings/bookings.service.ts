import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, ILike, Repository } from 'typeorm';
import { Booking, BookingSource, BookingStatus } from './entities/booking.entity';
import { Guest } from './entities/guest.entity';
import { RoomAvailability, AvailabilityStatus } from '../inventory/entities/room-availability.entity';
import { Room } from '../inventory/entities/room.entity';
import { RoomType } from '../inventory/entities/room-type.entity';
import { Property } from '../properties/entities/property.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PublicBookingDto } from './dto/public-booking.dto';
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
  ) {}

  // -- Admin booking creation (CRITICAL) ------------------------------------

  async createBooking(dto: CreateBookingDto): Promise<Booking> {
    const nights = this.calcNights(dto.checkIn, dto.checkOut);
    if (nights < 1) throw new BadRequestException('checkOut must be after checkIn');

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      // Lock availability rows
      const rows: RoomAvailability[] = await manager.query(
        `SELECT * FROM room_availability
         WHERE room_id = $1
           AND date >= $2
           AND date < $3
         ORDER BY date
         FOR UPDATE`,
        [dto.roomId, dto.checkIn, dto.checkOut],
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
          message: 'Room is not available for the requested dates',
          unavailableDates: unavailable,
        });
      }

      // Find or create guest
      const guest = await this.findOrCreateGuest(
        manager,
        dto.propertyId,
        dto.guest,
      );

      // Calculate pricing
      const room = await manager.findOne(Room, {
        where: { id: dto.roomId },
        relations: ['room_type'],
      });
      if (!room) throw new NotFoundException('Room not found');
      const nightlyRate = Number(room.room_type.base_price);
      const totalPrice = nightlyRate * nights;

      // Generate reference number
      const refNumber = await this.generateRefNumber(manager);

      // Create booking
      const booking = manager.create(Booking, {
        property_id: dto.propertyId,
        room_id: dto.roomId,
        guest_id: guest.id,
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
        [saved.id, dto.roomId, dto.checkIn, dto.checkOut],
      );

      const result = await manager.findOne(Booking, {
        where: { id: saved.id },
        relations: ['guest', 'room', 'room.room_type'],
      }) as Booking;

      // Fire-and-forget: don't await so booking response isn't delayed
      this.eventEmitter.emit(
        BOOKING_EVENTS.CREATED,
        new BookingCreatedEvent(result.id),
      );

      return result;
    });
  }

  // -- Public booking (widget) ----------------------------------------------

  async createPublicBooking(dto: PublicBookingDto): Promise<any> {
    const property = await this.propertiesRepo.findOne({
      where: { slug: dto.propertySlug, is_active: true, is_published: true },
    });
    if (!property) throw new NotFoundException('Property not found');

    const room = await this.findBestAvailableRoom(
      property.id,
      dto.roomTypeId,
      dto.checkIn,
      dto.checkOut,
    );

    const needsDeposit = property.deposit_required && Number(property.deposit_percentage) > 0;

    const booking = await this.createBooking({
      propertyId: property.id,
      roomId: room.id,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      guest: dto.guest,
      guestCount: dto.guestCount,
      specialRequests: dto.specialRequests,
      source: 'direct',
    });

    if (needsDeposit) {
      booking.status = BookingStatus.PENDING;
      await this.bookingsRepo.save(booking);
    }

    const depositAmount = needsDeposit
      ? Math.round(Number(booking.total_price) * Number(property.deposit_percentage)) / 100
      : 0;

    return {
      ...booking,
      depositRequired: needsDeposit,
      depositAmount,
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

    const result: Array<{
      roomTypeId: string;
      roomTypeName: string;
      description: string;
      amenities: string[];
      nightlyRate: number;
      totalPrice: number;
      availableCount: number;
      maxOccupancy: number;
    }> = [];
    for (const rt of roomTypes) {
      if (guests && rt.max_occupancy < guests) continue;

      let availableCount = 0;
      for (const room of rt.rooms.filter((r) => r.is_active)) {
        const blocked = await this.availabilityRepo
          .createQueryBuilder('a')
          .where('a.room_id = :roomId', { roomId: room.id })
          .andWhere('a.date >= :start AND a.date < :end', {
            start: checkIn,
            end: checkOut,
          })
          .andWhere('a.status != :avail', {
            avail: AvailabilityStatus.AVAILABLE,
          })
          .getCount();
        if (blocked === 0) availableCount++;
      }

      if (availableCount > 0) {
        result.push({
          roomTypeId: rt.id,
          roomTypeName: rt.name,
          description: rt.description,
          amenities: rt.amenities.map((a) => a.amenity),
          nightlyRate: Number(rt.base_price),
          totalPrice: Number(rt.base_price) * nights,
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
        }),
      );
    }

    return saved;
  }

  // -- Cancel ---------------------------------------------------------------

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
      new BookingCancelledEvent(result.id, dto.reason),
    );

    return result;
  }

  // -- Helpers --------------------------------------------------------------

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
  ): Promise<Guest> {
    if (guestDto.email) {
      const existing = await manager.findOne(Guest, {
        where: { property_id: propertyId, email: guestDto.email },
      });
      if (existing) return existing;
    }
    if (guestDto.phone) {
      const existing = await manager.findOne(Guest, {
        where: { property_id: propertyId, phone: guestDto.phone },
      });
      if (existing) return existing;
    }
    const guest = manager.create(Guest, {
      property_id: propertyId,
      first_name: guestDto.firstName,
      last_name: guestDto.lastName,
      email: guestDto.email,
      phone: guestDto.phone,
      country: guestDto.country,
    });
    return manager.save(guest);
  }

  private async findBestAvailableRoom(
    propertyId: string,
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<Room> {
    const rooms = await this.roomsRepo.find({
      where: { property_id: propertyId, room_type_id: roomTypeId, is_active: true },
    });
    for (const room of rooms) {
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
    throw new ConflictException('No rooms of this type available for the selected dates');
  }

  private async generateRefNumber(manager: any): Promise<string> {
    const year = new Date().getFullYear();
    const result = await manager.query(
      `SELECT COUNT(*) AS cnt FROM bookings WHERE EXTRACT(YEAR FROM created_at) = $1`,
      [year],
    );
    const seq = (parseInt(result[0].cnt, 10) + 1).toString().padStart(4, '0');
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
