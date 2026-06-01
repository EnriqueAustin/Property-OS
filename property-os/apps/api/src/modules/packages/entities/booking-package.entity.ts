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
import { Package } from './package.entity';

@Entity('booking_packages')
@Index('idx_booking_packages_booking', ['booking_id'])
@Index('idx_booking_packages_package', ['package_id'])
export class BookingPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  booking_id: string;

  @Column({ type: 'uuid' })
  package_id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price: number;

  @Column({ type: 'varchar', length: 30 })
  added_at_stage: 'booking' | 'checkin' | 'during_stay';

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => Package)
  @JoinColumn({ name: 'package_id' })
  package: Package;
}
