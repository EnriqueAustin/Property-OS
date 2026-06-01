import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Property } from '../../properties/entities/property.entity';

@Entity('alert_settings')
export class AlertSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  property_id: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'int', default: 30 })
  low_occupancy_threshold: number;

  @Column({ type: 'int', default: 7 })
  low_occupancy_lookahead_days: number;

  @Column({ type: 'int', default: 14 })
  no_bookings_days: number;

  @Column({ type: 'int', default: 20 })
  high_cancellation_threshold: number;

  @Column({ type: 'int', default: 15 })
  revenue_drop_threshold: number;

  @Column({ type: 'boolean', default: true })
  email_alerts: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @OneToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
