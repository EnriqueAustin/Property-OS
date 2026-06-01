import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { AbandonedBooking } from './entities/abandoned-booking.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AbandonedBookingService {
  private readonly logger = new Logger(AbandonedBookingService.name);

  constructor(
    @InjectRepository(AbandonedBooking)
    private abandonedRepo: Repository<AbandonedBooking>,
    private events: EventEmitter2,
  ) {}

  async trackAbandonment(data: {
    propertyId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    checkIn?: string;
    checkOut?: string;
    roomTypeId?: string;
    guestCount?: number;
    stepReached: number;
    estimatedTotal?: number;
  }): Promise<AbandonedBooking> {
    const existing = await this.abandonedRepo.findOne({
      where: {
        property_id: data.propertyId,
        email: data.email,
        recovery_status: 'abandoned',
      },
    });

    if (existing) {
      existing.step_reached = Math.max(existing.step_reached, data.stepReached);
      if (data.checkIn) existing.check_in = data.checkIn;
      if (data.checkOut) existing.check_out = data.checkOut;
      if (data.roomTypeId) existing.room_type_id = data.roomTypeId;
      if (data.guestCount) existing.guest_count = data.guestCount;
      if (data.estimatedTotal) existing.estimated_total = data.estimatedTotal;
      if (data.firstName) existing.first_name = data.firstName;
      if (data.lastName) existing.last_name = data.lastName;
      return this.abandonedRepo.save(existing);
    }

    return this.abandonedRepo.save(
      this.abandonedRepo.create({
        property_id: data.propertyId,
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        check_in: data.checkIn,
        check_out: data.checkOut,
        room_type_id: data.roomTypeId,
        guest_count: data.guestCount,
        step_reached: data.stepReached,
        estimated_total: data.estimatedTotal,
        recovery_status: 'abandoned',
      }),
    );
  }

  async markRecovered(propertyId: string, email: string, bookingRef: string) {
    const abandoned = await this.abandonedRepo.findOne({
      where: {
        property_id: propertyId,
        email,
        recovery_status: 'abandoned',
      },
    });
    if (!abandoned) return;

    const emailSent = await this.abandonedRepo.findOne({
      where: {
        property_id: propertyId,
        email,
        recovery_status: 'email_sent',
      },
    });

    const target = emailSent || abandoned;
    target.recovery_status = 'recovered';
    target.recovered_booking_ref = bookingRef;
    await this.abandonedRepo.save(target);
  }

  @Cron('0 */30 * * * *')
  async sendRecoveryEmails() {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const maxAge = new Date(Date.now() - 72 * 60 * 60 * 1000);

    const abandonments = await this.abandonedRepo.find({
      where: {
        recovery_status: 'abandoned',
        created_at: LessThan(cutoff),
        updated_at: MoreThan(maxAge),
      },
      take: 50,
    });

    for (const ab of abandonments) {
      try {
        this.events.emit('abandoned_booking.recovery', {
          propertyId: ab.property_id,
          email: ab.email,
          firstName: ab.first_name,
          checkIn: ab.check_in,
          checkOut: ab.check_out,
          estimatedTotal: ab.estimated_total,
        });

        ab.recovery_status = 'email_sent';
        ab.recovery_email_sent_at = new Date();
        await this.abandonedRepo.save(ab);

        this.logger.log(`Recovery email queued for ${ab.email} (property ${ab.property_id})`);
      } catch (err) {
        this.logger.error(`Failed to send recovery email: ${err}`);
      }
    }

    if (abandonments.length > 0) {
      this.logger.log(`Processed ${abandonments.length} abandoned booking recovery emails`);
    }
  }

  @Cron('0 0 4 * * *')
  async expireOldAbandonments() {
    const expiryCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await this.abandonedRepo
      .createQueryBuilder()
      .update()
      .set({ recovery_status: 'expired' })
      .where('recovery_status IN (:...statuses)', {
        statuses: ['abandoned', 'email_sent'],
      })
      .andWhere('created_at < :cutoff', { cutoff: expiryCutoff })
      .execute();
  }

  async getStats(propertyId: string) {
    const result = await this.abandonedRepo
      .createQueryBuilder('ab')
      .select('ab.recovery_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(ab.estimated_total), 0)', 'total_value')
      .where('ab.property_id = :propertyId', { propertyId })
      .groupBy('ab.recovery_status')
      .getRawMany();

    const stats: Record<string, { count: number; totalValue: number }> = {};
    for (const r of result) {
      stats[r.status] = {
        count: parseInt(r.count, 10),
        totalValue: parseFloat(r.total_value),
      };
    }

    return {
      abandoned: stats['abandoned'] || { count: 0, totalValue: 0 },
      emailSent: stats['email_sent'] || { count: 0, totalValue: 0 },
      recovered: stats['recovered'] || { count: 0, totalValue: 0 },
      expired: stats['expired'] || { count: 0, totalValue: 0 },
      recoveryRate:
        (stats['recovered']?.count || 0) > 0 && ((stats['email_sent']?.count || 0) + (stats['recovered']?.count || 0)) > 0
          ? Math.round(
              ((stats['recovered']?.count || 0) /
                ((stats['email_sent']?.count || 0) + (stats['recovered']?.count || 0))) *
                100,
            )
          : 0,
    };
  }

  async listAbandoned(propertyId: string, status?: string, limit = 50) {
    const where: any = { property_id: propertyId };
    if (status) where.recovery_status = status;

    return this.abandonedRepo.find({
      where,
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}
