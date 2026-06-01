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

    const bookingRevenue = await this.dataSource.query(
      `SELECT
        COALESCE(SUM(b.total_price), 0) AS total_booking_value,
        COUNT(*) AS booking_count
       FROM bookings b
       WHERE b.property_id = $1
         AND b.status NOT IN ('cancelled', 'no_show')
         AND b.check_in BETWEEN $2 AND $3`,
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

    const bookingPeriods = await this.dataSource.query(
      `SELECT
        ${group.replace('ra.date', 'b.check_in')} AS period,
        COALESCE(SUM(b.total_price), 0) AS revenue,
        COUNT(*) AS booking_count
       FROM bookings b
       WHERE b.property_id = $1
         AND b.status NOT IN ('cancelled', 'no_show')
         AND b.check_in BETWEEN $2 AND $3
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

    const paymentRevenue = parseFloat(overall[0]?.total_revenue || '0');
    const totalBookingValue = parseFloat(bookingRevenue[0]?.total_booking_value || '0');

    return {
      overall: {
        totalRevenue: paymentRevenue || totalBookingValue,
        paymentRevenue,
        bookingRevenue: totalBookingValue,
        paymentCount: parseInt(overall[0]?.payment_count || '0', 10),
        bookingCount: parseInt(bookingRevenue[0]?.booking_count || '0', 10),
      },
      periods: (periods.length > 0 ? periods : bookingPeriods).map((p: any) => ({
        period: p.period,
        revenue: parseFloat(p.revenue),
        paymentCount: parseInt(p.payment_count || p.booking_count || '0', 10),
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

  async financialSummary(propertyId: string, startDate: string, endDate: string) {
    this.validateDates(startDate, endDate);

    const revenue = await this.dataSource.query(
      `SELECT
        COALESCE(SUM(CASE WHEN payment_type != 'refund' AND status = 'completed' THEN amount ELSE 0 END), 0) AS gross_revenue,
        COALESCE(SUM(CASE WHEN payment_type = 'refund' AND status = 'completed' THEN amount ELSE 0 END), 0) AS total_refunds,
        COALESCE(SUM(CASE WHEN payment_type = 'deposit' AND status = 'completed' THEN amount ELSE 0 END), 0) AS deposits_collected,
        COALESCE(SUM(CASE WHEN payment_type = 'balance' AND status = 'completed' THEN amount ELSE 0 END), 0) AS balances_collected,
        COALESCE(SUM(CASE WHEN payment_type = 'full' AND status = 'completed' THEN amount ELSE 0 END), 0) AS full_payments,
        COUNT(CASE WHEN status = 'completed' AND payment_type != 'refund' THEN 1 END) AS completed_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count
       FROM payments
       WHERE property_id = $1
         AND created_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')`,
      [propertyId, startDate, endDate],
    );

    const r = revenue[0];
    const grossRevenue = parseFloat(r.gross_revenue);
    const totalRefunds = parseFloat(r.total_refunds);
    const netRevenue = grossRevenue - totalRefunds;
    const vatRate = 15;
    const vatAmount = Math.round(netRevenue * (vatRate / (100 + vatRate)) * 100) / 100;
    const revenueExVat = Math.round((netRevenue - vatAmount) * 100) / 100;

    return {
      grossRevenue,
      totalRefunds,
      netRevenue,
      vatRate,
      vatAmount,
      revenueExVat,
      depositsCollected: parseFloat(r.deposits_collected),
      balancesCollected: parseFloat(r.balances_collected),
      fullPayments: parseFloat(r.full_payments),
      completedPayments: parseInt(r.completed_count, 10),
      failedPayments: parseInt(r.failed_count, 10),
      pendingPayments: parseInt(r.pending_count, 10),
    };
  }

  async taxReport(propertyId: string, startDate: string, endDate: string, groupBy?: string) {
    this.validateDates(startDate, endDate);
    const group = this.resolveGroupBy(groupBy).replace('ra.date', 'p.paid_at::date');

    const periods = await this.dataSource.query(
      `SELECT
        ${group} AS period,
        COALESCE(SUM(CASE WHEN payment_type != 'refund' THEN amount ELSE 0 END), 0) AS gross_revenue,
        COALESCE(SUM(CASE WHEN payment_type = 'refund' THEN amount ELSE 0 END), 0) AS refunds
       FROM payments p
       WHERE p.property_id = $1
         AND p.status = 'completed'
         AND p.paid_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')
       GROUP BY period
       ORDER BY period`,
      [propertyId, startDate, endDate],
    );

    const vatRate = 15;

    return periods.map((p: any) => {
      const gross = parseFloat(p.gross_revenue);
      const refunds = parseFloat(p.refunds);
      const net = gross - refunds;
      const vat = Math.round(net * (vatRate / (100 + vatRate)) * 100) / 100;
      return {
        period: p.period,
        grossRevenue: gross,
        refunds,
        netRevenue: net,
        vatAmount: vat,
        revenueExVat: Math.round((net - vat) * 100) / 100,
      };
    });
  }

  async refundReport(propertyId: string, startDate: string, endDate: string) {
    this.validateDates(startDate, endDate);

    const summary = await this.dataSource.query(
      `SELECT
        COUNT(*) AS total_refunds,
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(AVG(amount), 0) AS avg_amount
       FROM refunds
       WHERE property_id = $1
         AND status = 'completed'
         AND completed_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')`,
      [propertyId, startDate, endDate],
    );

    const byReason = await this.dataSource.query(
      `SELECT
        reason,
        COUNT(*) AS count,
        COALESCE(SUM(amount), 0) AS total_amount
       FROM refunds
       WHERE property_id = $1
         AND status = 'completed'
         AND completed_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')
       GROUP BY reason
       ORDER BY total_amount DESC`,
      [propertyId, startDate, endDate],
    );

    const pending = await this.dataSource.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total_amount
       FROM refunds
       WHERE property_id = $1
         AND status IN ('requested', 'approved', 'processing')`,
      [propertyId],
    );

    return {
      summary: {
        totalRefunds: parseInt(summary[0]?.total_refunds || '0', 10),
        totalAmount: parseFloat(summary[0]?.total_amount || '0'),
        avgAmount: Math.round(parseFloat(summary[0]?.avg_amount || '0') * 100) / 100,
      },
      byReason: byReason.map((r: any) => ({
        reason: r.reason,
        count: parseInt(r.count, 10),
        totalAmount: parseFloat(r.total_amount),
      })),
      pending: {
        count: parseInt(pending[0]?.count || '0', 10),
        totalAmount: parseFloat(pending[0]?.total_amount || '0'),
      },
    };
  }

  async outstandingBalancesReport(propertyId: string) {
    const results = await this.dataSource.query(
      `WITH booking_payments AS (
        SELECT
          b.id AS booking_id,
          b.reference_number,
          b.check_in,
          b.total_price,
          b.currency,
          COALESCE(SUM(CASE WHEN p.status = 'completed' AND p.payment_type != 'refund' THEN p.amount ELSE 0 END), 0) AS paid,
          COALESCE(SUM(CASE WHEN p.status = 'completed' AND p.payment_type = 'refund' THEN p.amount ELSE 0 END), 0) AS refunded
        FROM bookings b
        LEFT JOIN payments p ON p.booking_id = b.id
        WHERE b.property_id = $1
          AND b.status IN ('confirmed', 'pending', 'checked_in')
          AND (b.check_in >= CURRENT_DATE OR b.status = 'checked_in')
        GROUP BY b.id
      )
      SELECT *,
        (total_price - paid + refunded) AS balance
      FROM booking_payments
      WHERE (total_price - paid + refunded) > 0
      ORDER BY check_in ASC`,
      [propertyId],
    );

    const totalOutstanding = results.reduce((sum: number, r: any) => sum + parseFloat(r.balance), 0);

    const aging = {
      within7Days: 0,
      within30Days: 0,
      over30Days: 0,
    };

    const now = new Date();
    for (const r of results) {
      const checkIn = new Date(r.check_in);
      const daysUntil = Math.ceil((checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const balance = parseFloat(r.balance);
      if (daysUntil <= 7) aging.within7Days += balance;
      else if (daysUntil <= 30) aging.within30Days += balance;
      else aging.over30Days += balance;
    }

    return {
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      bookingCount: results.length,
      aging: {
        within7Days: Math.round(aging.within7Days * 100) / 100,
        within30Days: Math.round(aging.within30Days * 100) / 100,
        over30Days: Math.round(aging.over30Days * 100) / 100,
      },
      bookings: results.map((r: any) => ({
        bookingId: r.booking_id,
        referenceNumber: r.reference_number,
        checkIn: r.check_in,
        totalPrice: parseFloat(r.total_price),
        paid: parseFloat(r.paid),
        refunded: parseFloat(r.refunded),
        balance: parseFloat(r.balance),
        currency: r.currency,
      })),
    };
  }

  async paymentMethodBreakdown(propertyId: string, startDate: string, endDate: string) {
    this.validateDates(startDate, endDate);

    const result = await this.dataSource.query(
      `SELECT
        provider,
        payment_type,
        COUNT(*) AS count,
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(AVG(amount), 0) AS avg_amount
       FROM payments
       WHERE property_id = $1
         AND status = 'completed'
         AND payment_type != 'refund'
         AND paid_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')
       GROUP BY provider, payment_type
       ORDER BY total_amount DESC`,
      [propertyId, startDate, endDate],
    );

    return result.map((r: any) => ({
      provider: r.provider,
      paymentType: r.payment_type,
      count: parseInt(r.count, 10),
      totalAmount: parseFloat(r.total_amount),
      avgAmount: Math.round(parseFloat(r.avg_amount) * 100) / 100,
    }));
  }

  async kpiReport(propertyId: string, startDate: string, endDate: string) {
    this.validateDates(startDate, endDate);

    const cacheKey = `report:kpi:${propertyId}:${startDate}:${endDate}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const stats = await this.dataSource.query(
      `WITH room_nights AS (
        SELECT COUNT(*) AS total_nights,
               COUNT(CASE WHEN ra.status = 'booked' THEN 1 END) AS nights_sold
        FROM room_availability ra
        JOIN rooms r ON ra.room_id = r.id
        WHERE r.property_id = $1 AND ra.date BETWEEN $2 AND $3
      ),
      revenue AS (
        SELECT COALESCE(SUM(amount), 0) AS total_revenue
        FROM payments
        WHERE property_id = $1 AND status = 'completed' AND payment_type != 'refund'
          AND paid_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')
      ),
      booking_stats AS (
        SELECT COUNT(*) AS total_bookings
        FROM bookings
        WHERE property_id = $1 AND status NOT IN ('cancelled')
          AND booked_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')
      )
      SELECT rn.total_nights, rn.nights_sold, rev.total_revenue, bs.total_bookings
      FROM room_nights rn, revenue rev, booking_stats bs`,
      [propertyId, startDate, endDate],
    );

    const r = stats[0];
    const totalNights = parseInt(r.total_nights || '0', 10);
    const nightsSold = parseInt(r.nights_sold || '0', 10);
    const totalRevenue = parseFloat(r.total_revenue || '0');
    const totalBookings = parseInt(r.total_bookings || '0', 10);

    const occupancyRate = totalNights > 0 ? Math.round((nightsSold / totalNights) * 1000) / 10 : 0;
    const adr = nightsSold > 0 ? Math.round((totalRevenue / nightsSold) * 100) / 100 : 0;
    const revpar = totalNights > 0 ? Math.round((totalRevenue / totalNights) * 100) / 100 : 0;
    const avgBookingValue = totalBookings > 0 ? Math.round((totalRevenue / totalBookings) * 100) / 100 : 0;

    const result = {
      occupancyRate,
      adr,
      revpar,
      totalRevenue,
      nightsSold,
      totalNightsAvailable: totalNights,
      totalBookings,
      avgBookingValue,
    };

    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  async yearOverYear(propertyId: string, year: number) {
    const currentStart = `${year}-01-01`;
    const currentEnd = `${year}-12-31`;
    const prevStart = `${year - 1}-01-01`;
    const prevEnd = `${year - 1}-12-31`;

    const cacheKey = `report:yoy:${propertyId}:${year}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const query = `
      SELECT
        TO_CHAR(ra.date, 'MM') AS month,
        COUNT(CASE WHEN ra.status = 'booked' THEN 1 END) AS nights_sold,
        COUNT(*) AS total_nights
      FROM room_availability ra
      JOIN rooms r ON ra.room_id = r.id
      WHERE r.property_id = $1 AND ra.date BETWEEN $2 AND $3
      GROUP BY month
      ORDER BY month`;

    const revenueQuery = `
      SELECT
        TO_CHAR(paid_at::date, 'MM') AS month,
        COALESCE(SUM(amount), 0) AS revenue
      FROM payments
      WHERE property_id = $1 AND status = 'completed' AND payment_type != 'refund'
        AND paid_at BETWEEN $2 AND ($3::date + INTERVAL '1 day')
      GROUP BY month
      ORDER BY month`;

    const [currentOcc, prevOcc, currentRev, prevRev] = await Promise.all([
      this.dataSource.query(query, [propertyId, currentStart, currentEnd]),
      this.dataSource.query(query, [propertyId, prevStart, prevEnd]),
      this.dataSource.query(revenueQuery, [propertyId, currentStart, currentEnd]),
      this.dataSource.query(revenueQuery, [propertyId, prevStart, prevEnd]),
    ]);

    const months = Array.from({ length: 12 }, (_, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const curOcc = currentOcc.find((r: any) => r.month === mm);
      const prvOcc = prevOcc.find((r: any) => r.month === mm);
      const curRev = currentRev.find((r: any) => r.month === mm);
      const prvRev = prevRev.find((r: any) => r.month === mm);

      const curNights = parseInt(curOcc?.total_nights || '0', 10);
      const curSold = parseInt(curOcc?.nights_sold || '0', 10);
      const prvNights = parseInt(prvOcc?.total_nights || '0', 10);
      const prvSold = parseInt(prvOcc?.nights_sold || '0', 10);

      const curOccRate = curNights > 0 ? Math.round((curSold / curNights) * 1000) / 10 : 0;
      const prvOccRate = prvNights > 0 ? Math.round((prvSold / prvNights) * 1000) / 10 : 0;

      return {
        month: i + 1,
        currentYear: {
          occupancyRate: curOccRate,
          nightsSold: curSold,
          revenue: parseFloat(curRev?.revenue || '0'),
        },
        previousYear: {
          occupancyRate: prvOccRate,
          nightsSold: prvSold,
          revenue: parseFloat(prvRev?.revenue || '0'),
        },
      };
    });

    const result = { year, comparedTo: year - 1, months };
    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  async exportCsv(
    propertyId: string,
    type: string,
    startDate: string,
    endDate: string,
    groupBy?: string,
  ): Promise<string> {
    switch (type) {
      case 'occupancy': {
        const data: any = await this.occupancyReport(propertyId, startDate, endDate, groupBy);
        const rows = [['Period', 'Occupancy %', 'Nights Sold']];
        for (const p of data.periods) rows.push([p.period, String(p.occupancyRate), String(p.nightsSold)]);
        rows.push([]);
        rows.push(['Room Type', 'Occupancy %', 'Nights Sold']);
        for (const r of data.byRoomType) rows.push([r.roomType, String(r.occupancyRate), String(r.nightsSold)]);
        return this.toCsv(rows);
      }
      case 'revenue': {
        const data = await this.revenueReport(propertyId, startDate, endDate, groupBy);
        const rows = [['Period', 'Revenue', 'Payment Count']];
        for (const p of data.periods) rows.push([p.period, String(p.revenue), String(p.paymentCount)]);
        rows.push([]);
        rows.push(['Provider', 'Revenue', 'Payment Count']);
        for (const p of data.byProvider) rows.push([p.provider, String(p.revenue), String(p.paymentCount)]);
        return this.toCsv(rows);
      }
      case 'bookings-by-source': {
        const data = await this.bookingsBySource(propertyId, startDate, endDate);
        const rows = [['Source', 'Booking Count', 'Total Revenue', 'Avg Booking Value']];
        for (const r of data) rows.push([r.source, String(r.bookingCount), String(r.totalRevenue), String(r.avgBookingValue)]);
        return this.toCsv(rows);
      }
      case 'financial-summary': {
        const data = await this.financialSummary(propertyId, startDate, endDate);
        return this.toCsv([
          ['Metric', 'Value'],
          ['Gross Revenue', String(data.grossRevenue)],
          ['Total Refunds', String(data.totalRefunds)],
          ['Net Revenue', String(data.netRevenue)],
          ['VAT Amount', String(data.vatAmount)],
          ['Revenue Ex VAT', String(data.revenueExVat)],
          ['Deposits Collected', String(data.depositsCollected)],
          ['Balances Collected', String(data.balancesCollected)],
          ['Full Payments', String(data.fullPayments)],
          ['Completed Payments', String(data.completedPayments)],
          ['Failed Payments', String(data.failedPayments)],
          ['Pending Payments', String(data.pendingPayments)],
        ]);
      }
      case 'tax': {
        const data = await this.taxReport(propertyId, startDate, endDate, groupBy);
        const rows = [['Period', 'Gross Revenue', 'Refunds', 'Net Revenue', 'VAT Amount', 'Revenue Ex VAT']];
        for (const p of data) rows.push([p.period, String(p.grossRevenue), String(p.refunds), String(p.netRevenue), String(p.vatAmount), String(p.revenueExVat)]);
        return this.toCsv(rows);
      }
      case 'outstanding-balances': {
        const data = await this.outstandingBalancesReport(propertyId);
        const rows = [['Reference', 'Check-in', 'Total Price', 'Paid', 'Balance', 'Currency']];
        for (const b of data.bookings) rows.push([b.referenceNumber, b.checkIn, String(b.totalPrice), String(b.paid), String(b.balance), b.currency]);
        return this.toCsv(rows);
      }
      case 'payment-methods': {
        const data = await this.paymentMethodBreakdown(propertyId, startDate, endDate);
        const rows = [['Provider', 'Payment Type', 'Count', 'Total Amount', 'Avg Amount']];
        for (const r of data) rows.push([r.provider, r.paymentType, String(r.count), String(r.totalAmount), String(r.avgAmount)]);
        return this.toCsv(rows);
      }
      default:
        throw new BadRequestException(`Unknown report type: ${type}`);
    }
  }

  private toCsv(rows: string[][]): string {
    return rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  private validateDates(startDate: string, endDate: string) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new BadRequestException('Dates must be in YYYY-MM-DD format');
    }
    if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
      throw new BadRequestException('Invalid date values');
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
