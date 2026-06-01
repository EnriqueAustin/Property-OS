import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { Property } from '../../properties/entities/property.entity';

export enum FolioCategory {
  ROOM_CHARGE = 'room_charge',
  DEPOSIT = 'deposit',
  PAYMENT = 'payment',
  REFUND = 'refund',
  MINIBAR = 'minibar',
  RESTAURANT = 'restaurant',
  LAUNDRY = 'laundry',
  PARKING = 'parking',
  DAMAGE = 'damage',
  LATE_CHECKOUT = 'late_checkout',
  OTHER = 'other',
}

@Entity('folio_items')
@Index('idx_folio_booking', ['booking_id'])
@Index('idx_folio_property', ['property_id'])
export class FolioItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  booking_id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'varchar', length: 50 })
  category: FolioCategory;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'boolean', default: false })
  is_credit: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  posted_by: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
