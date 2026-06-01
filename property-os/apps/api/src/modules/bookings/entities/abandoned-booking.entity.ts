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

@Entity('abandoned_bookings')
@Index('idx_abandoned_property', ['property_id'])
@Index('idx_abandoned_status', ['property_id', 'recovery_status'])
@Index('idx_abandoned_email', ['email'])
export class AbandonedBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  first_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  last_name: string;

  @Column({ type: 'date', nullable: true })
  check_in: string;

  @Column({ type: 'date', nullable: true })
  check_out: string;

  @Column({ type: 'uuid', nullable: true })
  room_type_id: string;

  @Column({ type: 'int', nullable: true })
  guest_count: number;

  @Column({ type: 'int', default: 1 })
  step_reached: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimated_total: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'abandoned',
  })
  recovery_status: 'abandoned' | 'email_sent' | 'recovered' | 'expired';

  @Column({ type: 'timestamp with time zone', nullable: true })
  recovery_email_sent_at: Date;

  @Column({ type: 'varchar', length: 30, nullable: true })
  recovered_booking_ref: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
