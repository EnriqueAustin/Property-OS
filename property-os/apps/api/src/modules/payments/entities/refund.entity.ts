import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Payment } from './payment.entity';
import { User } from '../../users/entities/user.entity';

export enum RefundStatus {
  REQUESTED = 'requested',
  APPROVED = 'approved',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  FAILED = 'failed',
}

export enum RefundReason {
  GUEST_CANCELLATION = 'guest_cancellation',
  OWNER_CANCELLATION = 'owner_cancellation',
  OVERCHARGE = 'overcharge',
  SERVICE_ISSUE = 'service_issue',
  DUPLICATE_PAYMENT = 'duplicate_payment',
  OTHER = 'other',
}

@Entity('refunds')
@Index('idx_refunds_booking', ['booking_id'])
@Index('idx_refunds_property', ['property_id'])
@Index('idx_refunds_status', ['status'])
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  booking_id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'uuid' })
  original_payment_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'ZAR' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: RefundStatus.REQUESTED })
  status: RefundStatus;

  @Column({ type: 'varchar', length: 30 })
  reason: RefundReason;

  @Column({ type: 'text', nullable: true })
  reason_details: string;

  @Column({ type: 'uuid', nullable: true })
  requested_by: string;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string;

  @Column({ type: 'uuid', nullable: true })
  processed_by: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_ref: string;

  @Column({ type: 'jsonb', nullable: true })
  provider_data: Record<string, any>;

  @Column({ type: 'timestamp with time zone', nullable: true })
  approved_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  processed_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completed_at: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => Payment)
  @JoinColumn({ name: 'original_payment_id' })
  original_payment: Payment;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by' })
  requester: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver: User;
}
