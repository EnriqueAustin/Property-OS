import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Refund, RefundStatus } from './entities/refund.entity';
import { Payment, PaymentStatus, PaymentType } from './entities/payment.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { CreateRefundDto, ApproveRefundDto, RejectRefundDto } from './dto/refund.dto';
import { PAYMENT_EVENTS, PaymentRefundedEvent } from './events/payment.events';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    @InjectRepository(Refund)
    private refundsRepo: Repository<Refund>,
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    private eventEmitter: EventEmitter2,
  ) {}

  async createRefund(propertyId: string, userId: string, dto: CreateRefundDto) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: dto.bookingId, property_id: propertyId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const payment = await this.paymentsRepo.findOne({
      where: { id: dto.originalPaymentId, property_id: propertyId },
    });
    if (!payment) throw new NotFoundException('Original payment not found');
    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed payments');
    }

    const existingRefunds = await this.refundsRepo.find({
      where: { original_payment_id: payment.id },
    });
    const alreadyRefunded = existingRefunds
      .filter((r) => r.status !== RefundStatus.REJECTED && r.status !== RefundStatus.FAILED)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    if (alreadyRefunded + dto.amount > Number(payment.amount)) {
      throw new BadRequestException(
        `Refund amount exceeds available balance. Original: ${payment.amount}, already refunded/pending: ${alreadyRefunded}`,
      );
    }

    const refund = this.refundsRepo.create({
      booking_id: dto.bookingId,
      property_id: propertyId,
      original_payment_id: dto.originalPaymentId,
      amount: dto.amount,
      currency: booking.currency,
      status: RefundStatus.REQUESTED,
      reason: dto.reason,
      reason_details: dto.reasonDetails,
      requested_by: userId,
      notes: dto.notes,
    });

    return this.refundsRepo.save(refund);
  }

  async approveRefund(refundId: string, propertyId: string, userId: string, dto: ApproveRefundDto) {
    const refund = await this.getRefund(refundId, propertyId);
    if (refund.status !== RefundStatus.REQUESTED) {
      throw new BadRequestException('Refund is not in requested state');
    }

    refund.status = RefundStatus.APPROVED;
    refund.approved_by = userId;
    refund.approved_at = new Date();
    if (dto.notes) refund.notes = (refund.notes ? refund.notes + '\n' : '') + dto.notes;

    return this.refundsRepo.save(refund);
  }

  async rejectRefund(refundId: string, propertyId: string, userId: string, dto: RejectRefundDto) {
    const refund = await this.getRefund(refundId, propertyId);
    if (refund.status !== RefundStatus.REQUESTED) {
      throw new BadRequestException('Refund is not in requested state');
    }

    refund.status = RefundStatus.REJECTED;
    refund.approved_by = userId;
    refund.notes = (refund.notes ? refund.notes + '\n' : '') + `Rejected: ${dto.reason}`;

    return this.refundsRepo.save(refund);
  }

  async processRefund(refundId: string, propertyId: string, userId: string) {
    const refund = await this.getRefund(refundId, propertyId);
    if (refund.status !== RefundStatus.APPROVED) {
      throw new BadRequestException('Refund must be approved before processing');
    }

    refund.status = RefundStatus.PROCESSING;
    refund.processed_by = userId;
    refund.processed_at = new Date();
    await this.refundsRepo.save(refund);

    // For PayFast refunds, the actual refund would be processed via PayFast API.
    // For EFT/manual, mark as completed immediately (owner handles the actual transfer).
    const originalPayment = await this.paymentsRepo.findOne({
      where: { id: refund.original_payment_id },
    });

    if (originalPayment?.provider === 'payfast') {
      // PayFast refund API integration would go here.
      // For now, mark as completed — owner processes manually via PayFast dashboard.
      this.logger.log(`PayFast refund for ${refund.id} — process via PayFast dashboard`);
    }

    return this.completeRefund(refundId, propertyId);
  }

  async completeRefund(refundId: string, propertyId: string) {
    const refund = await this.getRefund(refundId, propertyId);
    if (refund.status !== RefundStatus.PROCESSING && refund.status !== RefundStatus.APPROVED) {
      throw new BadRequestException('Refund is not in a processable state');
    }

    refund.status = RefundStatus.COMPLETED;
    refund.completed_at = new Date();
    const saved = await this.refundsRepo.save(refund);

    const refundPayment = this.paymentsRepo.create({
      booking_id: refund.booking_id,
      property_id: refund.property_id,
      amount: refund.amount,
      currency: refund.currency,
      payment_type: PaymentType.REFUND,
      status: PaymentStatus.COMPLETED,
      paid_at: new Date(),
      refunded_at: new Date(),
      notes: `Refund ${refund.id} — ${refund.reason}`,
    });
    await this.paymentsRepo.save(refundPayment);

    this.eventEmitter.emit(
      PAYMENT_EVENTS.REFUNDED,
      new PaymentRefundedEvent(refund.booking_id, Number(refund.amount), refund.reason),
    );

    this.logger.log(`Refund ${refundId} completed: ${refund.currency} ${refund.amount}`);
    return saved;
  }

  async listRefunds(propertyId: string, query: { status?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.refundsRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.booking', 'b')
      .leftJoinAndSelect('r.original_payment', 'p')
      .where('r.property_id = :propertyId', { propertyId });

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    qb.orderBy('r.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getRefundById(refundId: string, propertyId: string) {
    return this.getRefund(refundId, propertyId);
  }

  private async getRefund(refundId: string, propertyId: string): Promise<Refund> {
    const refund = await this.refundsRepo.findOne({
      where: { id: refundId, property_id: propertyId },
      relations: ['booking', 'original_payment'],
    });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }
}
