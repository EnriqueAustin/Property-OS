import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between } from 'typeorm';
import { FolioItem, FolioCategory } from './entities/folio-item.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { AddFolioItemDto } from './dto/folio.dto';

@Injectable()
export class FrontdeskService {
  constructor(
    @InjectRepository(FolioItem)
    private folioRepo: Repository<FolioItem>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    private dataSource: DataSource,
  ) {}

  async getTodayBoard(propertyId: string) {
    const today = new Date().toISOString().slice(0, 10);

    const [arrivals, departures, inHouse] = await Promise.all([
      this.bookingsRepo.find({
        where: { property_id: propertyId, check_in: today, status: BookingStatus.CONFIRMED },
        relations: ['guest', 'room', 'room.room_type'],
        order: { created_at: 'ASC' },
      }),
      this.bookingsRepo.find({
        where: { property_id: propertyId, check_out: today, status: BookingStatus.CHECKED_IN },
        relations: ['guest', 'room', 'room.room_type'],
        order: { created_at: 'ASC' },
      }),
      this.bookingsRepo.find({
        where: { property_id: propertyId, status: BookingStatus.CHECKED_IN },
        relations: ['guest', 'room', 'room.room_type'],
        order: { check_out: 'ASC' },
      }),
    ]);

    const arrivalIds = arrivals.map((b) => b.id);
    const departureIds = departures.map((b) => b.id);
    const allIds = [...arrivalIds, ...departureIds, ...inHouse.map((b) => b.id)];

    let balances: Record<string, number> = {};
    if (allIds.length > 0) {
      const balanceRows = await this.dataSource.query(
        `SELECT booking_id,
          COALESCE(SUM(CASE WHEN is_credit = false THEN total ELSE 0 END), 0) AS charges,
          COALESCE(SUM(CASE WHEN is_credit = true THEN total ELSE 0 END), 0) AS credits
         FROM folio_items
         WHERE booking_id = ANY($1)
         GROUP BY booking_id`,
        [allIds],
      );
      for (const r of balanceRows) {
        balances[r.booking_id] = parseFloat(r.charges) - parseFloat(r.credits);
      }
    }

    const mapBooking = (b: Booking) => ({
      id: b.id,
      referenceNumber: b.reference_number,
      guestName: b.guest ? `${b.guest.first_name} ${b.guest.last_name}` : 'Unknown',
      guestPhone: b.guest?.phone,
      room: b.room?.name,
      roomType: b.room?.room_type?.name,
      checkIn: b.check_in,
      checkOut: b.check_out,
      nights: b.nights,
      guestCount: b.guest_count,
      totalPrice: Number(b.total_price),
      currency: b.currency,
      status: b.status,
      expectedArrivalTime: b.expected_arrival_time,
      onlineCheckInCompleted: b.online_check_in_completed,
      specialRequests: b.special_requests,
      balance: balances[b.id] || 0,
    });

    return {
      date: today,
      arrivals: arrivals.map(mapBooking),
      departures: departures.map(mapBooking),
      inHouse: inHouse.map(mapBooking),
      summary: {
        arrivalsCount: arrivals.length,
        departuresCount: departures.length,
        inHouseCount: inHouse.length,
      },
    };
  }

  // --- Folio ---

  async getBookingFolio(bookingId: string) {
    const items = await this.folioRepo.find({
      where: { booking_id: bookingId },
      order: { created_at: 'ASC' },
    });

    const charges = items.filter((i) => !i.is_credit).reduce((sum, i) => sum + Number(i.total), 0);
    const credits = items.filter((i) => i.is_credit).reduce((sum, i) => sum + Number(i.total), 0);

    return {
      items,
      summary: {
        totalCharges: charges,
        totalCredits: credits,
        balance: charges - credits,
      },
    };
  }

  async addFolioItem(propertyId: string, dto: AddFolioItemDto, postedBy?: string) {
    const booking = await this.bookingsRepo.findOne({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');

    const quantity = dto.quantity ?? 1;
    const total = dto.amount * quantity;

    const isCredit = [FolioCategory.PAYMENT, FolioCategory.DEPOSIT, FolioCategory.REFUND].includes(dto.category);

    const item = this.folioRepo.create({
      booking_id: dto.bookingId,
      property_id: propertyId,
      category: dto.category,
      description: dto.description,
      amount: dto.amount,
      quantity,
      total,
      is_credit: isCredit,
      posted_by: postedBy ?? (null as any),
      notes: dto.notes ?? (null as any),
    });

    return this.folioRepo.save(item);
  }

  async deleteFolioItem(itemId: string) {
    const item = await this.folioRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Folio item not found');
    await this.folioRepo.remove(item);
    return { deleted: true };
  }

  async autoPostRoomCharges(bookingId: string, propertyId: string) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId },
      relations: ['room', 'room.room_type'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const existing = await this.folioRepo.findOne({
      where: { booking_id: bookingId, category: FolioCategory.ROOM_CHARGE },
    });
    if (existing) return;

    const item = this.folioRepo.create({
      booking_id: bookingId,
      property_id: propertyId,
      category: FolioCategory.ROOM_CHARGE,
      description: `${booking.room?.room_type?.name || 'Room'} - ${booking.nights} night(s)`,
      amount: Number(booking.nightly_rate),
      quantity: booking.nights,
      total: Number(booking.total_price),
      is_credit: false,
      posted_by: 'system',
    });
    await this.folioRepo.save(item);
  }
}
