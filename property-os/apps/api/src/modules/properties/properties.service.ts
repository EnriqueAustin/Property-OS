import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import {
  PropertyUser,
  PropertyUserRole,
} from './entities/property-user.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { UpdateBookingSettingsDto } from './dto/booking-settings.dto';
import { CacheService } from '../../common/cache/cache.service';
import { slugify } from './utils/slugify';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private propertiesRepository: Repository<Property>,
    @InjectRepository(PropertyUser)
    private propertyUsersRepository: Repository<PropertyUser>,
    private dataSource: DataSource,
    private cache: CacheService,
  ) {}

  async create(userId: string, dto: CreatePropertyDto): Promise<Property> {
    const slug = await this.generateUniqueSlug(dto.name);

    return this.dataSource.transaction(async (manager) => {
      const property = manager.create(Property, { ...dto, slug });
      const saved = await manager.save(property);

      const link = manager.create(PropertyUser, {
        property_id: saved.id,
        user_id: userId,
        role: PropertyUserRole.OWNER,
        is_active: true,
      });
      await manager.save(link);

      return saved;
    });
  }

  async listForUser(userId: string): Promise<Property[]> {
    const links = await this.propertyUsersRepository.find({
      where: { user_id: userId, is_active: true },
      relations: ['property'],
    });
    return links.map((l) => l.property);
  }

  async findOneForUser(userId: string, propertyId: string): Promise<Property> {
    const link = await this.propertyUsersRepository.findOne({
      where: { user_id: userId, property_id: propertyId, is_active: true },
      relations: ['property'],
    });
    if (!link) throw new ForbiddenException('No access to this property');
    if (!link.property) throw new NotFoundException('Property not found');
    return link.property;
  }

  async update(
    propertyId: string,
    dto: UpdatePropertyDto,
  ): Promise<Property> {
    const property = await this.propertiesRepository.findOne({
      where: { id: propertyId },
    });
    if (!property) throw new NotFoundException('Property not found');

    // If name changed, regenerate slug uniqueness
    if (dto.name && dto.name !== property.name) {
      property.slug = await this.generateUniqueSlug(dto.name, propertyId);
    }

    Object.assign(property, dto);
    return this.propertiesRepository.save(property);
  }

  async getDashboard(propertyId: string) {
    const cacheKey = `dashboard:${propertyId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const property = await this.propertiesRepository.findOne({
      where: { id: propertyId },
    });
    if (!property) throw new NotFoundException('Property not found');

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
    const monthStart = today.slice(0, 7) + '-01';
    const monthEnd = today;

    // Occupancy rate for current month
    const occupancyResult = await this.dataSource.query(
      `SELECT
        COUNT(CASE WHEN ra.status = 'booked' THEN 1 END) AS booked,
        COUNT(*) AS total
       FROM room_availability ra
       JOIN rooms r ON ra.room_id = r.id
       WHERE r.property_id = $1
         AND ra.date BETWEEN $2 AND $3`,
      [propertyId, monthStart, monthEnd],
    );
    const booked = parseInt(occupancyResult[0]?.booked || '0', 10);
    const total = parseInt(occupancyResult[0]?.total || '1', 10);
    const occupancyRate = total > 0 ? Math.round((booked / total) * 1000) / 10 : 0;

    // Revenue MTD (payments first, fall back to booking value)
    const revenueResult = await this.dataSource.query(
      `SELECT COALESCE(SUM(p.amount), 0) AS revenue
       FROM payments p
       WHERE p.property_id = $1
         AND p.status = 'completed'
         AND p.paid_at >= $2`,
      [propertyId, monthStart],
    );
    const paymentRevenue = parseFloat(revenueResult[0]?.revenue || '0');

    let revenueMtd = paymentRevenue;
    if (revenueMtd === 0) {
      const bookingRevenueResult = await this.dataSource.query(
        `SELECT COALESCE(SUM(b.total_price), 0) AS revenue
         FROM bookings b
         WHERE b.property_id = $1
           AND b.status NOT IN ('cancelled', 'no_show')
           AND b.check_in >= $2`,
        [propertyId, monthStart],
      );
      revenueMtd = parseFloat(bookingRevenueResult[0]?.revenue || '0');
    }

    // Today's check-ins and check-outs
    const todayActivity = await this.dataSource.query(
      `SELECT
        b.id, b.reference_number, b.check_in, b.check_out, b.status,
        b.total_price, b.source,
        g.first_name, g.last_name,
        r.name AS room_name
       FROM bookings b
       LEFT JOIN guests g ON b.guest_id = g.id
       LEFT JOIN rooms r ON b.room_id = r.id
       WHERE b.property_id = $1
         AND b.status NOT IN ('cancelled', 'no_show')
         AND (b.check_in = $2 OR b.check_out = $2)
       ORDER BY b.check_in`,
      [propertyId, today],
    );

    const toDateStr = (d: any) => d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    const todayCheckIns = todayActivity.filter((a: any) => toDateStr(a.check_in) === today);
    const todayCheckOuts = todayActivity.filter((a: any) => toDateStr(a.check_out) === today);

    // Total bookings this month
    const bookingCountResult = await this.dataSource.query(
      `SELECT COUNT(*) AS cnt
       FROM bookings
       WHERE property_id = $1
         AND status NOT IN ('cancelled', 'no_show')
         AND created_at >= $2`,
      [propertyId, monthStart],
    );
    const totalBookings = parseInt(bookingCountResult[0]?.cnt || '0', 10);

    // Booking sources this month
    const sourcesResult = await this.dataSource.query(
      `SELECT source, COUNT(*) AS count,
              COALESCE(SUM(total_price), 0) AS revenue
       FROM bookings
       WHERE property_id = $1
         AND status NOT IN ('cancelled', 'no_show')
         AND created_at >= $2
       GROUP BY source
       ORDER BY count DESC`,
      [propertyId, monthStart],
    );

    // Recent bookings (last 10)
    const recentBookings = await this.dataSource.query(
      `SELECT
        b.id, b.reference_number, b.check_in, b.check_out,
        b.status, b.total_price, b.source, b.created_at,
        g.first_name, g.last_name,
        r.name AS room_name
       FROM bookings b
       LEFT JOIN guests g ON b.guest_id = g.id
       LEFT JOIN rooms r ON b.room_id = r.id
       WHERE b.property_id = $1
       ORDER BY b.created_at DESC
       LIMIT 10`,
      [propertyId],
    );

    const result = {
      property: { id: property.id, name: property.name },
      kpis: {
        occupancy_rate: occupancyRate,
        revenue_mtd: revenueMtd,
        todays_checkins: todayCheckIns.length,
        todays_checkouts: todayCheckOuts.length,
        total_bookings: totalBookings,
      },
      todays_activity: todayActivity.map((a: any) => ({
        bookingId: a.id,
        reference: a.reference_number,
        guestName: `${a.first_name} ${a.last_name}`,
        roomName: a.room_name,
        type: toDateStr(a.check_in) === today ? 'check_in' : 'check_out',
        status: a.status,
      })),
      booking_sources: sourcesResult.map((s: any) => ({
        source: s.source,
        count: parseInt(s.count, 10),
        revenue: parseFloat(s.revenue),
      })),
      recent_bookings: recentBookings.map((b: any) => ({
        id: b.id,
        reference: b.reference_number,
        guestName: `${b.first_name} ${b.last_name}`,
        roomName: b.room_name,
        checkIn: b.check_in,
        checkOut: b.check_out,
        status: b.status,
        totalPrice: parseFloat(b.total_price),
        source: b.source,
      })),
    };

    await this.cache.set(cacheKey, result, 120);
    return result;
  }

  async getPortfolioOverview(userId: string) {
    const properties = await this.listForUser(userId);
    if (properties.length === 0) return { properties: [], totals: { revenue_mtd: 0, total_bookings: 0, avg_occupancy: 0 } };

    const ids = properties.map((p) => p.id);
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';

    const revenueRows = await this.dataSource.query(
      `SELECT p.property_id, COALESCE(SUM(p.amount), 0) AS revenue
       FROM payments p
       WHERE p.property_id = ANY($1)
         AND p.status = 'completed'
         AND p.paid_at >= $2
       GROUP BY p.property_id`,
      [ids, monthStart],
    );
    const revenueMap = new Map<string, number>(revenueRows.map((r: any) => [r.property_id, parseFloat(r.revenue)]));

    const bookingRows = await this.dataSource.query(
      `SELECT property_id, COUNT(*) AS cnt
       FROM bookings
       WHERE property_id = ANY($1)
         AND status NOT IN ('cancelled', 'no_show')
         AND created_at >= $2
       GROUP BY property_id`,
      [ids, monthStart],
    );
    const bookingMap = new Map<string, number>(bookingRows.map((r: any) => [r.property_id, parseInt(r.cnt, 10)]));

    const occupancyRows = await this.dataSource.query(
      `SELECT r.property_id,
              COUNT(CASE WHEN ra.status = 'booked' THEN 1 END) AS booked,
              COUNT(*) AS total
       FROM room_availability ra
       JOIN rooms r ON ra.room_id = r.id
       WHERE r.property_id = ANY($1)
         AND ra.date BETWEEN $2 AND $3
       GROUP BY r.property_id`,
      [ids, monthStart, today],
    );
    const occMap = new Map<string, { booked: number; total: number }>(occupancyRows.map((r: any) => [r.property_id, {
      booked: parseInt(r.booked, 10),
      total: parseInt(r.total, 10),
    }]));

    const checkinsRows = await this.dataSource.query(
      `SELECT property_id, COUNT(*) AS cnt
       FROM bookings
       WHERE property_id = ANY($1)
         AND status NOT IN ('cancelled', 'no_show')
         AND check_in = $2
       GROUP BY property_id`,
      [ids, today],
    );
    const checkinMap = new Map<string, number>(checkinsRows.map((r: any) => [r.property_id, parseInt(r.cnt, 10)]));

    const propertyData = properties.map((prop) => {
      const occ = occMap.get(prop.id);
      const occupancy = occ && occ.total > 0 ? Math.round((occ.booked / occ.total) * 1000) / 10 : 0;
      return {
        id: prop.id,
        name: prop.name,
        revenue_mtd: revenueMap.get(prop.id) || 0,
        bookings_mtd: bookingMap.get(prop.id) || 0,
        occupancy_rate: occupancy,
        todays_checkins: checkinMap.get(prop.id) || 0,
      };
    });

    const totalRevenue = propertyData.reduce((s, p) => s + p.revenue_mtd, 0);
    const totalBookings = propertyData.reduce((s, p) => s + p.bookings_mtd, 0);
    const avgOccupancy = propertyData.length > 0
      ? Math.round(propertyData.reduce((s, p) => s + p.occupancy_rate, 0) / propertyData.length * 10) / 10
      : 0;

    return {
      properties: propertyData,
      totals: {
        revenue_mtd: totalRevenue,
        total_bookings: totalBookings,
        avg_occupancy: avgOccupancy,
        todays_checkins: propertyData.reduce((s, p) => s + p.todays_checkins, 0),
      },
    };
  }

  async getBookingSettings(propertyId: string) {
    const property = await this.propertiesRepository.findOne({
      where: { id: propertyId },
    });
    if (!property) throw new NotFoundException('Property not found');
    return {
      min_stay_nights: property.min_stay_nights,
      max_stay_nights: property.max_stay_nights,
      advance_booking_days: property.advance_booking_days,
      deposit_required: property.deposit_required,
      deposit_percentage: Number(property.deposit_percentage),
      cancellation_policy: property.cancellation_policy,
    };
  }

  async updateBookingSettings(propertyId: string, dto: UpdateBookingSettingsDto) {
    const property = await this.propertiesRepository.findOne({
      where: { id: propertyId },
    });
    if (!property) throw new NotFoundException('Property not found');
    Object.assign(property, dto);
    const saved = await this.propertiesRepository.save(property);
    return this.getBookingSettings(saved.id);
  }

  private async generateUniqueSlug(
    name: string,
    ignorePropertyId?: string,
  ): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 2;
    while (await this.slugTaken(candidate, ignorePropertyId)) {
      candidate = `${base}-${suffix++}`;
    }
    return candidate;
  }

  private async slugTaken(
    slug: string,
    ignorePropertyId?: string,
  ): Promise<boolean> {
    const existing = await this.propertiesRepository.findOne({
      where: { slug },
    });
    if (!existing) return false;
    return existing.id !== ignorePropertyId;
  }
}
