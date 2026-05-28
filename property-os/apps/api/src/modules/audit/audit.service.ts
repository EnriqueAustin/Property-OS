import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditEntry {
  propertyId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  async log(entry: AuditEntry) {
    const log = this.auditRepo.create({
      property_id: entry.propertyId,
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      old_values: entry.oldValues,
      new_values: entry.newValues,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
    });
    return this.auditRepo.save(log);
  }

  async listLogs(
    propertyId: string,
    query: { page?: number; limit?: number; entityType?: string; action?: string },
  ) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 30, 100);

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .where('a.property_id = :propertyId', { propertyId })
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.entityType) qb.andWhere('a.entity_type = :et', { et: query.entityType });
    if (query.action) qb.andWhere('a.action = :action', { action: query.action });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  @OnEvent('booking.created')
  async onBookingCreated(event: any) {
    await this.log({
      propertyId: event.propertyId,
      action: 'create',
      entityType: 'booking',
      entityId: event.bookingId,
      newValues: { referenceNumber: event.referenceNumber, source: event.source },
    });
  }

  @OnEvent('booking.cancelled')
  async onBookingCancelled(event: any) {
    await this.log({
      propertyId: event.propertyId,
      action: 'cancel',
      entityType: 'booking',
      entityId: event.bookingId,
      newValues: { reason: event.reason },
    });
  }

  @OnEvent('booking.modified')
  async onBookingModified(event: any) {
    await this.log({
      propertyId: event.propertyId,
      action: 'modify',
      entityType: 'booking',
      entityId: event.bookingId,
      oldValues: Object.fromEntries(
        Object.entries(event.changes || {}).map(([k, v]: [string, any]) => [k, v.old]),
      ),
      newValues: Object.fromEntries(
        Object.entries(event.changes || {}).map(([k, v]: [string, any]) => [k, v.new]),
      ),
    });
  }

  @OnEvent('payment.completed')
  async onPaymentCompleted(event: any) {
    await this.log({
      propertyId: event.propertyId,
      action: 'payment_completed',
      entityType: 'payment',
      entityId: event.paymentId,
      newValues: { amount: event.amount, provider: event.provider },
    });
  }
}
