import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { RoomType } from './entities/room-type.entity';
import { RoomAmenity } from './entities/room-amenity.entity';
import { Room } from './entities/room.entity';
import {
  AvailabilityStatus,
  RoomAvailability,
} from './entities/room-availability.entity';
import {
  CreateRoomTypeDto,
  UpdateRoomTypeDto,
} from './dto/room-type.dto';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
import {
  AvailabilityQueryDto,
  BlockDatesDto,
  BulkAvailabilityUpdateDto,
  UnblockDatesDto,
} from './dto/availability.dto';
import { RatePeriod } from './entities/rate-period.entity';
import { CreateRatePeriodDto, UpdateRatePeriodDto } from './dto/rate-period.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(RoomType)
    private roomTypesRepo: Repository<RoomType>,
    @InjectRepository(RoomAmenity)
    private amenitiesRepo: Repository<RoomAmenity>,
    @InjectRepository(Room)
    private roomsRepo: Repository<Room>,
    @InjectRepository(RoomAvailability)
    private availabilityRepo: Repository<RoomAvailability>,
    @InjectRepository(RatePeriod)
    private ratePeriodRepo: Repository<RatePeriod>,
    private dataSource: DataSource,
  ) {}

  // -- Room Types -----------------------------------------------------------

  createRoomType(propertyId: string, dto: CreateRoomTypeDto): Promise<RoomType> {
    return this.dataSource.transaction(async (manager) => {
      const { amenities, ...rest } = dto;
      const roomType = manager.create(RoomType, {
        ...rest,
        property_id: propertyId,
      });
      const saved = await manager.save(roomType);

      if (amenities?.length) {
        const rows = amenities.map((a) =>
          manager.create(RoomAmenity, {
            room_type_id: saved.id,
            amenity: a.amenity,
            icon: a.icon,
          }),
        );
        await manager.save(rows);
      }

      return (await manager.findOne(RoomType, {
        where: { id: saved.id },
        relations: ['amenities', 'rooms'],
      }))!;
    });
  }

  listRoomTypes(propertyId: string): Promise<RoomType[]> {
    return this.roomTypesRepo.find({
      where: { property_id: propertyId },
      relations: ['amenities', 'rooms'],
      order: { sort_order: 'ASC', created_at: 'ASC' },
    });
  }

  async updateRoomType(
    roomTypeId: string,
    dto: UpdateRoomTypeDto,
  ): Promise<RoomType> {
    return this.dataSource.transaction(async (manager) => {
      const rt = await manager.findOne(RoomType, {
        where: { id: roomTypeId },
      });
      if (!rt) throw new NotFoundException('Room type not found');

      const { amenities, ...rest } = dto;
      Object.assign(rt, rest);
      await manager.save(rt);

      if (amenities) {
        await manager.delete(RoomAmenity, { room_type_id: rt.id });
        if (amenities.length) {
          const rows = amenities.map((a) =>
            manager.create(RoomAmenity, {
              room_type_id: rt.id,
              amenity: a.amenity,
              icon: a.icon,
            }),
          );
          await manager.save(rows);
        }
      }

      return (await manager.findOne(RoomType, {
        where: { id: rt.id },
        relations: ['amenities', 'rooms'],
      }))!;
    });
  }

  // -- Rooms ---------------------------------------------------------------

  createRoom(propertyId: string, dto: CreateRoomDto): Promise<Room> {
    return this.dataSource.transaction(async (manager) => {
      const rt = await manager.findOne(RoomType, {
        where: { id: dto.room_type_id, property_id: propertyId },
      });
      if (!rt) {
        throw new BadRequestException(
          'Room type does not belong to this property',
        );
      }

      const room = manager.create(Room, {
        property_id: propertyId,
        room_type_id: dto.room_type_id,
        name: dto.name,
        floor: dto.floor,
        notes: dto.notes,
        is_active: dto.is_active ?? true,
        sort_order: dto.sort_order ?? 0,
      });
      const saved = await manager.save(room);

      // Auto-populate 365 days of availability via generate_series
      await manager.query(
        `INSERT INTO room_availability (room_id, date, status)
         SELECT $1::uuid, d::date, 'available'
         FROM generate_series(
           CURRENT_DATE,
           CURRENT_DATE + INTERVAL '365 days',
           INTERVAL '1 day'
         ) AS d
         ON CONFLICT (room_id, date) DO NOTHING`,
        [saved.id],
      );

      return saved;
    });
  }

  listRooms(propertyId: string): Promise<Room[]> {
    return this.roomsRepo.find({
      where: { property_id: propertyId },
      relations: ['room_type'],
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async updateRoom(roomId: string, dto: UpdateRoomDto): Promise<Room> {
    const room = await this.roomsRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    Object.assign(room, dto);
    return this.roomsRepo.save(room);
  }

  // -- Availability --------------------------------------------------------

  async getAvailability(propertyId: string, q: AvailabilityQueryDto) {
    if (q.endDate < q.startDate) {
      throw new BadRequestException('endDate must be >= startDate');
    }

    const roomsQb = this.roomsRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.room_type', 'rt')
      .where('r.property_id = :propertyId', { propertyId })
      .andWhere('r.is_active = true');

    if (q.roomTypeId) {
      roomsQb.andWhere('r.room_type_id = :rtId', { rtId: q.roomTypeId });
    }

    const rooms = await roomsQb.getMany();
    if (!rooms.length) return { rooms: [], days: [] };

    const roomIds = rooms.map((r) => r.id);
    const days = await this.availabilityRepo.find({
      where: {
        room_id: In(roomIds),
        date: this.dateBetween(q.startDate, q.endDate),
      },
      order: { date: 'ASC' },
    });

    // Group by room → [{date,status,price}]
    const byRoom = new Map<string, any[]>();
    for (const r of rooms) byRoom.set(r.id, []);
    for (const a of days) {
      byRoom.get(a.room_id)?.push({
        date: a.date,
        status: a.status,
        price:
          a.price_override !== null && a.price_override !== undefined
            ? Number(a.price_override)
            : Number(rooms.find((r) => r.id === a.room_id)?.room_type?.base_price ?? 0),
        booking_id: a.booking_id,
      });
    }

    return {
      rooms: rooms.map((r) => ({
        id: r.id,
        name: r.name,
        room_type: r.room_type
          ? { id: r.room_type.id, name: r.room_type.name }
          : null,
        days: byRoom.get(r.id) ?? [],
      })),
    };
  }

  async blockDates(propertyId: string, dto: BlockDatesDto) {
    await this.assertRoomBelongs(dto.room_id, propertyId);
    if (dto.end_date < dto.start_date) {
      throw new BadRequestException('end_date must be >= start_date');
    }
    const result = await this.availabilityRepo
      .createQueryBuilder()
      .update(RoomAvailability)
      .set({
        status: AvailabilityStatus.BLOCKED,
        blocked_reason: dto.reason ?? null,
      })
      .where('room_id = :roomId', { roomId: dto.room_id })
      .andWhere('date BETWEEN :start AND :end', {
        start: dto.start_date,
        end: dto.end_date,
      })
      .andWhere('status = :avail', { avail: AvailabilityStatus.AVAILABLE })
      .execute();
    return { blocked: result.affected ?? 0 };
  }

  async unblockDates(propertyId: string, dto: UnblockDatesDto) {
    await this.assertRoomBelongs(dto.room_id, propertyId);
    const result = await this.availabilityRepo
      .createQueryBuilder()
      .update(RoomAvailability)
      .set({
        status: AvailabilityStatus.AVAILABLE,
        blocked_reason: null,
      })
      .where('room_id = :roomId', { roomId: dto.room_id })
      .andWhere('date BETWEEN :start AND :end', {
        start: dto.start_date,
        end: dto.end_date,
      })
      .andWhere('status = :blocked', { blocked: AvailabilityStatus.BLOCKED })
      .execute();
    return { unblocked: result.affected ?? 0 };
  }

  // -- Bulk Availability Update ------------------------------------------------

  async bulkUpdateAvailability(propertyId: string, dto: BulkAvailabilityUpdateDto) {
    if (dto.end_date < dto.start_date) {
      throw new BadRequestException('end_date must be >= start_date');
    }

    for (const roomId of dto.room_ids) {
      await this.assertRoomBelongs(roomId, propertyId);
    }

    const setClause: Record<string, any> = { status: dto.status };
    if (dto.price_override !== undefined) {
      setClause.price_override = dto.price_override;
    }
    if (dto.status === AvailabilityStatus.BLOCKED && dto.reason) {
      setClause.blocked_reason = dto.reason;
    }
    if (dto.status === AvailabilityStatus.AVAILABLE) {
      setClause.blocked_reason = null;
      setClause.booking_id = null;
    }

    const qb = this.availabilityRepo
      .createQueryBuilder()
      .update(RoomAvailability)
      .set(setClause)
      .where('room_id IN (:...roomIds)', { roomIds: dto.room_ids })
      .andWhere('date BETWEEN :start AND :end', {
        start: dto.start_date,
        end: dto.end_date,
      });

    if (dto.status === AvailabilityStatus.BLOCKED || dto.status === AvailabilityStatus.MAINTENANCE) {
      qb.andWhere('status = :available', { available: AvailabilityStatus.AVAILABLE });
    }

    const result = await qb.execute();
    return { updated: result.affected ?? 0 };
  }

  // -- Rate Periods -----------------------------------------------------------

  async createRatePeriod(propertyId: string, dto: CreateRatePeriodDto): Promise<RatePeriod> {
    if (dto.end_date < dto.start_date) {
      throw new BadRequestException('end_date must be >= start_date');
    }
    if (!dto.price_override && !dto.price_modifier) {
      throw new BadRequestException('Either price_override or price_modifier is required');
    }
    const rp = this.ratePeriodRepo.create({
      ...dto,
      property_id: propertyId,
    });
    return this.ratePeriodRepo.save(rp);
  }

  async listRatePeriods(propertyId: string): Promise<RatePeriod[]> {
    return this.ratePeriodRepo.find({
      where: { property_id: propertyId },
      relations: ['room_type'],
      order: { start_date: 'ASC' },
    });
  }

  async updateRatePeriod(ratePeriodId: string, dto: UpdateRatePeriodDto): Promise<RatePeriod> {
    const rp = await this.ratePeriodRepo.findOne({ where: { id: ratePeriodId } });
    if (!rp) throw new NotFoundException('Rate period not found');
    Object.assign(rp, dto);
    if (rp.end_date < rp.start_date) {
      throw new BadRequestException('end_date must be >= start_date');
    }
    return this.ratePeriodRepo.save(rp);
  }

  async deleteRatePeriod(ratePeriodId: string): Promise<void> {
    const rp = await this.ratePeriodRepo.findOne({ where: { id: ratePeriodId } });
    if (!rp) throw new NotFoundException('Rate period not found');
    await this.ratePeriodRepo.remove(rp);
  }

  async getEffectivePrice(roomTypeId: string, propertyId: string, date: string): Promise<number> {
    const rt = await this.roomTypesRepo.findOne({ where: { id: roomTypeId } });
    if (!rt) throw new NotFoundException('Room type not found');

    const basePrice = Number(rt.base_price);

    const ratePeriod = await this.ratePeriodRepo
      .createQueryBuilder('rp')
      .where('rp.property_id = :propertyId', { propertyId })
      .andWhere('rp.is_active = true')
      .andWhere('rp.start_date <= :date AND rp.end_date >= :date', { date })
      .andWhere('(rp.room_type_id = :roomTypeId OR rp.room_type_id IS NULL)', { roomTypeId })
      .orderBy('rp.room_type_id', 'DESC', 'NULLS LAST') // Prefer specific room type over wildcard
      .getOne();

    if (!ratePeriod) return basePrice;

    if (ratePeriod.price_override) {
      return Number(ratePeriod.price_override);
    }
    if (ratePeriod.price_modifier) {
      return Math.round(basePrice * (1 + Number(ratePeriod.price_modifier) / 100) * 100) / 100;
    }
    return basePrice;
  }

  private async assertRoomBelongs(roomId: string, propertyId: string) {
    const room = await this.roomsRepo.findOne({
      where: { id: roomId, property_id: propertyId },
    });
    if (!room) {
      throw new BadRequestException('Room does not belong to this property');
    }
  }

  private dateBetween(start: string, end: string) {
    // Helper preserved for clarity; the queries that use it switched to QB.
    // TypeORM `Between` is imported here lazily to avoid type-name shadowing.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Between } = require('typeorm');
    return Between(start, end);
  }
}
