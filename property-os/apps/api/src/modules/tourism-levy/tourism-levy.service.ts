import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TourismLevySettings, LevyType } from './entities/tourism-levy-settings.entity';
import { TourismLevyRecord } from './entities/tourism-levy-record.entity';
import { UpdateTourismLevySettingsDto } from './dto/tourism-levy.dto';

@Injectable()
export class TourismLevyService {
  constructor(
    @InjectRepository(TourismLevySettings)
    private settingsRepo: Repository<TourismLevySettings>,
    @InjectRepository(TourismLevyRecord)
    private recordsRepo: Repository<TourismLevyRecord>,
  ) {}

  async getSettings(propertyId: string): Promise<TourismLevySettings> {
    let settings = await this.settingsRepo.findOne({
      where: { property_id: propertyId },
    });
    if (!settings) {
      settings = this.settingsRepo.create({ property_id: propertyId });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  async updateSettings(
    propertyId: string,
    dto: UpdateTourismLevySettingsDto,
  ): Promise<TourismLevySettings> {
    let settings = await this.getSettings(propertyId);
    Object.assign(settings, dto);
    return this.settingsRepo.save(settings);
  }

  calculateLevy(
    settings: TourismLevySettings,
    nights: number,
    guestCount: number,
    totalPrice: number,
  ): { levyAmount: number; rate: number } {
    if (!settings.enabled) return { levyAmount: 0, rate: 0 };

    switch (settings.levy_type) {
      case LevyType.PER_NIGHT:
        return {
          levyAmount: Math.round(Number(settings.levy_amount) * nights * 100) / 100,
          rate: Number(settings.levy_amount),
        };
      case LevyType.PER_GUEST_PER_NIGHT:
        return {
          levyAmount: Math.round(Number(settings.levy_amount) * nights * guestCount * 100) / 100,
          rate: Number(settings.levy_amount),
        };
      case LevyType.PERCENTAGE:
        return {
          levyAmount: Math.round(totalPrice * Number(settings.levy_percent) / 100 * 100) / 100,
          rate: Number(settings.levy_percent),
        };
      default:
        return { levyAmount: 0, rate: 0 };
    }
  }

  async createRecord(data: {
    propertyId: string;
    bookingId: string;
    guestId: string;
    levyName: string;
    levyType: string;
    nights: number;
    guestCount: number;
    rate: number;
    totalLevy: number;
    checkIn: string;
    checkOut: string;
  }): Promise<TourismLevyRecord> {
    const record = this.recordsRepo.create({
      property_id: data.propertyId,
      booking_id: data.bookingId,
      guest_id: data.guestId,
      levy_name: data.levyName,
      levy_type: data.levyType,
      nights: data.nights,
      guest_count: data.guestCount,
      rate: data.rate,
      total_levy: data.totalLevy,
      check_in: data.checkIn,
      check_out: data.checkOut,
    });
    return this.recordsRepo.save(record);
  }

  async getReport(
    propertyId: string,
    startDate: string,
    endDate: string,
  ) {
    const records = await this.recordsRepo.find({
      where: {
        property_id: propertyId,
        check_in: Between(startDate, endDate) as any,
      },
      relations: ['booking', 'guest'],
      order: { check_in: 'ASC' },
    });

    const totalLevy = records.reduce(
      (sum, r) => sum + Number(r.total_levy),
      0,
    );
    const totalNights = records.reduce((sum, r) => sum + r.nights, 0);
    const totalGuests = records.reduce((sum, r) => sum + r.guest_count, 0);

    return {
      period: { startDate, endDate },
      summary: {
        totalLevy: Math.round(totalLevy * 100) / 100,
        totalBookings: records.length,
        totalNights,
        totalGuests,
      },
      records: records.map((r) => ({
        id: r.id,
        bookingId: r.booking_id,
        referenceNumber: r.booking?.reference_number,
        guestName: r.guest
          ? `${r.guest.first_name} ${r.guest.last_name}`
          : undefined,
        levyName: r.levy_name,
        levyType: r.levy_type,
        nights: r.nights,
        guestCount: r.guest_count,
        rate: Number(r.rate),
        totalLevy: Number(r.total_levy),
        checkIn: r.check_in,
        checkOut: r.check_out,
        createdAt: r.created_at,
      })),
    };
  }

  async getMonthlyReport(propertyId: string, year: number) {
    const results: Array<{
      month: number;
      monthName: string;
      totalLevy: number;
      bookingCount: number;
      guestNights: number;
    }> = [];

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    for (let month = 0; month < 12; month++) {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = new Date(year, month + 1, 0);
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      const records = await this.recordsRepo.find({
        where: {
          property_id: propertyId,
          check_in: Between(start, end) as any,
        },
      });

      results.push({
        month: month + 1,
        monthName: monthNames[month],
        totalLevy: Math.round(records.reduce((s, r) => s + Number(r.total_levy), 0) * 100) / 100,
        bookingCount: records.length,
        guestNights: records.reduce((s, r) => s + r.nights * r.guest_count, 0),
      });
    }

    return {
      year,
      months: results,
      annualTotal: Math.round(results.reduce((s, m) => s + m.totalLevy, 0) * 100) / 100,
    };
  }
}
