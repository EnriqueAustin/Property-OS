import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { Room } from '../../inventory/entities/room.entity';
import { Guest } from './guest.entity';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum BookingSource {
  DIRECT = 'direct',
  BOOKING_COM = 'booking_com',
  AIRBNB = 'airbnb',
  EXPEDIA = 'expedia',
  LEKKESLAAP = 'lekkeslaap',
  SAFARINOW = 'safarinow',
  WALK_IN = 'walk_in',
  PHONE = 'phone',
  MANUAL = 'manual',
}

@Entity('bookings')
@Check('chk_booking_dates', '"check_out" > "check_in"')
@Index('idx_bookings_property', ['property_id'])
@Index('idx_bookings_room', ['room_id'])
@Index('idx_bookings_guest', ['guest_id'])
@Index('idx_bookings_dates', ['property_id', 'check_in', 'check_out'])
@Index('idx_bookings_status', ['property_id', 'status'])
@Index('idx_bookings_source', ['property_id', 'source'])
@Index('idx_bookings_checkin', ['check_in'])
@Index('idx_bookings_checkout', ['check_out'])
@Index('idx_bookings_group', ['group_id'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'uuid' })
  room_id: string;

  @Column({ type: 'uuid' })
  guest_id: string;

  @Column({ type: 'uuid', nullable: true })
  group_id: string | null;

  @Column({ type: 'int', default: 0 })
  group_index: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  reference_number: string;

  @Column({ type: 'date' })
  check_in: string;

  @Column({ type: 'date' })
  check_out: string;

  @Column({ type: 'int' })
  nights: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price: number;

  @Column({ type: 'varchar', length: 3, default: 'ZAR' })
  currency: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  nightly_rate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deposit_amount: number;

  @Column({ type: 'date', nullable: true })
  balance_due_date: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: BookingStatus.CONFIRMED,
  })
  status: BookingStatus;

  @Column({
    type: 'varchar',
    length: 30,
    default: BookingSource.DIRECT,
  })
  source: BookingSource;

  @Column({ type: 'varchar', length: 255, nullable: true })
  source_ref: string;

  @Column({ type: 'int', default: 1 })
  guest_count: number;

  @Column({ type: 'text', nullable: true })
  special_requests: string;

  @Column({ type: 'text', nullable: true })
  internal_notes: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  cancelled_at: Date;

  @Column({ type: 'text', nullable: true })
  cancellation_reason: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  expected_arrival_time: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  vehicle_registration: string;

  @Column({ type: 'int', nullable: true })
  num_vehicles: number;

  @Column({ type: 'text', nullable: true })
  dietary_requirements: string;

  @Column({ type: 'boolean', default: false })
  online_check_in_completed: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  online_check_in_at: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  promo_code: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount_amount: number;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'NOW()',
  })
  booked_at: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => Guest)
  @JoinColumn({ name: 'guest_id' })
  guest: Guest;
}
