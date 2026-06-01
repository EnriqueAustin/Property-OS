import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, Repository } from 'typeorm';
import { SmartAlert, AlertType, AlertSeverity, AlertStatus } from './entities/smart-alert.entity';
import { AlertSettings } from './entities/alert-settings.entity';
import { Property } from '../properties/entities/property.entity';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(SmartAlert)
    private alertsRepo: Repository<SmartAlert>,
    @InjectRepository(AlertSettings)
    private settingsRepo: Repository<AlertSettings>,
    @InjectRepository(Property)
    private propertiesRepo: Repository<Property>,
    private dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scanAllProperties() {
    const properties = await this.propertiesRepo.find({ where: { is_active: true } });
    for (const prop of properties) {
      try {
        await this.scanProperty(prop.id);
      } catch (err) {
        this.logger.error(`Alert scan failed for ${prop.id}: ${err}`);
      }
    }
  }

  async scanProperty(propertyId: string) {
    const settings = await this.getSettings(propertyId);
    if (!settings.enabled) return;

    await Promise.all([
      this.checkLowOccupancy(propertyId, settings),
      this.checkNoBookings(propertyId, settings),
      this.checkHighCancellation(propertyId, settings),
      this.suggestPricing(propertyId, settings),
    ]);
  }

  private async checkLowOccupancy(propertyId: string, settings: AlertSettings) {
    const today = new Date().toISOString().slice(0, 10);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + settings.low_occupancy_lookahead_days);
    const end = endDate.toISOString().slice(0, 10);

    const result = await this.dataSource.query(
      `SELECT
        COUNT(CASE WHEN ra.status = 'booked' THEN 1 END) AS booked,
        COUNT(*) AS total
       FROM room_availability ra
       JOIN rooms r ON ra.room_id = r.id
       WHERE r.property_id = $1
         AND ra.date BETWEEN $2 AND $3`,
      [propertyId, today, end],
    );

    const total = parseInt(result[0]?.total || '0', 10);
    const booked = parseInt(result[0]?.booked || '0', 10);
    if (total === 0) return;

    const occupancyPct = Math.round((booked / total) * 100);
    if (occupancyPct < settings.low_occupancy_threshold) {
      await this.createAlertIfNew(propertyId, AlertType.LOW_OCCUPANCY, {
        title: `Low occupancy: ${occupancyPct}% for next ${settings.low_occupancy_lookahead_days} days`,
        message: `Only ${booked} of ${total} room-nights are booked in the next ${settings.low_occupancy_lookahead_days} days (${occupancyPct}%). Consider running a promotion or adjusting pricing.`,
        severity: occupancyPct < 15 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        metadata: { occupancyPct, booked, total, periodDays: settings.low_occupancy_lookahead_days },
        suggestedAction: 'Consider creating a last-minute discount or promoting on social media.',
      });
    }
  }

  private async checkNoBookings(propertyId: string, settings: AlertSettings) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - settings.no_bookings_days);

    const result = await this.dataSource.query(
      `SELECT COUNT(*) AS cnt FROM bookings
       WHERE property_id = $1 AND created_at >= $2 AND status != 'cancelled'`,
      [propertyId, cutoff.toISOString()],
    );

    const count = parseInt(result[0]?.cnt || '0', 10);
    if (count === 0) {
      await this.createAlertIfNew(propertyId, AlertType.NO_BOOKINGS, {
        title: `No new bookings in ${settings.no_bookings_days} days`,
        message: `Your property has not received any new bookings in the last ${settings.no_bookings_days} days. Check that your listing is visible and pricing is competitive.`,
        severity: AlertSeverity.CRITICAL,
        metadata: { daysSinceLastBooking: settings.no_bookings_days },
        suggestedAction: 'Verify your booking page is accessible and consider adjusting your rates.',
      });
    }
  }

  private async checkHighCancellation(propertyId: string, settings: AlertSettings) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.dataSource.query(
      `SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled
       FROM bookings
       WHERE property_id = $1 AND created_at >= $2`,
      [propertyId, thirtyDaysAgo.toISOString()],
    );

    const total = parseInt(result[0]?.total || '0', 10);
    const cancelled = parseInt(result[0]?.cancelled || '0', 10);
    if (total < 5) return;

    const cancelPct = Math.round((cancelled / total) * 100);
    if (cancelPct >= settings.high_cancellation_threshold) {
      await this.createAlertIfNew(propertyId, AlertType.HIGH_CANCELLATION, {
        title: `High cancellation rate: ${cancelPct}% in last 30 days`,
        message: `${cancelled} of ${total} bookings were cancelled in the last 30 days (${cancelPct}%). Review your cancellation policy or investigate common reasons.`,
        severity: AlertSeverity.WARNING,
        metadata: { cancelPct, cancelled, total },
        suggestedAction: 'Review cancellation reasons and consider adjusting your cancellation policy.',
      });
    }
  }

  private async suggestPricing(propertyId: string, settings: AlertSettings) {
    const today = new Date().toISOString().slice(0, 10);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const end = weekEnd.toISOString().slice(0, 10);

    const result = await this.dataSource.query(
      `SELECT
        COUNT(CASE WHEN ra.status = 'booked' THEN 1 END) AS booked,
        COUNT(*) AS total
       FROM room_availability ra
       JOIN rooms r ON ra.room_id = r.id
       WHERE r.property_id = $1
         AND ra.date BETWEEN $2 AND $3`,
      [propertyId, today, end],
    );

    const total = parseInt(result[0]?.total || '0', 10);
    const booked = parseInt(result[0]?.booked || '0', 10);
    if (total === 0) return;

    const occupancy = Math.round((booked / total) * 100);

    if (occupancy > 85) {
      await this.createAlertIfNew(propertyId, AlertType.PRICING_SUGGESTION, {
        title: 'High demand: consider raising rates',
        message: `Next 7 days occupancy is ${occupancy}%. You may be able to increase your rates to maximise revenue.`,
        severity: AlertSeverity.INFO,
        metadata: { occupancy, period: '7 days' },
        suggestedAction: 'Consider a 10-15% rate increase for the coming week.',
      });
    } else if (occupancy < 20) {
      await this.createAlertIfNew(propertyId, AlertType.PRICING_SUGGESTION, {
        title: 'Low demand: consider a last-minute discount',
        message: `Next 7 days occupancy is only ${occupancy}%. A short-term discount could help fill rooms.`,
        severity: AlertSeverity.WARNING,
        metadata: { occupancy, period: '7 days' },
        suggestedAction: 'Create a last-minute pricing rule with a 15-20% discount.',
      });
    }
  }

  private async createAlertIfNew(
    propertyId: string,
    type: AlertType,
    data: {
      title: string;
      message: string;
      severity: AlertSeverity;
      metadata: Record<string, any>;
      suggestedAction: string;
    },
  ) {
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const recent = await this.alertsRepo
      .createQueryBuilder('a')
      .where('a.property_id = :propertyId', { propertyId })
      .andWhere('a.alert_type = :type', { type })
      .andWhere('a.created_at > :cutoff', { cutoff: oneDayAgo })
      .getCount();

    if (recent > 0) return;

    const alert = this.alertsRepo.create({
      property_id: propertyId,
      alert_type: type,
      severity: data.severity,
      title: data.title,
      message: data.message,
      metadata: data.metadata,
      suggested_action: data.suggestedAction,
    });
    await this.alertsRepo.save(alert);
    this.logger.log(`Alert created: [${type}] ${data.title} for property ${propertyId}`);
  }

  // --- CRUD ---

  async listAlerts(propertyId: string, status?: string, page = 1, limit = 20) {
    const qb = this.alertsRepo
      .createQueryBuilder('a')
      .where('a.property_id = :propertyId', { propertyId });
    if (status) qb.andWhere('a.status = :status', { status });
    qb.orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updateAlert(alertId: string, status: AlertStatus) {
    const alert = await this.alertsRepo.findOne({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alert not found');
    alert.status = status;
    if (status === AlertStatus.ACKNOWLEDGED) alert.acknowledged_at = new Date();
    return this.alertsRepo.save(alert);
  }

  async getAlertCounts(propertyId: string) {
    const result = await this.alertsRepo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('a.property_id = :propertyId', { propertyId })
      .groupBy('a.status')
      .getRawMany();

    const counts: Record<string, number> = { active: 0, acknowledged: 0, dismissed: 0 };
    for (const r of result) counts[r.status] = parseInt(r.count, 10);
    return counts;
  }

  async getSettings(propertyId: string): Promise<AlertSettings> {
    let settings = await this.settingsRepo.findOne({
      where: { property_id: propertyId },
    });
    if (!settings) {
      settings = this.settingsRepo.create({ property_id: propertyId });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  async updateSettings(propertyId: string, dto: any): Promise<AlertSettings> {
    const settings = await this.getSettings(propertyId);
    if (dto.enabled !== undefined) settings.enabled = dto.enabled;
    if (dto.lowOccupancyThreshold !== undefined) settings.low_occupancy_threshold = dto.lowOccupancyThreshold;
    if (dto.lowOccupancyLookaheadDays !== undefined) settings.low_occupancy_lookahead_days = dto.lowOccupancyLookaheadDays;
    if (dto.noBookingsDays !== undefined) settings.no_bookings_days = dto.noBookingsDays;
    if (dto.highCancellationThreshold !== undefined) settings.high_cancellation_threshold = dto.highCancellationThreshold;
    if (dto.revenueDropThreshold !== undefined) settings.revenue_drop_threshold = dto.revenueDropThreshold;
    if (dto.emailAlerts !== undefined) settings.email_alerts = dto.emailAlerts;
    return this.settingsRepo.save(settings);
  }
}
