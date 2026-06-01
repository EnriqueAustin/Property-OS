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

export enum AlertType {
  LOW_OCCUPANCY = 'low_occupancy',
  PRICING_SUGGESTION = 'pricing_suggestion',
  NO_BOOKINGS = 'no_bookings',
  HIGH_CANCELLATION = 'high_cancellation',
  REVENUE_DROP = 'revenue_drop',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  DISMISSED = 'dismissed',
}

@Entity('smart_alerts')
@Index('idx_alerts_property', ['property_id'])
@Index('idx_alerts_status', ['property_id', 'status'])
export class SmartAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  property_id: string;

  @Column({ type: 'varchar', length: 50 })
  alert_type: AlertType;

  @Column({ type: 'varchar', length: 20, default: AlertSeverity.WARNING })
  severity: AlertSeverity;

  @Column({ type: 'varchar', length: 20, default: AlertStatus.ACTIVE })
  status: AlertStatus;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  suggested_action: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  acknowledged_at: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
