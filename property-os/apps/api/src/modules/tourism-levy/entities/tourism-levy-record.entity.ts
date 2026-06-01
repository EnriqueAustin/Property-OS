import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Guest } from '../../bookings/entities/guest.entity';

@Entity('tourism_levy_records')
@Index('idx_levy_records_property', ['property_id'])
@Index('idx_levy_records_booking', ['booking_id'])
@Index('idx_levy_records_dates', ['property_id', 'check_in', 'check_out'])
export class TourismLevyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'uuid' })
  booking_id: string;

  @Column({ type: 'uuid' })
  guest_id: string;

  @Column({ type: 'varchar', length: 100 })
  levy_name: string;

  @Column({ type: 'varchar', length: 20 })
  levy_type: string;

  @Column({ type: 'int' })
  nights: number;

  @Column({ type: 'int' })
  guest_count: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  rate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_levy: number;

  @Column({ type: 'date' })
  check_in: string;

  @Column({ type: 'date' })
  check_out: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => Guest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guest_id' })
  guest: Guest;
}
