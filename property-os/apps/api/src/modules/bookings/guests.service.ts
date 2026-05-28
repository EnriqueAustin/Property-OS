import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guest } from './entities/guest.entity';
import { Booking } from './entities/booking.entity';
import { UpdateGuestDto } from './dto/guest.dto';

@Injectable()
export class GuestsService {
  constructor(
    @InjectRepository(Guest)
    private guestsRepo: Repository<Guest>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
  ) {}

  async listGuests(
    propertyId: string,
    query: { search?: string; page?: number; limit?: number },
  ) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);

    const qb = this.guestsRepo
      .createQueryBuilder('g')
      .where('g.property_id = :propertyId', { propertyId });

    if (query.search) {
      qb.andWhere(
        '(g.first_name ILIKE :s OR g.last_name ILIKE :s OR g.email ILIKE :s OR g.phone ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    qb.orderBy('g.last_name', 'ASC')
      .addOrderBy('g.first_name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getGuest(guestId: string) {
    const guest = await this.guestsRepo.findOne({
      where: { id: guestId },
    });
    if (!guest) throw new NotFoundException('Guest not found');

    const bookings = await this.bookingsRepo.find({
      where: { guest_id: guestId },
      relations: ['room', 'room.room_type'],
      order: { check_in: 'DESC' },
      take: 50,
    });

    return {
      ...guest,
      bookings: bookings.map((b) => ({
        id: b.id,
        referenceNumber: b.reference_number,
        checkIn: b.check_in,
        checkOut: b.check_out,
        nights: b.nights,
        totalPrice: Number(b.total_price),
        status: b.status,
        source: b.source,
        roomName: b.room?.name,
        roomType: b.room?.room_type?.name,
      })),
    };
  }

  async updateGuest(guestId: string, dto: UpdateGuestDto) {
    const guest = await this.guestsRepo.findOne({ where: { id: guestId } });
    if (!guest) throw new NotFoundException('Guest not found');
    Object.assign(guest, dto);
    return this.guestsRepo.save(guest);
  }
}
