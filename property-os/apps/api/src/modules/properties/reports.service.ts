import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CacheService } from '../../common/cache/cache.service';

@Injectable()
export class ReportsService {
  constructor(
    private dataSource: DataSource,
    private cache: CacheService,
  ) {}

  async occupancyReport(
    propertyId: string,
    startDate: string,
    endDate: string,
    groupBy?: string,
  ) {
    this.validateDates(startDate, endDate);

    const cacheKey = `report:occ:${propertyId}:${startDate}:${endDate}:${groupBy || 'month'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const group = this.resolveGroupBy(groupBy);

    const overall = await this.dataSource.query(
      `SELECT
        COUNT(CASE WHEN ra.status = 'booked' THEN 1 END) AS nights_sold,
        COUNT(*) AS total_nights
       FROM room_availability ra
       JOIN rooms r ON ra.room_id = r.id
       WHERE r.property_id = $1
         AND ra.date BETWEEN $2 AND $3`,
      [propertyId, startDate, endDate],
    );

    const totalNights = parseInt(overall[0]?.total_nights || '0', 10);
    const nightsSold = parseInt(overall[0]?.nights_sold || '0', 10);
    const occupancyRate = totalNights > 0 ? Math.round((nightsSold / totalNights) * 1000) / 10 : 0;

    const periods = await this.dataSource.query(
      `SELECT
        ${group} AS period,
        COUNT(CASE WHEN ra.status = 'booked' THEN 1 END) AS nights_sold,
        COUNT(*) AS total_nights
       FROM room_availability ra
       JOIN rooms r ON ra.room_id = r.id
       WHERE r.property_id = $1
         AND ra.date BETWEEN $2 AND $3
       GROUP BY period
       ORDER BY period`,
      [propertyId, startDate, endDate],
    );

    const byRoomType = await this.dataSource.query(
      `SELECT
        rt.name AS room_type,
        COUNT(CASE WHEN ra.status = 'booked' THEN 1 END) AS nights_sold,
        COUNT(*) AS total_nights
       FROM room_availability ra
       JOIN rooms r ON ra.room_id = r.id
       JOIN room_types rt ON r.room_type_id = rt.id
       WHERE r.property_id = $1
         AND ra.date BETWEEN $2 AND $3
       GROUP BY rt.name
       ORDER BY nights_sold DESC`,
      [propertyId, startDate, endDate],
    );

    const result = {
      overall: {
        occupancyRate,
        totalNightsAvailable: totalNights,
        totalNightsSold: nightsSold,
      },
      periods: periods.map((p: any) => ({
        period: p.period,
        occupancyRate:
          parseInt(p.total_nights, 10) > 0
            ? Math.round((parseInt(p.nights_sold, 10) / parseInt(p.total_nights, 10)) * 1000) / 10
            : 0,
        nightsSold: parseInt(p.nights_sold, 10),
      })),
      byRoomType: byRoomType.map((r: any) => ({
        roomType: r.room_type,
        occupancyRate:
          parseInt(r.total_nights, 10) > 0
            ? Math.round((parseInt(r.nights_sold, 10) / parseInt(r.total_nights, 10)) * 1000) / 10
            : 0,
        nightsSold: parseInt(r.nights_sold, 10),
      })),
    };

    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  async revenueReport(
    propertyId: string,
    startDate: string,
    endDate: string,
    groupBy?: string,
  ) {
    this.validateDates(startDate, endDate);
    const group = this.resolveGroupBy(groupBy);

    const overall = await this.dataSource.query(
      `SELECT
        COALESCE(SUM(p.amount), 0) AS total_revenue,
        COUNT(*) AS payment_count
       FROM payments p
       WHERE p.property_id = $1
         AND p.status = 'completed'
         AND p.payment_type != 'refund'
         AND p.paid_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')`,
      [propertyId, startDate, endDate],
    );

    const periods = await this.dataSource.query(
      `SELECT
        ${group.replace('ra.date', 'p.paid_at::date')} AS period,
        COALESCE(SUM(p.amount), 0) AS revenue,
        COUNT(*) AS payment_count
       FROM payments p
       WHERE p.property_id = $1
         AND p.status = 'completed'
         AND p.payment_type != 'refund'
         AND p.paid_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')
       GROUP BY period
       ORDER BY period`,
      [propertyId, startDate, endDate],
    );

    const byProvider = await this.dataSource.query(
      `SELECT
        p.provider,
        COALESCE(SUM(p.amount), 0) AS revenue,
        COUNT(*) AS payment_count
       FROM payments p
       WHERE p.property_id = $1
         AND p.status = 'completed'
         AND p.payment_type != 'refund'
         AND p.paid_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')
       GROUP BY p.provider
       ORDER BY revenue DESC`,
      [propertyId, startDate, endDate],
    );

    return {
      overall: {
        totalRevenue: parseFloat(overall[0]?.total_revenue || '0'),
        paymentCount: parseInt(overall[0]?.payment_count || '0', 10),
      },
      periods: periods.map((p: any) => ({
        period: p.period,
        revenue: parseFloat(p.revenue),
        paymentCount: parseInt(p.payment_count, 10),
      })),
      byProvider: byProvider.map((p: any) => ({
        provider: p.provider,
        revenue: parseFloat(p.revenue),
        paymentCount: parseInt(p.payment_count, 10),
      })),
    };
  }

  async bookingsBySource(
    propertyId: string,
    startDate: string,
    endDate: string,
  ) {
    this.validateDates(startDate, endDate);

    const result = await this.dataSource.query(
      `SELECT
        source,
        COUNT(*) AS booking_count,
        COALESCE(SUM(total_price), 0) AS total_revenue,
        COALESCE(AVG(total_price), 0) AS avg_booking_value
       FROM bookings
       WHERE property_id = $1
         AND status NOT IN ('cancelled')
         AND booked_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')
       GROUP BY source
       ORDER BY total_revenue DESC`,
      [propertyId, startDate, endDate],
    );

    return result.map((r: any) => ({
      source: r.source,
      bookingCount: parseInt(r.booking_count, 10),
      totalRevenue: parseFloat(r.total_revenue),
      avgBookingValue: Math.round(parseFloat(r.avg_booking_value) * 100) / 100,
    }));
  }

  private validateDates(startDate: string, endDate: string) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be >= startDate');
    }
  }

  private resolveGroupBy(groupBy?: string): string {
    switch (groupBy) {
      case 'day':
        return "TO_CHAR(ra.date, 'YYYY-MM-DD')";
      case 'week':
        return "TO_CHAR(DATE_TRUNC('week', ra.date), 'YYYY-MM-DD')";
      case 'month':
      default:
        return "TO_CHAR(ra.date, 'YYYY-MM')";
    }
  }
}
