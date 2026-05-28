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
import { User } from '../../users/entities/user.entity';

export enum PaymentType {
  DEPOSIT = 'deposit',
  FULL = 'full',
  BALANCE = 'balance',
  REFUND = 'refund',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentProvider {
  PAYFAST = 'payfast',
  EFT = 'eft',
  CASH = 'cash',
  CARD_MANUAL = 'card_manual',
}

@Entity('payments')
@Index('idx_payments_booking', ['booking_id'])
@Index('idx_payments_property', ['property_id'])
@Index('idx_payments_status', ['status'])
@Index('idx_payments_provider_ref', ['provider_ref'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  booking_id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'ZAR' })
  currency: string;

  @Column({ type: 'varchar', length: 20 })
  payment_type: PaymentType;

  @Column({ type: 'varchar', length: 20, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  provider: PaymentProvider;

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_ref: string;

  @Column({ type: 'jsonb', nullable: true })
  provider_data: Record<string, any>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  eft_reference: string;

  @Column({ type: 'uuid', nullable: true })
  eft_confirmed_by: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  paid_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  failed_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  refunded_at: Date;

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

  @ManyToOne(() => User)
  @JoinColumn({ name: 'eft_confirmed_by' })
  confirmed_by_user: User;
}
